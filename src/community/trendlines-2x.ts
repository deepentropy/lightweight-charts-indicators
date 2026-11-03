/**
 * Trendlines 2x +
 *
 * Two sets of trendlines through the pivot points of the price (a primary set with a longer lookback and a secondary
 * set with a shorter one), trend candles and support / resistance zones of two timeframes.
 * - Pivots (each set): a pivot high (of the highs, or of the candle bodies) with "length" bars on the left and half
 *   of it (integer part) on the right; the same for pivot lows. A new pivot whose price differs from the pivot before
 *   gives a line from the pivot before to the new pivot, continued on the same slope (price per ms) for the
 *   "extension" (25 x the multiplier x the time between the bar and the bar before, after the new pivot), or without
 *   end for "Infinate". As in the original, the start of the first line of each side is na (the line counts in the
 *   limit but is not drawn, and its slope is na). Lines are placed by time.
 * - Colours: a line of the highs is green when the highs fall, a line of the lows red when the lows do not fall; the
 *   other directions are drawn grey with "Rising Upper and Falling Lower Trendlines". "Monochrome": teal. At most 50
 *   lines are kept (drawing registry of the library); the last line of each side is held by a `var` variable.
 * - Breaks (each set): the close is compared with the lines of the last pivots ("number of past trendlines" of each
 *   side, at least 1). A close that crosses over a line of the highs is a long break, a close that crosses under a
 *   line of the lows a short break (the other crosses too when the last option is off). Each comparison uses the
 *   close of the latest earlier bar on which that comparison ran. Shown as triangles and / or bar colours.
 * - Trend candles: bar colours from Heikin Ashi bars (lime / red), the colour of an earlier bar while the Heikin Ashi
 *   body stays inside the body of one of the 6 bars before.
 * - Support / resistance zones (timeframes 1 and 2): fractals of 5 bars on the timeframe (a high above the two highs
 *   before and after it, with a volume above its 6-bar average), drawn 3 bars back: resistance from the fractal
 *   high to the top of its body, support from the bottom of the body of a fractal low to the low; no colour on the
 *   bar where the fractal changes. A timeframe above the chart timeframe is built from the chart bars (completed bars,
 *   as `request.security` without lookahead); a timeframe below it needs the bars of the chart symbol on that
 *   timeframe (`requiredSymbols`, `bars` accessor of the chart context): the chart bar shows the last lower bar that
 *   closes by its close.
 * - Alerts (alertcondition, `alerts` of the result, whatever the display options): breaks of each set, trend candle
 *   colours, and close rejections at the fractal levels of each timeframe (these need the timeframe data, also when
 *   the zones are not shown).
 *
 * Line width from an input: the lines carry the width of the input.
 *
 * Reference: "Trendlines 2x +" by Lij_MC (copy of "Trendlines - JD" by Duyck; trend candles from UCS_Trend by
 * ucsgears)
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, math, line, color, timeframe, Series, mapToChart, resetDrawings, setDrawingBar, varDrawing, drawingOutputs,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type Line, type ShapeConfig, type BarColorConfig,
  type FillConfig,
} from 'oakscriptjs';
import type { BarColorData, MarkerData } from '../types';
import type { StudyDrawingKind } from '../style-outputs';
import { lastBarConfirmedOf, symbolBarsOf, tickeridOf, type ChartContext, type SymbolRequest } from '../chart-context';
import { chartTimeframe, higherTimeframeBars } from '../anchor-period';
import { securityOtherValues, otherSymbolChart } from '../other-symbol';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';

const EXTENSIONS = ['Infinate', '  25', '  50', '  75', ' 100', ' 150', ' 200', ' 300', ' 400', ' 500', ' 750', '1000'];
const BREAKS = ['Barcolor', 'Triangles + Barcolor', 'Triangles', 'n/a'];

export interface Trendlines2xInputs {
  ShowTrendCandles: boolean;
  ShowTF1SR: boolean;
  TF1: string;
  ShowTF2SR: boolean;
  TF2: string;
  InvertColors: boolean;
  a_Color_Type: string;
  a_Show_Primary: boolean;
  a_Rising_Upper_Falling_Lower: boolean;
  a_len: number;
  a_Wicks: string;
  a_Extensions: string;
  a_width: number;
  a_Line_Type_In: string;
  a_Show_Breaks: string;
  a_trendline_nr: number;
  a_select_breaks: boolean;
  b_Show_Secondary: boolean;
  b_Rising_Upper_Falling_Lower: boolean;
  b_len: number;
  b_Wicks: string;
  b_Extensions: string;
  b_width: number;
  b_Line_Type_In: string;
  b_Show_Breaks: string;
  b_trendline_nr: number;
  b_select_breaks: boolean;
  log_chart: boolean;
}

export const defaultInputs: Trendlines2xInputs = {
  ShowTrendCandles: false,
  ShowTF1SR: false,
  TF1: '',
  ShowTF2SR: false,
  TF2: '360',
  InvertColors: true,
  a_Color_Type: 'Colored',
  a_Show_Primary: true,
  a_Rising_Upper_Falling_Lower: false,
  a_len: 20,
  a_Wicks: 'Wicks',
  a_Extensions: ' 150',
  a_width: 1,
  a_Line_Type_In: 'Dashed',
  a_Show_Breaks: 'n/a',
  a_trendline_nr: 3,
  a_select_breaks: true,
  b_Show_Secondary: true,
  b_Rising_Upper_Falling_Lower: false,
  b_len: 7,
  b_Wicks: 'Wicks',
  b_Extensions: '  25',
  b_width: 1,
  b_Line_Type_In: 'Dotted',
  b_Show_Breaks: 'n/a',
  b_trendline_nr: 5,
  b_select_breaks: true,
  log_chart: false,
};

const SELECT_TITLE = "Trendline Breaks - Display Only - 'Long' Breaks on Trendlines Connecting 'Highs' and 'Short' for 'Lows'";

export const inputConfig: InputConfig[] = [
  { id: 'ShowTrendCandles', type: 'bool', title: 'Trend Candles', defval: false },
  { id: 'ShowTF1SR', type: 'bool', title: 'Support / Resistance Zones - Timeframe 1', defval: false },
  { id: 'TF1', type: 'timeframe', title: '----- Support / Resistance Zones - Timeframe 1', defval: '' },
  { id: 'ShowTF2SR', type: 'bool', title: 'Support / Resistance Zones - Timeframe 2', defval: false },
  { id: 'TF2', type: 'timeframe', title: '----- Support / Resistance Zones - Timeframe 2', defval: '360' },
  { id: 'InvertColors', type: 'bool', title: 'Support / Resistance Zones - Invert Colors', defval: true },
  { id: 'a_Color_Type', type: 'string', title: '---------------------Trendlines - 1 & 2 - Color Scheme-------------', defval: 'Colored',
    options: ['Colored', 'Monochrome'] },
  { id: 'a_Show_Primary', type: 'bool', title: '1 - Primary - Trendlines ---------------------------------------------------------------', defval: true },
  { id: 'a_Rising_Upper_Falling_Lower', type: 'bool', title: '1 - Primary - Rising Upper and Falling Lower Trendlines', defval: false },
  { id: 'a_len', type: 'int', title: '1 - Primary - Lookback Length', defval: 20 },
  { id: 'a_Wicks', type: 'string', title: '1 - Primary - Draw lines from', defval: 'Wicks', options: ['Wicks', 'Real Bodies'] },
  { id: 'a_Extensions', type: 'string', title: '1 - Primary - Trendline Extensions', defval: ' 150', options: EXTENSIONS },
  { id: 'a_width', type: 'int', title: '1 - Primary - Line Width', defval: 1, min: 0, max: 10 },
  { id: 'a_Line_Type_In', type: 'string', title: '1 - Primary - Line Type', defval: 'Dashed', options: ['Dashed', 'Dotted', 'Solid'] },
  { id: 'a_Show_Breaks', type: 'string', title: '1 - Primary - Trendline Breaks;', defval: 'n/a', options: BREAKS },
  { id: 'a_trendline_nr', type: 'int', title: '1 - Primary - Trendline Breaks - Number of Past Trendlines to Check for Breaks', defval: 3,
    min: 0, max: 10 },
  { id: 'a_select_breaks', type: 'bool', title: `1 - Primary - ${SELECT_TITLE}`, defval: true },
  { id: 'b_Show_Secondary', type: 'bool', title: '2 - Secondary - Trendlines ------------------------------------------------------------', defval: true },
  { id: 'b_Rising_Upper_Falling_Lower', type: 'bool', title: '2 - Secondary - Rising Upper and Falling Lower Trendlines', defval: false },
  { id: 'b_len', type: 'int', title: '2 - Secondary - Lookback Length', defval: 7 },
  { id: 'b_Wicks', type: 'string', title: '2 - Secondary - Draw lines from', defval: 'Wicks', options: ['Wicks', 'Real Bodies'] },
  { id: 'b_Extensions', type: 'string', title: '2 - Secondary - Trendline Extensions', defval: '  25', options: EXTENSIONS },
  { id: 'b_width', type: 'int', title: '2 - Secondary - Line Width', defval: 1, min: 0, max: 10 },
  { id: 'b_Line_Type_In', type: 'string', title: '2 - Secondary - Line Type', defval: 'Dotted', options: ['Dashed', 'Dotted', 'Solid'] },
  { id: 'b_Show_Breaks', type: 'string', title: '2 - Secondary - Trendline Breaks;', defval: 'n/a', options: BREAKS },
  { id: 'b_trendline_nr', type: 'int', title: '2 - Secondary - Trendline Breaks - Number of Past Trendlines to Check for Breaks', defval: 5,
    min: 0, max: 10 },
  { id: 'b_select_breaks', type: 'bool', title: `2 - Secondary - ${SELECT_TITLE}`, defval: true },
  { id: 'log_chart', type: 'bool', title: 'Log Chart?', defval: false },
];

const BLUE = '#2196F3';
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Timeframe 1 - Resistance - Upper Zone', color: BLUE, lineWidth: 1 },
  { id: 'plot1', title: 'Timeframe 1 - Resistance - Lower Zone', color: BLUE, lineWidth: 1 },
  { id: 'plot2', title: 'Timeframe 1 - Support - Upper Zone', color: BLUE, lineWidth: 1 },
  { id: 'plot3', title: 'Timeframe 1 - Support - Lower Zone', color: BLUE, lineWidth: 1 },
  { id: 'plot4', title: 'Timeframe 2 - Resistance - Upper Zone', color: BLUE, lineWidth: 1 },
  { id: 'plot5', title: 'Timeframe 2 - Resistance - Lower Zone', color: BLUE, lineWidth: 1 },
  { id: 'plot6', title: 'Timeframe 2 - Support - Upper Zone', color: BLUE, lineWidth: 1 },
  { id: 'plot7', title: 'Timeframe 2 - Support - Lower Zone', color: BLUE, lineWidth: 1 },
];

const GRAY = '#787B86';
const TEAL = '#00897B';
const GREEN = '#4CAF50';
const RED = '#FF5252';
const LIME = '#00E676';
const FUCHSIA = '#E040FB';
const BREAK_UP = '#c6e163';

const zone = (c: string) => String(color.new(c, 45));
const shade = (c: string) => String(color.new(c, 93));

export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot0', plot2: 'plot1', title: 'Timeframe 1 - Resistance Zone Shading', color: shade(BLUE) },
  { id: 'fill1', plot1: 'plot2', plot2: 'plot3', title: 'Timeframe 1 - Support Zone Shading', color: shade(BLUE) },
  { id: 'fill2', plot1: 'plot4', plot2: 'plot5', title: 'Timeframe 2 - Resistance Zone Shading', color: shade(BLUE) },
  { id: 'fill3', plot1: 'plot6', plot2: 'plot7', title: 'Timeframe 2 - Support Zone Shading', color: shade(BLUE) },
];

/** The original's plotshapes (markers carry these ids) */
export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'cross_high', style: 'triangleup', location: 'belowbar', color: BREAK_UP, size: 'small' },
  { id: 'shape1', kind: 'shape', title: 'cross_low', style: 'triangledown', location: 'abovebar', color: FUCHSIA, size: 'small' },
  { id: 'shape2', kind: 'shape', title: 'cross_high', style: 'triangleup', location: 'belowbar', color: BREAK_UP, size: 'small' },
  { id: 'shape3', kind: 'shape', title: 'cross_low', style: 'triangledown', location: 'abovebar', color: FUCHSIA, size: 'small' },
];

/** The original's barcolor() calls */
export const barColorConfig: BarColorConfig[] = [
  { id: 'barcolor0', kind: 'barcolor', title: 'Primary' },
  { id: 'barcolor1', kind: 'barcolor', title: 'Secondary' },
  { id: 'barcolor2', kind: 'barcolor', title: 'Trend Candles' },
];

/** Drawing kinds the script uses */
export const drawingKinds: StudyDrawingKind[] = ['line'];

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Alert - Primary Trendline - Break', message: 'Alert Fired!' },
  { id: 'alert1', title: 'Alert - Primary Trendline - Break Up', message: 'Alert Fired!' },
  { id: 'alert2', title: 'Alert - Primary Trendline - Break Down', message: 'Alert Fired!' },
  { id: 'alert3', title: 'Alert - Secondary Trendline - Break', message: 'Alert Fired!' },
  { id: 'alert4', title: 'Alert - Secondary Trendline - Break Up', message: 'Alert Fired!' },
  { id: 'alert5', title: 'Alert - Secondary Trendline - Break Down', message: 'Alert Fired!' },
  { id: 'alert6', title: 'Alert - Trend Candle Color Change - GREEN', message: 'GREEN Trend Candles - Color Change' },
  { id: 'alert7', title: 'Alert - Trend Candle Color Change - RED', message: 'RED Trend Candles - Color Change' },
  { id: 'alert8', title: 'Alert - TF1 Sell at Resistance', message: 'Alert - TF1 Sell at Resistance' },
  { id: 'alert9', title: 'Alert - TF1 Buy at Support', message: 'Alert - TF1 Buy at Support' },
  { id: 'alert10', title: 'Alert - TF2 Sell at Resistance', message: 'Alert - TF2 Sell at Resistance' },
  { id: 'alert11', title: 'Alert - TF2 Buy at Support', message: 'Alert - TF2 Buy at Support' },
];

export const metadata = {
  title: 'Trendlines 2x +',
  shortTitle: 'Trendlines 2x +',
  overlay: true,
};

/** study() without max_lines_count: 50 lines */
const MAX_LINES = 50;
/** Slots of the pseudo arrays of the script (last 10 lines of each side) */
const SLOTS = 10;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(a - b > EPS);
/** `x != y`: false when either is na */
const ne = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && Math.abs(a - b) > EPS;

/** The inputs of one set of trendlines */
interface SetInputs {
  show: boolean;
  rufl: boolean;
  len: number;
  wicks: boolean;
  multiplier: number;
  width: number;
  style: 'dashed' | 'dotted' | 'solid';
  trendlineNr: number;
  selectBreaks: boolean;
}

/** One slot of the pseudo arrays: start time, start price and slope of a line */
interface Slot { x: number; y: number; sl: number }

/** State of one a_f_trendline() call site */
interface TrendlineSite {
  ax: number;
  bx: number;
  by: number;
  slope: number;
  ayPrev: number;
  held: ReturnType<typeof varDrawing<Line>>;
}

const extensionMultiplier = (s: string): number => {
  const k = EXTENSIONS.indexOf(s);
  return k < 0 ? NaN : [0, 1, 2, 3, 4, 6, 8, 12, 16, 20, 30, 40][k];
};

/** The bars of a support / resistance timeframe that differs from the chart: higher (built) or lower (requested) */
function isLowerTimeframe(tf: string, chartTf: string): boolean {
  return tf.trim() !== '' && chartTf !== '' && timeframe.in_seconds(tf) < timeframe.in_seconds(chartTf);
}

/**
 * Bars the indicator needs: the chart symbol on each support / resistance timeframe below the chart timeframe (the
 * alerts read them, also when the zones are not shown).
 */
export function requiredSymbols(inputs: Partial<Trendlines2xInputs> = {}, chart?: ChartContext): SymbolRequest[] {
  const cfg = { ...defaultInputs, ...inputs };
  const chartTf = chartTimeframe([], chart);
  const symbol = tickeridOf(chart);
  const out: SymbolRequest[] = [];
  for (const tf of [cfg.TF1, cfg.TF2]) {
    if (isLowerTimeframe(tf, chartTf) && !out.some((r) => timeframe.in_seconds(r.timeframe) === timeframe.in_seconds(tf))) {
      out.push({ symbol, timeframe: tf });
    }
  }
  return out;
}

/** Fractal levels of the script on the bars of one timeframe (one value per bar of that timeframe) */
function fractalLevels(b: ReadonlyArray<Bar>) {
  const m = b.length;
  const volume = b.map((x) => (x.volume == null ? NaN : x.volume));
  const volMa = ta.sma(new Series(b as Bar[], (_x, i) => volume[i]), 6).toArray().map((v) => v ?? NaN);
  const h = (i: number, k: number) => (i - k >= 0 ? b[i - k].high : NaN);
  const l = (i: number, k: number) => (i - k >= 0 ? b[i - k].low : NaN);
  const o = (i: number, k: number) => (i - k >= 0 ? b[i - k].open : NaN);
  const c = (i: number, k: number) => (i - k >= 0 ? b[i - k].close : NaN);
  const up: number[] = [];
  const down: number[] = [];
  const upLower: number[] = [];
  const downUpper: number[] = [];
  let fu = NaN, fd = NaN, ul = NaN, du = NaN;
  for (let i = 0; i < m; i++) {
    const vol3 = i >= 3 ? volume[i - 3] : NaN;
    const ma3 = i >= 3 ? volMa[i - 3] : NaN;
    const isUp = gt(h(i, 3), h(i, 4)) && gt(h(i, 4), h(i, 5)) && lt(h(i, 2), h(i, 3)) && lt(h(i, 1), h(i, 2)) && gt(vol3, ma3);
    const isDown = lt(l(i, 3), l(i, 4)) && lt(l(i, 4), l(i, 5)) && gt(l(i, 2), l(i, 3)) && gt(l(i, 1), l(i, 2)) && gt(vol3, ma3);
    // TF_FractalUp := TF_Up ? TF_High[3] : TF_FractalUp[1] (na before the first fractal)
    if (isUp) fu = h(i, 3);
    if (isDown) fd = l(i, 3);
    // zones: the top of the body of the fractal high, the bottom of the body of the fractal low (kept on a doji)
    if (isUp && gt(c(i, 3), o(i, 3))) ul = c(i, 3);
    else if (isUp && lt(c(i, 3), o(i, 3))) ul = o(i, 3);
    if (isDown && gt(c(i, 3), o(i, 3))) du = o(i, 3);
    else if (isDown && lt(c(i, 3), o(i, 3))) du = c(i, 3);
    up.push(fu);
    down.push(fd);
    upLower.push(ul);
    downUpper.push(du);
  }
  return { up, down, upLower, downUpper };
}

export function calculate(
  bars: Bar[],
  inputs: Partial<Trendlines2xInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const log = cfg.log_chart;
  const mono = cfg.a_Color_Type !== 'Colored';
  // bar times in ms, as the script reads them
  const unit = chart?.timeUnit === 'ms' || (chart?.timeUnit === undefined && n > 0 && bars[0].time >= 1e12) ? 1 : 1000;
  const timeOf = (i: number) => (i >= 0 && i < n ? bars[i].time * unit : NaN);
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const styleOf = (s: string) => (s === 'Dashed' ? 'dashed' as const : s === 'Dotted' ? 'dotted' as const : 'solid' as const);

  const sets: SetInputs[] = [
    {
      show: cfg.a_Show_Primary, rufl: cfg.a_Rising_Upper_Falling_Lower, len: Math.trunc(cfg.a_len), wicks: cfg.a_Wicks === 'Wicks',
      multiplier: extensionMultiplier(cfg.a_Extensions), width: cfg.a_width, style: styleOf(cfg.a_Line_Type_In),
      trendlineNr: Math.trunc(cfg.a_trendline_nr), selectBreaks: cfg.a_select_breaks,
    },
    {
      show: cfg.b_Show_Secondary, rufl: cfg.b_Rising_Upper_Falling_Lower, len: Math.trunc(cfg.b_len), wicks: cfg.b_Wicks === 'Wicks',
      multiplier: extensionMultiplier(cfg.b_Extensions), width: cfg.b_width, style: styleOf(cfg.b_Line_Type_In),
      trendlineNr: Math.trunc(cfg.b_trendline_nr), selectBreaks: cfg.b_select_breaks,
    },
  ];

  const project = (y: number, dt: number, slope: number) => (log ? y * (math.exp(dt * slope) as number) : y + dt * slope);

  // Lines: library objects (xloc.bar_time) in the drawing registry; the `var line` of each call site counts but is
  // not deleted by the count
  resetDrawings({ line: MAX_LINES });

  /** One set: pivots, the two call sites of a_f_trendline, the pseudo arrays and the 20 a_line_cross call sites */
  const state = sets.map((s) => {
    // len / 2: the pivot bars on the right and time[delay] use its integer part
    const half = Math.trunc(s.len / 2);
    const highSrc = new Series(bars, (b) => (s.wicks ? b.high : (gt(b.close, b.open) ? b.close : b.open)));
    const lowSrc = new Series(bars, (b) => (s.wicks ? b.low : (gt(b.close, b.open) ? b.open : b.close)));
    // `var int a_Ax = 1` ...: the else branch on bar 0 assigns `a_Ax[1]` (na on bar 0), so Ax, Bx and By are na
    // until the first change; the slope keeps 0
    const site = (): TrendlineSite => ({ ax: NaN, bx: NaN, by: NaN, slope: 0, ayPrev: NaN, held: varDrawing<Line>() });
    return {
      s,
      half,
      highPivot: A(ta.pivothigh(highSrc, s.len, half)),
      lowPivot: A(ta.pivotlow(lowSrc, s.len, half)),
      highSite: site(),
      lowSite: site(),
      highs: Array.from({ length: SLOTS }, (): Slot => ({ x: 0, y: 0, sl: 0 })),
      lows: Array.from({ length: SLOTS }, (): Slot => ({ x: 0, y: 0, sl: 0 })),
      // a__check_value[1] of each a_line_cross() call site: the close of the latest earlier bar on which it ran
      highCheck: new Array<number>(SLOTS).fill(NaN),
      lowCheck: new Array<number>(SLOTS).fill(NaN),
      longBreak: new Array<boolean>(n).fill(false),
      shortBreak: new Array<boolean>(n).fill(false),
    };
  });

  /** a_f_trendline(input, delay, only_up): updates the call site; true when a new pivot changed the line */
  const trendline = (
    i: number, st: (typeof state)[number], site: TrendlineSite, input: number, onlyUp: boolean, barTime: number,
  ): boolean => {
    const s = st.s;
    const time = timeOf(i);
    // a_Ay = fixnan(input)
    const ay = Number.isNaN(input) ? site.ayPrev : input;
    const changed = ne(ay - site.ayPrev, 0);
    if (changed) {
      const axPrev = site.ax;
      site.ax = timeOf(i - st.half);
      site.by = site.ayPrev;
      site.bx = axPrev;
      site.slope = log
        ? ((math.log(ay) as number) - (math.log(site.by) as number)) / (site.ax - site.bx)
        : (ay - site.by) / (site.ax - site.bx);
    }
    const extensionTime = s.multiplier * barTime * 25;
    const axbis = site.ax + extensionTime;
    const aybis = project(ay, extensionTime, site.slope);
    // var bool a__xtend = true, set false when the multiplier != 0 (na keeps true)
    const xtend = !ne(s.multiplier, 0);
    if (changed) {
      const falling = lt(site.slope * time, 0);
      const pick = (c: string) => (mono ? TEAL : c);
      const risingFalling = falling
        ? (onlyUp ? (s.rufl ? pick(GRAY) : null) : pick(GREEN))
        : (onlyUp ? pick(RED) : (s.rufl ? pick(GRAY) : null));
      const notRisingFalling = falling ? (onlyUp ? null : pick(GREEN)) : (onlyUp ? pick(RED) : null);
      const css = s.show && !s.rufl ? notRisingFalling : s.show && s.rufl ? risingFalling : null;
      if (css !== null) {
        site.held.value = line.new(site.bx, site.by, axbis, aybis, 'bar_time', xtend ? 'right' : 'none', css, s.style, s.width);
      }
    }
    site.ayPrev = ay;
    return changed;
  };

  /** a_line_cross(close, start time, start price, slope): 1 cross over, -1 cross under, 0 none */
  const lineCross = (i: number, checks: number[], k: number, slot: Slot, barTime: number): number => {
    const close = bars[i].close;
    const previousClose = checks[k];
    checks[k] = close;
    const elapsed = timeOf(i) - slot.x;
    const current = project(slot.y, elapsed - 0 * barTime, slot.sl);
    const previous = project(slot.y, elapsed - 1 * barTime, slot.sl);
    return lt(previousClose, previous) && gt(close, current) ? 1 : gt(previousClose, previous) && lt(close, current) ? -1 : 0;
  };

  try {
    for (let i = 0; i < n; i++) {
      setDrawingBar(i, i === n - 1);
      const time = timeOf(i);
      // a_bar_time = time - time[1]
      const barTime = time - timeOf(i - 1);
      for (const st of state) {
        const s = st.s;
        const changedHigh = trendline(i, st, st.highSite, st.highPivot[i], false, barTime);
        const changedLow = trendline(i, st, st.lowSite, st.lowPivot[i], true, barTime);
        // a new line shifts the pseudo array: slot 0 = start of the line (the pivot before) and its slope
        if (changedHigh) {
          st.highs.pop();
          st.highs.unshift({ x: st.highSite.bx, y: st.highSite.by, sl: st.highSite.slope });
        }
        if (changedLow) {
          st.lows.pop();
          st.lows.unshift({ x: st.lowSite.bx, y: st.lowSite.by, sl: st.lowSite.slope });
        }
        // every slot is tested on every bar (a_cross_high0 .. 9, a_cross_low0 .. 9); the breaks read the first
        // max(1, number of past trendlines) slots
        const used = Math.max(1, s.trendlineNr);
        let longBreak = false;
        let shortBreak = false;
        for (let k = 0; k < SLOTS; k++) {
          const h = st.highs[k];
          const crossHigh = !s.rufl && gt(h.sl * time, 0) ? 0 : lineCross(i, st.highCheck, k, h, barTime);
          const l = st.lows[k];
          const crossLow = !s.rufl && lt(l.sl * time, 0) ? 0 : lineCross(i, st.lowCheck, k, l, barTime);
          if (k < used) {
            if (crossHigh === 1 || (!s.selectBreaks && crossLow === 1)) longBreak = true;
            if ((!s.selectBreaks && crossHigh === -1) || crossLow === -1) shortBreak = true;
          }
        }
        st.longBreak[i] = longBreak;
        st.shortBreak[i] = shortBreak;
      }
    }
  } finally {
    setDrawingBar(null);
  }

  // Breaks: triangles and bar colours of each set
  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];
  const breakModes = [cfg.a_Show_Breaks, cfg.b_Show_Breaks];
  state.forEach((st, j) => {
    const mode = breakModes[j];
    const triangles = mode === 'Triangles' || mode === 'Triangles + Barcolor';
    const colored = mode === 'Barcolor' || mode === 'Triangles + Barcolor';
    for (let i = 0; i < n; i++) {
      const t = bars[i].time;
      // plotshape(cond ? close : na, location.belowbar / abovebar): na and 0 draw no shape
      const shown = !Number.isNaN(bars[i].close) && bars[i].close !== 0;
      if (triangles && st.longBreak[i] && shown) {
        markers.push({ id: `shape${2 * j}`, time: t, position: 'belowBar', shape: 'triangleUp', color: BREAK_UP, size: 'small' });
      }
      if (triangles && st.shortBreak[i] && shown) {
        markers.push({ id: `shape${2 * j + 1}`, time: t, position: 'aboveBar', shape: 'triangleDown', color: FUCHSIA, size: 'small' });
      }
      if (colored && (st.longBreak[i] || st.shortBreak[i])) {
        barColors.push({ id: `barcolor${j}`, time: t, color: st.longBreak[i] ? BREAK_UP : FUCHSIA });
      }
    }
  });

  // Trend candles (UCS_Trend): Heikin Ashi open / close
  const haClose = bars.map((b) => (b.open + b.high + b.low + b.close) / 4);
  const haOpen: number[] = [];
  for (let i = 0; i < n; i++) {
    const prev = i > 0 ? haOpen[i - 1] : NaN;
    haOpen.push(Number.isNaN(prev) ? (bars[i].open + bars[i].close) / 2 : (prev + haClose[i - 1]) / 2);
  }
  const ccolor = haOpen.map((o, i) => (gt(haClose[i] - o, 0) ? 1 : 0));
  const colorValue: number[] = [];
  for (let i = 0; i < n; i++) {
    const inside = (k: number) => {
      const o = i - k >= 0 ? haOpen[i - k] : NaN;
      const c = i - k >= 0 ? haClose[i - k] : NaN;
      const top = Math.max(o, c);
      const bottom = Math.min(o, c);
      return le(haOpen[i], top) && ge(haOpen[i], bottom) && le(haClose[i], top) && ge(haClose[i], bottom);
    };
    let v = ccolor[i];
    for (let k = 6; k >= 1; k--) {
      if (inside(k)) {
        v = ccolor[i - k];
        break;
      }
    }
    colorValue.push(v);
  }
  if (cfg.ShowTrendCandles) {
    for (let i = 0; i < n; i++) {
      barColors.push({ id: 'barcolor2', time: bars[i].time, color: colorValue[i] ? LIME : RED });
    }
  }

  // Support / resistance zones of the two timeframes
  const chartTf = chartTimeframe(bars, chart);
  const lowerRequests = requiredSymbols(cfg, { ...chart, timeframe: chartTf } as ChartContext);
  const lowerBars = lowerRequests.length > 0 ? symbolBarsOf(lowerRequests, chart) : [];
  const live = !lastBarConfirmedOf(chart);
  /** request.security(syminfo.tickerid, tf, fractal levels) on each chart bar */
  const levelsOf = (tf: string) => {
    if (tf.trim() === '' || chartTf === '' || timeframe.in_seconds(tf) === timeframe.in_seconds(chartTf)) {
      return fractalLevels(bars);
    }
    if (isLowerTimeframe(tf, chartTf)) {
      // the last lower bar that closes by the close of the chart bar
      const j = lowerRequests.findIndex((r) => timeframe.in_seconds(r.timeframe) === timeframe.in_seconds(tf));
      const ltf = lowerBars[j];
      const levels = fractalLevels(ltf);
      const merge = otherSymbolChart(bars, chart);
      const calendar = { other: { timezone: chart?.timezone, session: chart?.session } };
      const map = (values: number[]) => securityOtherValues(bars, ltf, tf, values, merge, calendar);
      return { up: map(levels.up), down: map(levels.down), upLower: map(levels.upLower), downUpper: map(levels.downUpper) };
    }
    // a higher timeframe: completed bars built from the chart bars (the open bar on a live last bar)
    const sec = higherTimeframeBars(bars, tf, chart);
    const levels = fractalLevels(sec.htf);
    const map = (values: number[]) => {
      const out = mapToChart(values, sec.group, sec.latest, false, false);
      if (live && n > 0) out[n - 1] = values[sec.group[n - 1]] ?? NaN;
      return out;
    };
    return { up: map(levels.up), down: map(levels.down), upLower: map(levels.upLower), downUpper: map(levels.downUpper) };
  };

  const shiftIdx = bars.map((_b, i) => i).filter((i) => i - 3 >= 0);
  const plots: IndicatorResult['plots'] = {};
  const fills: NonNullable<IndicatorResult['fills']> = [];
  const alertFlags: boolean[][] = [];
  const timeframes = [
    { tf: cfg.TF1, show: cfg.ShowTF1SR, resistance: cfg.InvertColors ? LIME : RED, support: cfg.InvertColors ? RED : LIME },
    { tf: cfg.TF2, show: cfg.ShowTF2SR, resistance: cfg.InvertColors ? GREEN : FUCHSIA, support: cfg.InvertColors ? FUCHSIA : GREEN },
  ];
  const zoneAlerts: boolean[][] = [];
  timeframes.forEach((z, j) => {
    const lv = levelsOf(z.tf);
    // no colour on the bar where the fractal changes (`x != x[1]`, false when either is na)
    const resColor = lv.up.map((v, i) => (ne(v, i > 0 ? lv.up[i - 1] : NaN) ? null : z.resistance));
    const supColor = lv.down.map((v, i) => (ne(v, i > 0 ? lv.down[i - 1] : NaN) ? null : z.support));
    // plot(..., offset = -3): the value of bar i on bar i - 3
    const shifted = (values: number[], colors: Array<string | null>) => shiftIdx.map((i) => ({
      time: bars[i - 3].time,
      value: z.show && Number.isFinite(values[i]) ? values[i] : NaN,
      color: colors[i] === null ? 'transparent' : zone(colors[i] as string),
    }));
    const p = 4 * j;
    plots[`plot${p}`] = shifted(lv.up, resColor);
    plots[`plot${p + 1}`] = shifted(lv.upLower, resColor);
    plots[`plot${p + 2}`] = shifted(lv.downUpper, supColor);
    plots[`plot${p + 3}`] = shifted(lv.down, supColor);
    // fill colour k goes with plot point k (source bar)
    const fillColors = (colors: Array<string | null>) => shiftIdx.map((i) => (colors[i] === null ? 'transparent' : shade(colors[i] as string)));
    fills.push(
      { id: `fill${2 * j}`, plot1: `plot${p}`, plot2: `plot${p + 1}`, options: { title: fillConfig[2 * j].title }, colors: fillColors(resColor) },
      { id: `fill${2 * j + 1}`, plot1: `plot${p + 2}`, plot2: `plot${p + 3}`, options: { title: fillConfig[2 * j + 1].title },
        colors: fillColors(supColor) },
    );
    // Sell at resistance / buy at support: a wick through the fractal level with the open and close on one side
    zoneAlerts.push(bars.map((b, i) => {
      const fu = lv.up[i];
      return lt(b.low, fu) && lt(b.open, fu) && ge(b.high, fu) && lt(b.close, fu);
    }));
    zoneAlerts.push(bars.map((b, i) => {
      const fd = lv.down[i];
      return gt(b.high, fd) && gt(b.open, fd) && le(b.low, fd) && gt(b.close, fd);
    }));
  });

  for (const st of state) {
    alertFlags.push(st.longBreak.map((v, i) => v || st.shortBreak[i]), st.longBreak, st.shortBreak);
  }
  alertFlags.push(colorValue.map((v) => !!v), colorValue.map((v) => !v), ...zoneAlerts);

  const drawings = drawingOutputs(bars, unit === 1 ? 'ms' : 's');
  resetDrawings();
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    fills,
    markers,
    barColors,
    ...drawings,
    alerts: alertStates(alertConditions, bars, alertFlags),
  };
}

export const Trendlines2x = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  fillConfig,
  shapeConfig,
  barColorConfig,
  drawingKinds,
  alertConditions,
  requiredSymbols,
};
