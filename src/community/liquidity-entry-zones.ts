/**
 * Liquidity Entry Zones [trade_w_samet]
 *
 * A liquidity-sweep entry framework. Pivot highs and lows ("Swing Pivot Length" bars on each side) are stored as
 * liquidity levels (the last "Stored Liquidity Levels" of each side). A bar sweeps a level when its high goes above
 * a stored high (its low below a stored low) by at least "Minimum Sweep Distance / ATR" times the ATR; the newest
 * swept level is used. The sweep is valid when the close comes back inside the level ("Strong Reclaim": also beyond
 * the candle midpoint), the wick on the swept side is long enough, the body small enough and the range large enough
 * (in ATR). A valid sweep opens a confirmation window of "Max Bars After Sweep" bars: a candle in the trade
 * direction (optional), on the right side of the EMA (optional) and beyond the midpoint of the sweep candle
 * (optional) confirms the signal, with a cooldown between two signals.
 *
 * Each sweep gets a quality score (wick, body, range, EMA, reclaim and midpoint parts, 0 to 100).
 *
 * Trade simulation (optional): each signal opens a projected trade with an ATR stop ("Stop Loss ATR Multiplier") and
 * a target at the chosen reward / risk; while it runs, new signals are blocked (optional). A target hit draws a
 * "TP ... HIT" label; a stop hit deletes the trade drawings (or draws an "ATR SL HIT" label with "Show Stopped
 * Trades"). When the stop and the target are hit on the same bar, the stop wins.
 *
 * Outputs: sweep circles, signal rings and triangles (markers), green / red signal bars, signal brackets, a body box
 * and a "Q:" score label per signal, dotted "SWEEP TRACE" guides with a lighter reference line, the trade boxes,
 * lines and tags, BUY / SELL labels and a status panel (table) on the last bar. The session row of the panel uses the
 * hour in GMT+3 (Asia 0-8, London 8-16, New York 16-24). At most 500 lines, 500 labels and 500 boxes are kept; the
 * script also keeps its own lists (160 bracket lines, 80 guides, 20 reference lines, 40 guide labels, 50 boxes, 50
 * score labels, 60 projection lines) and deletes the oldest of each.
 *
 * Alerts (alertcondition, `alerts` of the result): "Bullish Liquidity Reclaim" and "Bearish Liquidity Reclaim", true on
 * the bars of each signal.
 *
 * Chart context: the symbol tick (`syminfo.mintick`: minimum sizes of the brackets, entry zone and entry line offset).
 *
 * Reference: "Liquidity Entry Zones [trade_w_samet]" by tradewsamet
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, str, color, Series, line, box, label, table, resetDrawings, setDrawingBar, varDrawing, drawingOutputs,
  type Box, type Label, type Line, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type ShapeConfig,
  type BarColorConfig,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import type { BarColorData, MarkerData } from '../types';
import { mintickOf, type ChartContext } from '../chart-context';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Liquidity Reclaim', message: 'Bullish liquidity reclaim confirmed' },
  { id: 'alert1', title: 'Bearish Liquidity Reclaim', message: 'Bearish liquidity reclaim confirmed' },
];

export interface LiquidityEntryZonesInputs {
  localEmaLength: number;
  useLocalEmaFilter: boolean;
  pivotLength: number;
  storedLevels: number;
  minSweepDistanceAtr: number;
  reclaimRule: 'Close Back Inside' | 'Strong Reclaim';
  minWickPercent: number;
  maxBodyPercent: number;
  minCandleRangeAtr: number;
  requireBullishBody: boolean;
  requireBearishBody: boolean;
  confirmationWindow: number;
  requireMidlineBreak: boolean;
  signalCooldownBars: number;
  enableSimulation: boolean;
  atrLength: number;
  stopLossAtrMultiplier: number;
  takeProfitRRInput: '1.5 RR' | '2 RR' | '3 RR' | '4 RR' | '5 RR' | '6 RR';
  blockSignalsInTrade: boolean;
  showStoppedTrades: boolean;
  showSignalLabels: boolean;
  showEntryLine: boolean;
  showStatusPanel: boolean;
  showSignalBarColors: boolean;
  showSweepGuides: boolean;
  guideExtendBars: number;
  signalLabelSize: 'Tiny' | 'Small' | 'Normal' | 'Large';
  panelPosition: 'Top Right' | 'Top Left' | 'Bottom Right' | 'Bottom Left';
}

export const defaultInputs: LiquidityEntryZonesInputs = {
  localEmaLength: 50,
  useLocalEmaFilter: true,
  pivotLength: 5,
  storedLevels: 20,
  minSweepDistanceAtr: 0.1,
  reclaimRule: 'Close Back Inside',
  minWickPercent: 0.35,
  maxBodyPercent: 0.65,
  minCandleRangeAtr: 0.2,
  requireBullishBody: true,
  requireBearishBody: true,
  confirmationWindow: 2,
  requireMidlineBreak: true,
  signalCooldownBars: 10,
  enableSimulation: true,
  atrLength: 14,
  stopLossAtrMultiplier: 1.5,
  takeProfitRRInput: '3 RR',
  blockSignalsInTrade: true,
  showStoppedTrades: false,
  showSignalLabels: true,
  showEntryLine: true,
  showStatusPanel: true,
  showSignalBarColors: true,
  showSweepGuides: true,
  guideExtendBars: 20,
  signalLabelSize: 'Normal',
  panelPosition: 'Bottom Right',
};

const G_TREND = '📈 Trend Filter';
const G_SWEEP = '💧 Liquidity Sweep Detection';
const G_QUALITY = '🧪 Candle Quality Filters';
const G_CONFIRM = '✅ Entry Confirmation';
const G_SIM = '⚖️ ATR Risk Projection';
const G_VISUAL = '🎨 Visual Settings';

export const inputConfig: InputConfig[] = [
  { id: 'localEmaLength', type: 'int', title: '📏 EMA Length', defval: 50, min: 1, group: G_TREND, display: 'none',
    tooltip: 'Defines the local EMA used for the optional trend filter. Higher values create a smoother directional filter.' },
  { id: 'useLocalEmaFilter', type: 'bool', title: '🧭 Use EMA Trend Filter', defval: true, group: G_TREND, display: 'none',
    tooltip: 'When enabled, long signals require price above the EMA and short signals require price below the EMA.' },
  { id: 'pivotLength', type: 'int', title: '🧱 Swing Pivot Length', defval: 5, min: 1, group: G_SWEEP, display: 'none',
    tooltip: 'Controls how swing highs and swing lows are detected for liquidity reference levels.' },
  { id: 'storedLevels', type: 'int', title: '📚 Stored Liquidity Levels', defval: 20, min: 5, max: 100, group: G_SWEEP,
    display: 'none', tooltip: 'Maximum number of recent liquidity levels stored from swing highs and swing lows.' },
  { id: 'minSweepDistanceAtr', type: 'float', title: '📏 Minimum Sweep Distance / ATR', defval: 0.1, min: 0.01, step: 0.01,
    group: G_SWEEP, display: 'none',
    tooltip: 'Minimum sweep distance measured as an ATR multiplier. Example: 0.10 means the sweep must exceed the level by at least 10% of ATR.' },
  { id: 'reclaimRule', type: 'string', title: '🔁 Reclaim Rule', defval: 'Close Back Inside',
    options: ['Close Back Inside', 'Strong Reclaim'], group: G_SWEEP, display: 'none',
    tooltip: 'Close Back Inside requires price to close back beyond the swept liquidity level. Strong Reclaim also requires a stronger close beyond the candle midpoint.' },
  { id: 'minWickPercent', type: 'float', title: '🕯️ Minimum Sweep Wick %', defval: 0.35, min: 0, max: 1, step: 0.01,
    group: G_QUALITY, display: 'none',
    tooltip: 'Minimum wick percentage required on the sweep candle. Higher values require stronger rejection wicks.' },
  { id: 'maxBodyPercent', type: 'float', title: '📦 Maximum Body %', defval: 0.65, min: 0.05, max: 1, step: 0.01,
    group: G_QUALITY, display: 'none',
    tooltip: 'Maximum allowed candle body percentage. Lower values favor wick-heavy rejection candles.' },
  { id: 'minCandleRangeAtr', type: 'float', title: '📐 Minimum Candle Range / ATR', defval: 0.2, min: 0.01, step: 0.01,
    group: G_QUALITY, display: 'none',
    tooltip: 'Minimum candle range measured as an ATR multiplier. Helps filter out very small sweep candles.' },
  { id: 'requireBullishBody', type: 'bool', title: '🟢 Long Confirmation Must Be Bullish', defval: true, group: G_QUALITY,
    display: 'none', tooltip: 'When enabled, long confirmations require the confirmation candle to close above its open.' },
  { id: 'requireBearishBody', type: 'bool', title: '🔴 Short Confirmation Must Be Bearish', defval: true, group: G_QUALITY,
    display: 'none', tooltip: 'When enabled, short confirmations require the confirmation candle to close below its open.' },
  { id: 'confirmationWindow', type: 'int', title: '⏱️ Max Bars After Sweep For Confirmation', defval: 2, min: 0, max: 10,
    group: G_CONFIRM, display: 'none',
    tooltip: 'Maximum number of bars allowed after a valid sweep for confirmation to appear.' },
  { id: 'requireMidlineBreak', type: 'bool', title: '➗ Require Sweep Candle Midline Break', defval: true, group: G_CONFIRM,
    display: 'none',
    tooltip: 'When enabled, confirmation must break the midpoint of the sweep candle in the signal direction.' },
  { id: 'signalCooldownBars', type: 'int', title: '🧊 Cooldown Bars Between Signals', defval: 10, min: 0, group: G_CONFIRM,
    display: 'none', tooltip: 'Minimum number of bars required between two confirmed signals.' },
  { id: 'enableSimulation', type: 'bool', title: '🧪 Enable Internal Trade Simulation', defval: true, group: G_SIM,
    display: 'none',
    tooltip: 'When enabled, the script projects ATR-based stop loss and RR-based take profit levels after each signal.' },
  { id: 'atrLength', type: 'int', title: '📐 ATR Length', defval: 14, min: 1, group: G_SIM, display: 'none',
    tooltip: 'ATR period used to calculate the stop loss distance.' },
  { id: 'stopLossAtrMultiplier', type: 'float', title: '🛑 Stop Loss ATR Multiplier', defval: 1.5, min: 0.1, step: 0.1,
    group: G_SIM, display: 'none', tooltip: 'Stop Loss distance is calculated as ATR multiplied by this value.' },
  { id: 'takeProfitRRInput', type: 'string', title: '🎯 Take Profit RR', defval: '3 RR',
    options: ['1.5 RR', '2 RR', '3 RR', '4 RR', '5 RR', '6 RR'], group: G_SIM, display: 'none',
    tooltip: 'Take Profit is calculated from the ATR-based stop distance using the selected RR multiple.' },
  { id: 'blockSignalsInTrade', type: 'bool', title: '🚧 Block New Signals While Trade Is Active', defval: true, group: G_SIM,
    display: 'none', tooltip: 'When enabled, new signals are blocked while an internal projected trade is still active.' },
  { id: 'showStoppedTrades', type: 'bool', title: '👁️ Show Stopped Trades', defval: false, group: G_SIM, display: 'none',
    tooltip: 'When disabled, stopped-out trade projection objects are removed from the chart for a cleaner view.' },
  { id: 'showSignalLabels', type: 'bool', title: '🏷️ Show Signal Labels', defval: true, group: G_VISUAL, display: 'none',
    tooltip: 'Shows BUY and SELL labels on confirmed signals.' },
  { id: 'showEntryLine', type: 'bool', title: '⚪ Show Entry Line', defval: true, group: G_VISUAL, display: 'none',
    tooltip: 'Shows the projected entry line after a confirmed signal.' },
  { id: 'showStatusPanel', type: 'bool', title: '📊 Show Status Panel', defval: true, group: G_VISUAL, display: 'none',
    tooltip: 'Shows the live status dashboard. Performance rows such as trades, win rate, net result, and drawdown are not displayed.' },
  { id: 'showSignalBarColors', type: 'bool', title: '🎨 Color Signal Bars', defval: true, group: G_VISUAL, display: 'none',
    tooltip: 'Colors confirmed signal bars green for long and red for short.' },
  { id: 'showSweepGuides', type: 'bool', title: '🧲 Show Sweep Guides', defval: true, group: G_VISUAL, display: 'none',
    tooltip: 'Shows dotted sweep trace guides when valid liquidity sweeps are detected.' },
  { id: 'guideExtendBars', type: 'int', title: '➡️ Guide Extension Bars', defval: 20, min: 5, max: 100, group: G_VISUAL,
    display: 'none', tooltip: 'Controls how far sweep guide lines extend into the future.' },
  { id: 'signalLabelSize', type: 'string', title: '🔠 Signal Label Size', defval: 'Normal',
    options: ['Tiny', 'Small', 'Normal', 'Large'], group: G_VISUAL, display: 'none',
    tooltip: 'Controls the size of BUY, SELL, TP HIT, and SL HIT labels.' },
  { id: 'panelPosition', type: 'string', title: '📍 Panel Position', defval: 'Bottom Right',
    options: ['Top Right', 'Top Left', 'Bottom Right', 'Bottom Left'], group: G_VISUAL, display: 'none',
    tooltip: 'Controls where the status panel appears on the chart.' },
];

export const plotConfig: PlotConfig[] = [];

/** The original's plotshapes (markers carry these ids) */
export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Bull Sweep', style: 'circle', location: 'belowbar', color: '#22D3EE', size: 'tiny' },
  { id: 'shape1', kind: 'shape', title: 'Bear Sweep', style: 'circle', location: 'abovebar', color: '#22D3EE', size: 'tiny' },
  { id: 'shape2', kind: 'shape', title: 'Buy Signal Ring', style: 'circle', location: 'belowbar', color: '#22D3EE',
    size: 'small' },
  { id: 'shape3', kind: 'shape', title: 'Sell Signal Ring', style: 'circle', location: 'abovebar', color: '#22D3EE',
    size: 'small' },
  { id: 'shape4', kind: 'shape', title: 'Buy Signal Marker', style: 'triangleup', location: 'belowbar', color: '#10B981',
    size: 'tiny' },
  { id: 'shape5', kind: 'shape', title: 'Sell Signal Marker', style: 'triangledown', location: 'abovebar',
    color: '#EF4444', size: 'tiny' },
];

/** The original's barcolor() */
export const barColorConfig: BarColorConfig[] = [{ id: 'barcolor0', kind: 'barcolor', title: 'Bar Color' }];

/** Drawing kinds the script uses */
export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'box', 'table'];

export const metadata = {
  title: 'Liquidity Entry Zones [trade_w_samet]',
  shortTitle: 'Liquidity Entry Zones [trade_w_samet]',
  overlay: true,
};

/** indicator(max_labels_count = 500, max_lines_count = 500, max_boxes_count = 500) */
const MAX_OBJECTS = 500;

// Colours of the script
const CLR_BG = '#070A10';
const CLR_PANEL = '#0D121B';
const CLR_PANEL_ALT = '#121924';
const CLR_BORDER = '#2C394C';
const CLR_TEXT = '#F5F7FA';
const CLR_MUTED = '#94A3B8';
const CLR_CYAN = '#22D3EE';
const CLR_CYAN_SOFT = '#0891B2';
const CLR_GREEN = '#10B981';
const CLR_GREEN_SOFT = '#059669';
const CLR_RED = '#EF4444';
const CLR_RED_SOFT = '#DC2626';
const CLR_SILVER = '#CBD5E1';
const CLR_GOLD = '#FACC15';
const CLR_TRACE_BULL = '#4ADE80';
const CLR_TRACE_BEAR = '#F87171';
const BOX_TRANSPARENCY = 86;
/** Text colour of a box without `text_color` in a v6 script (the boxes have no text) */
const BOX_TEXT = '#FFFFFF';
/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => a - b >= -EPS;
const le = (a: number, b: number) => b - a >= -EPS;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const LABEL_SIZE = { Tiny: 'tiny', Small: 'small', Normal: 'normal', Large: 'large' } as const;
const TABLE_POSITION = {
  'Top Left': 'top_left', 'Bottom Right': 'bottom_right', 'Bottom Left': 'bottom_left', 'Top Right': 'top_right',
} as const;
const TP_RR = { '1.5 RR': 1.5, '2 RR': 2, '3 RR': 3, '4 RR': 4, '5 RR': 5, '6 RR': 6 } as const;

/** f_quality_score() */
function qualityScore(wickPct: number, bodyPct: number, rangeAtr: number, minWick: number, maxBody: number,
  minRangeAtr: number, emaOk: boolean, reclaimOk: boolean, midBreakOk: boolean): number {
  const wickScore = gt(minWick, 0) ? clamp((wickPct / minWick) * 32, 0, 32) : 32;
  const bodyScore = gt(maxBody, 0) ? clamp(((maxBody - bodyPct) / maxBody) * 24, 0, 24) : 24;
  const rangeScore = gt(minRangeAtr, 0) ? clamp((rangeAtr / minRangeAtr) * 18, 0, 18) : 18;
  return clamp(wickScore + bodyScore + rangeScore + (emaOk ? 10 : 0) + (reclaimOk ? 10 : 0) + (midBreakOk ? 6 : 0), 0, 100);
}

/** f_push_line_prune / f_push_label_prune / f_push_box_prune */
function pushPrune<T>(arr: T[], obj: T, max: number, del: (o: T) => void): void {
  arr.push(obj);
  if (arr.length > max) del(arr.shift()!);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<LiquidityEntryZonesInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { alerts: AlertConditionState[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const mintick = mintickOf(chart);
  const pivotLength = Math.trunc(cfg.pivotLength);
  const storedLevels = Math.trunc(cfg.storedLevels);
  const confirmationWindow = Math.trunc(cfg.confirmationWindow);
  const cooldown = Math.trunc(cfg.signalCooldownBars);
  const extendBars = Math.trunc(cfg.guideExtendBars);
  const takeProfitRR = TP_RR[cfg.takeProfitRRInput] ?? 6;
  const labelSize = LABEL_SIZE[cfg.signalLabelSize] ?? 'normal';
  const strong = cfg.reclaimRule !== 'Close Back Inside';
  const fmt = (v: number) => str.tostring(v, '#.##');

  const closeS = new Series(bars, (b) => b.close);
  const localEma = ta.ema(closeS, Math.trunc(cfg.localEmaLength)).toArray();
  const atrArr = ta.atr(bars, Math.trunc(cfg.atrLength)).toArray();
  const phArr = ta.pivothigh(new Series(bars, (b) => b.high), pivotLength, pivotLength).toArray();
  const plArr = ta.pivotlow(new Series(bars, (b) => b.low), pivotLength, pivotLength).toArray();

  resetDrawings({ line: MAX_OBJECTS, label: MAX_OBJECTS, box: MAX_OBJECTS });
  const delLine = (l: Line) => line.delete(l);
  const delLabel = (l: Label) => label.delete(l);
  const delBox = (b: Box) => box.delete(b);

  const storedHighLevels: number[] = [];
  const storedHighBars: number[] = [];
  const storedLowLevels: number[] = [];
  const storedLowBars: number[] = [];

  // Sweep traces and visual lists (var arrays)
  const sweepTraceLines: Line[] = [];
  const referenceLines: Line[] = [];
  const sweepTraceLabels: Label[] = [];
  const bracketLines: Line[] = [];
  const scoreLabels: Label[] = [];
  const signalBoxes: Box[] = [];
  const pathLines: Line[] = [];

  // Pending sweeps (var)
  let pendingBullSweepBar = NaN;
  let pendingBullMid = NaN;
  let pendingBullScore = NaN;
  let pendingBearSweepBar = NaN;
  let pendingBearMid = NaN;
  let pendingBearScore = NaN;

  let lastSignalBar = NaN;
  let lastSignalScore = NaN;

  // Trade simulation (var)
  let positionDirection = 0;
  let simulatedEntry = NaN;
  let simulatedTP = NaN;
  let simulatedSL = NaN;
  let simulatedEntryOffset = NaN;
  let simulatedEntryBar = NaN;

  // Trade objects: `var` variables hold them
  const activeTpBox = varDrawing<Box>();
  const activeSlBox = varDrawing<Box>();
  const activeEntryZone = varDrawing<Box>();
  const activeEntryLine1 = varDrawing<Line>();
  const activeEntryLine2 = varDrawing<Line>();
  const activeInvalidationLine = varDrawing<Line>();
  const activeProjectionLine = varDrawing<Line>();
  const activeEntryTag = varDrawing<Label>();
  const activeTpTag = varDrawing<Label>();
  const activeSlTag = varDrawing<Label>();
  const activeInvalidationTag = varDrawing<Label>();
  const tradeObjects = [activeTpBox, activeSlBox, activeEntryZone, activeEntryLine1, activeEntryLine2,
    activeInvalidationLine, activeProjectionLine, activeEntryTag, activeTpTag, activeSlTag, activeInvalidationTag];

  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];
  const longFlags: boolean[] = new Array(n).fill(false);
  const shortFlags: boolean[] = new Array(n).fill(false);

  const traceColorBull = String(color.new(CLR_TRACE_BULL, 0));
  const traceColorBear = String(color.new(CLR_TRACE_BEAR, 0));
  const ghostColorBull = String(color.new(CLR_TRACE_BULL, 82));
  const ghostColorBear = String(color.new(CLR_TRACE_BEAR, 82));
  const cyan = String(color.new(CLR_CYAN, 0));
  const tpBoxBg = String(color.new(CLR_CYAN, BOX_TRANSPARENCY));
  const slBoxBg = String(color.new(CLR_RED, BOX_TRANSPARENCY));
  const red = String(color.new(CLR_RED, 0));
  const green = String(color.new(CLR_GREEN, 0));
  const zoneBorder = String(color.new(CLR_CYAN, 40));
  const zoneBg = String(color.new(CLR_CYAN, 92));
  const entry2Color = String(color.new(CLR_CYAN, 70));

  /** f_add_sweep_trace() */
  const addSweepTrace = (i: number, price: number, bull: boolean) => {
    const traceLine = line.new(i, price, i + extendBars, price, 'bar_index', 'none', bull ? traceColorBull : traceColorBear,
      'dotted', 1);
    const ghostLine = line.new(i, price, i + extendBars * 2, price, 'bar_index', 'none', bull ? ghostColorBull : ghostColorBear,
      'solid', 1);
    const traceLab = label.new(i + extendBars, price, 'SWEEP TRACE', 'bar_index', undefined,
      bull ? CLR_GREEN_SOFT : CLR_RED_SOFT, bull ? 'label_up' : 'label_down', CLR_TEXT, 'tiny');
    pushPrune(sweepTraceLines, traceLine, 80, delLine);
    pushPrune(referenceLines, ghostLine, 20, delLine);
    pushPrune(sweepTraceLabels, traceLab, 40, delLabel);
  };

  /** f_draw_signal_brackets() */
  const drawBrackets = (i: number, hi: number, lo: number, buffer: number, col: string) => {
    const leftX = i - 1;
    const rightX = i + 1;
    const topY = hi + buffer;
    const botY = lo - buffer;
    const topIn = hi + buffer * 0.35;
    const botIn = lo - buffer * 0.35;
    const mk = (x1: number, y1: number, x2: number, y2: number) => line.new(x1, y1, x2, y2, 'bar_index', undefined, col,
      undefined, 1);
    const ls = [
      mk(leftX, topY, i, topY), mk(leftX, topY, leftX, topIn), mk(leftX, botY, i, botY), mk(leftX, botY, leftX, botIn),
      mk(i, topY, rightX, topY), mk(rightX, topY, rightX, topIn), mk(i, botY, rightX, botY), mk(rightX, botY, rightX, botIn),
    ];
    for (const l of ls) pushPrune(bracketLines, l, 160, delLine);
  };

  // var table panel = table.new(...): made on the first bar
  const panel = n > 0
    ? table.new(TABLE_POSITION[cfg.panelPosition] ?? 'top_right', 2, 10, undefined, undefined, undefined, CLR_BORDER, 1)
    : null;

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const ema = localEma[i] ?? NaN;
    const atr = atrArr[i] ?? NaN;

    const candleRange = b.high - b.low;
    const candleBody = Math.abs(b.close - b.open);
    const upperWick = b.high - Math.max(b.open, b.close);
    const lowerWick = Math.min(b.open, b.close) - b.low;
    const bodyPercent = gt(candleRange, 0) ? candleBody / candleRange : 0;
    const upperWickPercent = gt(candleRange, 0) ? upperWick / candleRange : 0;
    const lowerWickPercent = gt(candleRange, 0) ? lowerWick / candleRange : 0;

    const candleRangeAtr = !isNaN(atr) && gt(atr, 0) ? candleRange / atr : 0;
    const minSweepDistancePx = !isNaN(atr) ? cfg.minSweepDistanceAtr * atr : NaN;
    const minRangeDistancePx = !isNaN(atr) ? cfg.minCandleRangeAtr * atr : NaN;
    const stopLossDistance = !isNaN(atr) ? atr * cfg.stopLossAtrMultiplier : NaN;
    const takeProfitDistance = !isNaN(stopLossDistance) ? stopLossDistance * takeProfitRR : NaN;
    const riskModelReady = !isNaN(stopLossDistance) && gt(stopLossDistance, 0) && !isNaN(takeProfitDistance)
      && gt(takeProfitDistance, 0);
    const visualBuffer = Math.max(mintick * 8, candleRange * 0.08);
    const atrOrRange = isNaN(atr) ? candleRange : atr;
    const entryZoneHalf = Math.max(mintick * 6, atrOrRange * 0.04);
    const entryLineOffset = Math.max(mintick * 2, atrOrRange * 0.02);

    // Pivots and liquidity storage
    const ph = phArr[i] ?? NaN;
    const pl = plArr[i] ?? NaN;
    if (!isNaN(ph)) {
      storedHighLevels.push(ph);
      storedHighBars.push(i - pivotLength);
      if (storedHighLevels.length > storedLevels) {
        storedHighLevels.shift();
        storedHighBars.shift();
      }
    }
    if (!isNaN(pl)) {
      storedLowLevels.push(pl);
      storedLowBars.push(i - pivotLength);
      if (storedLowLevels.length > storedLevels) {
        storedLowLevels.shift();
        storedLowBars.shift();
      }
    }

    // Most recent swept level
    let sweptHighLevel = NaN;
    for (let k = storedHighLevels.length - 1; k >= 0; k--) {
      const level = storedHighLevels[k];
      if (storedHighBars[k] < i && gt(b.high, level) && !isNaN(minSweepDistancePx) && ge(b.high - level, minSweepDistancePx)) {
        sweptHighLevel = level;
        break;
      }
    }
    let sweptLowLevel = NaN;
    for (let k = storedLowLevels.length - 1; k >= 0; k--) {
      const level = storedLowLevels[k];
      if (storedLowBars[k] < i && lt(b.low, level) && !isNaN(minSweepDistancePx) && ge(level - b.low, minSweepDistancePx)) {
        sweptLowLevel = level;
        break;
      }
    }

    // Sweep validation
    const mid = (b.high + b.low) / 2;
    const bearishReclaim = !isNaN(sweptHighLevel)
      && (strong ? lt(b.close, sweptHighLevel) && lt(b.close, mid) : lt(b.close, sweptHighLevel));
    const bullishReclaim = !isNaN(sweptLowLevel)
      && (strong ? gt(b.close, sweptLowLevel) && gt(b.close, mid) : gt(b.close, sweptLowLevel));
    const validSellSweep = !isNaN(sweptHighLevel) && bearishReclaim && ge(upperWickPercent, cfg.minWickPercent)
      && le(bodyPercent, cfg.maxBodyPercent) && !isNaN(minRangeDistancePx) && ge(candleRange, minRangeDistancePx);
    const validBuySweep = !isNaN(sweptLowLevel) && bullishReclaim && ge(lowerWickPercent, cfg.minWickPercent)
      && le(bodyPercent, cfg.maxBodyPercent) && !isNaN(minRangeDistancePx) && ge(candleRange, minRangeDistancePx);

    // Sweep traces
    if (cfg.showSweepGuides && validBuySweep) addSweepTrace(i, sweptLowLevel, true);
    if (cfg.showSweepGuides && validSellSweep) addSweepTrace(i, sweptHighLevel, false);

    // Pending sweep events
    const bullEmaOk = !cfg.useLocalEmaFilter || gt(b.close, ema);
    const bearEmaOk = !cfg.useLocalEmaFilter || lt(b.close, ema);
    const bullMidOkNow = !cfg.requireMidlineBreak || gt(b.close, mid);
    const bearMidOkNow = !cfg.requireMidlineBreak || lt(b.close, mid);
    const bullSweepScoreNow = qualityScore(lowerWickPercent, bodyPercent, candleRangeAtr, cfg.minWickPercent,
      cfg.maxBodyPercent, cfg.minCandleRangeAtr, bullEmaOk, bullishReclaim, bullMidOkNow);
    const bearSweepScoreNow = qualityScore(upperWickPercent, bodyPercent, candleRangeAtr, cfg.minWickPercent,
      cfg.maxBodyPercent, cfg.minCandleRangeAtr, bearEmaOk, bearishReclaim, bearMidOkNow);

    if (validBuySweep) {
      pendingBullSweepBar = i;
      pendingBullMid = mid;
      pendingBullScore = bullSweepScoreNow;
    }
    if (validSellSweep) {
      pendingBearSweepBar = i;
      pendingBearMid = mid;
      pendingBearScore = bearSweepScoreNow;
    }
    const bullWindowOpen = !isNaN(pendingBullSweepBar) && i - pendingBullSweepBar <= confirmationWindow;
    const bearWindowOpen = !isNaN(pendingBearSweepBar) && i - pendingBearSweepBar <= confirmationWindow;

    // Confirmation
    const bullBodyOk = !cfg.requireBullishBody || gt(b.close, b.open);
    const bearBodyOk = !cfg.requireBearishBody || lt(b.close, b.open);
    const bullMidOk = !cfg.requireMidlineBreak || gt(b.close, pendingBullMid);
    const bearMidOk = !cfg.requireMidlineBreak || lt(b.close, pendingBearMid);
    const buyConfirmed = bullWindowOpen && bullBodyOk && bullEmaOk && bullMidOk;
    const sellConfirmed = bearWindowOpen && bearBodyOk && bearEmaOk && bearMidOk;

    // Cooldown
    const cooldownPassed = isNaN(lastSignalBar) || i - lastSignalBar > cooldown;
    const buySignal = buyConfirmed && cooldownPassed;
    const sellSignal = sellConfirmed && cooldownPassed && !buySignal;
    if (buySignal) lastSignalScore = isNaN(pendingBullScore) ? bullSweepScoreNow : pendingBullScore;
    if (sellSignal) lastSignalScore = isNaN(pendingBearScore) ? bearSweepScoreNow : pendingBearScore;
    if (buySignal || sellSignal) lastSignalBar = i;
    if (buySignal || (!isNaN(pendingBullSweepBar) && i - pendingBullSweepBar > confirmationWindow)) {
      pendingBullSweepBar = NaN;
      pendingBullMid = NaN;
      pendingBullScore = NaN;
    }
    if (sellSignal || (!isNaN(pendingBearSweepBar) && i - pendingBearSweepBar > confirmationWindow)) {
      pendingBearSweepBar = NaN;
      pendingBearMid = NaN;
      pendingBearScore = NaN;
    }

    // Trade simulation
    const tradeIsActive = positionDirection !== 0;
    const allowSignal = cfg.enableSimulation ? riskModelReady && (cfg.blockSignalsInTrade ? !tradeIsActive : true) : true;
    const plotLongSignal = buySignal && allowSignal;
    const plotShortSignal = sellSignal && allowSignal;

    // Signal visuals
    const scoreText = 'Q:' + str.tostring(Math.round(isNaN(lastSignalScore) ? 0 : lastSignalScore));
    if (plotLongSignal) {
      drawBrackets(i, b.high, b.low, visualBuffer, CLR_CYAN);
      const bodyBox = box.new(i, Math.max(b.open, b.close), i + 1, Math.min(b.open, b.close), cyan, 1, undefined, undefined,
        'bar_index', String(color.new(CLR_GREEN, 82)), undefined, undefined, BOX_TEXT);
      pushPrune(signalBoxes, bodyBox, 50, delBox);
      const scoreTag = label.new(i, b.low - visualBuffer * 1.2, scoreText, 'bar_index', undefined, CLR_CYAN_SOFT,
        'label_up', CLR_TEXT, 'tiny');
      pushPrune(scoreLabels, scoreTag, 50, delLabel);
    }
    if (plotShortSignal) {
      drawBrackets(i, b.high, b.low, visualBuffer, CLR_CYAN);
      const bodyBox = box.new(i, Math.max(b.open, b.close), i + 1, Math.min(b.open, b.close), cyan, 1, undefined, undefined,
        'bar_index', String(color.new(CLR_RED, 82)), undefined, undefined, BOX_TEXT);
      pushPrune(signalBoxes, bodyBox, 50, delBox);
      const scoreTag = label.new(i, b.high + visualBuffer * 1.2, scoreText, 'bar_index', undefined, CLR_CYAN_SOFT,
        'label_down', CLR_TEXT, 'tiny');
      pushPrune(scoreLabels, scoreTag, 50, delLabel);
    }

    // Trade creation
    const createTrade = (dir: 1 | -1) => {
      positionDirection = dir;
      simulatedEntry = b.close;
      simulatedSL = dir === 1 ? simulatedEntry - stopLossDistance : simulatedEntry + stopLossDistance;
      simulatedTP = dir === 1 ? simulatedEntry + takeProfitDistance : simulatedEntry - takeProfitDistance;
      simulatedEntryOffset = entryLineOffset;
      simulatedEntryBar = i;
      const e = simulatedEntry;
      activeTpBox.value = dir === 1
        ? box.new(i, simulatedTP, i, e, cyan, 1, undefined, undefined, 'bar_index', tpBoxBg, undefined, undefined, BOX_TEXT)
        : box.new(i, e, i, simulatedTP, cyan, 1, undefined, undefined, 'bar_index', tpBoxBg, undefined, undefined, BOX_TEXT);
      activeSlBox.value = dir === 1
        ? box.new(i, e, i, simulatedSL, red, 1, undefined, undefined, 'bar_index', slBoxBg, undefined, undefined, BOX_TEXT)
        : box.new(i, simulatedSL, i, e, red, 1, undefined, undefined, 'bar_index', slBoxBg, undefined, undefined, BOX_TEXT);
      activeEntryZone.value = box.new(i, e + entryZoneHalf, i, e - entryZoneHalf, zoneBorder, 1, undefined, undefined,
        'bar_index', zoneBg, undefined, undefined, BOX_TEXT);
      if (cfg.showEntryLine) {
        const y2 = dir === 1 ? e + simulatedEntryOffset : e - simulatedEntryOffset;
        activeEntryLine1.value = line.new(i, e, i, e, 'bar_index', 'none', cyan, 'solid', 1);
        activeEntryLine2.value = line.new(i, y2, i, y2, 'bar_index', 'none', entry2Color, 'dotted', 1);
      }
      activeInvalidationLine.value = line.new(i, simulatedSL, i, simulatedSL, 'bar_index', 'none', red, 'dashed', 1);
      const projY = dir === 1 ? e + (simulatedTP - e) * 0.22 : e - (e - simulatedTP) * 0.22;
      activeProjectionLine.value = line.new(i, e, i + 6, projY, 'bar_index', 'none',
        String(color.new(dir === 1 ? CLR_GREEN : CLR_RED, 15)), 'dotted', 1);
      pushPrune(pathLines, activeProjectionLine.value, 60, delLine);
      activeEntryTag.value = label.new(i, e, 'ENTRY', 'bar_index', undefined, CLR_CYAN_SOFT, 'label_left', CLR_TEXT, 'tiny');
      activeTpTag.value = label.new(i, simulatedTP, 'TARGET ' + fmt(takeProfitRR) + 'R', 'bar_index', undefined,
        CLR_GREEN_SOFT, 'label_left', CLR_TEXT, 'tiny');
      activeSlTag.value = label.new(i, simulatedSL, 'ATR STOP', 'bar_index', undefined, CLR_RED_SOFT, 'label_left',
        CLR_TEXT, 'tiny');
      activeInvalidationTag.value = label.new(i, simulatedSL, 'INVALIDATION', 'bar_index', undefined, CLR_RED_SOFT,
        'label_left', CLR_TEXT, 'tiny');
    };
    if (cfg.enableSimulation && plotLongSignal) createTrade(1);
    if (cfg.enableSimulation && plotShortSignal) createTrade(-1);

    // Active trade visual update
    if (cfg.enableSimulation && tradeIsActive) {
      if (activeTpBox.value) box.set_right(activeTpBox.value, i);
      if (activeSlBox.value) box.set_right(activeSlBox.value, i);
      if (activeEntryZone.value) box.set_right(activeEntryZone.value, i);
      if (activeEntryLine1.value) {
        line.set_x2(activeEntryLine1.value, i);
        line.set_y2(activeEntryLine1.value, simulatedEntry);
      }
      if (activeEntryLine2.value) {
        const off = isNaN(simulatedEntryOffset) ? entryLineOffset : simulatedEntryOffset;
        line.set_x2(activeEntryLine2.value, i);
        line.set_y2(activeEntryLine2.value, positionDirection === 1 ? simulatedEntry + off : simulatedEntry - off);
      }
      if (activeInvalidationLine.value) {
        line.set_x2(activeInvalidationLine.value, i);
        line.set_y2(activeInvalidationLine.value, simulatedSL);
      }
      const moveTag = (l: Label | undefined, y: number) => {
        if (!l) return;
        label.set_x(l, i);
        label.set_y(l, y);
      };
      moveTag(activeEntryTag.value, simulatedEntry);
      moveTag(activeTpTag.value, simulatedTP);
      moveTag(activeSlTag.value, simulatedSL);
      moveTag(activeInvalidationTag.value, simulatedSL);
    }

    // Exit logic
    let exitWin = false;
    let exitLoss = false;
    const exitDirection = positionDirection;
    if (cfg.enableSimulation && tradeIsActive && i > simulatedEntryBar) {
      if (positionDirection === 1) {
        const slHit = le(b.low, simulatedSL);
        const tpHit = ge(b.high, simulatedTP);
        if (slHit) exitLoss = true;
        else if (tpHit) exitWin = true;
      }
      if (positionDirection === -1) {
        const slHit = ge(b.high, simulatedSL);
        const tpHit = le(b.low, simulatedTP);
        if (slHit) exitLoss = true;
        else if (tpHit) exitWin = true;
      }
    }
    const resetTrade = () => {
      positionDirection = 0;
      simulatedEntry = NaN;
      simulatedTP = NaN;
      simulatedSL = NaN;
      simulatedEntryOffset = NaN;
      simulatedEntryBar = NaN;
      for (const v of tradeObjects) v.value = undefined;
    };
    if (exitWin) {
      label.new(i, exitDirection === 1 ? b.high : b.low, 'TP ' + fmt(takeProfitRR) + 'R HIT', 'bar_index', undefined,
        CLR_GREEN, exitDirection === 1 ? 'label_down' : 'label_up', CLR_TEXT, labelSize);
      resetTrade();
    }
    if (exitLoss) {
      if (cfg.showStoppedTrades) {
        label.new(i, exitDirection === 1 ? b.low : b.high, 'ATR SL HIT', 'bar_index', undefined, CLR_RED,
          exitDirection === 1 ? 'label_up' : 'label_down', CLR_TEXT, labelSize);
      } else {
        if (activeTpBox.value) box.delete(activeTpBox.value);
        if (activeSlBox.value) box.delete(activeSlBox.value);
        if (activeEntryZone.value) box.delete(activeEntryZone.value);
        if (activeEntryLine1.value) line.delete(activeEntryLine1.value);
        if (activeEntryLine2.value) line.delete(activeEntryLine2.value);
        if (activeInvalidationLine.value) line.delete(activeInvalidationLine.value);
        if (activeProjectionLine.value) line.delete(activeProjectionLine.value);
        if (activeEntryTag.value) label.delete(activeEntryTag.value);
        if (activeTpTag.value) label.delete(activeTpTag.value);
        if (activeSlTag.value) label.delete(activeSlTag.value);
        if (activeInvalidationTag.value) label.delete(activeInvalidationTag.value);
      }
      resetTrade();
    }

    // Markers (plotshape)
    const t = b.time;
    if (validBuySweep) markers.push({ id: 'shape0', time: t, position: 'belowBar', shape: 'circle', color: cyan, size: 'tiny' });
    if (validSellSweep) markers.push({ id: 'shape1', time: t, position: 'aboveBar', shape: 'circle', color: cyan, size: 'tiny' });
    if (plotLongSignal) markers.push({ id: 'shape2', time: t, position: 'belowBar', shape: 'circle', color: cyan, size: 'small' });
    if (plotShortSignal) markers.push({ id: 'shape3', time: t, position: 'aboveBar', shape: 'circle', color: cyan, size: 'small' });
    if (plotLongSignal) {
      markers.push({ id: 'shape4', time: t, position: 'belowBar', shape: 'triangleUp', color: green, size: 'tiny' });
    }
    if (plotShortSignal) {
      markers.push({ id: 'shape5', time: t, position: 'aboveBar', shape: 'triangleDown', color: red, size: 'tiny' });
    }

    if (cfg.showSignalLabels && plotLongSignal) {
      label.new(i, b.low, 'BUY', 'bar_index', undefined, CLR_GREEN_SOFT, 'label_up', CLR_TEXT, labelSize);
    }
    if (cfg.showSignalLabels && plotShortSignal) {
      label.new(i, b.high, 'SELL', 'bar_index', undefined, CLR_RED_SOFT, 'label_down', CLR_TEXT, labelSize);
    }

    if (cfg.showSignalBarColors && (plotLongSignal || plotShortSignal)) {
      barColors.push({ id: 'barcolor0', time: t, color: plotLongSignal ? green : red });
    }
    longFlags[i] = plotLongSignal;
    shortFlags[i] = plotShortSignal;

    // Status panel on the last bar
    if (i === n - 1 && panel) {
      if (cfg.showStatusPanel) {
        const atrPct = !isNaN(atr) && b.close !== 0 ? (atr / b.close) * 100 : 0;
        const volatilityState = ge(atrPct, 0.8) ? 'HIGH' : ge(atrPct, 0.35) ? 'NORMAL' : 'LOW';
        const volatilityColor = ge(atrPct, 0.8) ? CLR_RED : ge(atrPct, 0.35) ? CLR_CYAN : CLR_GREEN;
        const ms = b.time > 1e11 ? b.time : b.time * 1000;
        const gmt3Hour = new Date(ms + 3 * 3600000).getUTCHours();
        const sessionState = gmt3Hour < 8 ? 'ASIA' : gmt3Hour < 16 ? 'LONDON' : 'NEW YORK';
        const sessionColor = sessionState === 'LONDON' ? CLR_CYAN : sessionState === 'NEW YORK' ? CLR_GOLD : CLR_SILVER;
        const riskModelText = 'SL ' + fmt(cfg.stopLossAtrMultiplier) + ' ATR / TP ' + fmt(takeProfitRR) + 'R';
        const biasText = cfg.useLocalEmaFilter
          ? gt(b.close, ema) ? 'BULLISH' : lt(b.close, ema) ? 'BEARISH' : 'NEUTRAL'
          : 'FILTER OFF';
        const biasColor = cfg.useLocalEmaFilter
          ? gt(b.close, ema) ? CLR_GREEN : lt(b.close, ema) ? CLR_RED : CLR_SILVER
          : CLR_MUTED;
        const sweepStateText = validBuySweep ? 'BULL SWEEP DETECTED' : validSellSweep ? 'BEAR SWEEP DETECTED'
          : bullWindowOpen ? 'BULL SWEEP PENDING' : bearWindowOpen ? 'BEAR SWEEP PENDING' : 'IDLE';
        const sweepStateColor = validBuySweep ? CLR_GREEN : validSellSweep ? CLR_RED
          : bullWindowOpen || bearWindowOpen ? CLR_CYAN : CLR_MUTED;
        const signalStateText = plotLongSignal ? 'BUY CONFIRMED' : plotShortSignal ? 'SELL CONFIRMED'
          : tradeIsActive ? 'TRADE ACTIVE' : 'WAITING';
        const signalStateColor = plotLongSignal ? CLR_GREEN : plotShortSignal ? CLR_RED
          : tradeIsActive ? CLR_CYAN : CLR_MUTED;
        // pendingBullScore / pendingBearScore are read after the reset of this bar
        const nz0 = (v: number) => (isNaN(v) ? 0 : v);
        const panelScore = bullWindowOpen ? nz0(pendingBullScore) : bearWindowOpen ? nz0(pendingBearScore)
          : nz0(lastSignalScore);
        const panelScoreColor = ge(panelScore, 75) ? CLR_GREEN : ge(panelScore, 55) ? CLR_CYAN : CLR_RED;
        const riskStateText = !riskModelReady ? 'WARMING UP' : ge(atrPct, 0.8) ? 'DEFENSIVE'
          : ge(atrPct, 0.35) ? 'CONTROLLED' : 'LOW VOL';
        const riskStateColor = !riskModelReady ? CLR_MUTED : ge(atrPct, 0.8) ? CLR_RED
          : ge(atrPct, 0.35) ? CLR_CYAN : CLR_GREEN;
        const cell = (col: number, row: number, text: string, bg: string, fg: string) =>
          table.cell(panel, col, row, text, undefined, undefined, fg, undefined, undefined, 'auto', bg);
        cell(0, 0, 'LIQUIDITY ENTRY', CLR_PANEL_ALT, CLR_TEXT);
        cell(1, 0, 'STATUS PANEL', CLR_PANEL_ALT, CLR_GOLD);
        cell(0, 1, 'Simulation', CLR_PANEL, CLR_MUTED);
        cell(1, 1, cfg.enableSimulation ? 'ON' : 'OFF', CLR_PANEL, CLR_CYAN);
        cell(0, 2, 'Risk Model', CLR_BG, CLR_TEXT);
        cell(1, 2, riskModelText, CLR_BG, CLR_GOLD);
        cell(0, 3, 'Bias', CLR_BG, CLR_TEXT);
        cell(1, 3, biasText, CLR_BG, biasColor);
        cell(0, 4, 'Sweep State', CLR_BG, CLR_TEXT);
        cell(1, 4, sweepStateText, CLR_BG, sweepStateColor);
        cell(0, 5, 'Signal State', CLR_BG, CLR_TEXT);
        cell(1, 5, signalStateText, CLR_BG, signalStateColor);
        cell(0, 6, 'Quality Score', CLR_BG, CLR_TEXT);
        cell(1, 6, fmt(panelScore), CLR_BG, panelScoreColor);
        cell(0, 7, 'Volatility', CLR_BG, CLR_TEXT);
        cell(1, 7, volatilityState, CLR_BG, volatilityColor);
        cell(0, 8, 'Session', CLR_BG, CLR_TEXT);
        cell(1, 8, sessionState, CLR_BG, sessionColor);
        cell(0, 9, 'Risk State', CLR_BG, CLR_TEXT);
        cell(1, 9, riskStateText, CLR_BG, riskStateColor);
      } else {
        // f_panel_clear()
        for (let col = 0; col <= 1; col++) {
          for (let row = 0; row <= 9; row++) {
            table.cell(panel, col, row, '', undefined, undefined, CLR_BG, undefined, undefined, 'auto', CLR_BG);
          }
        }
      }
    }
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    barColors,
    ...drawingOutputs(bars),
    // alertcondition(plotLongSignal, ...) / alertcondition(plotShortSignal, ...)
    alerts: alertStates(alertConditions, bars, [longFlags, shortFlags]),
  };
}

export const LiquidityEntryZones = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
  shapeConfig,
  barColorConfig,
  drawingKinds,
};
