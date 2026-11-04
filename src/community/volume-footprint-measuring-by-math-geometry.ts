/**
 * Volume Footprint: Measuring Classical Indicators by Math & Geometry (VFP-Intro)
 *
 * Splits the volume of each bar into buy and sell volume with one of three engines:
 * - Geometric (default): buy = volume x (close - low) / range, sell = the rest (half and half on a bar without range);
 * - Intrabar: the up / down volume of the bars of "Intrabar Timeframe" inside each chart bar (rule of the platform's
 *   ta library, `requestUpAndDownVolume`, version 14: an intrabar is up when close > open, down when close < open,
 *   else up / down when its close is above / below the close before, else as the intrabar before; the sums restart on
 *   each chart bar and only the last 200,000 intrabars are calculated);
 * - Footprint: the volume footprint of the platform (`request.footprint`), not available to the port: it throws.
 *
 * The buy / sell volume, total and shares are data-window plots. On the last bar:
 * - a footprint frame of 2 x "Ticks Above/Below" + 1 one-tick price rows centred on the row of the last close. The
 *   newest "Window Bars" bars (at most 5,000 bars back) that traded inside the frame each get a column: the buy volume
 *   of a bar follows a normal bell centred midway from the low to the close, the sell volume one centred midway from the
 *   close to the high (standard deviation range / "Volume Concentration", truncated to the bar range); a row gets the
 *   exact mass of its half-tick band. Window POC (row with the most volume), Value Area ("Value Area" % of the volume,
 *   grown from the POC) and the first diagonal imbalance above and below the POC ("Imbalance" %);
 * - the full table of these rows (per-bar cells, price ladder, sums) or, with "Mobile Mode" (default), a compact
 *   dashboard: bar volume and delta, window volume and delta, W-POC, VAH, VAL, imbalances, chart POC and balance;
 * - a volume profile of the last "Profile Period" bars to the right of the last bar: two closed polylines (buy and sell
 *   bells, sums of the truncated bells of the bars, flat bars as point masses), frame lines at the period high / low,
 *   chart POC, Value Area lines and imbalance lines (dotted) with merged labels, a self-check label (residual of the
 *   Simpson integration, in parts per million) and a balance label (overlap coefficient of the two normalised bells).
 * The Residual PPM, Balance Tilt %, Dashboard POC and Chart POC plots have a value on the last bar only.
 *
 * Chart context: `syminfo.mintick` (rows, price texts), `syminfo.ticker` (banner), `chart.fg_color` /
 * `chart.bg_color` (theme colours; fallbacks #DBDBDB / #0F0F0F), the bars of the lower timeframe of the Intrabar engine
 * (`requiredSymbols`, `bars` accessor; without them the port throws a MissingSymbolDataError).
 *
 * Reference: "Volume Footprint: Measuring Classical Indicators by Math & Geometry, Introduction" by ata_sabanci
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © ata_sabanci
 */

import {
  math, str, color, timeframe, line, label, polyline, table, chartPoint, resetDrawings, setDrawingBar, varDrawing,
  drawingOutputs,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type Line, type Label, type Polyline, type Table,
  type ChartPoint,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import {
  mintickOf, tickerOf, tickeridOf, foregroundColorOf, backgroundColorOf, symbolBarsOf, type ChartContext,
  type SymbolRequest,
} from '../chart-context';
import { chartTimeframe } from '../anchor-period';
import { securityOther, securityLowerTf, otherSymbolChart } from '../other-symbol';

type Engine = 'Geometric' | 'Intrabar' | 'Footprint (Premium/Ultimate)';
type Scope = 'Off' | 'Dashboard' | 'Chart' | 'Dashboard and Chart';

export interface VolumeFootprintMeasuringByMathGeometryInputs {
  /** Engine */
  engine: Engine;
  /** Intrabar Timeframe */
  ltf: string;
  /** Ticks Per Row (Footprint engine only) */
  ticksPerRow: number;
  /** Window Bars */
  window: number;
  /** Ticks Above/Below */
  viewTicks: number;
  /** Volume Concentration */
  bellDiv: number;
  /** Show Table */
  showTable: boolean;
  /** Table Text Size (points) */
  tableSize: number;
  /** Mobile Mode */
  mobileMode: boolean;
  /** Mobile Text Size (points) */
  mobileSize: number;
  /** Table Position (vertical) */
  tableYpos: 'Top' | 'Middle' | 'Bottom';
  /** Table Position (horizontal) */
  tableXpos: 'Left' | 'Center' | 'Right';
  /** Show Profile */
  profShow: boolean;
  /** Buy Bell */
  profBuy: boolean;
  /** Sell Bell */
  profSell: boolean;
  /** Profile Period */
  profPeriod: number;
  /** Width (bars) */
  profWidth: number;
  /** Resolution (price samples) */
  profRes: number;
  /** Fill Opacity % */
  profFill: number;
  /** Bell Colors: buy */
  profBuyCol: string;
  /** Bell Colors: sell */
  profSellCol: string;
  /** Frame Lines: colour */
  profLineCol: string;
  /** Frame Lines: width */
  profLineWidth: number;
  /** Frame Lines: style */
  profLineStyle: 'Solid' | 'Dashed' | 'Dotted';
  /** Point of Control */
  pocScope: Scope;
  /** Point of Control: bars past the profile */
  pocOffset: number;
  /** Value Area */
  vaScope: Scope;
  /** Value Area % */
  vaPct: number;
  /** Imbalance */
  imbShow: boolean;
  /** Imbalance % */
  imbPct: number;
  /** Balance Tilt % */
  ovlTilt: number;
  /** Residual Tolerance PPM */
  resTol: number;
  /** Label Merge Ticks */
  lblMerge: number;
}

export const defaultInputs: VolumeFootprintMeasuringByMathGeometryInputs = {
  engine: 'Geometric',
  ltf: '1',
  ticksPerRow: 1,
  window: 5,
  viewTicks: 5,
  bellDiv: 3.0,
  showTable: true,
  tableSize: 12,
  mobileMode: true,
  mobileSize: 10,
  tableYpos: 'Bottom',
  tableXpos: 'Right',
  profShow: true,
  profBuy: true,
  profSell: true,
  profPeriod: 23,
  profWidth: 20,
  profRes: 100,
  profFill: 15,
  profBuyCol: '#4FADFF',
  profSellCol: '#FF5C78',
  profLineCol: '#787B86',
  profLineWidth: 1,
  profLineStyle: 'Dashed',
  pocScope: 'Dashboard and Chart',
  pocOffset: 5,
  vaScope: 'Dashboard and Chart',
  vaPct: 70.0,
  imbShow: true,
  imbPct: 300.0,
  ovlTilt: 5.0,
  resTol: 1.0,
  lblMerge: 2,
};

const TT_ENGINE = "Data source for every number in this indicator. Geometric splits each bar's volume by where the bar closed inside its range and works on every plan. Intrabar reads real up and down volume from the candles of a lower timeframe through the platform's official ta library; bars older than your plan's intrabar history stay empty, with no substitute data. Footprint feeds everything from the platform's own per-tick volume footprint, the same data behind the platform's footprint charts; it requires a Premium or Ultimate plan, and on lower plans the script stops with an error.";
const TT_LTF = "Lower timeframe the Intrabar engine reads its volume from. Smaller timeframes give higher precision but cover fewer chart bars; the banner and the data window report how many bars carry valid data. Choosing a timeframe higher than the chart's causes a runtime error, exactly as the library defines.";
const TT_TPR = "Size of each row in the volume footprint, in ticks. One tick gives the highest resolution: every minimum price increment gets its own row. Higher values merge ticks into wider rows and reduce detail. Only used by the Footprint engine.";
const TT_WINDOW = "Number of columns in the footprint. The window walks back from the current bar and keeps only candles that traded inside the visible price frame, skipping the rest, so every column is a candle that actually left volume at these prices. The search reaches at most 5000 bars back.";
const TT_VIEW = "Number of one-tick price rows shown above and below the current price. The frame follows the price like an aircraft altimeter: the price stays centered while the price ladder slides behind it. Rows outside the frame stay off screen; they are never merged.";
const TT_SPREAD = "How tightly each bar's volume gathers around its center price. Higher values pull the volume toward the center; lower values spread it out toward the bar's extremes.";
const TT_SHOW = "Draws the footprint table on the chart. Turn it off for a clean chart; the volume figures stay available in the Data Window either way.";
const TT_TSIZE = "Text size of the footprint table, in typographic points. Large windows or tall frames produce many cells; smaller text keeps them readable.";
const TT_TPOS = "Corner or edge of the chart where the footprint table is anchored.";
const TT_MOBILE = "Replaces the full footprint table with a compact numeric dashboard built for small phone screens, on by default. On a desktop, or whenever you want the full detail (per-bar cells, the price ladder, and the sum column), turn this mode off to bring the full table back.";
const TT_MSIZE = "Text size of the mobile dashboard, in typographic points. Independent of the full table's text size.";
const TT_C_DATA = "Sell volume (-, red) and buy volume (+, blue) modeled at this price for this bar. The background gets stronger as the cell nears the busiest cell of the window.";
const TT_C_AXIS = "Current price row. The frame is anchored here; the price ladder slides through it as price moves, like an aircraft altimeter.";
const TT_C_HDR = "How many bars back this column sits on the chart: 0 is the bar still being built, -1 the last closed candle, and so on. Each header wears the direction of its own candle: blue closed up, red closed down. Candles that never traded inside this frame take no column, so the numbers can jump.";
const TT_C_PRICE = "One-tick price ladder around the current price.";
const TT_C_TOT = "Total volume of this bar.";
const TT_C_DELTA = "Buy volume minus sell volume for this bar. Positive means buyers dominated.";
const TT_C_SUM = "Sell and buy volume of this price level summed across every bar of the window: the window's volume profile written as numbers. The background scales against the busiest summed level.";
const TT_METRICS = "Column marking academic footprint levels beside the price. Point of Control is the price level with the greatest volume.";
const TT_POC = "Point of Control: the price level that traded the most volume. Choose where it is marked. Dashboard uses the table's own window of bars and dots the metrics column; Chart uses the profile's period and draws a line beside the bells. The number sets how many bars past the profile the chart line runs before its label.";
const TT_VA = "Value Area: the price band that holds the chosen share of the period's traded volume, marked by a high line and a low line around the Point of Control. Inside the band the market accepted price and business kept building; past its edges trade thinned out fast. Price re-entering the band tends to travel across it, and price holding beyond an edge often means the market has moved on to do business elsewhere. The percentage sets how much of the traded volume the band must contain; seventy is the classical figure.";
const TT_IMB = "Volume imbalance: one side of a price level overwhelming the other side of the neighbouring level, measured diagonally. A level has a buy imbalance when its buy volume exceeds the sell volume one level below by the given percentage, and a sell imbalance when its sell volume exceeds the buy volume one level above by the same percentage. Three hundred, the classical figure, demands three times the opposing volume. In the table, imbalanced cells carry an arrow and a stronger tint per bar, the metrics column marks the levels imbalanced across the whole window, and the chart draws a dotted line per imbalanced zone of the profile period. The Footprint engine reads the platform's own per-row verdict; the other engines apply the same rule to their own rows.";
const TT_C_POC = "Point of Control. Over the bars covered by this table, more volume changed hands at this price than at any other. Price tends to return to it, and a break away from it that holds often marks a real shift.\n";
const TT_C_STAT = "Current bar at a glance: symbol, active engine, last price with its change from the prior close, total volume, sell and buy volume, and the side that leads by percentage points of the bar's volume. The banner turns blue when the bar is up and red when it is down.";
const TT_C_OVL = "How much the buying and the selling happened at the same prices over this profile's period, on a scale from zero to one.\nNear one, both sides worked the same levels: the market is balanced and rotating, and the edges of the profile tend to hold.\nAway from one, each side kept its own price territory, and the label names the heavier side and wears its colour. That is what a directional market looks like: one side pushing, the other answering somewhere else.\nWhen the two sides are close to equal in volume, no side is named, because calling a direction there would be guesswork.";
const TT_TILT = "How far apart the two sides must be, in percentage points of the profile's volume, before the balance label names a side.\nBelow this distance the label stays neutral and only reports that the market left balance, which keeps a coin flip from being dressed up as a direction.\nRaise it to hear only about clear dominance, lower it to catch smaller leans.";
const TT_C_RES = "Self-check of the profile's own arithmetic, in parts per million.\nThe area under each curve, together with the volume of the flat bars, has to add back up to the volume that side really traded. This is how far the two came apart.\nEXACT means the drawing you see is a faithful picture of the volume behind it. DRIFT means the reading has left its tolerance and the shape should not be traded on until it settles.\nThis is a health reading of the tool, not a signal about the market.";
const TT_RESTOL = "How far the profile's self-check may drift, in parts per million, before it is called out.\nHealthy readings sit far below one, so the default leaves a wide margin and speaks up only when something is genuinely wrong.\nLower it for a stricter watch, raise it if a symbol's rounding makes the reading noisy.";
const TT_MERGE = "How close two chart marks may sit, in ticks of this market, before their labels are combined into one.\nLevels inside this distance share a single label, one line of text per level, so nothing covers anything.\nLevels at exactly the same price also share a single horizontal line. Set to zero to always keep every label separate.";
const TT_P_SHOW = "Draws the volume profile in the free space to the right of the last bar: two bell curves grown from one shared baseline, one fed only by buy volume, one fed only by sell volume. Where they overlap, a third shade marks the prices both sides fought over.";
const TT_P_PERIOD = "Number of bars the profile covers, counting back from the current bar. The profile's height spans exactly the highest high and the lowest low of these bars.";
const TT_P_SIZE = "Left: horizontal size of the profile, in bars of free space to the right of the last bar; the widest price level reaches exactly this far. Right: number of price levels the curve is sampled at; higher values trace the curve more finely without ever changing its shape.";
const TT_P_FILL = "Opacity of the bell bodies, in percent. Where the translucent buy and sell bodies overlap, their colors blend on their own into a third shade that marks the contested prices.";
const TT_P_COLS = "Body colors of the buy bell (left) and the sell bell (right). The outline of each bell follows its body color.";
const TT_P_LINES = "Two horizontal lines capping the profile at the period's lowest low and highest high. Left to right: line color, thickness, and stroke style.";
const TT_P_BUY = "Shows the buy bell of the profile. Turn both sides on to see where their shapes overlap.";
const TT_P_SELL = "Shows the sell bell of the profile. Turn both sides on to see where their shapes overlap.";

const GRP_PROFILE = 'Volume Profile';
const GRP_METRICS = 'Metrics';
const SCOPES: Scope[] = ['Off', 'Dashboard', 'Chart', 'Dashboard and Chart'];

export const inputConfig: InputConfig[] = [
  { id: 'engine', type: 'string', title: 'Engine', defval: 'Geometric', options: ['Geometric', 'Intrabar', 'Footprint (Premium/Ultimate)'], tooltip: TT_ENGINE },
  { id: 'ltf', type: 'timeframe', title: 'Intrabar Timeframe', defval: '1', tooltip: TT_LTF },
  { id: 'ticksPerRow', type: 'int', title: 'Ticks Per Row', defval: 1, min: 1, max: 500, tooltip: TT_TPR },
  { id: 'window', type: 'int', title: 'Window Bars', defval: 5, min: 2, max: 60, tooltip: TT_WINDOW },
  { id: 'viewTicks', type: 'int', title: 'Ticks Above/Below', defval: 5, min: 1, max: 50, tooltip: TT_VIEW },
  { id: 'bellDiv', type: 'float', title: 'Volume Concentration', defval: 3.0, min: 1.0, max: 10.0, step: 0.5, tooltip: TT_SPREAD },
  { id: 'showTable', type: 'bool', title: 'Show Table', defval: true, tooltip: TT_SHOW, display: 'none' },
  { id: 'tableSize', type: 'int', title: 'Table Text Size', defval: 12, min: 1, max: 100, tooltip: TT_TSIZE },
  { id: 'mobileMode', type: 'bool', title: 'Mobile Mode', defval: true, tooltip: TT_MOBILE, display: 'none' },
  { id: 'mobileSize', type: 'int', title: 'Mobile Text Size', defval: 10, min: 1, max: 100, tooltip: TT_MSIZE },
  { id: 'tableYpos', type: 'string', title: 'Table Position', defval: 'Bottom', options: ['Top', 'Middle', 'Bottom'], inline: 'pos', tooltip: TT_TPOS },
  { id: 'tableXpos', type: 'string', title: '', defval: 'Right', options: ['Left', 'Center', 'Right'], inline: 'pos' },
  { id: 'profShow', type: 'bool', title: 'Show Profile', defval: true, group: GRP_PROFILE, tooltip: TT_P_SHOW, display: 'none' },
  { id: 'profBuy', type: 'bool', title: 'Buy Bell', defval: true, inline: 'pbell', group: GRP_PROFILE, active: 'profShow', tooltip: TT_P_BUY, display: 'none' },
  { id: 'profSell', type: 'bool', title: 'Sell Bell', defval: true, inline: 'pbell', group: GRP_PROFILE, active: 'profShow', tooltip: TT_P_SELL, display: 'none' },
  { id: 'profPeriod', type: 'int', title: 'Profile Period', defval: 23, min: 2, max: 60, group: GRP_PROFILE, tooltip: TT_P_PERIOD },
  { id: 'profWidth', type: 'int', title: 'Width / Resolution', defval: 20, min: 5, max: 100, inline: 'psize', group: GRP_PROFILE, tooltip: TT_P_SIZE },
  { id: 'profRes', type: 'int', title: '', defval: 100, min: 20, max: 400, inline: 'psize', group: GRP_PROFILE },
  { id: 'profFill', type: 'int', title: 'Fill Opacity %', defval: 15, min: 0, max: 100, group: GRP_PROFILE, tooltip: TT_P_FILL },
  { id: 'profBuyCol', type: 'color', title: 'Bell Colors', defval: '#4FADFF', inline: 'pcol', group: GRP_PROFILE, tooltip: TT_P_COLS },
  { id: 'profSellCol', type: 'color', title: '', defval: '#FF5C78', inline: 'pcol', group: GRP_PROFILE },
  { id: 'profLineCol', type: 'color', title: 'Frame Lines', defval: '#787B86', inline: 'pline', group: GRP_PROFILE, tooltip: TT_P_LINES },
  { id: 'profLineWidth', type: 'int', title: '', defval: 1, min: 1, max: 10, inline: 'pline', group: GRP_PROFILE },
  { id: 'profLineStyle', type: 'string', title: '', defval: 'Dashed', options: ['Solid', 'Dashed', 'Dotted'], inline: 'pline', group: GRP_PROFILE },
  { id: 'pocScope', type: 'string', title: 'Point of Control', defval: 'Dashboard and Chart', options: SCOPES, inline: 'poc', group: GRP_METRICS, tooltip: TT_POC },
  { id: 'pocOffset', type: 'int', title: '', defval: 5, min: 0, max: 100, inline: 'poc', group: GRP_METRICS },
  { id: 'vaScope', type: 'string', title: 'Value Area', defval: 'Dashboard and Chart', options: SCOPES, inline: 'va', group: GRP_METRICS, tooltip: TT_VA },
  { id: 'vaPct', type: 'float', title: '', defval: 70.0, min: 1.0, max: 100.0, step: 1.0, inline: 'va', group: GRP_METRICS },
  { id: 'imbShow', type: 'bool', title: 'Imbalance', defval: true, inline: 'imb', group: GRP_METRICS, tooltip: TT_IMB, display: 'none' },
  { id: 'imbPct', type: 'float', title: '', defval: 300.0, min: 1.0, max: 1000.0, step: 25.0, inline: 'imb', group: GRP_METRICS },
  { id: 'ovlTilt', type: 'float', title: 'Balance Tilt %', defval: 5.0, min: 0.0, max: 50.0, step: 0.5, group: GRP_METRICS, tooltip: TT_TILT },
  { id: 'resTol', type: 'float', title: 'Residual Tolerance PPM', defval: 1.0, min: 0.0, max: 1000.0, step: 0.5, group: GRP_METRICS, tooltip: TT_RESTOL },
  { id: 'lblMerge', type: 'int', title: 'Label Merge Ticks', defval: 2, min: 0, max: 100, group: GRP_METRICS, tooltip: TT_MERGE },
];

const COL_FWD = '#2979FF';
const COL_REV = '#FF1744';
const PINE_BLUE = '#2962FF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Buy Volume', color: COL_FWD, lineWidth: 1, display: 'data_window', editable: false },
  { id: 'plot1', title: 'Sell Volume', color: COL_REV, lineWidth: 1, display: 'data_window', editable: false },
  { id: 'plot2', title: 'Total Volume', color: PINE_BLUE, lineWidth: 1, display: 'data_window', editable: false },
  { id: 'plot3', title: 'Buy Share %', color: COL_FWD, lineWidth: 1, display: 'data_window', editable: false },
  { id: 'plot4', title: 'Sell Share %', color: COL_REV, lineWidth: 1, display: 'data_window', editable: false },
  { id: 'plot5', title: 'Residual PPM', color: PINE_BLUE, lineWidth: 1, display: 'data_window', editable: false },
  { id: 'plot6', title: 'Balance Tilt %', color: PINE_BLUE, lineWidth: 1, display: 'data_window', editable: false },
  { id: 'plot7', title: 'Dashboard POC', color: PINE_BLUE, lineWidth: 1, display: 'data_window', editable: false },
  { id: 'plot8', title: 'Chart POC', color: PINE_BLUE, lineWidth: 1, display: 'data_window', editable: false },
];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'polyline', 'table'];

export const metadata = {
  title: 'Volume Footprint: Measuring Classical Indicators by Math & Geometry, Introduction',
  shortTitle: 'VFP-Intro',
  overlay: true,
};

/** Deepest history the window search scans (max_bars_back = 5000) */
const MAX_LOOKBACK = 5000;
/** calc_bars_count of the intrabar request of the ta library */
const INTRABAR_CALC_BARS = 200000;

/** Pine float comparisons within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => a - b >= -EPS;
const le = (a: number, b: number) => b - a >= -EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const na = (x: number) => !Number.isFinite(x);
const nz = (x: number) => (na(x) ? 0 : x);
/** Pine int(math.round(x)) */
const iround = (x: number) => Math.trunc(math.round(x) as number);

// ---------------------------------------------------------------- engines

/** The bars of the lower timeframe differ from the chart bars */
function lowerTimeframeRequested(ltf: string, chartTf: string): boolean {
  return ltf.trim() !== '' && timeframe.in_seconds(ltf) !== timeframe.in_seconds(chartTf);
}

/** Bars the indicator needs: the chart symbol on "Intrabar Timeframe" with the Intrabar engine (when it is lower). */
export function requiredSymbols(
  inputs: Partial<VolumeFootprintMeasuringByMathGeometryInputs> = {},
  chart?: ChartContext,
): SymbolRequest[] {
  const cfg = { ...defaultInputs, ...inputs };
  if (cfg.engine !== 'Intrabar') return [];
  const tf = chartTimeframe([], chart);
  if (tf === '' || !lowerTimeframeRequested(cfg.ltf, tf)) return [];
  return [{ symbol: tickeridOf(chart), timeframe: cfg.ltf }];
}

/**
 * requestUpAndDownVolume(ltf) of the ta library (version 14): request.security of the running up / down sums of the
 * intrabars (reset on the first intrabar of each chart bar, calc_bars_count = 200000). A chart bar shows the sums at
 * the last intrabar that closed by its close (na before the first calculated intrabar).
 */
function intrabarUpDown(bars: Bar[], ltf: string, chart?: ChartContext): { up: number[]; down: number[] } {
  const n = bars.length;
  const chartTf = chartTimeframe(bars, chart) || '1D';
  if (timeframe.in_seconds(ltf.trim() === '' ? chartTf : ltf) > timeframe.in_seconds(chartTf)) {
    throw new Error(`Invalid lower timeframe: '${ltf}'. The timeframe must be lower than or equal to '${chartTf}'`);
  }
  let ib: Bar[];
  let shown: number[];
  let owner: number[];
  if (lowerTimeframeRequested(ltf, chartTf)) {
    [ib] = symbolBarsOf([{ symbol: tickeridOf(chart), timeframe: ltf }], chart);
    const merge = otherSymbolChart(bars, chart);
    shown = securityOther(bars, ib, ltf, merge);
    const ranges = securityLowerTf(bars, ib, ltf, merge, { other: { timezone: chart?.timezone, session: chart?.session } });
    // timeframe.change(timeframe.main_period) on the intrabars: the chart bar of each intrabar (-1 - k: none)
    owner = ib.map((_, k) => -1 - k);
    ranges.forEach(([a, b], i) => { for (let k = a; k < b; k++) owner[k] = i; });
  } else {
    ib = bars;
    shown = bars.map((_, i) => i);
    owner = bars.map((_, i) => i);
  }
  const m = ib.length;
  const s0 = Math.max(0, m - INTRABAR_CALC_BARS);
  const pos = new Array<number>(m).fill(NaN);
  const neg = new Array<number>(m).fill(NaN);
  let posVol = 0;
  let negVol = 0;
  let isBuy = true;
  for (let k = s0; k < m; k++) {
    const { open, close } = ib[k];
    const prevClose = k > s0 ? ib[k - 1].close : NaN;
    if (k === s0) isBuy = ge(close, open); // var bool isBuyVolume = close >= open
    if (k > s0 && owner[k] !== owner[k - 1]) { posVol = 0; negVol = 0; }
    // priceCalc()
    if (gt(close, open)) isBuy = true;
    else if (lt(close, open)) isBuy = false;
    else if (gt(close, prevClose)) isBuy = true;
    else if (lt(close, prevClose)) isBuy = false;
    const vol = ib[k].volume ?? NaN;
    if (isBuy) posVol += vol;
    else negVol -= vol;
    pos[k] = posVol;
    neg[k] = negVol;
  }
  const up: number[] = [];
  const down: number[] = [];
  for (let i = 0; i < n; i++) {
    const k = shown[i];
    up.push(k >= s0 ? pos[k] : NaN);
    down.push(k >= s0 ? neg[k] : NaN);
  }
  return { up, down };
}

// ---------------------------------------------------------------- math

/** f_normCdf: Abramowitz-Stegun 26.2.17 */
function normCdf(z: number): number {
  const x = Math.abs(z);
  const t = 1.0 / (1.0 + 0.2316419 * x);
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const phi = 0.3989422804014327 * Math.exp(-0.5 * x * x);
  const cdf = ge(z, 0.0) ? 1.0 - phi * poly : phi * poly;
  return Math.max(0.0, Math.min(1.0, cdf));
}

/** f_profErfc: Cody's rational approximation of erfc */
function profErfc(x: number): number {
  const y = Math.abs(x);
  let res = 0.0;
  if (le(y, 0.46875)) {
    const z = gt(y, 1.11e-16) ? y * y : 0.0;
    let num = 1.85777706184603153e-1 * z;
    let den = z;
    num = (num + 3.16112374387056560e0) * z;
    den = (den + 2.36012909523441209e1) * z;
    num = (num + 1.13864154151050156e2) * z;
    den = (den + 2.44024637934444173e2) * z;
    num = (num + 3.77485237685302021e2) * z;
    den = (den + 1.28261652607737228e3) * z;
    res = 1.0 - x * (num + 3.20937758913846947e3) / (den + 2.84423683343917062e3);
  } else {
    let r = 0.0;
    if (le(y, 4.0)) {
      let num = 2.15311535474403846e-8 * y;
      let den = y;
      num = (num + 5.64188496988670089e-1) * y;
      den = (den + 1.57449261107098347e1) * y;
      num = (num + 8.88314979438837594e0) * y;
      den = (den + 1.17693950891312499e2) * y;
      num = (num + 6.61191906371416295e1) * y;
      den = (den + 5.37181101862009858e2) * y;
      num = (num + 2.98635138197400131e2) * y;
      den = (den + 1.62138957456669019e3) * y;
      num = (num + 8.81952221241769090e2) * y;
      den = (den + 3.29079923573345963e3) * y;
      num = (num + 1.71204761263407058e3) * y;
      den = (den + 4.36261909014324716e3) * y;
      num = (num + 2.05107837782607147e3) * y;
      den = (den + 3.43936767414372164e3) * y;
      r = (num + 1.23033935479799725e3) / (den + 1.23033935480374942e3);
    } else if (lt(y, 26.543)) {
      const z = 1.0 / (y * y);
      let num = 1.63153871373020978e-2 * z;
      let den = z;
      num = (num + 3.05326634961232344e-1) * z;
      den = (den + 2.56852019228982242e0) * z;
      num = (num + 3.60344899949804439e-1) * z;
      den = (den + 1.87295284992346047e0) * z;
      num = (num + 1.25781726111229246e-1) * z;
      den = (den + 5.27905102951428412e-1) * z;
      num = (num + 1.60837851487422766e-2) * z;
      den = (den + 6.05183413124413191e-2) * z;
      r = z * (num + 6.58749161529837803e-4) / (den + 2.33520497626869185e-3);
      r = (5.6418958354775628695e-1 - r) / y;
    }
    if ((ge(y, 4.0) && lt(y, 26.543)) || le(y, 4.0)) {
      const ysq = Math.floor(y * 16.0) / 16.0;
      const delt = (y - ysq) * (y + ysq);
      r = Math.exp(-ysq * ysq) * Math.exp(-delt) * r;
    }
    res = ge(x, 0.0) ? r : 2.0 - r;
  }
  return res;
}

const profNormCdf = (z: number) => 0.5 * profErfc(-z * 7.071067811865476e-1);
const profNormPdf = (z: number) => 3.989422804014327e-1 * Math.exp(-0.5 * z * z);

/** One truncated-normal component of a profile side */
interface ProfComp { mu: number; sigma: number; coef: number; priceLo: number; priceHi: number }

/** f_profDensity: volume intensity of one side at a price */
function profDensity(p: number, comps: ProfComp[]): number {
  let dens = 0.0;
  for (const comp of comps) {
    if (ge(p, comp.priceLo) && le(p, comp.priceHi)) dens += comp.coef * profNormPdf((p - comp.mu) / comp.sigma);
  }
  return dens;
}

/** f_profBandMass: volume of one side inside a price band */
function profBandMass(bandLo: number, bandHi: number, comps: ProfComp[]): number {
  let mass = 0.0;
  for (const comp of comps) {
    const segLo = Math.max(bandLo, comp.priceLo);
    const segHi = Math.min(bandHi, comp.priceHi);
    if (gt(segHi, segLo)) {
      const zAll = profNormCdf((comp.priceHi - comp.mu) / comp.sigma) - profNormCdf((comp.priceLo - comp.mu) / comp.sigma);
      if (gt(zAll, 0.0)) {
        const zSeg = profNormCdf((segHi - comp.mu) / comp.sigma) - profNormCdf((segLo - comp.mu) / comp.sigma);
        mass += comp.coef * comp.sigma * zSeg;
      }
    }
  }
  return mass;
}

interface FrameRows { bRows: number[]; sRows: number[]; bImb: boolean[]; sImb: boolean[] }

/**
 * f_gaussViewRows: buy / sell volume of one bar on the frame rows (index 0 at the frame bottom, na where the bar never
 * traded) and the diagonal imbalance flags. The off-frame sums and the lattice span of the original are not read by
 * any output: not computed.
 */
function gaussViewRows(
  bv: number, sv: number, h: number, l: number, c: number, axisTick: number, viewTicks: number, tick: number,
  bellDiv: number, imbPct: number,
): FrameRows {
  const nView = 2 * viewTicks + 1;
  const bRows = new Array<number>(nView).fill(NaN);
  const sRows = new Array<number>(nView).fill(NaN);
  const kMin = axisTick - viewTicks;
  const kMax = axisTick + viewTicks;
  const rng = h - l;
  if (!(na(bv) || na(sv) || na(h) || na(l) || na(c) || le(tick, 0.0))) {
    const tickLo = iround(l / tick);
    const tickHi = iround(h / tick);
    if (le(rng, 0.0)) {
      const flatRow = iround(c / tick);
      if (flatRow >= kMin && flatRow <= kMax) {
        bRows[flatRow - kMin] = bv;
        sRows[flatRow - kMin] = sv;
      }
    } else {
      const muB = l + (c - l) / 2.0;
      const muS = c + (h - c) / 2.0;
      const sigma = rng / bellDiv;
      const cdfBLow = normCdf((l - muB) / sigma);
      const cdfSLow = normCdf((l - muS) / sigma);
      const zB = normCdf((h - muB) / sigma) - cdfBLow;
      const zS = normCdf((h - muS) / sigma) - cdfSLow;
      const okB = gt(zB, 1e-12);
      const okS = gt(zS, 1e-12);
      const kStart = Math.max(tickLo, kMin);
      const kEnd = Math.min(tickHi, kMax);
      if (kStart <= kEnd) {
        const botStart = Math.max((kStart - 0.5) * tick, l);
        let prevB = normCdf((botStart - muB) / sigma);
        let prevS = normCdf((botStart - muS) / sigma);
        for (let k = kStart; k <= kEnd; k++) {
          const bandTop = Math.min((k + 0.5) * tick, h);
          const nextB = normCdf((bandTop - muB) / sigma);
          const nextS = normCdf((bandTop - muS) / sigma);
          bRows[k - kMin] = okB ? Math.max(0.0, (nextB - prevB) / zB) * bv : 0.0;
          sRows[k - kMin] = okS ? Math.max(0.0, (nextS - prevS) / zS) * sv : 0.0;
          prevB = nextB;
          prevS = nextS;
        }
      }
    }
  }
  const bImb = new Array<boolean>(nView).fill(false);
  const sImb = new Array<boolean>(nView).fill(false);
  const imbRatio = imbPct / 100.0;
  for (let k = 1; k <= nView - 1; k++) {
    const bCur = bRows[k];
    const sBel = sRows[k - 1];
    if (!na(bCur) && !na(sBel) && gt(bCur, 0.0) && gt(bCur, sBel * imbRatio)) bImb[k] = true;
  }
  for (let k = 0; k <= nView - 2; k++) {
    const sCur = sRows[k];
    const bAbv = bRows[k + 1];
    if (!na(sCur) && !na(bAbv) && gt(sCur, 0.0) && gt(sCur, bAbv * imbRatio)) sImb[k] = true;
  }
  return { bRows, sRows, bImb, sImb };
}

/** One bar of the frame window */
interface FpBar extends FrameRows { offset: number; buyTotal: number; sellTotal: number }

/** A price mark of the profile for the label renderer */
interface ChartMark { price: number; txt: string; fg: string; bg: string; prio: number; ln: Line | undefined }

/** Window POC / Value Area / first imbalances above and below the POC, on summed frame rows */
interface WindowLevels { pocK: number; vahK: number; valK: number; upK: number; upBuy: boolean; dnK: number; dnBuy: boolean }

function windowLevels(
  sumB: number[], sumS: number[], needPoc: boolean, vaOn: boolean, imbOn: boolean, vaPct: number, imbPct: number,
): WindowLevels {
  const nRows = sumB.length;
  let pocK = -1;
  if (needPoc) {
    let best = 0.0;
    for (let k = 0; k <= nRows - 1; k++) {
      const v = sumB[k] + sumS[k];
      if (gt(v, best)) { best = v; pocK = k; }
    }
  }
  let vahK = -1;
  let valK = -1;
  if (vaOn && pocK >= 0) {
    let total = 0.0;
    for (let k = 0; k <= nRows - 1; k++) total += sumB[k] + sumS[k];
    const target = vaPct / 100.0 * total;
    let acc = sumB[pocK] + sumS[pocK];
    let lo = pocK;
    let hi = pocK;
    while (lt(acc, target) && (lo > 0 || hi < nRows - 1)) {
      const canUp = hi < nRows - 1;
      const canDn = lo > 0;
      const volUp = canUp ? sumB[hi + 1] + sumS[hi + 1] : 0.0;
      const volDn = canDn ? sumB[lo - 1] + sumS[lo - 1] : 0.0;
      if (!canUp) { lo -= 1; acc += volDn; }
      else if (!canDn) { hi += 1; acc += volUp; }
      else if (ge(volUp, volDn)) { hi += 1; acc += volUp; }
      else { lo -= 1; acc += volDn; }
    }
    vahK = hi;
    valK = lo;
  }
  let upK = -1;
  let upBuy = false;
  let dnK = -1;
  let dnBuy = false;
  if (imbOn && pocK >= 0) {
    const bI = new Array<boolean>(nRows).fill(false);
    const sI = new Array<boolean>(nRows).fill(false);
    const ratio = imbPct / 100.0;
    for (let k = 1; k <= nRows - 1; k++) {
      if (gt(sumB[k], 0.0) && gt(sumB[k], sumS[k - 1] * ratio)) bI[k] = true;
    }
    for (let k = 0; k <= nRows - 2; k++) {
      if (gt(sumS[k], 0.0) && gt(sumS[k], sumB[k + 1] * ratio)) sI[k] = true;
    }
    if (pocK < nRows - 1) {
      for (let k = pocK + 1; k <= nRows - 1; k++) {
        if (bI[k] || sI[k]) { upK = k; upBuy = bI[k]; break; }
      }
    }
    if (pocK > 0) {
      for (let stp = 1; stp <= pocK; stp++) {
        const k = pocK - stp;
        if (bI[k] || sI[k]) { dnK = k; dnBuy = bI[k]; break; }
      }
    }
  }
  return { pocK, vahK, valK, upK, upBuy, dnK, dnBuy };
}

/** f_volCompact: one decimal and a K / M / B suffix */
function volCompact(v: number): string {
  let txt = '';
  if (!na(v)) {
    const a = Math.abs(v);
    if (ge(a, 1e9)) txt = str.tostring(v / 1e9, '#.#') + 'B';
    else if (ge(a, 1e6)) txt = str.tostring(v / 1e6, '#.#') + 'M';
    else if (ge(a, 1e3)) txt = str.tostring(v / 1e3, '#.#') + 'K';
    else txt = str.tostring(v, '#.#');
  }
  return txt;
}

const sameColor = (a: string, b: string) =>
  color.r(a) === color.r(b) && color.g(a) === color.g(b) && color.b(a) === color.b(b) && color.t(a) === color.t(b);

export function calculate(
  bars: Bar[],
  inputs: Partial<VolumeFootprintMeasuringByMathGeometryInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const window = cfg.window;
  const viewTicks = cfg.viewTicks;
  const tableSize = cfg.tableSize;
  const mobileSize = cfg.mobileSize;
  const tick = mintickOf(chart);
  const fmtVol = (v: number) => str.tostring(v, 'volume');
  const fmtTick = (v: number) => str.tostring(v, 'mintick', tick);

  // ---- theme colours (chart.fg_color #0f0f0f = light theme)
  const fgCol = foregroundColorOf(chart);
  const bgCol = backgroundColorOf(chart);
  const isLight = sameColor(fgCol, '#0f0f0f');
  const cn = (c: string, t: number) => String(color.new(c, t));
  const colBuyText = isLight ? '#0B57D0' : '#4FADFF';
  const colSellText = isLight ? '#C4001D' : '#FF5C78';
  const colAxisText = isLight ? '#8A6D00' : '#FFE08A';
  const colPanelBg = cn(bgCol, 15);
  const colHeadText = cn(fgCol, 25);
  const colMutedText = cn(fgCol, 45);
  const colGhostText = cn(fgCol, 82);
  const colAxisBg = cn(colAxisText, 80);
  const colHdrUpBg = cn(COL_FWD, isLight ? 90 : 82);
  const colHdrDnBg = cn(COL_REV, isLight ? 92 : 84);
  const colBandBg = cn(fgCol, isLight ? 95 : 94);
  const colFrame = cn(fgCol, 80);
  const colMetricText = isLight ? '#C2410C' : '#FF8A3D';
  const colMetricBg = cn(colMetricText, 84);
  const colVaText = isLight ? '#6D28D9' : '#B39DFF';
  const colVaBg = cn(colVaText, 84);
  const colVaBand = cn(colVaText, isLight ? 94 : 92);
  const colImbBuyBg = cn(colBuyText, 84);
  const colImbSellBg = cn(colSellText, 84);
  const colImbBuyCell = cn(colBuyText, isLight ? 55 : 50);
  const colImbSellCell = cn(colSellText, isLight ? 55 : 50);
  const buyBgSteps = [94, 88, 81, 74, 66].map((t) => cn(colBuyText, t));
  const sellBgSteps = [94, 88, 81, 74, 66].map((t) => cn(colSellText, t));
  const colProfBuyBg = cn(cfg.profBuyCol, 100 - cfg.profFill);
  const colProfSellBg = cn(cfg.profSellCol, 100 - cfg.profFill);
  const profLineStyle = cfg.profLineStyle === 'Solid' ? 'solid' : cfg.profLineStyle === 'Dotted' ? 'dotted' : 'dashed';
  const yPos = cfg.tableYpos === 'Top' ? 'top' : cfg.tableYpos === 'Middle' ? 'middle' : 'bottom';
  const xPos = cfg.tableXpos === 'Left' ? 'left' : cfg.tableXpos === 'Center' ? 'center' : 'right';
  const tablePosition = `${yPos}_${xPos}` as Table['position'];
  /** f_cellBg: tint of a cell from a five-step ladder scaled by the largest cell */
  const cellBg = (vol: number, maxVol: number, steps: string[]): string | undefined =>
    !na(vol) && gt(vol, 0.0) && gt(maxVol, 0.0) ? steps[Math.min(Math.trunc(Math.floor(5.0 * vol / maxVol)), 4)] : undefined;

  // ---- engine: every bar
  const useFp = cfg.engine === 'Footprint (Premium/Ultimate)';
  const useIb = cfg.engine === 'Intrabar';
  if (useFp && n > 0) {
    throw new Error('The Footprint engine reads the volume footprint of the platform (request.footprint), which is not available here: choose the Geometric or the Intrabar engine.');
  }
  const close = bars.map((b) => b.close);
  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);
  const open = bars.map((b) => b.open);
  const volume = bars.map((b) => b.volume ?? NaN);
  let engBuy: number[];
  let engSell: number[];
  if (useIb && n > 0) {
    const ud = intrabarUpDown(bars, cfg.ltf, chart);
    engBuy = ud.up;
    engSell = ud.down.map((v) => Math.abs(v));
  } else {
    engBuy = [];
    engSell = [];
    for (let i = 0; i < n; i++) {
      const barRange = high[i] - low[i];
      const geoShare = gt(barRange, 0.0) ? (close[i] - low[i]) / barRange : 0.5;
      engBuy.push(volume[i] * geoShare);
      engSell.push(volume[i] * (1.0 - geoShare));
    }
  }
  const engTotal = engBuy.map((b, i) => b + engSell[i]);
  const buyShare = engTotal.map((t, i) => (gt(t, 0.0) ? engBuy[i] / t : NaN));
  const sellShare = buyShare.map((s) => 1.0 - s);

  resetDrawings();
  const fpBars: FpBar[] = [];
  let axisRowTick = NaN;
  let ibCovBars = NaN;
  let pocDashLevel = NaN;
  let pocChartLevel = NaN;
  let pocChartSell = NaN;
  let pocChartBuy = NaN;
  let profOvl = NaN;
  let profResidual = NaN;
  let profTilt = NaN;
  const nViewRows = 2 * viewTicks + 1;
  const TEXT_BLACK = '#363A45';

  // tables of barstate.isfirst
  const fpTable = n > 0 && !cfg.mobileMode
    ? table.new(tablePosition, 4 + 2 * window, nViewRows + 4, colPanelBg, colFrame, 1, colFrame, 1) : undefined;
  const mobTable = n > 0 && cfg.mobileMode
    ? table.new(tablePosition, 2, 13, colPanelBg, colFrame, 1, colFrame, 1) : undefined;

  if (n > 0) {
    const li = n - 1;
    setDrawingBar(li, true, li);
    const h = (k: number) => (li - k >= 0 ? high[li - k] : NaN);
    const l = (k: number) => (li - k >= 0 ? low[li - k] : NaN);
    const c = (k: number) => (li - k >= 0 ? close[li - k] : NaN);
    const eb = (k: number) => (li - k >= 0 ? engBuy[li - k] : NaN);
    const es = (k: number) => (li - k >= 0 ? engSell[li - k] : NaN);

    // ---- engine: last bar (window search)
    const axisTick = iround(close[li] / tick);
    axisRowTick = axisTick;
    let found = 0;
    const lastIdx = Math.min(MAX_LOOKBACK - 1, li);
    for (let i = 0; i <= lastIdx; i++) {
      if (found >= window) break;
      const hasBar = !na(c(i)) && !na(h(i)) && !na(l(i));
      const hasVol = hasBar && !na(eb(i)) && !na(es(i));
      const barVol = hasVol ? eb(i) + es(i) : NaN;
      let inFrame = false;
      if (hasVol && gt(barVol, 0.0)) {
        const barLoT = iround(l(i) / tick);
        const barHiT = iround(h(i) / tick);
        inFrame = barLoT <= axisTick + viewTicks && barHiT >= axisTick - viewTicks;
      }
      if (inFrame) {
        const rows = gaussViewRows(eb(i), es(i), h(i), l(i), c(i), axisTick, viewTicks, tick, cfg.bellDiv, cfg.imbPct);
        let hasFrameData = false;
        for (let k = 0; k <= 2 * viewTicks; k++) {
          if (!na(rows.bRows[k]) || !na(rows.sRows[k])) { hasFrameData = true; break; }
        }
        if (hasFrameData) {
          found += 1;
          fpBars.push({ offset: i, buyTotal: eb(i), sellTotal: es(i), ...rows });
        }
      }
    }
    if (useIb) {
      let covBars = 0;
      for (let i = 0; i <= lastIdx; i++) {
        if (na(eb(i))) break;
        covBars += 1;
      }
      ibCovBars = covBars;
    }
    // dashboard control level
    if (fpBars.length > 0) {
      const ctlRowSum = new Array<number>(nViewRows).fill(0.0);
      for (const fp of fpBars) {
        for (let k = 0; k <= nViewRows - 1; k++) ctlRowSum[k] = ctlRowSum[k] + nz(fp.bRows[k]) + nz(fp.sRows[k]);
      }
      let ctlBest = 0.0;
      let ctlRowK = -1;
      for (let k = 0; k <= nViewRows - 1; k++) {
        if (gt(ctlRowSum[k], ctlBest)) { ctlBest = ctlRowSum[k]; ctlRowK = k; }
      }
      if (ctlRowK >= 0) pocDashLevel = (axisTick - viewTicks + ctlRowK) * tick;
    }

    const lastVolume = volume[li];
    const pocDashOn = cfg.pocScope === 'Dashboard' || cfg.pocScope === 'Dashboard and Chart';
    const vaDashOn = cfg.vaScope === 'Dashboard' || cfg.vaScope === 'Dashboard and Chart';
    const nowBuy = engBuy[li];
    const nowSell = engSell[li];
    const nowTot = nowBuy + nowSell;
    const prevCls = c(1);
    const chgPct = !na(prevCls) && !eq(prevCls, 0.0) ? 100.0 * (close[li] - prevCls) / prevCls : NaN;

    // ---- footprint table
    if (fpTable && !na(lastVolume) && cfg.showTable && !cfg.mobileMode) {
      const w = fpBars.length;
      table.clear(fpTable, 0, 2, 2 * window + 3, nViewRows + 1);
      let maxCell = 0.0;
      let winBuy = 0.0;
      let winSell = 0.0;
      const rowSumB = new Array<number>(nViewRows).fill(0.0);
      const rowSumS = new Array<number>(nViewRows).fill(0.0);
      for (const fp of fpBars) {
        winBuy += fp.buyTotal;
        winSell += fp.sellTotal;
        for (let k = 0; k <= nViewRows - 1; k++) {
          const bCell = nz(fp.bRows[k]);
          const sCell = nz(fp.sRows[k]);
          maxCell = Math.max(maxCell, Math.max(bCell, sCell));
          rowSumB[k] = rowSumB[k] + bCell;
          rowSumS[k] = rowSumS[k] + sCell;
        }
      }
      let maxRowSum = 0.0;
      for (let k = 0; k <= nViewRows - 1; k++) maxRowSum = Math.max(maxRowSum, Math.max(rowSumB[k], rowSumS[k]));
      const lv = windowLevels(rowSumB, rowSumS, pocDashOn || vaDashOn || cfg.imbShow, vaDashOn, cfg.imbShow, cfg.vaPct, cfg.imbPct);
      const pocRowK = lv.pocK;
      const metCol = 2 * window;
      const priceCol = 2 * window + 1;
      const sumL = 2 * window + 2;
      const chgTxt = na(chgPct) ? '' : '  ' + (ge(chgPct, 0.0) ? '+' : '') + str.tostring(chgPct, '#.##') + '%';
      const buyLeads = ge(nowBuy, nowSell);
      const leadPct = gt(nowTot, 0.0) ? 100.0 * Math.abs(nowBuy - nowSell) / nowTot : NaN;
      const leadTxt = na(leadPct) ? '' : '  ·  ' + (buyLeads ? '▲ BUY +' : '▼ SELL +') + str.tostring(leadPct, '#.#') + '%';
      const volTxt = (gt(nowSell, 0.0) ? '  ·  ▼-' + fmtVol(nowSell) : '') + (gt(nowBuy, 0.0) ? '  ·  ▲+' + fmtVol(nowBuy) : '');
      const engTxt = useFp ? 'FOOTPRINT' : useIb ? 'INTRABAR ' + cfg.ltf : 'GEOMETRIC';
      const covTxt = na(ibCovBars) ? '' : '  ·  DATA ' + str.tostring(ibCovBars) + ' BARS';
      const volTot = na(nowTot) ? '  ·  NO ENGINE DATA' : '  ·  VOL ' + fmtVol(nowTot);
      const statTxt = '$' + tickerOf(chart) + '  ·  ' + engTxt + '  ·  ' + fmtTick(close[li]) + chgTxt + volTot + volTxt + leadTxt + covTxt;
      const statBg = na(chgPct) ? colPanelBg : ge(chgPct, 0.0) ? cn(COL_FWD, 15) : cn(COL_REV, 15);
      table.cell(fpTable, 0, 0, statTxt, undefined, undefined, '#FFFFFF', 'center', undefined, tableSize, statBg, TT_C_STAT);
      table.cell(fpTable, metCol, 1, 'Metrics', undefined, undefined, colMutedText, 'center', undefined, tableSize, colBandBg, TT_METRICS);
      table.cell(fpTable, sumL, 1, 'Sum', undefined, undefined, colMutedText, 'center', undefined, tableSize, colBandBg, TT_C_SUM);
      const winTot = winBuy + winSell;
      const winDlt = winBuy - winSell;
      table.cell(fpTable, sumL, nViewRows + 2, fmtVol(winTot), undefined, undefined, colHeadText, 'center', undefined, tableSize, colBandBg, TT_C_TOT);
      table.cell(fpTable, sumL, nViewRows + 3, (ge(winDlt, 0.0) ? '+' : '-') + fmtVol(Math.abs(winDlt)), undefined, undefined,
        ge(winDlt, 0.0) ? colBuyText : colSellText, 'center', undefined, tableSize, colBandBg, TT_C_DELTA);
      table.cell(fpTable, priceCol, 1, 'Price', undefined, undefined, colMutedText, 'center', undefined, tableSize, colBandBg, TT_C_PRICE);
      table.cell(fpTable, priceCol, nViewRows + 2, 'Total', undefined, undefined, colMutedText, 'center', undefined, tableSize, colBandBg, TT_C_TOT);
      table.cell(fpTable, priceCol, nViewRows + 3, 'Delta', undefined, undefined, colMutedText, 'center', undefined, tableSize, colBandBg, TT_C_DELTA);
      const pctTxt = str.tostring(cfg.vaPct, '#');
      for (let k = 0; k <= nViewRows - 1; k++) {
        const rowIdx = 2 + (nViewRows - 1 - k);
        const rowTick = axisRowTick - viewTicks + k;
        const isAxis = rowTick === axisRowTick;
        table.cell(fpTable, priceCol, rowIdx, (isAxis ? '◀ ' : '') + fmtTick(rowTick * tick), undefined, undefined,
          isAxis ? colAxisText : colMutedText, 'center', undefined, tableSize, isAxis ? colAxisBg : undefined, isAxis ? TT_C_AXIS : '');
        if (pocDashOn && k === pocRowK) {
          const pocS = rowSumS[k];
          const pocB = rowSumB[k];
          const pocFg = gt(pocB, pocS) ? colBuyText : gt(pocS, pocB) ? colSellText : colMetricText;
          const pocBg = gt(pocB, pocS) ? colImbBuyBg : gt(pocS, pocB) ? colImbSellBg : colMetricBg;
          table.cell(fpTable, metCol, rowIdx, '●  POC', undefined, undefined, pocFg, 'center', undefined, tableSize, pocBg,
            TT_C_POC + 'Sell ' + fmtVol(pocS) + '   ·   Buy ' + fmtVol(pocB) + '   ·   Total ' + fmtVol(pocS + pocB));
        } else if (vaDashOn && k === lv.vahK) {
          const vahS = rowSumS[k];
          const vahB = rowSumB[k];
          table.cell(fpTable, metCol, rowIdx, '▲ VAH', undefined, undefined, colVaText, 'center', undefined, tableSize, colVaBg,
            'Value Area High: the upper edge of the price band holding ' + pctTxt + "% of the window's traded volume.\nSell " + fmtVol(vahS) + '   ·   Buy ' + fmtVol(vahB) + '   ·   Total ' + fmtVol(vahS + vahB));
        } else if (vaDashOn && k === lv.valK) {
          const valS = rowSumS[k];
          const valB = rowSumB[k];
          table.cell(fpTable, metCol, rowIdx, '▼ VAL', undefined, undefined, colVaText, 'center', undefined, tableSize, colVaBg,
            'Value Area Low: the lower edge of the price band holding ' + pctTxt + "% of the window's traded volume.\nSell " + fmtVol(valS) + '   ·   Buy ' + fmtVol(valB) + '   ·   Total ' + fmtVol(valS + valB));
        } else if (cfg.imbShow && ((k === lv.upK && lv.upBuy) || (k === lv.dnK && lv.dnBuy))) {
          table.cell(fpTable, metCol, rowIdx, '▲ IMB', undefined, undefined, colBuyText, 'center', undefined, tableSize, colImbBuyBg,
            'Window buy imbalance: over the whole window, the buy volume of this level exceeds the sell volume one level below by the threshold. One side overwhelmed the other here.');
        } else if (cfg.imbShow && ((k === lv.upK && !lv.upBuy) || (k === lv.dnK && !lv.dnBuy))) {
          table.cell(fpTable, metCol, rowIdx, '▼ IMB', undefined, undefined, colSellText, 'center', undefined, tableSize, colImbSellBg,
            'Window sell imbalance: over the whole window, the sell volume of this level exceeds the buy volume one level above by the threshold. One side overwhelmed the other here.');
        } else if (vaDashOn && k > lv.valK && k < lv.vahK && k !== pocRowK) {
          table.cell(fpTable, metCol, rowIdx, '', undefined, undefined, TEXT_BLACK, undefined, undefined, 'auto', colVaBand);
        }
        const sumS2 = rowSumS[k];
        const sumB2 = rowSumB[k];
        const sSumTxt = gt(sumS2, 0.0) ? '-' + fmtVol(sumS2) : '';
        const bSumTxt = gt(sumB2, 0.0) ? '+' + fmtVol(sumB2) : '';
        const sSumOut = sSumTxt !== '' ? sSumTxt : bSumTxt !== '' ? 'x'.repeat(bSumTxt.length) : '';
        const bSumOut = bSumTxt !== '' ? bSumTxt : sSumTxt !== '' ? 'x'.repeat(sSumTxt.length) : '';
        table.cell(fpTable, sumL, rowIdx, sSumOut, undefined, undefined, sSumTxt !== '' ? colSellText : colGhostText, 'right', undefined,
          tableSize, isAxis ? colAxisBg : cellBg(sumS2, maxRowSum, sellBgSteps), TT_C_SUM);
        table.cell(fpTable, sumL + 1, rowIdx, bSumOut, undefined, undefined, bSumTxt !== '' ? colBuyText : colGhostText, 'left', undefined,
          tableSize, isAxis ? colAxisBg : cellBg(sumB2, maxRowSum, buyBgSteps), TT_C_SUM);
      }
      fpBars.forEach((fp, i) => {
        const cL = 2 * (window - 1 - i);
        const barUp = ge(c(fp.offset), open[li - fp.offset]);
        table.cell(fpTable, cL, 1, str.tostring(fp.offset === 0 ? 0 : -fp.offset), undefined, undefined, barUp ? colBuyText : colSellText,
          'center', undefined, tableSize, barUp ? colHdrUpBg : colHdrDnBg, TT_C_HDR);
        for (let k = 0; k <= nViewRows - 1; k++) {
          const rowIdx = 2 + (nViewRows - 1 - k);
          const sv = fp.sRows[k];
          const bv = fp.bRows[k];
          const axisRow = k === viewTicks;
          const imbRowSel = k === lv.upK || k === lv.dnK;
          const sImbCell = cfg.imbShow && imbRowSel && fp.sImb[k];
          const bImbCell = cfg.imbShow && imbRowSel && fp.bImb[k];
          const sTxt = !na(sv) && gt(sv, 0.0) ? (sImbCell ? '▼ ' : '') + '-' + fmtVol(sv) : '';
          const bTxt = !na(bv) && gt(bv, 0.0) ? '+' + fmtVol(bv) + (bImbCell ? ' ▲' : '') : '';
          const sOut = sTxt !== '' ? sTxt : bTxt !== '' ? 'x'.repeat(bTxt.length) : '';
          const bOut = bTxt !== '' ? bTxt : sTxt !== '' ? 'x'.repeat(sTxt.length) : '';
          table.cell(fpTable, cL, rowIdx, sOut, undefined, undefined, sTxt !== '' ? colSellText : colGhostText, 'right', undefined, tableSize,
            axisRow ? colAxisBg : sImbCell ? colImbSellCell : cellBg(sv, maxCell, sellBgSteps), TT_C_DATA);
          table.cell(fpTable, cL + 1, rowIdx, bOut, undefined, undefined, bTxt !== '' ? colBuyText : colGhostText, 'left', undefined, tableSize,
            axisRow ? colAxisBg : bImbCell ? colImbBuyCell : cellBg(bv, maxCell, buyBgSteps), TT_C_DATA);
        }
        const tot = fp.buyTotal + fp.sellTotal;
        const dlt = fp.buyTotal - fp.sellTotal;
        table.cell(fpTable, cL, nViewRows + 2, fmtVol(tot), undefined, undefined, colHeadText, 'center', undefined, tableSize, colBandBg, TT_C_TOT);
        table.cell(fpTable, cL, nViewRows + 3, (ge(dlt, 0.0) ? '+' : '-') + fmtVol(Math.abs(dlt)), undefined, undefined,
          ge(dlt, 0.0) ? colBuyText : colSellText, 'center', undefined, tableSize, colBandBg, TT_C_DELTA);
      });
      if (w < window) {
        for (let i = w; i <= window - 1; i++) {
          const cE = 2 * (window - 1 - i);
          table.cell(fpTable, cE, 1, '', undefined, undefined, TEXT_BLACK, undefined, undefined, 'auto');
          table.cell(fpTable, cE, nViewRows + 2, '', undefined, undefined, TEXT_BLACK, undefined, undefined, 'auto', colBandBg);
          table.cell(fpTable, cE, nViewRows + 3, '', undefined, undefined, TEXT_BLACK, undefined, undefined, 'auto', colBandBg);
        }
      }
      table.merge_cells(fpTable, 0, 0, 2 * window + 3, 0);
      for (let i = 0; i <= window - 1; i++) {
        const cM = 2 * i;
        table.merge_cells(fpTable, cM, 1, cM + 1, 1);
        table.merge_cells(fpTable, cM, nViewRows + 2, cM + 1, nViewRows + 2);
        table.merge_cells(fpTable, cM, nViewRows + 3, cM + 1, nViewRows + 3);
      }
      table.merge_cells(fpTable, sumL, 1, sumL + 1, 1);
      table.merge_cells(fpTable, sumL, nViewRows + 2, sumL + 1, nViewRows + 2);
      table.merge_cells(fpTable, sumL, nViewRows + 3, sumL + 1, nViewRows + 3);
    }

    // ---- warning panel for symbols without volume
    if (na(lastVolume)) {
      const warnTable = table.new('top_center', 1, 1, cn('#B71C1C', 15));
      table.cell(warnTable, 0, 0, 'This symbol publishes no volume data.\nThe footprint engine has nothing to split.', undefined, undefined,
        cn('#FFCDD2', 0), undefined, undefined, 12);
    }

    // ---- volume profile
    const profBuyPl = varDrawing<Polyline>();
    const profSellPl = varDrawing<Polyline>();
    const profLoLn = varDrawing<Line>();
    const profHiLn = varDrawing<Line>();
    const profPocLn = varDrawing<Line>();
    const profVahLn = varDrawing<Line>();
    const profValLn = varDrawing<Line>();
    const profOvlLb = varDrawing<Label>();
    const profResLb = varDrawing<Label>();
    const profImbLns: Line[] = [];
    const chartMarks: ChartMark[] = [];
    const profMrgLbs: Label[] = [];
    if (!na(lastVolume)) {
      const pc = cfg.profPeriod;
      const compsB: ProfComp[] = [];
      const compsS: ProfComp[] = [];
      const atomPrices: number[] = [];
      const atomBuys: number[] = [];
      const atomSells: number[] = [];
      let sumB = 0.0;
      let sumS = 0.0;
      let atomB = 0.0;
      let atomS = 0.0;
      let profLo = NaN;
      let profHi = NaN;
      let profDataBars = 0;
      for (let i = 0; i <= pc - 1; i++) {
        const barH = h(i);
        const barL = l(i);
        const barC = c(i);
        const bv = eb(i);
        const sv = es(i);
        if (!(na(barH) || na(barL) || na(barC) || na(bv) || na(sv))) {
          profDataBars += 1;
          profLo = na(profLo) ? barL : Math.min(profLo, barL);
          profHi = na(profHi) ? barH : Math.max(profHi, barH);
          sumB += bv;
          sumS += sv;
          const rng = barH - barL;
          if (le(rng, 0.0)) {
            atomPrices.push(barC);
            atomBuys.push(bv);
            atomSells.push(sv);
            atomB += bv;
            atomS += sv;
          } else {
            const sg = rng / cfg.bellDiv;
            const muB = barL + (barC - barL) / 2.0;
            const muS = barC + (barH - barC) / 2.0;
            const zB = profNormCdf((barH - muB) / sg) - profNormCdf((barL - muB) / sg);
            const zS = profNormCdf((barH - muS) / sg) - profNormCdf((barL - muS) / sg);
            if (gt(bv, 0.0) && gt(zB, 0.0)) compsB.push({ mu: muB, sigma: sg, coef: bv / (sg * zB), priceLo: barL, priceHi: barH });
            if (gt(sv, 0.0) && gt(zS, 0.0)) compsS.push({ mu: muS, sigma: sg, coef: sv / (sg * zS), priceLo: barL, priceHi: barH });
          }
        }
      }
      if (!na(profLo) && gt(sumB + sumS, 0.0)) {
        const bps: number[] = [profLo, profHi];
        for (const comp of compsB) bps.push(comp.priceLo, comp.priceHi);
        for (const comp of compsS) bps.push(comp.priceLo, comp.priceHi);
        bps.sort((a, b) => a - b);
        const cutsAll: number[] = [];
        let prevBp = NaN;
        for (const bpv of bps) {
          if (na(prevBp) || !eq(bpv, prevBp)) cutsAll.push(bpv);
          prevBp = bpv;
        }
        let intB = 0.0;
        let intS = 0.0;
        let intMin = 0.0;
        const nPieces = cutsAll.length - 1;
        if (nPieces >= 1) {
          for (let seg = 0; seg <= nPieces - 1; seg++) {
            const segLo = cutsAll[seg];
            const segHi = cutsAll[seg + 1];
            const segMid = 0.5 * (segLo + segHi);
            const actB: ProfComp[] = [];
            const actS: ProfComp[] = [];
            let sgMin = NaN;
            for (const comp of compsB) {
              if (le(comp.priceLo, segMid) && le(segMid, comp.priceHi)) {
                actB.push(comp);
                sgMin = na(sgMin) ? comp.sigma : Math.min(sgMin, comp.sigma);
              }
            }
            for (const comp of compsS) {
              if (le(comp.priceLo, segMid) && le(segMid, comp.priceHi)) {
                actS.push(comp);
                sgMin = na(sgMin) ? comp.sigma : Math.min(sgMin, comp.sigma);
              }
            }
            if (!na(sgMin) && gt(segHi, segLo)) {
              let nSub = Math.max(12, Math.trunc(Math.ceil(16.0 * (segHi - segLo) / sgMin)));
              nSub += nSub % 2;
              const hStep = (segHi - segLo) / nSub;
              let accB = profDensity(segLo, actB) + profDensity(segHi, actB);
              let accS = profDensity(segLo, actS) + profDensity(segHi, actS);
              for (let k = 1; k <= nSub - 1; k++) {
                const xk = segLo + k * hStep;
                const wgt = k % 2 === 1 ? 4.0 : 2.0;
                accB += wgt * profDensity(xk, actB);
                accS += wgt * profDensity(xk, actS);
              }
              intB += accB * hStep / 3.0;
              intS += accS * hStep / 3.0;
              if (gt(sumB, 0.0) && gt(sumS, 0.0)) {
                const diff = (x: number) => profDensity(x, actB) / sumB - profDensity(x, actS) / sumS;
                const subCuts: number[] = [segLo];
                const scanN = 12;
                let dPrev = diff(segLo);
                for (let j = 1; j <= scanN; j++) {
                  const xj = segLo + (segHi - segLo) * j / scanN;
                  const dCur = diff(xj);
                  if (lt(dPrev * dCur, 0.0)) {
                    let rLo = segLo + (segHi - segLo) * (j - 1) / scanN;
                    let rHi = xj;
                    let iter = 0;
                    while (gt(rHi - rLo, Math.abs(0.5 * (rLo + rHi)) * 2.3e-16) && iter < 90) {
                      const rMid = 0.5 * (rLo + rHi);
                      const dLo2 = diff(rLo);
                      const dMid = diff(rMid);
                      if (le(dLo2 * dMid, 0.0)) rHi = rMid;
                      else rLo = rMid;
                      iter += 1;
                    }
                    subCuts.push(0.5 * (rLo + rHi));
                  }
                  dPrev = dCur;
                }
                subCuts.push(segHi);
                for (let j = 0; j <= subCuts.length - 2; j++) {
                  const subLo = subCuts[j];
                  const subHi = subCuts[j + 1];
                  if (gt(subHi, subLo)) {
                    const subMid = 0.5 * (subLo + subHi);
                    const useBuy = le(profDensity(subMid, actB) / sumB, profDensity(subMid, actS) / sumS);
                    let n2 = Math.max(12, Math.trunc(Math.ceil(16.0 * (subHi - subLo) / sgMin)));
                    n2 += n2 % 2;
                    const h2 = (subHi - subLo) / n2;
                    let accM = useBuy
                      ? profDensity(subLo, actB) / sumB + profDensity(subHi, actB) / sumB
                      : profDensity(subLo, actS) / sumS + profDensity(subHi, actS) / sumS;
                    for (let k = 1; k <= n2 - 1; k++) {
                      const xk2 = subLo + k * h2;
                      const wgt2 = k % 2 === 1 ? 4.0 : 2.0;
                      accM += useBuy ? wgt2 * profDensity(xk2, actB) / sumB : wgt2 * profDensity(xk2, actS) / sumS;
                    }
                    intMin += accM * h2 / 3.0;
                  }
                }
              }
            }
          }
        }
        // atomic overlap
        let atomTerm = 0.0;
        const nAtoms = atomPrices.length;
        if (nAtoms > 0 && gt(sumB, 0.0) && gt(sumS, 0.0)) {
          const atomUsed = new Array<boolean>(nAtoms).fill(false);
          for (let a1 = 0; a1 <= nAtoms - 1; a1++) {
            if (!atomUsed[a1]) {
              let pMassB = 0.0;
              let pMassS = 0.0;
              for (let a2 = a1; a2 <= nAtoms - 1; a2++) {
                if (!atomUsed[a2] && eq(atomPrices[a2], atomPrices[a1])) {
                  atomUsed[a2] = true;
                  pMassB += atomBuys[a2];
                  pMassS += atomSells[a2];
                }
              }
              atomTerm += Math.min(pMassB / sumB, pMassS / sumS);
            }
          }
        }
        const residB = gt(sumB, 0.0) ? Math.abs((intB + atomB) / sumB - 1.0) : 0.0;
        const residS = gt(sumS, 0.0) ? Math.abs((intS + atomS) / sumS - 1.0) : 0.0;
        profResidual = (residB + residS) * 1000000.0;
        profOvl = gt(sumB, 0.0) && gt(sumS, 0.0) ? 100.0 * (intMin + atomTerm) : NaN;
        profTilt = gt(sumB + sumS, 0.0) ? 100.0 * (sumB - sumS) / (sumB + sumS) : NaN;

        const span = profHi - profLo;
        const frameL = li - (pc - 1);
        const rightX = li + 1 + cfg.profWidth + cfg.pocOffset;
        if (cfg.profShow && gt(span, 0.0)) {
          const frameR = li + 1 + cfg.profWidth;
          profLoLn.value = line.new(frameL, profLo, frameR, profLo, 'bar_index', 'none', cfg.profLineCol, profLineStyle, cfg.profLineWidth);
          if (!na(profResidual)) {
            const resOk = le(profResidual, cfg.resTol);
            profResLb.value = label.new(li + 1, profLo, 'RES  ' + str.tostring(profResidual, '0.0000') + ' PPM   ·   ' + (resOk ? 'EXACT' : 'DRIFT'),
              'bar_index', 'price', resOk ? colMetricBg : colImbSellBg, 'label_up', resOk ? colMetricText : colSellText, tableSize, undefined, TT_C_RES);
          }
          profHiLn.value = line.new(frameL, profHi, frameR, profHi, 'bar_index', 'none', cfg.profLineCol, profLineStyle, cfg.profLineWidth);
          if (!na(profOvl)) {
            const ovlCoef = profOvl / 100.0;
            const ovlBal = ge(ovlCoef, 0.75);
            const tiltBuy = !na(profTilt) && ge(profTilt, cfg.ovlTilt);
            const tiltSell = !na(profTilt) && le(profTilt, -cfg.ovlTilt);
            const ovlWord = ovlBal ? 'BALANCED' : tiltBuy ? 'OFF BALANCE TO BUY' : tiltSell ? 'OFF BALANCE TO SELL' : 'OFF BALANCE';
            const ovlFg = ovlBal ? colMetricText : tiltBuy ? colBuyText : tiltSell ? colSellText : colMetricText;
            const ovlBg = ovlBal ? colMetricBg : tiltBuy ? colImbBuyBg : tiltSell ? colImbSellBg : colMetricBg;
            const covNote = profDataBars < pc ? '   ·   BARS ' + str.tostring(profDataBars) + ' / ' + str.tostring(pc) : '';
            profOvlLb.value = label.new(li + 1, profHi, 'OVL  ' + str.tostring(ovlCoef, '0.00') + '   ·   ' + ovlWord + covNote,
              'bar_index', 'price', ovlBg, 'label_down', ovlFg, tableSize, undefined, TT_C_OVL);
          }
        }
        if (cfg.profShow && gt(span, 0.0) && (cfg.profBuy || cfg.profSell)) {
          const res = cfg.profRes;
          const buyVals = new Array<number>(res + 1).fill(0.0);
          const sellVals = new Array<number>(res + 1).fill(0.0);
          const pxStep = span / res;
          let vMax = 0.0;
          const pocChartOn = cfg.pocScope === 'Chart' || cfg.pocScope === 'Dashboard and Chart';
          const vaChartOn = cfg.vaScope === 'Chart' || cfg.vaScope === 'Dashboard and Chart';
          let pocTot = -1.0;
          let pocPrice = NaN;
          for (let k = 0; k <= res; k++) {
            const pk = profLo + k * pxStep;
            const vb2 = profDensity(pk, compsB);
            const vs2 = profDensity(pk, compsS);
            buyVals[k] = vb2;
            sellVals[k] = vs2;
            if (cfg.profBuy) vMax = Math.max(vMax, vb2);
            if (cfg.profSell) vMax = Math.max(vMax, vs2);
            if ((pocChartOn || vaChartOn || cfg.imbShow) && gt(vb2 + vs2, pocTot)) {
              pocTot = vb2 + vs2;
              pocPrice = pk;
            }
          }
          if (pocChartOn && !na(pocPrice)) {
            pocChartLevel = pocPrice;
            const pocBLo = pocPrice - tick / 2.0;
            const pocBHi = pocPrice + tick / 2.0;
            const pocSell = profBandMass(pocBLo, pocBHi, compsS);
            const pocBuy = profBandMass(pocBLo, pocBHi, compsB);
            pocChartSell = pocSell;
            pocChartBuy = pocBuy;
            const pocFg = gt(pocBuy, pocSell) ? colBuyText : gt(pocSell, pocBuy) ? colSellText : colMetricText;
            const pocBg = gt(pocBuy, pocSell) ? colImbBuyBg : gt(pocSell, pocBuy) ? colImbSellBg : colMetricBg;
            profPocLn.value = line.new(frameL, pocPrice, rightX, pocPrice, 'bar_index', 'none', pocFg, 'solid', 2);
            chartMarks.push({
              price: pocPrice,
              txt: 'POC  ' + fmtTick(pocPrice) + '   ▼-' + fmtVol(pocSell) + '   ▲+' + fmtVol(pocBuy),
              fg: pocFg, bg: pocBg, prio: 3, ln: profPocLn.value,
            });
          }
          if (vaChartOn && !na(pocPrice) && res > 0) {
            let cPocIdx = iround((pocPrice - profLo) / pxStep);
            cPocIdx = Math.max(0, Math.min(res, cPocIdx));
            let cvTotal = 0.0;
            for (let k = 0; k <= res; k++) cvTotal += buyVals[k] + sellVals[k];
            const cvTarget = cfg.vaPct / 100.0 * cvTotal;
            let cvAcc = buyVals[cPocIdx] + sellVals[cPocIdx];
            let cvLo = cPocIdx;
            let cvHi = cPocIdx;
            while (lt(cvAcc, cvTarget) && (cvLo > 0 || cvHi < res)) {
              const canUp = cvHi < res;
              const canDn = cvLo > 0;
              const vUp = canUp ? buyVals[cvHi + 1] + sellVals[cvHi + 1] : 0.0;
              const vDn = canDn ? buyVals[cvLo - 1] + sellVals[cvLo - 1] : 0.0;
              if (!canUp) { cvLo -= 1; cvAcc += vDn; }
              else if (!canDn) { cvHi += 1; cvAcc += vUp; }
              else if (ge(vUp, vDn)) { cvHi += 1; cvAcc += vUp; }
              else { cvLo -= 1; cvAcc += vDn; }
            }
            const vahP = profLo + cvHi * pxStep;
            const valP = profLo + cvLo * pxStep;
            profVahLn.value = line.new(frameL, vahP, rightX, vahP, 'bar_index', 'none', colVaText, 'dashed', 1);
            profValLn.value = line.new(frameL, valP, rightX, valP, 'bar_index', 'none', colVaText, 'dashed', 1);
            chartMarks.push({ price: vahP, txt: '▲ VAH  ' + fmtTick(vahP), fg: colVaText, bg: colVaBg, prio: 2, ln: profVahLn.value });
            chartMarks.push({ price: valP, txt: '▼ VAL  ' + fmtTick(valP), fg: colVaText, bg: colVaBg, prio: 2, ln: profValLn.value });
          }
          if (cfg.imbShow && res > 0 && !na(pocPrice)) {
            const cImbRatio = cfg.imbPct / 100.0;
            let cPocK = iround((pocPrice - profLo) / pxStep);
            cPocK = Math.max(0, Math.min(res, cPocK));
            let upK = -1;
            let upBuy = false;
            if (cPocK < res) {
              for (let k = cPocK + 1; k <= res; k++) {
                const hitB = gt(buyVals[k], 0.0) && gt(buyVals[k], sellVals[k - 1] * cImbRatio);
                const hitS = k <= res - 1 && gt(sellVals[k], 0.0) && gt(sellVals[k], buyVals[k + 1] * cImbRatio);
                if (hitB || hitS) { upK = k; upBuy = hitB; break; }
              }
            }
            let dnK = -1;
            let dnBuy = false;
            if (cPocK > 0) {
              for (let step = 1; step <= cPocK; step++) {
                const k = cPocK - step;
                const hitB = k >= 1 && gt(buyVals[k], 0.0) && gt(buyVals[k], sellVals[k - 1] * cImbRatio);
                const hitS = gt(sellVals[k], 0.0) && gt(sellVals[k], buyVals[k + 1] * cImbRatio);
                if (hitB || hitS) { dnK = k; dnBuy = hitB; break; }
              }
            }
            const imbHalf = tick / 2.0;
            const imbMark = (k: number, isBuy: boolean) => {
              const p = profLo + k * pxStep;
              const s = profBandMass(p - imbHalf, p + imbHalf, compsS);
              const b = profBandMass(p - imbHalf, p + imbHalf, compsB);
              const cc = isBuy ? colBuyText : colSellText;
              const cb = isBuy ? colImbBuyBg : colImbSellBg;
              const ln = line.new(frameL, p, rightX, p, 'bar_index', 'none', cc, 'dotted', 1);
              profImbLns.push(ln);
              chartMarks.push({
                price: p, txt: (isBuy ? '▲' : '▼') + ' IMB  ' + fmtTick(p) + '   ▼-' + fmtVol(s) + '   ▲+' + fmtVol(b),
                fg: cc, bg: cb, prio: 1, ln,
              });
            };
            if (upK >= 0) imbMark(upK, upBuy);
            if (dnK >= 0) imbMark(dnK, dnBuy);
          }
          // label renderer
          const nMk = chartMarks.length;
          if (nMk > 0) {
            if (nMk > 1) {
              for (let i = 0; i <= nMk - 2; i++) {
                let hi = i;
                for (let j = i + 1; j <= nMk - 1; j++) {
                  if (gt(chartMarks[j].price, chartMarks[hi].price)) hi = j;
                }
                if (hi !== i) {
                  const tmp = chartMarks[i];
                  chartMarks[i] = chartMarks[hi];
                  chartMarks[hi] = tmp;
                }
              }
            }
            const mergeSpan = cfg.lblMerge * tick;
            const sameEps = tick / 10.0;
            let i = 0;
            while (i < nMk) {
              let j = i;
              while (j + 1 < nMk && le(chartMarks[j].price - chartMarks[j + 1].price, mergeSpan)) j += 1;
              let top = i;
              let mrgTxt = '';
              for (let k = i; k <= j; k++) {
                if (chartMarks[k].prio > chartMarks[top].prio) top = k;
                mrgTxt += (k > i ? '\n' : '') + chartMarks[k].txt;
              }
              if (j > i) {
                for (let k = i; k <= j - 1; k++) {
                  for (let m = k + 1; m <= j; m++) {
                    const mkA = chartMarks[k];
                    const mkB = chartMarks[m];
                    if (lt(Math.abs(mkA.price - mkB.price), sameEps)) {
                      const loser = mkA.prio >= mkB.prio ? mkB : mkA;
                      if (loser.ln) {
                        line.delete(loser.ln);
                        loser.ln = undefined;
                      }
                    }
                  }
                }
              }
              const topMk = chartMarks[top];
              profMrgLbs.push(label.new(rightX, topMk.price, mrgTxt, 'bar_index', 'price', topMk.bg, 'label_left', topMk.fg, tableSize));
              i = j + 1;
            }
          }
          if (gt(vMax, 0.0)) {
            const baseIdx = li + 1;
            const bell = (vals: number[], lineCol: string, fillCol: string): Polyline => {
              const pts: ChartPoint[] = [chartPoint.from_index(baseIdx, profLo)];
              for (let k = 0; k <= res; k++) {
                const xI = baseIdx + iround(cfg.profWidth * vals[k] / vMax);
                pts.push(chartPoint.from_index(xI, profLo + k * pxStep));
              }
              pts.push(chartPoint.from_index(baseIdx, profHi));
              return polyline.new(pts, false, true, 'bar_index', lineCol, fillCol, 'solid', 1);
            };
            if (cfg.profBuy) profBuyPl.value = bell(buyVals, cfg.profBuyCol, colProfBuyBg);
            if (cfg.profSell) profSellPl.value = bell(sellVals, cfg.profSellCol, colProfSellBg);
          }
        }
        // chart control level without the drawing
        if (gt(span, 0.0) && !(cfg.profShow && (cfg.profBuy || cfg.profSell))) {
          const resCtl = cfg.profRes;
          const pxStepCtl = span / resCtl;
          let bestTot = -1.0;
          let bestPx = NaN;
          for (let k = 0; k <= resCtl; k++) {
            const pk = profLo + k * pxStepCtl;
            const tot = profDensity(pk, compsB) + profDensity(pk, compsS);
            if (gt(tot, bestTot)) { bestTot = tot; bestPx = pk; }
          }
          if (!na(bestPx)) {
            pocChartLevel = bestPx;
            const ctlHalf = tick / 2.0;
            pocChartSell = profBandMass(bestPx - ctlHalf, bestPx + ctlHalf, compsS);
            pocChartBuy = profBandMass(bestPx - ctlHalf, bestPx + ctlHalf, compsB);
          }
        }
      }
    }

    // ---- mobile dashboard
    if (mobTable && !na(lastVolume) && cfg.showTable && cfg.mobileMode) {
      let mWinBuy = 0.0;
      let mWinSell = 0.0;
      const mRowSumB = new Array<number>(nViewRows).fill(0.0);
      const mRowSumS = new Array<number>(nViewRows).fill(0.0);
      for (const fp of fpBars) {
        mWinBuy += fp.buyTotal;
        mWinSell += fp.sellTotal;
        for (let k = 0; k <= nViewRows - 1; k++) {
          mRowSumB[k] = mRowSumB[k] + nz(fp.bRows[k]);
          mRowSumS[k] = mRowSumS[k] + nz(fp.sRows[k]);
        }
      }
      const mv = windowLevels(mRowSumB, mRowSumS, pocDashOn || vaDashOn || cfg.imbShow, vaDashOn, cfg.imbShow, cfg.vaPct, cfg.imbPct);
      table.clear(mobTable, 0, 1, 1, 11);
      const mChgTxt = na(chgPct) ? '' : ' · ' + (ge(chgPct, 0.0) ? '+' : '') + str.tostring(chgPct, '#.##') + '%';
      const mEngTxt = useFp ? 'FP' : useIb ? 'IB ' + cfg.ltf : 'GEO';
      const mNoData = na(nowTot) ? ' · NO ENGINE DATA' : '';
      const mStatBg = na(chgPct) ? colPanelBg : ge(chgPct, 0.0) ? cn(COL_FWD, 15) : cn(COL_REV, 15);
      const cellL = (row: number, txt: string, fg: string, bg: string | undefined, tt: string) =>
        table.cell(mobTable, 0, row, txt, undefined, undefined, fg, 'left', undefined, mobileSize, bg, tt);
      const cellR = (row: number, txt: string, fg: string, bg: string | undefined, tt: string) =>
        table.cell(mobTable, 1, row, txt, undefined, undefined, fg, 'right', undefined, mobileSize, bg, tt);
      table.cell(mobTable, 0, 0, '$' + tickerOf(chart) + ' · ' + mEngTxt + mChgTxt + mNoData, undefined, undefined, '#FFFFFF', 'center',
        undefined, mobileSize, mStatBg,
        'Current bar at a glance: symbol, active engine, and the change from the prior close. Blue when the bar is up, red when it is down.');
      if (!na(nowTot) && gt(nowTot, 0.0)) {
        const mBuyLeads = ge(nowBuy, nowSell);
        const mBarVolTt = 'Sell and buy volume of the bar still being built, split by the active engine.';
        cellL(1, 'BAR VOL', colMutedText, undefined, mBarVolTt);
        cellR(1, '▼' + volCompact(nowSell) + '  ▲' + volCompact(nowBuy), mBuyLeads ? colBuyText : colSellText, undefined, mBarVolTt);
        const mDlt = nowBuy - nowSell;
        const mLeadPct = 100.0 * Math.abs(mDlt) / nowTot;
        cellL(2, 'BAR Δ', colMutedText, undefined, TT_C_DELTA);
        cellR(2, (ge(mDlt, 0.0) ? '+' : '-') + volCompact(Math.abs(mDlt)) + ' · ' + (mBuyLeads ? 'BUY ' : 'SELL ') + str.tostring(mLeadPct, '#.#') + '%',
          ge(mDlt, 0.0) ? colBuyText : colSellText, undefined, TT_C_DELTA);
      }
      if (fpBars.length > 0) {
        const mWinTot = mWinBuy + mWinSell;
        const mWinDlt = mWinBuy - mWinSell;
        const mWinVolTt = 'Total volume of the table window: every candle the window search found at these prices.';
        const mWinDltTt = 'Buy volume minus sell volume across the whole window.';
        cellL(3, 'WIN VOL', colMutedText, undefined, mWinVolTt);
        cellR(3, volCompact(mWinTot), colHeadText, undefined, mWinVolTt);
        cellL(4, 'WIN Δ', colMutedText, undefined, mWinDltTt);
        cellR(4, (ge(mWinDlt, 0.0) ? '+' : '-') + volCompact(Math.abs(mWinDlt)), ge(mWinDlt, 0.0) ? colBuyText : colSellText, undefined, mWinDltTt);
      }
      const rowPrice = (k: number) => (axisRowTick - viewTicks + k) * tick;
      if (pocDashOn && mv.pocK >= 0) {
        const wpS = mRowSumS[mv.pocK];
        const wpB = mRowSumB[mv.pocK];
        const wpFg = gt(wpB, wpS) ? colBuyText : gt(wpS, wpB) ? colSellText : colMetricText;
        const wpBg = gt(wpB, wpS) ? colImbBuyBg : gt(wpS, wpB) ? colImbSellBg : colMetricBg;
        const wpTt = TT_C_POC + "Window figure, over the table window's bars. Sell " + volCompact(wpS) + ' · Buy ' + volCompact(wpB);
        cellL(5, 'W-POC', wpFg, wpBg, wpTt);
        cellR(5, fmtTick(rowPrice(mv.pocK)) + '  ▼' + volCompact(wpS) + ' ▲' + volCompact(wpB), wpFg, wpBg, wpTt);
      }
      if (vaDashOn && mv.vahK >= 0) {
        const pctTxt = str.tostring(cfg.vaPct, '#');
        const vhTt = 'Value Area High: the upper edge of the price band holding ' + pctTxt + "% of the window's traded volume.";
        const vlTt = 'Value Area Low: the lower edge of the price band holding ' + pctTxt + "% of the window's traded volume.";
        cellL(6, 'VAH', colVaText, colVaBg, vhTt);
        cellR(6, fmtTick(rowPrice(mv.vahK)) + '  ▼' + volCompact(mRowSumS[mv.vahK]) + ' ▲' + volCompact(mRowSumB[mv.vahK]), colVaText, colVaBg, vhTt);
        cellL(7, 'VAL', colVaText, colVaBg, vlTt);
        cellR(7, fmtTick(rowPrice(mv.valK)) + '  ▼' + volCompact(mRowSumS[mv.valK]) + ' ▲' + volCompact(mRowSumB[mv.valK]), colVaText, colVaBg, vlTt);
      }
      const imbRow = (row: number, k: number, isBuy: boolean, tt: string) => {
        const fg = isBuy ? colBuyText : colSellText;
        const bg = isBuy ? colImbBuyBg : colImbSellBg;
        cellL(row, 'IMB ' + (isBuy ? '▲' : '▼'), fg, bg, tt);
        cellR(row, fmtTick(rowPrice(k)) + '  ▼' + volCompact(mRowSumS[k]) + ' ▲' + volCompact(mRowSumB[k]), fg, bg, tt);
      };
      if (cfg.imbShow && mv.upK >= 0) {
        imbRow(8, mv.upK, mv.upBuy, 'First imbalanced level above the window POC. One side overwhelmed the other here, measured diagonally over the whole window.');
      }
      if (cfg.imbShow && mv.dnK >= 0) {
        imbRow(9, mv.dnK, mv.dnBuy, 'First imbalanced level below the window POC. One side overwhelmed the other here, measured diagonally over the whole window.');
      }
      if (!na(pocChartLevel) && !na(pocChartSell)) {
        const cpFg = gt(pocChartBuy, pocChartSell) ? colBuyText : gt(pocChartSell, pocChartBuy) ? colSellText : colMetricText;
        const cpBg = gt(pocChartBuy, pocChartSell) ? colImbBuyBg : gt(pocChartSell, pocChartBuy) ? colImbSellBg : colMetricBg;
        const cpTt = 'Chart Point of Control: the price level of the profile period where the most volume changed hands, with the sell and buy volume of its one-tick band.';
        cellL(10, 'C-POC', cpFg, cpBg, cpTt);
        cellR(10, fmtTick(pocChartLevel) + '  ▼' + volCompact(pocChartSell) + ' ▲' + volCompact(pocChartBuy), cpFg, cpBg, cpTt);
      }
      if (!na(profOvl)) {
        const mOvlCoef = profOvl / 100.0;
        const mOvlBal = ge(mOvlCoef, 0.75);
        const mTiltBuy = !na(profTilt) && ge(profTilt, cfg.ovlTilt);
        const mTiltSell = !na(profTilt) && le(profTilt, -cfg.ovlTilt);
        const mOvlWord = mOvlBal ? 'BALANCED' : mTiltBuy ? 'OFF BAL · BUY' : mTiltSell ? 'OFF BAL · SELL' : 'OFF BALANCE';
        const mOvlFg = mOvlBal ? colMetricText : mTiltBuy ? colBuyText : mTiltSell ? colSellText : colMetricText;
        cellL(11, 'OVL', colMutedText, undefined, TT_C_OVL);
        cellR(11, str.tostring(mOvlCoef, '0.00') + ' · ' + mOvlWord, mOvlFg, undefined, TT_C_OVL);
      }
      table.cell(mobTable, 0, 12, 'MOBILE VIEW · TURN OFF FOR FULL TABLE', undefined, undefined, '#FFFFFF', 'center', undefined, mobileSize,
        cn(colMetricText, 20), TT_MOBILE);
      table.merge_cells(mobTable, 0, 0, 1, 0);
      table.merge_cells(mobTable, 0, 12, 1, 12);
    }
    setDrawingBar(null);
  }

  // ---- plots
  const last = n - 1;
  const plot = (values: (i: number) => number) =>
    bars.map((b, i) => {
      const v = values(i);
      return { time: b.time, value: Number.isFinite(v) ? v : NaN };
    });
  const lastOnly = (v: number) => (i: number) => (i === last ? v : NaN);
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: plot((i) => engBuy[i]),
      plot1: plot((i) => engSell[i]),
      plot2: plot((i) => engTotal[i]),
      plot3: plot((i) => buyShare[i] * 100),
      plot4: plot((i) => sellShare[i] * 100),
      plot5: plot(lastOnly(profResidual)),
      plot6: plot(lastOnly(profTilt)),
      plot7: plot(lastOnly(pocDashLevel)),
      plot8: plot(lastOnly(pocChartLevel)),
    },
    ...drawingOutputs(bars),
  };
}

export const VolumeFootprintMeasuringByMathGeometry = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, drawingKinds, requiredSymbols,
};
