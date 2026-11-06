/**
 * Fibonacci Entry Bands [AlgoAlpha]
 *
 * The basis is a double EMA (EMA of the EMA) of the source; the trend is up while the basis rises, down while it
 * falls (kept on a flat bar). Bands at 0.618, 1.0, 1.618 and 2.618 times the ATR (or the standard deviation of the
 * source) are drawn below the basis in an up trend and above it in a down trend, with a gradient fill between the
 * 0.618 and 2.618 bands (chart background at the inner band, the trend colour at the outer one). Bars take the
 * trend colour with a transparency that follows the distance of the close from the basis (the basis colour when
 * the open / close average is on the wrong side of the basis). Entry labels mark a turn of the basis; crosses mark
 * a close through the take-profit band chosen by "TP Aggressiveness" against the trend; triangles mark a bounce
 * off the basis.
 * Chart values (optional third argument of calculate): `chart.bg_color` of the fills from the context (fallback
 * #0F0F0F, see chart-context.ts).
 *
 * Reference: "Fibonacci Entry Bands [AlgoAlpha]" by AlgoAlpha
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © AlgoAlpha
 */

import {
  taStep, color,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type FillConfig, type FillData,
  type ShapeConfig, type BarColorConfig, type SourceType,
} from 'oakscriptjs';
import type { BarColorData, MarkerData } from '../types';
import { backgroundColorOf, type ChartContext } from '../chart-context';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface FibonacciEntryBandsInputs {
  /** TP Aggressiveness */
  tpAggressiveness: 'low' | 'medium' | 'high';
  /** Source */
  src: SourceType;
  /** Length */
  len: number;
  /** ATR Length */
  atrLen: number;
  /** Use ATR */
  useATR: boolean;
  /** Show Take Profit Crosses */
  showRej: boolean;
  /** Show Basis Bounce Arrows */
  showBounce: boolean;
  /** Custom Bar Color */
  colorbar: boolean;
  /** Bullish Color */
  green: string;
  /** Bearish Color */
  red: string;
  /** Basis Color */
  gray: string;
}

export const defaultInputs: FibonacciEntryBandsInputs = {
  tpAggressiveness: 'low',
  src: 'hlc3',
  len: 21,
  atrLen: 14,
  useATR: true,
  showRej: true,
  showBounce: true,
  colorbar: true,
  green: '#00ffbb',
  red: '#ff1100',
  gray: '#787B86',
};

const G1 = 'Indicator Settings';
const G2 = 'Visual Options';

export const inputConfig: InputConfig[] = [
  { id: 'tpAggressiveness', type: 'string', title: 'TP Aggressiveness', defval: 'low', options: ['low', 'medium', 'high'], group: G1, tooltip: 'Controls how aggressive the Take Profit (TP) trigger is. Low = slower exits, High = faster exits.', display: 'data_window' },
  { id: 'src', type: 'source', title: 'Source', defval: 'hlc3', group: G1, tooltip: 'Price source used for band calculations', display: 'data_window' },
  { id: 'len', type: 'int', title: 'Length', defval: 21, group: G1, tooltip: 'Length for the basis calculation', display: 'data_window' },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 14, group: G1, tooltip: 'Length for ATR or Stdev volatility basis', display: 'data_window' },
  { id: 'useATR', type: 'bool', title: 'Use ATR', defval: true, group: G1, tooltip: 'Toggle between ATR or standard deviation for band width', display: 'data_window' },
  { id: 'showRej', type: 'bool', title: 'Show Take Profit Crosses', defval: true, group: G2, display: 'data_window' },
  { id: 'showBounce', type: 'bool', title: 'Show Basis Bounce Arrows', defval: true, group: G2, display: 'data_window' },
  { id: 'colorbar', type: 'bool', title: 'Custom Bar Color', defval: true, group: G2, display: 'data_window' },
  { id: 'green', type: 'color', title: 'Bullish Color', defval: '#00ffbb', group: G2, display: 'data_window' },
  { id: 'red', type: 'color', title: 'Bearish Color', defval: '#ff1100', group: G2, display: 'data_window' },
  { id: 'gray', type: 'color', title: 'Basis Color', defval: '#787B86', group: G2, display: 'data_window' },
];

const c = (col: string, t: number) => String(color.new(col, t));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Basis', color: '#787B86', lineWidth: 1 },
  { id: 'plot1', title: 'Upper 0.618', color: c('#ff1100', 60), lineWidth: 1, style: 'linebr' },
  { id: 'plot2', title: 'Upper 2.618', color: c('#ff1100', 30), lineWidth: 1, style: 'linebr' },
  { id: 'plot3', title: 'Lower 0.618', color: c('#00ffbb', 60), lineWidth: 1, style: 'linebr' },
  { id: 'plot4', title: 'Lower 2.618', color: c('#00ffbb', 30), lineWidth: 1, style: 'linebr' },
  { id: 'plot5', title: 'Upper 1.0', color: c('#ff1100', 50), lineWidth: 1, style: 'linebr' },
  { id: 'plot6', title: 'Upper 1.618', color: c('#ff1100', 40), lineWidth: 1, style: 'linebr' },
  { id: 'plot7', title: 'Lower 1.0', color: c('#00ffbb', 50), lineWidth: 1, style: 'linebr' },
  { id: 'plot8', title: 'Lower 1.618', color: c('#00ffbb', 40), lineWidth: 1, style: 'linebr' },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot1', plot2: 'plot2', title: 'Downtrend Band Fill' },
  { id: 'fill1', plot1: 'plot3', plot2: 'plot4', title: 'Uptrend Band Fill' },
];

export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Long Entry', style: 'labelup', location: 'absolute', color: '#00ffbb', text: '▲', textcolor: '#FFFFFF' },
  { id: 'shape1', kind: 'shape', title: 'Short Entry', style: 'labeldown', location: 'absolute', color: '#ff1100', text: '▼', textcolor: '#FFFFFF' },
  { id: 'shape2', kind: 'shape', title: 'Rejection Long', style: 'xcross', location: 'belowbar', color: '#ff1100', size: 'tiny' },
  { id: 'shape3', kind: 'shape', title: 'Rejection Short', style: 'xcross', location: 'abovebar', color: '#00ffbb', size: 'tiny' },
  { id: 'shape4', kind: 'shape', title: 'Long Bounce', style: 'triangleup', location: 'belowbar', color: '#00ffbb', size: 'tiny' },
  { id: 'shape5', kind: 'shape', title: 'Short Bounce', style: 'triangledown', location: 'abovebar', color: '#ff1100', size: 'tiny' },
];

export const barColorConfig: BarColorConfig[] = [{ id: 'barcolor0', kind: 'barcolor', title: 'Bar Color' }];

export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Long Entry', message: '' },
  { id: 'alert1', title: 'Short Entry', message: '' },
  { id: 'alert2', title: 'Rejection Long (TP for Short)', message: '' },
  { id: 'alert3', title: 'Rejection Short (TP for Long)', message: '' },
  { id: 'alert4', title: 'Long Bounce', message: '' },
  { id: 'alert5', title: 'Short Bounce', message: '' },
];

export const metadata = {
  title: 'Fibonacci Entry Bands [AlgoAlpha]',
  shortTitle: 'AlgoAlpha - Entry Bands',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };

type Result = IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[]; alerts: AlertConditionState[] };

interface FebVars {
  /** basis > basis[1] ? 1 : basis < basis[1] ? -1 : nz(trend[1]) */
  trend: number;
}

interface FebRun extends BarRunState<FebVars> {
  ema1: ReturnType<typeof taStep.ema>;
  ema2: ReturnType<typeof taStep.ema>;
  atr: ReturnType<typeof taStep.atr> | null;
  dev: WindowStdev | null;
  longX: ReturnType<typeof taStep.crossover>;
  shortX: ReturnType<typeof taStep.crossunder>;
  con1X: ReturnType<typeof taStep.crossunder>;
  con2X: ReturnType<typeof taStep.crossover>;
  bgFill: string;
  basis: number[];
  plots: Point[][];
  up1: number[];
  up4: number[];
  lo1: number[];
  lo4: number[];
  markers: MarkerData[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<FibonacciEntryBandsInputs>): BarStudy<FebRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const mult1 = 0.618;
  const mult2 = 1.0;
  const mult3 = 1.618;
  const mult4 = 2.618;
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const lineColors = [
    cfg.gray, c(cfg.red, 60), c(cfg.red, 30), c(cfg.green, 60), c(cfg.green, 30),
    c(cfg.red, 50), c(cfg.red, 40), c(cfg.green, 50), c(cfg.green, 40),
  ];
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init(_bars, chart) {
      if (!cfg.useATR) taStep.stdev().step(0, cfg.len); // the length check of ta.stdev
      const s: FebRun = {
        ema1: taStep.ema(cfg.len), ema2: taStep.ema(cfg.len),
        atr: cfg.useATR ? taStep.atr(cfg.atrLen) : null, dev: cfg.useATR ? null : new WindowStdev(cfg.len),
        longX: taStep.crossover(), shortX: taStep.crossunder(), con1X: taStep.crossunder(), con2X: taStep.crossover(),
        bgFill: c(backgroundColorOf(chart), 90),
        basis: [], plots: Array.from({ length: 9 }, () => []), up1: [], up4: [], lo1: [], lo4: [],
        markers: [], barColors: [], flags: Array.from({ length: 6 }, () => []), times: Array.from({ length: 6 }, () => []),
        steps: [], vars: { trend: 0 }, lists: [], series: [],
      };
      s.steps = [s.ema1, s.ema2, ...(s.atr ? [s.atr] : []), ...(s.dev ? [s.dev] : []), s.longX, s.shortX, s.con1X, s.con2X];
      s.lists = [s.markers, s.barColors, ...s.times];
      s.series = [s.basis, ...s.plots, s.up1, s.up4, s.lo1, s.lo4, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const t = b.time;
      const src = value(b);
      const basis = s.ema2.step(s.ema1.step(src));
      s.basis[i] = basis;
      const vol = s.atr ? s.atr.step(b.high, b.low, b.close) : s.dev!.step(src);

      const prev = i > 0 ? s.basis[i - 1] : NaN;
      // basis > basis[1] ? 1 : basis < basis[1] ? -1 : nz(trend[1])
      v.trend = gt(basis, prev) ? 1 : lt(basis, prev) ? -1 : v.trend;
      const trend = v.trend;

      const upper1 = basis + vol * mult1;
      const upper2 = basis + vol * mult2;
      const upper3 = basis + vol * mult3;
      const upper4 = basis + vol * mult4;
      const lower1 = basis + -1 * vol * mult1;
      const lower2 = basis + -1 * vol * mult2;
      const lower3 = basis + -1 * vol * mult3;
      const lower4 = basis + -1 * vol * mult4;

      const up1 = trend === -1 ? upper1 : NaN;
      const up4 = trend === -1 ? upper4 : NaN;
      const lo1 = trend === 1 ? lower1 : NaN;
      const lo4 = trend === 1 ? lower4 : NaN;
      s.up1[i] = up1;
      s.up4[i] = up4;
      s.lo1[i] = lo1;
      s.lo4[i] = lo4;

      const p = s.plots;
      p[0][i] = { time: t, value: fin(basis), color: lineColors[0] };
      p[1][i] = { time: t, value: fin(up1), color: lineColors[1] };
      p[2][i] = { time: t, value: fin(up4), color: lineColors[2] };
      p[3][i] = { time: t, value: fin(lo1), color: lineColors[3] };
      p[4][i] = { time: t, value: fin(lo4), color: lineColors[4] };
      p[5][i] = { time: t, value: fin(trend === -1 ? upper2 : NaN), color: lineColors[5] };
      p[6][i] = { time: t, value: fin(trend === -1 ? upper3 : NaN), color: lineColors[6] };
      p[7][i] = { time: t, value: fin(trend === 1 ? lower2 : NaN), color: lineColors[7] };
      p[8][i] = { time: t, value: fin(trend === 1 ? lower3 : NaN), color: lineColors[8] };

      // Signals: ta.crossover(basis, basis[1]) / ta.crossunder(basis, basis[1])
      const longSignal = s.longX.step(basis, prev);
      const shortSignal = s.shortX.step(basis, prev);

      // switch tpAggressiveness (var floats assigned on every bar)
      const tpLongBand = cfg.tpAggressiveness === 'medium' ? lower2 : cfg.tpAggressiveness === 'high' ? lower1 : lower4;
      const tpShortBand = cfg.tpAggressiveness === 'medium' ? upper2 : cfg.tpAggressiveness === 'high' ? upper1 : upper4;
      const con1 = s.con1X.step(b.close, tpLongBand);
      const con2 = s.con2X.step(b.close, tpShortBand);

      // normDist = |close - basis| / (vol * mult4) when the trend is set, capped at 1
      let normDist = trend !== 0 ? Math.abs(b.close - basis) / (vol * mult4) : 0;
      normDist = Math.min(normDist, 1);
      const alpha = Math.min(Math.round(normDist * 100), 70);
      const avgOc = (b.open + b.close) / 2;
      let barCol: string | null = null;
      if (trend === 1) barCol = lt(avgOc, basis) ? cfg.gray : c(cfg.green, alpha);
      else if (trend === -1) barCol = gt(avgOc, basis) ? cfg.gray : c(cfg.red, alpha);
      if (cfg.colorbar && barCol !== null) s.barColors.push({ id: 'barcolor0', time: t, color: barCol });

      // plotshape(longSignal ? lower4 : na, location.absolute, shape.labelup ...)
      if (longSignal && Number.isFinite(lower4)) {
        s.markers.push({ id: 'shape0', time: t, position: 'atPriceBottom', price: lower4, shape: 'labelUp', color: cfg.green, text: '▲', textColor: '#FFFFFF' });
      }
      if (shortSignal && Number.isFinite(upper4)) {
        s.markers.push({ id: 'shape1', time: t, position: 'atPriceTop', price: upper4, shape: 'labelDown', color: cfg.red, text: '▼', textColor: '#FFFFFF' });
      }
      const rejectionLong = cfg.showRej && con1 && trend === -1;
      const rejectionShort = cfg.showRej && con2 && trend === 1;
      if (rejectionLong) s.markers.push({ id: 'shape2', time: t, position: 'belowBar', shape: 'xcross', color: cfg.red, size: 'tiny' });
      if (rejectionShort) s.markers.push({ id: 'shape3', time: t, position: 'aboveBar', shape: 'xcross', color: cfg.green, size: 'tiny' });
      const longBounce = cfg.showBounce && trend === 1 && lt(b.low, basis) && gt(b.close, basis) && !longSignal;
      const shortBounce = cfg.showBounce && trend === -1 && gt(b.high, basis) && lt(b.close, basis) && !shortSignal;
      if (longBounce) s.markers.push({ id: 'shape4', time: t, position: 'belowBar', shape: 'triangleUp', color: cfg.green, size: 'tiny' });
      if (shortBounce) s.markers.push({ id: 'shape5', time: t, position: 'aboveBar', shape: 'triangleDown', color: cfg.red, size: 'tiny' });
      const f = s.flags;
      f[0][i] = longSignal;
      f[1][i] = shortSignal;
      f[2][i] = rejectionLong;
      f[3][i] = rejectionShort;
      f[4][i] = longBounce;
      f[5][i] = shortBounce;
      for (let k = 0; k < 6; k++) if (f[k][i]) s.times[k].push(t as number);
    },
    result(s, bars) {
      const n = bars.length;
      const gradient = (top: number[], bottom: number[], bottomColor: string) => ({
        topValue: top.slice(),
        bottomValue: bottom.slice(),
        topColor: new Array<string | null>(n).fill(s.bgFill),
        bottomColor: new Array<string | null>(n).fill(bottomColor),
      });
      const fills: FillData[] = [
        { id: 'fill0', plot1: 'plot1', plot2: 'plot2', options: { title: 'Downtrend Band Fill' }, gradient: gradient(s.up1, s.up4, c(cfg.red, 70)) },
        { id: 'fill1', plot1: 'plot3', plot2: 'plot4', options: { title: 'Uptrend Band Fill' }, gradient: gradient(s.lo1, s.lo4, c(cfg.green, 70)) },
      ];
      const [plot0, plot1, plot2, plot3, plot4, plot5, plot6, plot7, plot8] = s.plots.map((p) => p.slice());
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0, plot1, plot2, plot3, plot4, plot5, plot6, plot7, plot8 },
        fills,
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FibonacciEntryBandsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<FibonacciEntryBandsInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[]; alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const FibonacciEntryBands = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  fillConfig,
  shapeConfig,
  barColorConfig,
  alertConditions,
};
