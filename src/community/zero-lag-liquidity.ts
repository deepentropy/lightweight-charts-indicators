/**
 * Zero Lag Liquidity [AlgoAlpha]
 *
 * Liquidity levels from large wicks. A bar is highlighted when the RSI(14) of the volume is above 60, its average
 * wick ((lower + upper) / 2) is above "Wick Multiplier" times the 21-bar average of it, and its two wicks differ. On
 * a highlighted bar the larger wick (the lower one: bearish, the upper one: bullish) is cut into "Profile Bin Count"
 * equal bins; the volume of the lower timeframe bars ("Lower Timeframe") inside the chart bar is added to the bin
 * that holds their close, and the middle of the bin with the most volume (the first one on a tie) is the level. The
 * level is drawn as a line from that bar, with a second line at the body end of the wick and a fill between them,
 * and a label that shows the bar volume as a share of the volume of all active levels ("Labels Show % Strength";
 * else the volume itself). Active lines get a transparency from 0 to 60 that follows that share.
 *
 * Each bar, every active level is extended to the bar; a bullish level is broken when two closes in a row are above
 * it (a bearish level: below it): it stops there, the trend takes its direction and a "Bullish Break" / "Bearish
 * Break" label shape is drawn at the 7-bar lowest low / highest high. A rejection is a bar after a bar whose range
 * crossed a level: hl2 above a bearish level ("Bullish Rejection", ▲ below the bar) or below a bullish level
 * ("Bearish Rejection", ▼ above the bar). Candles: the highlight colour on highlighted bars, else (with "Show
 * Liquidity Trend") the trend colour 65 % of the way to the chart background. Only the last 500 levels are tracked.
 *
 * Lower timeframe bars: the chart symbol on "Lower Timeframe" (`request.security_lower_tf` of the close and the
 * volume) from the chart context (`requiredSymbols`, `bars` accessor); without them the port throws a
 * MissingSymbolDataError that lists them. The original's platform gives at most the last 100,000 lower timeframe
 * bars; the port uses the bars it receives. A lower timeframe equal to the chart timeframe uses the chart bars.
 * `chart.fg_color` / `chart.bg_color` come from the context (fallbacks #DBDBDB / #0F0F0F). The original also
 * computes ta.ema(ta.hma(close, 7), 21) and never uses it: not ported.
 *
 * Reference: "Zero Lag Liquidity [AlgoAlpha]" by AlgoAlpha
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, array, str, color, line, label, linefill, timeframe, Series, resetDrawings, setDrawingBar, drawingOutputs,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type Line, type Label, type ShapeConfig,
} from 'oakscriptjs';
import type { LabelData, LineDrawingData, LinefillData, MarkerData, PlotCandleData } from '../types';
import {
  backgroundColorOf, foregroundColorOf, symbolBarsOf, tickeridOf, type ChartContext, type SymbolRequest,
} from '../chart-context';
import { chartTimeframe } from '../anchor-period';
import { securityLowerTf, otherSymbolChart } from '../other-symbol';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { StudyDrawingKind } from '../style-outputs';

export interface ZeroLagLiquidityInputs {
  /** Lower Timeframe */
  ltf: string;
  /** Profile Bin Count */
  binCount: number;
  /** Wick Multiplier */
  wickMult: number;
  /** Show Liquidity Trend */
  trnd: boolean;
  /** Show Liquidity Breaks */
  brk: boolean;
  /** Show Liquidity Rejections */
  rej: boolean;
  /** Labels Show % Strength */
  lblPercent: boolean;
  /** Label Text Size */
  lblSizeOpt: 'Tiny' | 'Small' | 'Medium' | 'Large';
  bullCol: string;
  bearCol: string;
}

export const defaultInputs: ZeroLagLiquidityInputs = {
  ltf: '3',
  binCount: 7,
  wickMult: 2.0,
  trnd: true,
  brk: true,
  rej: true,
  lblPercent: true,
  lblSizeOpt: 'Small',
  bullCol: '#00ffbb',
  bearCol: '#ff1100',
};

const WP = 'Wick Profile';
const AP = 'Appearance';
export const inputConfig: InputConfig[] = [
  { id: 'ltf', type: 'timeframe', title: 'Lower Timeframe', defval: '3', group: WP,
    tooltip: 'The lower timeframe used to build the wick profile. This determines the resolution of the volume and price data used for liquidity calculations.' },
  { id: 'binCount', type: 'int', title: 'Profile Bin Count', defval: 7, min: 1, group: WP,
    tooltip: 'Number of bins to divide the price range into for the wick profile. Higher values provide more granularity.' },
  { id: 'wickMult', type: 'float', title: 'Wick Multiplier', defval: 2.0, min: 0.1, step: 0.1, group: WP,
    tooltip: 'Multiplier for the average wick size to determine significant wick events. Higher values require larger wicks to trigger highlights.' },
  { id: 'trnd', type: 'bool', title: 'Show Liquidity Trend', defval: true, group: AP,
    tooltip: 'Enable to display the trend based on whether liquidity levels are being broken.' },
  { id: 'brk', type: 'bool', title: 'Show Liquidity Breaks', defval: true, group: AP,
    tooltip: 'Enable to highlight when the price breaks through a liquidity level.' },
  { id: 'rej', type: 'bool', title: 'Show Liquidity Rejections', defval: true, group: AP,
    tooltip: 'Enable to highlight when the price rejects off a liquidity level.' },
  { id: 'lblPercent', type: 'bool', title: 'Labels Show % Strength', defval: true, group: AP,
    tooltip: 'If true, labels display the level\'s volume as a percentage of the cumulative volume of all active levels. If false, labels display the absolute volume recorded at creation.' },
  { id: 'lblSizeOpt', type: 'string', title: 'Label Text Size', defval: 'Small', options: ['Tiny', 'Small', 'Medium', 'Large'], group: AP },
  { id: 'bullCol', type: 'color', title: 'Bullish Colour', defval: '#00ffbb', group: AP,
    tooltip: 'Color used for bullish (buy-side) liquidity levels.' },
  { id: 'bearCol', type: 'color', title: 'Bearish Colour', defval: '#ff1100', group: AP,
    tooltip: 'Color used for bearish (sell-side) liquidity levels.' },
];

// No plot(): the outputs are the characters, the shapes, the candles and the drawings
export const plotConfig: PlotConfig[] = [];

/** plotchar() / plotshape() declarations: the markers of the result with the same `id` belong to them */
export const shapeConfig: ShapeConfig[] = [
  { id: 'char0', kind: 'char', title: 'Bullish Rejection', char: '▲', location: 'belowbar', color: String(color.new('#00ffbb', 50)), size: 'tiny' },
  { id: 'char1', kind: 'char', title: 'Bearish Rejection', char: '▼', location: 'abovebar', color: String(color.new('#ff1100', 50)), size: 'tiny' },
  { id: 'shape0', kind: 'shape', title: 'Bullish Break', style: 'labelup', location: 'absolute', color: String(color.new('#00ffbb', 30)), text: '▲', size: 'tiny' },
  { id: 'shape1', kind: 'shape', title: 'Bearish Break', style: 'labeldown', location: 'absolute', color: String(color.new('#ff1100', 30)), text: '▼', size: 'tiny' },
];

export const plotCandleConfig = [{ id: 'candles', title: 'Custom Candle' }];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'linefill'];

export const metadata = {
  title: 'Zero Lag Liquidity [AlgoAlpha]',
  shortTitle: 'AlgoAlpha – Zero Lag Liq',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

/** The lower timeframe differs from the chart timeframe: its bars come from the context */
function lowerTimeframeRequested(ltf: string, chartTf: string): boolean {
  return ltf !== '' && timeframe.in_seconds(ltf) !== timeframe.in_seconds(chartTf);
}

/** Bars the indicator needs: the chart symbol on "Lower Timeframe" (none when it is the chart timeframe). */
export function requiredSymbols(inputs: Partial<ZeroLagLiquidityInputs> = {}, chart?: ChartContext): SymbolRequest[] {
  const cfg = { ...defaultInputs, ...inputs };
  const tf = chartTimeframe([], chart);
  if (tf === '' || !lowerTimeframeRequested(cfg.ltf, tf)) return [];
  return [{ symbol: tickeridOf(chart), timeframe: cfg.ltf }];
}

/** f_wick_poc: middle of the bin of [bot, top] with the most lower timeframe volume (na without data or range) */
function wickPoc(top: number, bot: number, prices: number[], vols: number[], bins: number): number {
  if (prices.length === 0 || vols.length === 0 || eq(top, bot)) return NaN;
  const seg = (top - bot) / bins;
  const bounds: number[] = [];
  for (let i = 0; i <= bins; i++) bounds.push(bot + i * seg);
  const volsBin: number[] = [];
  for (let i = 0; i <= bins - 1; i++) {
    let totalVol = 0;
    for (let j = 0; j <= prices.length - 1; j++) {
      const pr = prices[j];
      if (ge(pr, bounds[i]) && le(pr, bounds[i + 1])) totalVol += vols[j];
    }
    volsBin.push(totalVol);
  }
  const maxVol = array.max(volsBin);
  const pocIdx = array.indexof(volsBin, maxVol);
  // array.get with a negative index counts from the end (pocIdx -1 when every bin is na)
  const at = (k: number) => bounds[k < 0 ? bounds.length + k : k];
  return (at(pocIdx) + at(pocIdx + 1)) / 2;
}

interface Level {
  line: Line;
  price: number;
  type: number;
  label: Label;
  vol: number;
  body: Line;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<ZeroLagLiquidityInputs> = {},
  chart?: ChartContext,
): IndicatorResult & {
  markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]>; lines: LineDrawingData[]; labels: LabelData[];
  linefills: LinefillData[]; alerts: AlertConditionState[];
} {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const bins = Math.trunc(cfg.binCount);
  const fg = foregroundColorOf(chart);
  const bg = backgroundColorOf(chart);
  const sizeOf = { Tiny: 'tiny', Small: 'small', Medium: 'normal', Large: 'large' } as const;
  const lblSize = sizeOf[cfg.lblSizeOpt] ?? 'large';

  // ---- lower timeframe bars (request.security_lower_tf of the chart symbol)
  const chartTf = chartTimeframe(bars, chart) || '1D';
  if (cfg.ltf !== '' && timeframe.in_seconds(cfg.ltf) > timeframe.in_seconds(chartTf)) {
    throw new Error(`The lower timeframe "${cfg.ltf}" is above the chart timeframe "${chartTf}"`);
  }
  let intrabars: (i: number) => Bar[];
  if (n > 0 && lowerTimeframeRequested(cfg.ltf, chartTf)) {
    const [ltfBars] = symbolBarsOf([{ symbol: tickeridOf(chart), timeframe: cfg.ltf }], chart);
    const merge = otherSymbolChart(bars, chart);
    const ranges = securityLowerTf(bars, ltfBars, cfg.ltf, merge, { other: { timezone: chart?.timezone, session: chart?.session } });
    intrabars = (i) => ltfBars.slice(ranges[i][0], ranges[i][1]);
  } else {
    intrabars = (i) => [bars[i]];
  }

  // ---- core series
  const A = (s: Series) => s.toArray().map((v) => (v === null || v === undefined ? NaN : v));
  const vol = A(ta.rsi(new Series(bars, (b) => b.volume ?? NaN), 14));
  const lowerWick = bars.map((b) => Math.min(b.close, b.open) - b.low);
  const upperWick = bars.map((b) => b.high - Math.max(b.close, b.open));
  const avgWick = lowerWick.map((v, i) => (v + upperWick[i]) / 2);
  const aW = A(ta.sma(Series.fromArray(bars, avgWick), 21));
  const lw = A(ta.lowest(new Series(bars, (b) => b.low), 7));
  const hg = A(ta.highest(new Series(bars, (b) => b.high), 7));

  const levels: Level[] = [];
  let trend = 0;
  const markers: MarkerData[] = [];
  const candles: PlotCandleData[] = [];
  const flags: boolean[][] = [[], [], [], [], [], []];
  const bullGrad = color.from_gradient(0.65, 0, 1, cfg.bullCol, bg);
  const bearGrad = color.from_gradient(0.65, 0, 1, cfg.bearCol, bg);
  const rejBull = String(color.new(cfg.bullCol, 50));
  const rejBear = String(color.new(cfg.bearCol, 50));
  const brkBull = String(color.new(cfg.bullCol, 30));
  const brkBear = String(color.new(cfg.bearCol, 30));

  resetDrawings({ line: 500, label: 500 });
  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const highlight = gt(vol[i], 60) && gt(avgWick[i], aW[i] * cfg.wickMult) && !eq(upperWick[i], lowerWick[i]);
    const isRedBar = highlight && gt(lowerWick[i], upperWick[i]);
    const isGreenBar = highlight && gt(upperWick[i], lowerWick[i]);
    let wickTop = NaN;
    let wickBot = NaN;
    if (isRedBar) {
      wickTop = Math.min(b.close, b.open);
      wickBot = b.low;
    } else if (isGreenBar) {
      wickTop = b.high;
      wickBot = Math.max(b.close, b.open);
    }

    // ---- new level
    if (highlight) {
      const ib = intrabars(i);
      const poc = wickPoc(wickTop, wickBot, ib.map((x) => x.close), ib.map((x) => x.volume ?? NaN), bins);
      if (!isNaN(poc)) {
        const col = isGreenBar ? cfg.bullCol : cfg.bearCol;
        const newLine = line.new(i, poc, i, poc, 'bar_index', 'none', col, 'solid', 1);
        const newLabel = label.new(i, poc, '', 'bar_index', 'price', fg, 'none', fg, lblSize);
        const bodyPrice = isGreenBar ? wickBot : wickTop;
        const bodyLine = line.new(i, bodyPrice, i, bodyPrice, 'bar_index', 'none', String(color.new(col, 80)), 'solid', 1);
        linefill.new(newLine, bodyLine, String(color.new(col, 80)));
        levels.unshift({ line: newLine, price: poc, type: isGreenBar ? 1 : -1, label: newLabel, vol: b.volume ?? NaN, body: bodyLine });
      }
    }
    // maxStored = 500: the oldest level is no longer tracked (its objects stay)
    if (levels.length > 500) levels.pop();

    // ---- level management
    let bullrej = false;
    let bearrej = false;
    let brkk = 0;
    let sumVols = 0;
    for (const lv of levels) sumVols += lv.vol;
    const close1 = i > 0 ? bars[i - 1].close : NaN;
    const high1 = i > 0 ? bars[i - 1].high : NaN;
    const low1 = i > 0 ? bars[i - 1].low : NaN;
    const hl2 = (b.high + b.low) / 2;
    for (let k = levels.length - 1; k >= 0; k--) {
      if (k >= levels.length) continue;
      const lv = levels[k];
      label.set_xy(lv.label, i, lv.price);
      label.set_text(lv.label, cfg.lblPercent ? str.tostring(lv.vol / sumVols * 100, 'percent') : str.tostring(lv.vol, 'volume'));
      if (gt(sumVols, 0)) {
        const dominance = lv.vol / sumVols;
        let trans = Math.round((1 - dominance) * 60);
        trans = trans < 0 ? 0 : trans > 60 ? 60 : trans;
        line.set_color(lv.line, String(color.new(lv.type === 1 ? cfg.bullCol : cfg.bearCol, trans)));
      }
      const done = lv.type === 1 ? gt(b.close, lv.price) && gt(close1, lv.price) : lt(b.close, lv.price) && lt(close1, lv.price);
      if (done) {
        brkk = lv.type;
        trend = lv.type;
        levels.splice(k, 1);
      } else {
        const y1 = line.get_y1(lv.line);
        if (gt(high1, y1) && lt(low1, y1) && gt(line.get_x2(lv.line) - line.get_x1(lv.line), 0)) {
          const y2 = line.get_y2(lv.line);
          if (gt(hl2, y2) && lv.type === -1) bullrej = true;
          else if (lt(hl2, y2) && lv.type === 1) bearrej = true;
        }
        line.set_x2(lv.line, i);
        line.set_x2(lv.body, i);
      }
    }

    // ---- outputs
    if (bullrej && cfg.rej) {
      markers.push({ id: 'char0', time: b.time, position: 'belowBar', shape: 'circle', color: 'transparent', text: '▲', textColor: rejBull, size: 'tiny' });
    }
    if (bearrej && cfg.rej) {
      markers.push({ id: 'char1', time: b.time, position: 'aboveBar', shape: 'circle', color: 'transparent', text: '▼', textColor: rejBear, size: 'tiny' });
    }
    if (brkk > 0 && cfg.brk && !isNaN(lw[i])) {
      markers.push({ id: 'shape0', time: b.time, position: 'atPriceBottom', price: lw[i], shape: 'labelUp', color: brkBull, text: '▲', textColor: fg, size: 'tiny' });
    }
    if (brkk < 0 && cfg.brk && !isNaN(hg[i])) {
      markers.push({ id: 'shape1', time: b.time, position: 'atPriceTop', price: hg[i], shape: 'labelDown', color: brkBear, text: '▼', textColor: fg, size: 'tiny' });
    }
    const candleCol = highlight ? (isRedBar ? cfg.bearCol : cfg.bullCol)
      : cfg.trnd ? (trend > 0 ? bullGrad : trend < 0 ? bearGrad : 'transparent') : 'transparent';
    candles.push({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, color: candleCol, wickColor: candleCol, borderColor: candleCol });

    flags[0].push(bullrej && cfg.rej);
    flags[1].push(bearrej && cfg.rej);
    flags[2].push(brkk > 0 && cfg.brk);
    flags[3].push(brkk < 0 && cfg.brk);
    flags[4].push(trend > 0 && cfg.trnd);
    flags[5].push(trend < 0 && cfg.trnd);
  }
  setDrawingBar(null);
  const drawn = drawingOutputs(bars);
  resetDrawings();

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    plotCandles: { candles },
    lines: drawn.lines ?? [],
    labels: drawn.labels ?? [],
    linefills: drawn.linefills ?? [],
    alerts: alertStates(alertConditions, bars, flags),
  };
}

/** The original's alertconditions (no message) */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Rejection' },
  { id: 'alert1', title: 'Bearish Rejection' },
  { id: 'alert2', title: 'Bullish Break' },
  { id: 'alert3', title: 'Bearish Break' },
  { id: 'alert4', title: 'Bullish Trend' },
  { id: 'alert5', title: 'Bearish Trend' },
];

export const ZeroLagLiquidity = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, shapeConfig, plotCandleConfig, drawingKinds,
  alertConditions, requiredSymbols,
};
