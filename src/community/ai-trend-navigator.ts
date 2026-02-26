/**
 * AI Trend Navigator [K-Neighbor]
 *
 * kNN Moving Average + kNN Classifier for trend detection.
 * kNN MA: For each bar, find k closest historical price values within lookback window, average them.
 * kNN Classifier: Compute Euclidean distances between current features (price, ROC) and historical
 * features, classify trend as bullish/bearish based on majority vote of k-nearest neighbors.
 *
 * Reference: TradingView "AI Trend Navigator [K-Neighbor]" (TV#34)
 */

import { ta, Series, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface AiTrendNavigatorInputs {
  length: number;
  k: number;
  smoothLen: number;
  src: SourceType;
}

export const defaultInputs: AiTrendNavigatorInputs = {
  length: 50,
  k: 5,
  smoothLen: 10,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Lookback Length', defval: 50, min: 5 },
  { id: 'k', type: 'int', title: 'K Neighbors', defval: 5, min: 1 },
  { id: 'smoothLen', type: 'int', title: 'Signal Smooth', defval: 10, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'kNN MA', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'AI Trend Navigator [K-Neighbor]',
  shortTitle: 'AI-TN',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<AiTrendNavigatorInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { length, k, smoothLen, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);
  const srcArr = source.toArray();
  const n = bars.length;

  const warmup = length;
  const knnMA: number[] = new Array(n).fill(NaN);
  const trendDir: number[] = new Array(n).fill(0);

  for (let i = warmup; i < n; i++) {
    const curVal = srcArr[i] ?? NaN;
    if (isNaN(curVal)) continue;

    // Rate of change for current bar
    const curRoc = i > 0 && srcArr[i - 1] != null ? curVal - (srcArr[i - 1] as number) : 0;

    // Collect distances to historical bars in lookback window
    const distances: { dist: number; value: number; direction: number }[] = [];
    for (let j = i - length; j < i; j++) {
      if (j < 0) continue;
      const hVal = srcArr[j] ?? NaN;
      if (isNaN(hVal)) continue;

      const hRoc = j > 0 && srcArr[j - 1] != null ? hVal - (srcArr[j - 1] as number) : 0;

      // Euclidean distance using price and ROC features
      const dPrice = curVal - hVal;
      const dRoc = curRoc - hRoc;
      const dist = Math.sqrt(dPrice * dPrice + dRoc * dRoc);

      // Direction: +1 if price went up from that bar, -1 otherwise
      const nextVal = j + 1 < n ? (srcArr[j + 1] ?? hVal) : hVal;
      const direction = (nextVal as number) >= hVal ? 1 : -1;

      distances.push({ dist, value: hVal, direction });
    }

    // Sort by distance and pick k nearest
    distances.sort((a, b) => a.dist - b.dist);
    const kNearest = distances.slice(0, Math.min(k, distances.length));

    if (kNearest.length === 0) continue;

    // kNN MA: average of k nearest values
    let sumVal = 0;
    let sumDir = 0;
    for (const nb of kNearest) {
      sumVal += nb.value;
      sumDir += nb.direction;
    }
    knnMA[i] = sumVal / kNearest.length;

    // kNN Classifier: majority vote for trend direction
    trendDir[i] = sumDir >= 0 ? 1 : -1;
  }

  // Signal line: EMA of knnMA
  const knnSeries = Series.fromArray(bars, knnMA);
  const signalArr = ta.ema(knnSeries, smoothLen).toArray();

  // Generate markers on trend direction change
  const markers: MarkerData[] = [];
  for (let i = warmup + 1; i < n; i++) {
    if (isNaN(knnMA[i]) || isNaN(knnMA[i - 1])) continue;
    if (trendDir[i] === 1 && trendDir[i - 1] === -1) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#26A69A', text: 'Buy' });
    } else if (trendDir[i] === -1 && trendDir[i - 1] === 1) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'Sell' });
    }
  }

  const plot0 = knnMA.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
    color: trendDir[i] === 1 ? '#26A69A' : '#EF5350',
  }));

  const plot1 = (signalArr as (number | null)[]).map((v, i) => ({
    time: bars[i].time,
    value: i < warmup + smoothLen ? NaN : (v ?? NaN),
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    markers,
  };
}

export const AiTrendNavigator = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
