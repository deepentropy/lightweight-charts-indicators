/**
 * Moving Average Crossover with Shading Signals
 *
 * Three moving averages (EMA or SMA): fast, slow and trend. With "Use Dynamic Source" an average takes the low when
 * the close is above the trend average (for the trend average itself: above its plain average of the source) and
 * the high otherwise. The area between the fast and slow averages is lime when fast >= slow > trend, maroon when
 * fast < slow < trend, yellow otherwise. Buy / Sell labels when the averages are stacked up / down and the fast
 * crossed the slow or the slow crossed the trend on this bar; exit crosses when the stack ends.
 *
 * Alerts (alertcondition, `alerts` of the result): 'Long Entry', 'Short Entry', 'Exit Long', 'Exit Short', true on
 * the bars of the Buy / Sell / exit marks.
 *
 * Reference: "Moving Average Crossover with Shading Signals" by Decam9
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Decam9
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import {
  barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma,
  type BarRunState, type BarStudy, type IndicatorRun,
} from '../live-run';

export type MovingAverageCrossoverWithShadingSignalsMaType = 'EMA' | 'SMA';

export interface MovingAverageCrossoverWithShadingSignalsInputs {
  len1: number;
  src1: SourceType;
  ma1Type: MovingAverageCrossoverWithShadingSignalsMaType;
  /** Fast MA: low above the trend average, high below it */
  dynamic1: boolean;
  len2: number;
  src2: SourceType;
  ma2Type: MovingAverageCrossoverWithShadingSignalsMaType;
  /** Slow MA: low above the trend average, high below it */
  dynamic2: boolean;
  len3: number;
  src3: SourceType;
  ma3Type: MovingAverageCrossoverWithShadingSignalsMaType;
  /** Trend MA: low above the plain trend average of the source, high below it */
  dynamic3: boolean;
}

export const defaultInputs: MovingAverageCrossoverWithShadingSignalsInputs = {
  len1: 5,
  src1: 'close',
  ma1Type: 'EMA',
  dynamic1: true,
  len2: 20,
  src2: 'close',
  ma2Type: 'SMA',
  dynamic2: false,
  len3: 50,
  src3: 'close',
  ma3Type: 'SMA',
  dynamic3: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'len1', type: 'int', title: 'Fast MA Length', defval: 5 },
  { id: 'src1', type: 'source', title: 'Source', defval: 'close' },
  { id: 'ma1Type', type: 'string', title: 'Type', defval: 'EMA', options: ['EMA', 'SMA'] },
  { id: 'dynamic1', type: 'bool', title: 'Use Dynamic Source?', defval: true },
  { id: 'len2', type: 'int', title: 'Slow MA Length', defval: 20 },
  { id: 'src2', type: 'source', title: 'Source', defval: 'close' },
  { id: 'ma2Type', type: 'string', title: 'Type', defval: 'SMA', options: ['EMA', 'SMA'] },
  { id: 'dynamic2', type: 'bool', title: 'Use Dynamic Source?', defval: false },
  { id: 'len3', type: 'int', title: 'Trend MA Length', defval: 50 },
  { id: 'src3', type: 'source', title: 'Source', defval: 'close' },
  { id: 'ma3Type', type: 'string', title: 'Type', defval: 'SMA', options: ['EMA', 'SMA'] },
  { id: 'dynamic3', type: 'bool', title: 'Use Dynamic Source?', defval: false },
];

const FAST_COL = String(color.new(color.black, 60));
const SLOW_COL = String(color.new(color.blue, 60));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast MA', color: FAST_COL, lineWidth: 1 },
  { id: 'plot1', title: 'Slow MA', color: SLOW_COL, lineWidth: 1 },
  { id: 'plot2', title: 'Trend MA', color: color.green, lineWidth: 1 },
];

export const metadata = {
  title: 'MA Crossover',
  shortTitle: 'MA Crossover',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (a == b within 1e-10); na operands give false */
const EPS = 1e-10;
const gt = (a: number, b: number): boolean => a - b > EPS;
const lt = (a: number, b: number): boolean => b - a > EPS;
const ge = (a: number, b: number): boolean => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number): boolean => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Ma = { step(v: number): number; commit(): void };

interface MaCrossVars {
  /** ta.cross(Fast, Slow) / ta.cross(Slow, Trend): the values of the last call with both values not na */
  fsA: number;
  fsB: number;
  stA: number;
  stB: number;
  /** uptrend[1] / downtrend[1] */
  prevUp: boolean;
  prevDown: boolean;
}

interface MaCrossRun extends BarRunState<MaCrossVars> {
  trendPlain: Ma | null;
  trend: Ma;
  fast: Ma;
  slow: Ma;
  plots: Point[][];
  shading: string[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<MovingAverageCrossoverWithShadingSignalsInputs>): BarStudy<MaCrossRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  // getMA(_src, _len, _type) => _type == "EMA" ? ta.ema(_src, _len) : ta.sma(_src, _len)
  const getMA = (len: number, type: MovingAverageCrossoverWithShadingSignalsMaType): Ma =>
    (type === 'EMA' ? taStep.ema(len) : new WindowSma(len));
  const src1 = barSource(cfg.src1);
  const src2 = barSource(cfg.src2);
  const src3 = barSource(cfg.src3);
  const lime = String(color.new(color.lime, 75));
  const yellow = String(color.new(color.yellow, 75));
  const maroon = String(color.new(color.maroon, 75));
  // ta.cross(a, b): compared with the last bar where it ran with both values not na (a tie there counts); exact
  // comparisons
  // close > ma ? low : high
  const dynamicSrc = (b: Bar, ma: number) => (gt(b.close, ma) ? b.low : b.high);
  const crossed = (a: number, b: number, p1: number, p2: number) => (a > b && p1 <= p2) || (a < b && p1 >= p2);
  return {
    fullRunReason: () =>
      (isBarSource(cfg.src3) && (cfg.dynamic1 || isBarSource(cfg.src1)) && (cfg.dynamic2 || isBarSource(cfg.src2))
        ? null : 'source of another study'),
    init() {
      // in the order of the ta calls (the same first runtime error)
      const trendPlain = cfg.dynamic3 ? getMA(cfg.len3, cfg.ma3Type) : null;
      const trend = getMA(cfg.len3, cfg.ma3Type);
      const fast = getMA(cfg.len1, cfg.ma1Type);
      const slow = getMA(cfg.len2, cfg.ma2Type);
      const s: MaCrossRun = {
        trendPlain, trend, fast, slow, plots: [[], [], []], shading: [], markers: [],
        flags: [[], [], [], []], times: [[], [], [], []],
        steps: [...(trendPlain ? [trendPlain] : []), trend, fast, slow],
        vars: { fsA: NaN, fsB: NaN, stA: NaN, stB: NaN, prevUp: false, prevDown: false },
        lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [...s.plots, s.shading, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const t = b.time;
      // TrendSrc = dynamic3 ? (close > getMA(src3, len3, ma3_type) ? low : high) : src3
      const trendSrc = s.trendPlain ? dynamicSrc(b, s.trendPlain.step(src3(b))) : src3(b);
      const trend = s.trend.step(trendSrc);
      const fast = s.fast.step(cfg.dynamic1 ? dynamicSrc(b, trend) : src1(b));
      const slow = s.slow.step(cfg.dynamic2 ? dynamicSrc(b, trend) : src2(b));

      s.shading[i] = ge(fast, slow)
        ? (gt(slow, trend) ? lime : yellow)
        : (lt(slow, trend) ? maroon : yellow);
      const uptrend = ge(fast, slow) && ge(slow, trend);
      const downtrend = le(fast, slow) && le(slow, trend);
      // justCrossed = ta.cross(Fast, Slow) or ta.cross(Slow, Trend): the `or` is lazy, so the second cross
      // only runs (and keeps history) on the bars where the first one is false.
      let justCrossed = crossed(fast, slow, v.fsA, v.fsB);
      if (!isNaN(fast) && !isNaN(slow)) {
        v.fsA = fast;
        v.fsB = slow;
      }
      if (!justCrossed) {
        justCrossed = crossed(slow, trend, v.stA, v.stB);
        if (!isNaN(slow) && !isNaN(trend)) {
          v.stA = slow;
          v.stB = trend;
        }
      }
      // plotshape(long, location.belowbar, shape.labelup, color.green, size.tiny, 'Buy')
      if (uptrend && justCrossed) s.markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: color.green, size: 'tiny', id: 'shape0' });
      // plotshape(short, location.abovebar, shape.labeldown, color.red, size.tiny, 'Sell')
      if (downtrend && justCrossed) s.markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: color.red, size: 'tiny', id: 'shape1' });
      // exitLong = uptrend[1] and not uptrend: xcross above the bar, green; exitShort likewise, red
      if (v.prevUp && !uptrend) s.markers.push({ time: t, position: 'aboveBar', shape: 'xcross', color: color.green, size: 'tiny', id: 'shape2' });
      if (v.prevDown && !downtrend) s.markers.push({ time: t, position: 'aboveBar', shape: 'xcross', color: color.red, size: 'tiny', id: 'shape3' });
      // long / short / exitLong / exitShort
      const flags = s.flags;
      flags[0][i] = uptrend && justCrossed;
      flags[1][i] = downtrend && justCrossed;
      flags[2][i] = v.prevUp && !uptrend;
      flags[3][i] = v.prevDown && !downtrend;
      for (let k = 0; k < 4; k++) if (flags[k][i]) s.times[k].push(t as number);
      v.prevUp = uptrend;
      v.prevDown = downtrend;

      s.plots[0][i] = { time: t, value: fast, color: FAST_COL };
      s.plots[1][i] = { time: t, value: slow, color: SLOW_COL };
      // color = close >= Trend ? color.green : color.red
      s.plots[2][i] = { time: t, value: trend, color: ge(b.close, trend) ? color.green : color.red };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice() },
        // fill(ma1, ma2, color = Shading)
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { title: 'Plots Background' }, colors: s.shading.slice() }],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(
  inputs: Partial<MovingAverageCrossoverWithShadingSignalsInputs> = {},
  chart: ChartContext = {},
): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MovingAverageCrossoverWithShadingSignalsInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Long Entry', message: 'Buy' },
  { id: 'alert1', title: 'Short Entry', message: 'Sell' },
  { id: 'alert2', title: 'Exit Long', message: 'Exit Long' },
  { id: 'alert3', title: 'Exit Short', message: 'Exit Short' },
];

export const MovingAverageCrossoverWithShadingSignals = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
