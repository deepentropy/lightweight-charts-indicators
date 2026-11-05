/**
 * AI Source Switching Moving Average (Zeiierman)
 *
 * For each price source (open, high, low, close) six features are computed: trend (EMA 10 - EMA 34 over ATR),
 * mean deviation (z-score over 30 bars), momentum (14-bar ROC), volatility (scaled 20-bar stdev), position in the
 * bar range and 3-bar slope. On confirmed bars, rows of the features `horizon` bars back with the forward outcome
 * class (-3..3 by ATR bands) are stored in one memory bank per source (and in a shared bank). A weighted k-nearest
 * neighbour search (feature weights optimised by a Fisher criterion on the shared bank) scores each source by the
 * analog outcome, agreement and tightness, plus an online neural score (linear model trained with Adam and Huber
 * gradient on the close features). The best ranked source, EMA smoothed, feeds the moving average and an
 * adaptive-ATR supertrend trail whose band width follows the model drive. Glow fills, flip triangles and optional
 * source-switch labels and trend candles.
 *
 * Alerts (alertcondition, `alerts` of the result): the supertrend flipping up / down and the selected source changing.
 *
 * Reference: "AI Source Switching Moving Average (Zeiierman)" by Zeiierman
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';
import type { MarkerData, PlotCandleData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';

const MA_TYPES = ['SMA', 'EMA', 'WMA', 'VWMA', 'RMA', 'HMA', 'TEMA', 'ZLEMA', 'KAMA', 'ALMA'];

export interface AISourceSwitchingMovingAverageInputs {
  maType: string;
  maLen: number;
  /** AI source smoothing (EMA length of the selected source) */
  srcSmoothLen: number;
  /** Memory depth (rows per source bank) */
  memoryDepth: number;
  /** Analog count (k nearest neighbours) */
  kNeighbors: number;
  /** Learning horizon (bars) */
  horizonBars: number;
  /** Analog spacing (rows) */
  spacingBars: number;
  /** Learning sensitivity x ATR */
  learnAtrFactor: number;
  useNeural: boolean;
  neuralInfluence: number;
  learnRate: number;
  huberD: number;
  /** Auto optimise feature weights (Fisher) */
  useFisher: boolean;
  fisherSpeed: number;
  fisherFloor: number;
  minRows: number;
  showST: boolean;
  stLen: number;
  stMult: number;
  stAdapt: number;
  bullCol: string;
  bearCol: string;
  neutralCol: string;
  showCandles: boolean;
  showSourceMarks: boolean;
  showFlipMarks: boolean;
  showMAGlow: boolean;
  showTrailGlow: boolean;
}

export const defaultInputs: AISourceSwitchingMovingAverageInputs = {
  maType: 'EMA',
  maLen: 50,
  srcSmoothLen: 3,
  memoryDepth: 40,
  kNeighbors: 9,
  horizonBars: 4,
  spacingBars: 4,
  learnAtrFactor: 0.45,
  useNeural: true,
  neuralInfluence: 0.35,
  learnRate: 0.01,
  huberD: 0.02,
  useFisher: true,
  fisherSpeed: 0.20,
  fisherFloor: 0.40,
  minRows: 80,
  showST: true,
  stLen: 10,
  stMult: 1.7,
  stAdapt: 0.80,
  bullCol: '#00e676',
  bearCol: '#ff5252',
  neutralCol: color.gray,
  showCandles: false,
  showSourceMarks: false,
  showFlipMarks: true,
  showMAGlow: true,
  showTrailGlow: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'EMA', options: MA_TYPES },
  { id: 'maLen', type: 'int', title: 'MA Length', defval: 50, min: 2 },
  { id: 'srcSmoothLen', type: 'int', title: 'AI Source Smoothing', defval: 3, min: 1 },
  { id: 'memoryDepth', type: 'int', title: 'Memory Depth', defval: 40, min: 5, max: 2000 },
  { id: 'kNeighbors', type: 'int', title: 'Analog Count', defval: 9, min: 1, max: 50 },
  { id: 'horizonBars', type: 'int', title: 'Learning Horizon', defval: 4, min: 1, max: 20 },
  { id: 'spacingBars', type: 'int', title: 'Analog Spacing', defval: 4, min: 1, max: 20 },
  { id: 'learnAtrFactor', type: 'float', title: 'Learning Sensitivity x ATR', defval: 0.45, min: 0.05, step: 0.05 },
  { id: 'useNeural', type: 'bool', title: 'Use Neural Online Training', defval: true },
  { id: 'neuralInfluence', type: 'float', title: 'Neural Influence', defval: 0.35, min: 0, max: 1, step: 0.05 },
  { id: 'learnRate', type: 'float', title: 'Learning Rate', defval: 0.01, min: 0.001, max: 0.1, step: 0.001 },
  { id: 'huberD', type: 'float', title: 'Huber Delta', defval: 0.02, min: 0.001, max: 0.2, step: 0.001 },
  { id: 'useFisher', type: 'bool', title: 'Auto Optimize Feature Weights', defval: true },
  { id: 'fisherSpeed', type: 'float', title: 'Adaptation Speed', defval: 0.20, min: 0.005, max: 1, step: 0.005 },
  { id: 'fisherFloor', type: 'float', title: 'Weight Floor', defval: 0.40, min: 0.05, max: 2, step: 0.05 },
  { id: 'minRows', type: 'int', title: 'Minimum Rows', defval: 80, min: 20, max: 500 },
  { id: 'showST', type: 'bool', title: 'Show AI Supertrend', defval: true },
  { id: 'stLen', type: 'int', title: 'ATR Length', defval: 10, min: 1 },
  { id: 'stMult', type: 'float', title: 'ATR Multiplier', defval: 1.7, min: 0.5, step: 0.1 },
  { id: 'stAdapt', type: 'float', title: 'AI Band Adaptivity', defval: 0.80, min: 0, max: 1, step: 0.05 },
  { id: 'bullCol', type: 'color', title: 'Bullish', defval: '#00e676' },
  { id: 'bearCol', type: 'color', title: 'Bearish', defval: '#ff5252' },
  { id: 'neutralCol', type: 'color', title: 'Neutral', defval: color.gray },
  { id: 'showCandles', type: 'bool', title: 'Show AI Trend Candles', defval: false },
  { id: 'showSourceMarks', type: 'bool', title: 'Show AI Source Switch Marks', defval: false },
  { id: 'showFlipMarks', type: 'bool', title: 'Show Supertrend Flip Marks', defval: true },
  { id: 'showMAGlow', type: 'bool', title: 'Show MA Glow', defval: true },
  { id: 'showTrailGlow', type: 'bool', title: 'Show Trail Glow', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'AI Source Adaptive MA', color: '#00e676', lineWidth: 2 },
  { id: 'plot1', title: 'AI Supertrend Up', color: '#00e676', lineWidth: 2, style: 'linebr' },
  { id: 'plot2', title: 'AI Supertrend Down', color: '#ff5252', lineWidth: 2, style: 'linebr' },
  { id: 'plot3', title: 'Glow Anchor', color: 'transparent', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'AI Source Switching Moving Average (Zeiierman)',
  shortTitle: 'AI Source Switching MA',
  overlay: true,
};

type Arr = number[];
/** Six features of one source */
type Feat = [Arr, Arr, Arr, Arr, Arr, Arr];

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(x, hi));
const compress = (d: number) => Math.log(1.0 + Math.abs(d));
const normScore = (x: number) => 1.0 / (1.0 + Math.exp(-clamp(x, -8, 8)));

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> }
  & { alerts: AlertConditionState[] };

/** The machines of the six features of one source */
interface FeatSteps {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  basis: ReturnType<typeof taStep.sma>;
  dev: ReturnType<typeof taStep.stdev>;
  sd: ReturnType<typeof taStep.stdev>;
  lo: ReturnType<typeof taStep.lowest>;
  hi: ReturnType<typeof taStep.highest>;
}

/** ma(src, len, typ) of the script on bar i: `src` the AI source of every bar so far, `out` its earlier results */
interface MaStep extends Committable {
  step(i: number, src: number[], out: number[], volume: number): number;
}

interface AiVars {
  /** One bank per source, newest row first (matrix.add_row(0, row)); the rows are not changed once added */
  banks: number[][][];
  bankAll: number[][];
  wAuto: number[];
  /** Adam state of the neural weights (changed in place) */
  nw: number[];
  mo: number[];
  ve: number[];
  step: number;
}

interface AiRun extends BarRunState<AiVars> {
  atrNow: ReturnType<typeof taStep.atr>;
  featSteps: FeatSteps[];
  srcEma: ReturnType<typeof taStep.ema>;
  ma: MaStep;
  stAtrStep: ReturnType<typeof taStep.atr>;
  srcs: Arr[];
  atr: Arr;
  close: Arr;
  feats: Feat[];
  bestId: number[];
  aiSource: Arr;
  aiMA: Arr;
  stLong: Arr;
  stShort: Arr;
  stDir: number[];
  trailUp: Arr;
  trailDn: Arr;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: { time: number; value: number }[];
  maGlow: (string | null)[];
  upGlow: (string | null)[];
  dnGlow: (string | null)[];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
  candles: PlotCandleData[];
}

function study(inputs: Partial<AISourceSwitchingMovingAverageInputs>): BarStudy<AiRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const h = cfg.horizonBars;
  const back = (a: Arr, i: number, k: number) => (i - k >= 0 ? a[i - k] : NaN);
  const at = (f: Feat, i: number): number[] => {
    const ok = i >= 0;
    return [ok ? f[0][i] : NaN, ok ? f[1][i] : NaN, ok ? f[2][i] : NaN, ok ? f[3][i] : NaN, ok ? f[4][i] : NaN, ok ? f[5][i] : NaN];
  };
  const valid = (v: number[]) => v.every((x) => !isNaN(x));
  const addBank = (m: number[][], row: number[], limit: number) => {
    m.unshift(row);
    if (m.length > limit) m.pop();
  };
  const c = (col: string, transp: number) => String(color.new(col, transp));
  // the colours of the plots (the same strings on every bar)
  const bull0 = c(cfg.bullCol, 0);
  const bear0 = c(cfg.bearCol, 0);
  const bull85 = c(cfg.bullCol, 85);
  const bear85 = c(cfg.bearCol, 85);
  const bull50 = c(cfg.bullCol, 50);
  const bear50 = c(cfg.bearCol, 50);
  const ONES = [1, 1, 1, 1, 1, 1];

  // autoFeatureWeights(m, minN, floor): Fisher score of each feature between bullish and bearish rows
  const autoFeatureWeights = (m: number[][]): number[] => {
    const imp = [1, 1, 1, 1, 1, 1];
    if (m.length < cfg.minRows) return imp;
    const sumB = [0, 0, 0, 0, 0, 0];
    const sumS = [0, 0, 0, 0, 0, 0];
    const sqB = [0, 0, 0, 0, 0, 0];
    const sqS = [0, 0, 0, 0, 0, 0];
    let cntB = 0;
    let cntS = 0;
    for (const row of m) {
      const cls = row[6];
      if (cls !== 0) {
        const isBull = cls > 0;
        for (let j = 0; j < 6; j++) {
          const val = row[j];
          if (isBull) {
            sumB[j] += val;
            sqB[j] += val * val;
          } else {
            sumS[j] += val;
            sqS[j] += val * val;
          }
        }
        cntB += isBull ? 1 : 0;
        cntS += isBull ? 0 : 1;
      }
    }
    if (cntB > 3 && cntS > 3) {
      let maxF = 0.0;
      const fish = [0, 0, 0, 0, 0, 0];
      for (let j = 0; j < 6; j++) {
        const meanB = sumB[j] / cntB;
        const meanS = sumS[j] / cntS;
        const varB = Math.max(0.0, sqB[j] / cntB - meanB * meanB);
        const varS = Math.max(0.0, sqS[j] / cntS - meanS * meanS);
        const f = Math.pow(meanB - meanS, 2) / (varB + varS + 0.000001);
        fish[j] = f;
        maxF = Math.max(maxF, f);
      }
      for (let j = 0; j < 6; j++) imp[j] = Math.max(cfg.fisherFloor, (maxF > 0 ? fish[j] / maxF : 1.0) * 8.0);
    }
    return imp;
  };

  // knnScore(features, bank) -> [analog, agree, tight, k]
  const knnScore = (x: number[], bank: number[][], w: number[]): [number, number, number, number] => {
    const gaps: number[] = [];
    const classes: number[] = [];
    const rows = bank.length;
    const scanEnd = Math.min(rows - 1, cfg.memoryDepth - 1);
    if (rows > 1 && valid(x)) {
      for (let r = 0; r <= scanEnd; r++) {
        if (r % cfg.spacingBars !== 0) continue;
        const row = bank[r];
        let g = 0;
        for (let j = 0; j < 6; j++) g += w[j] * compress(x[j] - row[j]);
        const cls = row[6];
        if (!isNaN(g) && cls !== 0) {
          if (gaps.length < cfg.kNeighbors) {
            gaps.push(g);
            classes.push(cls);
          } else {
            let worst = 0;
            let worstGap = gaps[0];
            for (let j = 1; j < gaps.length; j++) {
              if (gaps[j] > worstGap) {
                worstGap = gaps[j];
                worst = j;
              }
            }
            if (g < worstGap) {
              gaps[worst] = g;
              classes[worst] = cls;
            }
          }
        }
      }
    }
    let total = 0;
    let bull = 0;
    let bear = 0;
    let score = 0;
    let gapSum = 0;
    const k = gaps.length;
    for (let j = 0; j < k; j++) {
      const wg = 1.0 / (1.0 + gaps[j]);
      total += wg;
      score += classes[j] * wg;
      bull += classes[j] > 0 ? wg : 0.0;
      bear += classes[j] < 0 ? wg : 0.0;
      gapSum += gaps[j];
    }
    const analog = total > 0 ? score / total : 0.0;
    const dir = analog > 0.15 ? 1 : analog < -0.15 ? -1 : 0;
    const agree = total > 0 ? (dir === 1 ? bull : dir === -1 ? bear : 0.0) / total : 0.0;
    const avgGap = k > 0 ? gapSum / k : 0.0;
    const gapScale = (w[0] + w[1] + w[2] + w[3] + w[4] + w[5]) * 0.45 + 0.000001;
    const tight = clamp(1.0 - avgGap / gapScale, 0.0, 1.0);
    return [analog, agree, tight, k];
  };

  const beta1 = 0.9;
  const beta2 = 0.999;
  const eps = 0.00000001;

  return {
    init() {
      const atrNow = taStep.atr(14);
      const featSteps: FeatSteps[] = [0, 1, 2, 3].map(() => ({
        fast: taStep.ema(10), slow: taStep.ema(34), basis: taStep.sma(), dev: taStep.stdev(), sd: taStep.stdev(),
        lo: taStep.lowest(), hi: taStep.highest(),
      }));
      const srcEma = taStep.ema(cfg.srcSmoothLen);
      const ma = movingAverage(cfg.maLen, cfg.maType);
      const stAtrStep = taStep.atr(cfg.stLen);
      const s: AiRun = {
        atrNow, featSteps, srcEma, ma, stAtrStep,
        srcs: [[], [], [], []], atr: [], close: [],
        feats: [0, 1, 2, 3].map(() => [[], [], [], [], [], []] as Feat),
        bestId: [], aiSource: [], aiMA: [], stLong: [], stShort: [], stDir: [], trailUp: [], trailDn: [],
        plot0: [], plot1: [], plot2: [], plot3: [], maGlow: [], upGlow: [], dnGlow: [],
        flags: [[], [], []], times: [[], [], []], markers: [], candles: [],
        steps: [
          atrNow, ...featSteps.flatMap((f) => [f.fast, f.slow, f.basis, f.dev, f.sd, f.lo, f.hi]), srcEma, ma, stAtrStep,
        ],
        vars: {
          banks: [[], [], [], []], bankAll: [], wAuto: [1, 1, 1, 1, 1, 1],
          nw: [0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.0], mo: [0, 0, 0, 0, 0, 0, 0], ve: [0, 0, 0, 0, 0, 0, 0], step: 0,
        },
        lists: [], series: [],
      };
      s.lists = [...s.times, s.markers, s.candles];
      s.series = [
        ...s.srcs, s.atr, s.close, ...s.feats.flat(), s.bestId, s.aiSource, s.aiMA, s.stLong, s.stShort, s.stDir,
        s.trailUp, s.trailDn, s.plot0, s.plot1, s.plot2, s.plot3, s.maGlow, s.upGlow, s.dnGlow, ...s.flags,
      ];
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i];
      const t = bar.time;
      const { srcs, atr: atrNow, close, feats } = s;
      srcs[0][i] = bar.open;
      srcs[1][i] = bar.high;
      srcs[2][i] = bar.low;
      srcs[3][i] = bar.close;
      close[i] = bar.close;
      atrNow[i] = s.atrNow.step(bar.high, bar.low, bar.close);
      const high = bar.high;
      const low = bar.low;

      // featTrend, featMean, featMomentum, featVol, featRange, featSlope of one source
      for (let k = 0; k < 4; k++) {
        const src = srcs[k];
        const m = s.featSteps[k];
        const f = feats[k];
        const v = src[i];
        const fast = m.fast.step(v);
        const slow = m.slow.step(v);
        f[0][i] = atrNow[i] === 0 ? 0 : clamp((fast - slow) / atrNow[i], -3, 3) / 3;
        const basis = m.basis.step(v, 30);
        const dev = m.dev.step(v, 30);
        const z = dev === 0 ? 0 : (v - basis) / dev;
        f[1][i] = clamp(-z, -3, 3) / 3;
        f[2][i] = clamp((v / back(src, i, 14) - 1.0) / 0.05, -3, 3) / 3;
        // scale01(ta.stdev(src, 20), 100) * 2 - 1
        const x = m.sd.step(v, 20);
        const lo = m.lo.step(x, 100);
        const hi = m.hi.step(x, 100);
        f[3][i] = (hi === lo ? 0.5 : clamp((x - lo) / (hi - lo), 0.0, 1.0)) * 2.0 - 1.0;
        const rng = high - low;
        f[4][i] = rng === 0 ? 0 : clamp(((v - low) / rng) * 2.0 - 1.0, -1, 1);
        f[5][i] = atrNow[i] === 0 ? 0 : clamp((v - back(src, i, 3)) / atrNow[i], -3, 3) / 3;
      }

      // changed in place: copyVars copies them at the end of the last confirmed bar
      const vs = s.vars;
      const { banks, bankAll, nw, mo, ve } = vs;
      // outcome of the bar `horizon` bars back: forward move against ATR bands
      const moveFwd = close[i] - back(close, i, h);
      const bandFwd = cfg.learnAtrFactor * back(atrNow, i, h);
      const outcome = moveFwd > 2 * bandFwd ? 3 : moveFwd > bandFwd ? 2 : moveFwd > 0 ? 1
        : moveFwd < -2 * bandFwd ? -3 : moveFwd < -bandFwd ? -2 : moveFwd < 0 ? -1 : 0;
      const past = [at(feats[0], i - h), at(feats[1], i - h), at(feats[2], i - h), at(feats[3], i - h)];
      // every historical bar is confirmed
      if (i > h + 120) {
        for (let k = 0; k < 4; k++) {
          if (valid(past[k])) {
            const row = [...past[k], outcome];
            addBank(banks[k], row, cfg.memoryDepth);
            addBank(bankAll, row, cfg.memoryDepth * 4);
          }
        }
      }
      if (cfg.useFisher) {
        const wRaw = autoFeatureWeights(bankAll);
        vs.wAuto = vs.wAuto.map((prev, j) => prev + cfg.fisherSpeed * (wRaw[j] - prev));
      }
      const w = cfg.useFisher ? vs.wAuto : ONES;
      const cur = [at(feats[0], i), at(feats[1], i), at(feats[2], i), at(feats[3], i)];
      const knn = cur.map((x, k) => knnScore(x, banks[k], w));

      // neural training on the close features `horizon` bars back (Huber gradient, Adam)
      const targetDir = outcome > 0 ? 1.0 : outcome < 0 ? -1.0 : 0.0;
      const pc = past[3];
      const trainPred = pc.reduce((acc, v, j) => acc + nw[j] * v, 0) + nw[6];
      const trainErr = trainPred - targetDir;
      const trainGrad = Math.abs(trainErr) <= cfg.huberD ? trainErr : cfg.huberD * Math.sign(trainErr);
      if (cfg.useNeural && i > h + 120 && valid(pc) && targetDir !== 0) {
        vs.step += 1;
        for (let j = 0; j < 7; j++) {
          const grad = j < 6 ? trainGrad * pc[j] : trainGrad;
          const newMom = beta1 * mo[j] + (1.0 - beta1) * grad;
          const newVel = beta2 * ve[j] + (1.0 - beta2) * grad * grad;
          const mHat = newMom / (1.0 - Math.pow(beta1, vs.step));
          const vHat = newVel / (1.0 - Math.pow(beta2, vs.step));
          nw[j] = nw[j] - (cfg.learnRate * mHat) / (Math.sqrt(vHat) + eps);
          mo[j] = newMom;
          ve[j] = newVel;
        }
      }

      // rankSource: analog, agreement, tightness, neural score and a full-k bonus, clamped to 0..1
      const rank = cur.map((x, k) => {
        const neural = cfg.useNeural ? x.reduce((acc, v, j) => acc + nw[j] * v, 0) + nw[6] : 0.0;
        const [analog, agree, tight, kk] = knn[k];
        const raw = (Math.abs(analog) / 3.0) * 0.35 + agree * 0.25 + tight * 0.20 + normScore(neural) * cfg.neuralInfluence
          + (kk >= cfg.kNeighbors ? 0.10 : 0.0) - 0.0;
        return clamp(raw, 0.0, 1.0);
      });
      const ready = banks.every((b) => b.length > 20);
      const [rO, rH, rL, rC] = ready ? rank : [0.25, 0.25, 0.25, 0.25];
      const bestId = s.bestId;
      bestId[i] = rO >= rH && rO >= rL && rO >= rC ? 0 : rH >= rL && rH >= rC ? 1 : rL >= rC ? 2 : 3;
      const avg = (k: number) => knn.reduce((acc, r) => acc + r[k], 0) / 4.0;
      const aiDrive = clamp(Math.abs(avg(0)) * 0.20 + avg(1) * 0.40 + avg(2) * 0.40, 0.0, 1.0);

      const hardSrc = srcs[bestId[i]][i];
      const aiSource = s.aiSource;
      aiSource[i] = s.srcEma.step(hardSrc);
      s.aiMA[i] = s.ma.step(i, aiSource, s.aiMA, bar.volume ?? NaN);

      // adaptive supertrend on the AI source
      const { stLong, stShort, stDir } = s;
      const stAtr = s.stAtrStep.step(bar.high, bar.low, bar.close);
      const adaptMult = cfg.stMult * (1.0 + cfg.stAdapt * (1.0 - aiDrive));
      const upBand = aiSource[i] - adaptMult * stAtr;
      const dnBand = aiSource[i] + adaptMult * stAtr;
      const pL = i > 0 ? stLong[i - 1] : NaN;
      const pS = i > 0 ? stShort[i - 1] : NaN;
      const pcl = i > 0 ? close[i - 1] : NaN;
      stLong[i] = isNaN(pL) ? upBand : pcl > pL ? Math.max(upBand, pL) : upBand;
      stShort[i] = isNaN(pS) ? dnBand : pcl < pS ? Math.min(dnBand, pS) : dnBand;
      // stDir := na(stDir[1]) ? 1 : stDir[1] == -1 and close > stShort[1] ? 1 : stDir[1] == 1 and close < stLong[1] ? -1 : nz(stDir[1], 1)
      if (i === 0) stDir[i] = 1;
      else {
        const pd = stDir[i - 1];
        stDir[i] = pd === -1 && close[i] > pS ? 1 : pd === 1 && close[i] < pL ? -1 : pd;
      }

      const up = stDir[i] === 1;
      const stLine = up ? stLong[i] : stShort[i];
      const maCol = up ? cfg.bullCol : cfg.bearCol;
      const { trailUp, trailDn } = s;
      trailUp[i] = cfg.showST && up ? stLine : NaN;
      trailDn[i] = cfg.showST && stDir[i] === -1 ? stLine : NaN;
      s.plot0[i] = { time: t, value: s.aiMA[i], color: maCol };
      s.plot1[i] = { time: t, value: trailUp[i], color: bull0 };
      s.plot2[i] = { time: t, value: trailDn[i], color: bear0 };
      s.plot3[i] = { time: t, value: bar.close };
      s.maGlow[i] = cfg.showMAGlow ? (up ? bull85 : bear85) : null;
      s.upGlow[i] = cfg.showTrailGlow ? bull85 : null;
      s.dnGlow[i] = cfg.showTrailGlow ? bear85 : null;
      const candleCol = up ? bull0 : bear0;
      if (cfg.showCandles) {
        s.candles.push({ time: t, open: bar.open, high: bar.high, low: bar.low, close: bar.close,
          color: candleCol, wickColor: candleCol, borderColor: candleCol });
      }
      // source switch labels (bestId != bestId[1])
      const changed = i > 0 && bestId[i] !== bestId[i - 1];
      if (cfg.showSourceMarks && changed) {
        const marks: MarkerData[] = [
          { id: 'shape0', time: t, position: 'belowBar', shape: 'labelUp', color: c(cfg.neutralCol, 0), text: 'O', textColor: color.white, size: 'tiny' },
          { id: 'shape1', time: t, position: 'belowBar', shape: 'labelUp', color: c(cfg.bullCol, 0), text: 'H', textColor: color.black, size: 'tiny' },
          { id: 'shape2', time: t, position: 'aboveBar', shape: 'labelDown', color: c(cfg.bearCol, 0), text: 'L', textColor: color.white, size: 'tiny' },
          { id: 'shape3', time: t, position: 'belowBar', shape: 'labelUp', color: c(color.white, 0), text: 'C', textColor: color.black, size: 'tiny' },
        ];
        s.markers.push(marks[bestId[i]]);
      }
      // flip triangles at the trail (tiny, and small at transparency 50)
      // stFlipUp = stDir == 1 and stDir[1] == -1, stFlipDn = stDir == -1 and stDir[1] == 1
      const prevDir = i > 0 ? stDir[i - 1] : NaN;
      const flipUp = up && prevDir === -1;
      const flipDn = stDir[i] === -1 && prevDir === 1;
      if (cfg.showFlipMarks && flipUp && !isNaN(trailUp[i])) {
        s.markers.push({ id: 'shape4', time: t, position: 'atPriceMiddle', price: trailUp[i], shape: 'triangleUp', color: cfg.bullCol, size: 'tiny' });
        s.markers.push({ id: 'shape6', time: t, position: 'atPriceMiddle', price: trailUp[i], shape: 'triangleUp', color: bull50, size: 'small' });
      }
      if (cfg.showFlipMarks && flipDn && !isNaN(trailDn[i])) {
        s.markers.push({ id: 'shape5', time: t, position: 'atPriceMiddle', price: trailDn[i], shape: 'triangleDown', color: cfg.bearCol, size: 'tiny' });
        s.markers.push({ id: 'shape7', time: t, position: 'atPriceMiddle', price: trailDn[i], shape: 'triangleDown', color: bear50, size: 'small' });
      }
      // alertcondition(stFlipUp) / (stFlipDn) / (sourceChanged)
      s.flags[0][i] = flipUp;
      s.flags[1][i] = flipDn;
      s.flags[2][i] = changed;
      if (flipUp) s.times[0].push(t as number);
      if (flipDn) s.times[1].push(t as number);
      if (changed) s.times[2].push(t as number);
    },
    copyVars: (v) => ({
      banks: v.banks.map((b) => b.slice()), bankAll: v.bankAll.slice(), wAuto: v.wAuto,
      nw: v.nw.slice(), mo: v.mo.slice(), ve: v.ve.slice(), step: v.step,
    }),
    result(s, bars) {
      const n = bars.length;
      const none = new Array<string | null>(n).fill(null);
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice() },
        // fill(pMA / pTrailUp / pTrailDn, pClose, <line>, close, glow colour, color(na))
        fills: [
          { plot1: 'plot0', plot2: 'plot3', gradient: { topValue: s.aiMA.slice(), bottomValue: s.close.slice(), topColor: s.maGlow.slice(), bottomColor: none } },
          { plot1: 'plot1', plot2: 'plot3', gradient: { topValue: s.trailUp.slice(), bottomValue: s.close.slice(), topColor: s.upGlow.slice(), bottomColor: none } },
          { plot1: 'plot2', plot2: 'plot3', gradient: { topValue: s.trailDn.slice(), bottomValue: s.close.slice(), topColor: s.dnGlow.slice(), bottomColor: none } },
        ],
        markers: s.markers.slice(),
        // plotcandle(showCandles ? open : na, ...): the output is there, with no candle when off
        plotCandles: { aiTrendCandles: s.candles.slice() },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AISourceSwitchingMovingAverageInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<AISourceSwitchingMovingAverageInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> }
  & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'AI Trend Flip Up', message: 'AI Source Adaptive MA flipped bullish' },
  { id: 'alert1', title: 'AI Trend Flip Down', message: 'AI Source Adaptive MA flipped bearish' },
  { id: 'alert2', title: 'AI Source Changed', message: 'AI Source Selector switched OHLC source' },
];

/** ma(src, len, typ) of the script, one bar at a time */
function movingAverage(len: number, typ: string): MaStep {
  const one = (m: { step(v: number): number; commit(): void }): MaStep => ({
    step: (i, src) => m.step(src[i]), commit: () => m.commit(),
  });
  const windowed = (m: { step(v: number, length: number): number; commit(): void }): MaStep => ({
    step: (i, src) => m.step(src[i], len), commit: () => m.commit(),
  });
  switch (typ) {
    case 'SMA': return windowed(taStep.sma());
    case 'WMA': return windowed(taStep.wma());
    case 'VWMA': {
      const m = taStep.vwma(len);
      return { step: (i, src, _out, volume) => m.step(src[i], volume), commit: () => m.commit() };
    }
    case 'RMA': return one(taStep.rma(len));
    case 'HMA': return one(taStep.hma(len));
    case 'TEMA': {
      const e1 = taStep.ema(len);
      const e2 = taStep.ema(len);
      const e3 = taStep.ema(len);
      return {
        step: (i, src) => {
          const a1 = e1.step(src[i]);
          const a2 = e2.step(a1);
          const a3 = e3.step(a2);
          return 3.0 * (a1 - a2) + a3;
        },
        commit: () => { e1.commit(); e2.commit(); e3.commit(); },
      };
    }
    case 'ZLEMA': {
      const lag = Math.max(1, Math.floor((len - 1) / 2));
      const m = taStep.ema(len);
      return {
        step: (i, src) => { const v = src[i]; return m.step(v + (v - (i - lag >= 0 ? src[i - lag] : NaN))); },
        commit: () => m.commit(),
      };
    }
    case 'KAMA': {
      // math.sum(diffAbs, len): the length check of the call
      const t = Math.trunc(len);
      if (t <= 0) throw new Error(`Error on bar 0: Invalid value of the 'length' argument (${t.toFixed(1)}) in the 'sum' function. It must be > 0.`);
      if (t > 5000) throw new Error(`Error on bar 0: The 'sum' function references too many historical candles (${t}), the limit is 5000.`);
      const sum = taStep.sum();
      return {
        step: (i, src, out) => {
          const diffAbs = Math.abs(src[i] - (i > 0 ? src[i - 1] : NaN));
          const vol = sum.step(diffAbs, len);
          const changeAbs = Math.abs(src[i] - (i - len >= 0 ? src[i - len] : NaN));
          const er = vol === 0 ? 0.0 : changeAbs / vol;
          const sc = Math.pow(er * (2.0 / 3.0 - 2.0 / 31.0) + 2.0 / 31.0, 2);
          const prev = i > 0 ? out[i - 1] : NaN;
          return isNaN(prev) ? src[i] : prev + sc * (src[i] - prev);
        },
        commit: () => sum.commit(),
      };
    }
    case 'ALMA': {
      // ta.alma(src, len, 0.85, 6.0) with the weights and the sum order of the oakscriptjs function (same doubles)
      const length = len;
      const t = Math.trunc(length);
      if (t <= 0) throw new Error(`Error on bar 0: Invalid value of the 'length' argument (${t.toFixed(1)}) in the 'alma' function. It must be > 0.`);
      const m = 0.85 * (length - 1);
      const sg = length / 6.0;
      const weights: number[] = [];
      let weightSum = 0;
      for (let i = 0; i < length; i++) {
        const weight = Math.exp(-1 * Math.pow(i - m, 2) / (2 * Math.pow(sg, 2)));
        weights.push(weight);
        weightSum += weight;
      }
      for (let i = 0; i < length; i++) weights[i]! /= weightSum;
      return {
        step: (i, src) => {
          if (i < length - 1) return NaN;
          let almaValue = 0;
          for (let j = 0; j < length; j++) almaValue += src[i - length + 1 + j]! * weights[j]!;
          return almaValue;
        },
        commit: () => {},
      };
    }
    default: return one(taStep.ema(len));
  }
}

export const AISourceSwitchingMovingAverage = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
