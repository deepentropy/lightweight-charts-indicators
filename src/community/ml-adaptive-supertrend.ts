/**
 * ML Adaptive SuperTrend [AlgoAlpha]
 *
 * Uses k-Means Clustering on ATR values to classify volatility regime
 * (low/medium/high), then selects an appropriate SuperTrend factor.
 * Low volatility → higher factor, high volatility → lower factor.
 *
 * Reference: TradingView "ML Adaptive SuperTrend [AlgoAlpha]" (TV#408)
 */

import { ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { TableData, TableCell } from '../types';

export interface MlAdaptiveSupertrendInputs {
  atrLen: number;
  minFactor: number;
  midFactor: number;
  maxFactor: number;
  trainLen: number;
}

export const defaultInputs: MlAdaptiveSupertrendInputs = {
  atrLen: 14,
  minFactor: 1.0,
  midFactor: 2.0,
  maxFactor: 3.0,
  trainLen: 200,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 14, min: 1 },
  { id: 'minFactor', type: 'float', title: 'Min Factor (High Vol)', defval: 1.0, min: 0.1, step: 0.1 },
  { id: 'midFactor', type: 'float', title: 'Mid Factor', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'maxFactor', type: 'float', title: 'Max Factor (Low Vol)', defval: 3.0, min: 0.1, step: 0.1 },
  { id: 'trainLen', type: 'int', title: 'Training Length', defval: 200, min: 10 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SuperTrend', color: '#2962FF', lineWidth: 2 },
  { id: 'plot_body', title: 'Body Middle', color: 'transparent', lineWidth: 0 },
];

export const metadata = {
  title: 'ML Adaptive SuperTrend',
  shortTitle: 'MLAST',
  overlay: true,
};

function kMeansClusters(data: number[], k: number, iterations: number): { centroids: number[]; assignments: number[] } {
  const n = data.length;
  if (n === 0) return { centroids: [], assignments: [] };

  // Init centroids: min, median, max
  const sorted = [...data].sort((a, b) => a - b);
  const centroids = [
    sorted[0],
    sorted[Math.floor(n / 2)],
    sorted[n - 1],
  ];

  const assignments = new Array(n).fill(0);

  for (let iter = 0; iter < iterations; iter++) {
    // Assign each point to nearest centroid
    for (let i = 0; i < n; i++) {
      let minDist = Infinity;
      let best = 0;
      for (let c = 0; c < k; c++) {
        const d = Math.abs(data[i] - centroids[c]);
        if (d < minDist) { minDist = d; best = c; }
      }
      assignments[i] = best;
    }
    // Recompute centroids
    for (let c = 0; c < k; c++) {
      let sum = 0;
      let count = 0;
      for (let i = 0; i < n; i++) {
        if (assignments[i] === c) { sum += data[i]; count++; }
      }
      if (count > 0) centroids[c] = sum / count;
    }
  }

  return { centroids, assignments };
}

export function calculate(bars: Bar[], inputs: Partial<MlAdaptiveSupertrendInputs> = {}): IndicatorResult & { markers: MarkerData[]; tables: TableData } {
  const { atrLen, minFactor, midFactor, maxFactor, trainLen } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const atrArr = ta.atr(bars, atrLen).toArray();

  const warmup = atrLen + trainLen;
  const stValues: number[] = new Array(n).fill(NaN);
  const stDir: number[] = new Array(n).fill(1);
  const factorUsed: number[] = new Array(n).fill(midFactor);

  // Track last cluster info for the table
  let lastCentroids = [0, 0, 0];
  let lastCluster = 0;
  let lastActiveFactor = midFactor;

  for (let i = 0; i < n; i++) {
    if (i < warmup) continue;

    // Gather training ATR values
    const trainData: number[] = [];
    for (let j = i - trainLen; j < i; j++) {
      const v = atrArr[j];
      if (v != null) trainData.push(v);
    }

    if (trainData.length < 3) continue;

    // k-means with 3 clusters
    const { centroids, assignments: _a } = kMeansClusters(trainData, 3, 10);

    // Sort centroids to identify low/mid/high volatility
    const sortedC = [...centroids].sort((a, b) => a - b);
    lastCentroids = sortedC;

    // Classify current ATR
    const curAtr = atrArr[i];
    if (curAtr == null) continue;

    let minDist = Infinity;
    let cluster = 0;
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(curAtr - sortedC[c]);
      if (d < minDist) { minDist = d; cluster = c; }
    }
    lastCluster = cluster;

    // Map cluster to factor: low vol → higher factor, high vol → lower factor
    const factor = cluster === 0 ? maxFactor : cluster === 1 ? midFactor : minFactor;
    factorUsed[i] = factor;
    lastActiveFactor = factor;

    // SuperTrend calculation
    const hl2 = (bars[i].high + bars[i].low) / 2;
    const atrVal = curAtr * factor;
    const up = hl2 - atrVal;
    const dn = hl2 + atrVal;

    if (i === warmup || isNaN(stValues[i - 1])) {
      stValues[i] = up;
      stDir[i] = 1;
      continue;
    }

    const prevDir = stDir[i - 1];
    const prevSt = stValues[i - 1];
    const close = bars[i].close;
    const prevClose = bars[i - 1].close;

    const trailUp = prevClose > prevSt && prevDir === 1 ? Math.max(up, prevSt) : up;
    const trailDn = prevClose < prevSt && prevDir === -1 ? Math.min(dn, prevSt) : dn;

    if (prevDir === 1) {
      if (close < trailUp) { stDir[i] = -1; stValues[i] = trailDn; }
      else { stDir[i] = 1; stValues[i] = trailUp; }
    } else {
      if (close > trailDn) { stDir[i] = 1; stValues[i] = trailUp; }
      else { stDir[i] = -1; stValues[i] = trailDn; }
    }
  }

  const markers: MarkerData[] = [];
  for (let i = warmup + 1; i < n; i++) {
    if (isNaN(stValues[i]) || isNaN(stValues[i - 1])) continue;
    if (stDir[i] === 1 && stDir[i - 1] === -1) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#26A69A', text: 'Buy' });
    } else if (stDir[i] === -1 && stDir[i - 1] === 1) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#EF5350', text: 'Sell' });
    }
  }

  const plot0 = bars.map((bar, i) => {
    if (i < warmup || isNaN(stValues[i])) return { time: bar.time, value: NaN };
    const color = stDir[i] === 1 ? '#26A69A' : '#EF5350';
    return { time: bar.time, value: stValues[i], color };
  });

  // Body middle plot: (open + close) / 2, used for fill reference per Pine source
  const plot_body = bars.map((bar, i) => ({
    time: bar.time,
    value: i < warmup ? NaN : (bar.open + bar.close) / 2,
  }));

  // Fills between body middle and SuperTrend (2 fills per Pine: upTrend/downTrend)
  const fillUpColors = bars.map((_b, i) => {
    if (i < warmup || isNaN(stValues[i])) return 'transparent';
    return stDir[i] === 1 ? 'rgba(0,255,187,0.05)' : 'transparent';
  });
  const fillDnColors = bars.map((_b, i) => {
    if (i < warmup || isNaN(stValues[i])) return 'transparent';
    return stDir[i] === -1 ? 'rgba(255,17,0,0.05)' : 'transparent';
  });

  const clusterLabels = ['Low', 'Medium', 'High'];
  const cells: TableCell[] = [
    { row: 0, column: 0, text: 'Cluster Info', bgColor: '#1E222D', textColor: '#D1D4DC', textSize: 'small' },
    { row: 0, column: 1, text: '', bgColor: '#1E222D' },
    { row: 1, column: 0, text: 'Low Vol C', bgColor: '#1E222D', textColor: '#787B86', textSize: 'tiny' },
    { row: 1, column: 1, text: lastCentroids[0].toFixed(4), bgColor: '#1E222D', textColor: '#D1D4DC', textSize: 'tiny' },
    { row: 2, column: 0, text: 'Mid Vol C', bgColor: '#1E222D', textColor: '#787B86', textSize: 'tiny' },
    { row: 2, column: 1, text: lastCentroids[1].toFixed(4), bgColor: '#1E222D', textColor: '#D1D4DC', textSize: 'tiny' },
    { row: 3, column: 0, text: 'High Vol C', bgColor: '#1E222D', textColor: '#787B86', textSize: 'tiny' },
    { row: 3, column: 1, text: lastCentroids[2].toFixed(4), bgColor: '#1E222D', textColor: '#D1D4DC', textSize: 'tiny' },
    { row: 4, column: 0, text: 'Cur Cluster', bgColor: '#1E222D', textColor: '#787B86', textSize: 'tiny' },
    { row: 4, column: 1, text: clusterLabels[lastCluster], bgColor: '#1E222D', textColor: lastCluster === 0 ? '#26A69A' : lastCluster === 2 ? '#EF5350' : '#FF9800', textSize: 'tiny' },
    { row: 5, column: 0, text: 'Active Factor', bgColor: '#1E222D', textColor: '#787B86', textSize: 'tiny' },
    { row: 5, column: 1, text: lastActiveFactor.toFixed(2), bgColor: '#1E222D', textColor: '#2962FF', textSize: 'tiny' },
  ];

  const tables: TableData = {
    position: 'top_right',
    columns: 2,
    rows: 6,
    cells,
  };

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot_body': plot_body },
    fills: [
      { plot1: 'plot_body', plot2: 'plot0', colors: fillUpColors },
      { plot1: 'plot_body', plot2: 'plot0', colors: fillDnColors },
    ],
    markers,
    tables,
  };
}

export const MlAdaptiveSupertrend = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
