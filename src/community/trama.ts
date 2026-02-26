/**
 * Trend Regularity Adaptive Moving Average (TRAMA)
 *
 * Adaptive MA that adjusts speed based on trend regularity.
 * Counts how many bars are trending (|change| > avg |change|), computes ratio,
 * then alpha = ratio * (2/(length+1)). trama = alpha * src + (1-alpha) * prev.
 *
 * Reference: TradingView "Trend Regularity Adaptive Moving Average" by LuxAlgo
 */

import { getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface TRAMAInputs {
  length: number;
  src: SourceType;
}

export const defaultInputs: TRAMAInputs = {
  length: 14,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 2 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'TRAMA', color: '#FFEB3B', lineWidth: 2 },
];

export const metadata = {
  title: 'Trend Regularity Adaptive MA',
  shortTitle: 'TRAMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<TRAMAInputs> = {}): IndicatorResult {
  const { length, src } = { ...defaultInputs, ...inputs };
  const srcArr = getSourceSeries(bars, src).toArray();
  const n = bars.length;

  const trama: number[] = new Array(n);
  const fastAlpha = 2 / (length + 1);

  for (let i = 0; i < n; i++) {
    const s = srcArr[i] ?? 0;

    if (i < length) {
      trama[i] = s;
      continue;
    }

    // Calculate average absolute change over lookback
    let sumAbsChange = 0;
    for (let j = 0; j < length; j++) {
      sumAbsChange += Math.abs((srcArr[i - j] ?? 0) - (srcArr[i - j - 1] ?? 0));
    }
    const avgAbsChange = sumAbsChange / length;

    // Count how many of the last `length` bars are trending
    let trendingCount = 0;
    for (let j = 0; j < length; j++) {
      const absChange = Math.abs((srcArr[i - j] ?? 0) - (srcArr[i - j - 1] ?? 0));
      if (absChange > avgAbsChange) trendingCount++;
    }

    const ratio = trendingCount / length;
    const alpha = ratio * fastAlpha;
    trama[i] = alpha * s + (1 - alpha) * trama[i - 1];
  }

  const warmup = length;
  const plot = trama.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const prev = i > 0 ? trama[i - 1] : v;
    const color = v > prev ? '#26A69A' : v < prev ? '#EF5350' : '#FFEB3B';
    return { time: bars[i].time, value: v, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot },
  };
}

export const TRAMA = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
