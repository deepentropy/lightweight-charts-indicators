/**
 * Moving Average Convergence Divergence (MACD) Indicator
 *
 * Trend-following momentum indicator: macd = fastMA - slowMA of the source, a signal line (MA of the MACD) and a
 * histogram (macd - signal). The histogram is teal above 0 and red below 0, bright when it rises versus the previous
 * bar and pale otherwise. The moving averages are EMA or SMA (oscillator and signal types chosen separately).
 *
 * Based on the standard "Moving Average Convergence Divergence" indicator. Its two alertcondition() calls
 * (histogram sign changes) are not ported.
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar, type SourceType } from 'oakscriptjs';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type MACDMaType = 'EMA' | 'SMA';

export interface MACDInputs {
  /** Price source */
  src: SourceType;
  /** Fast MA length */
  fastLength: number;
  /** Slow MA length */
  slowLength: number;
  /** Signal MA length */
  signalLength: number;
  /** MA type of the fast and slow averages */
  oscMaType: MACDMaType;
  /** MA type of the signal line */
  signalMaType: MACDMaType;
}

export const defaultInputs: MACDInputs = {
  src: 'close',
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  oscMaType: 'EMA',
  signalMaType: 'EMA',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'fastLength', type: 'int', title: 'Fast length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow length', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal length', defval: 9, min: 1 },
  { id: 'oscMaType', type: 'string', title: 'Oscillator MA type', defval: 'EMA', options: ['EMA', 'SMA'], display: 'none' },
  { id: 'signalMaType', type: 'string', title: 'Signal MA type', defval: 'EMA', options: ['EMA', 'SMA'], display: 'none' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Histogram', color: '#2962FF', lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'MACD', color: '#2962FF', lineWidth: 1 },
  { id: 'plot2', title: 'Signal line', color: '#FF6D00', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, color: '#787B8680', linestyle: 'dashed', title: 'Zero' },
];

export const metadata = {
  title: 'Moving Average Convergence Divergence',
  shortTitle: 'MACD',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Ma = { step(v: number): number; commit(): void };

/** One moving average of the MACD (SMA or EMA) stepped bar by bar */
function maStep(length: number, maType: MACDMaType): Ma {
  if (maType === 'SMA') {
    const m = taStep.sma();
    return { step: (v) => m.step(v, length), commit: () => m.commit() };
  }
  return taStep.ema(length);
}

type Point = { time: number; value: number; color?: string };

interface MacdRun extends BarRunState<Record<string, never>> {
  fast: Ma;
  slow: Ma;
  sig: Ma;
  hist: number[];
  histData: Point[];
  macdData: Point[];
  signalData: Point[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<MACDInputs>): BarStudy<MacdRun, IndicatorResult & { alerts: AlertConditionState[] }> {
  const { src, fastLength, slowLength, signalLength, oscMaType, signalMaType } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const fast = maStep(fastLength, oscMaType);
      const slow = maStep(slowLength, oscMaType);
      const sig = maStep(signalLength, signalMaType);
      const s: MacdRun = {
        fast, slow, sig, hist: [], histData: [], macdData: [], signalData: [], flags: [[], []], times: [[], []],
        steps: [fast, slow, sig], vars: {}, lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [s.hist, s.histData, s.macdData, s.signalData, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = value(b);
      // MACD line = fast MA - slow MA; signal line = MA of the MACD line; histogram = MACD - signal
      const macd = s.fast.step(v) - s.slow.step(v);
      const signal = s.sig.step(macd);
      const h = macd - signal;
      const prev = i > 0 ? s.hist[i - 1] : NaN;
      s.hist[i] = h;
      const color = ge(h, 0) ? (gt(h, prev) ? '#26A69A' : '#B2DFDB') : gt(h, prev) ? '#FFCDD2' : '#FF5252';
      s.histData[i] = { time: b.time, value: h, color };
      s.macdData[i] = { time: b.time, value: macd };
      s.signalData[i] = { time: b.time, value: signal };
      // alertcondition(hist[1] >= 0 and hist < 0) / (hist[1] <= 0 and hist > 0)
      const flags = [i > 0 && ge(prev, 0) && lt(h, 0), i > 0 && le(prev, 0) && gt(h, 0)];
      flags.forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(b.time as number);
      });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.histData.slice(), 'plot1': s.macdData.slice(), 'plot2': s.signalData.slice() },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MACDInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult & { alerts: AlertConditionState[] }> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MACDInputs> = {}): IndicatorResult & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** Reference alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Rising to falling', message: 'The MACD histogram switched from a rising to falling state' },
  { id: 'alert1', title: 'Falling to rising', message: 'The MACD histogram switched from a falling to rising state' },
];

export const MACD = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig, alertConditions };
