/**
 * Market Structure: Zig Zag, Break of Structure, Supply / Demand and Inflection Zones
 *
 * An internal trigger (one of nine versions: smart engulfments, SMA direction, ATR expansion, displacement,
 * loopback extreme, signed area, candle direction, institutional order blocks, regression MA direction) gives the
 * internal ("LTF") shifts, which alternate. Each bearish shift takes the highest high since the last bullish trigger
 * as a swing high, each bullish shift the lowest low since the last bearish trigger as a swing low, and draws an
 * order block box. A close SMA above the swing high (below the swing low) is an internal break of structure.
 * A close SMA through the "control" swing (the first lower high after a bullish run, the first higher low after a
 * bearish run) is an MTF shift: it draws a supply or demand zone and gives the MTF swing points (highest high /
 * lowest low since the swing before). A second close SMA through the MTF swings gives the MTF break of structure
 * and change of character lines and the inflection zones; a third SMA does the same for the HTF swings.
 * "Calculate Zig-Zag By" chooses which level draws the zig-zag, the swing labels (HH / HL / LH / LL / LS), the
 * liquidity sweep lines and the BoS / CHoCH lines. Zones touched by price are dimmed (or deleted, as options).
 *
 * The "Timeframe" input reads the prices of another timeframe of the chart symbol (request.security without
 * lookahead: the bar of that timeframe shows on the chart bar that completes it, and the open last bar shows the
 * bar in progress); "" is the chart timeframe. A timeframe below the chart timeframe needs data that the chart bars
 * do not have: the port throws an Error. The SMAs, the ATR and the swing searches run on the chart bars, as in the
 * original.
 *
 * Alerts: the 24 alertcondition() declarations (`alerts`), and the alert() calls (`alertCalls`, once per bar close).
 *
 * Reference: "Market Structure- ZigZag, Break of Structure & Order Blocks" by The_Forex_Steward
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © The_Forex_Steward
 */

import {
  taCore, str, color, callsite, timeframe, line, box, label, resetDrawings, setDrawingBar, varDrawing, mapToChart,
  type Box, type Label, type Line, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type ShapeConfig,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import type { AlertCall, BoxData, LabelData, LineDrawingData, MarkerData } from '../types';
import { barInterval, barTime } from '../bar-time';
import { chartTimeframe, higherTimeframeBars } from '../anchor-period';
import { lastBarConfirmedOf, type ChartContext } from '../chart-context';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';

type Version =
  | 'Version 1 (Original, Smart Engulfments)'
  | 'Version 2 (SMA)'
  | 'Version 3 (ATR)'
  | 'Version 4 (Displacement)'
  | 'Version 5 (Loopback)'
  | 'Version 6 (Area (Time x Price Difference))'
  | 'Version 7 (Candles)'
  | 'Version 8 (Institutional Order-Blocks)'
  | 'Version 9 (Regression MA)';
type LineStyleName = 'Solid' | 'Dotted' | 'Dashed';

export interface MarketStructureZigzagBreakOfStructureInputs {
  note: number;
  note2: number;
  note3: number;
  htf: string;
  version: Version;
  shiftMode: 'LTF' | 'MTF' | 'HTF';
  shiftSource: 'Close' | 'Wick';
  srcInput: 'Open' | 'Close' | 'HL2' | 'HLC3' | 'OHLC4' | 'HLCC4';
  MTFDisplacement: number;
  stallOffset: number;
  smaLength: number;
  smaLength2: number;
  smaLength3: number;
  showBearishOrderBlocks: boolean;
  showBullishOrderBlocks: boolean;
  showSupplyZones: boolean;
  showDemandZones: boolean;
  showBearishInflectionZones: boolean;
  showBullishInflectionZones: boolean;
  deleteMitigatedBoxes: boolean;
  deleteBrokenBoxes: boolean;
  dimMitigatedBoxes: boolean;
  fullZones: boolean;
  orderBlockDuration: number;
  x: number;
  bearishBlockColor: string;
  bullishBlockColor: string;
  demandZoneColor: string;
  supplyZoneColor: string;
  bullishInflectionZoneColor: string;
  bearishInflectionZoneColor: string;
  plotBoSLines: boolean;
  plotCHoCHLines: boolean;
  plotLSLines: boolean;
  plotLineLabels: boolean;
  useMeasurements: boolean;
  zigzagLineWidth: number;
  bosLineStyle: LineStyleName;
  bosBullishLineColor: string;
  bosBearishLineColor: string;
  CHoCHColor: string;
  LSLineColor: string;
  plotZigZag: boolean;
  plotSwingLabels: boolean;
  useEfficiency: boolean;
  zigzagLineColor: string;
  zigzagLineStyle: LineStyleName;
  HHHLcolor: string;
  LLLHcolor: string;
  LScolor: string;
  HHHLcolorbg: string;
  LLLHcolorbg: string;
  LScolorbg: string;
  alertMode: number;
  alertShift: boolean;
  alertBoS: boolean;
  alertCHoCH: boolean;
  alertHighsandLows: boolean;
}

export const defaultInputs: MarketStructureZigzagBreakOfStructureInputs = {
  note: 1,
  note2: 1,
  note3: 1,
  htf: '',
  version: 'Version 1 (Original, Smart Engulfments)',
  shiftMode: 'MTF',
  shiftSource: 'Close',
  srcInput: 'HL2',
  MTFDisplacement: 0.1,
  stallOffset: 5,
  smaLength: 2,
  smaLength2: 5,
  smaLength3: 15,
  showBearishOrderBlocks: true,
  showBullishOrderBlocks: true,
  showSupplyZones: true,
  showDemandZones: true,
  showBearishInflectionZones: true,
  showBullishInflectionZones: true,
  deleteMitigatedBoxes: false,
  deleteBrokenBoxes: false,
  dimMitigatedBoxes: true,
  fullZones: false,
  orderBlockDuration: 3,
  x: 1,
  bearishBlockColor: 'rgba(0, 0, 0, 0.5)',
  bullishBlockColor: 'rgba(0, 0, 0, 0.5)',
  demandZoneColor: 'rgba(76, 175, 79, 0.5)',
  supplyZoneColor: 'rgba(255, 82, 82, 0.5)',
  bullishInflectionZoneColor: 'rgba(33, 149, 243, 0.5)',
  bearishInflectionZoneColor: 'rgba(33, 149, 243, 0.5)',
  plotBoSLines: true,
  plotCHoCHLines: true,
  plotLSLines: true,
  plotLineLabels: true,
  useMeasurements: false,
  zigzagLineWidth: 2,
  bosLineStyle: 'Solid',
  bosBullishLineColor: '#4CAF50',
  bosBearishLineColor: '#F23645',
  CHoCHColor: '#2962FF',
  LSLineColor: '#FF9800',
  plotZigZag: true,
  plotSwingLabels: true,
  useEfficiency: false,
  zigzagLineColor: '#363A45',
  zigzagLineStyle: 'Solid',
  HHHLcolor: '#4CAF50',
  LLLHcolor: '#F23645',
  LScolor: '#FF9800',
  HHHLcolorbg: 'rgba(76, 175, 79, 0.15)',
  LLLHcolorbg: 'rgba(255, 82, 82, 0.15)',
  LScolorbg: 'rgba(255, 153, 0, 0.15)',
  alertMode: 1,
  alertShift: true,
  alertBoS: true,
  alertCHoCH: true,
  alertHighsandLows: true,
};

const VERSIONS: Version[] = [
  'Version 1 (Original, Smart Engulfments)', 'Version 2 (SMA)', 'Version 3 (ATR)', 'Version 4 (Displacement)',
  'Version 5 (Loopback)', 'Version 6 (Area (Time x Price Difference))', 'Version 7 (Candles)',
  'Version 8 (Institutional Order-Blocks)', 'Version 9 (Regression MA)',
];
const STYLES: LineStyleName[] = ['Solid', 'Dotted', 'Dashed'];

export const inputConfig: InputConfig[] = [
  { id: 'note', type: 'int', title: '****If you want to use CoCh zig-zag/swing labels and bos labels together I recommend opening the indicator twice and use the functions separately!!! Due to plotshape overload****', defval: 1, min: 1, max: 1 },
  { id: 'note2', type: 'int', title: '****If you use HTF timeframe, expect live updates on lower timeframes to produce improper results when plotting shapes live/bar replay. You MUST refresh lower timeframe charts in order to see accurate structures!!!****', defval: 1, min: 1, max: 1 },
  { id: 'note3', type: 'int', title: "*Author's Choice*: Version 9 (Regression MA), Threshold = 5, LTF SMA= 2, MTF SMA= 5, HTF SMA= 15", defval: 1, min: 1, max: 1 },
  { id: 'htf', type: 'timeframe', title: 'Timeframe', defval: '' },
  { id: 'version', type: 'string', title: 'Select Indicator Version (Internal Trigger)', defval: 'Version 1 (Original, Smart Engulfments)', options: VERSIONS },
  { id: 'shiftMode', type: 'string', title: 'Calculate Zig-Zag By', defval: 'MTF', options: ['LTF', 'MTF', 'HTF'] },
  { id: 'shiftSource', type: 'string', title: 'Internal Shift Source (Versions 1, 4 & 6)', defval: 'Close', options: ['Close', 'Wick'] },
  { id: 'srcInput', type: 'string', title: 'Reversal Source for SMA (Version 2), Loopback (Version 5) and Version 9 (Regression MA)', defval: 'HL2', options: ['Open', 'Close', 'HL2', 'HLC3', 'OHLC4', 'HLCC4'] },
  { id: 'MTFDisplacement', type: 'float', title: 'Displacement Trigger Threshold (Versions 4 & 6)', defval: 0.1, step: 0.0001 },
  { id: 'stallOffset', type: 'int', title: 'Trigger Phase Loopback (Unit Measurement for Trigger)', defval: 5, min: 1 },
  { id: 'smaLength', type: 'int', title: 'SMA Close Breakout Length for LTF', defval: 2, min: 1, tooltip: 'Used to validate breakouts for Supply/Demand Zones and LTF structural breakouts.' },
  { id: 'smaLength2', type: 'int', title: 'SMA Close Breakout Length for MTF', defval: 5, min: 1, tooltip: 'Used to validate breakouts for MTF structural breakouts.' },
  { id: 'smaLength3', type: 'int', title: 'SMA Close Breakout Length for HTF', defval: 15, min: 1, tooltip: 'Used to validate breakouts for HTF structural breakouts.' },
  { id: 'showBearishOrderBlocks', type: 'bool', title: 'Show Bearish Order Blocks', defval: true },
  { id: 'showBullishOrderBlocks', type: 'bool', title: 'Show Bullish Order Blocks', defval: true },
  { id: 'showSupplyZones', type: 'bool', title: 'Show Supply Zones', defval: true },
  { id: 'showDemandZones', type: 'bool', title: 'Show Demand Zones', defval: true },
  { id: 'showBearishInflectionZones', type: 'bool', title: 'Show Bearish Inflection Zones', defval: true },
  { id: 'showBullishInflectionZones', type: 'bool', title: 'Show Bullish Inflection Zones', defval: true },
  { id: 'deleteMitigatedBoxes', type: 'bool', title: 'Delete Mitigated Zones', defval: false },
  { id: 'deleteBrokenBoxes', type: 'bool', title: 'Delete Broken Zones', defval: false },
  { id: 'dimMitigatedBoxes', type: 'bool', title: 'Dim Mitigated Zones', defval: true },
  { id: 'fullZones', type: 'bool', title: 'Expand Boxes to Swing Highs/Lows', defval: false },
  { id: 'orderBlockDuration', type: 'int', title: 'Box Extension (500 bars max)', defval: 3 },
  { id: 'x', type: 'int', title: '# of Candles for Order Blocks (1-3)', defval: 1, min: 1, max: 3 },
  { id: 'bearishBlockColor', type: 'color', title: 'Bearish Order Block Color', defval: 'rgba(0, 0, 0, 0.5)' },
  { id: 'bullishBlockColor', type: 'color', title: 'Bullish Order Block Color', defval: 'rgba(0, 0, 0, 0.5)' },
  { id: 'demandZoneColor', type: 'color', title: 'Demand Zones Color', defval: 'rgba(76, 175, 79, 0.5)' },
  { id: 'supplyZoneColor', type: 'color', title: 'Supply Zones Color', defval: 'rgba(255, 82, 82, 0.5)' },
  { id: 'bullishInflectionZoneColor', type: 'color', title: 'Bullish Inflection Zones Color', defval: 'rgba(33, 149, 243, 0.5)' },
  { id: 'bearishInflectionZoneColor', type: 'color', title: 'Bearish Inflection Zones Color', defval: 'rgba(33, 149, 243, 0.5)' },
  { id: 'plotBoSLines', type: 'bool', title: 'Show Break of Structure Lines', defval: true },
  { id: 'plotCHoCHLines', type: 'bool', title: 'Show Change of Character Lines', defval: true },
  { id: 'plotLSLines', type: 'bool', title: 'Show Liquidity Sweep Lines', defval: true },
  { id: 'plotLineLabels', type: 'bool', title: 'Show Break/Sweep Line Labels', defval: true },
  { id: 'useMeasurements', type: 'bool', title: 'Use Quantitative Measurement Labels', defval: false },
  { id: 'zigzagLineWidth', type: 'int', title: 'Width of Lines', defval: 2, min: 1, max: 10 },
  { id: 'bosLineStyle', type: 'string', title: 'BOS/CHoCH Line Style', defval: 'Solid', options: STYLES },
  { id: 'bosBullishLineColor', type: 'color', title: 'Bullish BOS Line/Label Color', defval: '#4CAF50' },
  { id: 'bosBearishLineColor', type: 'color', title: 'Bearish BOS Line/Label Color', defval: '#F23645' },
  { id: 'CHoCHColor', type: 'color', title: 'Change of Character Line/Label Color', defval: '#2962FF' },
  { id: 'LSLineColor', type: 'color', title: 'Liquidity Sweep Line/Label Color', defval: '#FF9800' },
  { id: 'plotZigZag', type: 'bool', title: 'Plot Zig-Zag Lines', defval: true },
  { id: 'plotSwingLabels', type: 'bool', title: 'Plot Swing High/Low Labels', defval: true },
  { id: 'useEfficiency', type: 'bool', title: 'Use Expansion/Compression for Swing Label Color', defval: false },
  { id: 'zigzagLineColor', type: 'color', title: 'ZigZag Line Color', defval: '#363A45' },
  { id: 'zigzagLineStyle', type: 'string', title: 'ZigZag Line Style', defval: 'Solid', options: STYLES },
  { id: 'HHHLcolor', type: 'color', title: 'Text Color (HH and HL)', defval: '#4CAF50' },
  { id: 'LLLHcolor', type: 'color', title: 'Text Color (LL and LH)', defval: '#F23645' },
  { id: 'LScolor', type: 'color', title: 'Text Color (LS)', defval: '#FF9800' },
  { id: 'HHHLcolorbg', type: 'color', title: 'Background Color (HH and HL)', defval: 'rgba(76, 175, 79, 0.15)' },
  { id: 'LLLHcolorbg', type: 'color', title: 'Background Color (LL and LH)', defval: 'rgba(255, 82, 82, 0.15)' },
  { id: 'LScolorbg', type: 'color', title: 'Background Color (LS)', defval: 'rgba(255, 153, 0, 0.15)' },
  { id: 'alertMode', type: 'int', title: 'Enable/Disable for Any Alert() Function Call↓ Alert Status→', defval: 1, min: 1, max: 1 },
  { id: 'alertShift', type: 'bool', title: 'Bullish/Bearish Shift (Order Blocks for LTF or Supply & Demand Zones for MTF)', defval: true },
  { id: 'alertBoS', type: 'bool', title: 'BoS', defval: true },
  { id: 'alertCHoCH', type: 'bool', title: 'CHoCH', defval: true },
  { id: 'alertHighsandLows', type: 'bool', title: 'Swing Highs & Lows', defval: true },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Market Structure- Zig Zag, BoS, Supply/Demand and Inflection Zones',
  shortTitle: 'Market Structure- Zig Zag, BoS, Supply/Demand and Inflection Zones',
  overlay: true,
};

export const hasAlertFunction = true;

/** plotshape() declarations: the markers of the result with the same `id` belong to them */
export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Bullish LTF Shift', style: 'triangleup', location: 'belowbar', color: String(color.new('#363A45', 75)), size: 'tiny' },
  { id: 'shape1', kind: 'shape', title: 'Bearish LTF Shift', style: 'triangledown', location: 'abovebar', color: String(color.new('#363A45', 75)), size: 'tiny' },
  { id: 'shape2', kind: 'shape', title: 'Bullish MTF Shift', style: 'triangleup', location: 'belowbar', color: '#363A45', size: 'tiny' },
  { id: 'shape3', kind: 'shape', title: 'Bearish MTF Shift', style: 'triangledown', location: 'abovebar', color: '#363A45', size: 'tiny' },
];

/** Drawing objects of the script */
export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'box'];

export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bearish LTF Shift/ New Order Block', message: 'Bearish shift occurred (LTF)! New order block available.' },
  { id: 'alert1', title: 'Bullish LTF Shift/ New Order Block', message: 'Bullish shift occurred (LTF)! New order block available.' },
  { id: 'alert2', title: 'Bullish Break of Structure (LTF)', message: 'Bullish BoS detected. (LTF)' },
  { id: 'alert3', title: 'Bearish Break of Structure (LTF)', message: 'Bearish BoS detected. (LTF)' },
  { id: 'alert4', title: 'Bullish Change of Character (LTF)', message: 'Bullish CHoCH detected. (LTF)' },
  { id: 'alert5', title: 'Bearish Change of Character (LTF)', message: 'Bearish CHoCH detected. (LTF)' },
  { id: 'alert6', title: 'Higher High (HH) LTF', message: 'Higher High (HH) detected. (LTF)' },
  { id: 'alert7', title: 'Lower High (LH) LTF', message: 'Lower High (LH) detected. (LTF)' },
  { id: 'alert8', title: 'Higher Low (HL) LTF', message: 'Higher Low (HL) detected. (LTF)' },
  { id: 'alert9', title: 'Lower Low (LL) LTF', message: 'Lower Low (LL) detected. (LTF)' },
  { id: 'alert10', title: 'Liquidity Sweep (LS) LTF', message: 'Liquidity Sweep (LS) detected. (LTF)' },
  { id: 'alert11', title: 'Bearish MTF Shift/ New Supply Zone', message: 'Bearish shift occurred (MTF)! New supply zone available.' },
  { id: 'alert12', title: 'Bullish MTF Shift/ New Demand Zone', message: 'Bullish shift occurred (MTF)! New demand zone available.' },
  { id: 'alert13', title: 'Bullish Break of Structure (MTF)', message: 'Bullish BoS detected. (MTF)' },
  { id: 'alert14', title: 'Bearish Break of Structure (MTF)', message: 'Bearish BoS detected. (MTF)' },
  { id: 'alert15', title: 'Bullish Shift (MTF, unconfirmed)', message: 'Bullish market shift detected. (MTF unconfirmed)' },
  { id: 'alert16', title: 'Bearish Shift (MTF, unconfirmed)', message: 'Bearish market shift detected. (MTF unconfirmed)' },
  { id: 'alert17', title: 'Bullish Change of Character (MTF)', message: 'Bullish CHoCH detected. (MTF)' },
  { id: 'alert18', title: 'Bearish Change of Character (MTF)', message: 'Bearish CHoCH detected. (MTF)' },
  { id: 'alert19', title: 'Higher High (HH) MTF', message: 'Higher High (HH) detected. (MTF)' },
  { id: 'alert20', title: 'Lower High (LH) MTF', message: 'Lower High (LH) detected. (MTF)' },
  { id: 'alert21', title: 'Higher Low (HL) MTF', message: 'Higher Low (HL) MTF detected. (MTF)' },
  { id: 'alert22', title: 'Lower Low (LL) MTF', message: 'Lower Low (LL) detected. (MTF)' },
  { id: 'alert23', title: 'Liquidity Sweep (LS) MTF', message: 'Liquidity Sweep (LS) detected. (MTF)' },
];

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const ge = (a: number, b: number) => gt(a, b) || eq(a, b);
/** maxHistory of the original: the swing searches look at most 5000 bars back */
const MAX_HISTORY = 5000;
/** Default box text colour of Pine v6 (the boxes have no text) */
const BOX_TEXT = '#FFFFFF';

type StyleValue = 'solid' | 'dotted' | 'dashed';
const styleOf = (s: LineStyleName): StyleValue => (s === 'Solid' ? 'solid' : s === 'Dotted' ? 'dotted' : 'dashed');
const nums = (a: ArrayLike<number | null | undefined>) => Array.from(a, (v) => (v === null || v === undefined ? NaN : Number(v)));

/**
 * request.security(syminfo.tickerid, tf, expr) without lookahead for the bar values of the original: per chart bar,
 * the bar of timeframe `tf` completed last (NaN before the first one); on an open last bar, the bar in progress.
 */
function securitySeries(bars: Bar[], tf: string, chart: ChartContext | undefined, live: boolean) {
  const chartTf = chartTimeframe(bars, chart);
  if (tf.trim() === '' || chartTf === '' || timeframe.in_seconds(tf) === timeframe.in_seconds(chartTf)) {
    return (f: (b: Bar) => number) => bars.map(f);
  }
  if (timeframe.in_seconds(tf) < timeframe.in_seconds(chartTf)) {
    throw new Error(`The timeframe "${tf}" is lower than the chart timeframe "${chartTf}": the chart bars do not have that data`);
  }
  const { htf, group, latest } = higherTimeframeBars(bars, tf, chart);
  const n = bars.length;
  return (f: (b: Bar) => number) => {
    const values = htf.map(f);
    const out = mapToChart(values, group, latest, false, false);
    if (live && n > 0) out[n - 1] = values[group[n - 1]] ?? NaN;
    return out;
  };
}

/** One entry of a box array of the original */
interface ZoneEntry { b: Box; dimmed: boolean }

export function calculate(
  bars: Bar[],
  inputs: Partial<MarketStructureZigzagBreakOfStructureInputs> = {},
  chart?: ChartContext,
): IndicatorResult & {
  markers: MarkerData[]; lines: LineDrawingData[]; boxes: BoxData[]; labels: LabelData[];
  alerts: AlertConditionState[]; alertCalls: AlertCall[];
} {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const version = cfg.version;
  const v8 = version === 'Version 8 (Institutional Order-Blocks)';
  const mode = cfg.shiftMode;
  const closeSrc = cfg.shiftSource === 'Close';
  const stallOffset = Math.trunc(cfg.stallOffset);
  const xCount = Math.trunc(cfg.x);
  const dur = Math.trunc(cfg.orderBlockDuration);
  const width = Math.trunc(cfg.zigzagLineWidth);
  const bosStyle = styleOf(cfg.bosLineStyle);
  const zzStyle = styleOf(cfg.zigzagLineStyle);
  const disp = cfg.MTFDisplacement;

  const lighterBullishColor = String(color.new(cfg.bullishBlockColor, 85));
  const lighterBearishColor = String(color.new(cfg.bearishBlockColor, 85));
  const lighterdemandZoneColor = String(color.new(cfg.demandZoneColor, 85));
  const lightersupplyZoneColor = String(color.new(cfg.supplyZoneColor, 85));
  const lighterBullishInflectionZoneColor = String(color.new(cfg.bullishInflectionZoneColor, 85));
  const lighterBearishInflectionZoneColor = String(color.new(cfg.bearishInflectionZoneColor, 85));
  const internalShiftColor = String(color.new(cfg.zigzagLineColor, 75));
  const clearRed = String(color.rgb(255, 82, 82, 100));
  const clearGreen = String(color.rgb(82, 255, 82, 100));
  const pendingBg = String(color.rgb(120, 123, 134, 50));
  const pendingText = String(color.rgb(120, 123, 134, 0));
  const clearBlack = String(color.new(color.black, 100));

  // request.security values
  const live = !lastBarConfirmedOf(chart);
  const sec = securitySeries(bars, cfg.htf, chart, live);
  const hO = sec((b) => b.open);
  const hH = sec((b) => b.high);
  const hL = sec((b) => b.low);
  const hC = sec((b) => b.close);
  const hSrc = sec((b) => {
    switch (cfg.srcInput) {
      case 'Open': return b.open;
      case 'Close': return b.close;
      case 'HL2': return (b.high + b.low) / 2;
      case 'HLC3': return (b.high + b.low + b.close) / 3;
      case 'OHLC4': return (b.open + b.high + b.low + b.close) / 4;
      default: return (b.high + b.low + b.close + b.close) / 4;
    }
  });
  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);
  const close = bars.map((b) => b.close);
  const open = bars.map((b) => b.open);

  const smaSource = nums(taCore.sma(hSrc, stallOffset));
  const smaClose = nums(taCore.sma(hC, Math.trunc(cfg.smaLength)));
  const smaClose2 = nums(taCore.sma(hC, Math.trunc(cfg.smaLength2)));
  const smaClose3 = nums(taCore.sma(hC, Math.trunc(cfg.smaLength3)));
  const highestPrice = nums(taCore.highest(hH, stallOffset));
  const lowestPrice = nums(taCore.lowest(hL, stallOffset));
  const regLine = nums(taCore.linreg(hSrc, stallOffset, 0));
  const atr = nums(taCore.atr(stallOffset, high, low, close));
  const atrAvg = nums(taCore.sma(atr, stallOffset));
  const lowestSrc = nums(taCore.lowest(hSrc, stallOffset));
  const highestSrc = nums(taCore.highest(hSrc, stallOffset));
  const hH1 = hH.map((_v, i) => (i > 0 ? hH[i - 1] : NaN));
  const hL1 = hL.map((_v, i) => (i > 0 ? hL[i - 1] : NaN));
  const zoneHighArr = nums(taCore.highest(hH1, xCount));
  const zoneLowArr = nums(taCore.lowest(hL1, xCount));

  resetDrawings();
  const held = {
    earlyBullShiftBox: varDrawing<Box>(), earlyBearShiftBox: varDrawing<Box>(),
    earlyBullShiftLabel: varDrawing<Label>(), earlyBearShiftLabel: varDrawing<Label>(),
    lastDemandZone: varDrawing<Box>(), lastSupplyZone: varDrawing<Box>(),
    upCHoCHLine: varDrawing<Line>(), downCHoCHLine: varDrawing<Line>(),
    upCHochLabel: varDrawing<Label>(), downCHoCHLabel: varDrawing<Label>(),
    lastBullBoSLine: varDrawing<Line>(), lastBullBoSLabel: varDrawing<Label>(),
    lastBearBoSLine: varDrawing<Line>(), lastBearBoSLabel: varDrawing<Label>(),
    HTFBullishBoSLine: varDrawing<Line>(), HTFBullishBoSLabel: varDrawing<Label>(),
    HTFBearishBoSLine: varDrawing<Line>(), HTFBearishBoSLabel: varDrawing<Label>(),
  };
  const newLine = (x1: number, y1: number, x2: number, y2: number, col: string, style: StyleValue) =>
    line.new(x1, y1, x2, y2, 'bar_index', 'none', col, style, width);
  const newLabel = (x: number, y: number, text: string, col: string, style: 'label_up' | 'label_down', textCol: string, size: string) =>
    label.new(x, y, text, 'bar_index', 'price', col, style, textCol, size);
  const newBox = (left: number, top: number, right: number, bottom: number, border: string, bg: string) =>
    box.new(left, top, right, bottom, border, width, 'solid', 'none', 'bar_index', bg, '', 'auto', BOX_TEXT);
  const midOf = (a: number, b: number) => Math.floor((a + b) / 2);
  const measure = (v: number, text: string) => (cfg.useMeasurements ? str.tostring(v) : text);

  // box arrays of the original; deleted boxes are dropped (their getters are na and their setters do nothing)
  const bullishBoxes: ZoneEntry[] = [];
  const bearishBoxes: ZoneEntry[] = [];
  const demandZones: ZoneEntry[] = [];
  const supplyZones: ZoneEntry[] = [];
  const bullishInflectionZones: ZoneEntry[] = [];
  const bearishInflectionZones: ZoneEntry[] = [];
  const alive = (e: ZoneEntry) => !Number.isNaN(box.get_right(e.b));
  const prune = (arr: ZoneEntry[]) => {
    for (let k = arr.length - 1; k >= 0; k--) if (!alive(arr[k])) arr.splice(k, 1);
  };
  const deleteWhere = (arr: ZoneEntry[], cond: (b: Box) => boolean) => {
    for (let k = arr.length - 1; k >= 0; k--) {
      if (cond(arr[k].b)) {
        box.delete(arr[k].b);
        arr.splice(k, 1);
      }
    }
  };
  const dimWhere = (arr: ZoneEntry[], cond: (b: Box) => boolean, bg: string, border: string) => {
    for (const e of arr) {
      if (!e.dimmed && cond(e.b)) {
        box.set_bgcolor(e.b, bg);
        box.set_border_color(e.b, border);
        e.dimmed = true;
      }
    }
  };

  // highest HtfHigh / lowest HtfLow from bar `start` to bar i, at most MAX_HISTORY - 1 bars back (first one on ties)
  const searchHigh = (start: number, i: number): [number, number] => {
    let best = NaN;
    let idx = NaN;
    if (Number.isNaN(start)) return [best, idx];
    for (let k = Math.max(start, i - MAX_HISTORY + 1, 0); k <= i; k++) {
      const v = hH[k];
      if (!Number.isNaN(v) && (Number.isNaN(best) || gt(v, best))) {
        best = v;
        idx = k;
      }
    }
    return [best, idx];
  };
  const searchLow = (start: number, i: number): [number, number] => {
    let best = NaN;
    let idx = NaN;
    if (Number.isNaN(start)) return [best, idx];
    for (let k = Math.max(start, i - MAX_HISTORY + 1, 0); k <= i; k++) {
      const v = hL[k];
      if (!Number.isNaN(v) && (Number.isNaN(best) || lt(v, best))) {
        best = v;
        idx = k;
      }
    }
    return [best, idx];
  };

  // ta.crossover / ta.crossunder call sites (the two of the unconfirmed shifts run only when the left side is true)
  const crossUnconfBull = callsite.crossover();
  const crossUnconfBear = callsite.crossunder();
  const crossEarlyBear = callsite.crossover();
  const crossEarlyBull = callsite.crossunder();
  const crossBullCHoCH = callsite.crossover();
  const crossBearCHoCH = callsite.crossunder();

  // state (`var` variables of the original)
  let extRunningHigh = NaN, extRunningLow = NaN, extLastWasDemand = false, extFirstSignal = true;
  let lastSignal = 0, runningLowestHigh = NaN, runningHighestLow = NaN;
  let lastBullIndex = NaN, lastBearIndex = NaN, upTrigger = false, downTrigger = false;
  let newBull = false, newBear = false, bullishCandle = false, bearishCandle = false;
  let bullOBHigh = NaN, bullOBLow = NaN, bullOBIndex = NaN, bearOBHigh = NaN, bearOBLow = NaN, bearOBIndex = NaN;
  let lastInternalShift = 0;
  let prevSwingHigh = NaN, prevSwingLow = NaN;
  let isHH = false, isHL = false, isLL = false, isLH = false, isLiquiditySweep = false;
  let lastSwingLowIndex = NaN, lastSwingHighIndex = NaN, lastSwingHigh = NaN, lastSwingLow = NaN;
  let controlLocalHigh = NaN, controlLocalLow = NaN, controlLocalHighIndex = NaN, controlLocalLowIndex = NaN;
  let lastShiftType = NaN;
  let localHigh = NaN, localHighIndex = NaN, localLow = NaN, localLowIndex = NaN;
  let bullishBOSOccurred = false, bearishBOSOccurred = false, canBreakBullish = true, canBreakBearish = true;
  let lastBullishBoSBar = NaN, lastBearishBoSBar = NaN;
  let bullInflectionHigh = NaN, bearInflectionLow = NaN;
  let prevHighDisplacement = NaN, prevLowDisplacement = NaN;
  let CHoCHCondtion = 0, canPlotCHoCH = false, CHoCHHIGH = NaN, CHoCHLOW = NaN;
  let lastSwingHigh2 = NaN, lastSwingLow2 = NaN;
  let ShiftLocalLow = NaN, ShiftLocalLowIndex = NaN, ShiftLocalHigh = NaN, ShiftLocalHighIndex = NaN;
  let bullishBOSOccurredShift = false, bearishBOSOccurredShift = false, isLiquiditySweepMTF = false;
  let earlyBullShiftLow = NaN, earlyBearShiftHigh = NaN;
  let lastExtSwingHigh = NaN, lastExtSwingLow = NaN, lastExtSwingHighIndex = NaN, lastExtSwingLowIndex = NaN;
  let HTFLocalHigh = NaN, HTFLocalHighIndex = NaN, HTFLocalLow = NaN, HTFLocalLowIndex = NaN;
  let bullishInflectionHigh = NaN, bullishInflectionLow = NaN, bullishInflectionLeft = NaN, bullishInflectionRight = NaN;
  let bearishInflectionHigh = NaN, bearishInflectionLow = NaN, bearishInflectionLeft = NaN, bearishInflectionRight = NaN;
  let canPlotHTFBoSBull = false, canPlotHTFBoSBear = false;
  let prevHTFLocalHigh = NaN, prevHTFLocalHighIndex = NaN, prevHTFLocalLow = NaN, prevHTFLocalLowIndex = NaN;
  let isLiquiditySweepHTF = false;
  let lastHTFBoSType = 0, HTFBullishBoSOccurred = false, HTFBearishBoSOccurred = false;
  let bullishShiftOccurredAlert = false, bearishShiftOccurredAlert = false;
  let bullishBoSOcurredAlert = false, bearishBoSOcurredAlert = false;
  let bearishCHoCHOccurredAlert = false, bullishCHoCHOccurredAlert = false;
  let HHOccurredAlert = false, LHOccurredAlert = false, LLOccurredAlert = false, HLOccurredAlert = false, LSOccurredAlert = false;
  // ta.highestSince / ta.lowestSince of the imported ta library (zoneHigh2 / zoneLow2)
  let zoneHigh2 = NaN, zoneLow2 = NaN;
  let prevBarLocalHigh = NaN, prevBarLocalLow = NaN;

  const markers: MarkerData[] = [];
  const alertCalls: AlertCall[] = [];
  const flags: boolean[][] = alertConditions.map(() => new Array<boolean>(n).fill(false));
  const interval = barInterval(bars);
  const T = (index: number) => barTime(bars, index, interval);

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const t = bars[i].time as number;
    const HtfOpen = hO[i], HtfHigh = hH[i], HtfLow = hL[i], HtfClose = hC[i];

    // === Area (version 6)
    const priceDifference = highestPrice[i] - lowestPrice[i];
    const direction = i >= stallOffset && ge(HtfClose, hC[i - stallOffset]) ? 1 : -1;
    const area = stallOffset * priceDifference * direction;
    const isPos = gt(area, 0);
    const isNeg = lt(area, 0);
    // === Regression MA (version 9)
    const regUp = i > 0 && gt(regLine[i], regLine[i - 1]);
    const regDown = i > 0 && lt(regLine[i], regLine[i - 1]);
    // === Institutional order blocks (version 8)
    if (lt(HtfClose, HtfOpen)) {
      bullOBHigh = HtfHigh;
      bullOBLow = HtfLow;
      bullOBIndex = i;
    }
    if (gt(HtfClose, HtfOpen)) {
      bearOBLow = HtfLow;
      bearOBHigh = HtfHigh;
      bearOBIndex = i;
    }
    const bullishOB = gt(HtfClose, bullOBHigh);
    const bearishOB = lt(HtfClose, bearOBLow);
    // === SMA (version 2), ATR (version 3), loopback (version 5)
    const smaUp = i > 0 && gt(smaSource[i], smaSource[i - 1]);
    const smaDown = i > 0 && lt(smaSource[i], smaSource[i - 1]);
    const atrExpanding = gt(atr[i], atrAvg[i]);
    const upATR = atrExpanding && gt(close[i], open[i]) && i > 0 && gt(close[i], high[i - 1]);
    const downATR = atrExpanding && lt(close[i], open[i]) && i > 0 && lt(close[i], low[i - 1]);
    const downStall = eq(hSrc[i], lowestSrc[i]);
    const upStall = eq(hSrc[i], highestSrc[i]);

    // === Displacement (version 4)
    let demandOccured = false;
    let supplyOccured = false;
    if (Number.isNaN(extRunningHigh)) {
      extRunningHigh = high[i];
      extRunningLow = low[i];
    }
    extRunningHigh = Math.max(extRunningHigh, high[i]);
    extRunningLow = Math.min(extRunningLow, low[i]);
    const breakerBullish = closeSrc ? close[i] : high[i];
    const breakerBearish = closeSrc ? close[i] : low[i];
    if (extFirstSignal || !extLastWasDemand) {
      if (gt(breakerBullish, extRunningLow + disp) && gt(close[i], open[i])) {
        demandOccured = true;
        extLastWasDemand = true;
        extFirstSignal = false;
        extRunningHigh = high[i];
        extRunningLow = low[i];
      }
    }
    if (extFirstSignal || extLastWasDemand) {
      if (lt(breakerBearish, extRunningHigh - disp) && lt(close[i], open[i])) {
        supplyOccured = true;
        extLastWasDemand = false;
        extFirstSignal = false;
        extRunningHigh = high[i];
        extRunningLow = low[i];
      }
    }
    if (demandOccured) supplyOccured = false;
    if (supplyOccured) demandOccured = false;

    // === Smart engulfments (version 1)
    const hC1 = i > 0 ? hC[i - 1] : NaN, hO1 = i > 0 ? hO[i - 1] : NaN;
    const starterBull = lt(hC1, hO1) && gt(HtfClose, HtfOpen) && gt(HtfClose, hH1[i]);
    const starterBear = gt(hC1, hO1) && lt(HtfClose, HtfOpen) && lt(HtfClose, hL1[i]);
    if (lastSignal === 0) {
      if (starterBull) {
        lastSignal = 1;
        runningHighestLow = HtfLow;
      } else if (starterBear) {
        lastSignal = -1;
        runningLowestHigh = HtfHigh;
      }
    }
    if (lastSignal === -1) {
      runningLowestHigh = Number.isNaN(runningLowestHigh) ? HtfHigh : Math.min(runningLowestHigh, HtfHigh);
    } else if (lastSignal === 1) {
      runningHighestLow = Number.isNaN(runningHighestLow) ? HtfLow : Math.max(runningHighestLow, HtfLow);
    }
    if (closeSrc) {
      newBull = lastSignal === -1 && !Number.isNaN(runningLowestHigh) && gt(HtfClose, runningLowestHigh);
      newBear = lastSignal === 1 && !Number.isNaN(runningHighestLow) && lt(HtfClose, runningHighestLow);
    } else {
      newBull = gt(HtfHigh, hH1[i]);
      newBear = lt(HtfLow, hL1[i]);
    }
    if (newBull) {
      lastSignal = 1;
      runningLowestHigh = NaN;
      runningHighestLow = HtfLow;
    } else if (newBear) {
      lastSignal = -1;
      runningHighestLow = NaN;
      runningLowestHigh = HtfHigh;
    }

    // === Candles (version 7)
    if (closeSrc) {
      bullishCandle = lt(HtfOpen, HtfClose);
      bearishCandle = gt(HtfOpen, HtfClose);
    } else {
      bullishCandle = gt(HtfHigh - HtfOpen, HtfOpen - HtfLow);
      bearishCandle = lt(HtfHigh - HtfOpen, HtfOpen - HtfLow);
    }

    // === Trigger
    switch (version) {
      case 'Version 1 (Original, Smart Engulfments)': upTrigger = newBull; downTrigger = newBear; break;
      case 'Version 2 (SMA)': upTrigger = smaUp; downTrigger = smaDown; break;
      case 'Version 3 (ATR)': upTrigger = upATR; downTrigger = downATR; break;
      case 'Version 4 (Displacement)': upTrigger = demandOccured; downTrigger = supplyOccured; break;
      case 'Version 5 (Loopback)': upTrigger = upStall; downTrigger = downStall; break;
      case 'Version 6 (Area (Time x Price Difference))': upTrigger = isPos; downTrigger = isNeg; break;
      case 'Version 7 (Candles)': upTrigger = bullishCandle; downTrigger = bearishCandle; break;
      case 'Version 8 (Institutional Order-Blocks)': upTrigger = bullishOB; downTrigger = bearishOB; break;
      case 'Version 9 (Regression MA)': upTrigger = regUp; downTrigger = regDown; break;
    }

    // === Internal (LTF) shifts
    if (upTrigger) lastBullIndex = i > 0 ? i - 1 : NaN;
    if (downTrigger) lastBearIndex = i > 0 ? i - 1 : NaN;
    const allowInternalShiftBearish = downTrigger && lastInternalShift !== -1;
    const allowInternalShiftBullish = upTrigger && lastInternalShift !== 1;
    let plotLTFBearishShift = false;
    let plotLTFBullishShift = false;
    if (allowInternalShiftBearish) {
      plotLTFBearishShift = true;
      lastInternalShift = -1;
    }
    if (allowInternalShiftBullish) {
      plotLTFBullishShift = true;
      lastInternalShift = 1;
    }
    if (plotLTFBullishShift) {
      markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: internalShiftColor, size: 'tiny', id: 'shape0' });
    }
    if (plotLTFBearishShift) {
      markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: internalShiftColor, size: 'tiny', id: 'shape1' });
    }

    // === Delete / dim zones
    for (const arr of [bullishBoxes, bearishBoxes, demandZones, supplyZones, bullishInflectionZones, bearishInflectionZones]) prune(arr);
    if (cfg.deleteBrokenBoxes) {
      deleteWhere(bullishBoxes, (b) => lt(HtfClose, box.get_bottom(b)));
      deleteWhere(bearishBoxes, (b) => gt(HtfClose, box.get_top(b)));
      deleteWhere(demandZones, (b) => lt(HtfClose, box.get_bottom(b)));
      deleteWhere(supplyZones, (b) => gt(HtfClose, box.get_top(b)));
    }
    if (cfg.deleteMitigatedBoxes) {
      deleteWhere(bullishBoxes, (b) => lt(HtfLow, box.get_top(b)));
      deleteWhere(bearishBoxes, (b) => gt(HtfHigh, box.get_bottom(b)));
      deleteWhere(demandZones, (b) => lt(HtfLow, box.get_top(b)));
      deleteWhere(supplyZones, (b) => gt(HtfHigh, box.get_bottom(b)));
    }
    if (cfg.dimMitigatedBoxes) {
      dimWhere(bullishBoxes, (b) => lt(HtfLow, box.get_top(b)), lighterBullishColor, lighterBullishColor);
      dimWhere(bearishBoxes, (b) => gt(HtfHigh, box.get_bottom(b)), lighterBearishColor, lighterBearishColor);
      dimWhere(demandZones, (b) => lt(HtfLow, box.get_top(b)), lighterdemandZoneColor, lighterdemandZoneColor);
      dimWhere(supplyZones, (b) => gt(HtfHigh, box.get_bottom(b)), lightersupplyZoneColor, lightersupplyZoneColor);
      dimWhere(bullishInflectionZones, (b) => lt(HtfLow, box.get_top(b)), lighterBullishInflectionZoneColor, lighterdemandZoneColor);
      dimWhere(bearishInflectionZones, (b) => gt(HtfHigh, box.get_bottom(b)), lighterBearishInflectionZoneColor, lightersupplyZoneColor);
    }

    const zoneHigh = zoneHighArr[i];
    const zoneLow = zoneLowArr[i];
    let controlHighOccured = false;
    let controlLowOccured = false;

    // === LTF swing highs / lows
    if (plotLTFBearishShift) {
      const [hh, hi] = searchHigh(Math.max(lastBullIndex, i - MAX_HISTORY), i);
      lastSwingHigh = localHigh;
      lastSwingHighIndex = localHighIndex;
      localHigh = hh;
      localHighIndex = hi;
      if (lastShiftType === 1) {
        controlLocalHigh = localHigh;
        controlLocalHighIndex = localHighIndex;
        controlHighOccured = true;
      }
      if (lt(localHigh, lastSwingHigh)) {
        controlLocalHigh = localHigh;
        controlLocalHighIndex = localHighIndex;
        controlHighOccured = true;
      }
    }
    if (plotLTFBullishShift) {
      const [ll, li] = searchLow(Math.max(lastBearIndex, i - MAX_HISTORY), i);
      lastSwingLow = localLow;
      lastSwingLowIndex = localLowIndex;
      localLow = ll;
      localLowIndex = li;
      if (lastShiftType === -1) {
        controlLocalLow = localLow;
        controlLocalLowIndex = localLowIndex;
        controlLowOccured = true;
      }
      if (gt(localLow, lastSwingLow)) {
        controlLocalLow = localLow;
        controlLocalLowIndex = localLowIndex;
        controlLowOccured = true;
      }
    }

    // === Order blocks
    let orderBlockLow: number, orderBlockHigh: number, bullBlockIndex: number, bearBlockIndex: number;
    if (cfg.fullZones) {
      orderBlockLow = localLow;
      orderBlockHigh = localHigh;
      bullBlockIndex = localLowIndex;
      bearBlockIndex = localHighIndex;
    } else {
      orderBlockLow = zoneLow;
      orderBlockHigh = zoneHigh;
      bullBlockIndex = v8 ? bullOBIndex : (i >= xCount ? i - xCount : NaN);
      bearBlockIndex = v8 ? bearOBIndex : (i >= xCount ? i - xCount : NaN);
    }
    if (!v8) {
      if (plotLTFBullishShift && cfg.showBullishOrderBlocks) {
        bullishBoxes.push({ b: newBox(bullBlockIndex, zoneHigh, i + dur, orderBlockLow, cfg.bullishBlockColor, cfg.bullishBlockColor), dimmed: false });
      }
      if (plotLTFBearishShift && cfg.showBearishOrderBlocks) {
        bearishBoxes.push({ b: newBox(bearBlockIndex, orderBlockHigh, i + dur, zoneLow, cfg.bearishBlockColor, cfg.bearishBlockColor), dimmed: false });
      }
    } else {
      if (plotLTFBullishShift && cfg.showBullishOrderBlocks) {
        bullishBoxes.push({ b: newBox(bullBlockIndex, bullOBHigh, i + dur, bullOBLow, cfg.bullishBlockColor, cfg.bullishBlockColor), dimmed: false });
      }
      if (plotLTFBearishShift && cfg.showBearishOrderBlocks) {
        bearishBoxes.push({ b: newBox(bearBlockIndex, bearOBHigh, i + dur, bearOBLow, cfg.bearishBlockColor, cfg.bearishBlockColor), dimmed: false });
      }
    }

    // === LTF break of structure
    const bullishBoS = canBreakBullish && gt(smaClose[i], localHigh);
    const bearishBoS = canBreakBearish && lt(smaClose[i], localLow);
    if (bullishBoS) {
      canBreakBullish = false;
      bullishBOSOccurred = true;
      if (cfg.plotBoSLines && mode === 'LTF') {
        held.lastBullBoSLine.value = newLine(localHighIndex, localHigh, i, localHigh, cfg.bosBullishLineColor, bosStyle);
        if (cfg.plotLineLabels) {
          held.lastBullBoSLabel.value = newLabel(midOf(localHighIndex, i), localHigh, measure(i - localHighIndex, 'BoS'),
            clearRed, 'label_down', cfg.bosBullishLineColor, 'tiny');
        }
      }
      bearInflectionLow = localLow;
    }
    if (bearishBoS) {
      canBreakBearish = false;
      bearishBOSOccurred = true;
      if (cfg.plotBoSLines && mode === 'LTF') {
        held.lastBearBoSLine.value = newLine(localLowIndex, localLow, i, localLow, cfg.bosBearishLineColor, bosStyle);
        if (cfg.plotLineLabels) {
          held.lastBearBoSLabel.value = newLabel(midOf(localLowIndex, i), localLow, measure(i - localLowIndex, 'BoS'),
            clearRed, 'label_up', cfg.bosBearishLineColor, 'tiny');
        }
      }
      bullInflectionHigh = localHigh;
    }
    // ta.change(localHigh) != 0 (na when one of the two values is na)
    const chHigh = localHigh - prevBarLocalHigh;
    if (!Number.isNaN(chHigh) && !eq(chHigh, 0)) canBreakBullish = true;
    const chLow = localLow - prevBarLocalLow;
    if (!Number.isNaN(chLow) && !eq(chLow, 0)) canBreakBearish = true;
    prevBarLocalHigh = localHigh;
    prevBarLocalLow = localLow;

    // === MTF shifts
    const canMTFBullishShift = Number.isNaN(lastShiftType) || lastShiftType !== 1;
    const canMTFBearishShift = Number.isNaN(lastShiftType) || lastShiftType !== -1;
    const MTFBullishShift = !Number.isNaN(bullInflectionHigh) && canMTFBullishShift && gt(smaClose[i], controlLocalHigh);
    const MTFBearishShift = !Number.isNaN(bearInflectionLow) && canMTFBearishShift && lt(smaClose[i], controlLocalLow);
    const unconfirmedBullShift = !Number.isNaN(bullInflectionHigh) && canMTFBullishShift && crossUnconfBull(HtfClose, controlLocalHigh);
    const unconfirmedBearShift = !Number.isNaN(bearInflectionLow) && canMTFBearishShift && crossUnconfBear(HtfClose, controlLocalLow);

    if (unconfirmedBearShift && cfg.showDemandZones) {
      if (held.earlyBearShiftBox.value) box.delete(held.earlyBearShiftBox.value);
      if (held.earlyBearShiftLabel.value) label.delete(held.earlyBearShiftLabel.value);
      held.earlyBearShiftBox.value = newBox(controlLocalLowIndex, localHigh, i + dur, controlLocalLow, cfg.supplyZoneColor, pendingBg);
      held.earlyBearShiftLabel.value = newLabel(Math.floor((controlLocalLowIndex + (i + dur)) / 2), controlLocalLow, 'Pending',
        clearBlack, 'label_up', pendingText, 'small');
      earlyBearShiftHigh = localHigh;
    }
    if (unconfirmedBullShift && cfg.showSupplyZones) {
      if (held.earlyBullShiftBox.value) box.delete(held.earlyBullShiftBox.value);
      if (held.earlyBullShiftLabel.value) label.delete(held.earlyBullShiftLabel.value);
      held.earlyBullShiftBox.value = newBox(controlLocalHighIndex, controlLocalHigh, i + dur, localLow, cfg.demandZoneColor, pendingBg);
      held.earlyBullShiftLabel.value = newLabel(Math.floor((controlLocalHighIndex + (i + dur)) / 2), controlLocalHigh, 'Pending',
        clearBlack, 'label_down', pendingText, 'small');
      earlyBullShiftLow = localLow;
    }
    if (crossEarlyBear(smaClose[i], earlyBearShiftHigh) || supplyOccured) {
      if (held.earlyBearShiftBox.value) box.delete(held.earlyBearShiftBox.value);
      if (held.earlyBearShiftLabel.value) label.delete(held.earlyBearShiftLabel.value);
    }
    if (crossEarlyBull(smaClose[i], earlyBullShiftLow) || demandOccured) {
      if (held.earlyBullShiftBox.value) box.delete(held.earlyBullShiftBox.value);
      if (held.earlyBullShiftLabel.value) label.delete(held.earlyBullShiftLabel.value);
    }
    if (MTFBullishShift) {
      markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: cfg.zigzagLineColor, size: 'tiny', id: 'shape2' });
    }
    if (MTFBearishShift) {
      markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: cfg.zigzagLineColor, size: 'tiny', id: 'shape3' });
    }

    // === MTF swing highs / lows
    // ta.highestSince(controlLowOccured, high), ta.lowestSince(controlHighOccured, low)
    if (controlLowOccured) zoneHigh2 = high[i];
    zoneHigh2 = Number.isNaN(zoneHigh2) ? high[i] : Math.max(high[i], zoneHigh2);
    if (controlHighOccured) zoneLow2 = low[i];
    zoneLow2 = Number.isNaN(zoneLow2) ? low[i] : Math.min(low[i], zoneLow2);

    if (MTFBearishShift) {
      const [hh, hi] = searchHigh(Number.isNaN(lastBullishBoSBar) ? i - MAX_HISTORY : ShiftLocalLowIndex, i);
      lastExtSwingHigh = ShiftLocalHigh;
      lastExtSwingHighIndex = ShiftLocalHighIndex;
      ShiftLocalHigh = hh;
      ShiftLocalHighIndex = hi;
      lastShiftType = -1;
      lastBearishBoSBar = i;
    }
    if (MTFBullishShift) {
      const [ll, li] = searchLow(Number.isNaN(lastBearishBoSBar) ? i - MAX_HISTORY : ShiftLocalHighIndex, i);
      lastExtSwingLow = ShiftLocalLow;
      lastExtSwingLowIndex = ShiftLocalLowIndex;
      ShiftLocalLow = ll;
      ShiftLocalLowIndex = li;
      lastShiftType = 1;
      lastBullishBoSBar = i;
    }
    const supplyHigh = cfg.fullZones ? ShiftLocalHigh : zoneHigh2;
    const demandLow = cfg.fullZones ? ShiftLocalLow : zoneLow2;
    const supplyZoneIndex = cfg.fullZones ? ShiftLocalHighIndex : controlLocalHighIndex;
    const demandZoneIndex = cfg.fullZones ? ShiftLocalLowIndex : controlLocalLowIndex;

    if (MTFBearishShift) {
      if (cfg.showSupplyZones) {
        if (held.earlyBearShiftBox.value) box.delete(held.earlyBearShiftBox.value);
        if (held.earlyBearShiftLabel.value) label.delete(held.earlyBearShiftLabel.value);
        held.lastSupplyZone.value = newBox(controlLocalLowIndex, supplyHigh, i + dur, controlLocalLow, cfg.supplyZoneColor, cfg.supplyZoneColor);
        supplyZones.push({ b: held.lastSupplyZone.value, dimmed: false });
      }
      if (cfg.plotCHoCHLines && mode === 'LTF') {
        held.downCHoCHLine.value = newLine(localLowIndex, localLow, i, localLow, cfg.CHoCHColor, bosStyle);
        if (cfg.plotLineLabels) {
          held.downCHoCHLabel.value = newLabel(midOf(localLowIndex, i), localLow, measure(i - localLowIndex, 'CHoCH'),
            clearRed, 'label_up', cfg.CHoCHColor, 'tiny');
        }
      }
      if (held.lastBearBoSLine.value && cfg.plotCHoCHLines) {
        line.delete(held.lastBearBoSLine.value);
        held.lastBearBoSLine.value = undefined;
      }
      if (held.lastBearBoSLabel.value && cfg.plotCHoCHLines) {
        label.delete(held.lastBearBoSLabel.value);
        held.lastBearBoSLabel.value = undefined;
      }
      bullishInflectionHigh = supplyHigh;
      bullishInflectionLow = controlLocalLow;
      bullishInflectionLeft = supplyZoneIndex;
      bullishInflectionRight = i;
    }
    if (MTFBullishShift) {
      if (cfg.showDemandZones) {
        if (held.earlyBullShiftBox.value) box.delete(held.earlyBullShiftBox.value);
        if (held.earlyBullShiftLabel.value) label.delete(held.earlyBullShiftLabel.value);
        held.lastDemandZone.value = newBox(controlLocalHighIndex, controlLocalHigh, i + dur, demandLow, cfg.demandZoneColor, cfg.demandZoneColor);
        demandZones.push({ b: held.lastDemandZone.value, dimmed: false });
      }
      if (cfg.plotCHoCHLines && mode === 'LTF') {
        held.upCHoCHLine.value = newLine(localHighIndex, localHigh, i, localHigh, cfg.CHoCHColor, bosStyle);
        if (cfg.plotLineLabels) {
          held.upCHochLabel.value = newLabel(midOf(localHighIndex, i), localHigh, measure(i - localHighIndex, 'CHoCH'),
            clearRed, 'label_down', cfg.CHoCHColor, 'tiny');
        }
      }
      if (held.lastBullBoSLine.value && cfg.plotCHoCHLines) {
        line.delete(held.lastBullBoSLine.value);
        held.lastBullBoSLine.value = undefined;
      }
      if (held.lastBullBoSLabel.value && cfg.plotCHoCHLines) {
        label.delete(held.lastBullBoSLabel.value);
        held.lastBullBoSLabel.value = undefined;
      }
      bearishInflectionHigh = controlLocalHigh;
      bearishInflectionLow = demandLow;
      bearishInflectionLeft = demandZoneIndex;
      bearishInflectionRight = i;
    }

    // === MTF break of structure 1
    if (gt(smaClose2[i], ShiftLocalHigh)) bullishBOSOccurredShift = true;
    if (lt(smaClose2[i], ShiftLocalLow)) bearishBOSOccurredShift = true;

    // === Zig-zag and swing labels
    const swingLabel = (x: number, y: number, text: string, bg: string, style: 'label_up' | 'label_down', textCol: string,
      expansionBg: string, expansionText: string, size: string) => {
      newLabel(x, y, text, cfg.useEfficiency ? expansionBg : bg, style, cfg.useEfficiency ? expansionText : textCol, size);
    };
    if (plotLTFBullishShift && mode === 'LTF') {
      if (!Number.isNaN(prevSwingLow) && cfg.plotZigZag) {
        newLine(localHighIndex, localHigh, localLowIndex, localLow, cfg.zigzagLineColor, zzStyle);
      }
      if (!Number.isNaN(prevSwingLow)) {
        isLL = lt(localLow, prevSwingLow);
        isHL = gt(localLow, prevSwingLow);
      }
      const height = Math.abs(localHigh - localLow);
      const lowGreen = Number.isNaN(prevLowDisplacement) ? true : lt(height, prevLowDisplacement);
      const expBg = lowGreen ? cfg.HHHLcolorbg : cfg.LLLHcolorbg;
      const expText = lowGreen ? cfg.HHHLcolor : cfg.LLLHcolor;
      if (isLL) {
        if (bearishBOSOccurred) {
          if (cfg.plotSwingLabels) swingLabel(localLowIndex, localLow, measure(height, 'LL'), cfg.LLLHcolorbg, 'label_up', cfg.LLLHcolor, expBg, expText, 'tiny');
          isLiquiditySweep = false;
        } else {
          if (cfg.plotSwingLabels) swingLabel(localLowIndex, localLow, measure(height, 'LS'), cfg.LScolorbg, 'label_up', cfg.LScolor, expBg, expText, 'tiny');
          isLiquiditySweep = true;
        }
      } else {
        isLiquiditySweep = false;
      }
      bearishBOSOccurred = false;
      if (isHL && cfg.plotSwingLabels) {
        swingLabel(localLowIndex, localLow, measure(height, 'HL'), cfg.HHHLcolorbg, 'label_up', cfg.HHHLcolor, expBg, expText, 'tiny');
      }
      prevLowDisplacement = height;
      prevSwingLow = localLow;
    }
    if (MTFBullishShift && mode === 'MTF') {
      if (!Number.isNaN(prevSwingLow) && cfg.plotZigZag) {
        newLine(ShiftLocalHighIndex, ShiftLocalHigh, ShiftLocalLowIndex, ShiftLocalLow, cfg.zigzagLineColor, zzStyle);
      }
      if (!Number.isNaN(prevSwingLow)) {
        isLL = lt(ShiftLocalLow, prevSwingLow);
        isHL = gt(ShiftLocalLow, prevSwingLow);
      }
      const height = Math.abs(ShiftLocalHigh - ShiftLocalLow);
      const lowGreen = Number.isNaN(prevLowDisplacement) ? true : lt(height, prevLowDisplacement);
      const expBg = lowGreen ? cfg.HHHLcolorbg : cfg.LLLHcolorbg;
      const expText = lowGreen ? cfg.HHHLcolor : cfg.LLLHcolor;
      if (isLL) {
        if (bearishBOSOccurredShift) {
          if (cfg.plotSwingLabels) swingLabel(ShiftLocalLowIndex, ShiftLocalLow, measure(height, 'LL'), cfg.LLLHcolorbg, 'label_up', cfg.LLLHcolor, expBg, expText, 'small');
          isLiquiditySweepMTF = false;
        } else {
          if (cfg.plotSwingLabels) swingLabel(ShiftLocalLowIndex, ShiftLocalLow, measure(height, 'LS'), cfg.LScolorbg, 'label_up', cfg.LScolor, expBg, expText, 'small');
          isLiquiditySweepMTF = true;
        }
      }
      if (isHL && cfg.plotSwingLabels) {
        swingLabel(ShiftLocalLowIndex, ShiftLocalLow, measure(height, 'HL'), cfg.HHHLcolorbg, 'label_up', cfg.HHHLcolor, expBg, expText, 'small');
      }
      prevLowDisplacement = height;
      prevSwingLow = ShiftLocalLow;
      lastSwingLow2 = ShiftLocalLow;
      bearishBOSOccurredShift = false;
    }
    if (plotLTFBearishShift && mode === 'LTF') {
      if (!Number.isNaN(prevSwingHigh) && cfg.plotZigZag) {
        newLine(localLowIndex, localLow, localHighIndex, localHigh, cfg.zigzagLineColor, zzStyle);
      }
      if (!Number.isNaN(prevSwingHigh)) {
        isHH = gt(localHigh, prevSwingHigh);
        isLH = lt(localHigh, prevSwingHigh);
      }
      const height = Math.abs(localHigh - localLow);
      const highGreen = Number.isNaN(prevHighDisplacement) ? true : ge(height, prevHighDisplacement);
      const expBg = highGreen ? cfg.HHHLcolorbg : cfg.LLLHcolorbg;
      const expText = highGreen ? cfg.HHHLcolor : cfg.LLLHcolor;
      if (isHH) {
        if (bullishBOSOccurred) {
          if (cfg.plotSwingLabels) swingLabel(localHighIndex, localHigh, measure(height, 'HH'), cfg.HHHLcolorbg, 'label_down', cfg.HHHLcolor, expBg, expText, 'tiny');
          isLiquiditySweep = false;
        } else {
          // the original puts this label on the swing low
          if (cfg.plotSwingLabels) swingLabel(localLowIndex, localLow, measure(height, 'LS'), cfg.LScolorbg, 'label_up', cfg.LScolor, expBg, expText, 'tiny');
          isLiquiditySweep = true;
        }
      } else {
        isLiquiditySweep = false;
      }
      bullishBOSOccurred = false;
      if (isLH && cfg.plotSwingLabels) {
        swingLabel(localHighIndex, localHigh, measure(height, 'LH'), cfg.LLLHcolorbg, 'label_down', cfg.LLLHcolor, expBg, expText, 'tiny');
      }
      prevHighDisplacement = height;
      prevSwingHigh = localHigh;
    }
    if (MTFBearishShift && mode === 'MTF') {
      if (!Number.isNaN(prevSwingHigh) && cfg.plotZigZag) {
        newLine(ShiftLocalLowIndex, ShiftLocalLow, ShiftLocalHighIndex, ShiftLocalHigh, cfg.zigzagLineColor, zzStyle);
      }
      if (!Number.isNaN(prevSwingHigh)) {
        isHH = gt(ShiftLocalHigh, prevSwingHigh);
        isLH = lt(ShiftLocalHigh, prevSwingHigh);
      }
      const height = Math.abs(ShiftLocalHigh - ShiftLocalLow);
      const highGreen = Number.isNaN(prevHighDisplacement) ? true : ge(height, prevHighDisplacement);
      const expBg = highGreen ? cfg.HHHLcolorbg : cfg.LLLHcolorbg;
      const expText = highGreen ? cfg.HHHLcolor : cfg.LLLHcolor;
      if (isHH) {
        if (bullishBOSOccurredShift) {
          if (cfg.plotSwingLabels) swingLabel(ShiftLocalHighIndex, ShiftLocalHigh, measure(height, 'HH'), cfg.HHHLcolorbg, 'label_down', cfg.HHHLcolor, expBg, expText, 'small');
          isLiquiditySweepMTF = false;
        } else {
          if (cfg.plotSwingLabels) swingLabel(ShiftLocalHighIndex, ShiftLocalHigh, measure(height, 'LS'), cfg.LScolorbg, 'label_down', cfg.LScolor, expBg, expText, 'small');
          isLiquiditySweepMTF = true;
        }
      }
      if (isLH && cfg.plotSwingLabels) {
        swingLabel(ShiftLocalHighIndex, ShiftLocalHigh, measure(height, 'LH'), cfg.LLLHcolorbg, 'label_down', cfg.LLLHcolor, expBg, expText, 'small');
      }
      prevHighDisplacement = height;
      prevSwingHigh = ShiftLocalHigh;
      lastSwingHigh2 = ShiftLocalHigh;
      bullishBOSOccurredShift = false;
    }

    // === Liquidity sweep lines
    if (cfg.plotLSLines) {
      if (isLiquiditySweep && plotLTFBullishShift && mode === 'LTF') {
        newLine(lastSwingLowIndex, lastSwingLow, localLowIndex, lastSwingLow, cfg.LSLineColor, bosStyle);
        if (cfg.plotLineLabels) {
          newLabel(midOf(lastSwingLowIndex, localLowIndex), lastSwingLow, measure(localLowIndex - lastSwingLowIndex, 'LS'),
            clearRed, 'label_up', cfg.LSLineColor, 'tiny');
        }
      }
      isLiquiditySweep = false;
      lastSwingLow = NaN;
      // the bearish internal sweep line of the original runs after `isLiquiditySweep := false`: never drawn
      isLiquiditySweep = false;
      lastSwingHigh = NaN;
      if (isLiquiditySweepMTF && MTFBullishShift && mode === 'MTF') {
        newLine(lastExtSwingLowIndex, lastExtSwingLow, ShiftLocalLowIndex, lastExtSwingLow, cfg.LSLineColor, bosStyle);
        if (cfg.plotLineLabels) {
          newLabel(midOf(lastExtSwingLowIndex, ShiftLocalLowIndex), lastExtSwingLow, measure(ShiftLocalLowIndex - lastExtSwingLowIndex, 'LS'),
            clearRed, 'label_up', cfg.LSLineColor, 'small');
        }
        isLiquiditySweepMTF = false;
        lastExtSwingLow = NaN;
      }
      if (isLiquiditySweepMTF && MTFBearishShift && mode === 'MTF') {
        newLine(lastExtSwingHighIndex, lastExtSwingHigh, ShiftLocalHighIndex, lastExtSwingHigh, cfg.LSLineColor, bosStyle);
        if (cfg.plotLineLabels) {
          newLabel(midOf(lastExtSwingHighIndex, ShiftLocalHighIndex), lastExtSwingHigh, measure(ShiftLocalHighIndex - lastExtSwingHighIndex, 'LS'),
            clearRed, 'label_down', cfg.LSLineColor, 'small');
        }
        isLiquiditySweepMTF = false;
        lastExtSwingHigh = NaN;
      }
    }

    // === MTF change of character
    const MTFBullishCHoCH = crossBullCHoCH(smaClose2[i], ShiftLocalHigh) && CHoCHCondtion !== 1;
    const MTFBearishCHoCH = crossBearCHoCH(smaClose2[i], ShiftLocalLow) && CHoCHCondtion !== -1;
    if (MTFBullishCHoCH) canPlotHTFBoSBear = true;
    if (MTFBearishCHoCH) canPlotHTFBoSBull = true;
    if (mode === 'MTF') {
      if (MTFBullishCHoCH) {
        if (canPlotCHoCH && CHoCHCondtion !== 1 && cfg.plotCHoCHLines) {
          held.upCHoCHLine.value = newLine(ShiftLocalHighIndex, ShiftLocalHigh, i, ShiftLocalHigh, cfg.CHoCHColor, bosStyle);
          if (cfg.plotLineLabels) {
            held.upCHochLabel.value = newLabel(midOf(ShiftLocalHighIndex, i), ShiftLocalHigh, measure(i - ShiftLocalHighIndex, 'CHoCH'),
              clearRed, 'label_down', cfg.CHoCHColor, 'small');
          }
        }
        if (cfg.showBullishInflectionZones) {
          if (held.lastSupplyZone.value) box.delete(held.lastSupplyZone.value);
          bullishInflectionZones.push({
            b: newBox(bullishInflectionLeft, bullishInflectionHigh, bullishInflectionRight + dur, bullishInflectionLow,
              cfg.demandZoneColor, cfg.bullishInflectionZoneColor),
            dimmed: false,
          });
        }
        CHoCHHIGH = ShiftLocalHigh;
        ShiftLocalHigh = NaN;
        CHoCHCondtion = 1;
        bearInflectionLow = ShiftLocalLow;
      }
      if (MTFBearishCHoCH) {
        if (canPlotCHoCH && CHoCHCondtion !== -1 && cfg.plotCHoCHLines) {
          held.downCHoCHLine.value = newLine(ShiftLocalLowIndex, ShiftLocalLow, i, ShiftLocalLow, cfg.CHoCHColor, bosStyle);
          if (cfg.plotLineLabels) {
            held.downCHoCHLabel.value = newLabel(midOf(ShiftLocalLowIndex, i), ShiftLocalLow, measure(i - ShiftLocalLowIndex, 'CHoCH'),
              clearRed, 'label_up', cfg.CHoCHColor, 'small');
          }
        }
        if (cfg.showBearishInflectionZones) {
          if (held.lastDemandZone.value) box.delete(held.lastDemandZone.value);
          bearishInflectionZones.push({
            b: newBox(bearishInflectionLeft, bearishInflectionHigh, bearishInflectionRight + dur, bearishInflectionLow,
              cfg.supplyZoneColor, cfg.bearishInflectionZoneColor),
            dimmed: false,
          });
        }
        CHoCHLOW = ShiftLocalLow;
        ShiftLocalLow = NaN;
        CHoCHCondtion = -1;
        bullInflectionHigh = ShiftLocalHigh;
      }
    }
    canPlotCHoCH = true;
    // (the lowest-low search of the original after a bullish CHoCH has no output)
    if (MTFBullishCHoCH && mode === 'MTF') CHoCHCondtion = 1;

    // === MTF break of structure 2
    const MTFBullishBoS2 = !Number.isNaN(lastSwingHigh2) && gt(smaClose2[i], ShiftLocalHigh);
    const MTFBearishBoS2 = !Number.isNaN(lastSwingLow2) && lt(smaClose2[i], ShiftLocalLow);
    if (MTFBullishBoS2) {
      if (cfg.plotBoSLines && mode === 'MTF') {
        const text = measure(i - ShiftLocalHighIndex, 'BoS');
        const mid = midOf(ShiftLocalHighIndex, i);
        if (eq(CHoCHHIGH, lastSwingHigh2)) {
          held.lastBullBoSLine.value = newLine(ShiftLocalHighIndex, ShiftLocalHigh, i, ShiftLocalHigh, cfg.bosBullishLineColor, bosStyle);
          if (cfg.plotLineLabels) {
            held.lastBullBoSLabel.value = newLabel(mid, ShiftLocalHigh, text, clearRed, 'label_down', cfg.bosBullishLineColor, 'small');
          }
        } else {
          newLine(ShiftLocalHighIndex, ShiftLocalHigh, i, ShiftLocalHigh, cfg.bosBullishLineColor, bosStyle);
          if (cfg.plotLineLabels) newLabel(mid, ShiftLocalHigh, text, clearRed, 'label_down', cfg.bosBullishLineColor, 'small');
        }
      }
      CHoCHLOW = ShiftLocalLow;
      ShiftLocalHigh = NaN;
    }
    if (MTFBearishBoS2) {
      if (cfg.plotBoSLines && mode === 'MTF') {
        const text = measure(i - ShiftLocalLowIndex, 'BoS');
        const mid = midOf(ShiftLocalLowIndex, i);
        if (eq(CHoCHLOW, lastSwingLow2)) {
          held.lastBearBoSLine.value = newLine(ShiftLocalLowIndex, ShiftLocalLow, i, ShiftLocalLow, cfg.bosBearishLineColor, bosStyle);
          if (cfg.plotLineLabels) {
            held.lastBearBoSLabel.value = newLabel(mid, ShiftLocalLow, text, clearRed, 'label_up', cfg.bosBearishLineColor, 'small');
          }
        } else {
          newLine(ShiftLocalLowIndex, ShiftLocalLow, i, ShiftLocalLow, cfg.bosBearishLineColor, bosStyle);
          if (cfg.plotLineLabels) newLabel(mid, ShiftLocalLow, text, clearRed, 'label_up', cfg.bosBearishLineColor, 'small');
        }
      }
      CHoCHHIGH = ShiftLocalHigh;
      ShiftLocalLow = NaN;
    }
    if (MTFBullishCHoCH && cfg.plotCHoCHLines) {
      if (held.lastBullBoSLine.value) line.delete(held.lastBullBoSLine.value);
      held.lastBullBoSLine.value = undefined;
      if (held.lastBullBoSLabel.value) label.delete(held.lastBullBoSLabel.value);
      held.lastBullBoSLabel.value = undefined;
    }
    if (MTFBearishCHoCH && cfg.plotCHoCHLines) {
      if (held.lastBearBoSLine.value) line.delete(held.lastBearBoSLine.value);
      held.lastBearBoSLine.value = undefined;
      if (held.lastBearBoSLabel.value) label.delete(held.lastBearBoSLabel.value);
      held.lastBearBoSLabel.value = undefined;
    }

    // === HTF swing highs / lows
    if (MTFBearishCHoCH && mode === 'HTF') {
      const [hh, hi] = searchHigh(Number.isNaN(HTFLocalLowIndex) ? i - MAX_HISTORY : HTFLocalLowIndex, i);
      prevHTFLocalHigh = HTFLocalHigh;
      prevHTFLocalHighIndex = HTFLocalHighIndex;
      HTFLocalHigh = hh;
      HTFLocalHighIndex = hi;
    }
    if (MTFBullishCHoCH && mode === 'HTF') {
      const [ll, li] = searchLow(Number.isNaN(HTFLocalHighIndex) ? i - MAX_HISTORY : HTFLocalHighIndex, i);
      prevHTFLocalLow = HTFLocalLow;
      prevHTFLocalLowIndex = HTFLocalLowIndex;
      HTFLocalLow = ll;
      HTFLocalLowIndex = li;
    }

    // === HTF break of structure
    const HTFBullishBoS = gt(smaClose3[i], HTFLocalHigh);
    const HTFBearishBoS = lt(smaClose3[i], HTFLocalLow);
    const HTFBullishCHoCH = HTFBullishBoS && lastHTFBoSType !== 1;
    const HTFBearishCHoCH = HTFBearishBoS && lastHTFBoSType !== -1;
    if (HTFBullishBoS && mode === 'HTF') {
      if (cfg.plotBoSLines && canPlotHTFBoSBull) {
        held.HTFBullishBoSLine.value = newLine(HTFLocalHighIndex, HTFLocalHigh, i, HTFLocalHigh, cfg.bosBullishLineColor, bosStyle);
        if (cfg.plotLineLabels) {
          held.HTFBullishBoSLabel.value = newLabel(midOf(HTFLocalHighIndex, i), HTFLocalHigh, measure(i - HTFLocalHighIndex, 'BoS'),
            clearRed, 'label_down', cfg.bosBullishLineColor, 'normal');
        }
      }
      if (HTFBullishCHoCH && cfg.plotCHoCHLines) {
        if (held.HTFBullishBoSLine.value) line.delete(held.HTFBullishBoSLine.value);
        if (held.HTFBullishBoSLabel.value) label.delete(held.HTFBullishBoSLabel.value);
      }
      if (cfg.plotCHoCHLines && HTFBullishCHoCH && canPlotHTFBoSBull) {
        newLine(HTFLocalHighIndex, HTFLocalHigh, i, HTFLocalHigh, cfg.CHoCHColor, bosStyle);
        if (cfg.plotLineLabels) newLabel(midOf(HTFLocalHighIndex, i), HTFLocalHigh, 'CHoCH', clearRed, 'label_down', cfg.CHoCHColor, 'normal');
      }
      HTFBullishBoSOccurred = true;
      lastHTFBoSType = 1;
      canPlotHTFBoSBull = false;
    }
    if (HTFBearishBoS && mode === 'HTF') {
      if (cfg.plotBoSLines && canPlotHTFBoSBear) {
        held.HTFBearishBoSLine.value = newLine(HTFLocalLowIndex, HTFLocalLow, i, HTFLocalLow, cfg.bosBearishLineColor, bosStyle);
        if (cfg.plotLineLabels) {
          held.HTFBearishBoSLabel.value = newLabel(midOf(HTFLocalLowIndex, i), HTFLocalLow, measure(i - HTFLocalLowIndex, 'BoS'),
            clearGreen, 'label_up', cfg.bosBearishLineColor, 'normal');
        }
      }
      if (HTFBearishCHoCH && cfg.plotCHoCHLines) {
        if (held.HTFBearishBoSLine.value) line.delete(held.HTFBearishBoSLine.value);
        if (held.HTFBearishBoSLabel.value) label.delete(held.HTFBearishBoSLabel.value);
      }
      if (cfg.plotCHoCHLines && canPlotHTFBoSBear && HTFBearishCHoCH) {
        newLine(HTFLocalLowIndex, HTFLocalLow, i, HTFLocalLow, cfg.CHoCHColor, bosStyle);
        if (cfg.plotLineLabels) newLabel(midOf(HTFLocalLowIndex, i), HTFLocalLow, 'CHoCH', clearGreen, 'label_up', cfg.CHoCHColor, 'normal');
      }
      HTFBearishBoSOccurred = true;
      lastHTFBoSType = -1;
      canPlotHTFBoSBear = false;
    }

    // === HTF swing structure
    if (MTFBearishCHoCH && mode === 'HTF') {
      if (cfg.plotZigZag) newLine(HTFLocalLowIndex, HTFLocalLow, HTFLocalHighIndex, HTFLocalHigh, cfg.zigzagLineColor, zzStyle);
      isHH = gt(HTFLocalHigh, prevHTFLocalHigh);
      isLH = lt(HTFLocalHigh, prevHTFLocalHigh);
      const height = Math.abs(HTFLocalHigh - HTFLocalLow);
      const highGreen = Number.isNaN(prevHighDisplacement) ? true : ge(height, prevHighDisplacement);
      const expBg = highGreen ? cfg.HHHLcolorbg : cfg.LLLHcolorbg;
      const expText = highGreen ? cfg.HHHLcolor : cfg.LLLHcolor;
      if (isHH) {
        if (HTFBullishBoSOccurred) {
          if (cfg.plotSwingLabels) swingLabel(HTFLocalHighIndex, HTFLocalHigh, measure(height, 'HH'), cfg.HHHLcolorbg, 'label_down', cfg.HHHLcolor, expBg, expText, 'normal');
          isLiquiditySweepHTF = false;
        } else {
          if (cfg.plotSwingLabels) swingLabel(HTFLocalHighIndex, HTFLocalHigh, measure(height, 'LS'), cfg.LScolorbg, 'label_down', cfg.LScolor, expBg, expText, 'normal');
          isLiquiditySweepHTF = true;
        }
      }
      if (isLH && cfg.plotSwingLabels) {
        swingLabel(HTFLocalHighIndex, HTFLocalHigh, measure(height, 'LH'), cfg.LLLHcolorbg, 'label_down', cfg.LLLHcolor, expBg, expText, 'normal');
      }
      if (cfg.plotLSLines && isLiquiditySweepHTF) {
        newLine(prevHTFLocalHighIndex, prevHTFLocalHigh, HTFLocalHighIndex, prevHTFLocalHigh, cfg.LSLineColor, bosStyle);
        if (cfg.plotLineLabels) {
          newLabel(midOf(prevHTFLocalHighIndex, HTFLocalHighIndex), prevHTFLocalHigh, measure(HTFLocalHighIndex - prevHTFLocalHighIndex, 'LS'),
            clearGreen, 'label_down', cfg.LSLineColor, 'small');
        }
        isLiquiditySweepHTF = false;
        lastExtSwingHigh = NaN;
      }
      prevHighDisplacement = height;
      prevHTFLocalHigh = HTFLocalHigh;
      HTFBullishBoSOccurred = false;
    }
    if (MTFBullishCHoCH && mode === 'HTF') {
      if (cfg.plotZigZag) newLine(HTFLocalHighIndex, HTFLocalHigh, HTFLocalLowIndex, HTFLocalLow, cfg.zigzagLineColor, zzStyle);
      isLL = lt(HTFLocalLow, prevHTFLocalLow);
      isHL = gt(HTFLocalLow, prevHTFLocalLow);
      const height = Math.abs(HTFLocalHigh - HTFLocalLow);
      const lowGreen = Number.isNaN(prevLowDisplacement) ? true : lt(height, prevLowDisplacement);
      const expBg = lowGreen ? cfg.HHHLcolorbg : cfg.LLLHcolorbg;
      const expText = lowGreen ? cfg.HHHLcolor : cfg.LLLHcolor;
      if (isLL) {
        if (HTFBearishBoSOccurred) {
          // the original gives the HH / HL colours to this LL label
          if (cfg.plotSwingLabels) swingLabel(HTFLocalLowIndex, HTFLocalLow, measure(height, 'LL'), cfg.HHHLcolorbg, 'label_up', cfg.HHHLcolor, expBg, expText, 'normal');
          isLiquiditySweepHTF = false;
        } else {
          if (cfg.plotSwingLabels) swingLabel(HTFLocalLowIndex, HTFLocalLow, measure(height, 'LS'), cfg.LScolorbg, 'label_up', cfg.LScolor, expBg, expText, 'normal');
          isLiquiditySweepHTF = true;
        }
      }
      if (isHL && cfg.plotSwingLabels) {
        swingLabel(HTFLocalLowIndex, HTFLocalLow, measure(height, 'HL'), cfg.HHHLcolorbg, 'label_up', cfg.HHHLcolor, expBg, expText, 'normal');
      }
      if (cfg.plotLSLines && isLiquiditySweepHTF) {
        newLine(prevHTFLocalLowIndex, prevHTFLocalLow, HTFLocalLowIndex, prevHTFLocalLow, cfg.LSLineColor, bosStyle);
        if (cfg.plotLineLabels) {
          newLabel(midOf(prevHTFLocalLowIndex, HTFLocalLowIndex), prevHTFLocalLow, measure(HTFLocalLowIndex - prevHTFLocalLowIndex, 'LS'),
            clearRed, 'label_up', cfg.LSLineColor, 'small');
        }
        isLiquiditySweepHTF = false;
        lastExtSwingLow = NaN;
      }
      prevLowDisplacement = height;
      prevHTFLocalLow = HTFLocalLow;
      HTFBearishBoSOccurred = false;
    }

    // === Alerts
    if (mode === 'LTF') {
      bullishShiftOccurredAlert = plotLTFBullishShift;
      bearishShiftOccurredAlert = plotLTFBearishShift;
      bullishBoSOcurredAlert = bullishBoS;
      bearishBoSOcurredAlert = bearishBoS;
      bearishCHoCHOccurredAlert = MTFBearishShift;
      bullishCHoCHOccurredAlert = MTFBullishShift;
      HHOccurredAlert = plotLTFBearishShift && isHH;
      LHOccurredAlert = plotLTFBearishShift && isLH;
      HLOccurredAlert = plotLTFBullishShift && isHL;
      LLOccurredAlert = plotLTFBullishShift && isLL;
      LSOccurredAlert = (plotLTFBullishShift || plotLTFBearishShift) && isLiquiditySweep;
    }
    if (mode === 'MTF') {
      bullishShiftOccurredAlert = MTFBullishShift;
      bearishShiftOccurredAlert = MTFBearishShift;
      bullishBoSOcurredAlert = MTFBullishBoS2;
      bearishBoSOcurredAlert = MTFBearishBoS2;
      bearishCHoCHOccurredAlert = MTFBullishCHoCH;
      bullishCHoCHOccurredAlert = MTFBearishCHoCH;
      HHOccurredAlert = MTFBearishShift && isHH && !isLiquiditySweepMTF;
      LHOccurredAlert = MTFBearishShift && isLH;
      HLOccurredAlert = MTFBullishShift && isHL;
      LLOccurredAlert = MTFBullishShift && isLL && !isLiquiditySweepMTF;
      LSOccurredAlert = (MTFBullishShift || MTFBearishShift) && isLiquiditySweepMTF;
    }
    const conds = [
      plotLTFBearishShift, plotLTFBullishShift, bullishBoS, bearishBoS, MTFBullishShift, MTFBearishShift,
      plotLTFBearishShift && isHH && !isLiquiditySweep, plotLTFBearishShift && isLH, plotLTFBullishShift && isHL,
      plotLTFBullishShift && isLL && !isLiquiditySweep, (plotLTFBullishShift || plotLTFBearishShift) && isLiquiditySweep,
      MTFBullishShift, MTFBearishShift, MTFBullishBoS2, MTFBearishBoS2, unconfirmedBullShift, unconfirmedBearShift,
      MTFBullishCHoCH, MTFBearishCHoCH, MTFBearishShift && isHH && !isLiquiditySweepMTF, MTFBearishShift && isLH,
      MTFBullishShift && isHL, MTFBullishShift && isLL && !isLiquiditySweep,
      (MTFBullishShift || MTFBearishShift) && isLiquiditySweepMTF,
    ];
    conds.forEach((c, k) => { flags[k][i] = c; });
    if (mode === 'LTF' || mode === 'MTF') {
      const tag = mode === 'LTF' ? '(LTF)' : '(MTF)';
      const call = (message: string) => alertCalls.push({ time: t, message, freq: 'once_per_bar_close' });
      if (bullishShiftOccurredAlert && cfg.alertShift) call(mode === 'LTF' ? 'New order block available. (LTF)' : 'New demand zone available. (MTF)');
      if (bearishShiftOccurredAlert && cfg.alertShift) call(mode === 'LTF' ? 'New order block available. (LTF)' : 'New supply zone available. (MTF)');
      if (bullishBoSOcurredAlert && cfg.alertBoS) call(`Bullish BoS detected. ${tag}`);
      if (bearishBoSOcurredAlert && cfg.alertBoS) call(`Bearish BoS detected. ${tag}`);
      if (bullishCHoCHOccurredAlert && cfg.alertBoS) call(`Bullish CHoCH detected. ${tag}`);
      if (bearishCHoCHOccurredAlert && cfg.alertCHoCH) call(`Bearish CHoCH detected. ${tag}`);
      if (HHOccurredAlert && cfg.alertHighsandLows) call(`Higher High (HH) detected. ${tag}`);
      if (HLOccurredAlert && cfg.alertHighsandLows) call(`Higher Low (LH) detected. ${tag}`);
      if (LLOccurredAlert && cfg.alertHighsandLows) call(`Lower Low (LL) detected. ${tag}`);
      if (LHOccurredAlert && cfg.alertHighsandLows) call(`Lower High (LH) detected. ${tag}`);
      if (LSOccurredAlert && cfg.alertHighsandLows) call(`Liquidity Sweep (LS) detected. ${tag}`);
    }
  }
  setDrawingBar(null);

  // objects with an na coordinate count in the limits but are not drawn
  const lines: LineDrawingData[] = line.all()
    .filter((l) => ![l.x1, l.y1, l.x2, l.y2].some((v) => Number.isNaN(v)))
    .map((l) => ({
      time1: T(l.x1), price1: l.y1, time2: T(l.x2), price2: l.y2, color: String(l.color ?? 'transparent'),
      width: l.width, style: l.style as StyleValue,
    }));
  const boxes: BoxData[] = box.all()
    .filter((b) => ![b.left, b.top, b.right, b.bottom].some((v) => Number.isNaN(v)))
    .map((b) => ({
      time1: T(b.left), price1: b.top, time2: T(b.right), price2: b.bottom,
      bgColor: String(b.bgcolor ?? 'transparent'), borderColor: String(b.border_color ?? 'transparent'), borderWidth: b.border_width,
      textColor: String(b.text_color ?? BOX_TEXT),
    }));
  const labels: LabelData[] = label.all()
    .filter((l) => !Number.isNaN(l.x) && !Number.isNaN(l.y))
    .map((l) => ({
      time: T(l.x), price: l.y, text: l.text ?? '', color: String(l.color ?? 'transparent'),
      textColor: String(l.textcolor ?? 'transparent'), style: l.style as 'label_up' | 'label_down',
      size: l.size as 'tiny' | 'small' | 'normal',
    }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    lines,
    boxes,
    labels,
    alerts: alertStates(alertConditions, bars, flags),
    alertCalls,
  };
}

export const MarketStructureZigzagBreakOfStructure = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
  hasAlertFunction,
  shapeConfig,
  drawingKinds,
};
