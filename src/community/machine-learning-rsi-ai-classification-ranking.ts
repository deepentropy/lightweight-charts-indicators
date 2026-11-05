/**
 * Machine Learning RSI | AI Classification & Ranking (Zeiierman)
 *
 * An RSI tilted by a nearest-neighbour model, with a trailing stop whose width follows the model, ranked signals and
 * a trend cloud.
 * - Features of each bar (from the RSI of the source): value, slope (3 bars), acceleration, distance from 50,
 *   percentile, volatility (stdev 14), fast / slow RSI spread and regime (EMA 20 - 50); the slope, acceleration,
 *   volatility, spread and regime are min-max scaled over 100 bars.
 * - Memory bank: on each closed bar the features of 4 bars back are stored with the outcome of the move since then
 *   (-3..3 by multiples of "Learning Sensitivity" x ATR), newest first, at most "Memory Depth" rows.
 * - Feature weights: the manual weights, or (Auto-Optimize) the Fisher ratio of each feature between the bullish and
 *   bearish rows of the bank, scaled to [0.5, 10] and smoothed by "Adaptation Speed".
 * - Neighbours: every 4th row of the bank; distance = weighted sum of log(1 + |difference|); the k closest rows vote
 *   with weight 1 / (1 + distance). The vote gives the analog score, the bias (+-0.15), the agreement and the
 *   tightness of the neighbours.
 * - ML Supertrend: hl2 -+ ATR(10) x 1.5 x (1 + adaptivity x (1 - drive)), where the drive comes from the smoothed
 *   score, the tightness and the agreement (x 0.35 in chop: |EMA 5 - EMA 50| / ATR(14) < 0.5).
 * - Stance: the bias when it passes the trend gate (trailing stop direction), the volatility band (ATR percentile
 *   rank 20..85) and the chop filter. Rank and confidence scores (0..100) gate the signals: a new stance with rank
 *   >= "Min Rank" and confidence >= "Min Confidence", at least 5 bars after the last signal, on a closed bar.
 * - ML RSI = EMA 3 of the RSI + score x EMA 3 of the rank x 18; signal line (moving average, optional Bollinger
 *   bands), gradient fills above 70 and below 30, candles coloured by the trailing stop direction.
 * The closed-bar steps (bank row, weights, signals) do not run on a last bar that is still open: the chart context
 * says when the last bar is still open (fallback: closed).
 * Alerts (alertcondition, `alerts` of the result): 'Long Signal', 'Short Signal', 'Any Signal', 'Trend Flip Up',
 * 'Trend Flip Down' and 'Any Trend Flip'; alert() calls (`alertCalls`, once per bar close) on the closed bars with a
 * signal (rank and confidence in the message) or a trailing stop flip.
 *
 * Reference: "Machine Learning RSI | AI Classification & Ranking (Zeiierman)" by Zeiierman
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Zeiierman
 */

import {
  ta, Series, getSourceSeries, color, str,
  type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { AlertCall, MarkerData, PlotCandleData } from '../types';
import { lastBarConfirmedOf, tickerOf, type ChartContext } from '../chart-context';
import { chartTimeframe } from '../anchor-period';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';

/** The original makes alert() calls */
export const hasAlertFunction = true;

type MaType = 'None' | 'SMA' | 'SMA + Bollinger Bands' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';

export interface MachineLearningRsiAiClassificationRankingInputs {
  priceSrc: SourceType;
  rsiBase: number;
  memoryDepth: number;
  kNeighbors: number;
  showMarks: boolean;
  paintBars: boolean;
  gateRank: number;
  gateConf: number;
  useTrendGate: boolean;
  useVolBand: boolean;
  volBandLo: number;
  useChop: boolean;
  atrFactor: number;
  autoWeightsOn: boolean;
  autoSpeed: number;
  wVal: number;
  wSlp: number;
  wAcc: number;
  wMid: number;
  wPct: number;
  wChn: number;
  wSpr: number;
  wReg: number;
  showSt: boolean;
  stSrc: SourceType;
  stMultBase: number;
  stMlResp: number;
  maTypeInput: MaType;
  maLengthInput: number;
  bbMultInput: number;
  sigBull: string;
  sigBear: string;
  trailBull: string;
  trailBear: string;
  rsiBull: string;
  rsiBear: string;
  smoothLineCol: string;
  bbAreaCol: string;
}

export const defaultInputs: MachineLearningRsiAiClassificationRankingInputs = {
  priceSrc: 'close',
  rsiBase: 14,
  memoryDepth: 500,
  kNeighbors: 8,
  showMarks: true,
  paintBars: true,
  gateRank: 60,
  gateConf: 50,
  useTrendGate: true,
  useVolBand: true,
  volBandLo: 20,
  useChop: true,
  atrFactor: 0.5,
  autoWeightsOn: true,
  autoSpeed: 1,
  wVal: 1.0,
  wSlp: 1.0,
  wAcc: 1.0,
  wMid: 1.0,
  wPct: 1.0,
  wChn: 1.0,
  wSpr: 1.0,
  wReg: 1.0,
  showSt: true,
  stSrc: 'hl2',
  stMultBase: 1.5,
  stMlResp: 1,
  maTypeInput: 'SMA',
  maLengthInput: 14,
  bbMultInput: 2.0,
  sigBull: '#00E676',
  sigBear: '#F23645',
  trailBull: '#2962FF',
  trailBear: '#FFFFFF',
  rsiBull: '#2962FF',
  rsiBear: '#FFFFFF',
  smoothLineCol: '#E3B13A',
  // color.new(#e3b13a, 90) as an input default: alpha 0.1, byte 26
  bbAreaCol: '#E3B13A1A',
};

const BRAIN = 'ML Brain';
const SIGNALS = 'Signals';
const AUTO = 'Auto Weight Optimizer';
const WEIGHTS = 'Feature Weights';
const ST = 'ML Supertrend';
const SIGLINE = 'RSI Signal Line';
const COL_SIG = 'Colors · Signals';
const COL_TRAIL = 'Colors · Trailing Stop & Cloud';
const COL_RSI = 'Colors · RSI';

export const inputConfig: InputConfig[] = [
  { id: 'priceSrc', type: 'source', title: 'Price Source', defval: 'close', group: BRAIN },
  { id: 'rsiBase', type: 'int', title: 'Base RSI Length', defval: 14, min: 2, group: BRAIN },
  { id: 'memoryDepth', type: 'int', title: 'Memory Depth (bars)', defval: 500, min: 80, max: 5000, group: BRAIN },
  { id: 'kNeighbors', type: 'int', title: 'Analog Count (k)', defval: 8, min: 1, max: 64, group: BRAIN },
  { id: 'showMarks', type: 'bool', title: 'Show Signal Markers', defval: true, inline: 'show', group: SIGNALS },
  { id: 'paintBars', type: 'bool', title: 'Candle coloring', defval: true, inline: 'show', group: SIGNALS },
  { id: 'gateRank', type: 'int', title: 'Min Rank to Signal', defval: 60, min: 0, max: 100, group: SIGNALS },
  { id: 'gateConf', type: 'int', title: 'Min Confidence to Signal', defval: 50, min: 0, max: 100, group: SIGNALS },
  { id: 'useTrendGate', type: 'bool', title: 'Trend Gate (Signals must align with trailing stop)', defval: true, group: SIGNALS },
  { id: 'useVolBand', type: 'bool', title: 'Volatility Band', defval: true, inline: 'vol', group: SIGNALS },
  { id: 'volBandLo', type: 'int', title: 'Min Vol Rank', defval: 20, min: 0, max: 100, inline: 'vol', group: SIGNALS },
  { id: 'useChop', type: 'bool', title: 'Chop Filter', defval: true, group: SIGNALS },
  { id: 'atrFactor', type: 'float', title: 'Learning Sensitivity (×ATR)', defval: 0.5, min: 0, step: 0.1, group: SIGNALS },
  { id: 'autoWeightsOn', type: 'bool', title: 'Auto-Optimize Weights', defval: true, group: AUTO },
  { id: 'autoSpeed', type: 'float', title: 'Adaptation Speed', defval: 1, min: 0.005, max: 1.0, step: 0.005, group: AUTO },
  { id: 'wVal', type: 'float', title: 'RSI Value', defval: 1.0, min: 0, step: 0.1, group: WEIGHTS },
  { id: 'wSlp', type: 'float', title: 'RSI Slope', defval: 1.0, min: 0, step: 0.1, group: WEIGHTS },
  { id: 'wAcc', type: 'float', title: 'RSI Acceleration', defval: 1.0, min: 0, step: 0.1, group: WEIGHTS },
  { id: 'wMid', type: 'float', title: 'RSI Midpoint Dist', defval: 1.0, min: 0, step: 0.1, group: WEIGHTS },
  { id: 'wPct', type: 'float', title: 'RSI Percentile', defval: 1.0, min: 0, step: 0.1, group: WEIGHTS },
  { id: 'wChn', type: 'float', title: 'RSI Volatility', defval: 1.0, min: 0, step: 0.1, group: WEIGHTS },
  { id: 'wSpr', type: 'float', title: 'RSI Fast/Slow Spread', defval: 1.0, min: 0, step: 0.1, group: WEIGHTS },
  { id: 'wReg', type: 'float', title: 'RSI Regime', defval: 1.0, min: 0, step: 0.1, group: WEIGHTS },
  { id: 'showSt', type: 'bool', title: 'Show ML Supertrend', defval: true, group: ST },
  { id: 'stSrc', type: 'source', title: 'Supertrend Source', defval: 'hl2', group: ST },
  { id: 'stMultBase', type: 'float', title: 'ATR Multiplier', defval: 1.5, min: 0.5, step: 0.1, group: ST },
  { id: 'stMlResp', type: 'float', title: 'ML Band Adaptivity', defval: 1, min: 0.0, max: 1.0, step: 0.05, group: ST },
  { id: 'maTypeInput', type: 'string', title: 'Type', defval: 'SMA', group: SIGLINE,
    options: ['None', 'SMA', 'SMA + Bollinger Bands', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'] },
  { id: 'maLengthInput', type: 'int', title: 'Length', defval: 14, group: SIGLINE },
  { id: 'bbMultInput', type: 'float', title: 'BB StdDev', defval: 2.0, min: 0.001, max: 50, step: 0.5, group: SIGLINE },
  { id: 'sigBull', type: 'color', title: 'Long / Bullish', defval: '#00E676', inline: 'sig', group: COL_SIG },
  { id: 'sigBear', type: 'color', title: 'Short / Bearish', defval: '#F23645', inline: 'sig', group: COL_SIG },
  { id: 'trailBull', type: 'color', title: 'Uptrend', defval: '#2962FF', inline: 'tr', group: COL_TRAIL },
  { id: 'trailBear', type: 'color', title: 'Downtrend', defval: '#FFFFFF', inline: 'tr', group: COL_TRAIL },
  { id: 'rsiBull', type: 'color', title: 'Bullish', defval: '#2962FF', inline: 'rs', group: COL_RSI },
  { id: 'rsiBear', type: 'color', title: 'Bearish', defval: '#FFFFFF', inline: 'rs', group: COL_RSI },
  { id: 'smoothLineCol', type: 'color', title: 'Signal Line', defval: '#E3B13A', inline: 'sm', group: COL_RSI },
  { id: 'bbAreaCol', type: 'color', title: 'BB Fill', defval: '#E3B13A1A', inline: 'sm', group: COL_RSI },
];

/** color.new(color.gray, 100): the colour of the hidden cloud plots */
const NEUTRAL = String(color.new('#787B86', 100));
const GRAY = String(color.new('#787B86', 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Midline', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot1', title: 'ML RSI', color: '#2962FF', lineWidth: 2 },
  { id: 'plot2', title: 'RSI Signal Line', color: '#E3B13A', lineWidth: 1 },
  { id: 'plot3', title: 'BB Upper', color: String(color.new('#E3B13A', 40)), lineWidth: 1 },
  { id: 'plot4', title: 'BB Lower', color: String(color.new('#E3B13A', 40)), lineWidth: 1 },
  { id: 'plot5', title: 'ST Up Glow', color: String(color.new('#2962FF', 70)), lineWidth: 6, style: 'linebr', forceOverlay: true },
  { id: 'plot6', title: 'ST Down Glow', color: String(color.new('#FFFFFF', 70)), lineWidth: 6, style: 'linebr', forceOverlay: true },
  { id: 'plot7', title: 'ML Supertrend Up', color: '#2962FF', lineWidth: 2, style: 'linebr', forceOverlay: true },
  { id: 'plot8', title: 'ML Supertrend Down', color: '#FFFFFF', lineWidth: 2, style: 'linebr', forceOverlay: true },
  { id: 'plot9', title: 'Cloud Active Line', color: NEUTRAL, lineWidth: 1, display: 'none', forceOverlay: true },
  { id: 'plot10', title: 'Cloud Layer A', color: NEUTRAL, lineWidth: 1, display: 'none', forceOverlay: true },
  { id: 'plot11', title: 'Cloud Layer B', color: NEUTRAL, lineWidth: 1, display: 'none', forceOverlay: true },
  { id: 'plot12', title: 'Cloud Layer C', color: NEUTRAL, lineWidth: 1, display: 'none', forceOverlay: true },
  { id: 'plot13', title: 'Cloud Reference', color: NEUTRAL, lineWidth: 1, display: 'none', forceOverlay: true },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_ob', price: 70, title: 'OB', color: GRAY, linestyle: 'dashed' },
  { id: 'hline_mid', price: 50, title: 'Mid', color: GRAY, linestyle: 'dotted' },
  { id: 'hline_os', price: 30, title: 'OS', color: GRAY, linestyle: 'dashed' },
];

const BAND_TINT = String(color.rgb(126, 87, 194, 90));

export const fillConfig: FillConfig[] = [
  { id: 'fill_band', plot1: 'hline_ob', plot2: 'hline_os', color: BAND_TINT, title: 'Regime Band Tint' },
];

export const metadata = {
  title: 'Machine Learning RSI | AI Classification & Ranking (Zeiierman)',
  shortTitle: 'Machine Learning RSI | AI Classification & Ranking (Zeiierman)',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && Math.abs(a - b) <= EPS;
/** Pine math.max / math.min: na when an argument is na */
const max = (a: number, b: number) => Math.max(a, b);
const min = (a: number, b: number) => Math.min(a, b);
const compress = (d: number) => Math.log(1.0 + Math.abs(d));

/** Constants of the original */
const WIN_LEN = 100;
const SPACING = 4;
const HORIZON = 4;
const TREND_LEN = 50;
const CHOP_CUT = 0.5;
const VOL_BAND_HI = 85;
const AUTO_FLOOR = 0.5;
const AUTO_MIN_ROWS = 60;
const ST_ATR_LEN = 10;
const SMOOTH_LEN = 10;
const STEP = 3;
const COOL_BARS = 5;

/**
 * Fisher-discriminant feature importance over the bank (bull vs bear rows): 8 weights in [floor, 10]; all 1 below
 * `minRows` rows. An na feature in a row makes its ratio na, and then every weight is 10 (the original's na rule).
 */
function autoFeatureWeights(bank: number[][], minRows: number, floor: number): number[] {
  const n = bank.length;
  const imp = new Array<number>(8).fill(1.0);
  if (n >= minRows) {
    const sumB = new Array<number>(8).fill(0.0);
    const sumBe = new Array<number>(8).fill(0.0);
    const sqB = new Array<number>(8).fill(0.0);
    const sqBe = new Array<number>(8).fill(0.0);
    let cntB = 0;
    let cntBe = 0;
    for (let i = 0; i < n; i++) {
      const row = bank[i];
      const o = row[8];
      if (gt(o, 0) || lt(o, 0)) {
        const isB = gt(o, 0);
        const sum = isB ? sumB : sumBe;
        const sq = isB ? sqB : sqBe;
        for (let j = 0; j < 8; j++) {
          const v = row[j];
          sum[j] = sum[j] + v;
          sq[j] = sq[j] + v * v;
        }
        if (isB) cntB += 1;
        else cntBe += 1;
      }
    }
    if (cntB > 2 && cntBe > 2) {
      const fish = new Array<number>(8).fill(0.0);
      let maxF = 0.0;
      for (let j = 0; j < 8; j++) {
        const mB = sumB[j] / cntB;
        const mBe = sumBe[j] / cntBe;
        const vB = max(0.0, sqB[j] / cntB - mB * mB);
        const vBe = max(0.0, sqBe[j] / cntBe - mBe * mBe);
        const f = Math.pow(mB - mBe, 2) / (vB + vBe + 1e-6);
        fish[j] = f;
        maxF = max(maxF, f);
      }
      for (let j = 0; j < 8; j++) {
        const norm = gt(maxF, 0) ? fish[j] / maxF : 1.0;
        imp[j] = max(floor, norm * 10.0);
      }
    }
  }
  return imp;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MachineLearningRsiAiClassificationRankingInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> }
  & { alerts: AlertConditionState[]; alertCalls: AlertCall[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const S = (a: number[]) => Series.fromArray(bars, a);
  const A = (s: Series) => s.toArray().map((v) => (v === null || v === undefined ? NaN : v));
  /** Pine: every bar but an open last bar is confirmed */
  const lastConfirmed = lastBarConfirmedOf(chart);
  const confirmed = (i: number) => i < n - 1 || lastConfirmed;

  const rsiBase = Math.trunc(cfg.rsiBase);
  const memoryDepth = Math.trunc(cfg.memoryDepth);
  const kNeighbors = Math.trunc(cfg.kNeighbors);
  const src = A(getSourceSeries(bars, cfg.priceSrc));
  const stSrc = A(getSourceSeries(bars, cfg.stSrc));
  const close = bars.map((b) => b.close);
  const ago = (a: number[], i: number, k: number) => (i - k >= 0 ? a[i - k] : NaN);

  // RSI feature engine
  const rOsc = A(ta.rsi(S(src), rsiBase));
  const rOscF = A(ta.rsi(S(src), Math.max(2, Math.round(rsiBase / 2))));
  const rOscS = A(ta.rsi(S(src), rsiBase * 2));
  const atrVal = A(ta.atr(bars, 14));
  const scale01 = (v: number[]) => {
    const lo = A(ta.lowest(S(v), WIN_LEN));
    const hi = A(ta.highest(S(v), WIN_LEN));
    return v.map((x, i) => (eq(hi[i], lo[i]) ? 0.5 : (x - lo[i]) / (hi[i] - lo[i])));
  };
  const d1 = rOsc.map((x, i) => x - ago(rOsc, i, STEP));
  const d2 = rOsc.map((x, i) => x - ago(rOsc, i, STEP) - (ago(rOsc, i, STEP) - ago(rOsc, i, 2 * STEP)));
  const emaR20 = A(ta.ema(S(rOsc), 20));
  // features of each bar: value, slope, accel, mid, pct, churn, spread, regime
  const fValue = rOsc.map((x) => x / 100.0);
  const fSlope = scale01(d1);
  const fAccel = scale01(d2);
  const fMid = rOsc.map((x) => Math.abs(x - 50.0) / 50.0);
  const fPct = A(ta.percentrank(S(rOsc), WIN_LEN)).map((x) => x / 100.0);
  const fChurn = scale01(A(ta.stdev(S(rOsc), 14)));
  const fSpread = scale01(rOscF.map((x, i) => x - rOscS[i]));
  const fRegime = scale01(emaR20.map((x) => x - 50.0));
  const feat = (i: number) => [fValue[i], fSlope[i], fAccel[i], fMid[i], fPct[i], fChurn[i], fSpread[i], fRegime[i]];

  // Engine of each bar (feature bank, weights, neighbours, vote)
  const analogScore = new Array<number>(n);
  const biasDir = new Array<number>(n);
  const agreeFrac = new Array<number>(n);
  const gapTight = new Array<number>(n);
  const kCountOf = new Array<number>(n);
  const bank: number[][] = [];
  const wAuto = new Array<number>(8).fill(1.0);
  const manual = [cfg.wVal, cfg.wSlp, cfg.wAcc, cfg.wMid, cfg.wPct, cfg.wChn, cfg.wSpr, cfg.wReg];
  const atrFactor = cfg.atrFactor;
  for (let i = 0; i < n; i++) {
    // feature bank: features of HORIZON bars back with the outcome of the move since then
    const moveFwd = src[i] - ago(src, i, HORIZON);
    const bandFwd = atrFactor * ago(atrVal, i, HORIZON);
    const outcome = gt(moveFwd, 2 * bandFwd) ? 3 : gt(moveFwd, bandFwd) ? 2 : gt(moveFwd, 0) ? 1
      : lt(moveFwd, -2 * bandFwd) ? -3 : lt(moveFwd, -bandFwd) ? -2 : lt(moveFwd, 0) ? -1 : 0;
    if (confirmed(i) && i > HORIZON) {
      bank.unshift([...feat(i - HORIZON), outcome]);
      if (bank.length > memoryDepth) bank.pop();
    }
    // auto weight optimizer
    if (cfg.autoWeightsOn && confirmed(i)) {
      const wRaw = autoFeatureWeights(bank, AUTO_MIN_ROWS, AUTO_FLOOR);
      for (let j = 0; j < 8; j++) {
        const prev = wAuto[j];
        wAuto[j] = prev + cfg.autoSpeed * (wRaw[j] - prev);
      }
    }
    const w = cfg.autoWeightsOn ? wAuto : manual;
    // neighbour engine: true top-k
    const cur = feat(i);
    const nbrs: Array<{ gap: number; cls: number }> = [];
    const bankN = bank.length;
    const scanEnd = Math.min(memoryDepth - 1, bankN - 1);
    if (bankN > 1) {
      for (let idx = 0; idx <= scanEnd; idx += SPACING) {
        const row = bank[idx];
        let g = w[0] * compress(cur[0] - row[0]);
        for (let j = 1; j < 8; j++) g = g + w[j] * compress(cur[j] - row[j]);
        if (Number.isNaN(g)) continue;
        const cand = { gap: g, cls: Math.trunc(row[8]) };
        if (nbrs.length < kNeighbors) {
          nbrs.push(cand);
        } else {
          let worst = 0;
          let worstGap = nbrs[0].gap;
          for (let m = 1; m < nbrs.length; m++) {
            if (gt(nbrs[m].gap, worstGap)) {
              worstGap = nbrs[m].gap;
              worst = m;
            }
          }
          if (lt(cand.gap, worstGap)) nbrs[worst] = cand;
        }
      }
    }
    // distance-weighted voting
    let total = 0.0;
    let bull = 0.0;
    let bear = 0.0;
    let score = 0.0;
    let gapSum = 0.0;
    const kCount = nbrs.length;
    for (const nb of nbrs) {
      const wt = 1.0 / (1.0 + nb.gap);
      total = total + wt;
      score = score + nb.cls * wt;
      if (nb.cls > 0) bull = bull + wt;
      else if (nb.cls < 0) bear = bear + wt;
      gapSum = gapSum + nb.gap;
    }
    const as = gt(total, 0) ? score / total : 0.0;
    const bd = gt(as, 0.15) ? 1 : lt(as, -0.15) ? -1 : 0;
    analogScore[i] = as;
    biasDir[i] = bd;
    agreeFrac[i] = gt(total, 0) ? (bd === 1 ? bull : bd === -1 ? bear : 0.0) / total : 0.0;
    const avgGap = kCount > 0 ? gapSum / kCount : 0.0;
    const gapScale = (w[0] + w[1] + w[2] + w[3] + w[4] + w[5] + w[6] + w[7]) * 0.45 + 1e-9;
    gapTight[i] = max(0.0, min(1.0, 1.0 - avgGap / gapScale));
    kCountOf[i] = kCount;
  }

  // Context / regime
  const emaTrend = A(ta.ema(S(src), TREND_LEN));
  const emaQuick = A(ta.ema(S(src), 5));
  const atrPct = A(ta.percentrank(S(atrVal), 100));
  const ema5 = A(ta.ema(S(rOsc), 5));
  const convInst = analogScore.map((x) => max(-1.0, min(1.0, x / 1.5)));
  const convSmoothed = A(ta.ema(S(convInst), SMOOTH_LEN));
  const stAtr = A(ta.atr(bars, ST_ATR_LEN));

  const stLong = new Array<number>(n);
  const stShort = new Array<number>(n);
  const stDir = new Array<number>(n);
  const stLine = new Array<number>(n);
  const rank = new Array<number>(n);
  const conf = new Array<number>(n);
  const triggerLong = new Array<boolean>(n);
  const triggerShort = new Array<boolean>(n);
  const changed: boolean[] = [];
  let stanceState = 0;
  let stanceAge = 0;
  let lastEntryBar = NaN;
  const volBandLo = cfg.volBandLo;
  for (let i = 0; i < n; i++) {
    const trendForce = gt(atrVal[i], 0) ? Math.abs(emaQuick[i] - emaTrend[i]) / atrVal[i] : 0.0;
    const chopRaw = lt(trendForce, CHOP_CUT);
    const slopeUp = gt(rOsc[i], ago(rOsc, i, STEP));
    const oscReg = emaR20[i];
    const chopNow = cfg.useChop ? chopRaw : false;

    // ML adaptive supertrend
    let mlDrive = max(0.0, min(1.0, Math.abs(convSmoothed[i]) * 0.5 + gapTight[i] * 0.3 + agreeFrac[i] * 0.2));
    mlDrive = chopNow ? mlDrive * 0.35 : mlDrive;
    const adaptMult = cfg.stMultBase * (1.0 + cfg.stMlResp * (1.0 - mlDrive));
    const upBand = stSrc[i] - adaptMult * stAtr[i];
    const dnBand = stSrc[i] + adaptMult * stAtr[i];
    const pLong = i > 0 ? stLong[i - 1] : NaN;
    const pShort = i > 0 ? stShort[i - 1] : NaN;
    const pDir = i > 0 ? stDir[i - 1] : NaN;
    const pClose = i > 0 ? close[i - 1] : NaN;
    stLong[i] = Number.isNaN(pLong) ? upBand : gt(pClose, pLong) ? max(upBand, pLong) : upBand;
    stShort[i] = Number.isNaN(pShort) ? dnBand : lt(pClose, pShort) ? min(dnBand, pShort) : dnBand;
    stDir[i] = Number.isNaN(pDir) ? 1
      : pDir === -1 && gt(close[i], pShort) ? 1 : pDir === 1 && lt(close[i], pLong) ? -1 : pDir;
    stLine[i] = stDir[i] === 1 ? stLong[i] : stShort[i];

    // context
    const bd = biasDir[i];
    const upTrend = stDir[i] === 1;
    const downTrend = stDir[i] === -1;
    const aligned = (bd === 1 && upTrend) || (bd === -1 && downTrend);
    const ap = atrPct[i];
    const volHealthy = ge(ap, volBandLo) && le(ap, VOL_BAND_HI);
    const slopeFit = (bd === 1 && slopeUp) || (bd === -1 && !slopeUp);
    const stretched = (bd === 1 && gt(rOsc[i], 70)) || (bd === -1 && lt(rOsc[i], 30));
    const oscSmoothUp = gt(ema5[i], ago(ema5, i, 1));

    // signal state / persistence
    const gatesPass = (!cfg.useTrendGate || aligned) && (!cfg.useVolBand || volHealthy) && !chopNow;
    const prevState = stanceState;
    stanceState = bd === 1 && gatesPass ? 1 : bd === -1 && gatesPass ? -1 : prevState;
    const stanceChanged = i > 0 && stanceState !== prevState;
    changed.push(stanceChanged);
    stanceAge = stanceChanged ? 0 : stanceAge + 1;
    const earlyFlip = stanceChanged && (changed[i - 1] === true || changed[i - 2] === true || changed[i - 3] === true);

    // rank / confidence
    const k = kCountOf[i];
    const agree = agreeFrac[i];
    const tight = gapTight[i];
    const pAgree = 25.0 * agree;
    const pGap = 15.0 * tight;
    const pStruct = (slopeFit ? 10.0 : 0.0) + (stretched ? 0.0 : 5.0);
    const pTrend = aligned ? 10.0 : 0.0;
    const pVol = volHealthy ? 10.0 : lt(ap, volBandLo) ? 5.0 : 3.0;
    const regFit = (bd === 1 && gt(oscReg, 55)) || (bd === -1 && lt(oscReg, 45));
    const pReg = regFit ? 10.0 : ge(oscReg, 45) && le(oscReg, 55) ? 4.0 : 6.0;
    const pSmooth = (bd === 1 && oscSmoothUp) || (bd === -1 && !oscSmoothUp) ? 5.0 : 0.0;
    const pHold = Math.min(5.0, stanceAge);
    const pPen = Math.min(20.0, (chopRaw ? 8.0 : 0.0) + (stretched ? 6.0 : 0.0) + (earlyFlip ? 6.0 : 0.0)
      + (k < kNeighbors ? 5.0 * (kNeighbors - k) / kNeighbors : 0.0));
    const rawRank = pAgree + pGap + pStruct + pTrend + pVol + pReg + pSmooth + pHold - pPen;
    const rk = bd === 0 ? 0.0 : max(0.0, min(100.0, rawRank));
    const rawConf = 40.0 * agree + 25.0 * tight + 15.0 * Math.min(1.0, stanceAge / 5.0) + 10.0 * (slopeFit ? 1.0 : 0.0)
      - (earlyFlip ? 15.0 : 0.0) - (k < kNeighbors ? 10.0 * (kNeighbors - k) / kNeighbors : 0.0);
    const cf = bd === 0 ? 0.0 : max(0.0, min(100.0, rawConf));
    rank[i] = rk;
    conf[i] = cf;

    // signals
    const flipLong = stanceState === 1 && i > 0 && prevState !== 1;
    const flipShort = stanceState === -1 && i > 0 && prevState !== -1;
    const qualifies = ge(rk, cfg.gateRank) && ge(cf, cfg.gateConf);
    const barOK = confirmed(i);
    const coolOK = Number.isNaN(lastEntryBar) || i - lastEntryBar >= COOL_BARS;
    triggerLong[i] = flipLong && qualifies && coolOK && barOK;
    triggerShort[i] = flipShort && qualifies && coolOK && barOK;
    if (triggerLong[i] || triggerShort[i]) lastEntryBar = i;
  }

  // regime tone and ML RSI
  const intensity = A(ta.ema(S(rank), 3)).map((x) => max(0.0, min(1.0, x / 100.0)));
  const tilted = rOsc.map((x, i) => max(0.0, min(100.0, x + max(-1.0, min(1.0, convSmoothed[i])) * intensity[i] * 18.0)));
  const mlRSI = A(ta.ema(S(tilted), 3));

  // RSI signal line
  const maType = cfg.maTypeInput;
  const maLen = Math.trunc(cfg.maLengthInput);
  const enableMA = maType !== 'None';
  const isBB = maType === 'SMA + Bollinger Bands';
  const ml = S(mlRSI);
  const smoothingMA = !enableMA ? new Array<number>(n).fill(NaN)
    : maType === 'SMA' || isBB ? A(ta.sma(ml, maLen))
      : maType === 'EMA' ? A(ta.ema(ml, maLen))
        : maType === 'SMMA (RMA)' ? A(ta.rma(ml, maLen))
          : maType === 'WMA' ? A(ta.wma(ml, maLen))
            : A(ta.vwma(ml, maLen, new Series(bars, (b) => b.volume ?? NaN)));
  const smoothingStdev = isBB ? A(ta.stdev(ml, maLen)).map((x) => x * cfg.bbMultInput) : new Array<number>(n).fill(NaN);

  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const time = (i: number) => bars[i].time;
  const tone = (i: number) => (stDir[i] === 1 ? cfg.trailBull : cfg.trailBear);
  const bbLineCol = String(color.new(cfg.smoothLineCol, 40));
  const upGlow = String(color.new(cfg.trailBull, 70));
  const dnGlow = String(color.new(cfg.trailBear, 70));

  const plots: IndicatorResult['plots'] = {
    plot0: bars.map((b) => ({ time: b.time, value: 50 })),
    plot1: bars.map((b, i) => ({
      time: b.time, value: fin(mlRSI[i]),
      color: String(color.from_gradient(mlRSI[i], 28, 72, cfg.rsiBear, cfg.rsiBull) ?? 'transparent'),
    })),
    plot2: bars.map((b, i) => ({ time: b.time, value: fin(smoothingMA[i]), color: enableMA ? cfg.smoothLineCol : 'transparent' })),
    plot3: bars.map((b, i) => ({ time: b.time, value: isBB ? fin(smoothingMA[i] + smoothingStdev[i]) : NaN, color: isBB ? bbLineCol : 'transparent' })),
    plot4: bars.map((b, i) => ({ time: b.time, value: isBB ? fin(smoothingMA[i] - smoothingStdev[i]) : NaN, color: isBB ? bbLineCol : 'transparent' })),
  };
  const stUp = stLine.map((v, i) => (cfg.showSt && stDir[i] === 1 ? fin(v) : NaN));
  const stDn = stLine.map((v, i) => (cfg.showSt && stDir[i] === -1 ? fin(v) : NaN));
  plots.plot5 = bars.map((b, i) => ({ time: b.time, value: stUp[i], color: upGlow }));
  plots.plot6 = bars.map((b, i) => ({ time: b.time, value: stDn[i], color: dnGlow }));
  plots.plot7 = bars.map((b, i) => ({ time: b.time, value: stUp[i], color: cfg.trailBull }));
  plots.plot8 = bars.map((b, i) => ({ time: b.time, value: stDn[i], color: cfg.trailBear }));
  // ML trend cloud
  const cloudLine = stLine.map((v) => (cfg.showSt ? v : NaN));
  const cloudRef = stSrc.map((v) => (cfg.showSt ? v : NaN));
  const layer = (f: number) => cloudLine.map((l, i) => (!Number.isNaN(l) && !Number.isNaN(cloudRef[i]) ? l + (cloudRef[i] - l) * f : NaN));
  const cloud = [cloudLine, layer(0.25), layer(0.5), layer(0.75), cloudRef];
  cloud.forEach((v, c) => {
    plots[`plot${9 + c}`] = bars.map((b, i) => ({ time: b.time, value: fin(v[i]), color: NEUTRAL }));
  });

  // candles coloured by the trailing stop direction
  const candles: PlotCandleData[] = bars.map((b, i) => {
    const col = cfg.paintBars ? String(color.new(tone(i), 0)) : 'transparent';
    return { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, color: col, wickColor: col, borderColor: col, forceOverlay: true };
  });

  // markers: supertrend flips, then the signals (tiny, then small at transparency 50)
  const placebuy = A(ta.lowest(new Series(bars, (b) => b.low), 5));
  const placesell = A(ta.highest(new Series(bars, (b) => b.high), 5));
  const markers: MarkerData[] = [];
  const mark = (i: number, price: number, shape: 'circle' | 'triangleUp' | 'triangleDown', col: string, size: 'tiny' | 'small', id: string) => {
    if (!Number.isNaN(price)) {
      markers.push({ time: time(i), id, position: 'atPriceMiddle', price, shape, color: col, size, forceOverlay: true });
    }
  };
  for (let i = 0; i < n; i++) {
    const p = i > 0 ? stDir[i - 1] : NaN;
    if (cfg.showSt && stDir[i] === 1 && p === -1) mark(i, stLine[i], 'circle', cfg.trailBull, 'tiny', 'shape0');
    if (cfg.showSt && stDir[i] === -1 && p === 1) mark(i, stLine[i], 'circle', cfg.trailBear, 'tiny', 'shape1');
  }
  for (let i = 0; i < n; i++) {
    if (cfg.showMarks && triggerLong[i]) mark(i, placebuy[i], 'triangleUp', cfg.sigBull, 'tiny', 'shape2');
    if (cfg.showMarks && triggerShort[i]) mark(i, placesell[i], 'triangleDown', cfg.sigBear, 'tiny', 'shape3');
    if (cfg.showMarks && triggerLong[i]) mark(i, placebuy[i], 'triangleUp', String(color.new(cfg.sigBull, 50)), 'small', 'shape4');
    if (cfg.showMarks && triggerShort[i]) mark(i, placesell[i], 'triangleDown', String(color.new(cfg.sigBear, 50)), 'small', 'shape5');
  }

  // alertcondition(...) and, on confirmed bars, alert(..., alert.freq_once_per_bar_close)
  const flipUp = stDir.map((d, i) => i > 0 && d === 1 && stDir[i - 1] === -1);
  const flipDn = stDir.map((d, i) => i > 0 && d === -1 && stDir[i - 1] === 1);
  const anySignal = triggerLong.map((v, i) => v || triggerShort[i]);
  const anyFlip = flipUp.map((v, i) => v || flipDn[i]);
  const ticker = tickerOf(chart);
  const period = chartTimeframe(bars, chart);
  const alertCalls: AlertCall[] = [];
  const call = (i: number, message: string) => alertCalls.push({ time: time(i), message, freq: 'once_per_bar_close' });
  for (let i = 0; i < n; i++) {
    if (!confirmed(i)) continue;
    const scores = `Rank ${str.tostring(rank[i], '#')} / Conf ${str.tostring(conf[i], '#')}`;
    if (triggerLong[i]) call(i, `🟢 LONG  |  ${ticker} (${period})  ${scores}`);
    if (triggerShort[i]) call(i, `🔴 SHORT |  ${ticker} (${period})  ${scores}`);
    if (flipUp[i]) call(i, `▲ Trend Up  |  ${ticker} (${period})`);
    if (flipDn[i]) call(i, `▼ Trend Down  |  ${ticker} (${period})`);
  }

  const fill = (v: number) => new Array<number>(n).fill(v);
  const fillCol = (c: string) => new Array<string>(n).fill(c);
  // showCloud is a constant (true) of the original: the colours do not follow "Show ML Supertrend"
  const cloudFill = (t: number) => bars.map((_b, i) => String(color.new(tone(i), t)));
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: 2 },
    plots,
    hlines: [
      { value: 70, options: { title: 'OB', color: GRAY, linestyle: 'dashed' } },
      { value: 50, options: { title: 'Mid', color: GRAY, linestyle: 'dotted' } },
      { value: 30, options: { title: 'OS', color: GRAY, linestyle: 'dashed' } },
    ],
    fills: [
      { plot1: 'hline_ob', plot2: 'hline_os', options: { title: 'Regime Band Tint' }, colors: fillCol(BAND_TINT) },
      { plot1: 'plot1', plot2: 'plot0', options: { title: 'Overbought Gradient Fill' },
        gradient: { topValue: fill(100), bottomValue: fill(70),
          topColor: fillCol(String(color.new(cfg.rsiBull, 0))), bottomColor: fillCol(String(color.new(cfg.rsiBull, 100))) } },
      { plot1: 'plot1', plot2: 'plot0', options: { title: 'Oversold Gradient Fill' },
        gradient: { topValue: fill(30), bottomValue: fill(0),
          topColor: fillCol(String(color.new(cfg.rsiBear, 100))), bottomColor: fillCol(String(color.new(cfg.rsiBear, 0))) } },
      { plot1: 'plot3', plot2: 'plot4', options: { title: 'Bollinger Bands Fill' }, colors: fillCol(isBB ? cfg.bbAreaCol : 'transparent') },
      { plot1: 'plot9', plot2: 'plot10', options: { title: 'Cloud Fill 1' }, colors: cloudFill(60) },
      { plot1: 'plot10', plot2: 'plot11', options: { title: 'Cloud Fill 2' }, colors: cloudFill(72) },
      { plot1: 'plot11', plot2: 'plot12', options: { title: 'Cloud Fill 3' }, colors: cloudFill(84) },
      { plot1: 'plot12', plot2: 'plot13', options: { title: 'Cloud Fill 4' }, colors: cloudFill(92) },
    ],
    markers,
    plotCandles: { candles },
    alerts: alertStates(alertConditions, bars, [triggerLong, triggerShort, anySignal, flipUp, flipDn, anyFlip]),
    alertCalls,
  };
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Long Signal', message: 'ML RSI: Long signal — rank & confidence gates passed.' },
  { id: 'alert1', title: 'Short Signal', message: 'ML RSI: Short signal — rank & confidence gates passed.' },
  { id: 'alert2', title: 'Any Signal', message: 'ML RSI: New entry signal.' },
  { id: 'alert3', title: 'Trend Flip Up', message: 'ML Supertrend flipped to UPTREND.' },
  { id: 'alert4', title: 'Trend Flip Down', message: 'ML Supertrend flipped to DOWNTREND.' },
  { id: 'alert5', title: 'Any Trend Flip', message: 'ML Supertrend changed direction.' },
];

export const MachineLearningRsiAiClassificationRanking = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
  alertConditions,
  hasAlertFunction,
};
