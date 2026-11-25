/**
 * Liquidity Pools Pro [WillyAlgoTrader]
 *
 * Liquidity pools at pivot highs and lows, with sweep signals, a trade model and a dashboard.
 * - Pivots: pivot highs and lows with a left length that follows the volatility (10 / (ATR 14 / ATR 50), between 4
 *   and 16 bars; or the manual length) and a fixed number of confirmation bars on the right.
 * - Pools: a pivot within the tolerance (a share of the ATR) of an active pool of the same side is a new touch of
 *   that pool (the level becomes the mean of the touches); else it opens a new pool. Each closed bar whose high or
 *   low is inside the zone of an active pool adds its volume to the pool.
 * - Strength (0 to 100): touches (9 points per extra touch, at most 35), recency (35 points halved every
 *   "half-life" bars since the last touch), volume of the pool against the median of all pools (at most 20) and 20
 *   points when a pivot of the higher timeframe is close to the level.
 * - Sweep: a closed bar whose wick goes beyond the zone of an active pool. With a close back over the level the
 *   pool is "mitigated", else "swept". A mitigation (or any sweep when "Require Body Reversal" is off) of a pool
 *   that is strong enough gives a Long (pool of lows) or Short (pool of highs) signal.
 * - Trade model: one position at a time, opened at the close of the signal bar. Stop at a multiple of the ATR (or
 *   behind the wick of the signal bar), three targets in multiples of the stop distance, stop moved to the entry
 *   after the first target, exit on the stop or on the third target.
 * - Outputs: for each pool a zone box, a dotted level line and a label (side, touches, strength, volume), drawn on
 *   the last bar; a "Long" / "Short" label on each signal; the entry / stop / target lines and labels of the open
 *   trade; the dashboard and the watermark (tables of the last bar). At most 500 lines, boxes and labels are kept.
 *
 * Chart context (optional third argument):
 * - `chart.mintick`: the symbol tick of the price texts. Without it 0.01.
 * - `chart.tickerid`: the symbol name of the dashboard. Without it an empty text.
 * - `chart.timeframe`: the chart timeframe (dashboard text, higher-timeframe check). Without it, it is taken from
 *   the bars.
 * - `chart.backgroundColor`: theme "Auto" is dark when the red channel of the chart background is below 128.
 *   Without it the dark theme.
 * - `chart.lastBarConfirmed`: when the last bar is still open, it adds no volume to the pools and gives no sweep,
 *   no signal and no pool removal. Without it every bar is taken as closed.
 * - `chart.timezone` and `chart.session`: the exchange calendar of the bars of the higher timeframe. Without them
 *   the UTC calendar and the bars (see anchor-period.ts).
 *
 * Limits of the port:
 * - The pivots with the adaptive length: the library function with a left length per bar.
 * - A "Higher Timeframe" below the chart timeframe (the default "240" on a daily chart) needs data that the chart
 *   bars do not have: the port throws an Error when "Enable HTF Confluence" is on.
 *
 * Alerts (alert() calls, `alertCalls` of the result, once per bar close, on confirmed bars), as the original: with
 * "Alert on Position Close" the stop / break-even stop and TP3 exits, with "Alert on TP1/TP2 & BE Updates" the TP1 /
 * TP2 hits and the break-even move, and the entries ("SWEEP BUY" / "SWEEP SELL", text or webhook JSON). They read
 * `chart.tickerid` and the chart timeframe.
 *
 * Reference: "Liquidity Pools Pro [WillyAlgoTrader]" by WillyAlgoTrader
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, math, str, color, array, timeframe, Series, barInterval, barTime, line, label, box, resample,
  resetDrawings, setDrawingBar, varDrawing,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type Line, type Label, type Box,
  type DrawingVariable,
} from 'oakscriptjs';
import type {
  AlertCall, BoxData, LabelData, LabelStyle, LineDrawingData, PineSize, TableCellData, TableData, TablePosition,
} from '../types';
import { periodStarts, chartTimeframe, securityBars } from '../anchor-period';
import { backgroundColorOf, lastBarConfirmedOf, mintickOf, tickerOf, tickeridOf, type ChartContext } from '../chart-context';

type FontSize = 'Tiny' | 'Small' | 'Normal' | 'Large' | 'Huge';

/** The original makes alert() calls */
export const hasAlertFunction = true;

export interface LiquidityPoolsProInputs {
  adaptivePivot: boolean;
  manualPivotLen: number;
  rightConfirm: number;
  atrTolerance: number;
  maxLookback: number;
  maxActivePools: number;
  minStrengthShow: number;
  halfLifeBars: number;
  useVolumeWeight: boolean;
  enableSweepSignals: boolean;
  minStrengthSignal: number;
  requireBodyReversal: boolean;
  useHtfConfluence: boolean;
  htfTimeframe: string;
  riskPreset: 'Conservative' | 'Balanced' | 'Aggressive' | 'Scalping' | 'Custom';
  atrLenRisk: number;
  slMult: number;
  tp1Mult: number;
  tp2Mult: number;
  tp3Mult: number;
  slMode: 'ATR' | 'Sweep Wick';
  wickBuffer: number;
  showSlTp: boolean;
  showSlTpLabels: boolean;
  useBreakEven: boolean;
  showPctOnLabels: boolean;
  acctSize: number;
  riskPerTrade: number;
  theme: 'Auto' | 'Dark' | 'Light';
  showZones: boolean;
  showStrengthBar: boolean;
  showLabels: boolean;
  showVolume: boolean;
  showSwept: boolean;
  showSignals: boolean;
  showWatermark: boolean;
  labelFontSize: FontSize;
  signalFontSize: FontSize;
  showDash: boolean;
  dashPos: 'Top Left' | 'Top Right' | 'Bottom Left' | 'Bottom Right' | 'Middle Right';
  /** Alert settings: the alerts give no output */
  webhook: boolean;
  alertClose: boolean;
  alertUpdate: boolean;
  bullColor: string;
  bearColor: string;
}

export const defaultInputs: LiquidityPoolsProInputs = {
  adaptivePivot: true,
  manualPivotLen: 8,
  rightConfirm: 2,
  atrTolerance: 0.25,
  maxLookback: 200,
  maxActivePools: 40,
  minStrengthShow: 0,
  halfLifeBars: 150,
  useVolumeWeight: true,
  enableSweepSignals: true,
  minStrengthSignal: 25,
  requireBodyReversal: true,
  useHtfConfluence: false,
  htfTimeframe: '240',
  riskPreset: 'Balanced',
  atrLenRisk: 14,
  slMult: 1.5,
  tp1Mult: 1.0,
  tp2Mult: 2.0,
  tp3Mult: 3.0,
  slMode: 'ATR',
  wickBuffer: 0.25,
  showSlTp: true,
  showSlTpLabels: true,
  useBreakEven: true,
  showPctOnLabels: true,
  acctSize: 10000,
  riskPerTrade: 1.0,
  theme: 'Auto',
  showZones: true,
  showStrengthBar: true,
  showLabels: true,
  showVolume: true,
  showSwept: true,
  showSignals: true,
  showWatermark: true,
  labelFontSize: 'Small',
  signalFontSize: 'Small',
  showDash: true,
  dashPos: 'Top Right',
  webhook: false,
  alertClose: true,
  alertUpdate: false,
  bullColor: '#00E676',
  bearColor: '#FF5252',
};

const GRP_DETECT = '🎯 Liquidity Detection';
const GRP_SCORE = '💪 Strength Scoring';
const GRP_SIGNAL = '📡 Sweep Signals';
const GRP_HTF = '🔭 HTF Confluence';
const GRP_RISK = '🛡️ Risk Management';
const GRP_VISUAL = '🎨 Visual';
const GRP_DASH = '📊 Dashboard';
const GRP_ALERT = '🔔 Alerts';
const GRP_COLORS = '🎨 Colors';
const FONT_SIZES = ['Tiny', 'Small', 'Normal', 'Large', 'Huge'];

export const inputConfig: InputConfig[] = [
  { id: 'adaptivePivot', type: 'bool', title: 'Adaptive Pivot Length', defval: true, group: GRP_DETECT, tooltip: 'When ON: pivot length adapts to volatility (ATR-driven).\n• High volatility → longer pivots (less noise)\n• Low volatility → shorter pivots (more responsive)\nWhen OFF: uses Manual Pivot Length below.' },
  { id: 'manualPivotLen', type: 'int', title: 'Manual Pivot Length', defval: 8, min: 2, max: 50, group: GRP_DETECT, tooltip: 'Used when Adaptive Pivot is OFF. Bars on each side of a pivot.\n• 5–8: scalping/intraday\n• 10–15: swing\n• 20+: position trading' },
  { id: 'rightConfirm', type: 'int', title: 'Right Confirmation Bars', defval: 2, min: 1, max: 10, group: GRP_DETECT, tooltip: 'Bars to the right needed to confirm a pivot.\nLower = faster signals but more revisions.\nHigher = more reliable but lagging.' },
  { id: 'atrTolerance', type: 'float', title: 'Equality Tolerance (×ATR)', defval: 0.25, min: 0.05, max: 2.0, step: 0.05, group: GRP_DETECT, tooltip: "Two pivots are 'equal' if their distance ≤ this × ATR.\n• 0.15: strict (tighter pools, fewer matches)\n• 0.25: balanced (recommended)\n• 0.50: loose (wider pools, more matches)\nWorks across instruments (BTC, EURUSD, indices) without re-tuning." },
  { id: 'maxLookback', type: 'int', title: 'Max Pivot Lookback (bars)', defval: 200, min: 50, max: 1000, group: GRP_DETECT, tooltip: 'Max bars to look back when matching a new pivot to historical pivots.\nHigher = catch older pools, slower compute.' },
  { id: 'maxActivePools', type: 'int', title: 'Max Active Pools', defval: 40, min: 5, max: 100, group: GRP_DETECT, tooltip: 'Maximum number of active (un-swept) liquidity pools tracked simultaneously.\nWeakest pools are pruned when exceeded.' },

  { id: 'minStrengthShow', type: 'int', title: 'Min Strength to Display', defval: 0, min: 0, max: 100, group: GRP_SCORE, tooltip: "Pools with strength below this value are hidden.\n• 0: show all pools (recommended for visualization)\n• 30: filter out weak\n• 50+: only strong pools\nDoes NOT affect signal generation — see 'Min Pool Strength for Signal'." },
  { id: 'halfLifeBars', type: 'int', title: 'Strength Half-Life (bars)', defval: 150, min: 20, max: 1000, group: GRP_SCORE, tooltip: "Number of bars after which a pool's age-strength halves.\nFresh pools score higher; old pools decay.\n• 50: aggressive decay\n• 150: balanced\n• 500: slow decay" },
  { id: 'useVolumeWeight', type: 'bool', title: 'Volume-Weighted Strength', defval: true, group: GRP_SCORE, tooltip: 'Add cumulative volume at level to strength score.\nDisable on instruments without reliable volume (some Forex).' },

  { id: 'enableSweepSignals', type: 'bool', title: 'Enable Sweep Signals (BUY/SELL)', defval: true, group: GRP_SIGNAL, tooltip: 'Generate BUY/SELL signals on liquidity sweep + reversal close.\nLogic: wick pierces level, then bar closes back inside (failed breakout).' },
  { id: 'minStrengthSignal', type: 'int', title: 'Min Pool Strength for Signal', defval: 25, min: 0, max: 100, group: GRP_SIGNAL, tooltip: 'Only generate sweep signals from pools with strength above this value.\nReference values:\n• Fresh 1-touch pool: ~35 strength\n• Fresh 2-touch pool: ~44\n• Fresh 3-touch pool: ~53\n• 25 (default): catches fresh single-touch pools\n• 40: requires 2+ touches\n• 60: only strong multi-touch + volume/HTF' },
  { id: 'requireBodyReversal', type: 'bool', title: 'Require Body Reversal', defval: true, group: GRP_SIGNAL, tooltip: 'ON: Bar close must be back inside (real reversal, recommended).\nOFF: Any wick sweep counts (more signals, more noise).' },

  { id: 'useHtfConfluence', type: 'bool', title: 'Enable HTF Confluence', defval: false, group: GRP_HTF, tooltip: 'Boost strength of pools that align with higher-timeframe pivots.\nDisable for pure single-TF analysis.' },
  { id: 'htfTimeframe', type: 'timeframe', title: 'Higher Timeframe', defval: '240', group: GRP_HTF, tooltip: 'Higher timeframe to check for pivot confluence (e.g., 240 = 4H, D = Daily).' },

  { id: 'riskPreset', type: 'string', title: 'Risk Preset', defval: 'Balanced', options: ['Conservative', 'Balanced', 'Aggressive', 'Scalping', 'Custom'], group: GRP_RISK, tooltip: 'Quick risk presets:\n• Conservative: SL 2.5×ATR, TP 1R/2R/4R\n• Balanced: SL 1.5×ATR, TP 1R/2R/3R\n• Aggressive: SL 1.0×ATR, TP 1.5R/2.5R/4R\n• Scalping: SL 0.8×ATR, TP 0.8R/1.5R/2R\n• Custom: use manual multipliers below' },
  { id: 'atrLenRisk', type: 'int', title: 'ATR Length (Risk)', defval: 14, min: 5, max: 50, group: GRP_RISK, tooltip: 'ATR period for stop-loss calculation.' },
  { id: 'slMult', type: 'float', title: 'Custom SL ×ATR', defval: 1.5, min: 0.5, max: 5.0, step: 0.1, group: GRP_RISK, tooltip: 'Used when preset = Custom. SL distance as multiple of ATR.' },
  { id: 'tp1Mult', type: 'float', title: 'Custom TP1 ×Risk', defval: 1.0, min: 0.5, max: 5.0, step: 0.1, group: GRP_RISK },
  { id: 'tp2Mult', type: 'float', title: 'Custom TP2 ×Risk', defval: 2.0, min: 1.0, max: 10.0, step: 0.1, group: GRP_RISK },
  { id: 'tp3Mult', type: 'float', title: 'Custom TP3 ×Risk', defval: 3.0, min: 1.5, max: 15.0, step: 0.1, group: GRP_RISK },
  { id: 'slMode', type: 'string', title: 'SL Placement', defval: 'ATR', options: ['ATR', 'Sweep Wick'], group: GRP_RISK, tooltip: 'Where the stop-loss goes:\n• ATR: fixed distance = SL ×ATR from entry (classic).\n• Sweep Wick: behind the wick of the sweep bar + buffer.\nSweep Wick ties invalidation to structure: if price violates the\nswept extreme again, the failed-breakout idea is broken.\nTP1/TP2/TP3 remain R-multiples of the ACTUAL SL distance in both modes.' },
  { id: 'wickBuffer', type: 'float', title: 'Wick Buffer (×ATR)', defval: 0.25, min: 0.0, max: 2.0, step: 0.05, group: GRP_RISK, tooltip: 'Extra distance beyond the sweep-bar wick when SL Placement = Sweep Wick.\nProtects from stop-runs that pierce the wick by a hair.\nIf the resulting SL distance is below 0.1×ATR (hair-thin wick, zero\nbuffer), the ATR distance is used instead.' },
  { id: 'showSlTp', type: 'bool', title: 'Show SL/TP Lines', defval: true, group: GRP_RISK },
  { id: 'showSlTpLabels', type: 'bool', title: 'Show SL/TP Labels', defval: true, group: GRP_RISK },
  { id: 'useBreakEven', type: 'bool', title: 'Break-Even After TP1', defval: true, group: GRP_RISK, tooltip: 'When TP1 is hit, move stop-loss to entry price (break-even).\nThe trailed SL replaces the original — trade closes at break-even\ninstead of original SL if price reverses.\nLets winners run to TP2/TP3 risk-free.' },
  { id: 'showPctOnLabels', type: 'bool', title: 'Show % Distance on Labels', defval: true, group: GRP_RISK, tooltip: "Append % distance from entry to SL/TP labels (e.g. 'SL 1.2300 (-0.36%)').\nHelps quick assessment of risk/reward without mental math." },
  { id: 'acctSize', type: 'float', title: 'Account Size ($)', defval: 10000, min: 0, group: GRP_RISK, tooltip: 'Used only for the dashboard Pos Size row and the qty field in\nwebhook entry alerts. Does NOT affect signal logic.' },
  { id: 'riskPerTrade', type: 'float', title: 'Risk per Trade (%)', defval: 1.0, min: 0.05, max: 100, step: 0.25, group: GRP_RISK, tooltip: 'Percent of Account Size risked per trade.\nPosition size = (Account × Risk%) / distance from entry to SL.' },

  { id: 'theme', type: 'string', title: 'Theme', defval: 'Auto', options: ['Auto', 'Dark', 'Light'], group: GRP_VISUAL, tooltip: 'Chart color theme.\n• Auto: detect from chart background\n• Dark: optimized for dark backgrounds\n• Light: optimized for light backgrounds' },
  { id: 'showZones', type: 'bool', title: 'Show Liquidity Zones', defval: true, group: GRP_VISUAL },
  { id: 'showStrengthBar', type: 'bool', title: 'Show Strength Bar', defval: true, group: GRP_VISUAL, tooltip: 'Show colored intensity bar inside each zone reflecting strength score.' },
  { id: 'showLabels', type: 'bool', title: 'Show Pool Labels', defval: true, group: GRP_VISUAL },
  { id: 'showVolume', type: 'bool', title: 'Show Volume in Labels', defval: true, group: GRP_VISUAL },
  { id: 'showSwept', type: 'bool', title: 'Keep Swept Zones', defval: true, group: GRP_VISUAL, tooltip: 'ON: dimmed swept zones remain on chart.\nOFF: zones are deleted on sweep.' },
  { id: 'showSignals', type: 'bool', title: 'Show Buy/Sell Markers', defval: true, group: GRP_VISUAL },
  { id: 'showWatermark', type: 'bool', title: 'Show Watermark', defval: true, group: GRP_VISUAL },
  { id: 'labelFontSize', type: 'string', title: 'SL/TP Label Font Size', defval: 'Small', options: FONT_SIZES, group: GRP_VISUAL, tooltip: 'Font size for SL/TP/Entry labels (price + percent values).\nDefault: Small. Use Tiny for compact look on busy charts.' },
  { id: 'signalFontSize', type: 'string', title: 'Signal Marker Size (Long/Short)', defval: 'Small', options: FONT_SIZES, group: GRP_VISUAL, tooltip: 'Font size for Long/Short signal markers below/above bars.\nDefault: Small. Use Normal/Large for better visibility on dense charts.' },

  { id: 'showDash', type: 'bool', title: 'Show Dashboard', defval: true, group: GRP_DASH },
  { id: 'dashPos', type: 'string', title: 'Position', defval: 'Top Right', options: ['Top Left', 'Top Right', 'Bottom Left', 'Bottom Right', 'Middle Right'], group: GRP_DASH },

  { id: 'webhook', type: 'bool', title: 'Webhook JSON Format', defval: false, group: GRP_ALERT, tooltip: 'Format alert messages as JSON for webhook integrations (autotrading bots).' },
  { id: 'alertClose', type: 'bool', title: 'Alert on Position Close', defval: true, group: GRP_ALERT, tooltip: 'Send an alert on every position-closing event:\nSL hit, break-even stop-out, or TP3 hit.\nKeep ON for bots — otherwise a position opened by an entry alert\ncan close (e.g. by TP3) without any notification.' },
  { id: 'alertUpdate', type: 'bool', title: 'Alert on TP1/TP2 & BE Updates', defval: false, group: GRP_ALERT, tooltip: 'Send informational alerts while a trade is running:\nTP1/TP2 hits and break-even activation.\nDisabled by default (can be noisy).' },

  { id: 'bullColor', type: 'color', title: 'Bullish (Demand) Color', defval: '#00E676', group: GRP_COLORS },
  { id: 'bearColor', type: 'color', title: 'Bearish (Supply) Color', defval: '#FF5252', group: GRP_COLORS },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Liquidity Pools Pro [WillyAlgoTrader]',
  shortTitle: 'LP Pro',
  overlay: true,
};

const INDICATOR_VERSION = 'v1.2.0';
const STATE_ACTIVE = 0;
const STATE_SWEPT = 1;
const STATE_MITIGATED = 2;
/** max_lines_count, max_labels_count and max_boxes_count of the script */
const MAX_OBJECTS = 500;
/** SL / TP lines: first projection in bars, extension while the trade is open, label offset */
const LINE_LOOKAHEAD = 30;
const LINE_EXTEND = 5;
const LABEL_OFFSET = 31;
/** Pivots of the higher timeframe: ta.pivothigh(3, 3) */
const HTF_PIVOT_LEN = 3;

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(a - b > EPS);
const ne = (a: number, b: number) => Math.abs(a - b) > EPS;

const safeDiv = (num: number, den: number, fallback = 0.0) =>
  (ne(den, 0) && !Number.isNaN(num) && !Number.isNaN(den) ? num / den : fallback);

const sizeFromString = (s: string): PineSize =>
  (s === 'Tiny' ? 'tiny' : s === 'Small' ? 'small' : s === 'Normal' ? 'normal' : s === 'Large' ? 'large' : s === 'Huge' ? 'huge' : 'small');

const cornerOf = (s: string): TablePosition => {
  switch (s) {
    case 'Top Left': return 'top_left';
    case 'Bottom Left': return 'bottom_left';
    case 'Bottom Right': return 'bottom_right';
    case 'Middle Right': return 'middle_right';
    default: return 'top_right';
  }
};

function formatVolume(v: number): string {
  if (Number.isNaN(v)) return '—';
  if (ge(v, 1e9)) return str.format('{0,number,#.##}B', v / 1e9);
  if (ge(v, 1e6)) return str.format('{0,number,#.##}M', v / 1e6);
  if (ge(v, 1e3)) return str.format('{0,number,#.#}K', v / 1e3);
  return str.tostring(v, '#');
}

/** Strength 0..100 to a transparency 88..55 */
const strengthToTransparency = (strength: number) => Math.trunc(88.0 - Math.max(0.0, Math.min(100.0, strength)) * 0.33);

type DrawStyle = 'solid' | 'dashed' | 'dotted';

interface Pool {
  level: number;
  levelTop: number;
  levelBot: number;
  lastTouchIdx: number;
  firstBarTime: number;
  touchCount: number;
  cumulativeVol: number;
  isHigh: boolean;
  state: number;
  sweptAtIdx: number;
  sweptAtTime: number;
  htfBonus: number;
  zoneBox: Box;
  poolLabel: Label;
  midLine: Line;
}

/**
 * request.security(syminfo.tickerid, tf, ta.pivothigh(3, 3)[1] / ta.pivotlow(3, 3)[1], gaps_off, lookahead_on): for
 * each chart bar the pivot value of the bar of timeframe `tf` before the one that contains the chart bar.
 */
function htfPivots(bars: Bar[], tf: string, context?: ChartContext): { high: number[]; low: number[] } {
  const chart = chartTimeframe(bars, context);
  let htf: Bar[] = bars;
  let group: number[] = bars.map((_b, i) => i);
  if (!(tf.trim() === '' || chart === '' || timeframe.in_seconds(tf) === timeframe.in_seconds(chart))) {
    if (timeframe.in_seconds(tf) < timeframe.in_seconds(chart)) {
      throw new Error(`The higher timeframe "${tf}" is lower than the chart timeframe "${chart}": the chart bars do not have that data (switch "Enable HTF Confluence" off or choose a higher timeframe)`);
    }
    // With the exchange calendar of the chart context the periods come from the library rule (see anchor-period.ts);
    // else the bars of the UTC calendar periods, grouped by the library
    const exchange = securityBars(bars, tf, context);
    if (exchange) {
      htf = exchange.htf;
      group = exchange.group;
    } else {
      const grouped = resample(bars, periodStarts(bars, tf));
      htf = grouped.bars;
      group = grouped.group;
    }
  }
  const ph = ta.pivothigh(new Series(htf, (b) => b.high), HTF_PIVOT_LEN, HTF_PIVOT_LEN).toArray().map((v) => v ?? NaN);
  const pl = ta.pivotlow(new Series(htf, (b) => b.low), HTF_PIVOT_LEN, HTF_PIVOT_LEN).toArray().map((v) => v ?? NaN);
  return {
    high: group.map((g) => (g >= 1 ? ph[g - 1] : NaN)),
    low: group.map((g) => (g >= 1 ? pl[g - 1] : NaN)),
  };
}

export function calculate(
  bars: Bar[],
  inputs: Partial<LiquidityPoolsProInputs> = {},
  chart?: ChartContext,
): IndicatorResult & {
  boxes: BoxData[]; lines: LineDrawingData[]; labels: LabelData[]; tables: TableData[]; alertCalls: AlertCall[];
} {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const base = {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
  };
  if (n === 0) return { ...base, boxes: [], lines: [], labels: [], tables: [], alertCalls: [] };

  // syminfo.mintick, chart.bg_color, barstate.isconfirmed
  const MINTICK = mintickOf(chart);
  const lastConfirmed = lastBarConfirmedOf(chart);
  const tickText = (v: number) => str.tostring(v, 'mintick', MINTICK);
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  // ── Theme and colours ──
  const isDark = cfg.theme === 'Dark' ? true : cfg.theme === 'Light' ? false : (color.r(backgroundColorOf(chart)) as number) < 128;
  const C = (c: string, t: number) => String(color.new(c, t));
  const TEXT_COLOR = isDark ? '#E0E0E0' : '#1A1A1A';
  const TEXT_MUTED = isDark ? C('#9E9E9E', 0) : C('#757575', 0);
  const BULL_TEXT = isDark ? '#00E676' : '#00695C';
  const BEAR_TEXT = isDark ? '#FF5252' : '#D32F2F';
  const NEUTRAL_TEXT = isDark ? '#FFEB3B' : '#BF360C';
  const BULL_LABEL_TEXT = '#004D25';
  const BEAR_LABEL_TEXT = '#FFFFFF';
  const TABLE_BG = isDark ? C('#131722', 5) : C('#FFFFFF', 5);
  const TABLE_BORDER = isDark ? C('#2A2E39', 50) : C('#D0D0D0', 50);
  const TABLE_ROW_ALT = isDark ? C('#1C2030', 0) : C('#F0F4F8', 0);
  const HEADER_BG = C('#1565C0', 0);
  const HEADER_TEXT = '#FFFFFF';
  const SL_COLOR = isDark ? C('#EF5350', 0) : C('#C62828', 0);
  const TP1_COLOR = isDark ? C('#4CAF50', 25) : C('#2E7D32', 25);
  const TP2_COLOR = isDark ? C('#4CAF50', 35) : C('#2E7D32', 35);
  const TP3_COLOR = isDark ? C('#4CAF50', 0) : C('#2E7D32', 0);
  const ENTRY_COLOR = isDark ? C('#42A5F5', 0) : C('#1565C0', 0);
  const TP_HIT_COLOR = isDark ? C('#26C6DA', 0) : C('#00838F', 0);
  const BE_COLOR = isDark ? C('#FFA726', 0) : C('#BF360C', 0);
  const LABEL_TEXT = isDark ? '#1A1A1A' : '#FFFFFF';
  const WM_COLOR = isDark ? C('#FFFFFF', 80) : C('#000000', 80);
  const BULL_ZONE_BORDER = cfg.bullColor;
  const BEAR_ZONE_BORDER = cfg.bearColor;
  const SWEPT_BORDER = isDark ? C('#9E9E9E', 60) : C('#616161', 60);
  const SWEPT_BG = isDark ? C('#9E9E9E', 92) : C('#9E9E9E', 88);
  const MITIGATED_BORDER = isDark ? C('#616161', 70) : C('#424242', 70);
  const MITIGATED_BG = isDark ? C('#616161', 94) : C('#424242', 92);
  const CLEAR = C(String(color.black), 100);
  const SL_DIM = C(SL_COLOR, 70);

  // ── Risk preset ──
  const [effectiveSLMult, effectiveTP1Mult, effectiveTP2Mult, effectiveTP3Mult] = cfg.riskPreset === 'Conservative'
    ? [2.5, 1.0, 2.0, 4.0]
    : cfg.riskPreset === 'Aggressive'
      ? [1.0, 1.5, 2.5, 4.0]
      : cfg.riskPreset === 'Scalping'
        ? [0.8, 0.8, 1.5, 2.0]
        : cfg.riskPreset === 'Custom'
          ? [cfg.slMult, cfg.tp1Mult, cfg.tp2Mult, cfg.tp3Mult]
          : [1.5, 1.0, 2.0, 3.0];

  const formatPctFromEntry = (level: number, entry: number): string => {
    if (cfg.showPctOnLabels && !Number.isNaN(level) && !Number.isNaN(entry) && ne(entry, 0)) {
      const pct = ((level - entry) / entry) * 100.0;
      return ' (' + (ge(pct, 0) ? '+' : '') + str.tostring(pct, '#.##') + '%)';
    }
    return '';
  };

  // ── Adaptive pivot length ──
  const nz0 = (a: number[]) => a.map((v) => (Number.isNaN(v) ? 0.0 : v));
  const atrFast = nz0(A(ta.atr(bars, 14)));
  const atrSlow = nz0(A(ta.atr(bars, 50)));
  const riskAtrArr = nz0(A(ta.atr(bars, cfg.atrLenRisk)));
  const leftLenArr = bars.map((_b, i) => {
    if (!cfg.adaptivePivot) return cfg.manualPivotLen;
    const volRatio = safeDiv(atrFast[i], atrSlow[i], 1.0);
    return Math.trunc(math.round(Math.max(4.0, Math.min(16.0, 10.0 / Math.max(0.5, volRatio)))) as number);
  });
  const rightLen = cfg.rightConfirm;
  const WARMUP_BARS = Math.max(50, cfg.atrLenRisk + 10);

  // ta.pivothigh(leftLen, rightLen) / ta.pivotlow(leftLen, rightLen) with a left length per bar
  const leftLenS = Series.fromArray(bars, leftLenArr);
  const pivotHighs = A(ta.pivothigh(new Series(bars, (b) => b.high), leftLenS, rightLen));
  const pivotLows = A(ta.pivotlow(new Series(bars, (b) => b.low), leftLenS, rightLen));

  // HTF pivot levels: only the strength bonus reads them, and only when "Enable HTF Confluence" is on
  const htf = cfg.useHtfConfluence ? htfPivots(bars, cfg.htfTimeframe, chart) : null;

  // ── Drawings ──
  // The library registry keeps at most 500 objects of each kind; the trade lines and labels are held by `var`
  // variables. Pools use xloc.bar_time: x is the Pine time (ms) of a bar
  resetDrawings({ line: MAX_OBJECTS, label: MAX_OBJECTS, box: MAX_OBJECTS });
  const inMs = bars[0].time >= 1e12;
  const pineTime = (t: number) => (inMs ? t : t * 1000);

  // ── Pools ──
  let pools: Pool[] = [];
  let totalMitigationsCount = 0;
  let signalsFiredCount = 0;
  let totalPoolsEverCount = 0;
  let volMedian = NaN;
  let tolerance = 0.0;
  let barIndex = 0;

  const computeStrength = (p: Pool): number => {
    const ageBars = barIndex - p.lastTouchIdx;
    const decay = math.pow(0.5, safeDiv(ageBars, cfg.halfLifeBars, 0.0)) as number;
    const touchPts = Math.min(35.0, (p.touchCount - 1) * 9.0);
    const recencyPts = 35.0 * decay;
    let volPts = 0.0;
    if (cfg.useVolumeWeight && !Number.isNaN(volMedian) && gt(volMedian, 0)) {
      const r = safeDiv(p.cumulativeVol, volMedian, 0.0);
      volPts = Math.min(20.0, (math.log(Math.max(1.0, r)) as number) * 8.0);
    }
    const total = touchPts + recencyPts + volPts + p.htfBonus;
    return Math.max(0.0, Math.min(100.0, total));
  };

  const findMatchingPool = (price: number, isHigh: boolean, tol: number): number => {
    for (let k = 0; k < pools.length; k++) {
      const p = pools[k];
      if (p.state === STATE_ACTIVE && p.isHigh === isHigh) {
        const dist = Math.abs(price - p.level);
        if (le(dist, tol) && barIndex - p.lastTouchIdx <= cfg.maxLookback) return k;
      }
    }
    return -1;
  };

  const updatePoolWithTouch = (p: Pool, touchPrice: number, touchIdx: number, touchVol: number): void => {
    const newLevel = (p.level * p.touchCount + touchPrice) / (p.touchCount + 1);
    p.level = newLevel;
    p.levelTop = newLevel + tolerance / 2.0;
    p.levelBot = newLevel - tolerance / 2.0;
    p.lastTouchIdx = touchIdx;
    p.touchCount += 1;
    p.cumulativeVol += touchVol;
  };

  const createPool = (price: number, idx: number, t: number, vol: number, isHigh: boolean, htfBonus: number): void => {
    const borderClr = isHigh ? BEAR_ZONE_BORDER : BULL_ZONE_BORDER;
    const x = pineTime(t);
    const zoneBox = box.new(x, price + tolerance / 2.0, x, price - tolerance / 2.0, borderClr, 1, undefined, undefined, 'bar_time', C(borderClr, 88));
    const midLine = line.new(x, price, x, price, 'bar_time', 'none', C(borderClr, 50), 'dotted', 1);
    const poolLabel = label.new(x, price, '', 'bar_time', 'price', CLEAR, 'label_left', isHigh ? BEAR_TEXT : BULL_TEXT, 'small');
    pools.push({
      level: price, levelTop: price + tolerance / 2.0, levelBot: price - tolerance / 2.0, lastTouchIdx: idx, firstBarTime: t,
      touchCount: 1, cumulativeVol: vol, isHigh, state: STATE_ACTIVE, sweptAtIdx: 0, sweptAtTime: 0, htfBonus,
      zoneBox, poolLabel, midLine,
    });
  };

  const removePool = (k: number): void => {
    const victim = pools[k];
    box.delete(victim.zoneBox);
    line.delete(victim.midLine);
    label.delete(victim.poolLabel);
    pools.splice(k, 1);
  };

  /** A new pivot: a touch of the first matching pool, else a new pool */
  const processPivot = (pivot: number, isHigh: boolean, htfLevel: number): void => {
    const pivotIdx = barIndex - rightLen;
    const pivotBar = bars[pivotIdx];
    const pVol = Number.isNaN(pivotBar.volume ?? NaN) ? 0.0 : (pivotBar.volume as number);
    const htfBonus = cfg.useHtfConfluence && !Number.isNaN(htfLevel) && le(Math.abs(pivot - htfLevel), tolerance * 1.5) ? 20.0 : 0.0;
    const matchIdx = findMatchingPool(pivot, isHigh, tolerance);
    if (matchIdx >= 0) {
      const pp = pools[matchIdx];
      updatePoolWithTouch(pp, pivot, pivotIdx, pVol);
      if (gt(htfBonus, 0) && lt(pp.htfBonus, 20.0)) pp.htfBonus = 20.0;
    } else {
      createPool(pivot, pivotIdx, pivotBar.time, pVol, isHigh, htfBonus);
      totalPoolsEverCount += 1;
    }
  };

  // ── Trade state ──
  const signalMarkerSize = sizeFromString(cfg.signalFontSize);
  const labelSize = sizeFromString(cfg.labelFontSize);
  let activeEntry = NaN;
  let activeSL = NaN;
  let activeTP1 = NaN;
  let activeTP2 = NaN;
  let activeTP3 = NaN;
  let activeDir = 0;
  let initialRiskDist = NaN;
  let tp1Reached = false;
  let tp2Reached = false;
  let tp3Reached = false;
  let beActive = false;
  let activePoolStrength = NaN;
  let tradeCounter = 0;
  let activeTradeId = 0;
  // alert() calls: syminfo.tickerid and timeframe.period of the messages
  const alertCalls: AlertCall[] = [];
  const tickerid = tickeridOf(chart);
  const tfPeriod = chartTimeframe(bars, chart);
  const nz = (v: number) => (Number.isNaN(v) ? 0 : v);

  // var line slLine = na ... var label entryLabel = na
  const slLine = varDrawing<Line>();
  const tp1Line = varDrawing<Line>();
  const tp2Line = varDrawing<Line>();
  const tp3Line = varDrawing<Line>();
  const entryLine = varDrawing<Line>();
  const slLabel = varDrawing<Label>();
  const tp1Label = varDrawing<Label>();
  const tp2Label = varDrawing<Label>();
  const tp3Label = varDrawing<Label>();
  const entryLabel = varDrawing<Label>();
  const riskLines = [slLine, tp1Line, tp2Line, tp3Line, entryLine];
  const riskLabels = [slLabel, tp1Label, tp2Label, tp3Label, entryLabel];
  let riskLinesActive = false;
  const deleteRiskDrawings = (): void => {
    for (const l of riskLines) if (l.value) line.delete(l.value);
    for (const l of riskLabels) if (l.value) label.delete(l.value);
  };

  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const { high, low, close } = b;
    barIndex = i;
    const isLast = i === n - 1;
    setDrawingBar(i, isLast);
    const isConfirmed = !isLast || lastConfirmed;
    const isWarmedUp = i >= WARMUP_BARS;
    const ph = pivotHighs[i];
    const pl = pivotLows[i];
    tolerance = atrFast[i] * cfg.atrTolerance;

    // ── New pivots ──
    if (!Number.isNaN(ph) && isWarmedUp) processPivot(ph, true, htf ? htf.high[i] : NaN);
    if (!Number.isNaN(pl) && isWarmedUp) processPivot(pl, false, htf ? htf.low[i] : NaN);

    // Volume median of the pools: set as soon as there are 3 pools, then every 25 bars
    if (pools.length >= 3 && (Number.isNaN(volMedian) || i % 25 === 0)) {
      volMedian = array.median(pools.map((p) => p.cumulativeVol)) as number;
    }

    // ── Volume at the level ──
    if (pools.length > 0 && isWarmedUp && isConfirmed && cfg.useVolumeWeight) {
      const barVol = Number.isNaN(b.volume ?? NaN) ? 0.0 : (b.volume as number);
      if (gt(barVol, 0)) {
        for (const p of pools) {
          if (p.state !== STATE_ACTIVE) continue;
          const touched = (ge(high, p.levelBot) && le(high, p.levelTop)) || (ge(low, p.levelBot) && le(low, p.levelTop))
            || (le(low, p.levelBot) && ge(high, p.levelTop));
          if (touched && i > p.lastTouchIdx) p.cumulativeVol += barVol;
        }
      }
    }

    // ── Sweeps, mitigations and signals ──
    let sweepBuySignal = false;
    let sweepSellSignal = false;
    let signalPoolStrength = 0.0;
    let anySignalFiredThisBar = false;
    if (pools.length > 0 && isWarmedUp && isConfirmed) {
      for (const p of pools) {
        if (!(p.state === STATE_ACTIVE && i >= p.lastTouchIdx + rightLen + 1)) continue;
        const s = computeStrength(p);
        const wickSweep = p.isHigh ? gt(high, p.levelTop) : lt(low, p.levelBot);
        const closeBack = p.isHigh ? lt(close, p.level) : gt(close, p.level);
        if (!wickSweep) continue;
        p.state = closeBack ? STATE_MITIGATED : STATE_SWEPT;
        p.sweptAtIdx = i;
        p.sweptAtTime = b.time;
        if (closeBack) totalMitigationsCount += 1;
        const signalEligible = cfg.requireBodyReversal ? closeBack : true;
        if (cfg.enableSweepSignals && signalEligible && ge(s, cfg.minStrengthSignal)) {
          if (p.isHigh) sweepSellSignal = true;
          else sweepBuySignal = true;
          if (gt(s, signalPoolStrength)) signalPoolStrength = s;
          anySignalFiredThisBar = true;
        }
      }
    }
    if (anySignalFiredThisBar) signalsFiredCount += 1;

    // ── Removal of pools ──
    if (pools.length > 0 && isConfirmed) {
      // swept and mitigated pools when "Keep Swept Zones" is off
      if (!cfg.showSwept) {
        for (let k = pools.length - 1; k >= 0; k--) {
          if (pools[k].state !== STATE_ACTIVE) removePool(k);
        }
      }
      // above the limit: one pool per bar, the oldest swept one, else the weakest active one
      if (pools.length > cfg.maxActivePools) {
        let oldestSweptIdx = -1;
        let oldestSweptIdxBar = i + 1;
        pools.forEach((p, k) => {
          if (p.state !== STATE_ACTIVE && p.sweptAtIdx < oldestSweptIdxBar) {
            oldestSweptIdxBar = p.sweptAtIdx;
            oldestSweptIdx = k;
          }
        });
        if (oldestSweptIdx >= 0) {
          removePool(oldestSweptIdx);
        } else {
          let worstIdx = -1;
          let worstStr = 1e9;
          pools.forEach((p, k) => {
            if (p.state !== STATE_ACTIVE) return;
            const s = computeStrength(p);
            if (lt(s, worstStr)) {
              worstStr = s;
              worstIdx = k;
            }
          });
          if (worstIdx >= 0) removePool(worstIdx);
        }
      }
    }

    // ── Pools on the last bar: geometry, colours and texts ──
    if (isLast) {
      for (const p of pools) {
        const s = computeStrength(p);
        const visible = cfg.showZones && (p.state === STATE_ACTIVE ? ge(s, cfg.minStrengthShow) : cfg.showSwept);
        const zoneBox = p.zoneBox;
        const midLine = p.midLine;
        const poolLabel = p.poolLabel;
        // the setters do nothing on a deleted object
        if (visible) {
          const rightT = p.state === STATE_ACTIVE ? b.time : p.sweptAtTime;
          const baseClr = p.isHigh ? BEAR_ZONE_BORDER : BULL_ZONE_BORDER;
          const bgTransp = cfg.showStrengthBar ? strengthToTransparency(s) : 88;
          let borderClr = baseClr;
          let bgClr = C(baseClr, bgTransp);
          if (p.state === STATE_SWEPT) {
            borderClr = SWEPT_BORDER;
            bgClr = SWEPT_BG;
          } else if (p.state === STATE_MITIGATED) {
            borderClr = MITIGATED_BORDER;
            bgClr = MITIGATED_BG;
          }
          box.set_left(zoneBox, pineTime(p.firstBarTime));
          box.set_right(zoneBox, pineTime(rightT));
          box.set_top(zoneBox, p.levelTop);
          box.set_bottom(zoneBox, p.levelBot);
          line.set_x1(midLine, pineTime(p.firstBarTime));
          line.set_x2(midLine, pineTime(rightT));
          line.set_y1(midLine, p.level);
          line.set_y2(midLine, p.level);
          box.set_border_color(zoneBox, borderClr);
          box.set_bgcolor(zoneBox, bgClr);
          line.set_color(midLine, C(borderClr, 40));
          if (cfg.showLabels) {
            const typeStr = p.isHigh ? 'SSL' : 'BSL';
            const countStr = p.touchCount > 1 ? str.format(' ×{0}', p.touchCount) : '';
            const strStr = str.format(' [{0}]', math.round(s) as number);
            const volStr = cfg.showVolume ? ' ' + formatVolume(p.cumulativeVol) : '';
            const stateStr = p.state === STATE_SWEPT ? 'Swept ' : p.state === STATE_MITIGATED ? 'Mit. ' : '';
            label.set_x(poolLabel, pineTime(rightT));
            label.set_y(poolLabel, p.level);
            label.set_text(poolLabel, stateStr + typeStr + countStr + strStr + volStr);
            label.set_textcolor(poolLabel, p.state === STATE_ACTIVE ? (p.isHigh ? BEAR_TEXT : BULL_TEXT) : C(TEXT_MUTED, 20));
          } else {
            label.set_text(poolLabel, '');
          }
        } else {
          // hidden: the box and the line are collapsed on the current bar
          box.set_left(zoneBox, pineTime(b.time));
          box.set_right(zoneBox, pineTime(b.time));
          line.set_x1(midLine, pineTime(b.time));
          line.set_x2(midLine, pineTime(b.time));
          label.set_text(poolLabel, '');
        }
      }
    }

    // ── Signal markers ──
    if (cfg.showSignals && sweepBuySignal) {
      label.new(i, low, 'Long', 'bar_index', 'belowbar', cfg.bullColor, 'label_up', BULL_LABEL_TEXT, signalMarkerSize);
    }
    if (cfg.showSignals && sweepSellSignal) {
      label.new(i, high, 'Short', 'bar_index', 'abovebar', cfg.bearColor, 'label_down', BEAR_LABEL_TEXT, signalMarkerSize);
    }

    // ── Trade model ──
    const riskAtr = riskAtrArr[i];
    const slDistance = riskAtr * effectiveSLMult;
    const barWouldCloseLong = activeDir === 1 && !Number.isNaN(activeSL) && !Number.isNaN(activeTP3) && (le(low, activeSL) || ge(high, activeTP3));
    const barWouldCloseShort = activeDir === -1 && !Number.isNaN(activeSL) && !Number.isNaN(activeTP3) && (ge(high, activeSL) || le(low, activeTP3));
    const positionActive = activeDir !== 0 && !barWouldCloseLong && !barWouldCloseShort;
    const confirmedBuy = sweepBuySignal && isConfirmed && isWarmedUp && !positionActive;
    const confirmedSell = sweepSellSignal && isConfirmed && isWarmedUp && !positionActive;

    // replaced-trade close-out, from the old state
    const replacingTrade = (confirmedBuy || confirmedSell) && activeDir !== 0;
    const replacedSLHit = replacingTrade && (activeDir === 1 ? le(low, activeSL) : ge(high, activeSL));
    const replacedTP3Hit = replacingTrade && !replacedSLHit;
    const replacedWasBE = replacingTrade && beActive;
    const replacedEntry = replacingTrade ? activeEntry : NaN;
    const replacedSL = replacingTrade ? activeSL : NaN;
    const replacedTP3 = replacingTrade ? activeTP3 : NaN;
    const replacedTradeId = replacingTrade ? activeTradeId : 0;

    let justOpened = false;
    if (confirmedBuy || confirmedSell) {
      const sign = confirmedBuy ? 1.0 : -1.0;
      const wickDist = (confirmedBuy ? close - low : high - close) + riskAtr * cfg.wickBuffer;
      const slDist = cfg.slMode === 'Sweep Wick' && gt(wickDist, 0) && ge(wickDist, riskAtr * 0.1) ? wickDist : slDistance;
      tradeCounter += 1;
      activeTradeId = tradeCounter;
      activeEntry = close;
      activeSL = close - sign * slDist;
      activeTP1 = close + sign * slDist * effectiveTP1Mult;
      activeTP2 = close + sign * slDist * effectiveTP2Mult;
      activeTP3 = close + sign * slDist * effectiveTP3Mult;
      initialRiskDist = slDist;
      activeDir = confirmedBuy ? 1 : -1;
      activePoolStrength = signalPoolStrength;
      tp1Reached = false;
      tp2Reached = false;
      tp3Reached = false;
      beActive = false;
      justOpened = true;
    }

    // hits against the levels at the start of the bar (not on the bar that opens the trade)
    const effectiveSL = activeSL;
    const hitUp = (level: number) => ge(high, level);
    const hitDown = (level: number) => le(low, level);
    const slHit = !justOpened && (activeDir === 1 ? hitDown(effectiveSL) : activeDir === -1 ? hitUp(effectiveSL) : false);
    const tpHit = (level: number) => !justOpened && (activeDir === 1 ? hitUp(level) : activeDir === -1 ? hitDown(level) : false);
    const tp3Hit = tpHit(activeTP3);
    const tp1FirstTouch = tpHit(activeTP1) && !tp1Reached && activeDir !== 0;
    const tp2FirstTouch = tpHit(activeTP2) && !tp2Reached && activeDir !== 0;
    const tp3FirstTouch = tp3Hit && !tp3Reached && activeDir !== 0;
    if (tp1FirstTouch) tp1Reached = true;
    if (tp2FirstTouch) tp2Reached = true;
    if (tp3FirstTouch) tp3Reached = true;

    // break-even: the stop moves to the entry on the first touch of TP1
    let beJustActivated = false;
    if (cfg.useBreakEven && tp1FirstTouch && !slHit && activeDir !== 0 && !beActive) {
      activeSL = activeEntry;
      beActive = true;
      beJustActivated = true;
    }

    // alert snapshots, before the reset
    const closedBySL = slHit && activeDir !== 0;
    const wasBeActive = beActive;
    const alertTradeIdVal = activeTradeId;
    const alertEntryVal = activeEntry;
    const alertSLVal = effectiveSL;
    const alertTP1Val = activeTP1;
    const alertTP2Val = activeTP2;
    const alertTP3Val = activeTP3;

    // exit on the stop or on TP3
    if ((slHit || tp3Hit) && activeDir !== 0) {
      activeDir = 0;
      activeSL = NaN;
      activeTP1 = NaN;
      activeTP2 = NaN;
      activeTP3 = NaN;
      activeEntry = NaN;
      activePoolStrength = NaN;
      initialRiskDist = NaN;
      tp1Reached = false;
      tp2Reached = false;
      tp3Reached = false;
      beActive = false;
    }

    // ── Alerts (alert() calls, alert.freq_once_per_bar_close; the state after the reset) ──
    {
      const alert = (message: string) => alertCalls.push({ time: b.time, message, freq: 'once_per_bar_close' });
      const alertPrice = tickText(close);
      const alertSLStr = tickText(nz(activeSL));
      const alertTP1Str = tickText(nz(activeTP1));
      const alertTP2Str = tickText(nz(activeTP2));
      const alertTP3Str = tickText(nz(activeTP3));
      const alertRRStr = str.tostring(effectiveTP1Mult, '#.#');
      const alertStrStr = str.tostring(nz(activePoolStrength), '#');
      const alertIdStr = str.tostring(activeTradeId);
      const alertQtyStr = Number.isNaN(initialRiskDist) || le(initialRiskDist, 0)
        ? '0' : str.tostring((cfg.acctSize * cfg.riskPerTrade) / 100.0 / initialRiskDist, '#.######');
      const eventJson = (action: string, event: string, id: number, entry: number, price: number) =>
        '{"action":"' + action + '","event":"' + event + '","id":' + str.tostring(id) + ',"ticker":"' + tickerid + '","tf":"' + tfPeriod
        + '","entry":' + tickText(nz(entry)) + ',"price":' + tickText(nz(price)) + '}';
      const entryJson = (action: string) =>
        '{"action":"' + action + '","event":"entry","id":' + alertIdStr + ',"qty":' + alertQtyStr + ',"ticker":"' + tickerid + '","tf":"'
        + tfPeriod + '","price":' + alertPrice + ',"sl":' + alertSLStr + ',"tp1":' + alertTP1Str + ',"tp2":' + alertTP2Str + ',"tp3":'
        + alertTP3Str + ',"rr":' + alertRRStr + ',"pool_strength":' + alertStrStr + '}';
      const entryText = (head: string) =>
        head + tickerid + ' | ID: ' + alertIdStr + ' | TF: ' + tfPeriod + ' | Price: ' + alertPrice + ' | Pool: ' + alertStrStr
        + '/100 | SL: ' + alertSLStr + ' | TP1: ' + alertTP1Str + ' | TP2: ' + alertTP2Str + ' | TP3: ' + alertTP3Str + ' | R:R: ' + alertRRStr;

      if ((closedBySL || replacedSLHit) && cfg.alertClose && isConfirmed) {
        const beStop = closedBySL ? wasBeActive : replacedWasBE;
        const exId = closedBySL ? alertTradeIdVal : replacedTradeId;
        const exEntry = closedBySL ? alertEntryVal : replacedEntry;
        const exSL = closedBySL ? alertSLVal : replacedSL;
        const slText = (beStop ? '🛡️ BE STOP-OUT | ' : '🛑 SL HIT | ') + tickerid + ' | ID: ' + str.tostring(exId) + ' | Entry: '
          + tickText(nz(exEntry)) + ' | SL: ' + tickText(nz(exSL));
        alert(cfg.webhook ? eventJson('exit', beStop ? 'be_stop' : 'sl_hit', exId, exEntry, exSL) : slText);
      }
      if (tp1FirstTouch && !slHit && cfg.alertUpdate && isConfirmed) {
        const tp1Text = '🎯 TP1 HIT | ' + tickerid + ' | ID: ' + str.tostring(alertTradeIdVal) + ' | TP1: ' + tickText(alertTP1Val);
        alert(cfg.webhook ? eventJson('update', 'tp1_hit', alertTradeIdVal, alertEntryVal, alertTP1Val) : tp1Text);
      }
      if (beJustActivated && cfg.alertUpdate && isConfirmed) {
        const beText = '🛡️ BREAK-EVEN | ' + tickerid + ' | ID: ' + str.tostring(alertTradeIdVal) + ' | SL moved to ' + tickText(alertEntryVal);
        alert(cfg.webhook ? eventJson('update', 'break_even', alertTradeIdVal, alertEntryVal, alertEntryVal) : beText);
      }
      if (tp2FirstTouch && !slHit && cfg.alertUpdate && isConfirmed) {
        const tp2Text = '🎯 TP2 HIT | ' + tickerid + ' | ID: ' + str.tostring(alertTradeIdVal) + ' | TP2: ' + tickText(alertTP2Val);
        alert(cfg.webhook ? eventJson('update', 'tp2_hit', alertTradeIdVal, alertEntryVal, alertTP2Val) : tp2Text);
      }
      if (((tp3FirstTouch && !slHit) || replacedTP3Hit) && cfg.alertClose && isConfirmed) {
        const tp3Id = replacedTP3Hit ? replacedTradeId : alertTradeIdVal;
        const tp3E = replacedTP3Hit ? replacedEntry : alertEntryVal;
        const tp3V = replacedTP3Hit ? replacedTP3 : alertTP3Val;
        const tp3Text = '🏆 TP3 HIT | ' + tickerid + ' | ID: ' + str.tostring(tp3Id) + ' | TP3: ' + tickText(nz(tp3V));
        alert(cfg.webhook ? eventJson('exit', 'tp3_hit', tp3Id, tp3E, tp3V) : tp3Text);
      }
      // entries after the exits; a bar with both signals opens long: only the buy alert
      if (confirmedBuy) alert(cfg.webhook ? entryJson('buy') : entryText('🟢 SWEEP BUY | '));
      if (confirmedSell && !confirmedBuy) alert(cfg.webhook ? entryJson('sell') : entryText('🔴 SWEEP SELL | '));
    }

    // ── SL / TP lines and labels ──
    if ((confirmedBuy || confirmedSell) && cfg.showSlTp) {
      deleteRiskDrawings();
      const level = (y: number, lineColor: string, style: DrawStyle): Line =>
        line.new(i, y, i + LINE_LOOKAHEAD, y, 'bar_index', 'none', lineColor, style, 1);
      entryLine.value = level(activeEntry, ENTRY_COLOR, 'dotted');
      slLine.value = level(activeSL, SL_COLOR, 'solid');
      tp1Line.value = level(activeTP1, TP1_COLOR, 'dashed');
      tp2Line.value = level(activeTP2, TP2_COLOR, 'dashed');
      tp3Line.value = level(activeTP3, TP3_COLOR, 'dashed');
      if (cfg.showSlTpLabels) {
        const tag = (y: number, text: string, bg: string): Label =>
          label.new(i + LABEL_OFFSET, y, text, 'bar_index', 'price', bg, 'label_left', LABEL_TEXT, labelSize);
        entryLabel.value = tag(activeEntry, 'ENTRY ' + tickText(activeEntry), ENTRY_COLOR);
        slLabel.value = tag(activeSL, 'SL ' + tickText(activeSL) + formatPctFromEntry(activeSL, activeEntry), SL_COLOR);
        tp1Label.value = tag(activeTP1, 'TP1 ' + tickText(activeTP1) + formatPctFromEntry(activeTP1, activeEntry), TP1_COLOR);
        tp2Label.value = tag(activeTP2, 'TP2 ' + tickText(activeTP2) + formatPctFromEntry(activeTP2, activeEntry), TP2_COLOR);
        tp3Label.value = tag(activeTP3, 'TP3 ' + tickText(activeTP3) + formatPctFromEntry(activeTP3, activeEntry), TP3_COLOR);
      }
      riskLinesActive = true;
    }

    // a target that was reached: solid line in the hit colour, label with a check mark
    // `not na(tp1Line)`: the variable got a line once (a deleted line is not na); the setters do nothing on a deleted
    // object
    const markHit = (lineVar: DrawingVariable<Line>, labelVar: DrawingVariable<Label>, name: string, level: number): void => {
      const l = lineVar.value as Line;
      line.set_color(l, TP_HIT_COLOR);
      line.set_style(l, 'solid');
      if (cfg.showSlTpLabels && labelVar.value) {
        label.set_text(labelVar.value, name + ' ✓ ' + tickText(level) + formatPctFromEntry(level, activeEntry));
        label.set_color(labelVar.value, TP_HIT_COLOR);
      }
    };
    if (cfg.showSlTp && tp1Line.value && tp1Reached) markHit(tp1Line, tp1Label, 'TP1', activeTP1);
    if (cfg.showSlTp && tp2Line.value && tp2Reached) markHit(tp2Line, tp2Label, 'TP2', activeTP2);
    if (cfg.showSlTp && tp3Line.value && tp3Reached) markHit(tp3Line, tp3Label, 'TP3', activeTP3);

    // break-even: the first stop line is dimmed and the entry label says where the stop is
    if (cfg.showSlTp && beActive && activeDir !== 0) {
      if (slLine.value) line.set_color(slLine.value, SL_DIM);
      if (cfg.showSlTpLabels) {
        if (slLabel.value) label.set_color(slLabel.value, SL_DIM);
        if (entryLabel.value) {
          label.set_text(entryLabel.value, 'ENTRY ' + tickText(activeEntry) + '  → SL (BE)');
          label.set_color(entryLabel.value, BE_COLOR);
        }
      }
    }

    // the position is closed: the lines and labels are removed
    if (activeDir === 0 && riskLinesActive && cfg.showSlTp) {
      deleteRiskDrawings();
      riskLinesActive = false;
    }

    // the position is open: the lines end 5 bars after the current bar
    if (activeDir !== 0 && riskLinesActive && cfg.showSlTp) {
      const newEnd = i + LINE_EXTEND;
      if (slLine.value) {
        for (const l of riskLines) if (l.value) line.set_x2(l.value, newEnd);
      }
      if (cfg.showSlTpLabels && slLabel.value) {
        for (const l of riskLabels) if (l.value) label.set_x(l.value, newEnd + 1);
      }
    }
    // end of the bar
  }
  setDrawingBar(null);

  // ── Tables of the last bar ──
  const last = bars[n - 1];
  barIndex = n - 1;
  const tables: TableData[] = [];
  if (cfg.showDash) {
    let activeBullPools = 0;
    let activeBearPools = 0;
    let strongestBull = 0.0;
    let strongestBear = 0.0;
    let strongestBullLevel = NaN;
    let strongestBearLevel = NaN;
    let nearestBullDist = 1e9;
    let nearestBearDist = 1e9;
    let nearestBullLevel = NaN;
    let nearestBearLevel = NaN;
    for (const p of pools) {
      if (p.state !== STATE_ACTIVE) continue;
      const s = computeStrength(p);
      const d = Math.abs(p.level - last.close);
      if (p.isHigh) {
        activeBearPools += 1;
        if (gt(s, strongestBear)) {
          strongestBear = s;
          strongestBearLevel = p.level;
        }
        if (lt(d, nearestBearDist) && gt(p.level, last.close)) {
          nearestBearDist = d;
          nearestBearLevel = p.level;
        }
      } else {
        activeBullPools += 1;
        if (gt(s, strongestBull)) {
          strongestBull = s;
          strongestBullLevel = p.level;
        }
        if (lt(d, nearestBullDist) && lt(p.level, last.close)) {
          nearestBullDist = d;
          nearestBullLevel = p.level;
        }
      }
    }
    const inTrade = activeDir !== 0;
    const currentRR = inTrade ? effectiveTP1Mult : 0.0;
    const riskPctVal = inTrade && !Number.isNaN(activeEntry) && ne(activeEntry, 0) && !Number.isNaN(activeSL)
      ? (Math.abs(activeEntry - activeSL) / activeEntry) * 100.0
      : 0.0;

    const cells: TableCellData[] = [];
    const cell = (column: number, row: number, text: string, textColor: string, alt = false): void => {
      cells.push({ column, row, text, textColor, textSize: 'small', ...(alt ? { bgColor: TABLE_ROW_ALT } : {}) });
    };
    // rows 11 to 17: the even rows up to 16 have the alternate background
    const row = (r: number, name: string, value: string, valueColor: string): void => {
      cell(0, r, name, TEXT_MUTED, r % 2 === 0 && r < 17);
      cell(1, r, value, valueColor, r % 2 === 0 && r < 17);
    };
    const strengthText = (level: number, strength: number) =>
      (Number.isNaN(level) ? '—' : tickText(level) + ' [' + str.tostring(math.round(strength) as number) + ']');
    const levelText = (level: number) => (Number.isNaN(level) ? '—' : tickText(level));
    const targetText = (level: number, reached: boolean) =>
      (inTrade && !Number.isNaN(level) ? (reached ? '✓ ' : '') + tickText(level) : '—');

    cells.push({ column: 0, row: 0, text: '💧 Liquidity Pools Pro', textColor: HEADER_TEXT, bgColor: HEADER_BG, textSize: 'small', textHAlign: 'center' });
    cell(0, 1, 'Symbol', TEXT_MUTED);
    cell(1, 1, tickerOf(chart), TEXT_COLOR);
    cell(0, 2, 'TF', TEXT_MUTED);
    cell(1, 2, chartTimeframe(bars, chart), TEXT_COLOR);
    cell(0, 3, 'Pivot Len', TEXT_MUTED, true);
    cell(1, 3, str.tostring(leftLenArr[n - 1]) + (cfg.adaptivePivot ? ' (adapt)' : ''), TEXT_COLOR, true);
    cell(0, 4, 'Active Pools', TEXT_MUTED);
    cell(1, 4, str.tostring(activeBullPools + activeBearPools) + ' (↑' + str.tostring(activeBullPools) + ' ↓' + str.tostring(activeBearPools) + ')', TEXT_COLOR);
    cell(0, 5, 'Strong SSL ↑', TEXT_MUTED, true);
    cell(1, 5, strengthText(strongestBearLevel, strongestBear), BEAR_TEXT, true);
    cell(0, 6, 'Strong BSL ↓', TEXT_MUTED);
    cell(1, 6, strengthText(strongestBullLevel, strongestBull), BULL_TEXT);
    cell(0, 7, 'Nearest Above', TEXT_MUTED, true);
    cell(1, 7, levelText(nearestBearLevel), BEAR_TEXT, true);
    cell(0, 8, 'Nearest Below', TEXT_MUTED);
    cell(1, 8, levelText(nearestBullLevel), BULL_TEXT);
    cell(0, 9, 'Stats', TEXT_MUTED);
    cell(1, 9, 'Mit:' + str.tostring(totalMitigationsCount) + ' Sig:' + str.tostring(signalsFiredCount) + '/' + str.tostring(totalPoolsEverCount),
      signalsFiredCount > 0 ? BULL_TEXT : NEUTRAL_TEXT);
    cell(0, 10, 'Position', TEXT_MUTED, true);
    cell(1, 10, activeDir === 1 ? '🟢 LONG' : activeDir === -1 ? '🔴 SHORT' : 'FLAT',
      activeDir === 1 ? BULL_TEXT : activeDir === -1 ? BEAR_TEXT : TEXT_MUTED, true);
    row(11, 'SL', inTrade && !Number.isNaN(activeSL) ? (beActive ? 'BE @ ' + tickText(activeSL) : tickText(activeSL)) : '—',
      beActive ? BE_COLOR : SL_COLOR);
    row(12, 'TP1', targetText(activeTP1, tp1Reached), tp1Reached ? TP_HIT_COLOR : TP1_COLOR);
    row(13, 'TP2', targetText(activeTP2, tp2Reached), tp2Reached ? TP_HIT_COLOR : TP2_COLOR);
    row(14, 'TP3', targetText(activeTP3, tp3Reached), tp3Reached ? TP_HIT_COLOR : TP3_COLOR);
    row(15, 'Plan R:R', inTrade ? str.tostring(currentRR, '#.#') + 'R' : '—',
      ge(currentRR, 2.0) ? BULL_TEXT : ge(currentRR, 1.0) ? NEUTRAL_TEXT : BEAR_TEXT);
    row(16, 'Risk %', inTrade ? str.tostring(riskPctVal, '#.##') + '%' : '—',
      gt(riskPctVal, 3.0) ? BEAR_TEXT : gt(riskPctVal, 1.0) ? NEUTRAL_TEXT : BULL_TEXT);
    // position size = (account x risk %) / distance from the entry to the first stop
    const riskCashD = (cfg.acctSize * cfg.riskPerTrade) / 100.0;
    row(17, 'Pos Size', inTrade && !Number.isNaN(initialRiskDist) && gt(initialRiskDist, 0)
      ? str.tostring(riskCashD / initialRiskDist, '#.####') + ' ($' + str.tostring(riskCashD, '#.##') + ')'
      : '—', TEXT_COLOR);
    cells.push({ column: 0, row: 18, text: 'Version ' + INDICATOR_VERSION, textColor: TEXT_MUTED, textSize: 'tiny', textHAlign: 'center' });

    tables.push({
      position: cornerOf(cfg.dashPos), columns: 2, rows: 19, cells,
      merges: [{ startColumn: 0, startRow: 0, endColumn: 1, endRow: 0 }, { startColumn: 0, startRow: 18, endColumn: 1, endRow: 18 }],
      bgColor: TABLE_BG, frameColor: TABLE_BORDER, frameWidth: 1, borderColor: TABLE_BORDER, borderWidth: 1,
    });
  }

  if (cfg.showWatermark) {
    tables.push({
      position: 'bottom_center', columns: 1, rows: 1,
      cells: [{ column: 0, row: 0, text: 'WillyAlgoTrader', textColor: WM_COLOR, textSize: 'normal', textHAlign: 'center', bgColor: CLEAR }],
      bgColor: CLEAR, borderColor: CLEAR, borderWidth: 0, frameColor: CLEAR, frameWidth: 0,
    });
  }

  // ── Output ──
  // Live objects of the registry: a bar_time x (Pine ms) back to the unit of the bars, a bar index to its bar time
  const interval = barInterval(bars);
  const X = (x: number, xloc: string) => (xloc === 'bar_time' ? (inMs ? x : x / 1000) : barTime(bars, x, interval));
  return {
    ...base,
    boxes: box.all().map((o) => ({
      time1: X(o.left, o.xloc), price1: o.top, time2: X(o.right, o.xloc), price2: o.bottom, bgColor: String(o.bgcolor),
      borderColor: String(o.border_color), borderWidth: o.border_width ?? 1,
    })),
    lines: line.all().map((l) => ({
      time1: X(l.x1, l.xloc), price1: l.y1, time2: X(l.x2, l.xloc), price2: l.y2, color: String(l.color), width: l.width ?? 1,
      style: (l.style ?? 'solid') as DrawStyle,
    })),
    labels: label.all().map((l) => ({
      time: X(l.x, l.xloc), price: l.y, text: l.text ?? '', color: String(l.color), textColor: String(l.textcolor),
      style: l.style as LabelStyle, size: l.size as PineSize,
      ...(l.yloc !== 'price' ? { yloc: l.yloc as 'abovebar' | 'belowbar' } : {}),
    })),
    tables,
    alertCalls,
  };
}

export const LiquidityPoolsPro = { calculate, metadata, defaultInputs, inputConfig, plotConfig, hasAlertFunction };
