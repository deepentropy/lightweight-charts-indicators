/**
 * Fair value bands / Flowly Indicators
 *
 * Fair value basis: a moving average (SMA, EMA, HMA, RMA, WMA, VWMA, Median, or a VWAP anchored on the periods of
 * "VWAP anchor") of the chosen price. Threshold band: on bars whose range holds the basis, high / basis and low /
 * basis are kept in two lists (the last 1001 bars, na on the other bars); the bands are the basis times the median
 * of each list, widened by "Threshold band width". Deviation bands: the pivots (5 bars each side) of ohlc4 / basis
 * are kept (up to 2001 each) while the low is above the upper threshold band (pivot highs) or the high is below the
 * lower one (pivot lows); the 1x band is the basis times the median pivot (distance widened by "Deviation band
 * width"), the 2x and 3x bands add that distance again. The trend switches down when the "▼" price is below the
 * lower threshold band and up when the "▲" price is above the upper one ("Cross"), or by the slope of the basis
 * ("Direction"); it colours the basis and the threshold band fill. Gradient fills from ohlc4 to the threshold bands
 * show extreme deviations; the extreme 2x-3x zones are filled.
 *
 * Metrics: counts of the bars (and their volume relative to the 20-bar SMA of volume) whose source is in each zone
 * between the bands, in the table and, with "Highlight metric calculations", as bar colours and data window values.
 * Cross labels: a label when the chosen price crosses the chosen band (up to four rules).
 *
 * As in the original, the "HLCC4" price option gives ohlc4 (the source compares it with "HLC44").
 *
 * Chart value read: the state of the last bar (the "New trend" alerts need a confirmed bar). The VWAP anchor uses
 * the exchange calendar of the chart context when it has one (src/anchor-period.ts).
 *
 * Reference: "Fair value bands / Flowly Indicators" by FlowlyIndicators
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © quantifytools
 */

import {
  ta, str, math, color, timeframe, array, Series, label, table, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type FillConfig, type FillData, type BarColorConfig,
} from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { StudyDrawingKind } from '../style-outputs';
import { lastBarConfirmedOf, type ChartContext } from '../chart-context';
import { periodChanges } from '../anchor-period';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';

type PriceName = 'OHLC4' | 'Open' | 'High' | 'Low' | 'Close' | 'HL2' | 'HLC3' | 'HLCC4';
type Smoothing = 'SMA' | 'EMA' | 'HMA' | 'RMA' | 'WMA' | 'VWMA' | 'Median' | 'VWAP';
type CrossRef = 'Off' | '+1' | '+2' | '+3' | '-1' | '-2' | '-3';
type Source = 'open' | 'high' | 'low' | 'close' | 'hl2' | 'hlc3' | 'hlcc4' | 'ohlc4' | 'volume';

export interface FairValueBandsFlowlyIndicatorsInputs {
  btCheck: boolean;
  boost: number;
  bandBoost: number;
  anchorTf: string;
  sourceString: PriceName;
  smoothingType: Smoothing;
  length: number;
  trendMode: 'Cross' | 'Direction';
  thresholdUpString: PriceName;
  thresholdDownString: PriceName;
  crossSrc1: Source;
  crossMethod1: 'Above' | 'Below';
  crossRef1: CrossRef;
  crossSrc2: Source;
  crossMethod2: 'Above' | 'Below';
  crossRef2: CrossRef;
  crossSrc3: Source;
  crossMethod3: 'Above' | 'Below';
  crossRef3: CrossRef;
  crossSrc4: Source;
  crossMethod4: 'Above' | 'Below';
  crossRef4: CrossRef;
  crossAboveCol: string;
  crossBelowCol: string;
  upColorLine: string;
  downColorLine: string;
  upColorFill: string;
  downColorFill: string;
  extremeDeviationUp: string;
  extremeDeviationDown: string;
  extremeUpColor: string;
  extremeDownColor: string;
  deviationBandColor: string;
  tablePos: 'Top right' | 'Bottom right' | 'Bottom left' | 'Top left';
  tableSize: number;
}

export const defaultInputs: FairValueBandsFlowlyIndicatorsInputs = {
  btCheck: false,
  boost: 1,
  bandBoost: 1,
  anchorTf: '1D',
  sourceString: 'OHLC4',
  smoothingType: 'SMA',
  length: 20,
  trendMode: 'Cross',
  thresholdUpString: 'Low',
  thresholdDownString: 'High',
  crossSrc1: 'high',
  crossMethod1: 'Above',
  crossRef1: '+2',
  crossSrc2: 'low',
  crossMethod2: 'Below',
  crossRef2: '-2',
  crossSrc3: 'close',
  crossMethod3: 'Above',
  crossRef3: 'Off',
  crossSrc4: 'close',
  crossMethod4: 'Above',
  crossRef4: 'Off',
  crossAboveCol: '#2962FF',
  crossBelowCol: '#E040FB',
  // input colour defaults: alpha stored with 2 decimals
  upColorLine: 'rgba(255, 255, 255, 0.5)',
  downColorLine: 'rgba(255, 82, 82, 0.5)',
  upColorFill: 'rgba(255, 255, 255, 0.03)',
  downColorFill: 'rgba(255, 82, 82, 0.03)',
  extremeDeviationUp: 'rgba(255, 82, 82, 0.9)',
  extremeDeviationDown: 'rgba(60, 105, 158, 0.9)',
  extremeUpColor: 'rgba(255, 82, 82, 0.1)',
  extremeDownColor: 'rgba(32, 84, 151, 0.1)',
  deviationBandColor: 'rgba(255, 255, 255, 0.05)',
  tablePos: 'Top right',
  tableSize: 3,
};

const G1 = 'Fair value basis & bands';
const GC = 'Crosses';
const GV = 'Visuals';
const GT = 'Table';
const PRICES: PriceName[] = ['OHLC4', 'Open', 'High', 'Low', 'Close', 'HL2', 'HLC3', 'HLCC4'];
const REFS: CrossRef[] = ['Off', '+1', '+2', '+3', '-1', '-2', '-3'];

const crossInputs = (k: number): InputConfig[] => [
  { id: `crossSrc${k}`, type: 'source', title: 'Cross', defval: defaultInputs[`crossSrc${k}` as 'crossSrc1'], group: GC, inline: `ucross${k}` },
  { id: `crossMethod${k}`, type: 'string', title: '', defval: defaultInputs[`crossMethod${k}` as 'crossMethod1'], options: ['Above', 'Below'], group: GC, inline: `ucross${k}` },
  { id: `crossRef${k}`, type: 'string', title: '', defval: defaultInputs[`crossRef${k}` as 'crossRef1'], options: REFS, group: GC, inline: `ucross${k}` },
];

export const inputConfig: InputConfig[] = [
  { id: 'btCheck', type: 'bool', title: 'Highlight metric calculations', defval: false, group: G1, tooltip: 'Enables lot based coloring and time/volume distribution counters, found in Data Window tab.' },
  { id: 'boost', type: 'float', title: 'Threshold band width', defval: 1, step: 0.1, min: 0, group: G1 },
  { id: 'bandBoost', type: 'float', title: 'Deviation band width', defval: 1, step: 0.1, min: 0, group: G1 },
  { id: 'anchorTf', type: 'timeframe', title: 'VWAP anchor', defval: '1D', group: G1, tooltip: 'Timeframe to which VWAP is anchored to. Choose VWAP from fair value basis menu to activate.' },
  { id: 'sourceString', type: 'string', title: '', defval: 'OHLC4', options: PRICES, inline: 'source', group: G1 },
  { id: 'smoothingType', type: 'string', title: '', defval: 'SMA', options: ['SMA', 'EMA', 'HMA', 'RMA', 'WMA', 'VWMA', 'Median', 'VWAP'], inline: 'source', group: G1 },
  { id: 'length', type: 'int', title: '', defval: 20, min: 1, inline: 'source', group: G1 },
  { id: 'trendMode', type: 'string', title: '', defval: 'Cross', options: ['Cross', 'Direction'], inline: 'sourcecross', group: G1 },
  { id: 'thresholdUpString', type: 'string', title: '▲', defval: 'Low', options: PRICES, inline: 'sourcecross', group: G1 },
  { id: 'thresholdDownString', type: 'string', title: '▼', defval: 'High', options: PRICES, inline: 'sourcecross', group: G1 },
  ...crossInputs(1),
  ...crossInputs(2),
  ...crossInputs(3),
  ...crossInputs(4),
  { id: 'crossAboveCol', type: 'color', title: 'Above', defval: '#2962FF', group: GC, inline: 'crosses' },
  { id: 'crossBelowCol', type: 'color', title: 'Below', defval: '#E040FB', group: GC, inline: 'crosses' },
  { id: 'upColorLine', type: 'color', title: 'Fair value basis ▲ / ▼', defval: defaultInputs.upColorLine, group: GV, inline: 'line' },
  { id: 'downColorLine', type: 'color', title: '', defval: defaultInputs.downColorLine, group: GV, inline: 'line' },
  { id: 'upColorFill', type: 'color', title: 'Threshold band ▲ / ▼', defval: defaultInputs.upColorFill, group: GV, inline: 'fill' },
  { id: 'downColorFill', type: 'color', title: '', defval: defaultInputs.downColorFill, group: GV, inline: 'fill' },
  { id: 'extremeDeviationUp', type: 'color', title: 'Deviation hue ▲ / ▼', defval: defaultInputs.extremeDeviationUp, group: GV, inline: 'deviation' },
  { id: 'extremeDeviationDown', type: 'color', title: '', defval: defaultInputs.extremeDeviationDown, group: GV, inline: 'deviation' },
  { id: 'extremeUpColor', type: 'color', title: 'Deviation bands extreme ▲ / ▼', defval: defaultInputs.extremeUpColor, group: GV, inline: 'band' },
  { id: 'extremeDownColor', type: 'color', title: '', defval: defaultInputs.extremeDownColor, group: GV, inline: 'band' },
  { id: 'deviationBandColor', type: 'color', title: 'Deviation bands', defval: defaultInputs.deviationBandColor, group: GV, inline: 'dev' },
  { id: 'tablePos', type: 'string', title: 'Table position', defval: 'Top right', options: ['Top right', 'Bottom right', 'Bottom left', 'Top left'], group: GT },
  { id: 'tableSize', type: 'int', title: 'Table size', defval: 3, min: 1, max: 5, group: GT },
];

// Colour constants of Pine version 5
const RED = '#FF5252';
const BLUE = '#2962FF';
const AQUA = '#00BCD4';
const YELLOW = '#FFEB3B';
const ORANGE = '#FF9800';
const FUCHSIA = '#E040FB';
const GRAY = '#787B86';
const BLACK = '#363A45';
const WHITE = '#FFFFFF';
const PERIWINKLE = '#7C93EF';
const c = (col: string, t: number) => String(color.new(col, t));
const CLEAR_WHITE = c(WHITE, 100);

const DW: Array<[string, string]> = [
  ['Relative volume', FUCHSIA], ['All time counts', FUCHSIA],
  ['+3 time count', RED], ['+3 volume count cumulative', RED], ['+3 volume count average', RED],
  ['+2 time count', ORANGE], ['+2 volume count cumulative', ORANGE], ['+2 volume count average', ORANGE],
  ['+1 time count', YELLOW], ['+1 volume count cumulative', YELLOW], ['+1 volume count average', YELLOW],
  ['-1 time count', AQUA], ['-1 volume count cumulative', AQUA], ['-1 volume count average', AQUA],
  ['-2 time count', PERIWINKLE], ['-2 volume count cumulative', PERIWINKLE], ['-2 volume count average', PERIWINKLE],
  ['-3 time count', BLUE], ['-3 volume count cumulative', BLUE], ['-3 volume count average', BLUE],
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'OHLC4', color: CLEAR_WHITE, lineWidth: 1 },
  { id: 'plot1', title: 'Threshold band up', color: CLEAR_WHITE, lineWidth: 1, style: 'linebr' },
  { id: 'plot2', title: 'Threshold band down', color: CLEAR_WHITE, lineWidth: 1, style: 'linebr' },
  { id: 'plot3', title: 'Fair value basis', color: defaultInputs.upColorLine, lineWidth: 1 },
  { id: 'plot4', title: 'Fair value deviation band up 1x', color: defaultInputs.deviationBandColor, lineWidth: 1 },
  { id: 'plot5', title: 'Fair value deviation band down 1x', color: defaultInputs.deviationBandColor, lineWidth: 1 },
  { id: 'plot6', title: 'Fair value deviation band up 2x', color: defaultInputs.deviationBandColor, lineWidth: 1 },
  { id: 'plot7', title: 'Fair value deviation band down 2x', color: defaultInputs.deviationBandColor, lineWidth: 1 },
  { id: 'plot8', title: 'Fair value deviation band up 3x', color: defaultInputs.deviationBandColor, lineWidth: 1 },
  { id: 'plot9', title: 'Fair value deviation band down 3x', color: defaultInputs.deviationBandColor, lineWidth: 1 },
  ...DW.map(([title, col], k): PlotConfig => ({
    id: `plot${10 + k}`, title, color: c(col, 100), lineWidth: 1, display: 'data_window',
  })),
];

export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot8', plot2: 'plot6', title: 'Extreme fair value deviation band up fill' },
  { id: 'fill1', plot1: 'plot9', plot2: 'plot7', title: 'Extreme fair value deviation band down fill' },
  { id: 'fill2', plot1: 'plot0', plot2: 'plot2', title: 'Extreme fair value deviation up hue fill' },
  { id: 'fill3', plot1: 'plot0', plot2: 'plot1', title: 'Extreme fair value deviation down hue fill' },
  { id: 'fill4', plot1: 'plot1', plot2: 'plot2', title: 'Threshold band fill' },
];

export const barColorConfig: BarColorConfig[] = [{ id: 'barcolor0', kind: 'barcolor', title: 'Bar Color' }];

export const drawingKinds: StudyDrawingKind[] = ['label', 'table'];

export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Deviation band +1 cross', message: 'High cross above +1 band detected.' },
  { id: 'alert1', title: 'Deviation band +2 cross', message: 'High cross above +2 band detected.' },
  { id: 'alert2', title: 'Deviation band +3 cross', message: 'High cross above +3 band detected.' },
  { id: 'alert3', title: 'Deviation band -1 cross', message: 'Low cross below -1 band detected.' },
  { id: 'alert4', title: 'Deviation band -2 cross', message: 'Low cross below -2 band detected.' },
  { id: 'alert5', title: 'Deviation band -3 cross', message: 'Low cross below -3 band detected.' },
  { id: 'alert6', title: 'Low at fair value basis in an uptrend', message: 'Low at fair value basis in an uptrend detected.' },
  { id: 'alert7', title: 'High at fair value basis in a downtrend', message: 'High at fair value basis  in a downtrend detected.' },
  { id: 'alert8', title: 'New trend up', message: 'New trend up detected' },
  { id: 'alert9', title: 'New trend down', message: 'New trend down detected' },
  { id: 'alert10', title: 'Deviation band -1 cross or +1 cross', message: 'Low cross below -1/high cross above +1 band detected.' },
  { id: 'alert11', title: 'Deviation band -2 cross or +2 cross', message: 'Low cross below -2/high cross above +2 band detected.' },
  { id: 'alert12', title: 'Deviation band -3 cross or +3 cross', message: 'Low cross below -3/high cross above +3 band detected.' },
  { id: 'alert13', title: 'New trend up or new trend down', message: 'New trend up/down detected.' },
];

export const metadata = {
  title: 'Fair value bands / Flowly Indicators',
  shortTitle: 'Fair value bands / Flowly Indicators',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && a - b >= -EPS;
const le = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && b - a >= -EPS;
const nan = (v: number | null | undefined) => (v === null || v === undefined ? NaN : v);

/** stringSrc(): "HLCC4" falls through to ohlc4, as the original (it tests "HLC44") */
function priceOf(name: PriceName, b: Bar): number {
  switch (name) {
    case 'Open': return b.open;
    case 'High': return b.high;
    case 'Low': return b.low;
    case 'Close': return b.close;
    case 'HL2': return (b.high + b.low) / 2;
    case 'HLC3': return (b.high + b.low + b.close) / 3;
    default: return (b.open + b.high + b.low + b.close) / 4;
  }
}

function sourceOf(name: Source, b: Bar): number {
  switch (name) {
    case 'open': return b.open;
    case 'high': return b.high;
    case 'low': return b.low;
    case 'close': return b.close;
    case 'hl2': return (b.high + b.low) / 2;
    case 'hlc3': return (b.high + b.low + b.close) / 3;
    case 'hlcc4': return (b.high + b.low + b.close + b.close) / 4;
    case 'ohlc4': return (b.open + b.high + b.low + b.close) / 4;
    default: return b.volume ?? NaN;
  }
}

/** Pine array: remove the first element when the size is above the limit, then push */
function pushLimited(list: number[], value: number, limit: number, push = true): void {
  if (list.length > limit) list.shift();
  if (push) list.push(value);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<FairValueBandsFlowlyIndicatorsInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { barColors: BarColorData[]; alerts: AlertConditionState[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const len = cfg.length;

  resetDrawings({ label: 500, line: 500 });

  // Fair value basis
  const src = new Series(bars, (b) => priceOf(cfg.sourceString, b));
  const vol = new Series(bars, (b) => b.volume ?? NaN);
  let basis: Series;
  switch (cfg.smoothingType) {
    case 'SMA': basis = ta.sma(src, len); break;
    case 'EMA': basis = ta.ema(src, len); break;
    case 'HMA': basis = ta.hma(src, len); break;
    case 'RMA': basis = ta.rma(src, len); break;
    case 'VWMA': basis = ta.vwma(src, len, vol); break;
    case 'Median': basis = ta.median(src, len); break;
    case 'VWAP': {
      // anchor = timeframe.change(i_anchorTf)
      const anchor = periodChanges(bars, cfg.anchorTf, chart);
      basis = ta.vwap(src, vol, Series.fromArray(bars, anchor.map((a) => (a ? 1 : 0))));
      break;
    }
    default: basis = ta.wma(src, len);
  }
  const fair = basis.toArray().map(nan);

  const devUpList: number[] = [];
  const devDownList: number[] = [];
  const upperBand: number[] = new Array(n);
  const lowerBand: number[] = new Array(n);
  const upperBoosted: number[] = new Array(n);
  const lowerBoosted: number[] = new Array(n);
  const dirSwitch: number[] = new Array(n);
  let dir = 0;

  // Threshold band and trend
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const f = fair[i];
    const inside = lt(b.low, f) && gt(b.high, f);
    pushLimited(devUpList, inside ? b.high / f : NaN, 1000);
    pushLimited(devDownList, inside ? b.low / f : NaN, 1000);
    upperBand[i] = f * array.median(devUpList);
    lowerBand[i] = f * array.median(devDownList);
    upperBoosted[i] = f + (upperBand[i] - f) * cfg.boost;
    lowerBoosted[i] = f - (f - lowerBand[i]) * cfg.boost;
    const prev = i > 0 ? fair[i - 1] : NaN;
    const ruleUp = cfg.trendMode === 'Cross' ? gt(priceOf(cfg.thresholdUpString, b), upperBoosted[i]) : gt(f, prev);
    const ruleDown = cfg.trendMode === 'Cross' ? lt(priceOf(cfg.thresholdDownString, b), lowerBoosted[i]) : lt(f, prev);
    if (ruleDown) dir = -1;
    else if (ruleUp) dir = 1;
    dirSwitch[i] = dir;
  }

  // Deviation bands
  const spread = Series.fromArray(bars, bars.map((b, i) => (b.open + b.high + b.low + b.close) / 4 / fair[i]));
  const pivotUp = ta.pivothigh(spread, 5, 5).toArray().map(nan);
  const pivotDown = ta.pivotlow(spread, 5, 5).toArray().map(nan);
  const pivotUps: number[] = [];
  const pivotDowns: number[] = [];
  const band1Up: number[] = new Array(n);
  const band1Down: number[] = new Array(n);
  const band2Up: number[] = new Array(n);
  const band2Down: number[] = new Array(n);
  const band3Up: number[] = new Array(n);
  const band3Down: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const f = fair[i];
    const pushUp = gt(b.low, upperBand[i]);
    const pushDown = !pushUp && lt(b.high, lowerBand[i]);
    pushLimited(pivotUps, pivotUp[i], 2000, pushUp);
    pushLimited(pivotDowns, pivotDown[i], 2000, pushDown);
    const upSpread = (f * array.median(pivotUps) - f) * cfg.bandBoost;
    const downSpread = (f - f * array.median(pivotDowns)) * cfg.bandBoost;
    band1Up[i] = f + upSpread;
    band1Down[i] = f - downSpread;
    band2Up[i] = band1Up[i] + upSpread;
    band2Down[i] = band1Down[i] - downSpread;
    band3Up[i] = band2Up[i] + upSpread;
    band3Down[i] = band2Down[i] - downSpread;
  }

  // Metrics
  const volSma = ta.sma(vol, 20).toArray().map(nan);
  const counts = [0, 0, 0, 0, 0, 0];
  const vols = [0, 0, 0, 0, 0, 0];
  const dw: number[][] = DW.map(() => new Array(n).fill(NaN));
  const barColors: BarColorData[] = [];
  const zoneColors = [RED, ORANGE, YELLOW, AQUA, PERIWINKLE, BLUE];
  const lastConfirmed = lastBarConfirmedOf(chart);

  // Cross labels: one ta.crossover / ta.crossunder per enabled rule (called on every bar)
  const crossSrcs = [cfg.crossSrc1, cfg.crossSrc2, cfg.crossSrc3, cfg.crossSrc4];
  const crossMethods = [cfg.crossMethod1, cfg.crossMethod2, cfg.crossMethod3, cfg.crossMethod4];
  const crossRefs = [cfg.crossRef1, cfg.crossRef2, cfg.crossRef3, cfg.crossRef4];
  const refSeries = (ref: CrossRef) => (ref === '+1' ? band1Up : ref === '+2' ? band2Up : ref === '+3' ? band3Up
    : ref === '-1' ? band1Down : ref === '-2' ? band2Down : band3Down);
  const crossFlags = crossRefs.map((ref, k) => {
    if (ref === 'Off') return null;
    const s = Series.fromArray(bars, bars.map((b) => sourceOf(crossSrcs[k], b)));
    const r = Series.fromArray(bars, refSeries(ref));
    return (crossMethods[k] === 'Above' ? ta.crossover(s, r) : ta.crossunder(s, r)).toArray();
  });

  const high = Series.fromArray(bars, bars.map((b) => b.high));
  const low = Series.fromArray(bars, bars.map((b) => b.low));
  const flagsOf = (s: Series) => s.toArray().map((v) => !!v);
  const x1Up = flagsOf(ta.crossover(high, Series.fromArray(bars, band1Up)));
  const x2Up = flagsOf(ta.crossover(high, Series.fromArray(bars, band2Up)));
  const x3Up = flagsOf(ta.crossover(high, Series.fromArray(bars, band3Up)));
  const x1Down = flagsOf(ta.crossunder(low, Series.fromArray(bars, band1Down)));
  const x2Down = flagsOf(ta.crossunder(low, Series.fromArray(bars, band2Down)));
  const x3Down = flagsOf(ta.crossunder(low, Series.fromArray(bars, band3Down)));
  const fairInUp: boolean[] = [];
  const fairInDown: boolean[] = [];
  const newUp: boolean[] = [];
  const newDown: boolean[] = [];

  const midLine: Array<{ time: number; value: number; color: string }> = [];
  const midFill: string[] = [];
  const line = (values: number[], col: string) => bars.map((b, i) => ({
    time: b.time, value: Number.isFinite(values[i]) ? values[i] : NaN, color: col,
  }));

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const t = b.time;
    const f = fair[i];
    const s = priceOf(cfg.sourceString, b);
    const volMultiplier = Number.isNaN(volSma[i]) ? 0 : (b.volume ?? NaN) / volSma[i];
    const zones = [
      gt(s, band2Up[i]),
      gt(s, band1Up[i]) && le(s, band2Up[i]),
      gt(s, f) && le(s, band1Up[i]),
      lt(s, f) && ge(s, band1Down[i]),
      lt(s, band1Down[i]) && ge(s, band2Down[i]),
      lt(s, band2Down[i]),
    ];
    zones.forEach((z, k) => {
      if (z) {
        counts[k] += 1;
        vols[k] += volMultiplier;
      }
    });
    const allCounts = counts[5] + counts[1] + counts[2] + counts[3] + counts[4] + counts[0];

    // barcolor(): first zone of the order -3, -2, -1, +1, +2, +3
    if (cfg.btCheck) {
      const k = [5, 4, 3, 2, 1, 0].find((z) => zones[z]);
      if (k !== undefined) barColors.push({ id: 'barcolor0', time: t, color: zoneColors[k] });
      dw[0][i] = volMultiplier;
      dw[1][i] = allCounts;
      for (let k2 = 0; k2 < 6; k2++) {
        dw[2 + 3 * k2][i] = counts[k2];
        dw[3 + 3 * k2][i] = vols[k2];
        dw[4 + 3 * k2][i] = vols[k2] / counts[k2];
      }
    }

    const d = dirSwitch[i];
    midLine.push({ time: t, value: Number.isFinite(f) ? f : NaN, color: d === 1 ? cfg.upColorLine : cfg.downColorLine });
    midFill.push(d === 1 ? cfg.upColorFill : cfg.downColorFill);

    const confirmed = i < n - 1 || lastConfirmed;
    const prevDir = i > 0 ? dirSwitch[i - 1] : NaN;
    fairInUp.push(d === 1 && le(b.low, upperBoosted[i]));
    fairInDown.push(d === -1 && ge(b.high, lowerBoosted[i]));
    newUp.push(prevDir === -1 && d === 1 && confirmed);
    newDown.push(prevDir === 1 && d === -1 && confirmed);

    // crossFunc(): a label on each cross of an enabled rule
    crossFlags.forEach((flags, k) => {
      if (!flags || !flags[i]) return;
      const above = crossMethods[k] === 'Above';
      const ref = crossRefs[k];
      label.new(i, above ? b.high : b.low, above ? `${ref}\n▼` : `▲\n${ref}`, 'bar_index', 'price', c(AQUA, 100),
        above ? 'label_down' : 'label_up', above ? cfg.crossAboveCol : cfg.crossBelowCol, 'normal');
    });

    // Table (the cells of the last bar are those shown)
    if (i === n - 1) {
      const pos = cfg.tablePos === 'Top right' ? 'top_right' : cfg.tablePos === 'Bottom right' ? 'bottom_right'
        : cfg.tablePos === 'Bottom left' ? 'bottom_left' : 'top_left';
      const size = cfg.tableSize === 1 ? 'tiny' : cfg.tableSize === 2 ? 'small' : cfg.tableSize === 3 ? 'normal'
        : cfg.tableSize === 4 ? 'huge' : 'large';
      const tbl = table.new(pos, 50, 50, c(BLACK, 80), undefined, undefined, 'rgb(23, 23, 23)', 3);
      const nl = '\n';
      const l = '⎯⎯';
      const vl = '｜';
      const perc = (k: number, digits: number) => math.round(counts[k] / allCounts, digits) * 100;
      const avg = (k: number) => math.round(vols[k] / counts[k], 2);
      const cellText = (head: string, k: number, digits: number) =>
        `${head}${nl}${l}${nl}${str.tostring(perc(k, digits))}%${nl}${l}${nl}${str.tostring(avg(k))}x`;
      const lengthText = cfg.smoothingType === 'VWAP'
        ? `${str.tostring(timeframe.in_seconds(cfg.anchorTf) / 3600)}H` : str.tostring(len);
      const settingsText = `Settings${nl}⎯⎯⎯⎯⎯⎯⎯⎯⎯${nl}${cfg.sourceString}${vl}${cfg.smoothingType}${vl}${lengthText}${nl}`
        + (cfg.trendMode === 'Cross' ? `Cross${vl}▲ ${cfg.thresholdUpString}${vl}▼ ${cfg.thresholdDownString}` : 'Direction')
        + `${nl}Mid: ${str.tostring(cfg.boost)}${vl}Out: ${str.tostring(cfg.bandBoost)}`;
      table.cell(tbl, 1, 0, `Position${nl}⎯⎯⎯⎯${nl}Time${nl}⎯⎯⎯⎯${nl}Volume`, undefined, undefined, WHITE, 'left', undefined, size);
      table.cell(tbl, 2, 0, cellText('+3', 0, 3), undefined, undefined, WHITE, 'center', undefined, size, c(RED, 70));
      table.cell(tbl, 3, 0, cellText('+2', 1, 2), undefined, undefined, WHITE, 'center', undefined, size, c(RED, 90));
      table.cell(tbl, 4, 0, cellText('+1', 2, 2), undefined, undefined, WHITE, 'center', undefined, size, c(GRAY, 80));
      table.cell(tbl, 6, 0, cellText('-1 ', 3, 2), undefined, undefined, WHITE, 'center', undefined, size, c(GRAY, 80));
      table.cell(tbl, 7, 0, cellText('-2', 4, 2), undefined, undefined, WHITE, 'center', undefined, size, c(BLUE, 90));
      table.cell(tbl, 8, 0, cellText('-3', 5, 3), undefined, undefined, WHITE, 'center', undefined, size, c(BLUE, 70));
      table.cell(tbl, 10, 0, settingsText, undefined, undefined, WHITE, 'left', 'top', size, c('#100e48', 80));
    }
  }
  setDrawingBar(null);

  const gradient = (top: number[], bottom: number[], topColor: string) => ({
    topValue: top,
    bottomValue: bottom,
    topColor: new Array<string | null>(n).fill(topColor),
    bottomColor: new Array<string | null>(n).fill(c(GRAY, 100)),
  });
  const fills: FillData[] = [
    { id: 'fill0', plot1: 'plot8', plot2: 'plot6', options: { title: fillConfig[0].title, color: cfg.extremeUpColor }, colors: new Array<string>(n).fill(cfg.extremeUpColor) },
    { id: 'fill1', plot1: 'plot9', plot2: 'plot7', options: { title: fillConfig[1].title, color: cfg.extremeDownColor }, colors: new Array<string>(n).fill(cfg.extremeDownColor) },
    { id: 'fill2', plot1: 'plot0', plot2: 'plot2', options: { title: fillConfig[2].title }, gradient: gradient(band3Down, lowerBoosted, cfg.extremeDeviationDown) },
    { id: 'fill3', plot1: 'plot0', plot2: 'plot1', options: { title: fillConfig[3].title }, gradient: gradient(band3Up, upperBoosted, cfg.extremeDeviationUp) },
    { id: 'fill4', plot1: 'plot1', plot2: 'plot2', options: { title: fillConfig[4].title }, colors: midFill },
  ];

  const plots: IndicatorResult['plots'] = {
    plot0: line(bars.map((b) => (b.open + b.high + b.low + b.close) / 4), CLEAR_WHITE),
    plot1: line(upperBoosted, CLEAR_WHITE),
    plot2: line(lowerBoosted, CLEAR_WHITE),
    plot3: midLine,
    plot4: line(band1Up, cfg.deviationBandColor),
    plot5: line(band1Down, cfg.deviationBandColor),
    plot6: line(band2Up, cfg.deviationBandColor),
    plot7: line(band2Down, cfg.deviationBandColor),
    plot8: line(band3Up, cfg.deviationBandColor),
    plot9: line(band3Down, cfg.deviationBandColor),
  };
  dw.forEach((values, k) => {
    plots[`plot${10 + k}`] = bars.map((b, i) => ({ time: b.time, value: Number.isFinite(values[i]) ? values[i] : NaN }));
  });

  const or = (a: boolean[], b2: boolean[]) => a.map((v, i) => v || b2[i]);
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    fills,
    barColors,
    ...drawingOutputs(bars, n > 0 && bars[0].time >= 1e12 ? 'ms' : 's'),
    alerts: alertStates(alertConditions, bars, [
      x1Up, x2Up, x3Up, x1Down, x2Down, x3Down, fairInUp, fairInDown, newUp, newDown,
      or(x1Down, x1Up), or(x2Down, x2Up), or(x3Down, x3Up), or(newUp, newDown),
    ]),
  };
}

export const FairValueBandsFlowlyIndicators = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  fillConfig,
  barColorConfig,
  drawingKinds,
  alertConditions,
};
