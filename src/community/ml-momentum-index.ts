/**
 * Machine Learning Momentum Index (MLMI) [Zeiierman]
 *
 * kNN applied to RSI-derived momentum.
 * Calculate RSI, then quickWMA and slowWMA of RSI.
 * For each bar, find k-nearest historical RSI/WMA patterns and predict next movement.
 * Prediction = weighted average of directional outcomes of k-nearest neighbors.
 *
 * Reference: TradingView "Machine Learning Momentum Index (MLMI) [Zeiierman]" (TV#409)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface MlMomentumIndexInputs {
  rsiLen: number;
  k: number;
  quickLen: number;
  slowLen: number;
  src: SourceType;
}

export const defaultInputs: MlMomentumIndexInputs = {
  rsiLen: 14,
  k: 5,
  quickLen: 5,
  slowLen: 20,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'k', type: 'int', title: 'K Neighbors', defval: 5, min: 1 },
  { id: 'quickLen', type: 'int', title: 'Quick WMA Length', defval: 5, min: 1 },
  { id: 'slowLen', type: 'int', title: 'Slow WMA Length', defval: 20, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Prediction', color: '#426EFF', lineWidth: 2 },
  { id: 'plot1', title: 'Quick WMA', color: '#26A69A', lineWidth: 1 },
  { id: 'plot2', title: 'Slow WMA', color: '#EF5350', lineWidth: 1 },
  { id: 'plot3', title: 'Mid', color: 'transparent', lineWidth: 0 },
  { id: 'plot4', title: 'WMA of Prediction', color: '#31FFC8', lineWidth: 1 },
  { id: 'channelUpper', title: 'Channel Upper', color: 'transparent', lineWidth: 0 },
  { id: 'channelLower', title: 'Channel Lower', color: 'transparent', lineWidth: 0 },
];

export const metadata = {
  title: 'ML Momentum Index',
  shortTitle: 'MLMI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<MlMomentumIndexInputs> = {}): IndicatorResult {
  const { rsiLen, k, quickLen, slowLen, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);
  const n = bars.length;

  const rsiSeries = ta.rsi(source, rsiLen);
  const rsiArr = rsiSeries.toArray();

  const quickWmaArr = ta.wma(rsiSeries, quickLen).toArray();
  const slowWmaArr = ta.wma(rsiSeries, slowLen).toArray();

  const warmup = rsiLen + slowLen;
  const lookback = Math.max(slowLen, 50);

  // kNN prediction on RSI/WMA patterns
  const prediction: number[] = new Array(n).fill(NaN);

  for (let i = warmup; i < n; i++) {
    const curRsi = rsiArr[i] ?? NaN;
    const curQuick = quickWmaArr[i] ?? NaN;
    const curSlow = slowWmaArr[i] ?? NaN;
    if (isNaN(curRsi) || isNaN(curQuick) || isNaN(curSlow)) continue;

    // Feature vector: [RSI, quickWMA, slowWMA]
    const distances: { dist: number; outcome: number }[] = [];
    const start = Math.max(warmup, i - lookback);

    for (let j = start; j < i; j++) {
      const hRsi = rsiArr[j] ?? NaN;
      const hQuick = quickWmaArr[j] ?? NaN;
      const hSlow = slowWmaArr[j] ?? NaN;
      if (isNaN(hRsi) || isNaN(hQuick) || isNaN(hSlow)) continue;

      const dRsi = curRsi - hRsi;
      const dQuick = curQuick - hQuick;
      const dSlow = curSlow - hSlow;
      const dist = Math.sqrt(dRsi * dRsi + dQuick * dQuick + dSlow * dSlow);

      // Outcome: RSI change at historical bar
      const nextRsi = j + 1 < n ? (rsiArr[j + 1] ?? hRsi) : hRsi;
      const outcome = (nextRsi as number) - hRsi;

      distances.push({ dist, outcome });
    }

    distances.sort((a, b) => a.dist - b.dist);
    const kNearest = distances.slice(0, Math.min(k, distances.length));

    if (kNearest.length === 0) continue;

    // Weighted average: closer neighbors have more influence
    let weightSum = 0;
    let predSum = 0;
    for (const nb of kNearest) {
      const w = nb.dist > 0 ? 1 / nb.dist : 1000;
      predSum += w * nb.outcome;
      weightSum += w;
    }

    // Scale prediction to 0-100 range centered at current RSI
    const rawPred = weightSum > 0 ? predSum / weightSum : 0;
    prediction[i] = Math.max(0, Math.min(100, curRsi + rawPred));
  }

  const plot0 = prediction.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
  }));

  const plot1 = (quickWmaArr as (number | null)[]).map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (v ?? NaN),
  }));

  const plot2 = (slowWmaArr as (number | null)[]).map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (v ?? NaN),
  }));

  const plot3 = bars.map((b) => ({ time: b.time, value: 50 }));

  // WMA of prediction (period 20, matching Pine's ta.wma(prediction, 20))
  const wmaLen = 20;
  const predWma: number[] = new Array(n).fill(NaN);
  for (let i = warmup; i < n; i++) {
    // Need wmaLen valid prediction values ending at i
    let wSum = 0;
    let wDenom = 0;
    let count = 0;
    for (let j = 0; j < wmaLen; j++) {
      const idx = i - j;
      if (idx < 0 || isNaN(prediction[idx])) break;
      const w = wmaLen - j;
      wSum += w * prediction[idx];
      wDenom += w;
      count++;
    }
    if (count === wmaLen && wDenom > 0) {
      predWma[i] = wSum / wDenom;
    }
  }

  const plot4 = predWma.map((v, i) => ({
    time: bars[i].time,
    value: isNaN(v) ? NaN : v,
  }));

  // Channel boundary plots for fills
  const channelUpper = bars.map((b) => ({ time: b.time, value: 70 }));
  const channelLower = bars.map((b) => ({ time: b.time, value: 30 }));

  // Dynamic fill colors based on prediction direction
  const upperFillColors = prediction.map((v, i) => {
    if (i < warmup || isNaN(v)) return 'transparent';
    return v >= 50 ? 'rgba(0,255,0,0.15)' : 'rgba(255,0,0,0.05)';
  });
  const lowerFillColors = prediction.map((v, i) => {
    if (i < warmup || isNaN(v)) return 'transparent';
    return v < 50 ? 'rgba(255,0,0,0.15)' : 'rgba(0,255,0,0.05)';
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3, 'plot4': plot4, 'channelUpper': channelUpper, 'channelLower': channelLower },
    hlines: [
      { value: 70, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Overbought' } },
      { value: 50, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Middle' } },
      { value: 30, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Oversold' } },
    ],
    fills: [
      { plot1: 'plot3', plot2: 'channelUpper', options: { color: 'rgba(0,255,0,0.1)' }, colors: upperFillColors },
      { plot1: 'plot3', plot2: 'channelLower', options: { color: 'rgba(255,0,0,0.1)' }, colors: lowerFillColors },
    ],
  };
}

export const MlMomentumIndex = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
