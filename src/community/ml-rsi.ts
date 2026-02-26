/**
 * Machine Learning RSI [BullVision]
 *
 * kNN applied to RSI for adaptive overbought/oversold thresholds.
 * Finds k-nearest historical bars with similar RSI values, then analyzes
 * what price did after those readings to compute adaptive OB/OS levels.
 *
 * Reference: TradingView "Machine Learning RSI [BullVision]" (TV#411)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { TableData, TableCell } from '../types';

export interface MlRsiInputs {
  rsiLen: number;
  k: number;
  lookback: number;
  src: SourceType;
}

export const defaultInputs: MlRsiInputs = {
  rsiLen: 14,
  k: 10,
  lookback: 200,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'k', type: 'int', title: 'K Neighbors', defval: 10, min: 1 },
  { id: 'lookback', type: 'int', title: 'Lookback', defval: 200, min: 10 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Adaptive OB', color: '#EF5350', lineWidth: 1 },
  { id: 'plot2', title: 'Adaptive OS', color: '#26A69A', lineWidth: 1 },
];

export const metadata = {
  title: 'ML RSI',
  shortTitle: 'MLRSI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<MlRsiInputs> = {}): IndicatorResult & { tables: TableData } {
  const { rsiLen, k, lookback, src } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const source = getSourceSeries(bars, src);
  const rsiArr = ta.rsi(source, rsiLen).toArray();
  const closeArr = source.toArray();

  const warmup = rsiLen + 1;

  const obArr: number[] = new Array(n).fill(NaN);
  const osArr: number[] = new Array(n).fill(NaN);

  let lastRsi = NaN;
  let lastOb = 70;
  let lastOs = 30;
  let lastPrediction = 'Neutral';

  for (let i = warmup; i < n; i++) {
    const curRsi = rsiArr[i];
    if (curRsi == null) continue;

    const start = Math.max(warmup, i - lookback);
    if (i - start < k + 1) continue;

    // Find k-nearest historical bars with similar RSI
    const neighbors: { dist: number; rsi: number; priceUp: boolean }[] = [];
    for (let j = start; j < i - 1; j++) {
      const hRsi = rsiArr[j];
      if (hRsi == null) continue;
      const cj = closeArr[j] ?? 0;
      const cj1 = closeArr[j + 1] ?? 0;
      const dist = Math.abs(curRsi - hRsi);
      neighbors.push({ dist, rsi: hRsi, priceUp: cj1 > cj });
    }

    if (neighbors.length < k) continue;
    neighbors.sort((a, b) => a.dist - b.dist);

    // Compute adaptive thresholds from k nearest neighbors
    let obSum = 0;
    let obCount = 0;
    let osSum = 0;
    let osCount = 0;

    for (let m = 0; m < k; m++) {
      const nb = neighbors[m];
      // Weight by inverse distance (closer neighbors matter more)
      const weight = 1 / (1 + nb.dist);
      if (!nb.priceUp) {
        // Price fell after this RSI value → contributes to OB threshold
        obSum += nb.rsi * weight;
        obCount += weight;
      } else {
        // Price rose after this RSI value → contributes to OS threshold
        osSum += nb.rsi * weight;
        osCount += weight;
      }
    }

    // Default levels if no neighbors in category
    const adaptiveOb = obCount > 0 ? obSum / obCount : 70;
    const adaptiveOs = osCount > 0 ? osSum / osCount : 30;

    // Ensure OB > OS with reasonable bounds
    obArr[i] = Math.max(adaptiveOb, adaptiveOs + 5);
    osArr[i] = Math.min(adaptiveOs, adaptiveOb - 5);

    lastRsi = curRsi;
    lastOb = obArr[i];
    lastOs = osArr[i];
    lastPrediction = curRsi >= lastOb ? 'Overbought' : curRsi <= lastOs ? 'Oversold' : 'Neutral';
  }

  const plot0 = bars.map((bar, i) => {
    if (i < warmup || rsiArr[i] == null) return { time: bar.time, value: NaN };
    return { time: bar.time, value: rsiArr[i]! };
  });

  const plot1 = bars.map((bar, i) => {
    if (isNaN(obArr[i])) return { time: bar.time, value: NaN };
    return { time: bar.time, value: obArr[i] };
  });

  const plot2 = bars.map((bar, i) => {
    if (isNaN(osArr[i])) return { time: bar.time, value: NaN };
    return { time: bar.time, value: osArr[i] };
  });

  const predColor = lastPrediction === 'Overbought' ? '#EF5350' : lastPrediction === 'Oversold' ? '#26A69A' : '#D1D4DC';
  const cells: TableCell[] = [
    { row: 0, column: 0, text: 'ML RSI Info', bgColor: '#1E222D', textColor: '#D1D4DC', textSize: 'small' },
    { row: 0, column: 1, text: '', bgColor: '#1E222D' },
    { row: 1, column: 0, text: 'RSI', bgColor: '#1E222D', textColor: '#787B86', textSize: 'tiny' },
    { row: 1, column: 1, text: isNaN(lastRsi) ? '-' : lastRsi.toFixed(2), bgColor: '#1E222D', textColor: '#2962FF', textSize: 'tiny' },
    { row: 2, column: 0, text: 'Adapt OB', bgColor: '#1E222D', textColor: '#787B86', textSize: 'tiny' },
    { row: 2, column: 1, text: lastOb.toFixed(2), bgColor: '#1E222D', textColor: '#EF5350', textSize: 'tiny' },
    { row: 3, column: 0, text: 'Adapt OS', bgColor: '#1E222D', textColor: '#787B86', textSize: 'tiny' },
    { row: 3, column: 1, text: lastOs.toFixed(2), bgColor: '#1E222D', textColor: '#26A69A', textSize: 'tiny' },
    { row: 4, column: 0, text: 'Prediction', bgColor: '#1E222D', textColor: '#787B86', textSize: 'tiny' },
    { row: 4, column: 1, text: lastPrediction, bgColor: '#1E222D', textColor: predColor, textSize: 'tiny' },
  ];

  const tables: TableData = {
    position: 'top_right',
    columns: 2,
    rows: 5,
    cells,
  };

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2 },
    tables,
  };
}

export const MlRsi = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
