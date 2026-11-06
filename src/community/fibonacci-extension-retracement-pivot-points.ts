/**
 * Fibonacci Extension / Retracement / Pivot Points by DGT
 *
 * A zigzag gives the swings: a bar is a swing high (low) candidate when no bar of the "Depth" window around it is
 * higher (lower); a candidate in the direction of the running leg moves the end of the leg, a candidate in the other
 * direction starts a new leg when its distance to the last swing, in percent, is above Deviation x ATR(10) / close.
 * From the last legs the script draws, on the last bar:
 * - Fibonacci pivot points of a higher timeframe (default tool): pivot = (high + low + close) / 3 of the previous
 *   period, and pivot -/+ range x level for each level that is switched on; the higher timeframe is chosen from the
 *   chart timeframe ("Auto") or set by hand, and its periods are built from the chart bars
 * - or Fibonacci retracement / extension levels of the last leg (last two legs for extensions)
 * - Fibonacci time zones: vertical lines at the start of the last leg plus its length times -1, 0, 1, 2, 3, 5, ... 89
 * - the swing labels (confirmed highs and lows, and the running swing), optionally the zigzag lines
 * - "Historical Pivot Points" plots the pivot levels of every past period
 * Add-ons: a mark on bars whose volume is above a multiple of its average, a mark on bars whose range is above a
 * multiple of the ATR, and bar colours by volume against its average. At most 500 lines and 500 labels are kept.
 *
 * Limits of the port: the periods of the higher timeframe come from the UTC calendar and the bars (see
 * src/anchor-period.ts).
 *
 * Alerts:
 * - alert conditions (`alerts` of the result): "Volume Spikes" (the volume crosses over its average times the spike
 *   threshold) and "High Volatility" (the bar range crosses over ATR times the multiplier);
 * - alert() calls (`alertCalls`, once per bar), on every bar, for each level switched on in the order of the levels:
 *   the extension / retracement level ("AutoFib Extension : <ticker> crossing level <level>",
 *   "AutoFib Retracment : ...") and the pivot point support / resistance levels of the levels >= 0
 *   ("AutoFib PivotPoints : <ticker> crossing support level <level>", "... resistance level ...") that are strictly
 *   between the close and the previous close.
 *
 * Chart context (optional third argument):
 * - `chart.mintick`: the symbol tick of the prices in the label texts. Without it 0.01.
 * - `chart.tickerid`: the ticker of the alert messages.
 * - `chart.timeframe`: the chart timeframe, for the "Auto" higher timeframe. Without it, it is taken from the bars.
 * - `chart.now`: the current time, for the "Last Bar" position of the pivot labels (as the original). Without it the
 *   clock of the computer.
 *
 * Periods and the chart context (optional third argument of calculate): with the exchange time zone and the session
 * of the symbol (`timezone`, `session`) the periods are those of the exchange calendar (its trading days, holidays
 * and session hours), see src/anchor-period.ts.
 * Without them the port uses the UTC calendar and the bars, as described in this header. `timeframe`, when given,
 * is the chart timeframe; without it the chart timeframe is read from the bar spacing.
 *
 * Reference: "Fibonacci Extention / Retracment / Pivot Points by DGT" by dgtrd
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © dgtrd
 */

import { taStep, str, math, timeframe, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertCall, BarColorData, LabelData, LineDrawingData, MarkerData, TableData } from '../types';
import { barInterval, barTime } from '../bar-time';
import { periodStarts, chartTimeframe } from '../anchor-period';
import { mintickOf, nowOf, tickerOf, type ChartContext } from '../chart-context';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import { WindowSma, createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

type LevelLabels = 'Levels' | 'Prices' | 'Levels + Prices' | 'None';
type LineStyleName = 'Dashed' | 'Dotted' | 'Solid';

/** The 22 Fibonacci levels: input key, shown by default, default value, default colour, input line */
const LEVELS = [
  ['0', true, 0, '#787b86', 'Level0'],
  ['0236', true, 0.236, '#f44336', 'Level0'],
  ['0382', true, 0.382, '#81c784', 'Level1'],
  ['05', true, 0.5, '#4caf50', 'Level1'],
  ['0618', true, 0.618, '#009688', 'Level2'],
  ['065', false, 0.65, '#009688', 'Level2'],
  ['0786', true, 0.786, '#64b5f6', 'Level3'],
  ['1', true, 1, '#787b86', 'Level3'],
  ['1272', false, 1.272, '#81c784', 'Level4'],
  ['1414', false, 1.414, '#f44336', 'Level4'],
  ['1618', true, 1.618, '#2196f3', 'Level5'],
  ['165', false, 1.65, '#2196f3', 'Level5'],
  ['2618', false, 2.618, '#f44336', 'Level6'],
  ['265', false, 2.65, '#f44336', 'Level6'],
  ['3618', false, 3.618, '#9c27b0', 'Level7'],
  ['365', false, 3.65, '#9c27b0', 'Level7'],
  ['4236', false, 4.236, '#e91e63', 'Level8'],
  ['4618', false, 4.618, '#81c784', 'Level8'],
  ['Neg0236', false, -0.236, '#f44336', 'Level9'],
  ['Neg0382', false, -0.382, '#81c784', 'Level9'],
  ['Neg0618', true, -0.618, '#009688', 'Level10'],
  ['Neg065', false, -0.65, '#009688', 'Level10'],
] as const;

type LevelKey = (typeof LEVELS)[number][0];
type LevelInputs = { [K in LevelKey as `show${K}`]: boolean } & { [K in LevelKey as `value${K}`]: number } & {
  [K in LevelKey as `color${K}`]: string;
};

export interface FibonacciExtensionRetracementPivotPointsInputs extends LevelInputs {
  isFib: boolean;
  fibTool: 'Pivot Points' | 'Retracements' | 'Retracements + Pivot Points' | 'Extensions' | 'Extensions + Pivot Points';
  fibTime: boolean;
  /** Multiplier of ATR(10) / close, in percent: smallest move that starts a new leg */
  deviation: number;
  depth: number;
  pivotTimeframe: 'Auto' | '15 Min' | '1 Hour' | '4 Hour' | 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly';
  levelsPvt: LevelLabels;
  levelsPvtP: 'Last Bar' | 'Pivot End';
  levelsPvtS: 'Small' | 'Normal';
  relevant: boolean;
  histPP: boolean;
  extend: boolean;
  extendL: LineStyleName;
  levels: LevelLabels;
  levelsP: 'Last Bar' | 'Pivot Start';
  levelsS: 'Small' | 'Normal';
  reverse: boolean;
  extendER: boolean;
  histPivot: number;
  fibTzl: boolean;
  fibTzlp: 'Right' | 'Left';
  fibTzlp2: 'Bottom' | 'Top';
  tzColor: string;
  histPivot2: number;
  zigZag: boolean;
  zzColor: string;
  zzStyle: LineStyleName;
  zzWidth: number;
  zzSwings: boolean;
  highColor: string;
  lowColor: string;
  tempColor: string;
  highVolatility: boolean;
  atrLength: number;
  atrMultiplier: number;
  volumeLength: number;
  volumeSpike: boolean;
  volumeSpikeThreshold: number;
  volumeBars: boolean;
  volumeHighThreshold: number;
  volumeLowThreshold: number;
}

const levelDefaults = Object.fromEntries(
  LEVELS.flatMap(([k, show, value, css]) => [[`show${k}`, show], [`value${k}`, value], [`color${k}`, css]]),
) as unknown as LevelInputs;

export const defaultInputs: FibonacciExtensionRetracementPivotPointsInputs = {
  isFib: true,
  fibTool: 'Pivot Points',
  fibTime: true,
  deviation: 3,
  depth: 11,
  pivotTimeframe: 'Auto',
  levelsPvt: 'Levels',
  levelsPvtP: 'Pivot End',
  levelsPvtS: 'Small',
  relevant: false,
  histPP: false,
  extend: false,
  extendL: 'Dashed',
  levels: 'Levels',
  levelsP: 'Pivot Start',
  levelsS: 'Small',
  reverse: false,
  extendER: false,
  histPivot: 0,
  fibTzl: true,
  fibTzlp: 'Left',
  fibTzlp2: 'Bottom',
  tzColor: '#2196f3',
  histPivot2: 0,
  zigZag: false,
  zzColor: '#c77a08',
  zzStyle: 'Solid',
  zzWidth: 1,
  zzSwings: true,
  highColor: '#d4a5a5',
  lowColor: '#8faadc',
  tempColor: '#0000f0',
  ...levelDefaults,
  highVolatility: true,
  atrLength: 13,
  atrMultiplier: 2.718,
  volumeLength: 89,
  volumeSpike: true,
  volumeSpikeThreshold: 4.669,
  volumeBars: true,
  volumeHighThreshold: 1.618,
  volumeLowThreshold: 0.618,
};

const G_PICK = 'Pick a Fibonacci Tool';
const G_SWING = 'Swing Detection Settings';
const G_PIVOT = 'Fibonacci Pivot Points Settings';
const G_TOOL = 'Fibonacci Extension / Retracement Settings';
const G_TZ = 'Fibonacci TimeZone Settings';
const G_ZZ = 'ZigZag Settings';
const G_LEVELS = 'Fibonacci Levels';
const G_VOLATILITY = 'Volatility AddOns';
const G_VOLUME = 'Volume AddOns';
const STYLES = ['Dashed', 'Dotted', 'Solid'];
const LABEL_OPTIONS = ['Levels', 'Prices', 'Levels + Prices', 'None'];

const TIP_TOOL =
  'Chooses which Fibonacci tool to display.\n\n' +
  '• Pivot Points: Static, structure-based reference levels.\n' +
  '• Retracements: Measures pullbacks within an existing move.\n' +
  '• Retracements + Pivot Points: Combines internal retracements with structural pivots.\n' +
  '• Extensions: Projects continuation targets beyond the current range.\n' +
  '• Extensions + Pivot Points: Combines projected targets with structural pivots.\n\n' +
  'Use combinations to identify high-probability confluence zones.';
const TIP_TZ =
  'Displays Fibonacci Time Zones\n\n' +
  'Time Zones project potential timing windows where price reactions, accelerations, or trend changes may occur.\n\n' +
  'This tool focuses on *when* a reaction may happen, rather than *where*.';
const TIP_THRESHOLD =
  'Controls how price swings are detected.\n\n' +
  'Deviation:\n' +
  'Defines the minimum ATR-based price movement required to confirm a new swing. Higher values filter noise and highlight more significant structure.\n\n' +
  'Depth:\n' +
  'Defines the minimum number of bars required to confirm a swing high or low. Higher values produce smoother structure but react more slowly.';
const TIP_HTF =
  'Defines the timeframe used to calculate Pivot Points.\n\n' +
  'Manual Selection:\n' +
  '• 15 Min / 1 Hour / 4 Hour → Uses the selected intraday timeframe.\n' +
  '• Daily → Anchors to calendar days.\n' +
  '• Weekly → Anchors to calendar weeks.\n' +
  '• Monthly → Anchors to calendar months.\n' +
  '• Quarterly → Anchors to calendar quarters.\n' +
  '• Yearly → Anchors to calendar years.\n\n' +
  'Auto Mode (Default):\n' +
  'Automatically selects an appropriate higher timeframe based on the chart timeframe:\n' +
  '• Intraday ≤ 15 min → Daily pivots\n' +
  '• Intraday 30-240 min → Weekly pivots\n' +
  '• Daily charts → Monthly pivots\n' +
  '• Weekly / Monthly charts → Yearly pivots\n\n' +
  'Auto mode is designed to provide context-aware pivot levels without manual adjustment.';
const TIP_ZIGZAG =
  'ZigZag Structure Visualization\n\n' +
  'Identifies meaningful price swings and connects them with straight lines to clarify overall price structure.\n\n' +
  'By filtering out minor fluctuations and market noise, ZigZag helps highlight dominant trends and potential trend changes over time.';
const TIP_SWINGS =
  'ZigZag Swing Points\n\n' +
  'Displays swing highs and lows derived from the ZigZag structure.\n\n' +
  '• Highs: Confirmed swing highs\n' +
  '• Lows: Confirmed swing lows\n' +
  '• Temps: Temporary (unconfirmed) swings that may update as price evolves\n\n' +
  'Swing points help visualize market structure, momentum shifts, and potential reaction zones.';
const TIP_VOLATILITY =
  'High Volatility Detection\n\n' +
  'Identifies bars where price expansion is unusually large relative to recent volatility.\n\n' +
  'A high-volatility bar is detected when:\n' +
  '• Current bar range > (ATR × Multiplier)\n\n' +
  'Such conditions often accompany breakouts, news-driven moves, or volatility regime shifts.';
const TIP_SPIKE =
  'Volume Spike · Potential Exhaustion\n\n' +
  'Highlights moments where volume expands significantly relative to its moving average.\n\n' +
  'A spike is detected when:\n' +
  '• Current volume > (Volume MA × Threshold)\n\n' +
  'These events often occur near climactic moves, exhaustion points, or strong participation surges.';
const TIP_BARS =
  'Volume-Weighted Colored Bars\n\n' +
  'Colors price bars based on relative volume intensity.\n\n' +
  'Bar colors indicate:\n' +
  '• High participation (above average volume)\n' +
  '• Normal participation\n' +
  '• Low participation (below average volume)\n\n' +
  'Helps visually confirm momentum, conviction, and participation behind price movement.';

export const inputConfig: InputConfig[] = [
  { id: 'isFib', type: 'bool', title: 'Pick a Fibonacci Tool', defval: true, inline: 'FIB', group: G_PICK, tooltip: TIP_TOOL },
  {
    id: 'fibTool', type: 'string', title: ' '.repeat(13), defval: 'Pivot Points', inline: 'FIB', group: G_PICK, display: 'data_window',
    options: ['Pivot Points', 'Retracements', 'Retracements + Pivot Points', 'Extensions', 'Extensions + Pivot Points'],
  },
  { id: 'fibTime', type: 'bool', title: 'Fibonacci Time Zones', defval: true, group: G_PICK, tooltip: TIP_TZ },
  { id: 'deviation', type: 'float', title: 'Deviation', defval: 3, min: 0, inline: 'Pivots', group: G_SWING, tooltip: TIP_THRESHOLD, display: 'data_window' },
  { id: 'depth', type: 'int', title: `${' '.repeat(6)} Depth`, defval: 11, min: 1, inline: 'Pivots', group: G_SWING, display: 'data_window' },
  {
    id: 'pivotTimeframe', type: 'string', title: 'Pivot Points Timeframe', defval: 'Auto', group: G_PIVOT, tooltip: TIP_HTF, display: 'data_window',
    options: ['Auto', '15 Min', '1 Hour', '4 Hour', 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'],
  },
  { id: 'levelsPvt', type: 'string', title: 'Level Labels', defval: 'Levels', options: LABEL_OPTIONS, inline: 'pvt', group: G_PIVOT, display: 'data_window' },
  { id: 'levelsPvtP', type: 'string', title: '', defval: 'Pivot End', options: ['Last Bar', 'Pivot End'], inline: 'pvt', group: G_PIVOT, display: 'data_window' },
  { id: 'levelsPvtS', type: 'string', title: '', defval: 'Small', options: ['Small', 'Normal'], inline: 'pvt', group: G_PIVOT, display: 'data_window' },
  { id: 'relevant', type: 'bool', title: 'Only Relevant Pivot Point Levels', defval: false, group: G_PIVOT },
  { id: 'histPP', type: 'bool', title: 'Historical Pivot Points', defval: false, group: G_PIVOT },
  { id: 'extend', type: 'bool', title: 'Extend Pivot Point Lines', defval: false, inline: 'fLines', group: G_PIVOT },
  { id: 'extendL', type: 'string', title: '', defval: 'Dashed', options: STYLES, inline: 'fLines', group: G_PIVOT, display: 'data_window' },
  { id: 'levels', type: 'string', title: 'Level Labels', defval: 'Levels', options: LABEL_OPTIONS, inline: 'fLines', group: G_TOOL, display: 'data_window' },
  { id: 'levelsP', type: 'string', title: '', defval: 'Pivot Start', options: ['Last Bar', 'Pivot Start'], inline: 'fLines', group: G_TOOL, display: 'data_window' },
  { id: 'levelsS', type: 'string', title: '', defval: 'Small', options: ['Small', 'Normal'], inline: 'fLines', group: G_TOOL, display: 'data_window' },
  { id: 'reverse', type: 'bool', title: 'Reverse Extension / Retracement Levels', defval: false, group: G_TOOL },
  { id: 'extendER', type: 'bool', title: 'Extend Extension / Retracement Lines', defval: false, inline: 'fLine', group: G_TOOL },
  { id: 'histPivot', type: 'int', title: 'Historical Extension / Retracement Levels', defval: 0, min: 0, group: G_TOOL, display: 'data_window' },
  { id: 'fibTzl', type: 'bool', title: 'Time Zone Labels', defval: true, inline: 'tz poz', group: G_TZ },
  { id: 'fibTzlp', type: 'string', title: '', defval: 'Left', options: ['Right', 'Left'], inline: 'tz poz', group: G_TZ, display: 'data_window' },
  { id: 'fibTzlp2', type: 'string', title: '', defval: 'Bottom', options: ['Bottom', 'Top'], inline: 'tz poz', group: G_TZ, display: 'data_window' },
  { id: 'tzColor', type: 'color', title: 'Time Zone Line Color', defval: '#2196f3', group: G_TZ },
  { id: 'histPivot2', type: 'int', title: 'Historical Time Zones', defval: 0, min: 0, group: G_TZ, display: 'data_window' },
  { id: 'zigZag', type: 'bool', title: 'Zig Zag', defval: false, inline: 'ZZ', group: G_ZZ, tooltip: TIP_ZIGZAG },
  { id: 'zzColor', type: 'color', title: '', defval: '#c77a08', inline: 'ZZ', group: G_ZZ },
  { id: 'zzStyle', type: 'string', title: '', defval: 'Solid', options: STYLES, inline: 'ZZ', group: G_ZZ, display: 'data_window' },
  { id: 'zzWidth', type: 'int', title: '', defval: 1, min: 1, inline: 'ZZ', group: G_ZZ, display: 'data_window' },
  { id: 'zzSwings', type: 'bool', title: 'Zig Zag Swing, ', defval: true, inline: 'ZZ2', group: G_ZZ, tooltip: TIP_SWINGS },
  { id: 'highColor', type: 'color', title: 'Highs', defval: '#d4a5a5', inline: 'ZZ2', group: G_ZZ },
  { id: 'lowColor', type: 'color', title: 'Lows', defval: '#8faadc', inline: 'ZZ2', group: G_ZZ },
  { id: 'tempColor', type: 'color', title: 'Temps', defval: '#0000f0', inline: 'ZZ2', group: G_ZZ },
  ...LEVELS.flatMap(([k, show, value, css, inline]): InputConfig[] => [
    { id: `show${k}`, type: 'bool', title: '', defval: show, inline, group: G_LEVELS },
    { id: `value${k}`, type: 'float', title: '', defval: value, inline, group: G_LEVELS, display: 'data_window' },
    { id: `color${k}`, type: 'color', title: '', defval: css, inline, group: G_LEVELS },
  ]),
  { id: 'highVolatility', type: 'bool', title: '⚡ High Volatility Detection', defval: true, group: G_VOLATILITY, tooltip: TIP_VOLATILITY },
  { id: 'atrLength', type: 'int', title: '  ATR Length', defval: 13, inline: 'ATR', group: G_VOLATILITY, display: 'data_window' },
  { id: 'atrMultiplier', type: 'float', title: 'Multiplier', defval: 2.718, min: 0.1, step: 0.1, inline: 'ATR', group: G_VOLATILITY, display: 'data_window' },
  { id: 'volumeLength', type: 'int', title: 'Volume Moving Average Length', defval: 89, group: G_VOLUME, display: 'data_window' },
  { id: 'volumeSpike', type: 'bool', title: '🚦 Volume Spike · Potential Exhaustion', defval: true, group: G_VOLUME, tooltip: TIP_SPIKE },
  { id: 'volumeSpikeThreshold', type: 'float', title: '  Volume Spike Threshold', defval: 4.669, min: 0.1, step: 0.1, group: G_VOLUME, display: 'data_window' },
  { id: 'volumeBars', type: 'bool', title: 'Volume-Weighted Colored Bars', defval: true, group: G_VOLUME, tooltip: TIP_BARS },
  { id: 'volumeHighThreshold', type: 'float', title: '  Volume Threshold: High', defval: 1.618, min: 1, step: 0.1, inline: 'VWC', group: G_VOLUME, display: 'data_window' },
  { id: 'volumeLowThreshold', type: 'float', title: 'Low', defval: 0.618, min: 0.1, step: 0.1, inline: 'VWC', group: G_VOLUME, display: 'data_window' },
];

/**
 * The 29 plots of the historical pivot points: the pivot, then pivot - range x level and pivot + range x level for
 * 14 of the levels (index in LEVELS, Pine title, style)
 */
const HIST_PLOTS = [
  [1, 'PP 0_236', 'cross'], [2, 'PP 0_382', 'line'], [3, 'PP 0_5  ', 'cross'], [4, 'PP 0_618', 'line'], [5, 'PP 0_65 ', 'cross'],
  [6, 'PP 0_786', 'cross'], [7, 'PP 1    ', 'line'], [8, 'PP 1_272', 'cross'], [9, 'PP 1_414', 'cross'], [10, 'PP 1_618', 'cross'],
  [11, 'PP 1_65 ', 'cross'], [12, 'PP 2_618', 'cross'], [13, 'PP 2_65 ', 'cross'], [14, 'PP 3_618', 'cross'],
] as const;

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'PP', color: LEVELS[0][3], lineWidth: 1 },
  ...HIST_PLOTS.flatMap(([level, title, style], k): PlotConfig[] => [
    { id: `plot${2 * k + 1}`, title, color: LEVELS[level][3], lineWidth: 1, style },
    { id: `plot${2 * k + 2}`, title, color: LEVELS[level][3], lineWidth: 1, style },
  ]),
];

export const metadata = {
  title: 'Fibonacci Extention / Retracment / Pivot Points by DGT',
  shortTitle: 'FIBs · ☼☾',
  overlay: true,
};

/** indicator(max_lines_count = 500, max_labels_count = 500) */
const MAX_OBJECTS = 500;
const GRAY = '#787B86';
const TEAL = '#089981';
const BLUE = '#2962FF';
const CLEAR = '#00000000';
/** Multipliers of the leg length for the time zone lines */
const TIME_ZONES = [-1, 0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

interface Ln {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** null = na */
  color: string | null;
  width: number;
  style: 'solid' | 'dashed' | 'dotted';
  extend: 'none' | 'right' | 'both';
  /** xloc.bar_time: x1 and x2 are times */
  byTime: boolean;
}
interface Lb {
  x: number;
  y: number;
  text: string;
  textColor: string | null;
  style: 'label_down' | 'label_up' | 'label_left' | 'label_right';
  size: 'small' | 'normal';
  align: 'center' | 'left';
  tooltip: string;
  byTime: boolean;
  /** x is timenow, read when the result is made (the clock of the update, as a full run on the same bars) */
  atNow?: boolean;
}

/**
 * Live drawings of one type. When a creation brings the count above max + 5, the oldest are deleted until max remain.
 * `queue` has the objects that this limit can delete (zigzag lines, swing labels), in creation order; the other live
 * objects (kept in a variable of the script, or made and deleted on every bar) only count: they are either never
 * deleted by the limit or newer than the whole queue.
 */
class Pool<T> {
  private queue: T[] = [];
  private head = 0;
  private others = 0;
  create(obj?: T): void {
    if (obj) this.queue.push(obj);
    else this.others++;
    if (this.queue.length - this.head + this.others > MAX_OBJECTS + 5) {
      while (this.head < this.queue.length && this.queue.length - this.head + this.others > MAX_OBJECTS) this.head++;
    }
  }
  remove(count = 1): void {
    this.others -= count;
  }
  alive(): T[] {
    return this.queue.slice(this.head);
  }
  /** A copy for the state of a bar, with `to` in place of `from` (an object that is changed later is copied too) */
  copy(from?: T | null, to?: T | null): Pool<T> {
    const p = new Pool<T>();
    p.queue = this.alive();
    p.others = this.others;
    const k = from ? p.queue.lastIndexOf(from) : -1;
    if (k >= 0) p.queue[k] = to!;
    return p;
  }
}

const lineStyle = (s: LineStyleName) => (s === 'Solid' ? 'solid' : s === 'Dotted' ? 'dotted' : 'dashed');

type Result = IndicatorResult & {
  markers: MarkerData[]; barColors: BarColorData[]; lines: LineDrawingData[]; labels: LabelData[]; tables: TableData[];
  alerts: AlertConditionState[]; alertCalls: AlertCall[];
};

/** The variables of the script kept from bar to bar (copied at the end of the last confirmed bar) */
interface FibVars {
  /** The running zigzag line (its end moves with the swing: copied with the state) */
  zzLine: Ln | null;
  iLast: number;
  pLast: number;
  isHighLast: boolean;
  iPrevPivot: number;
  pPrevPivot: number;
  iLastPivot: number;
  pLastPivot: number;
  /** The label of the running swing high / low */
  tmpHigh: Lb | null;
  tmpLow: Lb | null;
  linePool: Pool<Ln>;
  labelPool: Pool<Lb>;
  /** The values of the bar before of iPrevPivot, pPrevPivot, iLastPivot, pLastPivot (ta.change) */
  prevChange: readonly number[];
  // f_htf_ohlc(): high, low and close of the period before, kept without a request of the higher timeframe
  htfH: number;
  htfL: number;
  htfH1: number;
  htfL1: number;
  htfC1: number;
  timeX10: number;
  timeX11: number;
  /**
   * Lines and labels made on every bar and kept in two arrays, with the bar that made each one. On every bar the
   * script deletes them with `for i = 1 to array.size(ln)` and `array.shift(ln)`: the end of the loop is read again on
   * each turn while the array gets shorter, so only the older half (rounded up) is deleted. The arrays never hold
   * objects older than a few bars: before the last RECENT bars the objects are only counted (null).
   */
  ln: Array<Ln | null>;
  lnBar: number[];
  lb: Array<Lb | null>;
  lbBar: number[];
}

interface FibRun extends BarRunState<FibVars> {
  atr10: ReturnType<typeof taStep.atr>;
  /** ATR(10) of the current bar (the deviation of a new leg) */
  atr10Of: number;
  atr: ReturnType<typeof taStep.atr>;
  vSma: WindowSma;
  /** The period of the higher timeframe of each bar, and the bar count and last time they were computed for */
  starts: number[];
  startsCount: number;
  startsLast: number;
  /** ta.valuewhen(ta.change(x) != 0, x, occurrence): the values of iPrevPivot, pPrevPivot, iLastPivot, pLastPivot on
   *  the bars where they changed */
  changes: number[][];
  plots: Array<Array<{ time: number; value: number; color?: string }>>;
  /** Volume average and ATR of each bar (the alert conditions read the bar before) */
  vSmaOf: number[];
  atrOf: number[];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
  barColors: BarColorData[];
  alertCalls: AlertCall[];
  /** Lines and labels of the extension / retracement tool: made once per call, then moved on every bar */
  toolLines: Ln[];
  toolLabels: Lb[];
}

/** Bars from the end that keep the objects of the lines and labels made on every bar (see FibVars.ln) */
const RECENT = 32;

function study(inputs: Partial<FibonacciExtensionRetracementPivotPointsInputs>): BarStudy<FibRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const levels = LEVELS.map(([k]) => ({ show: cfg[`show${k}`], value: cfg[`value${k}`], css: cfg[`color${k}`] }));
  const tool = cfg.fibTool;
  const withExt = tool === 'Extensions' || tool === 'Extensions + Pivot Points';
  const withRet = tool === 'Retracements' || tool === 'Retracements + Pivot Points';
  const withPvt = tool === 'Pivot Points' || tool === 'Extensions + Pivot Points' || tool === 'Retracements + Pivot Points';
  const histPP = cfg.histPP && withPvt;
  const extendStyle = lineStyle(cfg.extendL);
  const tzStyle = cfg.fibTzlp === 'Left' ? 'label_left' : 'label_right';
  const zzStyle = cfg.zigZag ? lineStyle(cfg.zzStyle) : 'dashed';
  let priceText = (v: number) => str.tostring(v, 'mintick', mintickOf());
  let ticker = tickerOf();

  // Higher timeframe of the pivot points
  const htfOf = (bars: Bar[], chart: ChartContext) => {
    const chartTf = chartTimeframe(bars, chart);
    const info = chartTf === '' ? null : timeframe.info(chartTf);
    const fixed: Record<string, string> = {
      '15 Min': '15', '1 Hour': '60', '4 Hour': '240', Session: 'D', Daily: 'D', Weekly: 'W', Monthly: 'M', Quarterly: '3M', Yearly: '12M',
    };
    return fixed[cfg.pivotTimeframe]
      ?? (['1', '3', '5', '15'].includes(chartTf) ? 'D'
        : ['30', '45', '60', '120', '180', '240'].includes(chartTf) ? 'W'
          : info?.isdaily ? 'M'
            : info?.isweekly || info?.ismonthly ? '12M' : '3M');
  };

  // pivots(src, depth / 2, isHigh): the division keeps its fraction (5.5 for a depth of 11); the history index is
  // truncated and the loop runs up to twice the length
  const half = cfg.depth / 2;
  const back = Math.trunc(half);
  const span = half * 2;
  const pivotAt = (bars: Bar[], i: number, isHigh: boolean): [number, number] => {
    const c = i >= back ? (isHigh ? bars[i - back].high : bars[i - back].low) : 0;
    for (let k = 0; k <= span && k <= i; k++) {
      if (isHigh ? gt(bars[i - k].high, c) : lt(bars[i - k].low, c)) return [NaN, NaN];
    }
    return [i >= back ? i - back : NaN, c];
  };

  const swing = (s: FibRun, bars: Bar[], i: number, isHigh: boolean, index: number, price: number) => {
    const v = s.vars;
    const dev = (100 * (price - v.pLast)) / price;
    // pivotFound()
    let id: Ln | null = null;
    let newDirection = v.isHighLast;
    if (v.isHighLast === isHigh && v.zzLine !== null) {
      if (v.isHighLast ? gt(price, v.pLast) : lt(price, v.pLast)) {
        v.zzLine.x2 = index;
        v.zzLine.y2 = price;
        id = v.zzLine;
      }
    } else if (gt(Math.abs(dev), (s.atr10Of / bars[i].close) * 100 * cfg.deviation)) {
      id = {
        x1: v.iLast, y1: v.pLast, x2: index, y2: price, color: cfg.zigZag ? cfg.zzColor : null, width: cfg.zigZag ? cfg.zzWidth : 1,
        style: zzStyle, extend: 'none', byTime: false,
      };
      // without the zigzag option the line before is deleted below: only the running line is alive
      v.linePool.create(cfg.zigZag ? id : undefined);
      newDirection = isHigh;
    }
    if (id === null) return;
    // `id != lineLast` is also true while lineLast is na (the first line): the four values become na
    if (id !== v.zzLine) {
      v.iPrevPivot = v.zzLine?.x1 ?? NaN;
      v.pPrevPivot = v.zzLine?.y1 ?? NaN;
      v.iLastPivot = v.zzLine?.x2 ?? NaN;
      v.pLastPivot = v.zzLine?.y2 ?? NaN;
      if (cfg.zzSwings) {
        v.labelPool.create({
          x: v.iPrevPivot, y: v.pPrevPivot, text: isHigh ? '▼' : '▲', textColor: isHigh ? cfg.highColor : cfg.lowColor,
          style: isHigh ? 'label_down' : 'label_up', size: 'small', align: 'center',
          tooltip: `ZigZag Swing ${isHigh ? 'High' : 'Low'}\nPrice : ${priceText(v.pPrevPivot)}`, byTime: false,
        });
      }
      if (!cfg.zigZag && v.zzLine !== null) v.linePool.remove();
    }
    v.zzLine = id;
    v.isHighLast = newDirection;
    v.iLast = index;
    v.pLast = price;
    if (cfg.zzSwings) {
      // each direction has its own label of the running swing
      if ((isHigh ? v.tmpHigh : v.tmpLow) !== null) v.labelPool.remove();
      const tmp: Lb = {
        x: v.iLast, y: v.pLast, text: isHigh ? '●\n▼' : '▲\n●', textColor: cfg.tempColor, style: isHigh ? 'label_down' : 'label_up',
        size: 'small', align: 'center',
        tooltip: `Temporary ZigZag Swing ${isHigh ? 'High' : 'Low'}\nPrice : ${priceText(v.pLast)}\n\n⚠ Provisional level\n`
          + 'Subject to repaint until structure confirms',
        byTime: false,
      };
      if (isHigh) v.tmpHigh = tmp;
      else v.tmpLow = tmp;
      v.labelPool.create();
    }
  };

  // ta.valuewhen(ta.change(x) != 0, x, occurrence)
  const changed = (s: FibRun, k: number, occurrence: number) => {
    const values = s.changes[k];
    return values.length > occurrence ? values[values.length - 1 - occurrence] : NaN;
  };

  return {
    // the chart timeframe (from the bar gaps without a context) gives the higher timeframe; the unit of the times
    key: (bars, chart) => `${htfOf(bars, chart)}|${bars.length > 0 && bars[0].time >= 1e12}`,
    copyVars(v) {
      // the running zigzag line is changed in place by the next swings: the copy has its own, also in the pool
      const zzLine = v.zzLine ? { ...v.zzLine } : null;
      return {
        ...v, zzLine, linePool: v.linePool.copy(v.zzLine, zzLine), labelPool: v.labelPool.copy(),
        ln: v.ln.slice(), lnBar: v.lnBar.slice(), lb: v.lb.slice(), lbBar: v.lbBar.slice(),
      };
    },
    init(bars, chart) {
      // str.tostring(v, format.mintick) with syminfo.mintick
      const mintick = mintickOf(chart);
      priceText = (v: number) => str.tostring(v, 'mintick', mintick);
      ticker = tickerOf(chart);
      const s: FibRun = {
        atr10: taStep.atr(10), atr: taStep.atr(cfg.atrLength), vSma: new WindowSma(cfg.volumeLength), atr10Of: NaN,
        starts: periodStarts(bars, htfOf(bars, chart), chart), startsCount: bars.length, startsLast: bars[bars.length - 1]?.time ?? NaN,
        changes: [[], [], [], []], plots: plotConfig.map(() => []), vSmaOf: [], atrOf: [], flags: [[], []], times: [[], []],
        markers: [], barColors: [], alertCalls: [], toolLines: [], toolLabels: [],
        steps: [], lists: [], series: [],
        vars: {
          zzLine: null, iLast: 0, pLast: 0, isHighLast: false, iPrevPivot: 0, pPrevPivot: 0, iLastPivot: 0, pLastPivot: 0,
          tmpHigh: null, tmpLow: null, linePool: new Pool<Ln>(), labelPool: new Pool<Lb>(), prevChange: [NaN, NaN, NaN, NaN],
          htfH: 0, htfL: 0, htfH1: 0, htfL1: 0, htfC1: 0, timeX10: NaN, timeX11: NaN, ln: [], lnBar: [], lb: [], lbBar: [],
        },
      };
      s.steps = [s.atr10, s.atr, s.vSma];
      s.lists = [...s.changes, ...s.times, s.markers, s.barColors, s.alertCalls, s.toolLines, s.toolLabels];
      s.series = [...s.plots, s.vSmaOf, s.atrOf, ...s.flags];
      return s;
    },
    // the periods come from every bar time (a weekend bar makes every day a trading day): computed again for new bars,
    // the bars already calculated keep theirs or the update runs in full
    prepare(s, bars, chart, from) {
      const n = bars.length;
      if (n === s.startsCount && bars[n - 1].time === s.startsLast) return true;
      const starts = periodStarts(bars, htfOf(bars, chart), chart);
      for (let i = 0; i < from; i++) if (starts[i] !== s.starts[i]) return false;
      s.starts = starts;
      s.startsCount = n;
      s.startsLast = bars[n - 1].time;
      return true;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const n = bars.length;
      const b = bars[i];
      const t = b.time;
      const isLast = i === n - 1;
      // f_crossingLevel(close, level): level > close and level < close[1] or level < close and level > close[1]
      const prevClose = i > 0 ? bars[i - 1].close : NaN;
      const crossing = (lvl: number) => (gt(lvl, b.close) && lt(lvl, prevClose)) || (lt(lvl, b.close) && gt(lvl, prevClose));
      const call = (message: string) => s.alertCalls.push({ time: t, message, freq: 'once_per_bar' });
      s.atr10Of = s.atr10.step(b.high, b.low, b.close);
      const atr = s.atr.step(b.high, b.low, b.close);
      const vSma = s.vSma.step(b.volume ?? 0);
      s.atrOf[i] = atr;
      s.vSmaOf[i] = vSma;

      // Zigzag
      const [iH, pH] = pivotAt(bars, i, true);
      if (!isNaN(iH)) swing(s, bars, i, true, iH, pH);
      else {
        const [iL, pL] = pivotAt(bars, i, false);
        if (!isNaN(iL)) swing(s, bars, i, false, iL, pL);
      }
      const pivots = [v.iPrevPivot, v.pPrevPivot, v.iLastPivot, v.pLastPivot];
      pivots.forEach((x, k) => {
        if (Math.abs(x - v.prevChange[k]) > EPS) s.changes[k].push(x);
      });
      v.prevChange = pivots;
      const running = v.zzLine;
      const base = (hist: number) => ({
        iEnd: hist > 0 ? changed(s, 2, hist - 1) : running?.x2 ?? NaN,
        pEnd: hist > 0 ? changed(s, 3, hist - 1) : running?.y2 ?? NaN,
        iMid: hist > 0 ? changed(s, 0, hist - 1) : running?.x1 ?? NaN,
        pMid: hist > 0 ? changed(s, 1, hist - 1) : running?.y1 ?? NaN,
      });
      const iStartBase = changed(s, 0, cfg.histPivot > 0 ? cfg.histPivot : 0);
      const pStartBase = changed(s, 1, cfg.histPivot > 0 ? cfg.histPivot : 0);
      const { iEnd: iEndBase, pEnd: pEndBase, iMid: iMidPivot, pMid: pMidPivot } = base(cfg.histPivot);
      const zone = base(cfg.histPivot2);

      // Higher timeframe
      const change = i > 0 && s.starts[i] !== s.starts[i - 1];
      if (change) {
        v.htfH1 = v.htfH;
        v.htfH = b.high;
        v.htfL1 = v.htfL;
        v.htfL = b.low;
        v.htfC1 = bars[i - 1].close;
        v.timeX10 = v.timeX11;
        v.timeX11 = t;
      } else {
        v.htfH = Math.max(b.high, v.htfH);
        v.htfL = Math.min(b.low, v.htfL);
      }
      const timeX10 = v.timeX10;
      const timeX11 = v.timeX11;
      const timeX21 = 2 * timeX11 - timeX10;

      // The lines and labels of the bar before are deleted
      if (i > 0) {
        const lines = Math.floor((v.ln.length + 1) / 2);
        const labels = Math.floor((v.lb.length + 1) / 2);
        v.ln.splice(0, lines);
        v.lnBar.splice(0, lines);
        v.lb.splice(0, labels);
        v.lbBar.splice(0, labels);
        v.linePool.remove(lines);
        v.labelPool.remove(labels);
      }
      const recent = i >= n - RECENT;
      const tmpLine = (make: () => Ln) => {
        v.linePool.create();
        v.ln.push(recent ? make() : null);
        v.lnBar.push(i);
      };
      const tmpLbl = (make: () => Lb) => {
        v.labelPool.create();
        v.lb.push(recent ? make() : null);
        v.lbBar.push(i);
      };

      // Time zones
      if (cfg.fibTime) {
        const reference = math.round(zone.iEnd - zone.iMid) as number;
        for (const k of TIME_ZONES) {
          const x = zone.iMid + reference * k;
          if (x - i < 500) {
            tmpLine(() => ({
              x1: x, y1: zone.pEnd, x2: x, y2: zone.pMid, color: k === 0 || k === 1 ? GRAY : cfg.tzColor, width: 1, style: 'solid',
              extend: 'both', byTime: false,
            }));
          }
        }
        if (cfg.fibTzl) {
          const y = cfg.fibTzlp2 === 'Bottom' ? Math.min(zone.pEnd, zone.pMid) : Math.max(zone.pEnd, zone.pMid);
          for (const k of TIME_ZONES) {
            const x = zone.iMid + reference * k;
            if (x - i < 500) {
              tmpLbl(() => ({
                x, y, text: String(k), textColor: k === 0 || k === 1 ? GRAY : cfg.tzColor, style: tzStyle, size: 'normal', align: 'center',
                tooltip: '', byTime: false,
              }));
            }
          }
        }
      }

      // f_processLevelX() of each level
      const pivot = (v.htfH1 + v.htfL1 + v.htfC1) / 3;
      const range = v.htfH1 - v.htfL1;
      if (cfg.isFib) {
        const pPivotDiff = Math.abs(pMidPivot - pEndBase);
        const sign = cfg.reverse ? -1 : 1;
        // f_drawLineX(): the line is made on the first bar, then set on every bar
        const toolLine = (x1: number, y1: number, x2: number, y2: number, extend: Ln['extend'], css: string, style: Ln['style']) => {
          if (i === 0) v.linePool.create();
          if (!isLast) return;
          const ok = gt(y1, 0) && gt(y2, 0);
          s.toolLines.push({
            x1, y1: ok ? y1 : b.close, x2, y2: ok ? y2 : b.close, color: ok ? css : CLEAR, width: 1, style, extend, byTime: false,
          });
        };
        // f_drawLabelX()
        const toolLabel = (price: number, name: string, level: number, css: string) => {
          if (i === 0) v.labelPool.create();
          if (!isLast) return;
          const text = (cfg.levels === 'Prices' ? '' : `${name} ${str.tostring(level)}`)
            + (cfg.levels === 'Levels + Prices' || cfg.levels === 'Prices' ? ` (${priceText(price)})` : '');
          const ok = gt(price, 0);
          s.toolLabels.push({
            x: cfg.levelsP === 'Last Bar' ? i : iMidPivot, y: ok ? price : b.close,
            text: cfg.extend || cfg.extendER || cfg.levelsP === 'Last Bar' ? `${text}\n\n` : text,
            textColor: ok ? css : CLEAR, style: cfg.levelsP === 'Last Bar' ? 'label_left' : 'label_right',
            size: cfg.levelsS === 'Small' ? 'small' : 'normal', align: 'left', tooltip: priceText(price), byTime: false,
          });
        };
        // f_drawLinePVT() / f_drawLabelPVT()
        const pvtLine = (x1: number, y: number, extend: Ln['extend'], css: string | null, style: Ln['style'], width: number) => {
          if (gt(y, 0)) tmpLine(() => ({ x1, y1: y, x2: timeX21, y2: y, color: css, width, style, extend, byTime: true }));
        };
        const pvtLabel = (y: number, name: string, css: string | null) => {
          if (!gt(y, 0)) return;
          tmpLbl(() => {
            const text = (cfg.levelsPvt === 'Prices' ? '' : name)
              + (cfg.levelsPvt === 'Levels + Prices' || cfg.levelsPvt === 'Prices' ? ` (${priceText(y)})` : '');
            const atNow = cfg.levelsPvtP === 'Last Bar';
            return {
              x: atNow ? NaN : timeX21, y, atNow,
              text: cfg.extend || atNow ? `${text}\n\n` : text, textColor: css, style: 'label_left',
              size: cfg.levelsPvtS === 'Small' ? 'small' : 'normal', align: 'left', tooltip: priceText(y), byTime: true,
            };
          });
        };

        for (const { show, value: level, css } of levels) {
          if (withExt) {
            toolLine(iStartBase, pStartBase, iMidPivot, pMidPivot, 'none', GRAY, 'dashed');
            toolLine(iMidPivot, pMidPivot, iEndBase, pEndBase, 'none', GRAY, 'dashed');
            const offset = Math.abs(pMidPivot - pStartBase);
            const price = lt(pEndBase, pMidPivot)
              ? pMidPivot - pPivotDiff + sign * offset * level
              : pMidPivot + pPivotDiff - sign * offset * level;
            if (show) {
              toolLine(iMidPivot, price, i, price, cfg.extendER ? 'both' : 'right', css, 'solid');
              if (cfg.levels !== 'None') toolLabel(price, 'EXT', level, css);
              if (crossing(price)) call('AutoFib Extension : ' + ticker + ' crossing level ' + str.tostring(level));
            }
          }
          if (withRet) {
            toolLine(iMidPivot, pMidPivot, iEndBase, pEndBase, 'none', GRAY, 'dashed');
            const from = cfg.reverse ? pEndBase : pMidPivot;
            const price = lt(pEndBase, pMidPivot) ? from - sign * pPivotDiff * level : from + sign * pPivotDiff * level;
            if (show) {
              toolLine(iMidPivot, price, i, price, cfg.extendER ? 'both' : 'right', css, 'solid');
              if (cfg.levels !== 'None') toolLabel(price, 'RET', level, css);
              if (crossing(price)) call('AutoFib Retracment : ' + ticker + ' crossing level ' + str.tostring(level));
            }
          }
          if (withPvt) {
            if (!cfg.histPP) pvtLine(timeX10, pivot, 'none', GRAY, 'dashed', 1);
            if (show && level >= -EPS) {
              const main = eq(level, 0) || eq(level, 0.382) || eq(level, 0.618) || eq(level, 1);
              const lo = pivot - range * level;
              const hi = pivot + range * level;
              const loCss = cfg.relevant ? (lt(b.close, pivot) ? css : null) : css;
              const hiCss = cfg.relevant ? (gt(b.close, pivot) ? css : null) : css;
              pvtLine(timeX11, lo, 'none', loCss, main ? 'solid' : 'dashed', main ? 2 : 1);
              pvtLine(timeX11, hi, 'none', hiCss, main ? 'solid' : 'dashed', main ? 2 : 1);
              if (cfg.extend) {
                pvtLine(timeX11, lo, 'both', loCss, extendStyle, 1);
                pvtLine(timeX11, hi, 'both', hiCss, extendStyle, 1);
              }
              if (cfg.levelsPvt !== 'None') {
                if (main && eq(level, 0)) pvtLabel(pivot, 'PP', css);
                else {
                  const rank = eq(level, 0.382) ? '1' : eq(level, 0.618) ? '2' : '3';
                  const lvl = str.tostring(level);
                  pvtLabel(lo, main ? `S${rank} PP ${lvl}` : `   PP ${lvl}`, loCss);
                  pvtLabel(hi, main ? `R${rank} PP ${lvl}` : `   PP ${lvl}`, hiCss);
                }
              }
              if (crossing(lo)) call('AutoFib PivotPoints : ' + ticker + ' crossing support level ' + str.tostring(level));
              if (crossing(hi)) call('AutoFib PivotPoints : ' + ticker + ' crossing resistance level ' + str.tostring(level));
            }
          }
        }
      }

      // Historical pivot points
      const plotColor = (css: string) => (change ? 'transparent' : css);
      s.plots[0][i] = { time: t, value: histPP && levels[0].show ? pivot : NaN, color: plotColor(levels[0].css) };
      HIST_PLOTS.forEach(([level], k) => {
        const { show, value, css } = levels[level];
        s.plots[2 * k + 1][i] = { time: t, value: histPP && show ? pivot - range * value : NaN, color: plotColor(css) };
        s.plots[2 * k + 2][i] = { time: t, value: histPP && show ? pivot + range * value : NaN, color: plotColor(css) };
      });

      // Volume and volatility add-ons
      const volume = b.volume ?? 0;
      const hasVolume = !isNaN(volume) && volume !== 0;
      if (cfg.volumeSpike && hasVolume && gt(volume, cfg.volumeSpikeThreshold * vSma)) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'circle', color: 'transparent', text: '🚦', textColor: BLUE, size: 'tiny' });
      }
      if (cfg.highVolatility && gt(Math.abs(b.high - b.low), atr * cfg.atrMultiplier)) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'circle', color: 'transparent', text: '⚡', textColor: BLUE, size: 'tiny' });
      }
      if (cfg.volumeBars && hasVolume) {
        if (gt(volume, vSma * cfg.volumeHighThreshold)) {
          s.barColors.push({ time: t, color: gt(b.close, b.open) ? '#006400' : '#910000' });
        } else if (lt(volume, vSma * cfg.volumeLowThreshold)) {
          s.barColors.push({ time: t, color: lt(b.close, b.open) ? '#FF9800' : '#7FFFD4' });
        }
      }

      // alertcondition(ta.crossover(nzVolume, i_vSMA * i_vSpikeThresh), 'Volume Spikes', ...)
      // alertcondition(ta.crossover(range_1, i_weightedATR), 'High Volatility', ...)
      const nzVolume = (k: number) => (bars[k].volume === undefined || isNaN(bars[k].volume!) ? 0 : bars[k].volume!);
      const range1 = (k: number) => Math.abs(bars[k].high - bars[k].low);
      const prev = i > 0;
      const flags = [
        nzVolume(i) > vSma * cfg.volumeSpikeThreshold
          && (prev ? nzVolume(i - 1) : NaN) <= (prev ? s.vSmaOf[i - 1] * cfg.volumeSpikeThreshold : NaN),
        range1(i) > atr * cfg.atrMultiplier && (prev ? range1(i - 1) : NaN) <= (prev ? s.atrOf[i - 1] * cfg.atrMultiplier : NaN),
      ];
      flags.forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(t);
      });
    },
    result(s, bars, chart) {
      const n = bars.length;
      const v = s.vars;
      const ms = n > 0 && bars[0].time >= 1e12;
      // timenow
      const nowMs = nowOf(chart);
      const nowTime = ms ? nowMs : Math.floor(nowMs / 1000);
      const interval = barInterval(bars);
      const toLine = (l: Ln): LineDrawingData => ({
        time1: l.byTime ? l.x1 : barTime(bars, l.x1, interval), price1: l.y1, time2: l.byTime ? l.x2 : barTime(bars, l.x2, interval),
        price2: l.y2, color: l.color ?? 'transparent', width: l.width,
        ...(l.style === 'solid' ? {} : { style: l.style }), ...(l.extend === 'none' ? {} : { extend: l.extend }),
      });
      const toLabel = (l: Lb): LabelData => ({
        time: l.atNow ? nowTime : l.byTime ? l.x : barTime(bars, l.x, interval), price: l.y, text: l.text, color: CLEAR,
        textColor: l.textColor ?? 'transparent', style: l.style, size: l.size, ...(l.align === 'center' ? {} : { textAlign: l.align }),
        ...(l.tooltip === '' ? {} : { tooltip: l.tooltip }),
      });
      const finalLine = v.zzLine;
      const zigzag: Ln[] = cfg.zigZag ? v.linePool.alive() : finalLine ? [finalLine] : [];
      const swingLabels = v.labelPool.alive();
      const tmpLabels = [v.tmpHigh, v.tmpLow].filter((l): l is Lb => l !== null);
      // the swing labels have a white background with a transparency of 100
      const swingLabel = (l: Lb): LabelData => ({ ...toLabel(l), color: '#FFFFFF00' });
      // an object with an na coordinate is not drawn
      const drawnLine = (l: LineDrawingData) => ![l.time1, l.time2, l.price1, l.price2].some((x) => isNaN(x));
      const drawnLabel = (l: LabelData) => !isNaN(l.time) && !isNaN(l.price);
      // the objects of the bars before the last RECENT ones are only counted (made by an earlier update, they are left out)
      const recent = <T>(objs: Array<T | null>, at: number[]) => objs.filter((o, k): o is T => o !== null && at[k] >= n - RECENT);
      const plots: Record<string, Array<{ time: number; value: number; color?: string }>> = {};
      plotConfig.forEach((p, k) => {
        plots[p.id] = s.plots[k].slice();
      });

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        lines: [...zigzag, ...recent(v.ln, v.lnBar), ...s.toolLines].map(toLine).filter(drawnLine),
        labels: [
          ...[...swingLabels, ...tmpLabels].map(swingLabel),
          ...[...recent(v.lb, v.lbBar), ...s.toolLabels].map(toLabel),
        ].filter(drawnLabel),
        // var table logo = table.new(position.bottom_right, 1, 1) with one cell
        tables: n > 0
          ? [{ position: 'bottom_right', columns: 1, rows: 1, cells: [{ column: 0, row: 0, text: '☼☾  ', textSize: 'normal', textColor: TEAL }] }]
          : [],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
        alertCalls: s.alertCalls.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(
  inputs: Partial<FibonacciExtensionRetracementPivotPointsInputs> = {},
  chart: ChartContext = {},
): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<FibonacciExtensionRetracementPivotPointsInputs> = {},
  chart?: ChartContext,
): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  {
    id: 'alert0', title: 'Volume Spikes',
    message: 'sign of exhaustion, huge volume increase detected\n{{exchange}}:{{ticker}}->\nOpen = {{open}}, Current = {{close}},\nTime = {{time}}',
  },
  {
    id: 'alert1', title: 'High Volatility',
    message: 'high volatility detected\n{{exchange}}:{{ticker}}->\nOpen = {{open}}, Current = {{close}},\nTime = {{time}}',
  },
];

export const hasAlertFunction = true;

export const FibonacciExtensionRetracementPivotPoints = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
  hasAlertFunction,
};
