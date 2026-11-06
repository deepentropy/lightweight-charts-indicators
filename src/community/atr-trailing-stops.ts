/**
 * ATR + Trailing Stops
 *
 * An ATR of a weighted true range: the body range max(|open - close|, |open - close[1]|, |close - close[1]|) times the
 * body percentage plus the wicks (high - max(open, close) + min(open, close) - low) times the wick percentage,
 * smoothed by RMA / SMA / EMA / WMA over the lookback, times the multiplier. Running mode draws low - ATR and
 * high + ATR on every bar. Trailing mode draws a long stop (low - ATR, only rising) while long and a short stop
 * (high + ATR, only falling) while short, each as a wide line with a thin highlight on top; the side flips when the
 * close (or the wick, per "Flip Trail on") goes beyond the opposite stop, the stop of the new side then restarting at
 * the current low - ATR / high + ATR. Both stops are drawn until the first flip.
 *
 * Alerts (alertcondition, `alerts` of the result): 'Long: Price crossed ATR up' when the flip source goes above the
 * drawn short stop of the bar before (and was not above the one of 2 bars back); 'Short: Price crossed ATR down' the
 * mirror below the drawn long stop.
 *
 * Reference: "ATR + Trailing Stops" by SimpleCryptoLife
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface ATRTrailingStopsInputs {
  /** ATR Lookback Period */
  atrPeriod: number;
  atrMultiplier: number;
  trailMode: 'Running' | 'Trailing';
  flipOn: 'Close' | 'Wick';
  bodyPercent: number;
  wickPercent: number;
  smoothing: 'RMA' | 'SMA' | 'EMA' | 'WMA';
}

export const defaultInputs: ATRTrailingStopsInputs = {
  atrPeriod: 14,
  atrMultiplier: 3,
  trailMode: 'Trailing',
  flipOn: 'Close',
  bodyPercent: 100,
  wickPercent: 100,
  smoothing: 'RMA',
};

export const inputConfig: InputConfig[] = [
  { id: 'atrPeriod', type: 'int', title: 'ATR Lookback Period', defval: 14 },
  { id: 'atrMultiplier', type: 'float', title: 'ATR Multiplier', defval: 3, min: 0.5, max: 4, step: 0.1 },
  { id: 'trailMode', type: 'string', title: 'Trail Mode', defval: 'Trailing', options: ['Running', 'Trailing'] },
  { id: 'flipOn', type: 'string', title: 'Flip Trail on:', defval: 'Close', options: ['Close', 'Wick'] },
  { id: 'bodyPercent', type: 'int', title: 'Percentage of Body to Include', defval: 100, min: 0, max: 200, step: 10, group: 'Advanced Settings' },
  { id: 'wickPercent', type: 'int', title: 'Percentage of Wick to Include', defval: 100, min: 0, max: 200, step: 10 },
  { id: 'smoothing', type: 'string', title: 'ATR Smoothing Mode', defval: 'RMA', options: ['RMA', 'SMA', 'EMA', 'WMA'] },
];

const WHITE_60 = String(color.new(color.white, 60));
const NAVY_50 = String(color.new(color.navy, 50));
const MAROON_50 = String(color.new(color.maroon, 50));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Running ATR Low', color: WHITE_60, lineWidth: 1 },
  { id: 'plot1', title: 'Running ATR High', color: WHITE_60, lineWidth: 1 },
  { id: 'plot2', title: 'Trailing ATR Long Stop', color: NAVY_50, lineWidth: 3, style: 'linebr' },
  { id: 'plot3', title: 'Trailing ATR Long Stop Highlight', color: '#00897B', lineWidth: 1, style: 'linebr' },
  { id: 'plot4', title: 'Trailing ATR Short Stop', color: MAROON_50, lineWidth: 3, style: 'linebr' },
  { id: 'plot5', title: 'Trailing ATR Short Stop Highlight', color: '#FF5252', lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'ATR + Trailing Stops',
  shortTitle: 'ATR Trail',
  overlay: true,
};

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Long: Price crossed ATR up', message: 'Price crossed the trailing ATR short stop (bullish)' },
  { id: 'alert1', title: 'Short: Price crossed ATR down', message: 'Price crossed trailing ATR long stop (bearish)' },
];

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Point = { time: number; value: number };
type Result = IndicatorResult & { alerts: AlertConditionState[] };

interface AtrTrailVars {
  /** var float trailAtrLong = atrLow / trailAtrShort = atrHigh (na on bar 0: the ATR is na there) */
  trailLong: number;
  trailShort: number;
  /** var bool _isLong = true / _isShort = true of f_flip; their [1] is na on bar 0 */
  isLongPrev: boolean | null;
  isShortPrev: boolean | null;
}

interface AtrTrailRun extends BarRunState<AtrTrailVars> {
  ma: Committable & { step(v: number): number };
  longPlot: number[];
  shortPlot: number[];
  plots: Point[][];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<ATRTrailingStopsInputs>): BarStudy<AtrTrailRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const running = cfg.trailMode === 'Running';
  const trailing = cfg.trailMode === 'Trailing';
  const flipLongSrc = (b: Bar) => (cfg.flipOn === 'Close' ? b.close : b.high);
  const flipShortSrc = (b: Bar) => (cfg.flipOn === 'Close' ? b.close : b.low);
  const at = (a: number[], k: number) => (k >= 0 ? a[k] : NaN);
  return {
    init() {
      // f_ma(_source, atrLookback, atrSmoothingMode)
      let ma: AtrTrailRun['ma'];
      if (cfg.smoothing === 'RMA') ma = taStep.rma(cfg.atrPeriod);
      else if (cfg.smoothing === 'SMA') ma = new WindowSma(cfg.atrPeriod);
      else if (cfg.smoothing === 'EMA') ma = taStep.ema(cfg.atrPeriod);
      else {
        const w = taStep.wma();
        ma = { step: (v) => w.step(v, cfg.atrPeriod), commit: () => w.commit() };
      }
      const s: AtrTrailRun = {
        ma, longPlot: [], shortPlot: [], plots: [[], [], [], [], [], []], flags: [[], []], times: [[], []],
        steps: [ma], vars: { trailLong: NaN, trailShort: NaN, isLongPrev: null, isShortPrev: null }, lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [s.longPlot, s.shortPlot, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const time = b.time;
      // atrPercentAdjustedTrueRange (na on bar 0: close[1] is na)
      let tr = NaN;
      if (i > 0) {
        const c1 = bars[i - 1].close;
        const body = Math.max(Math.abs(b.open - b.close), Math.abs(b.open - c1), Math.abs(b.close - c1));
        const wick = b.high - Math.max(b.open, b.close) + Math.min(b.open, b.close) - b.low;
        tr = body * (cfg.bodyPercent / 100) + wick * (cfg.wickPercent / 100);
      }
      const atrM = s.ma.step(tr) * cfg.atrMultiplier;
      const atrLow = b.low - atrM;
      const atrHigh = b.high + atrM;
      // f_trail: the long stop keeps its value while the source is at or below it ('up'), the short stop while the
      // source is at or above it ('down')
      let trailLong = le(atrLow, v.trailLong) ? v.trailLong : atrLow;
      let trailShort = ge(atrHigh, v.trailShort) ? v.trailShort : atrHigh;
      const isLongPrev = v.isLongPrev;
      const isShortPrev = v.isShortPrev;
      // f_flip
      let flipLong: boolean = isShortPrev === true && gt(flipLongSrc(b), trailShort);
      let flipShort: boolean = isLongPrev === true && lt(flipShortSrc(b), trailLong);
      flipLong = flipShort && flipLong && gt(b.close, trailLong) ? true : flipShort && flipLong && le(b.close, trailLong) ? false : flipLong;
      flipShort = flipLong && flipShort && lt(b.close, trailShort) ? true : flipShort && flipLong && ge(b.close, trailShort) ? false : flipShort;
      const isLong: boolean = flipLong ? true : flipShort ? false : isLongPrev === null ? true : isLongPrev;
      const isShort: boolean = flipShort ? true : flipLong ? false : isShortPrev === null ? true : isShortPrev;
      // a side that starts on this bar resets its stop (`not _isLong[1]` is na, so false, on bar 0)
      if (isLong && isLongPrev === false) trailLong = atrLow;
      if (isShort && isShortPrev === false) trailShort = atrHigh;
      const longPlot = isLong ? trailLong : NaN;
      const shortPlot = isShort ? trailShort : NaN;
      s.longPlot[i] = longPlot;
      s.shortPlot[i] = shortPlot;
      v.trailLong = trailLong;
      v.trailShort = trailShort;
      v.isLongPrev = isLong;
      v.isShortPrev = isShort;

      const p = s.plots;
      p[0][i] = { time, value: running ? atrLow : NaN };
      p[1][i] = { time, value: running ? atrHigh : NaN };
      p[2][i] = { time, value: trailing ? longPlot : NaN };
      p[3][i] = { time, value: trailing ? longPlot : NaN };
      p[4][i] = { time, value: trailing ? shortPlot : NaN };
      p[5][i] = { time, value: trailing ? shortPlot : NaN };

      // alertCrossAtrShortStop = flipLongSource > trailAtrShortPlot[1] and flipLongSource[1] <= trailAtrShortPlot[2]
      const prev = i > 0 ? bars[i - 1] : null;
      const crossShortStop = gt(flipLongSrc(b), at(s.shortPlot, i - 1)) && le(prev ? flipLongSrc(prev) : NaN, at(s.shortPlot, i - 2));
      const crossLongStop = lt(flipShortSrc(b), at(s.longPlot, i - 1)) && ge(prev ? flipShortSrc(prev) : NaN, at(s.longPlot, i - 2));
      s.flags[0][i] = crossShortStop;
      s.flags[1][i] = crossLongStop;
      if (crossShortStop) s.times[0].push(time as number);
      if (crossLongStop) s.times[1].push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(),
          plot1: p[1].slice(),
          plot2: p[2].slice(),
          plot3: p[3].slice(),
          plot4: p[4].slice(),
          plot5: p[5].slice(),
        },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ATRTrailingStopsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<ATRTrailingStopsInputs> = {},
): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const ATRTrailingStops = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
