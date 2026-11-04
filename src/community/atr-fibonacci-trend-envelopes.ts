/**
 * ATR Fibonacci Trend Envelopes [BigBeluga]
 *
 * A baseline moving average of the close ("MA Type", "MA Length") with envelopes at +- ATR("ATR Length") * "ATR
 * Multiplier". The trend turns up when the close crosses over the upper envelope and down when it crosses under the
 * lower one. In an uptrend the trend line is the lower envelope, in a downtrend the upper one; Fibonacci levels 0.5,
 * 0.618 and 0.786 are measured from it towards the other envelope. The golden pocket (0.618 - 0.786) is filled with
 * the pocket colour, more transparent as the close moves away from the middle of the pocket. On each trend change
 * the plots break and two labels mark the new trend line (a dot and the close). On the last bar, dotted projections
 * of the four levels ("Projection Length" bars, slope of the last 4 bars) with their labels and a fill between the
 * 0.618 and 0.786 projections, and a dashboard with the trend and the pocket state on four timeframes.
 *
 * Dashboard timeframes (`request.security` of the chart symbol): a higher timeframe is built from the chart bars;
 * a lower one needs the bars of the chart symbol on that timeframe from the chart context (`requiredSymbols`, `bars`
 * accessor); without them the port throws a MissingSymbolDataError that lists them. A live last bar (chart context
 * `lastBarConfirmed` false) shows the open bar of a higher timeframe, as a realtime bar. The label texts use the
 * symbol tick of the context (`format.mintick`; 0.01 without it).
 *
 * Reference: "ATR Fibonacci Trend Envelopes [BigBeluga]" by BigBeluga
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: This work is licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0
 * International (https://creativecommons.org/licenses/by-nc-sa/4.0/) © BigBeluga
 */

import {
  ta, str, color, callsite, timeframe, getSourceSeries, line, label, linefill, table, resetDrawings, setDrawingBar,
  varDrawing, drawingOutputs, type Bar, type FillConfig, type IndicatorResult, type InputConfig, type Line, type Label,
  type Linefill, type PlotConfig, type Series, type Table,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import { chartTimeframe, higherTimeframeBars } from '../anchor-period';
import { lastBarConfirmedOf, mintickOf, symbolBarsOf, tickeridOf, type ChartContext, type SymbolRequest } from '../chart-context';
import { otherSymbolChart, securityOther } from '../other-symbol';

type MaType = 'SMA' | 'EMA' | 'WMA' | 'HMA' | 'RMA';
type DashLocation = 'top_right' | 'bottom_right' | 'top_left' | 'bottom_left' | 'middle_right';
type DashSize = 'tiny' | 'small' | 'normal' | 'large';

export interface AtrFibonacciTrendEnvelopesInputs {
  maType: MaType;
  maLength: number;
  atrLength: number;
  atrMult: number;
  showProj: boolean;
  projLen: number;
  colorUp: string;
  colorDown: string;
  colorMid: string;
  baseFill: string;
  showDash: boolean;
  dashLoc: DashLocation;
  dashSize: DashSize;
  tf1: string;
  tf2: string;
  tf3: string;
  tf4: string;
}

export const defaultInputs: AtrFibonacciTrendEnvelopesInputs = {
  maType: 'RMA',
  maLength: 100,
  atrLength: 100,
  atrMult: 3.0,
  showProj: true,
  projLen: 50,
  colorUp: '#24C0D4', // color.rgb(36, 192, 212)
  colorDown: '#EB3333', // color.rgb(235, 51, 51)
  colorMid: '#787B86', // color.gray
  baseFill: '#FF7B00', // color.rgb(255, 123, 0)
  showDash: true,
  dashLoc: 'bottom_right',
  dashSize: 'small',
  tf1: '5',
  tf2: '15',
  tf3: '60',
  tf4: '240',
};

const GRP_CALC = 'Calculation Settings';
const GRP_PROJ = 'Projection Settings';
const GRP_COLOR = 'Color & Visual Settings';
const GRP_DASH = 'Dashboard Settings';

export const inputConfig: InputConfig[] = [
  {
    id: 'maType', type: 'string', title: 'MA Type', defval: 'RMA', options: ['SMA', 'EMA', 'WMA', 'HMA', 'RMA'], group: GRP_CALC,
    tooltip: 'Select the Moving Average type used to calculate the baseline (Basis).',
  },
  { id: 'maLength', type: 'int', title: 'MA Length', defval: 100, group: GRP_CALC, tooltip: 'The number of bars used to calculate the trend baseline.' },
  {
    id: 'atrLength', type: 'int', title: 'ATR Length', defval: 100, group: GRP_CALC,
    tooltip: 'The lookback period for Average True Range, used to determine envelope width.',
  },
  { id: 'atrMult', type: 'float', title: 'ATR Multiplier', defval: 3.0, group: GRP_CALC, tooltip: 'Multiplies the ATR to expand or contract the Trend Envelopes.' },
  {
    id: 'showProj', type: 'bool', title: 'Show Projections', defval: true, group: GRP_PROJ,
    tooltip: 'Toggle the visibility of dotted line projections for the trend and Fibonacci levels.',
  },
  {
    id: 'projLen', type: 'int', title: 'Projection Length (Bars)', defval: 50, min: 1, group: GRP_PROJ,
    tooltip: 'Determines how many bars into the future the levels are projected.',
  },
  { id: 'colorUp', type: 'color', title: 'Uptrend Color', defval: '#24C0D4', group: GRP_COLOR, tooltip: 'Color used for the baseline and labels during a bullish trend.' },
  { id: 'colorDown', type: 'color', title: 'Downtrend Color', defval: '#EB3333', group: GRP_COLOR, tooltip: 'Color used for the baseline and labels during a bearish trend.' },
  { id: 'colorMid', type: 'color', title: '0.5 Fib Color', defval: '#787B86', group: GRP_COLOR, tooltip: 'Color for the 50% Fibonacci retracement level.' },
  { id: 'baseFill', type: 'color', title: 'Pocket Base Color', defval: '#FF7B00', group: GRP_COLOR, tooltip: 'Base color for the Dynamic Golden Pocket (0.618 - 0.786).' },
  { id: 'showDash', type: 'bool', title: 'Show MTF Dashboard', defval: true, group: GRP_DASH, tooltip: 'Toggle the visibility of the Multi-Timeframe status table.' },
  {
    id: 'dashLoc', type: 'string', title: 'Location', defval: 'bottom_right',
    options: ['top_right', 'bottom_right', 'top_left', 'bottom_left', 'middle_right'], group: GRP_DASH,
    tooltip: 'The corner of the chart where the dashboard is displayed.',
  },
  {
    id: 'dashSize', type: 'string', title: 'Size', defval: 'small', options: ['tiny', 'small', 'normal', 'large'], group: GRP_DASH,
    tooltip: 'The scaling size of the dashboard table and its text.',
  },
  { id: 'tf1', type: 'timeframe', title: 'Timeframe 1', defval: '5', group: GRP_DASH, tooltip: 'The first timeframe to track in the dashboard.' },
  { id: 'tf2', type: 'timeframe', title: 'Timeframe 2', defval: '15', group: GRP_DASH, tooltip: 'The second timeframe to track in the dashboard.' },
  { id: 'tf3', type: 'timeframe', title: 'Timeframe 3', defval: '60', group: GRP_DASH, tooltip: 'The third timeframe to track in the dashboard.' },
  { id: 'tf4', type: 'timeframe', title: 'Timeframe 4', defval: '240', group: GRP_DASH, tooltip: 'The fourth timeframe to track in the dashboard.' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trend MA', color: '#2962FF', lineWidth: 3, style: 'linebr' },
  { id: 'plot1', title: 'Fib 0.618', color: '#2962FF', lineWidth: 1, style: 'linebr' },
  { id: 'plot2', title: 'Fib 0.786', color: '#2962FF', lineWidth: 1, style: 'linebr' },
  { id: 'plot3', title: 'Fib 0.5', color: '#2962FF', lineWidth: 1, style: 'linebr' },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot1', plot2: 'plot2', title: 'Dynamic Golden Pocket' },
];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'linefill', 'table'];

export const metadata = {
  title: 'ATR Fibonacci Trend Envelopes [BigBeluga]',
  shortTitle: 'ATR Fibonacci Trend Envelopes [BigBeluga]',
  overlay: true,
};

const MAX_OBJECTS = 500;
const FIB_MID = 0.5;
const FIB_GOLD1 = 0.618;
const FIB_GOLD2 = 0.786;
const SENS = 0.6;

/** Pine float comparisons (1e-10; na compares false) */
const EPS = 1e-10;
const le = (a: number, b: number) => b - a > -EPS;
const ge = (a: number, b: number) => a - b > -EPS;
const eqInt = (a: number, b: number) => a === b;

const A = (s: Series): number[] => s.toArray().map((v) => (v === null || v === undefined ? NaN : v));

function maOf(src: Series, length: number, type: MaType): number[] {
  switch (type) {
    case 'EMA': return A(ta.ema(src, length));
    case 'WMA': return A(ta.wma(src, length));
    case 'HMA': return A(ta.hma(src, length));
    case 'RMA': return A(ta.rma(src, length));
    default: return A(ta.sma(src, length));
  }
}

interface TrendState {
  trend: number[];
  inPocket: boolean[];
  basis: number[];
  atr: number[];
}

/** calc_trend_and_pocket() on a series of bars */
function trendStateOf(src: Bar[], cfg: AtrFibonacciTrendEnvelopesInputs): TrendState {
  const close = getSourceSeries(src, 'close');
  const basis = maOf(close, cfg.maLength, cfg.maType);
  const atr = A(ta.atr(src, cfg.atrLength));
  const over = callsite.crossover();
  const under = callsite.crossunder();
  const trend: number[] = [];
  const inPocket: boolean[] = [];
  let t = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i].close;
    const u = basis[i] + atr[i] * cfg.atrMult;
    const l = basis[i] - atr[i] * cfg.atrMult;
    // if ta.crossover(close, u) ... else if ta.crossunder(close, l): the second call only runs when the first is false
    if (over(c, u)) t = 1;
    else if (under(c, l)) t = -1;
    const f618 = t === 1 ? l + (u - l) * (1 - FIB_GOLD1) : u - (u - l) * (1 - FIB_GOLD1);
    const f786 = t === 1 ? l + (u - l) * (1 - FIB_GOLD2) : u - (u - l) * (1 - FIB_GOLD2);
    trend.push(t);
    inPocket.push(le(c, Math.max(f618, f786)) && ge(c, Math.min(f618, f786)));
  }
  return { trend, inPocket, basis, atr };
}

/** Chart and requested timeframes in seconds ('' = the chart timeframe) */
function secondsOf(tf: string, chartSec: number): number {
  return tf.trim() === '' ? chartSec : timeframe.in_seconds(tf);
}

/** Bars the indicator needs: the chart symbol on each dashboard timeframe below the chart timeframe. */
export function requiredSymbols(inputs: Partial<AtrFibonacciTrendEnvelopesInputs> = {}, chart?: ChartContext): SymbolRequest[] {
  const cfg = { ...defaultInputs, ...inputs };
  const chartTf = chartTimeframe([], chart);
  if (!cfg.showDash || chartTf === '') return [];
  const chartSec = timeframe.in_seconds(chartTf);
  const symbol = tickeridOf(chart);
  const out: SymbolRequest[] = [];
  for (const tf of [cfg.tf1, cfg.tf2, cfg.tf3, cfg.tf4]) {
    if (secondsOf(tf, chartSec) < chartSec && !out.some((r) => r.timeframe === tf)) out.push({ symbol, timeframe: tf });
  }
  return out;
}

/** format_tf(): minutes as "m" / "H" / "D", other strings as they are */
function formatTf(tf: string): string {
  const m = tf.trim() === '' ? NaN : Number(tf);
  if (Number.isFinite(m)) {
    return m >= 1440 ? `${Math.round(m / 1440)}D` : m >= 60 ? `${Math.round(m / 60)}H` : `${tf}m`;
  }
  return tf;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<AtrFibonacciTrendEnvelopesInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const unit = n > 0 && bars[0].time >= 1e12 ? 'ms' : 's';
  resetDrawings({ line: MAX_OBJECTS, label: MAX_OBJECTS });

  const { trend, inPocket, basis, atr } = trendStateOf(bars, cfg);
  const mintick = mintickOf(chart);
  const live = !lastBarConfirmedOf(chart);

  const level100s: number[] = [];
  const fib50s: number[] = [];
  const fib618s: number[] = [];
  const fib786s: number[] = [];
  const plot0: { time: number; value: number; color: string }[] = [];
  const plot1: { time: number; value: number; color: string }[] = [];
  const plot2: { time: number; value: number; color: string }[] = [];
  const plot3: { time: number; value: number; color: string }[] = [];
  const fillColors: string[] = [];
  const NAN = (v: number) => (Number.isFinite(v) ? v : NaN);

  // var line / label / linefill of the projections
  const l100 = varDrawing<Line>();
  const l50 = varDrawing<Line>();
  const l618 = varDrawing<Line>();
  const l786 = varDrawing<Line>();
  const lb100 = varDrawing<Label>();
  const lb50 = varDrawing<Label>();
  const lb618 = varDrawing<Label>();
  const lb786 = varDrawing<Label>();
  const fGold = varDrawing<Linefill>();
  const dash = varDrawing<Table>();

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const t = trend[i];
    const upperBand = basis[i] + atr[i] * cfg.atrMult;
    const lowerBand = basis[i] - atr[i] * cfg.atrMult;
    const fib50 = t === 1 ? lowerBand + (upperBand - lowerBand) * (1 - FIB_MID) : upperBand - (upperBand - lowerBand) * (1 - FIB_MID);
    const fib618 = t === 1 ? lowerBand + (upperBand - lowerBand) * (1 - FIB_GOLD1) : upperBand - (upperBand - lowerBand) * (1 - FIB_GOLD1);
    const fib786 = t === 1 ? lowerBand + (upperBand - lowerBand) * (1 - FIB_GOLD2) : upperBand - (upperBand - lowerBand) * (1 - FIB_GOLD2);

    const pocketMid = (fib618 + fib786) / 2;
    const dist = Math.abs(b.close - pocketMid);
    const maxDist = (upperBand - lowerBand) * 0.5;
    const rawTransp = 65 + (dist / maxDist) * 30 * SENS;
    // math.max(0, math.min(90, rawTransp)): na stays na
    const dynamicTransp = Number.isNaN(rawTransp) ? NaN : Math.max(0, Math.min(90, rawTransp));
    const dynamicColor = String(color.new(cfg.baseFill, dynamicTransp));

    // trend != trend[1]: false on the first bar (na)
    const trendChange = i > 0 && !eqInt(t, trend[i - 1]);
    const level100 = t === 1 ? lowerBand : upperBand;
    const trendCol = t === 1 ? cfg.colorUp : cfg.colorDown;
    level100s.push(level100);
    fib50s.push(fib50);
    fib618s.push(fib618);
    fib786s.push(fib786);

    plot0.push({ time: b.time, value: !trendChange ? NAN(level100) : NaN, color: trendCol });
    plot1.push({ time: b.time, value: t !== 0 && !trendChange ? NAN(fib618) : NaN, color: dynamicColor });
    plot2.push({ time: b.time, value: t !== 0 && !trendChange ? NAN(fib786) : NaN, color: dynamicColor });
    plot3.push({ time: b.time, value: t !== 0 ? NAN(fib50) : NaN, color: cfg.colorMid });
    fillColors.push(dynamicColor);

    if (trendChange) {
      const style = t === 1 ? 'label_up' : 'label_down';
      const textColor = t === 1 ? cfg.colorUp : cfg.colorDown;
      label.new(i, level100, '⦿', 'bar_index', 'price', 'transparent', 'label_center', textColor, cfg.dashSize);
      label.new(i, level100, str.tostring(b.close, 'mintick', mintick), 'bar_index', 'price', 'transparent', style, textColor, cfg.dashSize);
    }

    if (i !== n - 1) continue;

    // Dashboard
    if (cfg.showDash) {
      if (!dash.value) {
        dash.value = table.new(cfg.dashLoc, 3, 5, color.new(color.black, 40), undefined, undefined, color.new(color.gray, 70), 1);
      }
      const tbl = dash.value;
      table.cell(tbl, 0, 0, 'TF', undefined, undefined, color.white, undefined, undefined, cfg.dashSize);
      table.cell(tbl, 1, 0, 'Trend', undefined, undefined, color.white, undefined, undefined, cfg.dashSize);
      table.cell(tbl, 2, 0, 'Pocket', undefined, undefined, color.white, undefined, undefined, cfg.dashSize);

      const chartTf = chartTimeframe(bars, chart) || '1D';
      const chartSec = timeframe.in_seconds(chartTf);
      const tfs = [cfg.tf1, cfg.tf2, cfg.tf3, cfg.tf4];
      const lower = requiredSymbols(cfg, { ...chart, timeframe: chartTf } as ChartContext);
      const lowerBars = lower.length > 0 ? symbolBarsOf(lower, chart) : [];
      const merge = otherSymbolChart(bars, chart);
      const calendar = { other: { timezone: chart?.timezone, session: chart?.session } };
      tfs.forEach((tf, k) => {
        // [t, p] = request.security(syminfo.tickerid, curr_tf, [trend, inPocket])
        const sec = secondsOf(tf, chartSec);
        let trendVal = NaN;
        let pv = false;
        if (sec === chartSec) {
          trendVal = trend[i];
          pv = inPocket[i];
        } else if (sec > chartSec) {
          const htf = higherTimeframeBars(bars, tf, chart);
          const st = trendStateOf(htf.htf, cfg);
          // a live last bar: the open bar of the timeframe; else the latest completed bar
          const g = live ? htf.group[i] : htf.latest[i];
          if (g >= 0) {
            trendVal = st.trend[g];
            pv = st.inPocket[g];
          }
        } else {
          const j = lower.findIndex((r) => r.timeframe === tf);
          const ltf = lowerBars[j];
          const st = trendStateOf(ltf, cfg);
          const shown = securityOther(bars, ltf, tf, merge, calendar);
          const g = shown[i];
          if (g >= 0) {
            trendVal = st.trend[g];
            pv = st.inPocket[g];
          }
        }
        const row = k + 1;
        table.cell(tbl, 0, row, formatTf(tf), undefined, undefined, color.white, undefined, undefined, cfg.dashSize);
        table.cell(tbl, 1, row, trendVal === 1 ? 'BULL' : 'BEAR', undefined, undefined, color.white, undefined, undefined, cfg.dashSize,
          trendVal === 1 ? color.new(cfg.colorUp, 30) : color.new(cfg.colorDown, 30));
        table.cell(tbl, 2, row, pv ? 'INSIDE' : 'OUT', undefined, undefined, color.white, undefined, undefined, cfg.dashSize,
          pv ? color.new(cfg.baseFill, 30) : color.new(color.gray, 80));
      });
    }

    // Projections
    if (t !== 0) {
      // line.delete / label.delete / linefill.delete of na do nothing
      for (const v of [l100, l50, l618, l786]) if (v.value) line.delete(v.value);
      for (const v of [lb100, lb50, lb618, lb786]) if (v.value) label.delete(v.value);
      if (fGold.value) linefill.delete(fGold.value);
      const slope = (v: number[]) => (v[i] - (i >= 4 ? v[i - 4] : NaN)) / 4;
      if (cfg.showProj) {
        const createProj = (lvl: number, s: number, col: string, txt: string, baseline = false): [Line, Label] => {
          const endVal = lvl + s * cfg.projLen;
          const ln = line.new(i, lvl, i + cfg.projLen, endVal, 'bar_index', 'none', col, baseline ? 'solid' : 'dotted', baseline ? 3 : 1);
          const lb = label.new(i + cfg.projLen, endVal, txt, 'bar_index', 'price', color.new(color.black, 100), 'label_left', col, cfg.dashSize);
          return [ln, lb];
        };
        const [ln100, lab100] = createProj(level100, slope(level100s), trendCol, '1.0', true);
        const [ln50, lab50] = createProj(fib50, slope(fib50s), cfg.colorMid, '0.5');
        const [ln618, lab618] = createProj(fib618, slope(fib618s), cfg.baseFill, '0.618');
        const [ln786, lab786] = createProj(fib786, slope(fib786s), cfg.baseFill, '0.786');
        fGold.value = linefill.new(ln618, ln786, dynamicColor);
        l100.value = ln100; l50.value = ln50; l618.value = ln618; l786.value = ln786;
        lb100.value = lab100; lb50.value = lab50; lb618.value = lab618; lb786.value = lab786;
      }
    }
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2, plot3 },
    fills: [{ id: 'fill0', plot1: 'plot1', plot2: 'plot2', options: { title: 'Dynamic Golden Pocket' }, colors: fillColors }],
    ...drawingOutputs(bars, unit),
  } as IndicatorResult;
}

export const AtrFibonacciTrendEnvelopes = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  fillConfig,
  drawingKinds,
  requiredSymbols,
};
