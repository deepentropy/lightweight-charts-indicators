/**
 * Machine Learning Supertrend
 *
 * A supertrend on a price basis (hlcc4 by default) whose band width (x ATR) and ATR period adapt bar by bar. The ATR
 * is a variable-length RMA (or EMA) of the true range. The adaptive engine keeps a rolling book of 5 synthetic long
 * and 5 synthetic short probes opened at the bar open and closed after 5 bars; their ATR-normalised returns and
 * adverse excursions give win rates, mean returns and Sortino ratios that nudge the band width and the ATR period
 * (capped steps set by "Reactivity", a deadband, a cooldown and a periodic pull back to the inputs). A regime grid
 * (trend regime from directional entropy, rescaled-range Hurst and ADX, against the ATR(14) / SMA(100) volatility
 * ratio) remembers the parameter changes that worked in each cell and blends them back in.
 *
 * Outputs: the trend line (teal up, red down), a six-layer cloud between the trend line and the close, the pivot
 * rails (highest high / lowest low of the pivot window, 3 bars back) with a dot on each raw break, an optional
 * key-level channel, gradient bar colours by the distance from the trend line, "Buy" / "Sell" labels (Reversal mode:
 * the latch of a fresh extreme is released by a flip; Breakout mode: a fresh extreme with the trend; filtered by RSI
 * memory, volume, key levels, 200 EMA, spacing), price tags of the rails and a dashboard on the last bar.
 *
 * Chart values (optional third argument of calculate): the rail price tags use the symbol tick, the alert() texts
 * the ticker, and the adaptive engine and the signals skip the last bar when it is still open (barstate.isconfirmed).
 *
 * Reference: "Machine Learning Supertrend [Aslan]" by Zimord
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, str, color, Series, getSourceSeries, label, table, resetDrawings, setDrawingBar, varDrawing, drawingOutputs,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type FillConfig, type FillData,
  type ShapeConfig, type BarColorConfig, type SourceType, type Label,
} from 'oakscriptjs';
import type { AlertCall, BarColorData, MarkerData } from '../types';
import { lastBarConfirmedOf, mintickOf, tickerOf, type ChartContext } from '../chart-context';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { StudyDrawingKind } from '../style-outputs';

export interface MachineLearningSupertrendInputs {
  bullCol: string;
  bearCol: string;
  /** Low-volatility and grid-confidence readouts of the dashboard */
  accentCol: string;
  neutCol: string;
  sigMode: 'Reversal' | 'Breakout';
  pivotWin: number;
  needFresh: boolean;
  sigSpacing: number;
  confirmOnly: boolean;
  showSigLabel: boolean;
  baseAtrLen: number;
  baseMult: number;
  srcType: 'close' | 'hl2' | 'hlc3' | 'ohlc4' | 'hlcc4';
  useRMA: boolean;
  showTrendLn: boolean;
  useRSI: boolean;
  rsiLen: number;
  rsiHi: number;
  rsiLo: number;
  rsiMem: number;
  useVol: boolean;
  volLen: number;
  volMult: number;
  useMajor: boolean;
  majorATR: number;
  useBias: boolean;
  adaptOn: boolean;
  reactivity: number;
  learnRate: number;
  rollN: number;
  winHi: number;
  winLo: number;
  updEvery: number;
  deadband: number;
  revertEvery: number;
  revertStep: number;
  useGrid: boolean;
  gridX: number;
  gridY: number;
  gridSigma: number;
  gridHalf: number;
  gridConfN: number;
  gridMaxW: number;
  volCeil: number;
  regEvery: number;
  showCloud: boolean;
  cloudFade: number;
  showBarCol: boolean;
  showRails: boolean;
  railFade: number;
  railDim: boolean;
  showRailFill: boolean;
  showRailDot: boolean;
  showRailTag: boolean;
  showDash: boolean;
  dashPos: 'Top Right' | 'Middle Right' | 'Bottom Right' | 'Bottom Left' | 'Top Left';
  dashSize: 'Tiny' | 'Small' | 'Normal';
}

export const defaultInputs: MachineLearningSupertrendInputs = {
  bullCol: '#089981',
  bearCol: '#F23645',
  accentCol: '#4d9fff',
  neutCol: '#787b86',
  sigMode: 'Reversal',
  pivotWin: 30,
  needFresh: true,
  sigSpacing: 10,
  confirmOnly: true,
  showSigLabel: true,
  baseAtrLen: 24,
  baseMult: 1.4,
  srcType: 'hlcc4',
  useRMA: true,
  showTrendLn: true,
  useRSI: true,
  rsiLen: 14,
  rsiHi: 70,
  rsiLo: 30,
  rsiMem: 50,
  useVol: false,
  volLen: 3,
  volMult: 1.2,
  useMajor: false,
  majorATR: 4.5,
  useBias: false,
  adaptOn: true,
  reactivity: 10,
  learnRate: 0.25,
  rollN: 30,
  winHi: 0.62,
  winLo: 0.38,
  updEvery: 3,
  deadband: 0.01,
  revertEvery: 200,
  revertStep: 0.02,
  useGrid: true,
  gridX: 8,
  gridY: 8,
  gridSigma: 0.8,
  gridHalf: 50,
  gridConfN: 20,
  gridMaxW: 0.65,
  volCeil: 2.5,
  regEvery: 7,
  showCloud: true,
  cloudFade: 78,
  showBarCol: true,
  showRails: true,
  railFade: 30,
  railDim: true,
  showRailFill: false,
  showRailDot: true,
  showRailTag: true,
  showDash: true,
  dashPos: 'Bottom Right',
  dashSize: 'Small',
};

const G0 = '◇ 0 · Palette';
const G1 = '◆ 1 · Signal Engine';
const G2 = '◆ 2 · Volatility Envelope';
const G3 = '◆ 3 · Filters';
const G4 = '◆ 4 · Adaptive Core';
const G5 = '◆ 5 · Context Memory';
const G6 = '◆ 6 · Overlays';
const G7 = '◆ 7 · Dashboard';

export const inputConfig: InputConfig[] = [
  { id: 'bullCol', type: 'color', title: 'Bull', defval: '#089981', group: G0, inline: 'p1' },
  { id: 'bearCol', type: 'color', title: 'Bear', defval: '#F23645', group: G0, inline: 'p1' },
  { id: 'accentCol', type: 'color', title: 'Accent', defval: '#4d9fff', group: G0, inline: 'p1', tooltip: 'Used for low-volatility and grid-confidence readouts on the dashboard.' },
  { id: 'neutCol', type: 'color', title: 'Neutral', defval: '#787b86', group: G0, inline: 'p1' },
  { id: 'sigMode', type: 'string', title: 'Mode', defval: 'Reversal', options: ['Reversal', 'Breakout'], group: G1, tooltip: 'Reversal: fires when a trend exhausts at a fresh extreme and the band flips. Breakout: fires when price pushes into a new extreme WITH the trend. Opposite premises - pick one and tune for it.' },
  { id: 'pivotWin', type: 'int', title: 'Pivot Window', defval: 30, min: 5, max: 400, group: G1, tooltip: 'Bars scanned for new highs and lows. Lower reacts to minor swings, higher only to structural moves.' },
  { id: 'needFresh', type: 'bool', title: 'Require Fresh Pivot', defval: true, group: G1, tooltip: 'Reversal mode only. Demands a genuine new extreme during the trend before a flip counts as a signal.' },
  { id: 'sigSpacing', type: 'int', title: 'Min Bars Between Signals', defval: 10, min: 1, max: 500, group: G1 },
  { id: 'confirmOnly', type: 'bool', title: 'Confirmed Bars Only', defval: true, group: G1, tooltip: 'ON: signals only latch on bar close, nothing repaints intrabar. OFF: signals appear live and can vanish. Leave ON unless you have a reason.' },
  { id: 'showSigLabel', type: 'bool', title: 'Show Signal Labels', defval: true, group: G1 },
  { id: 'baseAtrLen', type: 'int', title: 'ATR Period', defval: 24, min: 5, max: 300, group: G2 },
  { id: 'baseMult', type: 'float', title: 'Band Width (xATR)', defval: 1.4, min: 0.3, max: 6.0, step: 0.05, group: G2, tooltip: 'The single most impactful setting. Wider bands flip less often and give fewer, higher-conviction signals.' },
  { id: 'srcType', type: 'string', title: 'Price Basis', defval: 'hlcc4', options: ['close', 'hl2', 'hlc3', 'ohlc4', 'hlcc4'], group: G2 },
  { id: 'useRMA', type: 'bool', title: 'RMA Smoothing', defval: true, group: G2, tooltip: 'OFF switches to EMA - faster reaction to volatility spikes, noisier bands.' },
  { id: 'showTrendLn', type: 'bool', title: 'Show Trend Line', defval: true, group: G2 },
  { id: 'useRSI', type: 'bool', title: 'Momentum Filter', defval: true, group: G3, tooltip: 'In Reversal mode a long needs RSI to have been recently oversold. In Breakout mode the polarity inverts - a long needs RSI to have been recently HOT, because you are buying strength, not exhaustion.' },
  { id: 'rsiLen', type: 'int', title: '  RSI Length', defval: 14, min: 2, max: 50, group: G3 },
  { id: 'rsiHi', type: 'int', title: '  Hot / Cold Level', defval: 70, min: 55, max: 90, group: G3, inline: 'rl' },
  { id: 'rsiLo', type: 'int', title: '', defval: 30, min: 10, max: 45, group: G3, inline: 'rl' },
  { id: 'rsiMem', type: 'int', title: '  Zone Memory (bars)', defval: 50, min: 1, max: 400, group: G3, tooltip: 'How far back RSI must have visited the hot or cold zone for the filter to pass.' },
  { id: 'useVol', type: 'bool', title: 'Require Volume Surge', defval: false, group: G3, tooltip: 'Cuts signal count hard. Useless on synthetic symbols and most FX feeds, where volume is a tick count.' },
  { id: 'volLen', type: 'int', title: '  Baseline Depth', defval: 3, min: 1, max: 300, group: G3 },
  { id: 'volMult', type: 'float', title: '  Surge Threshold', defval: 1.2, min: 0.1, max: 5.0, step: 0.1, group: G3 },
  { id: 'useMajor', type: 'bool', title: 'Key Levels Only', defval: false, group: G3, tooltip: 'Only allows signals where the pivot-window range spans a large ATR multiple. Swing-trader setting.' },
  { id: 'majorATR', type: 'float', title: '  Key Level Depth (xATR)', defval: 4.5, min: 1.0, max: 20.0, step: 0.1, group: G3 },
  { id: 'useBias', type: 'bool', title: 'Require Trend Alignment', defval: false, group: G3, tooltip: 'Blocks counter-trend signals using the 200 EMA. In Reversal mode this is self-contradictory by construction and will suppress most turning points. Intended for Breakout mode.' },
  { id: 'adaptOn', type: 'bool', title: 'Enable Auto-Tune', defval: true, group: G4, tooltip: 'OFF: a conventional fixed-parameter supertrend using your inputs verbatim, fully reproducible. ON: the probe engine drifts band width, ATR period, stop and target from rolling probe outcomes.' },
  { id: 'reactivity', type: 'int', title: 'Reactivity (1-20)', defval: 10, min: 1, max: 20, group: G4, tooltip: 'Meta-dial. Sets per-update caps, deadband and blend alpha in one move. 1 = glacial, 20 = twitchy.' },
  { id: 'learnRate', type: 'float', title: 'Step Size', defval: 0.25, min: 0.01, max: 0.5, step: 0.01, group: G4 },
  { id: 'rollN', type: 'int', title: 'Probe Memory (per side)', defval: 30, min: 5, max: 500, group: G4, tooltip: 'Rolling window of probe outcomes feeding win rate, mean return and Sortino. Longer is more stable and slower to react.' },
  { id: 'winHi', type: 'float', title: 'Win Ceiling', defval: 0.62, min: 0.5, max: 1.0, step: 0.01, group: G4, inline: 'w' },
  { id: 'winLo', type: 'float', title: 'Floor', defval: 0.38, min: 0.0, max: 0.5, step: 0.01, group: G4, inline: 'w' },
  { id: 'updEvery', type: 'int', title: 'Update Cooldown (bars)', defval: 3, min: 1, max: 100, group: G4 },
  { id: 'deadband', type: 'float', title: 'Deadband', defval: 0.01, min: 0, max: 0.2, step: 0.005, group: G4, tooltip: 'A proposed band-width change must exceed this before it is applied. Kills micro-jitter.' },
  { id: 'revertEvery', type: 'int', title: 'Anchor Revert Interval', defval: 200, min: 10, max: 5000, group: G4, tooltip: 'Every N bars the adapted parameters are pulled a fraction back toward your base inputs. Stops unbounded drift.' },
  { id: 'revertStep', type: 'float', title: 'Anchor Revert Strength', defval: 0.02, min: 0.001, max: 0.2, step: 0.001, group: G4 },
  { id: 'useGrid', type: 'bool', title: 'Enable Regime Grid', defval: true, group: G5, tooltip: '2D map of (trend regime x volatility). Remembers which parameter shifts worked in each cell and reapplies them when the market returns to a familiar state.' },
  { id: 'gridX', type: 'int', title: 'Regime Bins', defval: 8, min: 4, max: 16, group: G5, inline: 'g' },
  { id: 'gridY', type: 'int', title: 'Vol Bins', defval: 8, min: 4, max: 16, group: G5, inline: 'g' },
  { id: 'gridSigma', type: 'float', title: 'Neighbour Blend', defval: 0.8, min: 0.2, max: 2.0, step: 0.05, group: G5, tooltip: 'Gaussian sigma in bin units. Higher smooths across sparse neighbouring cells.' },
  { id: 'gridHalf', type: 'int', title: 'Decay Half-Life (probes)', defval: 50, min: 10, max: 400, group: G5 },
  { id: 'gridConfN', type: 'int', title: 'Confidence Ramp (probes)', defval: 20, min: 5, max: 200, group: G5, tooltip: 'Probes needed for a cell to reach roughly 63% confidence.' },
  { id: 'gridMaxW', type: 'float', title: 'Max Grid Influence', defval: 0.65, min: 0.1, max: 0.9, step: 0.05, group: G5 },
  { id: 'volCeil', type: 'float', title: 'Vol Ratio Ceiling', defval: 2.5, min: 1.0, max: 5.0, step: 0.1, group: G5 },
  { id: 'regEvery', type: 'int', title: 'Regime Refresh (bars)', defval: 7, min: 1, max: 50, group: G5, tooltip: 'The Hurst and entropy loops are the most expensive thing in this script. Refreshing every bar buys almost nothing.' },
  { id: 'showCloud', type: 'bool', title: 'Trend Cloud', defval: true, group: G6, inline: 'v1' },
  { id: 'cloudFade', type: 'int', title: '', defval: 78, min: 40, max: 95, group: G6, inline: 'v1', tooltip: 'Transparency of the densest cloud layer. The gradient fades upward from here.' },
  { id: 'showBarCol', type: 'bool', title: 'Gradient Bar Colour', defval: true, group: G6, tooltip: 'Bar tint scales with distance from the trend line in ATR units. Driven by the same supertrend state, so it is part of the trend display rather than a separate overlay.' },
  { id: 'showRails', type: 'bool', title: 'Pivot Rails', defval: true, group: G6, inline: 'r1', tooltip: 'Plots pivHi[pivBack] and pivLo[pivBack] - the exact two levels newHigh and newLow test against. These lag the running extreme by pivBack bars, which is what makes them crossable. The un-offset ta.highest/ta.lowest series can never be broken by definition, so it is not what is drawn here.' },
  { id: 'railFade', type: 'int', title: '', defval: 30, min: 0, max: 90, group: G6, inline: 'r1' },
  { id: 'railDim', type: 'bool', title: '    Dim Dormant Side', defval: true, group: G6, tooltip: 'Only one rail is armed at a time. In BOTH modes the upper rail is live during an uptrend and the lower during a downtrend - topLatch requires trendUp, botLatch requires not trendUp, and Breakout mode gates rawLong/rawShort identically. The dormant rail fades rather than disappears so you can still see where it sits.' },
  { id: 'showRailFill', type: 'bool', title: '    Key-Level Channel', defval: false, group: G6, tooltip: 'Shades the pivot range, tinted when pivHi - pivLo clears majorATR x ATR. That span is an UPPER BOUND on the two per-side spans Key Levels Only actually tests, so grey means neither side can pass and tinted means one might. Only informative with that filter on.' },
  { id: 'showRailDot', type: 'bool', title: '    Mark Raw Breaks', defval: true, group: G6, tooltip: 'Dots every newHigh / newLow - the raw trigger BEFORE the section 3 filters run. A dot with no signal label means a filter vetoed it.' },
  { id: 'showRailTag', type: 'bool', title: '    Price Tags', defval: true, group: G6 },
  { id: 'showDash', type: 'bool', title: 'Show Dashboard', defval: true, group: G7 },
  { id: 'dashPos', type: 'string', title: 'Position', defval: 'Bottom Right', options: ['Top Right', 'Middle Right', 'Bottom Right', 'Bottom Left', 'Top Left'], group: G7 },
  { id: 'dashSize', type: 'string', title: 'Text Size', defval: 'Small', options: ['Tiny', 'Small', 'Normal'], group: G7 },
];

export const plotConfig: PlotConfig[] = [
  ...[0, 1, 2, 3, 4, 5, 6].map((k) => ({
    id: `plot${k}`, title: `cloud${k}`, color: '#2962ff', lineWidth: 1, display: 'none' as const, editable: false,
  })),
  { id: 'plot7', title: 'Trend ▲', color: '#089981', lineWidth: 2, style: 'linebr' },
  { id: 'plot8', title: 'Trend ▼', color: '#F23645', lineWidth: 2, style: 'linebr' },
  { id: 'plot9', title: 'Rail ▲', color: String(color.new('#F23645', 30)), lineWidth: 1, style: 'stepline' },
  { id: 'plot10', title: 'Rail ▼', color: String(color.new('#089981', 30)), lineWidth: 1, style: 'stepline' },
];

export const fillConfig: FillConfig[] = [
  ...[0, 1, 2, 3, 4, 5].map((k) => ({
    id: `fill${k}`, plot1: `plot${k}`, plot2: `plot${k + 1}`, title: `Cloud L${k + 1}`,
  })),
  { id: 'fill6', plot1: 'plot9', plot2: 'plot10', title: 'Rail Channel' },
];

export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Break ▲', style: 'xcross', location: 'abovebar', color: '#F23645', size: 'tiny' },
  { id: 'shape1', kind: 'shape', title: 'Break ▼', style: 'xcross', location: 'belowbar', color: '#089981', size: 'tiny' },
];

export const barColorConfig: BarColorConfig[] = [{ id: 'barcolor0', kind: 'barcolor', title: 'Gradient Bars' }];

export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'ML Supertrenmd [Aslan] Long', message: 'ML Supertrenmd [Aslan] Long signal on {{ticker}} @ {{close}}' },
  { id: 'alert1', title: 'ML Supertrenmd [Aslan] Short', message: 'ML Supertrenmd [Aslan] Short signal on {{ticker}} @ {{close}}' },
  { id: 'alert2', title: 'ML Supertrenmd [Aslan] Flip Up', message: 'ML Supertrenmd [Aslan] trend flipped bullish on {{ticker}}' },
  { id: 'alert3', title: 'ML Supertrenmd [Aslan] Flip Down', message: 'ML Supertrenmd [Aslan] trend flipped bearish on {{ticker}}' },
];

export const hasAlertFunction = true;

export const drawingKinds: StudyDrawingKind[] = ['label', 'table'];

export const metadata = {
  title: 'Machine Learning Supertrend [Aslan]',
  shortTitle: 'Machine Learning Supertrend [Aslan]',
  overlay: true,
};

// Pine float comparisons (1e-10); na compares false
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => a - b > -EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const neq = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !eq(a, b);
const nz = (x: number, y = 0) => (Number.isNaN(x) ? y : x);
/** clamp(v, lo, hi) => math.max(lo, math.min(hi, v)): na stays na */
const clamp = (v: number, lo: number, hi: number) => (Number.isNaN(v) ? NaN : Math.max(lo, Math.min(hi, v)));
/** Pine math.round: half away from zero */
const pround = (x: number) => (x < 0 ? -Math.round(-x) : Math.round(x));

interface GCell { mean: number; count: number; conf: number; dMult: number; dLen: number }
interface Probe { entry: number; bar: number; dir: number; live: boolean; atr0: number; mae: number }

const HOLD = 5;
const SLOTS = 5;
const REG_LEN = 64;

export function calculate(
  bars: Bar[],
  inputs: Partial<MachineLearningSupertrendInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { alerts: AlertConditionState[]; alertCalls: AlertCall[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const { bullCol, bearCol, accentCol, neutCol, pivotWin, rsiMem, gridX, gridY } = cfg;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const close = bars.map((b) => b.close);
  const closeS = getSourceSeries(bars, 'close');
  const src = A(getSourceSeries(bars, cfg.srcType as SourceType));

  const atr14 = A(ta.atr(bars, 14));
  const atrAvg = A(ta.sma(Series.fromArray(bars, atr14), 100));
  const ema200 = A(ta.ema(closeS, 200));
  const rsiVal = A(ta.rsi(closeS, cfg.rsiLen));
  const volAvg = A(ta.sma(getSourceSeries(bars, 'volume'), cfg.volLen));
  const adxRaw = A(ta.dmi(bars, 14, 14)[2]);
  const regMean = A(ta.sma(closeS, REG_LEN));
  const regStd = A(ta.stdev(closeS, REG_LEN));
  const regDev = close.map((c, i) => c - regMean[i]);
  const barsColdRSI = A(ta.barssince(Series.fromArray(bars, rsiVal.map((r) => (lt(r, cfg.rsiLo) ? 1 : 0)))));
  const barsHotRSI = A(ta.barssince(Series.fromArray(bars, rsiVal.map((r) => (gt(r, cfg.rsiHi) ? 1 : 0)))));
  const pivHi = A(ta.highest(getSourceSeries(bars, 'high'), pivotWin));
  const pivLo = A(ta.lowest(getSourceSeries(bars, 'low'), pivotWin));
  const pivBack = Math.max(1, Math.trunc(pivotWin / 10));
  const trTrue = A(ta.tr(bars, true));
  const lastConfirmed = lastBarConfirmedOf(chart);
  const tick = mintickOf(chart);
  const ticker = tickerOf(chart);

  const bucket = (x: number, bins: number) => clamp(Math.trunc(Math.floor(x * bins)), 0, bins - 1);
  const meter = (v: number, k: number) => {
    const f = clamp(Math.trunc(pround(v * k)), 0, k);
    return '█'.repeat(f) + '░'.repeat(k - f);
  };

  // 10 · regime detection. hurstRS() runs only on the refresh bars, and its `regDev[i]` reads the history of those
  // calls, as an argument of a function called on some bars only (measured on the reference): the value of bar
  // i - k is the one of the last refresh bar at or before it (refresh bars: bar 0 and every regEvery-th bar)
  const hurstRS = (i: number) => {
    let cum = 0;
    let mx = 0;
    let mn = 0;
    for (let k = 0; k < REG_LEN; k++) {
      const j = i - k;
      cum += j >= 0 ? nz(regDev[j - (j % cfg.regEvery)]) : 0;
      mx = Math.max(mx, cum);
      mn = Math.min(mn, cum);
    }
    const R = mx - mn;
    const sd = regStd[i];
    return Number.isNaN(sd) || eq(sd, 0) ? 0.5 : clamp(Math.log(Math.max(R, 1e-10) / sd) / Math.log(REG_LEN), 0, 1);
  };
  const dirEntropy = (i: number) => {
    let u = 0;
    let d = 0;
    for (let k = 1; k <= REG_LEN; k++) {
      const diff = i - k >= 0 ? nz(close[i - k + 1] - close[i - k]) : 0;
      u += gt(diff, 0) ? 1 : 0;
      d += lt(diff, 0) ? 1 : 0;
    }
    const t = u + d;
    let H = 1.0;
    if (gt(t, 0)) {
      const p1 = u / t;
      const p2 = d / t;
      let e = 0;
      e += gt(p1, 0) ? -p1 * Math.log(p1) : 0;
      e += gt(p2, 0) ? -p2 * Math.log(p2) : 0;
      H = clamp(e / Math.log(2), 0, 1);
    }
    return H;
  };

  // 11 · regime grid
  const grid: GCell[] = [];
  for (let k = 0; k < gridX * gridY; k++) grid.push({ mean: 0, count: 0, conf: 0, dMult: 0, dLen: 0 });
  const cellIdx = (ix: number, iy: number) => ix * gridY + iy;
  const gauss = (dx: number, dy: number, s: number) => Math.exp(-(dx * dx + dy * dy) / (2 * s * s));
  const gridWrite = (ix: number, iy: number, ret: number, dM: number, dL: number) => {
    const idx = cellIdx(ix, iy);
    if (idx >= 0 && idx < grid.length) {
      const c = grid[idx];
      const a = 1.0 - Math.exp(-Math.log(2.0) / cfg.gridHalf);
      c.mean = c.mean * (1 - a) + ret * a;
      c.count = c.count + 1;
      c.conf = 1.0 - Math.exp(-c.count / cfg.gridConfN);
      c.dMult = c.dMult * (1 - a) + dM * a;
      c.dLen = c.dLen * (1 - a) + dL * a;
    }
  };
  const gridRead = (ix: number, iy: number): [number, number, number] => {
    let ws = 0;
    let wc = 0;
    let mM = 0;
    let mL = 0;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const nx = clamp(ix + dx, 0, gridX - 1);
        const ny = clamp(iy + dy, 0, gridY - 1);
        const idx = cellIdx(nx, ny);
        if (idx >= 0 && idx < grid.length) {
          const c = grid[idx];
          if (c.count > 0) {
            const w = gauss(dx, dy, cfg.gridSigma);
            ws += w;
            wc += w * c.conf;
            mM += w * c.conf * c.dMult;
            mL += w * c.conf * c.dLen;
          }
        }
      }
    }
    const den = eq(wc, 0) ? (eq(ws, 0) ? 1.0 : ws) : wc;
    const oM = eq(ws, 0) ? 0.0 : mM / den;
    const oL = eq(ws, 0) ? 0.0 : mL / den;
    const oC = eq(ws, 0) ? 0.0 : clamp(wc / ws, 0, 1);
    return [oM, oL, oC];
  };

  // 12 · probe engine
  const bookL: Probe[] = [];
  const bookS: Probe[] = [];
  const retL: number[] = [];
  const retS: number[] = [];
  const maeRoll: number[] = [];
  const rollPush = (arr: number[], v: number, cap: number) => {
    arr.push(v);
    while (arr.length > cap) arr.shift();
  };
  const rollWin = (arr: number[]) => {
    let w = 0;
    for (const v of arr) w += gt(v, 0) ? 1 : 0;
    return arr.length === 0 ? 0.5 : w / arr.length;
  };
  const rollAvg = (arr: number[]) => {
    let s = 0;
    for (const v of arr) s += v;
    return arr.length === 0 ? 0.0 : s / arr.length;
  };
  const rollSortino = (arr: number[]) => {
    const k = arr.length;
    let out = NaN;
    if (k > 2) {
      let m = 0;
      let dd = 0;
      let dc = 0;
      for (const v of arr) {
        m += v;
        if (lt(v, 0)) {
          dd += v * v;
          dc += 1;
        }
      }
      m /= k;
      const d = dc > 0 ? Math.sqrt(dd / dc) : NaN;
      out = Number.isNaN(d) || eq(d, 0) ? NaN : m / d;
    }
    return out;
  };
  const probeTouch = (bk: Probe[], i: number) => {
    for (const p of bk) {
      if (p.live) {
        const adverse = p.dir === 1 ? p.entry - bars[i].low : bars[i].high - p.entry;
        p.mae = Math.max(p.mae, Math.max(0.0, adverse));
      }
    }
  };
  const probeOpen = (bk: Probe[], dir: number, a0: number, i: number) => {
    const free = bk.findIndex((p) => !p.live);
    if (free < 0) bk.push({ entry: bars[i].open, bar: i, dir, live: true, atr0: a0, mae: 0 });
    else Object.assign(bk[free], { entry: bars[i].open, bar: i, dir, live: true, atr0: a0, mae: 0 });
  };
  const probeLive = (bk: Probe[]) => bk.reduce((c, p) => c + (p.live ? 1 : 0), 0);
  const probeMature = (bk: Probe[], i: number): [number, number] => {
    let ret = NaN;
    let mae = NaN;
    let pick = -1;
    let oldest = 999999999;
    for (let k = 0; k < bk.length; k++) {
      const p = bk[k];
      if (p.live && i - p.bar + 1 >= HOLD && p.bar < oldest) {
        oldest = p.bar;
        pick = k;
      }
    }
    if (pick >= 0) {
      const q = bk[pick];
      const raw = (bars[i].close - q.entry) * q.dir;
      // `q.atr0 != 0` is false when atr0 is na (ATR warm-up): the return is 0
      const ok = !Number.isNaN(q.atr0) && !eq(q.atr0, 0);
      ret = ok ? raw / q.atr0 : 0.0;
      mae = ok ? q.mae / q.atr0 : 0.0;
      q.live = false;
    }
    return [ret, mae];
  };

  // 13 · adaptive parameters
  let aMult = cfg.baseMult;
  let aLen = cfg.baseAtrLen;
  let lastUpdBar = NaN;
  let nLong = 0;
  let nShort = 0;
  const kDial = (cfg.reactivity - 1.0) / 19.0;
  const capM = 0.02 + 0.10 * kDial;
  const capL = 0.5 + 2.5 * kDial;
  const dbM = Math.max(0.003, cfg.deadband * (1 - 0.6 * kDial));
  const alphaEff = clamp(0.20 + 0.45 * kDial, 0.20, 0.65);
  const propose = (wr: number, avgRet: number, sortino: number, avgMae: number, k: number): [number, number] => {
    let dM = 0;
    let dL = 0;
    if (cfg.adaptOn && k >= 5) {
      const conf = 1.0 / Math.sqrt(Math.max(1.0, k));
      const step = cfg.learnRate * conf;
      const weak = lt(wr, cfg.winLo) && lt(avgRet, 0);
      const strong = gt(wr, cfg.winHi) && gt(avgRet, 0);
      if (weak) {
        dM += 0.30 * step;
        dL += 0.25 * step;
      }
      if (strong) {
        dM -= 0.20 * step;
        dL -= 0.15 * step;
      }
      if (gt(avgMae, 0.60)) dM += 0.15 * step;
      if (!Number.isNaN(sortino)) {
        dM += lt(sortino, 0) ? 0.18 * step : 0.0;
        dM -= gt(sortino, 1.2) ? 0.14 * step : 0.0;
      }
    }
    return [dM, dL];
  };

  // 14 · supertrend state
  let yR = NaN;
  let yE = NaN;
  let lbPrev = NaN;
  let ubPrev = NaN;
  let t = 1;
  let prevTrend = NaN;
  // 15 · signals state
  let topLatch = 0;
  let botLatch = 0;
  let lastSigBar = -100000;
  let regimeScore = 0.5;
  let hurstV = 0.5;
  let entropyV = 1.0;
  const isRev = cfg.sigMode === 'Reversal';

  const plotV: number[][] = Array.from({ length: 11 }, () => new Array<number>(n).fill(NaN));
  const plotC: (string | undefined)[][] = Array.from({ length: 11 }, () => new Array<string | undefined>(n));
  const fillColors: string[][] = Array.from({ length: 7 }, () => new Array<string>(n).fill('transparent'));
  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];
  const flags: boolean[][] = [[], [], [], []];
  const alertCalls: AlertCall[] = [];
  const railHiBase = isRev ? bearCol : bullCol;
  const railLoBase = isRev ? bullCol : bearCol;
  const dormFade = Math.min(92, cfg.railFade + 45);
  const f2 = (x: number) => str.tostring(x, '#.00');
  const f0 = (x: number) => str.tostring(x, '#');

  resetDrawings({ line: 500, label: 500, box: 500 });
  const tagHi = varDrawing<Label>();
  const tagLo = varDrawing<Label>();

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const isLast = i === n - 1;
    const confirmed = !isLast || lastConfirmed;

    if (i === 0 || i % cfg.regEvery === 0) {
      hurstV = hurstRS(i);
      entropyV = dirEntropy(i);
      const adxN = Number.isNaN(adxRaw[i]) ? 0.5 : clamp(adxRaw[i] / 50.0, 0, 1);
      regimeScore = clamp(0.35 * (1 - entropyV) + 0.35 * clamp((hurstV - 0.5) * 2, 0, 1) + 0.30 * adxN, 0, 1);
    }
    const volRatio = Number.isNaN(atrAvg[i]) || eq(atrAvg[i], 0) ? 1.0 : atr14[i] / atrAvg[i];
    const volNorm = clamp(volRatio / cfg.volCeil, 0.0, 1.0);

    if (cfg.adaptOn && confirmed) {
      probeTouch(bookL, i);
      probeTouch(bookS, i);
      const [rL, mL] = probeMature(bookL, i);
      const [rS, mS] = probeMature(bookS, i);
      if (!Number.isNaN(rL)) {
        rollPush(retL, rL, cfg.rollN);
        rollPush(maeRoll, mL, cfg.rollN * 2);
      }
      if (!Number.isNaN(rS)) {
        rollPush(retS, rS, cfg.rollN);
        rollPush(maeRoll, mS, cfg.rollN * 2);
      }
      if (probeLive(bookL) < SLOTS) probeOpen(bookL, 1, atr14[i], i);
      if (probeLive(bookS) < SLOTS) probeOpen(bookS, -1, atr14[i], i);

      const avgMae = rollAvg(maeRoll);
      const [dML, dLL] = propose(rollWin(retL), rollAvg(retL), rollSortino(retL), avgMae, retL.length);
      const [dMS, dLS] = propose(rollWin(retS), rollAvg(retS), rollSortino(retS), avgMae, retS.length);
      const netM = clamp(dML + dMS, -capM, capM);
      const netL = clamp(dLL + dLS, -capL, capL);
      const ix = bucket(regimeScore, gridX);
      const iy = bucket(volNorm, gridY);
      const [gM, gL, gConf] = gridRead(ix, iy);
      const wG = cfg.useGrid ? clamp(gConf, 0.0, cfg.gridMaxW) : 0.0;
      const tgtM = (cfg.baseMult * (1 + gM)) * wG + (aMult * (1 + netM)) * (1 - wG);
      const tgtL = (cfg.baseAtrLen + gL) * wG + (aLen + netL) * (1 - wG);
      const cool = Number.isNaN(lastUpdBar) || i - lastUpdBar >= cfg.updEvery;
      if (cool && (gt(Math.abs(tgtM - aMult), dbM) || gt(Math.abs(tgtL - aLen), 0.25))) {
        const nM = clamp(pround(tgtM / 0.05) * 0.05, 0.3, 6.0);
        const nL = clamp(pround(tgtL), 5, 300);
        aMult = aMult + (nM - aMult) * alphaEff;
        aLen = aLen + (nL - aLen) * alphaEff;
        lastUpdBar = i;
      }
      if (cfg.revertEvery > 0 && i % cfg.revertEvery === 0) {
        aMult = aMult + (cfg.baseMult - aMult) * cfg.revertStep;
        aLen = aLen + (cfg.baseAtrLen - aLen) * cfg.revertStep;
      }
      if (cfg.useGrid) {
        if (!Number.isNaN(rL)) gridWrite(ix, iy, rL, netM, netL);
        if (!Number.isNaN(rS)) gridWrite(ix, iy, rS, netM, netL);
      }
    }
    const effMult = cfg.adaptOn ? aMult : cfg.baseMult;
    const effLen = cfg.adaptOn ? aLen : cfg.baseAtrLen;

    // aslanmlST(src, effMult, effLen, useRMA): rmaV / emaV keep their own state
    const x = trTrue[i];
    yR = Number.isNaN(yR) ? x : yR + (1.0 / Math.max(1.0, effLen)) * (x - yR);
    const aE = 2.0 / (Math.max(1.0, effLen) + 1.0);
    yE = Number.isNaN(yE) ? x : aE * x + (1.0 - aE) * yE;
    const atrAdp = cfg.useRMA ? yR : yE;
    let lb = src[i] - effMult * atrAdp;
    let ub = src[i] + effMult * atrAdp;
    const c1 = i > 0 ? close[i - 1] : NaN;
    lb = gt(c1, nz(lbPrev, lb)) ? Math.max(lb, nz(lbPrev, lb)) : lb;
    ub = lt(c1, nz(ubPrev, ub)) ? Math.min(ub, nz(ubPrev, ub)) : ub;
    t = t === -1 && gt(b.close, nz(ubPrev, ub)) ? 1 : t === 1 && lt(b.close, nz(lbPrev, lb)) ? -1 : t;
    lbPrev = lb;
    ubPrev = ub;
    const trendDir = t;
    const stLine = t === 1 ? lb : ub;
    const trendUp = trendDir === 1;
    const flipUp = trendDir === 1 && prevTrend === -1;
    const flipDn = trendDir === -1 && prevTrend === 1;
    prevTrend = trendDir;

    // 15 · signals
    const railHi = i >= pivBack ? pivHi[i - pivBack] : NaN;
    const railLo = i >= pivBack ? pivLo[i - pivBack] : NaN;
    const newHigh = !Number.isNaN(railHi) && neq(pivHi[i], railHi) && gt(b.close, nz(railHi, b.close));
    const newLow = !Number.isNaN(railLo) && neq(pivLo[i], railLo) && lt(b.close, nz(railLo, b.close));
    const majorSpan = atrAdp * cfg.majorATR;
    const freshHigh = cfg.useMajor ? newHigh && gt(b.high - pivLo[i], majorSpan) : newHigh;
    const freshLow = cfg.useMajor ? newLow && gt(pivHi[i] - b.low, majorSpan) : newLow;
    const prevTop = topLatch;
    const prevBot = botLatch;
    topLatch = !trendUp ? 0 : freshHigh ? 1 : prevTop;
    botLatch = trendUp ? 0 : freshLow ? 1 : prevBot;
    const rsiCold = !cfg.useRSI || lt(barsColdRSI[i], rsiMem);
    const rsiHot = !cfg.useRSI || lt(barsHotRSI[i], rsiMem);
    const volOK = !cfg.useVol || gt(b.volume ?? NaN, cfg.volMult * nz(volAvg[i], b.volume ?? NaN));
    const biasUp = !cfg.useBias || gt(b.close, ema200[i]);
    const biasDn = !cfg.useBias || lt(b.close, ema200[i]);
    const longFilters = (isRev ? rsiCold : rsiHot) && volOK && biasUp;
    const shortFilters = (isRev ? rsiHot : rsiCold) && volOK && biasDn;
    const spaced = i - lastSigBar >= cfg.sigSpacing;
    const barReady = !cfg.confirmOnly || confirmed;
    let rawLong: boolean;
    let rawShort: boolean;
    if (isRev) {
      rawLong = (prevBot === 1 && botLatch === 0) || (!cfg.needFresh && flipUp);
      rawShort = (prevTop === 1 && topLatch === 0) || (!cfg.needFresh && flipDn);
    } else {
      rawLong = freshHigh && trendUp;
      rawShort = freshLow && !trendUp;
    }
    let sigLong = false;
    let sigShort = false;
    if (barReady && spaced) {
      if (rawLong && longFilters) sigLong = true;
      else if (rawShort && shortFilters) sigShort = true;
    }
    if (sigLong || sigShort) lastSigBar = i;
    if (sigLong) nLong += 1;
    if (sigShort) nShort += 1;

    // 16 · signal labels
    const tip = (side: string) => `ML Supertrenmd [Aslan] ${side}\nRegime ${f0(regimeScore * 100)}%   Vol ${f2(volRatio)}x\nBand ${f2(effMult)}  ATR ${f0(effLen)}`;
    if (cfg.showSigLabel && sigLong) {
      label.new(i, b.low, '▲ Buy', 'bar_index', 'belowbar', bullCol, 'label_up', '#FFFFFF', 'normal', undefined, tip('Long'));
    }
    if (cfg.showSigLabel && sigShort) {
      label.new(i, b.high, '▼ Sell', 'bar_index', 'abovebar', bearCol, 'label_down', '#FFFFFF', 'normal', undefined, tip('Short'));
    }

    // 17 · trend cloud
    const cloudBase = trendUp ? bullCol : bearCol;
    const cloudSpan = b.close - stLine;
    if (cfg.showCloud) {
      const mults = [0, 0.1667, 0.3333, 0.5, 0.6667, 0.8333];
      plotV[0][i] = stLine;
      for (let k = 1; k < 6; k++) plotV[k][i] = stLine + cloudSpan * mults[k];
      plotV[6][i] = b.close;
    }
    for (let k = 0; k < 6; k++) fillColors[k][i] = String(color.new(cloudBase, Math.min(99, cfg.cloudFade + 3 * k)));
    if (cfg.showTrendLn && trendUp) plotV[7][i] = stLine;
    if (cfg.showTrendLn && !trendUp) plotV[8][i] = stLine;
    plotC[7][i] = String(color.new(bullCol, 0));
    plotC[8][i] = String(color.new(bearCol, 0));

    // 17b · pivot rails
    const hiArmed = trendUp;
    const loArmed = !trendUp;
    plotC[9][i] = String(color.new(railHiBase, !cfg.railDim || hiArmed ? cfg.railFade : dormFade));
    plotC[10][i] = String(color.new(railLoBase, !cfg.railDim || loArmed ? cfg.railFade : dormFade));
    const railMajor = gt(pivHi[i] - pivLo[i], atrAdp * cfg.majorATR);
    fillColors[6][i] = !cfg.showRailFill ? String(color.new(neutCol, 100))
      : String(color.new(railMajor ? accentCol : neutCol, railMajor ? 90 : 94));
    if (cfg.showRails) {
      plotV[9][i] = railHi;
      plotV[10][i] = railLo;
      if (cfg.showRailDot && newHigh && !Number.isNaN(railHi) && railHi !== 0) {
        markers.push({ id: 'shape0', time: b.time, position: 'aboveBar', shape: 'xcross', color: railHiBase, size: 'tiny' });
      }
      if (cfg.showRailDot && newLow && !Number.isNaN(railLo) && railLo !== 0) {
        markers.push({ id: 'shape1', time: b.time, position: 'belowBar', shape: 'xcross', color: railLoBase, size: 'tiny' });
      }
    }
    if (cfg.showRails && cfg.showRailTag && isLast) {
      if (tagHi.value) label.delete(tagHi.value);
      if (tagLo.value) label.delete(tagLo.value);
      tagHi.value = label.new(i + 2, railHi, str.tostring(railHi, 'mintick', tick), 'bar_index', 'price',
        String(color.new(railHiBase, hiArmed ? 15 : 62)), 'label_left', '#FFFFFF', 'small');
      tagLo.value = label.new(i + 2, railLo, str.tostring(railLo, 'mintick', tick), 'bar_index', 'price',
        String(color.new(railLoBase, loArmed ? 15 : 62)), 'label_left', '#FFFFFF', 'small');
    }

    // 18 · bar colour
    const distN = eq(atrAdp, 0) || Number.isNaN(atrAdp) ? 0.0 : clamp(Math.abs(b.close - stLine) / (atrAdp * 2.5), 0, 1);
    if (cfg.showBarCol) {
      const base = trendUp ? bullCol : bearCol;
      barColors.push({ id: 'barcolor0', time: b.time, color: color.from_gradient(distN, 0, 1, String(color.new(base, 62)), String(color.new(base, 0))) });
    }

    // 19 · dashboard
    if (cfg.showDash && isLast) {
      const pos = { 'Top Right': 'top_right', 'Middle Right': 'middle_right', 'Bottom Right': 'bottom_right', 'Bottom Left': 'bottom_left', 'Top Left': 'top_left' }[cfg.dashPos] ?? 'top_left';
      const size = cfg.dashSize === 'Tiny' ? 'tiny' : cfg.dashSize === 'Normal' ? 'normal' : 'small';
      const dash = table.new(pos as 'bottom_right', 2, 9, undefined, String(color.new(neutCol, 55)), 1, String(color.new(neutCol, 72)), 1);
      const cellBg = String(color.new('#0d1117', 10));
      const rowKV = (r: number, k: string, v: string, vc: string) => {
        table.cell(dash, 0, r, k, undefined, undefined, String(color.new(neutCol, 12)), 'left', undefined, size, cellBg);
        table.cell(dash, 1, r, v, undefined, undefined, vc, 'right', undefined, size, cellBg);
      };
      const hdr = trendUp ? bullCol : bearCol;
      table.cell(dash, 0, 0, '  ML Supertrend [Aslan]  ', undefined, undefined, '#FFFFFF', 'left', undefined, size, String(color.new(hdr, 20)));
      table.cell(dash, 1, 0, trendUp ? '▲ BULLISH  ' : '▼ BEARISH  ', undefined, undefined, '#FFFFFF', 'right', undefined, size, String(color.new(hdr, 20)));
      const regTxt = ge(regimeScore, 0.66) ? 'TRENDING' : ge(regimeScore, 0.36) ? 'TRANSITION' : 'RANGING';
      const regClr = ge(regimeScore, 0.66) ? bullCol : ge(regimeScore, 0.36) ? neutCol : bearCol;
      rowKV(1, 'Regime', meter(regimeScore, 8) + '  ' + regTxt, regClr);
      const volTxt = ge(volRatio, 1.8) ? 'EXTREME' : ge(volRatio, 1.25) ? 'HIGH' : ge(volRatio, 0.75) ? 'NORMAL' : 'LOW';
      const volClr = ge(volRatio, 1.8) ? bearCol : ge(volRatio, 1.25) ? String(color.new(bearCol, 30)) : ge(volRatio, 0.75) ? neutCol : accentCol;
      rowKV(2, 'Volatility', meter(volNorm, 8) + '  ' + volTxt, volClr);
      rowKV(3, 'Hurst / Entropy', f2(hurstV) + '  /  ' + f2(entropyV), String(color.new(neutCol, 8)));
      const mDrift = gt(effMult, cfg.baseMult) ? bearCol : lt(effMult, cfg.baseMult) ? bullCol : neutCol;
      rowKV(4, 'Band Width', f2(cfg.baseMult) + ' → ' + f2(effMult), mDrift);
      rowKV(5, 'ATR Period', str.tostring(cfg.baseAtrLen) + ' → ' + f0(effLen), String(color.new(neutCol, 8)));
      const wrL = rollWin(retL);
      const wrS = rollWin(retS);
      rowKV(6, 'Probe WR L / S', f0(wrL * 100) + '%  /  ' + f0(wrS * 100) + '%', ge((wrL + wrS) / 2, 0.5) ? bullCol : bearCol);
      const ixd = bucket(regimeScore, gridX);
      const iyd = bucket(volNorm, gridY);
      const gcf = gridRead(ixd, iyd)[2];
      rowKV(7, 'Grid Cell / Conf', '[' + str.tostring(ixd) + ',' + str.tostring(iyd) + ']  ' + f0(gcf * 100) + '%',
        cfg.useGrid ? String(color.new(accentCol, 8)) : String(color.new(neutCol, 55)));
      rowKV(8, 'Signals L / S', str.tostring(nLong) + '  /  ' + str.tostring(nShort), String(color.new(neutCol, 8)));
    }

    // 20 · alerts
    flags[0].push(sigLong);
    flags[1].push(sigShort);
    flags[2].push(flipUp);
    flags[3].push(flipDn);
    const tail = ` | band ${f2(effMult)} x ATR${f0(effLen)} | regime ${f0(regimeScore * 100)}%`;
    const at = b.time as number;
    if (sigLong) alertCalls.push({ time: at, message: `ML Supertrenmd [Aslan] LONG ${ticker} @ ${str.tostring(b.close)}${tail}`, freq: 'once_per_bar_close' });
    if (sigShort) alertCalls.push({ time: at, message: `ML Supertrenmd [Aslan] SHORT ${ticker} @ ${str.tostring(b.close)}${tail}`, freq: 'once_per_bar_close' });
    if (flipUp) alertCalls.push({ time: at, message: `ML Supertrenmd [Aslan] trend flipped bullish ${ticker}`, freq: 'once_per_bar_close' });
    if (flipDn) alertCalls.push({ time: at, message: `ML Supertrenmd [Aslan] trend flipped bearish ${ticker}`, freq: 'once_per_bar_close' });
  }
  setDrawingBar(null);

  const plots: IndicatorResult['plots'] = {};
  for (let k = 0; k < 11; k++) {
    plots[`plot${k}`] = bars.map((b, i) => ({
      time: b.time, value: plotV[k][i], ...(plotC[k][i] !== undefined ? { color: plotC[k][i] } : {}),
    }));
  }
  const fills: FillData[] = fillConfig.map((f, k) => ({
    id: f.id, plot1: f.plot1, plot2: f.plot2, options: { title: f.title }, colors: fillColors[k],
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    fills,
    markers,
    barColors,
    ...drawingOutputs(bars),
    alerts: alertStates(alertConditions, bars, flags),
    alertCalls,
  };
}

export const MachineLearningSupertrend = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, fillConfig, shapeConfig, barColorConfig,
  alertConditions, hasAlertFunction, drawingKinds,
};
