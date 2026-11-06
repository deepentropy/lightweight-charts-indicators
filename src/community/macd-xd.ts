/**
 * MACD XD
 *
 * The standard MACD: MACD = MA(src, fast) - MA(src, slow) (EMA or SMA), signal = MA(MACD, signal length) (EMA or SMA),
 * histogram = MACD - signal as columns: dark green above zero and rising, light green above zero and falling, light
 * red below zero and rising, red below zero and falling. Zero line.
 * Alerts (alertcondition, `alerts` of the result): 'Rising to falling' (histogram from >= 0 to < 0) and 'Falling to
 * rising' (histogram from <= 0 to > 0).
 *
 * Reference: "MACD XD" by Zen_Formless
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MacdXdInputs {
  fastLength: number;
  slowLength: number;
  src: SourceType;
  /** Signal smoothing length */
  signalLength: number;
  /** Oscillator MA type */
  smaSource: 'SMA' | 'EMA';
  /** Signal line MA type */
  smaSignal: 'SMA' | 'EMA';
}

export const defaultInputs: MacdXdInputs = {
  fastLength: 12,
  slowLength: 26,
  src: 'close',
  signalLength: 9,
  smaSource: 'EMA',
  smaSignal: 'EMA',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'signalLength', type: 'int', title: 'Signal Smoothing', defval: 9, min: 1, max: 50, display: 'data_window' },
  { id: 'smaSource', type: 'string', title: 'Oscillator MA Type', defval: 'EMA', options: ['SMA', 'EMA'], display: 'data_window' },
  { id: 'smaSignal', type: 'string', title: 'Signal Line MA Type', defval: 'EMA', options: ['SMA', 'EMA'], display: 'data_window' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Histogram', color: '#26A69A', lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'MACD', color: '#2962FF', lineWidth: 1 },
  { id: 'plot2', title: 'Signal', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'MACD XD',
  shortTitle: 'MACD XD',
  overlay: false,
};

/** Pine float comparisons: a < b only when b - a > 1e-10; a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const gt = (a: number, b: number) => a - b > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { alerts: AlertConditionState[] };
type Ma = { step(v: number): number; commit(): void };

/** One moving average (SMA or EMA) stepped bar by bar */
function maStep(len: number, type: 'SMA' | 'EMA'): Ma {
  return type === 'SMA' ? new WindowSma(len) : taStep.ema(len);
}

interface MacdXdRun extends BarRunState<Record<string, never>> {
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

function study(inputs: Partial<MacdXdInputs>): BarStudy<MacdXdRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const zeroColor = String(color.new('#787B86', 50));
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const fast = maStep(cfg.fastLength, cfg.smaSource);
      const slow = maStep(cfg.slowLength, cfg.smaSource);
      const sig = maStep(cfg.signalLength, cfg.smaSignal);
      const s: MacdXdRun = {
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
      const macd = s.fast.step(v) - s.slow.step(v);
      const signal = s.sig.step(macd);
      const h = macd - signal;
      s.hist[i] = h;
      const prev = i > 0 ? s.hist[i - 1] : NaN;
      // hist >= 0 ? (hist[1] < hist ? #26A69A : #B2DFDB) : (hist[1] < hist ? #FFCDD2 : #FF5252)
      const c = ge(h, 0) ? (lt(prev, h) ? '#26A69A' : '#B2DFDB') : lt(prev, h) ? '#FFCDD2' : '#FF5252';
      s.histData[i] = { time: b.time, value: h, color: c };
      s.macdData[i] = { time: b.time, value: macd, color: '#2962FF' };
      s.signalData[i] = { time: b.time, value: signal, color: '#FF6D00' };
      // alertcondition(hist[1] >= 0 and hist < 0) / alertcondition(hist[1] <= 0 and hist > 0)
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
        plots: { plot0: s.histData.slice(), plot1: s.macdData.slice(), plot2: s.signalData.slice() },
        hlines: [
          { value: 0, options: { title: 'Zero Line', color: zeroColor, linestyle: 'dashed' } },
        ],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MacdXdInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MacdXdInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Rising to falling', message: 'The MACD histogram switched from a rising to falling state' },
  { id: 'alert1', title: 'Falling to rising', message: 'The MACD histogram switched from a falling to rising state' },
];

export const MacdXd = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
