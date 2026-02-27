/**
 * SuperTrend AI (Clustering) [LuxAlgo]
 *
 * Tests multiple SuperTrend factors, scores each by recent trend-tracking
 * performance (fewer whipsaws = better), clusters scores via k-means into
 * poor/average/excellent groups, then uses the weighted average of excellent
 * factors as the final optimized factor.
 *
 * Reference: TradingView "SuperTrend AI (Clustering) [LuxAlgo]" (TV#683)
 */

import { ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData, LabelData } from '../types';
import type { TableData, TableCell } from '../types';

export interface SupertrendAiClusteringInputs {
  atrLen: number;
  minFactor: number;
  maxFactor: number;
  factorStep: number;
  trainLen: number;
}

export const defaultInputs: SupertrendAiClusteringInputs = {
  atrLen: 10,
  minFactor: 1.0,
  maxFactor: 3.0,
  factorStep: 0.5,
  trainLen: 100,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 10, min: 1 },
  { id: 'minFactor', type: 'float', title: 'Min Factor', defval: 1.0, min: 0.1, step: 0.1 },
  { id: 'maxFactor', type: 'float', title: 'Max Factor', defval: 3.0, min: 0.1, step: 0.1 },
  { id: 'factorStep', type: 'float', title: 'Factor Step', defval: 0.5, min: 0.1, step: 0.1 },
  { id: 'trainLen', type: 'int', title: 'Training Length', defval: 100, min: 10 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SuperTrend', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Opt Factor', color: '#FF9800', lineWidth: 1 },
];

export const metadata = {
  title: 'SuperTrend AI Clustering',
  shortTitle: 'STAI',
  overlay: true,
};

function calcSupertrendArrays(bars: Bar[], atrArr: (number | null)[], factor: number): { st: number[]; dir: number[] } {
  const n = bars.length;
  const st: number[] = new Array(n).fill(NaN);
  const dir: number[] = new Array(n).fill(1);

  for (let i = 0; i < n; i++) {
    const atrVal = atrArr[i];
    if (atrVal == null) continue;

    const hl2 = (bars[i].high + bars[i].low) / 2;
    const atr = atrVal * factor;
    const up = hl2 - atr;
    const dn = hl2 + atr;

    if (i === 0 || isNaN(st[i - 1])) {
      st[i] = up;
      dir[i] = 1;
      continue;
    }

    const prevDir = dir[i - 1];
    const prevSt = st[i - 1];
    const close = bars[i].close;
    const prevClose = bars[i - 1].close;

    const trailUp = prevClose > prevSt && prevDir === 1 ? Math.max(up, prevSt) : up;
    const trailDn = prevClose < prevSt && prevDir === -1 ? Math.min(dn, prevSt) : dn;

    if (prevDir === 1) {
      if (close < trailUp) { dir[i] = -1; st[i] = trailDn; }
      else { dir[i] = 1; st[i] = trailUp; }
    } else {
      if (close > trailDn) { dir[i] = 1; st[i] = trailUp; }
      else { dir[i] = -1; st[i] = trailDn; }
    }
  }

  return { st, dir };
}

export function calculate(bars: Bar[], inputs: Partial<SupertrendAiClusteringInputs> = {}): IndicatorResult & { markers: MarkerData[]; tables: TableData; barColors: BarColorData[]; labels: LabelData[] } {
  const { atrLen, minFactor, maxFactor, factorStep, trainLen } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const atrArr = ta.atr(bars, atrLen).toArray();

  // Generate candidate factors
  const factors: number[] = [];
  for (let f = minFactor; f <= maxFactor + 0.001; f += factorStep) {
    factors.push(Math.round(f * 100) / 100);
  }

  // Precompute SuperTrend for each factor
  const stResults = factors.map(f => calcSupertrendArrays(bars, atrArr, f));

  const warmup = atrLen + trainLen;
  const finalSt: number[] = new Array(n).fill(NaN);
  const finalDir: number[] = new Array(n).fill(1);
  const optFactor: number[] = new Array(n).fill(NaN);

  let lastOptFactor = NaN;
  let lastPerfScore = NaN;
  let lastClusterInfo = '';
  const perfIdxArr: number[] = new Array(n).fill(NaN);

  for (let i = warmup; i < n; i++) {
    // Score each factor by counting direction flips (whipsaws) in training window
    const scores: { factor: number; score: number; idx: number }[] = [];

    for (let fi = 0; fi < factors.length; fi++) {
      const dirArr = stResults[fi].dir;
      let flips = 0;
      const start = Math.max(0, i - trainLen);
      for (let j = start + 1; j <= i; j++) {
        if (dirArr[j] !== dirArr[j - 1]) flips++;
      }
      // Score: fewer flips = better. Invert so higher = better.
      const score = trainLen - flips;
      scores.push({ factor: factors[fi], score, idx: fi });
    }

    if (scores.length < 3) continue;

    // k-means clustering of scores into 3 groups
    const scoreValues = scores.map(s => s.score);
    const sortedScores = [...scoreValues].sort((a, b) => a - b);
    const centroids = [
      sortedScores[0],
      sortedScores[Math.floor(sortedScores.length / 2)],
      sortedScores[sortedScores.length - 1],
    ];

    // 10 iterations of k-means
    const assignments = new Array(scores.length).fill(0);
    for (let iter = 0; iter < 10; iter++) {
      for (let si = 0; si < scores.length; si++) {
        let minDist = Infinity;
        let best = 0;
        for (let c = 0; c < 3; c++) {
          const d = Math.abs(scoreValues[si] - centroids[c]);
          if (d < minDist) { minDist = d; best = c; }
        }
        assignments[si] = best;
      }
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let count = 0;
        for (let si = 0; si < scores.length; si++) {
          if (assignments[si] === c) { sum += scoreValues[si]; count++; }
        }
        if (count > 0) centroids[c] = sum / count;
      }
    }

    // Identify excellent cluster (highest centroid)
    const sortedCentroids = centroids.map((c, idx) => ({ c, idx })).sort((a, b) => a.c - b.c);
    const excellentClusterIdx = sortedCentroids[2].idx;

    // Weighted average of factors in the excellent cluster
    let weightedSum = 0;
    let weightTotal = 0;
    let excellentCount = 0;
    for (let si = 0; si < scores.length; si++) {
      if (assignments[si] === excellentClusterIdx) {
        weightedSum += scores[si].factor * scores[si].score;
        weightTotal += scores[si].score;
        excellentCount++;
      }
    }

    const optF = weightTotal > 0 ? weightedSum / weightTotal : factors[Math.floor(factors.length / 2)];
    optFactor[i] = optF;
    lastOptFactor = optF;
    lastPerfScore = sortedCentroids[2].c;
    lastClusterInfo = `Poor: ${sortedCentroids[0].c.toFixed(0)}, Avg: ${sortedCentroids[1].c.toFixed(0)}, Best: ${sortedCentroids[2].c.toFixed(0)}`;

    // Compute performance index for labels (simplified: cluster score / trainLen)
    perfIdxArr[i] = Math.max(sortedCentroids[2].c, 0) / trainLen;

    // Compute SuperTrend with optimized factor for this bar
    const atrVal = atrArr[i];
    if (atrVal == null) continue;

    const hl2 = (bars[i].high + bars[i].low) / 2;
    const atr = atrVal * optF;
    const up = hl2 - atr;
    const dn = hl2 + atr;

    if (isNaN(finalSt[i - 1])) {
      finalSt[i] = up;
      finalDir[i] = 1;
      continue;
    }

    const prevDir = finalDir[i - 1];
    const prevSt = finalSt[i - 1];
    const close = bars[i].close;
    const prevClose = bars[i - 1].close;

    const trailUp = prevClose > prevSt && prevDir === 1 ? Math.max(up, prevSt) : up;
    const trailDn = prevClose < prevSt && prevDir === -1 ? Math.min(dn, prevSt) : dn;

    if (prevDir === 1) {
      if (close < trailUp) { finalDir[i] = -1; finalSt[i] = trailDn; }
      else { finalDir[i] = 1; finalSt[i] = trailUp; }
    } else {
      if (close > trailDn) { finalDir[i] = 1; finalSt[i] = trailUp; }
      else { finalDir[i] = -1; finalSt[i] = trailDn; }
    }
  }

  const markers: MarkerData[] = [];
  const labels: LabelData[] = [];
  for (let i = warmup + 1; i < n; i++) {
    if (isNaN(finalSt[i]) || isNaN(finalSt[i - 1])) continue;
    if (finalDir[i] === 1 && finalDir[i - 1] === -1) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#26A69A', text: 'Buy' });
      // Pine: label.new(n, ts, str.tostring(int(perf_idx * 10)), color=bullCss, style=label_up)
      const perfScore = isNaN(perfIdxArr[i]) ? 0 : Math.floor(perfIdxArr[i] * 10);
      labels.push({
        time: bars[i].time,
        price: finalSt[i],
        text: String(perfScore),
        color: '#26A69A',
        textColor: '#FFFFFF',
        style: 'label_up',
        size: 'tiny',
      });
    } else if (finalDir[i] === -1 && finalDir[i - 1] === 1) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#EF5350', text: 'Sell' });
      // Pine: label.new(n, ts, str.tostring(int(perf_idx * 10)), color=bearCss, style=label_down)
      const perfScore = isNaN(perfIdxArr[i]) ? 0 : Math.floor(perfIdxArr[i] * 10);
      labels.push({
        time: bars[i].time,
        price: finalSt[i],
        text: String(perfScore),
        color: '#EF5350',
        textColor: '#FFFFFF',
        style: 'label_down',
        size: 'tiny',
      });
    }
  }

  const plot0 = bars.map((bar, i) => {
    if (i < warmup || isNaN(finalSt[i])) return { time: bar.time, value: NaN };
    const color = finalDir[i] === 1 ? '#26A69A' : '#EF5350';
    return { time: bar.time, value: finalSt[i], color };
  });

  const plot1 = bars.map((bar, i) => {
    if (isNaN(optFactor[i])) return { time: bar.time, value: NaN };
    return { time: bar.time, value: optFactor[i] };
  });

  const cells: TableCell[] = [
    { row: 0, column: 0, text: 'ST AI Info', bgColor: '#1E222D', textColor: '#D1D4DC', textSize: 'small' },
    { row: 0, column: 1, text: '', bgColor: '#1E222D' },
    { row: 1, column: 0, text: 'Opt Factor', bgColor: '#1E222D', textColor: '#787B86', textSize: 'tiny' },
    { row: 1, column: 1, text: isNaN(lastOptFactor) ? '-' : lastOptFactor.toFixed(3), bgColor: '#1E222D', textColor: '#FF9800', textSize: 'tiny' },
    { row: 2, column: 0, text: 'Perf Score', bgColor: '#1E222D', textColor: '#787B86', textSize: 'tiny' },
    { row: 2, column: 1, text: isNaN(lastPerfScore) ? '-' : lastPerfScore.toFixed(1), bgColor: '#1E222D', textColor: '#26A69A', textSize: 'tiny' },
    { row: 3, column: 0, text: 'Clusters', bgColor: '#1E222D', textColor: '#787B86', textSize: 'tiny' },
    { row: 3, column: 1, text: lastClusterInfo || '-', bgColor: '#1E222D', textColor: '#D1D4DC', textSize: 'tiny' },
  ];

  const tables: TableData = {
    position: 'top_right',
    columns: 2,
    rows: 4,
    cells,
  };

  // barcolor: gradient based on trend direction (bullCss=teal, bearCss=red)
  // Pine: barcolor(color.from_gradient(perf_idx, 0, 1, color.new(css, 80), css))
  // Simplified: teal when uptrend (dir=1), red when downtrend (dir=-1), with faded color for lower perf
  const barColors: BarColorData[] = [];
  for (let i = warmup; i < n; i++) {
    if (isNaN(finalSt[i])) continue;
    if (finalDir[i] === 1) barColors.push({ time: bars[i].time, color: '#26A69A' });
    else barColors.push({ time: bars[i].time, color: '#EF5350' });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    markers,
    labels,
    tables,
    barColors,
  };
}

export const SupertrendAiClustering = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
