/**
 * Machine Learning: kNN-based Strategy
 *
 * k-Nearest Neighbors classification using RSI and CCI as dual features.
 * For each bar, computes Euclidean distance to all historical feature pairs,
 * finds k-nearest neighbors, and takes majority vote on price direction.
 *
 * Reference: TradingView "Machine Learning: kNN-based Strategy" (TV#413)
 */

import { ta, Series, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface MlKnnStrategyInputs {
  k: number;
  rsiLen: number;
  cciLen: number;
  lookback: number;
  src: SourceType;
}

export const defaultInputs: MlKnnStrategyInputs = {
  k: 5,
  rsiLen: 14,
  cciLen: 14,
  lookback: 200,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'k', type: 'int', title: 'K Neighbors', defval: 5, min: 1 },
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'cciLen', type: 'int', title: 'CCI Length', defval: 14, min: 1 },
  { id: 'lookback', type: 'int', title: 'Lookback', defval: 200, min: 10 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Signal', color: '#2962FF', lineWidth: 4, style: 'histogram' },
];

export const metadata = {
  title: 'ML: kNN Strategy',
  shortTitle: 'kNN',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<MlKnnStrategyInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { k, rsiLen, cciLen, lookback, src } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const source = getSourceSeries(bars, src);
  const rsiArr = ta.rsi(source, rsiLen).toArray();

  // CCI = (typical - SMA(typical, len)) / (0.015 * dev(typical, len))
  const typical = new Series(bars, (b) => (b.high + b.low + b.close) / 3);
  const cciSma = ta.sma(typical, cciLen).toArray();
  const cciDev = ta.dev(typical, cciLen).toArray();
  const cciArr: (number | null)[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const s = cciSma[i];
    const d = cciDev[i];
    const t = (bars[i].high + bars[i].low + bars[i].close) / 3;
    if (s == null || d == null || d === 0) {
      cciArr[i] = null;
    } else {
      cciArr[i] = (t - s) / (0.015 * d);
    }
  }

  const warmup = Math.max(rsiLen, cciLen) + 1;
  const closeArr = source.toArray();

  const signal: number[] = new Array(n).fill(0);
  const markers: MarkerData[] = [];

  for (let i = warmup; i < n; i++) {
    const curRsi = rsiArr[i];
    const curCci = cciArr[i];
    if (curRsi == null || curCci == null) continue;

    // Determine lookback window
    const start = Math.max(warmup, i - lookback);
    if (i - start < k) continue;

    // Compute distances to all historical bars in window
    const distances: { dist: number; direction: number }[] = [];
    for (let j = start; j < i; j++) {
      const hRsi = rsiArr[j];
      const hCci = cciArr[j];
      if (hRsi == null || hCci == null) continue;
      if (j + 1 >= n) continue;
      const cj = closeArr[j] ?? 0;
      const cj1 = closeArr[j + 1] ?? 0;
      const direction = cj1 > cj ? 1 : -1;
      const dRsi = curRsi - hRsi;
      const dCci = curCci - hCci;
      const dist = Math.sqrt(dRsi * dRsi + dCci * dCci);
      distances.push({ dist, direction });
    }

    if (distances.length < k) continue;

    // Find k nearest neighbors
    distances.sort((a, b) => a.dist - b.dist);
    let upVotes = 0;
    let downVotes = 0;
    for (let m = 0; m < k; m++) {
      if (distances[m].direction === 1) upVotes++;
      else downVotes++;
    }

    signal[i] = upVotes > downVotes ? 1 : upVotes < downVotes ? -1 : 0;

    // Markers on signal change
    if (i > warmup && signal[i] !== signal[i - 1]) {
      if (signal[i] === 1) {
        markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#26A69A', text: 'Buy' });
      } else if (signal[i] === -1) {
        markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#EF5350', text: 'Sell' });
      }
    }
  }

  const plot0 = bars.map((bar, i) => {
    if (i < warmup || signal[i] === 0) return { time: bar.time, value: NaN };
    const color = signal[i] === 1 ? '#26A69A' : '#EF5350';
    return { time: bar.time, value: signal[i], color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } },
    ],
    markers,
  };
}

export const MlKnnStrategy = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
