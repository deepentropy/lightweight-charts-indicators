/**
 * MACD-X, More Than MACD
 *
 * A MACD with five calculation modes on a selectable source (close, hlc3, OBV, accumulation / distribution, PVT),
 * with EMA or SMA smoothing:
 * - TRADITIONAL: fast MA - slow MA;
 * - HISTOGRAM: MACD - its signal;
 * - LEADER: MACD + MA(source - fast MA, fast) - MA(source - slow MA, slow);
 * - SOURCE (default): MA(source - average of the fast and slow MAs, signal length);
 * - TRIX: 10000 * change of a triple EMA (2 * signal length) of the log of the source.
 * MACD-X, its signal (Signal-X) and the histogram (Histogram-X, dark / light green above 0, light red / dark red
 * below) are plotted; optionally the traditional MACD and signal, and a fill between MACD-X and Signal-X.
 *
 * Add-ons:
 * - Squeeze (Bollinger Bands inside / outside Keltner Channels of the close): diamonds at the top for compression or
 *   release phases, triangles for the momentum release;
 * - histogram threshold bands (Bollinger Bands of the histogram, 233 bars, two multipliers) with their fills;
 * - RSI colouring of MACD-X (overbought / oversold);
 * - volume-weighted price bars (bar colours by the volume against its moving average);
 * - a value label on the last bar (method, source, momentum, bars since the last cross, RSI, squeeze, volume).
 *
 * Backtest framework (optional): trades on the crosses of MACD-X and Signal-X (entry at the next bar open, or
 * the signal bar open in the "Next Bar Mode"), long / short / both, reverse on the opposite signal, stop loss on the
 * high / low, entry / exit labels, early warnings, a statistics label, a background for the trade direction and an
 * entry / exit price plot on the price pane. It reads the chart context: the current time (period in years), the
 * symbol tick, the ticker id and the timeframe.
 *
 * Outputs with `display = display.all - display.status_line` are drawn in the pane (the status line exclusion is
 * not represented).
 *
 * Reference: "MACD-X, More Than MACD by DGT" by dgtrd
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © dgtrd
 */

import {
  ta, str, color, Series, getSourceSeries, label, table, resetDrawings, setDrawingBar, drawingOutputs, varDrawing,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type FillConfig, type FillData, type ShapeConfig,
  type BarColorConfig, type Label,
} from 'oakscriptjs';
import type { AlertCall, BarColorData, BgColorData, MarkerData } from '../types';
import { mintickOf, nowOf, tickeridOf, type ChartContext } from '../chart-context';
import { chartTimeframe } from '../anchor-period';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { StudyDrawingKind } from '../style-outputs';

export interface MacdXMoreThanMacdByDgtInputs {
  macdType: string;
  sourceType: string;
  fast_length: number;
  slow_length: number;
  signal_length: number;
  macdTrdDisp: boolean;
  hstThesh: boolean;
  stDevL: number;
  stDevH: number;
  exponential: boolean;
  highlight: boolean;
  dispLabel: boolean;
  /** Bars back of the readings of the value label */
  histLabel: number;
  dispSqueeze: boolean;
  bbkcLength: number;
  bbMult: number;
  kcMult: number;
  colorRsi: boolean;
  rsiLength: number;
  rsiOverBought: number;
  rsiOverSold: number;
  vbcb: boolean;
  vwcbLen: number;
  vwcbUpper: number;
  vwcbLower: number;
  isBackTest: boolean;
  tradeMode: string;
  reverseOnSignal: boolean;
  dasCapital: number;
  lenBckTst: number;
  isStopLoss: boolean;
  /** Stop loss in % */
  stopLoss: number;
  useCandleL: boolean;
  useCandleS: boolean;
  isSudden: boolean;
  isTest: boolean;
  lblInOutSL: boolean;
  lblWarnings: boolean;
  lblTrdStat: boolean;
}

export const defaultInputs: MacdXMoreThanMacdByDgtInputs = {
  macdType: 'MACD-SOURCE',
  sourceType: 'Close',
  fast_length: 12,
  slow_length: 26,
  signal_length: 9,
  macdTrdDisp: false,
  hstThesh: false,
  stDevL: 1.75,
  stDevH: 2.25,
  exponential: true,
  highlight: false,
  dispLabel: false,
  histLabel: 0,
  dispSqueeze: false,
  bbkcLength: 20,
  bbMult: 2.0,
  kcMult: 1.25,
  colorRsi: false,
  rsiLength: 14,
  rsiOverBought: 70,
  rsiOverSold: 30,
  vbcb: true,
  vwcbLen: 21,
  vwcbUpper: 1.618,
  vwcbLower: 0.618,
  isBackTest: false,
  tradeMode: 'Both',
  reverseOnSignal: true,
  dasCapital: 1000,
  lenBckTst: 1,
  isStopLoss: false,
  stopLoss: 1,
  useCandleL: false,
  useCandleS: false,
  isSudden: true,
  isTest: false,
  lblInOutSL: true,
  lblWarnings: true,
  lblTrdStat: true,
};

const SQZ = 'Add-Ons';
const BT = '=============   Backtest Framework   =============';
const bt = { group: BT, active: { input: 'isBackTest' } };

export const inputConfig: InputConfig[] = [
  {
    id: 'macdType', type: 'string', title: 'MACD Calculation Mode', defval: 'MACD-SOURCE',
    options: ['MACD-TRADITIONAL', 'MACD-HISTOGRAM', 'MACD-LEADER', 'MACD-SOURCE', 'MACD-TRIX'],
    tooltip: 'Select the internal MACD-X calculation engine:\n\n'
      + '• MACD-TRADITIONAL → Classic fast/slow EMA MACD\n'
      + '• MACD-HISTOGRAM   → Momentum derived from histogram slope\n'
      + '• MACD-LEADER      → Early bias detection model\n'
      + '• MACD-SOURCE      → Source-smoothed adaptive variant\n'
      + '• MACD-TRIX        → Triple EMA momentum oscillator\n\n'
      + 'Each mode alters signal responsiveness and structure.',
  },
  {
    id: 'sourceType', type: 'string', title: '  Source', defval: 'Close',
    options: ['Close', 'HLC3 (High + Low + Close) / 3', 'On Balance Volume (OBV)', 'Accumulation / Distribution', 'Price Volume Trend (PVT)'],
    tooltip: 'Select the data source used for MACD calculation.\n\n'
      + '• Close → Standard price-based MACD\n'
      + '• HLC3 → Smoothed price averaging\n'
      + '• OBV / AD / PVT → Volume-derived momentum engines\n\n'
      + 'Using volume-based sources transforms MACD into a flow oscillator.',
  },
  { id: 'fast_length', type: 'int', title: '  Fast Length', defval: 12 },
  { id: 'slow_length', type: 'int', title: '  Slow Length', defval: 26 },
  { id: 'signal_length', type: 'int', title: '  Signal Smoothing', defval: 9, min: 1, max: 50 },
  {
    id: 'macdTrdDisp', type: 'bool', title: 'Show Traditional MACD', defval: false,
    tooltip: 'Displays classic MACD alongside MACD-X.\n\nWhen enabled, MACD-X will auto-highlight to visually separate the two engines.',
  },
  {
    id: 'hstThesh', type: 'bool', title: 'Enable Histogram Threshold Bands', defval: false,
    tooltip: 'Plots deviation-based bands around the MACD histogram.\n\nUsed to identify extreme momentum expansion and statistically stretched conditions.',
  },
  {
    id: 'stDevL', type: 'float', title: '  Lower Deviation Multiplier', defval: 1.75, min: 0, max: 5, step: 0.25,
    tooltip: 'Lower statistical deviation threshold.\n\nDefines moderate momentum expansion zone.', active: { input: 'hstThesh' },
  },
  {
    id: 'stDevH', type: 'float', title: '  Higher Deviation Multiplier', defval: 2.25, min: 0, max: 5, step: 0.25,
    tooltip: 'Higher statistical deviation threshold.\n\nDefines extreme momentum expansion zone.\n\nValues above this level suggest exhaustion risk.',
    active: { input: 'hstThesh' },
  },
  {
    id: 'exponential', type: 'bool', title: 'Use Exponential Moving Average', defval: true,
    tooltip: 'Switch between EMA and SMA for internal smoothing.\n\n• ON  → Faster reaction, more responsive signals\n• OFF → Smoother, slower structure',
  },
  {
    id: 'highlight', type: 'bool', title: 'Highlight MACD-X / Signal-X Area', defval: false,
    tooltip: 'Fills the area between MACD-X and Signal-X.\nHelps visualize momentum expansion and compression phases.',
  },
  { id: 'dispLabel', type: 'bool', title: 'Display Live Value Label', defval: false },
  { id: 'histLabel', type: 'int', title: '  Historical Label Readings', defval: 0, min: 0, active: { input: 'dispLabel' } },
  {
    id: 'dispSqueeze', type: 'bool', title: 'Enable Squeeze', defval: false, group: SQZ,
    tooltip: 'Activates volatility compression detection\nbased on Bollinger Bands and Keltner Channels.\n\n'
      + '• Compression → BB inside KC\n• Release     → BB expanding outside KC\n\nMACD-X acts as momentum confirmation.',
  },
  {
    id: 'bbkcLength', type: 'int', title: '  Squeeze Length', defval: 20, min: 1, group: SQZ, active: { input: 'dispSqueeze' },
    tooltip: 'Lookback period used for both:\n• Bollinger Bands\n• Keltner Channels\n\nHigher values → Broader compression cycles.',
  },
  {
    id: 'bbMult', type: 'float', title: '  Bollinger Band Multiplier', defval: 2.0, step: 0.25, group: SQZ, active: { input: 'dispSqueeze' },
    tooltip: 'Standard deviation multiplier for\nBollinger Bands width.\n\nHigher → Wider bands\nLower  → More frequent compression',
  },
  {
    id: 'kcMult', type: 'float', title: '  Keltner Channel Multiplier', defval: 1.25, step: 0.25, group: SQZ, active: { input: 'dispSqueeze' },
    tooltip: 'ATR-based multiplier for Keltner Channel width.\n\nControls how tight the squeeze detection is.\n\nLower values → Easier compression trigger.',
  },
  {
    id: 'colorRsi', type: 'bool', title: 'Enable RSI-Based MACD Coloring', defval: false, group: SQZ,
    tooltip: 'Changes MACD-X color when RSI reaches\nextreme zones.\n\n• Above Overbought → Bearish highlight\n'
      + '• Below Oversold   → Bullish highlight\n\nUseful for detecting exhaustion conditions.',
  },
  {
    id: 'rsiLength', type: 'int', title: '  RSI Length', defval: 14, min: 1, group: SQZ, active: { input: 'colorRsi' },
    tooltip: 'Lookback period for RSI calculation.\n\nLower values → More reactive\nHigher values → Smoother structure',
  },
  {
    id: 'rsiOverBought', type: 'int', title: '  RSI Overbought Level', defval: 70, min: 51, max: 99, group: SQZ, active: { input: 'colorRsi' },
    tooltip: 'Upper RSI threshold.\n\nWhen RSI exceeds this level, MACD-X will shift to bearish emphasis.',
  },
  {
    id: 'rsiOverSold', type: 'int', title: '  RSI Oversold Level', defval: 30, min: 1, max: 49, group: SQZ, active: { input: 'colorRsi' },
    tooltip: 'Lower RSI threshold.\n\nWhen RSI drops below this level, MACD-X will shift to bullish emphasis.',
  },
  { id: 'vbcb', type: 'bool', title: 'Enable Volume-Weighted Price Bars', defval: true, group: SQZ },
  { id: 'vwcbLen', type: 'int', title: '  Volume MA Length', defval: 21, min: 1, group: SQZ, active: { input: 'vbcb' } },
  { id: 'vwcbUpper', type: 'float', title: '  Upper Threshold', defval: 1.618, min: 0.1, step: 0.1, group: SQZ, active: { input: 'vbcb' } },
  { id: 'vwcbLower', type: 'float', title: '  Lower Threshold', defval: 0.618, min: 0.1, step: 0.1, group: SQZ, active: { input: 'vbcb' } },
  { id: 'isBackTest', type: 'bool', title: 'Enable Backtest', defval: false, group: BT, tooltip: 'Enable or disable the backtest framework.' },
  {
    id: 'tradeMode', type: 'string', title: 'Trade Mode', defval: 'Both', options: ['Long Only', 'Short Only', 'Both'], ...bt,
    tooltip: 'Defines which trade directions are simulated.\n\n'
      + '• Long Only  — enters on long signal, exits on short signal or stop loss\n'
      + '• Short Only — enters on short signal, exits on long signal or stop loss\n'
      + '• Both       — enters on either signal, optionally reverses on the opposite',
  },
  {
    id: 'reverseOnSignal', type: 'bool', title: 'Reverse on Opposite Signal', defval: true, ...bt,
    tooltip: 'Only applies when Trade Mode is Both.\n'
      + 'When enabled, an opposite signal immediately closes the current trade\n'
      + 'and opens a new one in the other direction — always in trade once started.\n'
      + 'When disabled, opposite signal exits only — no new trade until next entry signal.',
  },
  {
    id: 'dasCapital', type: 'float', title: 'Initial Capital', defval: 1000, ...bt,
    tooltip: 'Starting capital for the simulation.\nUsed to calculate compounding PnL and final equity.',
  },
  {
    id: 'lenBckTst', type: 'float', title: 'Period (Years)', defval: 1, min: 0, step: 0.1, ...bt,
    tooltip: 'Lookback window for the simulation in years.\nCapped automatically if the selected timeframe has insufficient history.',
  },
  {
    id: 'isStopLoss', type: 'bool', title: 'Apply Stop Loss', defval: false, inline: 'sl', ...bt,
    tooltip: 'Exits the trade if price moves against the position intrabar.\n'
      + 'Long SL : low  reaches entry × (1 − %)\nShort SL: high reaches entry × (1 + %)',
  },
  { id: 'stopLoss', type: 'float', title: '  %', defval: 1, step: 0.1, min: 0, inline: 'sl', ...bt },
  {
    id: 'useCandleL', type: 'bool', title: 'Long Candle Confirmation', defval: false, ...bt,
    tooltip: 'Long entries only taken on bullish bars (close > open).',
  },
  {
    id: 'useCandleS', type: 'bool', title: 'Short Candle Confirmation', defval: false, ...bt,
    tooltip: 'Short entries only taken on bearish bars (close < open).',
  },
  {
    id: 'isSudden', type: 'bool', title: 'Avoid Same-Bar Conflicts', defval: true, ...bt,
    tooltip: 'Skips entries when both long and short signals fire on the same bar.\nReduces false entries from volatile spikes.',
  },
  {
    id: 'isTest', type: 'bool', title: '❗ Next Bar Mode (Repaints)', defval: false, ...bt,
    tooltip: "Uses the next bar's open for simulation instead of the confirmed bar open.\n"
      + 'Produces earlier entries but signals will repaint.\nFor testing and comparison only — do not use for live alerts.',
  },
  {
    id: 'lblInOutSL', type: 'bool', title: 'Show Entry / Exit Labels', defval: true, ...bt,
    tooltip: 'Displays L / S / SL / TP labels at entry and exit bars with tooltips showing direction, price, change, and capital.',
  },
  {
    id: 'lblWarnings', type: 'bool', title: 'Show Early Warnings', defval: true, ...bt,
    tooltip: 'Shows a ⚠️ label when a signal fires but has not yet been confirmed.\nLabel is deleted on the following bar regardless of outcome.',
  },
  {
    id: 'lblTrdStat', type: 'bool', title: 'Show Trade Statistics', defval: true, ...bt,
    tooltip: 'Displays a floating label with full trade summary.\nIncludes win rate, PnL, long/short breakdown, and current trade status.',
  },
];

// Pine v6 colour constants
const GREEN = '#4CAF50';
const RED = '#F23645';
const ORANGE = '#FF9800';
const TEAL = '#089981';
const GRAY = '#787B86';
const WHITE = '#FFFFFF';
const DARK_GREEN = '#006400';
const DARK_RED = '#910000';
const BLUE_X = '#0094ff';
const ORANGE_X = '#ff6a00';
const OB_ZONE = String(color.new(RED, 75));
const OS_ZONE = String(color.new(TEAL, 75));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Histogram-X', color: DARK_GREEN, lineWidth: 1, style: 'columns', palette: [DARK_GREEN, GREEN, RED, DARK_RED] },
  { id: 'plot1', title: 'MACD-X', color: BLUE_X, lineWidth: 1, editable: false, palette: [DARK_RED, DARK_GREEN, BLUE_X] },
  { id: 'plot2', title: 'Signal-X', color: ORANGE_X, lineWidth: 1 },
  { id: 'plot3', title: 'MACD', color: BLUE_X, lineWidth: 1 },
  { id: 'plot4', title: 'Signal', color: ORANGE_X, lineWidth: 1 },
  { id: 'plot5', title: 'Overbought Lower Band', color: BLUE_X, lineWidth: 1, display: 'none', editable: false },
  { id: 'plot6', title: 'Overbought Upper Band', color: BLUE_X, lineWidth: 1, display: 'none', editable: false },
  { id: 'plot7', title: 'Oversold Upper Band', color: BLUE_X, lineWidth: 1, display: 'none', editable: false },
  { id: 'plot8', title: 'Oversold Lower Band', color: BLUE_X, lineWidth: 1, display: 'none', editable: false },
  {
    id: 'plot9', title: 'Entry / Exit Price', color: GRAY, lineWidth: 1, style: 'circles', forceOverlay: true, editable: false,
    palette: [TEAL, RED, GRAY],
  },
];

const FILL_COLORS = [DARK_RED, DARK_GREEN, BLUE_X, ORANGE_X].map((c) => String(color.new(c, 66)));

export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot1', plot2: 'plot2', title: 'Plots Background', editable: false, palette: FILL_COLORS },
  { id: 'fill1', plot1: 'plot5', plot2: 'plot6', title: 'Overbought Zone', color: OB_ZONE },
  { id: 'fill2', plot1: 'plot7', plot2: 'plot8', title: 'Oversold Zone', color: OS_ZONE },
];

export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'In Squeeze', style: 'diamond', location: 'top', color: GRAY },
  { id: 'shape1', kind: 'shape', title: 'Squeeze Release', style: 'triangleup', location: 'top', color: TEAL },
  { id: 'shape2', kind: 'shape', title: 'Squeeze Release', style: 'triangledown', location: 'top', color: RED },
];

export const barColorConfig: BarColorConfig[] = [
  { id: 'barcolor0', kind: 'barcolor', title: 'Volume-Weighted Price Bars', editable: false },
  { id: 'bgcolor0', kind: 'bgcolor', title: 'Backtest Background', editable: false },
];

export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'MACD-X : Trading Signal', message: 'MACD-X Trading Signal Detected\n{{exchange}}:{{ticker}}\nPrice: {{close}}\nTime: {{time}}' },
  { id: 'alert1', title: 'Long : Early Warning', message: 'MACD-X - Early Long Signal\n{{exchange}}:{{ticker}}\nPrice = {{close}}\nTime = {{time}}' },
  { id: 'alert2', title: 'Long : Confirmed', message: 'MACD-X - Confirmed Long Signal\n{{exchange}}:{{ticker}}\nPrice = {{close}}\nTime = {{time}}' },
  { id: 'alert3', title: 'Short : Early Warning', message: 'MACD-X - Early Short Signal\n{{exchange}}:{{ticker}}\nPrice = {{close}}\nTime = {{time}}' },
  { id: 'alert4', title: 'Short : Confirmed', message: 'MACD-X - Confirmed Short Signal\n{{exchange}}:{{ticker}}\nPrice = {{close}}\nTime = {{time}}' },
];

/** The backtest framework calls alert() (entries, stop loss, early warnings) */
export const hasAlertFunction = true;

export const drawingKinds: StudyDrawingKind[] = ['label', 'table'];

export const metadata = {
  title: 'MACD-X, More Than MACD by DGT',
  shortTitle: 'MACD-X ☼☾',
  overlay: false,
};

/** Milliseconds of a year in the original (365.2425 days) */
const YEAR_MS = 31556952000;

// Pine float comparisons (1e-10); na compares false
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => b - a <= EPS;
const le = (a: number, b: number) => a - b <= EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<MacdXMoreThanMacdByDgtInputs> = {},
  chart?: ChartContext,
): IndicatorResult & {
  barColors: BarColorData[]; bgColors: BgColorData[]; alerts: AlertConditionState[]; alertCalls: AlertCall[];
} {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (v: number[]) => Series.fromArray(bars, v);
  const ma = (v: number[], l: number) => A(cfg.exponential ? ta.ema(S(v), l) : ta.sma(S(v), l));
  const close = bars.map((b) => b.close);
  const volume = bars.map((b) => b.volume ?? NaN);

  // Source selection
  const source = cfg.sourceType === 'HLC3 (High + Low + Close) / 3' ? A(getSourceSeries(bars, 'hlc3'))
    : cfg.sourceType === 'On Balance Volume (OBV)' ? A(ta.obv(bars))
      : cfg.sourceType === 'Accumulation / Distribution' ? A(ta.accdist(bars))
        : cfg.sourceType === 'Price Volume Trend (PVT)' ? A(ta.pvt(bars))
          : close;

  // MACD calculations
  const fastMa = ma(source, cfg.fast_length);
  const slowMa = ma(source, cfg.slow_length);
  const macd = fastMa.map((f, i) => f - slowMa[i]);
  const sig = cfg.signal_length;
  let macdx: number[];
  if (cfg.macdType === 'MACD-TRADITIONAL') {
    macdx = macd;
  } else if (cfg.macdType === 'MACD-HISTOGRAM') {
    const m = ma(macd, sig);
    macdx = macd.map((v, i) => v - m[i]);
  } else if (cfg.macdType === 'MACD-LEADER') {
    const a = ma(source.map((s, i) => s - fastMa[i]), cfg.fast_length);
    const b = ma(source.map((s, i) => s - slowMa[i]), cfg.slow_length);
    macdx = macd.map((v, i) => v + a[i] - b[i]);
  } else if (cfg.macdType === 'MACD-SOURCE') {
    macdx = ma(source.map((s, i) => s - (fastMa[i] + slowMa[i]) / 2), sig);
  } else if (cfg.macdType === 'MACD-TRIX') {
    const e3 = A(ta.ema(ta.ema(ta.ema(S(source.map((s) => Math.log(s))), sig * 2), sig * 2), sig * 2));
    macdx = e3.map((v, i) => (i > 0 ? 10000 * (v - e3[i - 1]) : NaN));
  } else {
    macdx = new Array<number>(n).fill(NaN);
  }
  const signal = ma(macd, sig);
  const signalx = ma(macdx, sig);
  const histx = macdx.map((v, i) => v - signalx[i]);

  const highlight = cfg.macdTrdDisp || cfg.highlight;
  const rsiValue = cfg.colorRsi ? A(ta.rsi(S(source), cfg.rsiLength)) : new Array<number>(n).fill(NaN);
  const ob = cfg.rsiOverBought;
  const os = cfg.rsiOverSold;

  // TTM Squeeze (var bools: false while the add-on is off)
  const inSqz = new Array<boolean>(n).fill(false);
  const noSqz = new Array<boolean>(n).fill(false);
  const unSqz = new Array<boolean>(n).fill(false);
  if (cfg.dispSqueeze) {
    const [, bbU, bbL] = ta.bb(S(close), cfg.bbkcLength, cfg.bbMult).map(A);
    const [, kcU, kcL] = ta.kc(bars, S(close), cfg.bbkcLength, cfg.kcMult, true).map(A);
    for (let i = 0; i < n; i++) {
      inSqz[i] = gt(bbL[i], kcL[i]) && lt(bbU[i], kcU[i]);
      noSqz[i] = lt(bbL[i], kcL[i]) && gt(bbU[i], kcU[i]);
      unSqz[i] = !inSqz[i] && !noSqz[i];
    }
  }

  // Threshold bands (an if without else: na while off)
  const nan = () => new Array<number>(n).fill(NaN);
  let [upperL, lowerL, upperH, lowerH] = [nan(), nan(), nan(), nan()];
  if (cfg.hstThesh) {
    [, upperL, lowerL] = ta.bb(S(histx), 233, cfg.stDevL).map(A);
    [, upperH, lowerH] = ta.bb(S(histx), 233, cfg.stDevH).map(A);
  }

  // Volume based coloured bars
  const mean = A(ta.sma(S(volume), cfg.vwcbLen));
  const vbcbColor: string[] = [];
  const vbcbTxt: string[] = [];
  for (let i = 0; i < n; i++) {
    const v = volume[i];
    const hi = gt(v, mean[i] * cfg.vwcbUpper);
    const avg = ge(v, mean[i] * cfg.vwcbLower) && le(v, mean[i] * cfg.vwcbUpper);
    const down = lt(bars[i].close, bars[i].open);
    vbcbColor.push(hi ? (down ? DARK_RED : '#006400') : avg ? (down ? RED : TEAL) : (down ? ORANGE : '#7FFFD4'));
    vbcbTxt.push(hi ? 'High Volume' : avg ? 'Average Volume' : 'Low Volume');
  }
  /** bool(nz(volume)) */
  const hasVolume = volume.map((v) => !isNaN(v) && v !== 0);

  // Colours
  const histColor = histx.map((h, i) => {
    const growing = i > 0 && gt(h, histx[i - 1]);
    return ge(h, 0) ? (growing ? DARK_GREEN : GREEN) : (growing ? RED : DARK_RED);
  });
  const macdColor = rsiValue.map((r) => (gt(r, ob) ? DARK_RED : lt(r, os) ? DARK_GREEN : BLUE_X));

  // Crosses
  const B = (s: Series) => s.toArray().map((v) => Boolean(v));
  const cross = B(ta.cross(S(macdx), S(signalx)));
  const longAlert = B(ta.crossover(S(macdx), S(signalx)));
  const shortAlert = B(ta.crossunder(S(macdx), S(signalx)));

  // Label texts of each bar
  const ticker = tickeridOf(chart);
  const tf = chartTimeframe(bars, chart);
  const status = cfg.histLabel > 0
    ? '\n\nHistorical Bar Readings - ' + str.tostring(cfg.histLabel) + ' bar(s) earlier' : '\n\nCurrent Bar Readings';
  const lastCross = A(ta.valuewhen(S(cross.map(Number)), S(bars.map((_b, i) => i)), 0));
  const macdText: string[] = [];
  const rsiText: string[] = [];
  const sqzText: (string | null)[] = [];
  const vbcbText: (string | null)[] = [];
  for (let i = 0; i < n; i++) {
    const msCross = isNaN(lastCross[i]) ? NaN : i - lastCross[i];
    const mom = i > 0 && le(histx[i] - histx[i - 1], 0) ? 'Falling - Last Signal Cross ' : 'Growing - Last Signal Cross ';
    macdText.push('Method : ' + cfg.macdType + '\nSource : ' + cfg.sourceType + status + '\nMACD\t: ' + mom
      + str.tostring(msCross) + ' bar(s)');
    const r = rsiValue[i];
    const rsiState = ge(r, ob) ? 'OverBought Zone' : le(r, os) ? 'OverSold Zone' : gt(r, 60) ? 'Bullish Zone'
      : lt(r, 40) ? 'Bearish Zone' : 'Neutral Zone';
    rsiText.push('\nRSI\t: Value ' + str.tostring(r, '#.#') + ' - ' + rsiState);
    sqzText.push(cfg.dispSqueeze
      ? (inSqz[i] ? '\nSQZ  : Compression Phase (No Trade Zone)' : unSqz[i] ? '\nSQZ  : Release Phase'
        : ge(histx[i], 0) ? '\nSQZ  : Bullish Momentum' : '\nSQZ  : Bearish Momentum')
      : null);
    vbcbText.push(hasVolume[i] && cfg.vbcb
      ? '\nVolume : ' + vbcbTxt[i] + ' (' + str.tostring(volume[i], 'volume') + ')' : null);
  }
  /** x[histLabel] of a string series; an na string adds nothing to the text */
  const at = (arr: (string | null)[], i: number) => (i - cfg.histLabel >= 0 ? arr[i - cfg.histLabel] ?? '' : '');

  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];
  const bgColors: BgColorData[] = [];
  const fill0: string[] = [];
  const plot9: { time: number; value: number; color: string }[] = [];
  const alertCalls: AlertCall[] = [];

  // Backtest state (one-element arrays of the original)
  let dir = 0;
  let entry = 0;
  let exitPrice = 0;
  let cap = cfg.dasCapital;
  let trades = 0;
  let winL = 0;
  let lossL = 0;
  let winS = 0;
  let lossS = 0;
  const stopLoss = cfg.stopLoss / 100;
  const mintick = mintickOf(chart);
  const now = nowOf(chart);
  let years = NaN;
  let prevStart = false;
  let prevValueLabel: Label | undefined;
  const wLabel = varDrawing<Label>();
  let wLabelPrev: Label | undefined;
  const statLbl = varDrawing<Label>();

  resetDrawings({ label: 50 });
  const logo = table.new('bottom_right', 1, 1);
  const logo2 = table.new('bottom_right', 1, 1, undefined, undefined, undefined, undefined, undefined, true);

  const fOpen = (i: number, d: number, lbl: boolean) => {
    const b = bars[i];
    entry = b.open;
    dir = d;
    trades += 1;
    if (lbl) {
      label.new(i, d === 1 ? b.low : b.high, d === 1 ? 'L' : 'S', 'bar_index', 'price', d === 1 ? TEAL : RED,
        d === 1 ? 'label_up' : 'label_down', WHITE, 'tiny', undefined,
        'Direction .... : ' + (d === 1 ? 'Long' : 'Short') + '\n'
        + 'Entry price .. : ' + str.tostring(b.open) + '\n'
        + 'Capital ...... : ' + str.tostring(cap, '#.##'), undefined, true);
    }
  };
  const fClose = (i: number, isSL: boolean, lbl: boolean) => {
    const b = bars[i];
    const d = dir;
    const ep = entry;
    const xp = isSL ? b.close : b.open;
    exitPrice = xp;
    const entrySafe = Math.max(ep, mintick);
    const exitSafe = Math.max(xp, mintick);
    const pnl = d === 1 ? exitSafe / entrySafe : entrySafe / exitSafe;
    const newCap = cap * pnl;
    const profit = gt(pnl, 1);
    cap = newCap;
    if (d === 1) {
      winL += profit ? 1 : 0;
      lossL += profit ? 0 : 1;
    } else {
      winS += profit ? 1 : 0;
      lossS += profit ? 0 : 1;
    }
    if (lbl) {
      label.new(i, d === 1 ? b.high : b.low, isSL ? 'SL' : 'TP', 'bar_index', 'price', profit ? TEAL : RED,
        d === 1 ? 'label_down' : 'label_up', WHITE, 'tiny', undefined,
        'Exit type .... : ' + (isSL ? 'Stop Loss' : 'Take Profit') + '\n'
        + 'Direction .... : ' + (d === 1 ? 'Long' : 'Short') + '\n'
        + 'Entry / Exit . : ' + str.tostring(ep) + ' / ' + str.tostring(xp) + '\n'
        + 'Change ....... : ' + str.tostring((pnl - 1) * 100, '#.##') + '%\n'
        + 'Capital ...... : ' + str.tostring(newCap, '#.##'), undefined, true);
    }
    dir = 0;
  };
  const alertCall = (i: number, message: string) => {
    alertCalls.push({ time: bars[i].time, message: message + str.tostring(bars[i].close), freq: 'once_per_bar' });
  };
  const get = (arr: boolean[], k: number) => k >= 0 && arr[k];

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const t = b.time;

    fill0.push(highlight
      ? (gt(macdx[i], signalx[i])
        ? (gt(rsiValue[i], ob) ? FILL_COLORS[0] : lt(rsiValue[i], os) ? FILL_COLORS[1] : FILL_COLORS[2])
        : (gt(rsiValue[i], ob) ? FILL_COLORS[0] : lt(rsiValue[i], os) ? FILL_COLORS[1] : FILL_COLORS[3]))
      : 'transparent');

    if (cfg.dispSqueeze && (unSqz[i] || inSqz[i])) {
      markers.push({ id: 'shape0', time: t, position: 'top', shape: 'diamond', color: GRAY });
    }
    if (cfg.dispSqueeze && noSqz[i] && ge(histx[i], 0)) {
      markers.push({ id: 'shape1', time: t, position: 'top', shape: 'triangleUp', color: TEAL });
    }
    if (cfg.dispSqueeze && noSqz[i] && lt(histx[i], 0)) {
      markers.push({ id: 'shape2', time: t, position: 'top', shape: 'triangleDown', color: RED });
    }

    // Value label: a new one on every bar at time + 3 bar intervals, the one of the bar before deleted
    if (cfg.dispLabel && !cfg.isBackTest) {
      const tMs = t * 1000;
      const change = i > 0 ? tMs - bars[i - 1].time * 1000 : NaN;
      const l = label.new(tMs, 0, at(macdText, i) + at(rsiText, i) + at(sqzText, i) + at(vbcbText, i), 'bar_time',
        'price', BLUE_X, 'label_left', WHITE, undefined, 'left',
        'evaluation given herein does not constitute professional and/or financial advice');
      label.set_x(l, label.get_x(l) + Math.round(change * 3));
      if (prevValueLabel) label.delete(prevValueLabel);
      prevValueLabel = l;
    }

    if (hasVolume[i] && cfg.vbcb) barColors.push({ id: 'barcolor0', time: t, color: vbcbColor[i] });

    // Backtest framework
    const startBckTst = gt(t * 1000, now - cfg.lenBckTst * YEAR_MS);
    if (cfg.isBackTest) {
      const sigL = cfg.isTest ? get(longAlert, i - 1) : get(longAlert, i - 2);
      const sigS = cfg.isTest ? get(shortAlert, i - 1) : get(shortAlert, i - 2);
      const ref = cfg.isTest ? i : i - 1;
      const conflict = get(longAlert, ref) && get(shortAlert, ref);
      const rb = ref >= 0 ? bars[ref] : undefined;
      const okL = (!cfg.useCandleL || (rb !== undefined && gt(rb.close, rb.open))) && (!cfg.isSudden || !conflict);
      const okS = (!cfg.useCandleS || (rb !== undefined && lt(rb.close, rb.open))) && (!cfg.isSudden || !conflict);
      const longCond = sigL && okL;
      const shortCond = sigS && okS;
      const canLong = cfg.tradeMode !== 'Short Only';
      const canShort = cfg.tradeMode !== 'Long Only';
      const slL = cfg.isStopLoss && dir === 1 && le(b.low, entry * (1 - stopLoss));
      const slS = cfg.isStopLoss && dir === -1 && ge(b.high, entry * (1 + stopLoss));
      const slHit = slL || slS;

      if (startBckTst) {
        let reversed = false;
        if (cfg.reverseOnSignal && cfg.tradeMode === 'Both') {
          if (dir === 1 && shortCond) {
            fClose(i, false, cfg.lblInOutSL);
            if (canShort) fOpen(i, -1, cfg.lblInOutSL);
            reversed = true;
          } else if (dir === -1 && longCond) {
            fClose(i, false, cfg.lblInOutSL);
            if (canLong) fOpen(i, 1, cfg.lblInOutSL);
            reversed = true;
          }
        }
        if (!reversed) {
          const exitL = dir === 1 && (shortCond || slHit);
          const exitS = dir === -1 && (longCond || slHit);
          if (exitL || exitS) fClose(i, slHit, cfg.lblInOutSL);
        }
        if (dir === 0) {
          if (longCond && canLong) {
            fOpen(i, 1, cfg.lblInOutSL);
            alertCall(i, 'Long entry — ' + ticker + ' | Price: ');
          }
          if (shortCond && canShort) {
            fOpen(i, -1, cfg.lblInOutSL);
            alertCall(i, 'Short entry — ' + ticker + ' | Price: ');
          }
        }
        if (slHit) alertCall(i, 'Stop loss — ' + ticker + ' | Price: ');
      }

      if (cfg.lblWarnings) {
        if (canLong && dir !== 1 && get(longAlert, i - 1) && !shortAlert[i]) {
          wLabel.value = label.new(i, b.low, '⚠️', 'bar_index', 'price', TEAL, 'none', WHITE, 'large', undefined,
            'Probable long entry — awaiting confirmation\nIf confirmed, trade executes at next bar open.', undefined, true);
          if (wLabelPrev) label.delete(wLabelPrev);
          alertCall(i, 'Long early warning — ' + ticker + ' | Price: ');
        }
        if (canShort && dir !== -1 && get(shortAlert, i - 1) && !longAlert[i]) {
          wLabel.value = label.new(i, b.high, '⚠️', 'bar_index', 'price', RED, 'none', WHITE, 'large', undefined,
            'Probable short entry — awaiting confirmation\nIf confirmed, trade executes at next bar open.', undefined, true);
          if (wLabelPrev) label.delete(wLabelPrev);
          alertCall(i, 'Short early warning — ' + ticker + ' | Price: ');
        }
        // bool(ta.change(time)): true on every bar after the first
        if (i > 0 && wLabelPrev) label.delete(wLabelPrev);
      }

      if (cfg.lblTrdStat) {
        if (isNaN(years)) years = (now - t * 1000) / YEAR_MS;
        const totalWin = winL + winS;
        const totalLoss = lossL + lossS;
        const estimated = dir === 1 ? cap * (b.close / entry) : dir === -1 ? cap * (entry / b.close) : cap;
        const winRate = trades > 0 ? totalWin / trades * 100 : 0;
        const gainPct = (estimated / cfg.dasCapital - 1) * 100;
        const tradeDirTxt = dir === 1 ? 'Long' : dir === -1 ? 'Short' : 'Flat';
        const short = lt(years, cfg.lenBckTst);
        const perTxt = short
          ? str.tostring(cfg.lenBckTst, '#.##') + ' Yrs *** (' + str.tostring(i) + ' bars max)'
          : str.tostring(cfg.lenBckTst, '#.##') + ' Year(s)';
        const slTxt = cfg.isStopLoss
          ? str.tostring(stopLoss * 100, '#.#') + '% — level: '
            + str.tostring(dir === 1 ? entry * (1 - stopLoss) : dir === -1 ? entry * (1 + stopLoss) : 0, '#.##')
          : 'Off';
        const sep = '\n═════════════════════════════════════';
        const txt = '☼☾ Trade Statistics | ' + tf + ' | ' + perTxt + ' | Trade Mode : ' + cfg.tradeMode + sep
          + '\nWin Rate : ' + str.tostring(winRate, '#.#') + '%' + ' | Trades : ' + str.tostring(trades)
          + '\nWin/Loss : ' + str.tostring(totalWin) + '/' + str.tostring(totalLoss)
          + ' | Long  W/L : ' + str.tostring(winL) + '/' + str.tostring(lossL)
          + ' | Short W/L : ' + str.tostring(winS) + '/' + str.tostring(lossS) + sep
          + '\nGain/Loss : ' + str.tostring(gainPct, '#.##') + '%'
          + ' | Initial/Final Capital : ' + str.tostring(cfg.dasCapital, '#.##') + '/' + str.tostring(estimated, '#.##') + sep
          + '\nStatus : ' + tradeDirTxt
          + (dir !== 0
            ? ' | Entry Price : ' + str.tostring(entry) + ' | Unrealized : ' + str.tostring((estimated / cap - 1) * 100, '#.##')
              + '%' + '\nStop Loss : ' + slTxt
            : '')
          + (short ? '\n*** max available history for this timeframe' : '');
        const statCol = gt(gainPct, 0) ? TEAL : lt(gainPct, 0) ? RED : GRAY;
        if (statLbl.value) label.delete(statLbl.value);
        statLbl.value = label.new(i + 5, b.close, txt, 'bar_index', 'price', statCol, 'label_left', WHITE, 'small', 'left',
          undefined, undefined, true);
      }
      wLabelPrev = wLabel.value;
    }

    // Backtest background: gray on the first bar of the period (startBckTst[1] is false on bar 0)
    if (cfg.isBackTest && startBckTst) {
      const c = startBckTst !== prevStart ? String(color.new(GRAY, 90))
        : dir === 1 ? String(color.new(TEAL, 92)) : dir === -1 ? String(color.new(RED, 92)) : null;
      if (c) bgColors.push({ id: 'bgcolor0', time: t, color: c });
    }
    prevStart = startBckTst;

    plot9.push({
      time: t,
      value: dir !== 0 ? entry : gt(exitPrice, 0) ? exitPrice : NaN,
      color: dir === 1 ? TEAL : dir === -1 ? RED : GRAY,
    });

    if (i === n - 1) {
      table.cell(logo, 0, 0, '☼☾  ', 0, 0, TEAL, undefined, undefined, 'normal', undefined, 'SoleMare Analytics');
      table.cell(logo2, 0, 0, '☼☾  ', 0, 0, TEAL, undefined, undefined, 'normal', undefined, 'SoleMare Analytics');
    }
  }
  setDrawingBar(null);

  const points = (v: number[], colors?: string[]) =>
    v.map((value, i) => (colors ? { time: bars[i].time, value, color: colors[i] } : { time: bars[i].time, value }));
  const show = (on: boolean, v: number[]) => (on ? v : nan());
  const fills: FillData[] = [
    { id: 'fill0', plot1: 'plot1', plot2: 'plot2', options: { title: 'Plots Background' }, colors: fill0 },
    { id: 'fill1', plot1: 'plot5', plot2: 'plot6', options: { title: 'Overbought Zone' }, colors: new Array<string>(n).fill(OB_ZONE) },
    { id: 'fill2', plot1: 'plot7', plot2: 'plot8', options: { title: 'Oversold Zone' }, colors: new Array<string>(n).fill(OS_ZONE) },
  ];
  // alertcondition(barstate.islast ? alarm[1] : alarm, ...)
  const alarm = cross.map((c, i) => (i === n - 1 ? get(cross, i - 1) : c));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: points(histx, histColor),
      plot1: points(macdx, macdColor),
      plot2: points(signalx),
      plot3: points(show(cfg.macdTrdDisp, macd)),
      plot4: points(show(cfg.macdTrdDisp, signal)),
      plot5: points(upperL),
      plot6: points(upperH),
      plot7: points(lowerL),
      plot8: points(lowerH),
      plot9,
    },
    fills,
    markers,
    barColors,
    bgColors,
    ...drawingOutputs(bars),
    alerts: alertStates(alertConditions, bars, [
      alarm, longAlert, longAlert.map((_v, i) => get(longAlert, i - 1)),
      shortAlert, shortAlert.map((_v, i) => get(shortAlert, i - 1)),
    ]),
    alertCalls,
  };
}

export const MacdXMoreThanMacdByDgt = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  fillConfig,
  shapeConfig,
  barColorConfig,
  alertConditions,
  drawingKinds,
  hasAlertFunction,
};
