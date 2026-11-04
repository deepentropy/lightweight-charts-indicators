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
  ta, color, Series, getSourceSeries,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type FillConfig, type FillData,
  type ShapeConfig, type BarColorConfig, type SourceType,
} from 'oakscriptjs';
import type { BarColorData, MarkerData } from '../types';
import { backgroundColorOf, type ChartContext } from '../chart-context';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';

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

export function calculate(
  bars: Bar[],
  inputs: Partial<FibonacciEntryBandsInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[]; alerts: AlertConditionState[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => (v === null || v === undefined ? NaN : (v as number)));
  const B = (s: Series) => s.toArray().map((v) => Number(v) === 1);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const bgColor = backgroundColorOf(chart);

  const srcS = getSourceSeries(bars, cfg.src);
  const src = A(srcS);
  const basis = A(ta.ema(ta.ema(srcS, cfg.len), cfg.len));
  const vol = cfg.useATR ? A(ta.atr(bars, cfg.atrLen)) : A(ta.stdev(S(src), cfg.len));

  const mult1 = 0.618;
  const mult2 = 1.0;
  const mult3 = 1.618;
  const mult4 = 2.618;

  const trend: number[] = new Array(n);
  let prevTrend = 0;
  for (let i = 0; i < n; i++) {
    const prev = i > 0 ? basis[i - 1] : NaN;
    // basis > basis[1] ? 1 : basis < basis[1] ? -1 : nz(trend[1])
    prevTrend = gt(basis[i], prev) ? 1 : lt(basis[i], prev) ? -1 : prevTrend;
    trend[i] = prevTrend;
  }

  const band = (m: number, sign: number) => basis.map((b, i) => b + sign * vol[i] * m);
  const upper1 = band(mult1, 1);
  const upper2 = band(mult2, 1);
  const upper3 = band(mult3, 1);
  const upper4 = band(mult4, 1);
  const lower1 = band(mult1, -1);
  const lower2 = band(mult2, -1);
  const lower3 = band(mult3, -1);
  const lower4 = band(mult4, -1);

  const when = (dir: number, v: number[]) => v.map((x, i) => (trend[i] === dir ? x : NaN));
  const line = (v: number[], col: string): Point[] =>
    bars.map((b, i) => ({ time: b.time, value: Number.isFinite(v[i]) ? v[i] : NaN, color: col }));

  const up1 = when(-1, upper1);
  const up4 = when(-1, upper4);
  const lo1 = when(1, lower1);
  const lo4 = when(1, lower4);

  // Signals: ta.crossover(basis, basis[1]) / ta.crossunder(basis, basis[1])
  const basisS = S(basis);
  const basisPrev = S(basis.map((_, i) => (i > 0 ? basis[i - 1] : NaN)));
  const longSignal = B(ta.crossover(basisS, basisPrev));
  const shortSignal = B(ta.crossunder(basisS, basisPrev));

  // switch tpAggressiveness (var floats assigned on every bar)
  const tpLongBand = cfg.tpAggressiveness === 'medium' ? lower2 : cfg.tpAggressiveness === 'high' ? lower1 : lower4;
  const tpShortBand = cfg.tpAggressiveness === 'medium' ? upper2 : cfg.tpAggressiveness === 'high' ? upper1 : upper4;
  const closeS = new Series(bars, (b) => b.close);
  const con1 = B(ta.crossunder(closeS, S(tpLongBand)));
  const con2 = B(ta.crossover(closeS, S(tpShortBand)));

  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];
  const flags: boolean[][] = [[], [], [], [], [], []];
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const t = b.time;
    // normDist = |close - basis| / (vol * mult4) when the trend is set, capped at 1
    let normDist = trend[i] !== 0 ? Math.abs(b.close - basis[i]) / (vol[i] * mult4) : 0;
    normDist = Math.min(normDist, 1);
    const alpha = Math.min(Math.round(normDist * 100), 70);
    const avgOc = (b.open + b.close) / 2;
    let barCol: string | null = null;
    if (trend[i] === 1) barCol = lt(avgOc, basis[i]) ? cfg.gray : c(cfg.green, alpha);
    else if (trend[i] === -1) barCol = gt(avgOc, basis[i]) ? cfg.gray : c(cfg.red, alpha);
    if (cfg.colorbar && barCol !== null) barColors.push({ id: 'barcolor0', time: t, color: barCol });

    // plotshape(longSignal ? lower4 : na, location.absolute, shape.labelup ...)
    if (longSignal[i] && Number.isFinite(lower4[i])) {
      markers.push({ id: 'shape0', time: t, position: 'atPriceBottom', price: lower4[i], shape: 'labelUp', color: cfg.green, text: '▲', textColor: '#FFFFFF' });
    }
    if (shortSignal[i] && Number.isFinite(upper4[i])) {
      markers.push({ id: 'shape1', time: t, position: 'atPriceTop', price: upper4[i], shape: 'labelDown', color: cfg.red, text: '▼', textColor: '#FFFFFF' });
    }
    const rejectionLong = cfg.showRej && con1[i] && trend[i] === -1;
    const rejectionShort = cfg.showRej && con2[i] && trend[i] === 1;
    if (rejectionLong) markers.push({ id: 'shape2', time: t, position: 'belowBar', shape: 'xcross', color: cfg.red, size: 'tiny' });
    if (rejectionShort) markers.push({ id: 'shape3', time: t, position: 'aboveBar', shape: 'xcross', color: cfg.green, size: 'tiny' });
    const longBounce = cfg.showBounce && trend[i] === 1 && lt(b.low, basis[i]) && gt(b.close, basis[i]) && !longSignal[i];
    const shortBounce = cfg.showBounce && trend[i] === -1 && gt(b.high, basis[i]) && lt(b.close, basis[i]) && !shortSignal[i];
    if (longBounce) markers.push({ id: 'shape4', time: t, position: 'belowBar', shape: 'triangleUp', color: cfg.green, size: 'tiny' });
    if (shortBounce) markers.push({ id: 'shape5', time: t, position: 'aboveBar', shape: 'triangleDown', color: cfg.red, size: 'tiny' });
    flags[0].push(longSignal[i]);
    flags[1].push(shortSignal[i]);
    flags[2].push(rejectionLong);
    flags[3].push(rejectionShort);
    flags[4].push(longBounce);
    flags[5].push(shortBounce);
  }

  const bgFill = c(bgColor, 90);
  const gradient = (top: number[], bottom: number[], bottomColor: string) => ({
    topValue: top,
    bottomValue: bottom,
    topColor: new Array<string | null>(n).fill(bgFill),
    bottomColor: new Array<string | null>(n).fill(bottomColor),
  });
  const fills: FillData[] = [
    { id: 'fill0', plot1: 'plot1', plot2: 'plot2', options: { title: 'Downtrend Band Fill' }, gradient: gradient(up1, up4, c(cfg.red, 70)) },
    { id: 'fill1', plot1: 'plot3', plot2: 'plot4', options: { title: 'Uptrend Band Fill' }, gradient: gradient(lo1, lo4, c(cfg.green, 70)) },
  ];

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: line(basis, cfg.gray),
      plot1: line(up1, c(cfg.red, 60)),
      plot2: line(up4, c(cfg.red, 30)),
      plot3: line(lo1, c(cfg.green, 60)),
      plot4: line(lo4, c(cfg.green, 30)),
      plot5: line(when(-1, upper2), c(cfg.red, 50)),
      plot6: line(when(-1, upper3), c(cfg.red, 40)),
      plot7: line(when(1, lower2), c(cfg.green, 50)),
      plot8: line(when(1, lower3), c(cfg.green, 40)),
    },
    fills,
    markers,
    barColors,
    alerts: alertStates(alertConditions, bars, flags),
  };
}

export const FibonacciEntryBands = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  fillConfig,
  shapeConfig,
  barColorConfig,
  alertConditions,
};
