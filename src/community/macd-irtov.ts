/**
 * MACD (Buy & Sell signals)
 *
 * The standard MACD: macd = MA(src, fast) - MA(src, slow) (EMA or SMA), signal = MA(macd, signalLength) (EMA or SMA),
 * histogram = macd - signal as columns in four colours (above / below zero, rising / falling). A "B" label below
 * the bar when the MACD crosses above the signal and an "S" label above the bar when it crosses below, on the
 * price pane and only on the last 200 bars (Pine show_last = 200).
 * Alerts (alertcondition, `alerts` of the result): 'Rising to falling' (the histogram turns negative) and 'Falling to
 * rising' (it turns positive).
 *
 * Reference: "MACD (Buy & Sell signals)" by irtov
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MacdIrtovInputs {
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

export const defaultInputs: MacdIrtovInputs = {
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
  { id: 'signalLength', type: 'int', title: 'Signal Smoothing', defval: 9, min: 1, max: 50 },
  { id: 'smaSource', type: 'string', title: 'Oscillator MA Type', defval: 'EMA', options: ['SMA', 'EMA'] },
  { id: 'smaSignal', type: 'string', title: 'Signal Line MA Type', defval: 'EMA', options: ['SMA', 'EMA'] },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Histogram', color: '#26A69A', style: 'columns' },
  { id: 'plot1', title: 'MACD', color: '#2962FF' },
  { id: 'plot2', title: 'Signal', color: '#FF6D00' },
];

export const metadata = {
  title: 'Moving Average Convergence Divergence',
  shortTitle: 'MACD',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

/** Pine show_last of the Buy / Sell shapes */
const SHOW_LAST = 200;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color?: string };
type Ma = { step(v: number): number; commit(): void };

/** One moving average (SMA or EMA) stepped bar by bar */
function maStep(length: number, type: 'SMA' | 'EMA'): Ma {
  return type === 'SMA' ? new WindowSma(length) : taStep.ema(length);
}

interface IrtovRun extends BarRunState<Record<string, never>> {
  fast: Ma;
  slow: Ma;
  sig: Ma;
  over: ReturnType<typeof taStep.crossover>;
  under: ReturnType<typeof taStep.crossunder>;
  hist: number[];
  buy: boolean[];
  sell: boolean[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<MacdIrtovInputs>): BarStudy<IrtovRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  // alertcondition(hist[1] >= 0 and hist < 0, "Rising to falling") / alertcondition(hist[1] <= 0 and hist > 0, ...)
  const le0 = (v: number) => !isNaN(v) && !(v > EPS);
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const fast = maStep(cfg.fastLength, cfg.smaSource);
      const slow = maStep(cfg.slowLength, cfg.smaSource);
      const sig = maStep(cfg.signalLength, cfg.smaSignal);
      const over = taStep.crossover();
      const under = taStep.crossunder();
      const s: IrtovRun = {
        fast, slow, sig, over, under, hist: [], buy: [], sell: [], plot0: [], plot1: [], plot2: [],
        flags: [[], []], times: [[], []],
        steps: [fast, slow, sig, over, under], vars: {}, lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [s.hist, s.buy, s.sell, s.plot0, s.plot1, s.plot2, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const v = value(b);
      const macd = (s.fast.step(v) ?? NaN) - (s.slow.step(v) ?? NaN);
      const signal = s.sig.step(macd) ?? NaN;
      const h = macd - signal;
      s.hist[i] = h;
      s.buy[i] = s.over.step(macd, signal);
      s.sell[i] = s.under.step(macd, signal);
      const prev = i > 0 ? s.hist[i - 1]! : NaN;
      const rising = lt(prev, h);
      const c = ge(h, 0) ? (rising ? '#26A69A' : '#B2DFDB') : (rising ? '#FFCDD2' : '#FF5252');
      s.plot0[i] = { time: b.time, value: fin(h), color: c };
      s.plot1[i] = { time: b.time, value: fin(macd) };
      s.plot2[i] = { time: b.time, value: fin(signal) };
      const flags = [i > 0 && ge(prev, 0) && lt(h, 0), i > 0 && le0(prev) && h > EPS];
      for (let k = 0; k < 2; k++) {
        s.flags[k]![i] = flags[k]!;
        if (flags[k]) s.times[k]!.push(b.time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      // plotshape(buy / sell, shape.labelup / labeldown, location.belowbar / abovebar, size.tiny, force_overlay = true,
      // show_last = 200): only the shapes of the last 200 bars are drawn
      const markers: MarkerData[] = [];
      for (let i = Math.max(0, n - SHOW_LAST); i < n; i++) {
        const time = bars[i]!.time;
        if (s.buy[i]) {
          markers.push({ time, position: 'belowBar', shape: 'labelUp', color: String(color.new('#069981', 0)),
            size: 'tiny', text: 'B', textColor: color.white, forceOverlay: true });
        }
        if (s.sell[i]) {
          markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: String(color.new(color.red, 0)),
            size: 'tiny', text: 'S', textColor: color.white, forceOverlay: true });
        }
      }
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        hlines: [
          { value: 0, options: { title: 'Zero Line', color: String(color.new('#787B86', 50)), linestyle: 'dashed' } },
        ],
        markers,
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MacdIrtovInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MacdIrtovInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Rising to falling', message: 'The MACD histogram switched from a rising to falling state' },
  { id: 'alert1', title: 'Falling to rising', message: 'The MACD histogram switched from a falling to rising state' },
];

export const MacdIrtov = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
