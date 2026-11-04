/**
 * Elliott Impulse Engine [WillyAlgoTrader]
 *
 * A state machine that counts one Elliott impulse (points 0 to 5) and its correction (A, B, C) at a time.
 * Swing structure: pivots of "Swing Detection Length" give the swing high and low; a confirmed close beyond an
 * unbroken swing is a structure break, and a break against the trend (after the warm-up of max(3 x length, 50)
 * bars) is a CHoCH. A CHoCH seeds a count: point 0 is the extreme of the current swing, the CHoCH level is the level
 * that point 1 must pass. Wave points are the short pivots of "Point Confirmation": counter-trend pivots give 2, 4,
 * A and C, with-trend pivots give 1, 3, 5 and B. Point 2 is also taken (at the best retracement since point 1) when
 * the price breaks point 1 first. Each point gets a label ("~" when it is outside its Fibonacci range), the path is
 * drawn segment by segment, and points 1 to 5 can move to a more extreme pivot until the next one is confirmed.
 * Invalidation (close or wick beyond point 0, 2 or 4, as the state requires), a third wave shorter than the first
 * and the fifth, a correction below point 2 or a timeout ends the count with a reset mark; point C, or B / a break
 * beyond point 5, ends it as completed.
 *
 * Outputs (drawings): the path and the point labels of the active count, the dotted Fibonacci grid of leg 0 to 1
 * with its price labels, the target boxes of points 2, 3 and 4 with their centre lines, the dashed ghost path of
 * the next points (2? to C?), the trailing invalidation line and label, the CHoCH lines and labels (up to "Historical
 * CHoCH, max"; dotted from the bar of a close back through the level, unmitigated ones run 20 bars past the last bar),
 * the reset marks since the last CHoCH, the dashboard and the watermark (tables of the last bar).
 * Alerts: the ten alertconditions (`alerts` of the result) and the two alert() calls (`alertCalls`: hypothesis reset,
 * correction dismissed), once per bar close in the "Close" mode, once per bar in the "Wick" mode.
 *
 * Chart values (third argument of calculate):
 * - State of the last bar (`lastBarConfirmed`): pivots, structure breaks, CHoCH mitigation and the "Close" breaks
 *   are read on closed bars only. Without it: the last bar is closed.
 * - Symbol tick: the CHoCH level lock tolerance (half a tick) and the price texts. Without it: 0.01.
 * - Chart background colour (theme "Auto": dark below 128 of red). Without it: #0F0F0F, a dark chart.
 * - Chart timeframe: the "TF" row of the dashboard. Without it: from the bar spacing.
 *
 * Reference: "Elliott Impulse Engine [WillyAlgoTrader]" by WillyAlgoTrader
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, str, color, Series, line, label, box, resetDrawings, setDrawingBar, varDrawing,
  type Box, type Label, type Line, type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import type { AlertCall, BoxData, LabelData, LineDrawingData, PineSize, TableCellData, TableData, TablePosition } from '../types';
import type { StudyDrawingKind } from '../style-outputs';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import { barInterval, barTime } from '../bar-time';
import { chartTimeframe } from '../anchor-period';
import { backgroundColorOf, lastBarConfirmedOf, mintickOf, type ChartContext } from '../chart-context';

type FontSize = 'Tiny' | 'Small' | 'Normal' | 'Large' | 'Huge';

export interface ElliottImpulseEngineInputs {
  swingLen: number;
  accDepth: number;
  confMode: 'Close' | 'Wick';
  r2Min: number;
  r2Max: number;
  r3Min: number;
  r3Max: number;
  r4Min: number;
  r4Max: number;
  r5Min: number;
  r5Max: number;
  rBMin: number;
  rBMax: number;
  rCMin: number;
  rCMax: number;
  showGhost: boolean;
  ghAnchor: 'Middle' | 'Near' | 'Far';
  ghCoef: number;
  g5Off: number;
  cooldown: number;
  timeoutK: number;
  theme: 'Auto' | 'Dark' | 'Light';
  showGrid: boolean;
  showBoxes: boolean;
  showChoch: boolean;
  pathWidth: number;
  boxExt: number;
  maxChoch: number;
  labelFontSize: FontSize;
  showWatermark: boolean;
  s0236: boolean;
  s0382: boolean;
  s0500: boolean;
  s0618: boolean;
  s0705: boolean;
  s0786: boolean;
  s0886: boolean;
  s1000: boolean;
  sm500: boolean;
  sm618: boolean;
  sm100: boolean;
  useCustomColors: boolean;
  longPtColor: string;
  shortPtColor: string;
  oteColor: string;
  pathColor: string;
  ghostColor: string;
  bullColor: string;
  bearColor: string;
  gridRed: string;
  gridBlue: string;
  gridBlue2: string;
  gridGray: string;
  gridTeal: string;
  showDash: boolean;
  dashPos: 'Top Left' | 'Top Right' | 'Bottom Left' | 'Bottom Right' | 'Middle Right';
  dashFontSize: 'Small' | 'Normal' | 'Large' | 'Huge';
}

export const defaultInputs: ElliottImpulseEngineInputs = {
  swingLen: 10,
  accDepth: 5,
  confMode: 'Close',
  r2Min: 0.5,
  r2Max: 0.705,
  r3Min: -0.5,
  r3Max: -0.618,
  r4Min: 0.5,
  r4Max: 0.705,
  r5Min: -0.618,
  r5Max: -1.0,
  rBMin: -0.5,
  rBMax: -0.618,
  rCMin: 0.0,
  rCMax: 0.236,
  showGhost: true,
  ghAnchor: 'Middle',
  ghCoef: 1.0,
  g5Off: 0.05,
  cooldown: 0,
  timeoutK: 0.0,
  theme: 'Auto',
  showGrid: true,
  showBoxes: true,
  showChoch: true,
  pathWidth: 2,
  boxExt: 20,
  maxChoch: 50,
  labelFontSize: 'Small',
  showWatermark: true,
  s0236: true,
  s0382: true,
  s0500: true,
  s0618: true,
  s0705: true,
  s0786: true,
  s0886: true,
  s1000: true,
  sm500: true,
  sm618: true,
  sm100: true,
  useCustomColors: false,
  longPtColor: '#00E676',
  shortPtColor: '#FF5252',
  oteColor: '#FFEB3B',
  pathColor: '#2962FF',
  ghostColor: '#787B86',
  bullColor: '#089981',
  bearColor: '#FF5252',
  gridRed: '#FF5252',
  gridBlue: '#5B9CF6',
  gridBlue2: '#64B5F6',
  gridGray: '#9E9E9E',
  gridTeal: '#26A69A',
  showDash: true,
  dashPos: 'Top Right',
  dashFontSize: 'Small',
};

const GRP_MAIN = '⚙️ Main Settings';
const GRP_FIB = '📐 Point Ranges (fib)';
const GRP_GHOST = '👻 Ghost Projection';
const GRP_RESET = '♻️ Reset';
const GRP_VISUAL = '🎨 Visual Settings';
const GRP_GRID = '📏 Grid Levels 0→1';
const GRP_COLORS = '🎨 Colors';
const GRP_DASH = '📊 Dashboard';
const FONT_SIZES: FontSize[] = ['Tiny', 'Small', 'Normal', 'Large', 'Huge'];

export const inputConfig: InputConfig[] = [
  { id: 'swingLen', type: 'int', title: 'Swing Detection Length', defval: 10, min: 3, max: 50, group: GRP_MAIN,
    tooltip: 'Pivot length (bars on each side) for swing structure and CHoCH\ndetection — Trader Assistant Pro engine.\n• Higher = larger structure, fewer CHoCH seeds\n• Lower = faster structure, more seeds' },
  { id: 'accDepth', type: 'int', title: 'Point Confirmation, bars', defval: 5, min: 1, group: GRP_MAIN,
    tooltip: 'Separate (short) pivot period for accepting wave points 1-5/A-C.\nCHoCH structure stays on Swing Detection Length.\nMust be <= Swing Detection Length' },
  { id: 'confMode', type: 'string', title: 'Breaks: Invalidation Mode', defval: 'Close', options: ['Close', 'Wick'], group: GRP_MAIN,
    tooltip: 'How invalidation levels and wave-top breaks are confirmed:\n• Close: confirmed bar close beyond the level (non-repainting,\n  evaluated on bar close only)\n• Wick: any intrabar touch beyond the level (fires immediately;\n  wick touches are irreversible within the bar)' },
  { id: 'r2Min', type: 'float', title: 'Point 2  · min', defval: 0.5, step: 0.001, group: GRP_FIB, inline: 'p2',
    tooltip: 'Fib retracement range (of leg 0→1) where point 2 is expected.\nOutside the range the point is still accepted with a \'~\' soft mark' },
  { id: 'r2Max', type: 'float', title: 'max', defval: 0.705, step: 0.001, group: GRP_FIB, inline: 'p2', tooltip: 'Upper bound of the point 2 expectation range' },
  { id: 'r3Min', type: 'float', title: 'Point 3  · min', defval: -0.5, step: 0.001, group: GRP_FIB, inline: 'p3',
    tooltip: 'Fib extension range (negative = beyond point 1) where point 3\nis expected. Drawn as a yellow target box after point 2 is\naccepted. Outside = \'~\' soft mark' },
  { id: 'r3Max', type: 'float', title: 'max', defval: -0.618, step: 0.001, group: GRP_FIB, inline: 'p3', tooltip: 'Far bound of the point 3 expectation range' },
  { id: 'r4Min', type: 'float', title: 'Point 4  · min (2→3 grid)', defval: 0.5, step: 0.001, group: GRP_FIB, inline: 'p4',
    tooltip: 'Retracement range of leg 2→3 where point 4 is expected.\nOutside = \'~\' soft mark' },
  { id: 'r4Max', type: 'float', title: 'max', defval: 0.705, step: 0.001, group: GRP_FIB, inline: 'p4', tooltip: 'Upper bound of the point 4 expectation range' },
  { id: 'r5Min', type: 'float', title: 'Point 5  · min', defval: -0.618, step: 0.001, group: GRP_FIB, inline: 'p5',
    tooltip: 'Fib extension range (of leg 0→1) where point 5 is expected.\nOutside = \'~\' soft mark' },
  { id: 'r5Max', type: 'float', title: 'max', defval: -1.0, step: 0.001, group: GRP_FIB, inline: 'p5', tooltip: 'Far bound of the point 5 expectation range' },
  { id: 'rBMin', type: 'float', title: 'Point B  · min', defval: -0.5, step: 0.001, group: GRP_FIB, inline: 'pB',
    tooltip: 'Fib extension range (of leg 0→1) where point B is expected.\nOutside = \'~\' soft mark' },
  { id: 'rBMax', type: 'float', title: 'max', defval: -0.618, step: 0.001, group: GRP_FIB, inline: 'pB', tooltip: 'Far bound of the point B expectation range' },
  { id: 'rCMin', type: 'float', title: 'Point C  · min', defval: 0.0, step: 0.001, group: GRP_FIB, inline: 'pC',
    tooltip: 'Fib range (of leg 0→1) where point C is expected.\nOutside = \'~\' soft mark' },
  { id: 'rCMax', type: 'float', title: 'max', defval: 0.236, step: 0.001, group: GRP_FIB, inline: 'pC', tooltip: 'Upper bound of the point C expectation range' },
  { id: 'showGhost', type: 'bool', title: 'Show Projection', defval: true, group: GRP_GHOST,
    tooltip: 'Draw the dashed ghost path (2? 3? 4? 5? A? B? C?) projecting\nthe expected structure from the last accepted point' },
  { id: 'ghAnchor', type: 'string', title: 'Point Inside Range', defval: 'Middle', options: ['Middle', 'Near', 'Far'], group: GRP_GHOST,
    tooltip: 'Where inside its fib range each ghost point is placed:\n• Middle: range midpoint\n• Near: range edge closest to 0\n• Far: range edge furthest from 0' },
  { id: 'ghCoef', type: 'float', title: 'Time Step Coef (× leg 0-1)', defval: 1.0, min: 0.1, step: 0.1, group: GRP_GHOST,
    tooltip: 'Horizontal step between ghost points as a multiple of the\nleg 0→1 duration in bars' },
  { id: 'g5Off', type: 'float', title: '5?: Offset From -1.0', defval: 0.05, min: 0.0, step: 0.01, group: GRP_GHOST,
    tooltip: 'Ghost point 5? is placed at extension -1.0 plus this offset' },
  { id: 'cooldown', type: 'int', title: 'Cooldown After Reset, bars', defval: 0, min: 0, group: GRP_RESET,
    tooltip: 'Minimum bars after a count ends (invalidation OR completion)\nbefore a new CHoCH can seed the next count. 0 = off' },
  { id: 'timeoutK', type: 'float', title: 'Timeout, k × leg 0-1 (0 = off)', defval: 0.0, min: 0.0, step: 0.5, group: GRP_RESET,
    tooltip: 'Reset the hypothesis if the current state lasts longer than\nk × (duration of leg 0→1) bars. In the CHoCH wait-for-1 phase\n(no leg yet) the timeout scales as k × Swing Detection Length.\n0 disables the timeout' },
  { id: 'theme', type: 'string', title: 'Theme', defval: 'Auto', options: ['Auto', 'Dark', 'Light'], group: GRP_VISUAL,
    tooltip: 'Chart color theme.\n• Auto: detects from chart background\n• Dark: optimized for dark backgrounds\n• Light: optimized for light/white backgrounds' },
  { id: 'showGrid', type: 'bool', title: 'Fib Grid 0→1', defval: true, group: GRP_VISUAL, tooltip: 'Draw the dotted fib grid anchored to leg 0→1' },
  { id: 'showBoxes', type: 'bool', title: 'OTE Boxes', defval: true, group: GRP_VISUAL,
    tooltip: 'Draw the yellow target boxes for points 2, 3 and 4\n(each with a center dashed line)' },
  { id: 'showChoch', type: 'bool', title: 'CHoCH', defval: true, group: GRP_VISUAL,
    tooltip: 'Draw persistent CHoCH lines and labels (FIFO history layer;\nsurvives count resets)' },
  { id: 'pathWidth', type: 'int', title: 'Path Width', defval: 2, min: 1, group: GRP_VISUAL, tooltip: 'Line width of the accepted wave path 0-1-2-3-4-5-A-B-C' },
  { id: 'boxExt', type: 'int', title: 'Box Length Forward, bars', defval: 20, min: 1, group: GRP_VISUAL, tooltip: 'Initial forward extension of OTE boxes in bars' },
  { id: 'maxChoch', type: 'int', title: 'Historical CHoCH, max', defval: 50, min: 1, max: 100, group: GRP_VISUAL,
    tooltip: 'Maximum number of persistent CHoCH lines kept on chart\n(oldest removed first)' },
  { id: 'labelFontSize', type: 'string', title: 'Label Font Size', defval: 'Small', options: FONT_SIZES, group: GRP_VISUAL,
    tooltip: 'Font size for wave point labels, ghost labels, CHoCH labels,\nthe reset marker, the invalidation label and fib grid level labels' },
  { id: 'showWatermark', type: 'bool', title: 'Show Watermark', defval: true, group: GRP_VISUAL, tooltip: 'Display \'WillyAlgoTrader\' watermark on chart' },
  { id: 's0236', type: 'bool', title: '0.236', defval: true, group: GRP_GRID, inline: 'r1', tooltip: 'Toggle grid level' },
  { id: 's0382', type: 'bool', title: '0.382', defval: true, group: GRP_GRID, inline: 'r1', tooltip: 'Toggle grid level' },
  { id: 's0500', type: 'bool', title: '0.5', defval: true, group: GRP_GRID, inline: 'r1', tooltip: 'Toggle grid level' },
  { id: 's0618', type: 'bool', title: '0.618', defval: true, group: GRP_GRID, inline: 'r2', tooltip: 'Toggle grid level' },
  { id: 's0705', type: 'bool', title: '0.705', defval: true, group: GRP_GRID, inline: 'r2', tooltip: 'Toggle grid level' },
  { id: 's0786', type: 'bool', title: '0.786', defval: true, group: GRP_GRID, inline: 'r2', tooltip: 'Toggle grid level' },
  { id: 's0886', type: 'bool', title: '0.886', defval: true, group: GRP_GRID, inline: 'r3', tooltip: 'Toggle grid level' },
  { id: 's1000', type: 'bool', title: '1.0', defval: true, group: GRP_GRID, inline: 'r3', tooltip: 'Toggle grid level' },
  { id: 'sm500', type: 'bool', title: '-0.5', defval: true, group: GRP_GRID, inline: 'e1', tooltip: 'Toggle grid level' },
  { id: 'sm618', type: 'bool', title: '-0.618', defval: true, group: GRP_GRID, inline: 'e1', tooltip: 'Toggle grid level' },
  { id: 'sm100', type: 'bool', title: '-1.0', defval: true, group: GRP_GRID, inline: 'e1', tooltip: 'Toggle grid level' },
  { id: 'useCustomColors', type: 'bool', title: 'Use Custom Colors', defval: false, group: GRP_COLORS,
    tooltip: 'OFF (recommended): wave path and point labels use theme-adaptive\ngreens — dark green on light charts, bright green on dark charts;\nshort labels stay red. Label text auto-contrasts in both modes.\nON: use the Points and Lines: Path color pickers below' },
  { id: 'longPtColor', type: 'color', title: 'Points: Long', defval: '#00E676', inline: 'pt', group: GRP_COLORS,
    tooltip: 'Background of wave point labels in LONG counts\n(used when Use Custom Colors is ON).\nDigit color auto-contrasts with the chosen shade' },
  { id: 'shortPtColor', type: 'color', title: 'Short', defval: '#FF5252', inline: 'pt', group: GRP_COLORS,
    tooltip: 'Background of wave point labels in SHORT counts\n(used when Use Custom Colors is ON).\nText color auto-contrasts with the chosen shade' },
  { id: 'oteColor', type: 'color', title: 'Target Boxes', defval: '#FFEB3B', group: GRP_COLORS,
    tooltip: 'Color of the target range boxes for points 2, 3 and 4.\nFill transparency is theme-aware (Dark 65 / Light 55);\nborder and center dashed line render fully opaque' },
  { id: 'pathColor', type: 'color', title: 'Lines: Path', defval: '#2962FF', inline: 'ln', group: GRP_COLORS,
    tooltip: 'Color of the accepted wave path 0-1-2-3-4-5-A-B-C\n(used when Use Custom Colors is ON)' },
  { id: 'ghostColor', type: 'color', title: 'Ghost', defval: '#787B86', inline: 'ln', group: GRP_COLORS,
    tooltip: 'Base color of the ghost projection (dashed lines and labels);\ntransparency applied automatically' },
  { id: 'bullColor', type: 'color', title: 'CHoCH: Bull', defval: '#089981', inline: 'cc', group: GRP_COLORS,
    tooltip: 'Bull color for CHoCH lines and labels.\nDefault #089981 is readable on both dark and light themes' },
  { id: 'bearColor', type: 'color', title: 'Bear', defval: '#FF5252', inline: 'cc', group: GRP_COLORS, tooltip: 'Bear color for CHoCH lines and labels' },
  { id: 'gridRed', type: 'color', title: 'Fib: 0.236', defval: '#FF5252', inline: 'fib1', group: GRP_COLORS, tooltip: 'Grid color for the 0.236 level' },
  { id: 'gridBlue', type: 'color', title: 'Blue lvls', defval: '#5B9CF6', inline: 'fib1', group: GRP_COLORS,
    tooltip: 'Grid color for the 0.382 / 0.618 / 0.886 / -0.618 levels' },
  { id: 'gridBlue2', type: 'color', title: '0.786', defval: '#64B5F6', inline: 'fib1', group: GRP_COLORS, tooltip: 'Grid color for the 0.786 level' },
  { id: 'gridGray', type: 'color', title: 'Fib: Gray lvls', defval: '#9E9E9E', inline: 'fib2', group: GRP_COLORS,
    tooltip: 'Grid color for the 0.5 / 1.0 / -0.5 / -1.0 levels' },
  { id: 'gridTeal', type: 'color', title: '0.705 (OTE)', defval: '#26A69A', inline: 'fib2', group: GRP_COLORS, tooltip: 'Grid color for the 0.705 OTE level' },
  { id: 'showDash', type: 'bool', title: 'Show Dashboard', defval: true, group: GRP_DASH,
    tooltip: 'Show the status table (state, direction, invalidation level,\nlast reset reason, completed impulses)' },
  { id: 'dashPos', type: 'string', title: 'Dashboard Position', defval: 'Top Right',
    options: ['Top Left', 'Top Right', 'Bottom Left', 'Bottom Right', 'Middle Right'], group: GRP_DASH,
    tooltip: 'Corner of the chart where the dashboard is anchored' },
  { id: 'dashFontSize', type: 'string', title: 'Dashboard Font Size', defval: 'Small', options: ['Small', 'Normal', 'Large', 'Huge'], group: GRP_DASH,
    tooltip: 'Font size for the dashboard table. The version footer renders\none step smaller to preserve hierarchy' },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'box', 'table'];

export const metadata = {
  title: 'Elliott Impulse Engine [WillyAlgoTrader]',
  shortTitle: 'EIE',
  overlay: true,
};

/** The original's alertconditions, in declaration order */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: '1. CHoCH + projection', message: 'EIE: CHoCH confirmed, movement projection built' },
  { id: 'alert1', title: '2. Price in W2 OTE', message: 'EIE: price entered the point 2 OTE zone' },
  { id: 'alert2', title: '3. Point 2 accepted', message: 'EIE: point 2 confirmed' },
  { id: 'alert3', title: '4. Break of point 1', message: 'EIE: point 1 broken — W3 active' },
  { id: 'alert4', title: '5. Price in W4 box', message: 'EIE: price entered the point 4 box' },
  { id: 'alert5', title: '6. Break of point 3', message: 'EIE: point 3 broken — W5 active' },
  { id: 'alert6', title: '7. Target -1.0', message: 'EIE: -1.0 target reached' },
  { id: 'alert7', title: '8. Impulse complete', message: 'EIE: point 5 locked, impulse complete' },
  { id: 'alert8', title: '9. Target C', message: 'EIE: point C accepted, correction complete' },
  { id: 'alert9', title: '10. Invalidation', message: 'EIE: hypothesis invalidated' },
];

/** The original makes alert() calls */
export const hasAlertFunction = true;

const INDICATOR_VERSION = 'v0.9.0-dev';

/** State machine */
const S_SCAN = 0;
const S_CHOCH = 1;
const S_W2 = 2;
const S_W3 = 3;
const S_W4 = 4;
const S_W5 = 5;
const S_A = 6;
const S_B = 7;
const S_C = 8;

/** indicator(max_lines_count = 500, max_labels_count = 500, max_boxes_count = 100) */
const MAX_LINES = 500;
const MAX_LABELS = 500;
const MAX_BOXES = 100;

/** Pine float comparisons: a > b only when a - b > 1e-10 (a == b within 1e-10; na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => a - b >= -EPS;
const le = (a: number, b: number) => b - a >= -EPS;
const ne = (a: number, b: number) => Math.abs(a - b) > EPS;
/** Pine math.max / math.min: na when an argument is na */
const max2 = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.max(a, b));
const min2 = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.min(a, b));
/** Pine math.round: half away from zero */
const round = (x: number) => Math.sign(x) * Math.round(Math.abs(x));

const sizeFromString = (s: string): PineSize => (s === 'Tiny' ? 'tiny' : s === 'Small' ? 'small' : s === 'Normal' ? 'normal'
  : s === 'Large' ? 'large' : s === 'Huge' ? 'huge' : 'small');
/** One step smaller: the dashboard version footer */
const sizeDownFromString = (s: string): PineSize => (s === 'Tiny' ? 'tiny' : s === 'Small' ? 'tiny' : s === 'Normal' ? 'small'
  : s === 'Large' ? 'normal' : s === 'Huge' ? 'large' : 'tiny');

const POSITIONS: Record<string, TablePosition> = {
  'Top Left': 'top_left',
  'Top Right': 'top_right',
  'Bottom Left': 'bottom_left',
  'Bottom Right': 'bottom_right',
  'Middle Right': 'middle_right',
};

const STATE_TEXT = ['Scanning', 'CHoCH · wait 1', 'Wave 2', 'Wave 3', 'Wave 4', 'Wave 5', 'Corr · A', 'Corr · B', 'Corr · C'];

export function calculate(
  bars: Bar[],
  inputs: Partial<ElliottImpulseEngineInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { lines: LineDrawingData[]; labels: LabelData[]; boxes: BoxData[]; tables: TableData[] }
  & { alerts: AlertConditionState[]; alertCalls: AlertCall[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const last = n - 1;
  const swingLen = Math.trunc(cfg.swingLen);
  const accDepth = Math.trunc(cfg.accDepth);
  const { r2Min, r2Max, r3Min, r3Max, r4Min, r4Max, r5Min, r5Max, rBMin, rBMax, rCMin, rCMax } = cfg;
  const confClose = cfg.confMode === 'Close';
  const cooldown = Math.trunc(cfg.cooldown);
  const boxExt = Math.trunc(cfg.boxExt);
  const maxChoch = Math.trunc(cfg.maxChoch);

  // Input validation (runtime.error)
  if (accDepth > swingLen) throw new Error('Point Confirmation must be <= Swing Detection Length');
  if (r2Min === r2Max || r3Min === r3Max || r4Min === r4Max || r5Min === r5Max || rBMin === rBMax || rCMin === rCMax) {
    throw new Error('Fib range min and max must differ (zero-width range)');
  }
  if (Math.min(r2Min, r2Max) <= 0 || Math.max(r2Min, r2Max) >= 1) throw new Error('Point 2 range must be inside (0, 1) — retracement of leg 0-1');
  if (Math.min(r4Min, r4Max) <= 0 || Math.max(r4Min, r4Max) >= 1) throw new Error('Point 4 range must be inside (0, 1) — retracement of leg 2-3');
  if (Math.max(r3Min, r3Max) >= 0 || Math.max(r5Min, r5Max) >= 0 || Math.max(rBMin, rBMax) >= 0) {
    throw new Error('Point 3/5/B ranges must be negative (extension levels beyond point 1)');
  }
  if (rCMin < 0 || Math.max(rCMin, rCMax) >= 1) throw new Error('Point C range must be inside [0, 1)');

  const MINTICK = mintickOf(chart);
  const lastConfirmed = lastBarConfirmedOf(chart);

  // Theme detection and colours
  const isDark = cfg.theme === 'Dark' ? true : cfg.theme === 'Light' ? false
    : (color.r(backgroundColorOf(chart)) as number) < 128;
  const C = (c: string, t: number) => String(color.new(c, t));
  const TEXT_COLOR = isDark ? '#E0E0E0' : '#1A1A1A';
  const TEXT_MUTED = isDark ? C('#9E9E9E', 0) : C('#757575', 0);
  const BULL_TEXT = isDark ? '#00E676' : '#00A152';
  const BEAR_TEXT = isDark ? '#FF5252' : '#D32F2F';
  const NEUTRAL_TEXT = isDark ? '#FFEB3B' : '#F57F17';
  const TABLE_BG = isDark ? C('#131722', 5) : C('#FFFFFF', 5);
  const TABLE_BORDER = isDark ? C('#2A2E39', 0) : C('#D0D0D0', 0);
  const HEADER_BG = C('#2962FF', 0);
  const HEADER_TEXT = '#FFFFFF';
  const THEME_GREEN = isDark ? '#00E676' : '#1B5E20';
  const PATH_COLOR = cfg.useCustomColors ? cfg.pathColor : THEME_GREEN;
  const GHOST_COLOR = C(cfg.ghostColor, 30);
  const GHOST_LBL_BG = C(cfg.ghostColor, 70);
  const OTE_FILL = C(cfg.oteColor, isDark ? 65 : 55);
  const OTE_BORDER = C(cfg.oteColor, 0);
  const CRIT_COLOR = isDark ? C('#FF5252', 0) : C('#D32F2F', 0);
  const CRIT_LBL_BG = isDark ? C('#FF5252', 85) : C('#D32F2F', 88);
  const RESET_LBL_BG = isDark ? C('#FF5252', 20) : C('#D32F2F', 20);
  const RESET_LBL_TX = '#FFFFFF';
  const WM_COLOR = isDark ? C('#FFFFFF', 80) : C('#000000', 80);
  const LONG_PT_BG = cfg.useCustomColors ? cfg.longPtColor : THEME_GREEN;
  const SHORT_PT_BG = cfg.useCustomColors ? cfg.shortPtColor : '#FF5252';
  const lum = (c: string) => 0.299 * (color.r(c) as number) + 0.587 * (color.g(c) as number) + 0.114 * (color.b(c) as number);
  const LONG_PT_TX = gt(lum(LONG_PT_BG), 140) ? '#000000' : '#FFFFFF';
  const SHORT_PT_TX = gt(lum(SHORT_PT_BG), 140) ? '#000000' : '#FFFFFF';

  // Fib grid levels
  const LV = [0.236, 0.382, 0.5, 0.618, 0.705, 0.786, 0.886, 1.0, -0.5, -0.618, -1.0];
  const LC = [cfg.gridRed, cfg.gridBlue, cfg.gridGray, cfg.gridBlue, cfg.gridTeal, cfg.gridBlue2, cfg.gridBlue, cfg.gridGray,
    cfg.gridGray, cfg.gridBlue, cfg.gridGray];
  const LS = [cfg.s0236, cfg.s0382, cfg.s0500, cfg.s0618, cfg.s0705, cfg.s0786, cfg.s0886, cfg.s1000, cfg.sm500, cfg.sm618, cfg.sm100];

  const labelSize = sizeFromString(cfg.labelFontSize);
  const dashFontSize = sizeFromString(cfg.dashFontSize);
  const dashFontSizeSub = sizeDownFromString(cfg.dashFontSize);

  const H = bars.map((b) => b.high);
  const L = bars.map((b) => b.low);
  const CL = bars.map((b) => b.close);
  const arr = (s: Series) => s.toArray().map((v) => (v === null || v === undefined ? NaN : v));
  const highS = new Series(bars, (b) => b.high);
  const lowS = new Series(bars, (b) => b.low);
  const swPHraw = arr(ta.pivothigh(highS, swingLen, swingLen));
  const swPLraw = arr(ta.pivotlow(lowS, swingLen, swingLen));
  const phAraw = arr(ta.pivothigh(highS, accDepth, accDepth));
  const plAraw = arr(ta.pivotlow(lowS, accDepth, accDepth));

  const alertFlags: boolean[][] = alertConditions.map(() => new Array(n).fill(false));
  const alertCalls: AlertCall[] = [];
  const tables: TableData[] = [];

  resetDrawings({ line: MAX_LINES, label: MAX_LABELS, box: MAX_BOXES });

  // Var state
  let state = S_SCAN;
  let dir = 0;
  let chochLvl = NaN;
  let p0 = NaN, p1 = NaN, p2 = NaN, p3 = NaN, p4 = NaN, p5 = NaN, pA = NaN, pB = NaN;
  let b0 = NaN, b1 = NaN, b2 = NaN, b3 = NaN, b4 = NaN, b5 = NaN, bA = NaN, bB = NaN;
  let broke1 = false;
  let broke3 = false;
  let ote2 = false;
  let oteB4 = false;
  let hitM1 = false;
  let w2best = NaN;
  let w2bestBar = NaN;
  let lockedChochLvl = NaN;
  let lastResetBar = -100000;
  let stateStartBar = NaN;
  let curSHbar = NaN, runLow = NaN, runLowBar = NaN;
  let curSLbar = NaN, runHigh = NaN, runHighBar = NaN;

  // Active count objects (`var` drawing variables)
  const seg01 = varDrawing<Line>(), seg12 = varDrawing<Line>(), seg23 = varDrawing<Line>(), seg34 = varDrawing<Line>();
  const seg45 = varDrawing<Line>(), seg5A = varDrawing<Line>(), segAB = varDrawing<Line>();
  const lb0 = varDrawing<Label>(), lb1 = varDrawing<Label>(), lb2 = varDrawing<Label>(), lb3 = varDrawing<Label>();
  const lb4 = varDrawing<Label>(), lb5 = varDrawing<Label>(), lbA = varDrawing<Label>(), lbB = varDrawing<Label>();
  const box2 = varDrawing<Box>(), box3 = varDrawing<Box>(), box4 = varDrawing<Box>();
  const ml2 = varDrawing<Line>(), ml3 = varDrawing<Line>(), ml4 = varDrawing<Line>();
  const critLn = varDrawing<Line>();
  const critLb = varDrawing<Label>();
  const allVars = [seg01, seg12, seg23, seg34, seg45, seg5A, segAB, lb0, lb1, lb2, lb3, lb4, lb5, lbA, lbB,
    box2, ml2, box3, ml3, box4, ml4, critLn, critLb] as Array<{ value: object | undefined }>;

  // Graphics collections
  let aLines: Line[] = [];
  let aLabels: Label[] = [];
  let aBoxes: Box[] = [];
  let fLines: Line[] = [];
  let fLabels: Label[] = [];
  let gLines: Line[] = [];
  let gLabels: Label[] = [];
  const chLines: Line[] = [];
  const chLabels: Label[] = [];
  const chLvl: number[] = [];
  const chBias: number[] = [];
  let xLabels: Label[] = [];

  // Swing structure
  let swHighLevel = NaN, swLowLevel = NaN;
  let swHighBar = NaN, swLowBar = NaN;
  let swHighBroken = false, swLowBroken = false;
  let ewTrend = 0;

  let impulseCount = 0;
  let lastResetStr = '—';
  let prevCritLevel = NaN;
  let critLevelLast = NaN;

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === last, last);
    const isLast = i === last;
    const confirmed = !isLast || lastConfirmed;
    const high = H[i];
    const low = L[i];
    const close = CL[i];
    const time = bars[i].time;

    const swPH = confirmed ? swPHraw[i] : NaN;
    const swPL = confirmed ? swPLraw[i] : NaN;
    const swBarP = i - swingLen;
    const phA = confirmed ? phAraw[i] : NaN;
    const plA = confirmed ? plAraw[i] : NaN;
    const pivBA = i - accDepth;

    // Functions that read the state
    const fIn = (x: number, a: number, b: number) => ge(x, Math.min(a, b)) && le(x, Math.max(a, b));
    const fFibP = (Lv: number) => p1 - Lv * (p1 - p0);
    const fLvl = (p: number) => {
      const d = p1 - p0;
      return !isNaN(d) && ne(d, 0) ? (p1 - p) / d : 0.0;
    };
    const fFib23 = (F: number) => p3 - F * (p3 - p2);
    const fLvl23 = (p: number) => {
      const d = p3 - p2;
      return !isNaN(d) && ne(d, 0) ? (p3 - p) / d : 0.0;
    };
    const fSel = (a: number, b: number) => {
      const nr = le(Math.abs(a), Math.abs(b)) ? a : b;
      const fr = le(Math.abs(a), Math.abs(b)) ? b : a;
      return cfg.ghAnchor === 'Middle' ? (a + b) * 0.5 : cfg.ghAnchor === 'Near' ? nr : fr;
    };
    // Retracement extreme over all bars since point 1 (exclusive)
    const fScanBest = (): [number, number] => {
      const span = Math.min(i - b1 - 1, 479);
      let m = dir === 1 ? low : high;
      let mb = i;
      if (span > 0) {
        for (let k = 1; k <= span; k++) {
          const v = dir === 1 ? L[i - k] : H[i - k];
          const better = dir === 1 ? lt(v, m) : gt(v, m);
          if (better) {
            m = v;
            mb = i - k;
          }
        }
      }
      return [m, mb];
    };
    const fAdverse = (level: number) => (dir === 1
      ? (confClose ? confirmed && lt(close, level) : lt(low, level))
      : (confClose ? confirmed && gt(close, level) : gt(high, level)));
    const fBeyond = (level: number) => (dir === 1
      ? (confClose ? confirmed && gt(close, level) : gt(high, level))
      : (confClose ? confirmed && lt(close, level) : lt(low, level)));
    const fClrLn = (a: Line[]) => {
      for (const x of a) line.delete(x);
      return [] as Line[];
    };
    const fClrLb = (a: Label[]) => {
      for (const x of a) label.delete(x);
      return [] as Label[];
    };
    const fWipe = () => {
      aLines = fClrLn(aLines);
      aLabels = fClrLb(aLabels);
      for (const x of aBoxes) box.delete(x);
      aBoxes = [];
      fLines = fClrLn(fLines);
      fLabels = fClrLb(fLabels);
      gLines = fClrLn(gLines);
      gLabels = fClrLb(gLabels);
    };
    const fMkLab = (b: number, p: number, txt: string, top: boolean): Label => {
      const bg = dir === 1 ? LONG_PT_BG : SHORT_PT_BG;
      const tx = dir === 1 ? LONG_PT_TX : SHORT_PT_TX;
      const l = label.new(b, p, txt, 'bar_index', 'price', bg, top ? 'label_down' : 'label_up', tx, labelSize);
      aLabels.push(l);
      return l;
    };
    const fMkSeg = (x1: number, y1: number, x2: number, y2: number): Line => {
      const ln = line.new(x1, y1, x2, y2, 'bar_index', 'none', PATH_COLOR, 'solid', cfg.pathWidth);
      aLines.push(ln);
      return ln;
    };
    // Right edge of the fib grid: end of the ghost projection + 5 bars
    const fGridEnd = () => {
      let e = i + 2;
      if (gLines.length > 0) e = Math.max(e, line.get_x2(gLines[gLines.length - 1]) + 5);
      return e;
    };
    const fBuildGrid = () => {
      fLines = fClrLn(fLines);
      fLabels = fClrLb(fLabels);
      if (cfg.showGrid) {
        const gEnd = fGridEnd();
        for (let k = 0; k < LV.length; k++) {
          if (!LS[k]) continue;
          const Lv = LV[k];
          const y = fFibP(Lv);
          const c = LC[k];
          const ln = line.new(b0, y, gEnd, y, 'bar_index', 'none', c, 'dotted', 1);
          const lb = label.new(gEnd, y, `${str.tostring(Lv, '#.###')} (${str.tostring(y, 'mintick', MINTICK)})`, 'bar_index', 'price',
            C(color.white, 100), 'label_left', c, labelSize);
          fLines.push(ln);
          fLabels.push(lb);
        }
      }
    };
    const fBuildGhost = () => {
      gLines = fClrLn(gLines);
      gLabels = fClrLb(gLabels);
      if (!(cfg.showGhost && state >= S_W2 && state <= S_C && !isNaN(p1))) return;
      const step = Math.max(1, round((b1 - b0) * cfg.ghCoef));
      const g2 = fFibP(fSel(r2Min, r2Max));
      const g3 = fFibP((r3Min + r3Max) * 0.5);
      const ref2 = state >= S_W3 ? p2 : g2;
      const ref3 = state >= S_W4 ? p3 : g3;
      const g4 = ref3 - fSel(r4Min, r4Max) * (ref3 - ref2);
      const g5 = fFibP(-1.0 + cfg.g5Off);
      const gA = state >= S_W5 ? p4 : g4;
      const gB = fFibP(fSel(rBMin, rBMax));
      const gC = fFibP(fSel(rCMin, rCMax));
      let aP = p1;
      let aB = b1;
      if (state === S_W3) { aP = p2; aB = b2; }
      if (state === S_W4) { aP = p3; aB = b3; }
      if (state === S_W5) { aP = p4; aB = b4; }
      if (state === S_A) { aP = p5; aB = b5; }
      if (state === S_B) { aP = pA; aB = bA; }
      if (state === S_C) { aP = pB; aB = bB; }
      const prices: number[] = [];
      const names: string[] = [];
      if (state <= S_W2) { prices.push(g2); names.push('2?'); }
      if (state <= S_W3) { prices.push(g3); names.push('3?'); }
      if (state <= S_W4) { prices.push(g4); names.push('4?'); }
      if (state <= S_W5) { prices.push(g5); names.push('5?'); }
      if (state <= S_A) { prices.push(gA); names.push('A?'); }
      if (state <= S_B) { prices.push(gB); names.push('B?'); }
      prices.push(gC);
      names.push('C?');
      let pPrev = aP;
      let bPrev = aB;
      for (let k = 0; k < prices.length; k++) {
        const pt = prices[k];
        const gb = Math.min(aB + step * (k + 1), i + 450);
        const gl = line.new(bPrev, pPrev, gb, pt, 'bar_index', 'none', GHOST_COLOR, 'dashed', 1);
        const top = ge(pt, pPrev);
        const gl2 = label.new(gb, pt, names[k], 'bar_index', 'price', GHOST_LBL_BG, top ? 'label_down' : 'label_up', TEXT_COLOR, labelSize);
        gLines.push(gl);
        gLabels.push(gl2);
        pPrev = pt;
        bPrev = gb;
      }
    };
    const pushChoch = (fromBar: number, lvl: number, bias: number) => {
      const col = bias === 1 ? cfg.bullColor : cfg.bearColor;
      const cl = line.new(fromBar, lvl, i, lvl, 'bar_index', 'none', col, 'dashed', 1);
      const cb = label.new(round((fromBar + i) / 2), lvl, 'CHoCH', 'bar_index', 'price', 'transparent',
        bias === 1 ? 'label_down' : 'label_up', col, labelSize);
      chLines.push(cl);
      chLabels.push(cb);
      chLvl.push(lvl);
      chBias.push(bias);
      if (chLines.length > maxChoch) {
        line.delete(chLines.shift()!);
        label.delete(chLabels.shift()!);
        chLvl.shift();
        chBias.shift();
      }
    };
    const mkBox = (left: number, e1: number, e2: number) => {
      const bx = box.new(left, max2(e1, e2), left + boxExt, min2(e1, e2), OTE_BORDER, 1, 'solid', 'none', 'bar_index', OTE_FILL);
      aBoxes.push(bx);
      return bx;
    };
    const mkMid = (left: number, y: number) => {
      const ml = line.new(left, y, left + boxExt, y, 'bar_index', 'none', OTE_BORDER, 'dashed', 1);
      aLines.push(ml);
      return ml;
    };

    let aChoch = false, aOte2 = false, aW2 = false, aBrk1 = false, aBox4 = false;
    let aBrk3 = false, aTgt = false, aW5 = false, aCd = false, aInv = false;
    let pendingReset = 0;
    let resetReason = '';
    let seedNow = false;
    let seedDir = 0;
    let seedLvl = NaN, seedP0 = NaN, seedB0 = NaN, seedSwBar = NaN;

    // Per-bar invalidation check before the pivot updates
    if (state !== S_SCAN) {
      if (cfg.timeoutK > 0 && !isNaN(b1) && gt(i - stateStartBar, cfg.timeoutK * (b1 - b0))) {
        pendingReset = 1;
        resetReason = 'TIMEOUT';
      }
      if (cfg.timeoutK > 0 && state === S_CHOCH && gt(i - stateStartBar, cfg.timeoutK * swingLen)) {
        pendingReset = 1;
        resetReason = 'TIMEOUT';
      }
      if (pendingReset === 0) {
        if (state === S_CHOCH) {
          if (fAdverse(p0)) { pendingReset = 1; resetReason = 'FALSE_CHOCH'; }
        } else if (state === S_W2 || (state === S_W3 && !broke1)) {
          if (fAdverse(p0)) { pendingReset = 1; resetReason = 'BELOW_0'; }
        } else if ((state === S_W3 && broke1) || state === S_W4 || (state === S_W5 && !broke3)) {
          if (fAdverse(p2)) { pendingReset = 1; resetReason = 'BELOW_W2'; }
        } else if (state === S_W5 && broke3) {
          if (fAdverse(p4)) { pendingReset = 1; resetReason = 'BELOW_W4'; }
        } else if (state >= S_A) {
          if (fAdverse(p2)) { pendingReset = 1; resetReason = 'DEEP_C'; }
        }
      }
    }

    // Swing structure and CHoCH
    const isWarmed = i >= Math.max(swingLen * 3, 50);
    if (!isNaN(swPH)) {
      swHighLevel = swPH;
      swHighBar = swBarP;
      swHighBroken = false;
    }
    if (!isNaN(swPL)) {
      swLowLevel = swPL;
      swLowBar = swBarP;
      swLowBroken = false;
    }
    // Extreme of the current swing: point 0 of the next count
    if (!isNaN(swHighBar)) {
      if (isNaN(curSHbar) || swHighBar !== curSHbar) {
        curSHbar = swHighBar;
        const off = Math.min(i - swHighBar, 480);
        let m = low;
        let mb = i;
        if (off > 0) {
          for (let k = 0; k <= off; k++) {
            if (lt(L[i - k], m)) {
              m = L[i - k];
              mb = i - k;
            }
          }
        }
        runLow = m;
        runLowBar = mb;
      } else if (lt(low, runLow)) {
        runLow = low;
        runLowBar = i;
      }
    }
    if (!isNaN(swLowBar)) {
      if (isNaN(curSLbar) || swLowBar !== curSLbar) {
        curSLbar = swLowBar;
        const off = Math.min(i - swLowBar, 480);
        let m = high;
        let mb = i;
        if (off > 0) {
          for (let k = 0; k <= off; k++) {
            if (gt(H[i - k], m)) {
              m = H[i - k];
              mb = i - k;
            }
          }
        }
        runHigh = m;
        runHighBar = mb;
      } else if (gt(high, runHigh)) {
        runHigh = high;
        runHighBar = i;
      }
    }
    const bullBreak = !isNaN(swHighLevel) && !swHighBroken && gt(close, swHighLevel) && confirmed && isWarmed;
    const bearBreak = !isNaN(swLowLevel) && !swLowBroken && lt(close, swLowLevel) && confirmed && isWarmed;
    if (bullBreak) {
      swHighBroken = true;
      const wasBear = ewTrend === -1;
      ewTrend = 1;
      const cooled = i >= lastResetBar + cooldown;
      const freeUp = isNaN(lockedChochLvl) || gt(Math.abs(swHighLevel - lockedChochLvl), MINTICK / 2);
      if (wasBear && state === S_SCAN && pendingReset === 0 && cooled && freeUp && !isNaN(runLow)) {
        dir = 1;
        chochLvl = swHighLevel;
        p0 = runLow;
        b0 = runLowBar;
        if (cfg.showChoch) pushChoch(swHighBar, chochLvl, 1);
        xLabels = fClrLb(xLabels);
        w2best = NaN;
        w2bestBar = NaN;
        state = S_CHOCH;
        stateStartBar = i;
        aChoch = true;
      } else if (wasBear && pendingReset === 1 && cooldown === 0 && freeUp && !isNaN(runLow)) {
        seedNow = true;
        seedDir = 1;
        seedLvl = swHighLevel;
        seedP0 = runLow;
        seedB0 = runLowBar;
        seedSwBar = swHighBar;
        aChoch = true;
      }
    }
    if (bearBreak) {
      swLowBroken = true;
      const wasBull = ewTrend === 1;
      ewTrend = -1;
      const cooled = i >= lastResetBar + cooldown;
      const freeDn = isNaN(lockedChochLvl) || gt(Math.abs(swLowLevel - lockedChochLvl), MINTICK / 2);
      if (wasBull && state === S_SCAN && pendingReset === 0 && cooled && freeDn && !isNaN(runHigh)) {
        dir = -1;
        chochLvl = swLowLevel;
        p0 = runHigh;
        b0 = runHighBar;
        if (cfg.showChoch) pushChoch(swLowBar, chochLvl, -1);
        xLabels = fClrLb(xLabels);
        w2best = NaN;
        w2bestBar = NaN;
        state = S_CHOCH;
        stateStartBar = i;
        aChoch = true;
      } else if (wasBull && pendingReset === 1 && cooldown === 0 && freeDn && !isNaN(runHigh)) {
        seedNow = true;
        seedDir = -1;
        seedLvl = swLowLevel;
        seedP0 = runHigh;
        seedB0 = runHighBar;
        seedSwBar = swLowBar;
        aChoch = true;
      }
    }
    // CHoCH mitigation (confirmed close): x2 fixed to the mitigation bar, dotted
    if (confirmed && chLines.length > 0) {
      for (let k = 0; k < chLines.length; k++) {
        const bs = chBias[k];
        if (bs !== 0) {
          const lv = chLvl[k];
          const mit = bs === 1 ? lt(close, lv) : gt(close, lv);
          if (mit) {
            line.set_x2(chLines[k], i);
            line.set_style(chLines[k], 'dotted');
            chBias[k] = 0;
          }
        }
      }
    }

    // State logic on pivots
    const ctrV = dir === 1 ? plA : phA; // counter-trend pivots: 2, 4, A, C
    const wtV = dir === 1 ? phA : plA; // with-trend pivots: 1, 3, 5, B
    let doAcc2 = false;
    let acc2P = NaN;
    let acc2B = NaN;
    let acc2Soft = false;
    let acc2Brk = false;

    if (pendingReset === 0 && state === S_CHOCH) {
      if (!isNaN(ctrV)) {
        const deeper0 = dir === 1 ? lt(ctrV, p0) : gt(ctrV, p0);
        if (deeper0) {
          p0 = ctrV;
          b0 = pivBA;
        }
      }
      if (!isNaN(wtV)) {
        const beyondCh = dir === 1 ? gt(wtV, chochLvl) : lt(wtV, chochLvl);
        if (beyondCh) {
          p1 = wtV;
          b1 = pivBA;
          state = S_W2;
          stateStartBar = i;
          [w2best, w2bestBar] = fScanBest();
          lb0.value = fMkLab(b0, p0, '0', dir === -1);
          lb1.value = fMkLab(b1, p1, '1', dir === 1);
          seg01.value = fMkSeg(b0, p0, b1, p1);
          fBuildGrid();
          if (cfg.showBoxes) {
            box2.value = mkBox(b1, fFibP(r2Min), fFibP(r2Max));
            ml2.value = mkMid(b1, fFibP((r2Min + r2Max) * 0.5));
          }
          fBuildGhost();
        }
      }
    } else if (pendingReset === 0 && state === S_W2) {
      // Reposition 1: a more extreme with-trend pivot
      if (!isNaN(wtV)) {
        const higher1 = dir === 1 ? gt(wtV, p1) : lt(wtV, p1);
        if (higher1) {
          p1 = wtV;
          b1 = pivBA;
          [w2best, w2bestBar] = fScanBest();
          if (seg01.value) line.delete(seg01.value);
          if (lb1.value) label.delete(lb1.value);
          lb1.value = fMkLab(b1, p1, '1', dir === 1);
          seg01.value = fMkSeg(b0, p0, b1, p1);
          fBuildGrid();
          if (cfg.showBoxes) {
            if (box2.value) box.delete(box2.value);
            box2.value = mkBox(b1, fFibP(r2Min), fFibP(r2Max));
            if (ml2.value) line.delete(ml2.value);
            ml2.value = mkMid(b1, fFibP((r2Min + r2Max) * 0.5));
          }
          fBuildGhost();
        }
      }
      if (!isNaN(ctrV)) {
        const L2 = fLvl(ctrV);
        if (ge(L2, 1.0)) {
          pendingReset = 1;
          resetReason = 'BELOW_0';
        } else if (gt(L2, 0.0)) {
          doAcc2 = true;
          acc2P = ctrV;
          acc2B = pivBA;
          acc2Soft = !fIn(L2, r2Min, r2Max);
        }
      }
    } else if (pendingReset === 0 && state === S_W3) {
      // Reposition 2, only until point 1 is broken; after the break a pivot below point 2 = reset
      if (!isNaN(ctrV)) {
        const deeper2 = dir === 1 ? lt(ctrV, p2) : gt(ctrV, p2);
        if (deeper2 && broke1) {
          pendingReset = 1;
          resetReason = 'BELOW_W2';
        } else if (deeper2) {
          const L2 = fLvl(ctrV);
          if (ge(L2, 1.0)) {
            pendingReset = 1;
            resetReason = 'BELOW_0';
          } else {
            p2 = ctrV;
            b2 = pivBA;
            if (seg12.value) line.delete(seg12.value);
            if (lb2.value) label.delete(lb2.value);
            lb2.value = fMkLab(b2, p2, fIn(L2, r2Min, r2Max) ? '2' : '2~', dir === -1);
            seg12.value = fMkSeg(b1, p1, b2, p2);
            if (box2.value) box.set_right(box2.value, b2);
            if (box3.value) box.set_left(box3.value, b2);
            if (ml3.value) line.set_x1(ml3.value, b2);
            fBuildGhost();
          }
        }
      }
      if (pendingReset === 0 && !isNaN(wtV) && broke1) {
        const beyond3 = dir === 1 ? gt(wtV, p1) : lt(wtV, p1);
        if (beyond3) {
          const L3 = fLvl(wtV);
          p3 = wtV;
          b3 = pivBA;
          lb3.value = fMkLab(b3, p3, fIn(L3, r3Min, r3Max) ? '3' : '3~', dir === 1);
          seg23.value = fMkSeg(b2, p2, b3, p3);
          if (box3.value) box.set_right(box3.value, b3);
          if (cfg.showBoxes) {
            box4.value = mkBox(b3, fFib23(r4Min), fFib23(r4Max));
            ml4.value = mkMid(b3, fFib23((r4Min + r4Max) * 0.5));
          }
          state = S_W4;
          stateStartBar = i;
          oteB4 = false;
          fBuildGhost();
        }
      }
    } else if (pendingReset === 0 && state === S_W4) {
      // Reposition 3: a more extreme with-trend pivot
      if (!isNaN(wtV)) {
        const higher3 = dir === 1 ? gt(wtV, p3) : lt(wtV, p3);
        if (higher3) {
          const L3 = fLvl(wtV);
          p3 = wtV;
          b3 = pivBA;
          if (seg23.value) line.delete(seg23.value);
          if (lb3.value) label.delete(lb3.value);
          lb3.value = fMkLab(b3, p3, fIn(L3, r3Min, r3Max) ? '3' : '3~', dir === 1);
          seg23.value = fMkSeg(b2, p2, b3, p3);
          if (box3.value) box.set_right(box3.value, b3);
          if (cfg.showBoxes) {
            if (box4.value) box.delete(box4.value);
            box4.value = mkBox(b3, fFib23(r4Min), fFib23(r4Max));
            if (ml4.value) line.delete(ml4.value);
            ml4.value = mkMid(b3, fFib23((r4Min + r4Max) * 0.5));
          }
          fBuildGhost();
        }
      }
      if (pendingReset === 0 && !isNaN(ctrV)) {
        const below2 = dir === 1 ? lt(ctrV, p2) : gt(ctrV, p2);
        const F4 = fLvl23(ctrV);
        if (below2) {
          pendingReset = 1;
          resetReason = 'BELOW_W2';
        } else if (gt(F4, 0.0)) {
          p4 = ctrV;
          b4 = pivBA;
          lb4.value = fMkLab(b4, p4, fIn(F4, r4Min, r4Max) ? '4' : '4~', dir === -1);
          seg34.value = fMkSeg(b3, p3, b4, p4);
          if (box4.value) box.set_right(box4.value, b4);
          state = S_W5;
          stateStartBar = i;
          hitM1 = false;
          fBuildGhost();
        }
      }
    } else if (pendingReset === 0 && state === S_W5) {
      // Reposition 4: a deeper pullback until point 3 is broken
      if (!isNaN(ctrV) && !broke3) {
        const deeper4 = dir === 1 ? lt(ctrV, p4) : gt(ctrV, p4);
        const below2r = dir === 1 ? lt(ctrV, p2) : gt(ctrV, p2);
        if (deeper4 && below2r) {
          pendingReset = 1;
          resetReason = 'BELOW_W2';
        } else if (deeper4) {
          const F4 = fLvl23(ctrV);
          p4 = ctrV;
          b4 = pivBA;
          if (seg34.value) line.delete(seg34.value);
          if (lb4.value) label.delete(lb4.value);
          lb4.value = fMkLab(b4, p4, fIn(F4, r4Min, r4Max) ? '4' : '4~', dir === -1);
          seg34.value = fMkSeg(b3, p3, b4, p4);
          if (box4.value) box.set_right(box4.value, b4);
          fBuildGhost();
        }
      }
      // After point 3 is broken, a pivot beyond point 4 = reset
      if (pendingReset === 0 && !isNaN(ctrV) && broke3) {
        const beyond4 = dir === 1 ? lt(ctrV, p4) : gt(ctrV, p4);
        if (beyond4) {
          pendingReset = 1;
          resetReason = 'BELOW_W4';
        }
      }
      if (pendingReset === 0 && !isNaN(wtV) && broke3) {
        const beyond5 = dir === 1 ? gt(wtV, p3) : lt(wtV, p3);
        if (beyond5) {
          const L5 = fLvl(wtV);
          const len1 = Math.abs(p1 - p0);
          const len3 = Math.abs(p3 - p2);
          const len5 = Math.abs(wtV - p4);
          if (lt(len3, len1) && lt(len3, len5)) {
            pendingReset = 1;
            resetReason = 'W3_SHORTEST';
          } else {
            p5 = wtV;
            b5 = pivBA;
            lb5.value = fMkLab(b5, p5, fIn(L5, r5Min, r5Max) ? '5' : '5~', dir === 1);
            seg45.value = fMkSeg(b4, p4, b5, p5);
            state = S_A;
            stateStartBar = i;
            aW5 = true;
            fBuildGhost();
          }
        }
      }
    } else if (pendingReset === 0 && state === S_A) {
      // Wave 5 extension
      if (!isNaN(wtV)) {
        const higher5 = dir === 1 ? gt(wtV, p5) : lt(wtV, p5);
        if (higher5) {
          const L5 = fLvl(wtV);
          p5 = wtV;
          b5 = pivBA;
          if (seg45.value) line.delete(seg45.value);
          if (lb5.value) label.delete(lb5.value);
          lb5.value = fMkLab(b5, p5, fIn(L5, r5Min, r5Max) ? '5' : '5~', dir === 1);
          seg45.value = fMkSeg(b4, p4, b5, p5);
          fBuildGhost();
        }
      }
      if (pendingReset === 0 && !isNaN(ctrV)) {
        const deepA = dir === 1 ? lt(ctrV, p2) : gt(ctrV, p2);
        if (deepA) {
          pendingReset = 1;
          resetReason = 'DEEP_C';
        } else {
          pA = ctrV;
          bA = pivBA;
          lbA.value = fMkLab(bA, pA, 'A', dir === -1);
          seg5A.value = fMkSeg(b5, p5, bA, pA);
          state = S_B;
          stateStartBar = i;
          fBuildGhost();
        }
      }
    } else if (pendingReset === 0 && state === S_B) {
      // Reposition A: a deeper low until B appears
      if (!isNaN(ctrV)) {
        const deeperA = dir === 1 ? lt(ctrV, pA) : gt(ctrV, pA);
        const deepHard = dir === 1 ? lt(ctrV, p2) : gt(ctrV, p2);
        if (deeperA && deepHard) {
          pendingReset = 1;
          resetReason = 'DEEP_C';
        } else if (deeperA) {
          pA = ctrV;
          bA = pivBA;
          if (seg5A.value) line.delete(seg5A.value);
          if (lbA.value) label.delete(lbA.value);
          lbA.value = fMkLab(bA, pA, 'A', dir === -1);
          seg5A.value = fMkSeg(b5, p5, bA, pA);
          fBuildGhost();
        }
      }
      if (pendingReset === 0 && !isNaN(wtV)) {
        const above5 = dir === 1 ? ge(wtV, p5) : le(wtV, p5);
        if (above5) {
          pendingReset = 2;
          resetReason = 'B_ABOVE_5';
        } else {
          const LB = fLvl(wtV);
          pB = wtV;
          bB = pivBA;
          lbB.value = fMkLab(bB, pB, fIn(LB, rBMin, rBMax) ? 'B' : 'B~', dir === 1);
          segAB.value = fMkSeg(bA, pA, bB, pB);
          state = S_C;
          stateStartBar = i;
          fBuildGhost();
        }
      }
    } else if (pendingReset === 0 && state === S_C) {
      // Reposition B: a higher high until C appears
      if (!isNaN(wtV)) {
        const above5b = dir === 1 ? ge(wtV, p5) : le(wtV, p5);
        const higherB = dir === 1 ? gt(wtV, pB) : lt(wtV, pB);
        if (above5b) {
          pendingReset = 2;
          resetReason = 'B_ABOVE_5';
        } else if (higherB) {
          const LB = fLvl(wtV);
          pB = wtV;
          bB = pivBA;
          if (segAB.value) line.delete(segAB.value);
          if (lbB.value) label.delete(lbB.value);
          lbB.value = fMkLab(bB, pB, fIn(LB, rBMin, rBMax) ? 'B' : 'B~', dir === 1);
          segAB.value = fMkSeg(bA, pA, bB, pB);
          fBuildGhost();
        }
      }
      if (pendingReset === 0 && !isNaN(ctrV)) {
        const LC_ = fLvl(ctrV);
        const deepC = dir === 1 ? lt(ctrV, p2) : gt(ctrV, p2);
        if (deepC) {
          pendingReset = 1;
          resetReason = 'DEEP_C';
        } else {
          // Point C is terminal (the count ends on this bar): its label and segment are wiped below
          fMkLab(pivBA, ctrV, fIn(LC_, rCMin, rCMax) ? 'C' : 'C~', dir === -1);
          fMkSeg(bB, pB, pivBA, ctrV);
          aCd = true;
          pendingReset = 2;
          resetReason = 'DONE';
        }
      }
    }

    // Per-bar progress: breaks, targets, zone entries
    if (pendingReset === 0 && state === S_W2) {
      const ext2 = dir === 1 ? low : high;
      const trackBest = isNaN(w2best) || (dir === 1 ? lt(ext2, w2best) : gt(ext2, w2best));
      if (trackBest) {
        w2best = ext2;
        w2bestBar = i;
      }
      if (!ote2) {
        const eLvl = fLvl(ext2);
        if (ge(eLvl, Math.min(r2Min, r2Max))) {
          ote2 = true;
          aOte2 = true;
        }
      }
      // Break of point 1 before point 2 is accepted: point 2 = best retracement, always accepted
      if (!doAcc2 && fBeyond(p1)) {
        const Lb2 = fLvl(w2best);
        doAcc2 = true;
        acc2P = w2best;
        acc2B = w2bestBar;
        acc2Soft = !fIn(Lb2, r2Min, r2Max);
        acc2Brk = true;
      }
    }

    // Unified acceptance of point 2
    if (pendingReset === 0 && doAcc2) {
      p2 = acc2P;
      b2 = acc2B;
      lb2.value = fMkLab(b2, p2, acc2Soft ? '2~' : '2', dir === -1);
      seg12.value = fMkSeg(b1, p1, b2, p2);
      if (box2.value) box.set_right(box2.value, b2);
      if (cfg.showBoxes) {
        box3.value = mkBox(b2, fFibP(r3Min), fFibP(r3Max));
        ml3.value = mkMid(b2, fFibP((r3Min + r3Max) * 0.5));
      }
      state = S_W3;
      stateStartBar = i;
      aW2 = true;
      if (acc2Brk) {
        broke1 = true;
        aBrk1 = true;
      }
      fBuildGhost();
    }

    if (pendingReset === 0 && state === S_W3 && !broke1 && fBeyond(p1)) {
      broke1 = true;
      aBrk1 = true;
    }

    if (pendingReset === 0 && state === S_W4 && !oteB4) {
      const extF = fLvl23(dir === 1 ? low : high);
      if (ge(extF, Math.min(r4Min, r4Max))) {
        oteB4 = true;
        aBox4 = true;
      }
    }

    if (pendingReset === 0 && state === S_W5) {
      if (!broke3 && fBeyond(p3)) {
        broke3 = true;
        aBrk3 = true;
      }
      if (!hitM1) {
        const tgt = fFibP(-1.0);
        const hitNow = dir === 1 ? ge(high, tgt) : le(low, tgt);
        if (hitNow) {
          hitM1 = true;
          aTgt = true;
        }
      }
    }

    if (pendingReset === 0 && (state === S_B || state === S_C) && fBeyond(p5)) {
      pendingReset = 2;
      resetReason = 'B_ABOVE_5';
    }

    // Reset / completion
    if (aW5) impulseCount += 1;
    const freq = confClose ? 'once_per_bar_close' : 'once_per_bar';
    if (pendingReset === 1) {
      xLabels.push(label.new(i, close, '✖', 'bar_index', 'price', RESET_LBL_BG, 'label_center', RESET_LBL_TX, labelSize,
        'center', `Hypothesis reset: ${resetReason}`));
      lockedChochLvl = chochLvl;
      aInv = true;
      alertCalls.push({ time, message: `EIE: hypothesis reset — ${resetReason}`, freq });
    }
    if (pendingReset === 2 && resetReason === 'B_ABOVE_5') {
      alertCalls.push({ time, message: 'EIE: correction dismissed (break above point 5), impulse closed as DONE', freq });
    }
    if (pendingReset > 0) {
      lastResetBar = i;
      lastResetStr = resetReason;
      fWipe();
      for (const v of allVars) v.value = undefined;
      p0 = p1 = p2 = p3 = p4 = p5 = pA = pB = NaN;
      b0 = b1 = b2 = b3 = b4 = b5 = bA = bB = NaN;
      chochLvl = NaN;
      broke1 = false;
      broke3 = false;
      ote2 = false;
      oteB4 = false;
      hitM1 = false;
      w2best = NaN;
      w2bestBar = NaN;
      dir = 0;
      state = S_SCAN;
    }

    // Deferred seed: a CHoCH break on the bar of a reset
    if (seedNow) {
      dir = seedDir;
      chochLvl = seedLvl;
      p0 = seedP0;
      b0 = seedB0;
      state = S_CHOCH;
      stateStartBar = i;
      if (cfg.showChoch) pushChoch(seedSwBar, chochLvl, seedDir);
    }

    // Graphics maintenance on the last bar
    if (isLast && chLines.length > 0) {
      for (let k = 0; k < chLines.length; k++) {
        if (chBias[k] !== 0) line.set_x2(chLines[k], i + 20);
      }
    }
    if (isLast && state !== S_SCAN && fLines.length > 0) {
      const gEnd = fGridEnd();
      for (let k = 0; k < fLines.length; k++) {
        line.set_x2(fLines[k], gEnd);
        label.set_x(fLabels[k], gEnd);
      }
    }

    // Trailing invalidation level
    let critLevel = NaN;
    if (state === S_CHOCH || state === S_W2) critLevel = p0;
    else if (state === S_W3) critLevel = broke1 ? p2 : p0;
    else if (state === S_W4) critLevel = p2;
    else if (state === S_W5) critLevel = broke3 ? p4 : p2;
    else if (state >= S_A) critLevel = p2;
    const critChanged = !isNaN(critLevel) && (isNaN(prevCritLevel) || ne(critLevel, prevCritLevel));
    if (!isNaN(critLevel)) {
      const critText = `INVALID ${str.tostring(critLevel, 'mintick', MINTICK)}`;
      if (critLn.value === undefined) {
        critLn.value = line.new(i - 1, critLevel, i + 2, critLevel, 'bar_index', 'none', CRIT_COLOR, 'dashed', 1);
        critLb.value = label.new(i + 2, critLevel, critText, 'bar_index', 'price', CRIT_LBL_BG, 'label_left', CRIT_COLOR, labelSize);
        aLines.push(critLn.value);
        aLabels.push(critLb.value);
      } else if (critChanged || isLast) {
        line.set_y1(critLn.value, critLevel);
        line.set_y2(critLn.value, critLevel);
        line.set_x2(critLn.value, i + 2);
        if (critLb.value) {
          label.set_y(critLb.value, critLevel);
          label.set_x(critLb.value, i + 2);
          label.set_text(critLb.value, critText);
        }
      }
    }
    prevCritLevel = critLevel;
    if (isLast) critLevelLast = critLevel;

    const flags = [aChoch, aOte2, aW2, aBrk1, aBox4, aBrk3, aTgt, aW5, aCd, aInv];
    for (let k = 0; k < flags.length; k++) alertFlags[k][i] = flags[k];
  }
  setDrawingBar(null);

  // Dashboard and watermark (last bar)
  if (n > 0 && cfg.showDash) {
    const stateStr = STATE_TEXT[state] ?? '—';
    const stateCol = state === S_SCAN ? TEXT_MUTED : NEUTRAL_TEXT;
    const dirStr = dir === 1 ? 'Long' : dir === -1 ? 'Short' : '—';
    const dirCol = dir === 1 ? BULL_TEXT : dir === -1 ? BEAR_TEXT : TEXT_MUTED;
    const critStr = isNaN(critLevelLast) ? '—' : str.tostring(critLevelLast, 'mintick', MINTICK);
    const critCol = isNaN(critLevelLast) ? TEXT_MUTED : BEAR_TEXT;
    const cells: TableCellData[] = [];
    const cell = (column: number, row: number, text: string, textColor: string, textSize: PineSize, extra: Partial<TableCellData> = {}) =>
      cells.push({ column, row, text, textColor, textSize, ...extra });
    cell(0, 0, '◆ EIE', HEADER_TEXT, dashFontSize, { bgColor: HEADER_BG, textHAlign: 'center' });
    cell(0, 1, 'State', TEXT_MUTED, dashFontSize, { tooltip: 'Current phase of the impulse count state machine' });
    cell(1, 1, stateStr, stateCol, dashFontSize);
    cell(0, 2, 'Direction', TEXT_MUTED, dashFontSize, { tooltip: 'Direction of the active impulse hypothesis' });
    cell(1, 2, dirStr, dirCol, dashFontSize);
    cell(0, 3, 'Invalidation', TEXT_MUTED, dashFontSize, { tooltip: 'Trailing invalidation level — a break beyond it resets the hypothesis' });
    cell(1, 3, critStr, critCol, dashFontSize);
    cell(0, 4, 'Last Reset', TEXT_MUTED, dashFontSize,
      { tooltip: 'Reason the previous count ended (INVALID reason, DONE or B_ABOVE_5).\nResets on chart reload' });
    cell(1, 4, lastResetStr, TEXT_COLOR, dashFontSize);
    cell(0, 5, 'Impulses', TEXT_MUTED, dashFontSize,
      { tooltip: 'Completed 5-wave impulses (point 5 accepted) on loaded history.\nResets on chart reload' });
    cell(1, 5, str.tostring(impulseCount), TEXT_COLOR, dashFontSize);
    cell(0, 6, 'TF', TEXT_MUTED, dashFontSize, { tooltip: 'Chart timeframe' });
    cell(1, 6, chartTimeframe(bars, chart), TEXT_COLOR, dashFontSize);
    cell(0, 7, 'Version', TEXT_MUTED, dashFontSizeSub);
    cell(1, 7, INDICATOR_VERSION, TEXT_MUTED, dashFontSizeSub);
    tables.push({
      position: POSITIONS[cfg.dashPos] ?? 'top_right', columns: 2, rows: 8, cells,
      merges: [{ startColumn: 0, startRow: 0, endColumn: 1, endRow: 0 }],
      bgColor: TABLE_BG, borderColor: TABLE_BORDER, borderWidth: 1, frameColor: TABLE_BORDER, frameWidth: 1,
    });
  }
  if (n > 0 && cfg.showWatermark) {
    const clear = C(color.black, 100);
    tables.push({
      position: 'bottom_center', columns: 1, rows: 1,
      cells: [{ column: 0, row: 0, text: 'WillyAlgoTrader', textColor: WM_COLOR, textSize: 'normal', textHAlign: 'center', bgColor: clear }],
      bgColor: clear, borderColor: clear, borderWidth: 0, frameColor: clear, frameWidth: 0,
    });
  }

  const interval = barInterval(bars);
  const T = (index: number) => barTime(bars, index, interval);
  const lines: LineDrawingData[] = line.all().filter((l) => !isNaN(l.y1) && !isNaN(l.y2) && !isNaN(l.x1) && !isNaN(l.x2)).map((l) => ({
    time1: T(l.x1), price1: l.y1, time2: T(l.x2), price2: l.y2, color: String(l.color ?? 'transparent'),
    style: l.style ?? 'solid', width: l.width ?? 1,
  }));
  const labels: LabelData[] = label.all().filter((l) => !isNaN(l.x) && !isNaN(l.y)).map((l) => ({
    time: T(l.x), price: l.y, text: l.text ?? '', color: String(l.color ?? 'transparent'), textColor: String(l.textcolor ?? '#FFFFFF'),
    style: l.style as LabelData['style'], size: l.size as PineSize, ...(l.tooltip ? { tooltip: l.tooltip } : {}),
  }));
  const boxes: BoxData[] = box.all().filter((b) => !isNaN(b.left) && !isNaN(b.top) && !isNaN(b.bottom)).map((b) => ({
    time1: T(b.left), price1: b.top, time2: T(b.right), price2: b.bottom, bgColor: String(b.bgcolor ?? 'transparent'),
    borderColor: String(b.border_color ?? 'transparent'), borderWidth: b.border_width ?? 1, textColor: '#FFFFFF',
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    lines,
    labels,
    boxes,
    tables,
    alerts: alertStates(alertConditions, bars, alertFlags),
    alertCalls,
  };
}

export const ElliottImpulseEngine = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  drawingKinds,
  alertConditions,
  hasAlertFunction,
};
