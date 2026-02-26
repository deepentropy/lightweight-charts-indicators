/**
 * Machine Learning Moving Average [LuxAlgo]
 *
 * Gaussian Process Regression-inspired moving average.
 * For each bar, compute weighted average of lookback window using Gaussian kernel weights.
 * Weight(i) = exp(-0.5 * ((i - current) / sigma)^2)
 * Upper/lower bands = center +/- mult * weighted_stdev.
 *
 * Reference: TradingView "Machine Learning Moving Average [LuxAlgo]" (TV#410)
 */

import { getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface MlMovingAverageInputs {
  window: number;
  sigma: number;
  mult: number;
  src: SourceType;
}

export const defaultInputs: MlMovingAverageInputs = {
  window: 50,
  sigma: 10.0,
  mult: 2.0,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'window', type: 'int', title: 'Window', defval: 50, min: 2 },
  { id: 'sigma', type: 'float', title: 'Sigma', defval: 10.0, min: 0.1, step: 0.5 },
  { id: 'mult', type: 'float', title: 'Band Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ML MA', color: '#FF6D00', lineWidth: 2 },
  { id: 'plot1', title: 'Upper', color: '#2962FF', lineWidth: 1 },
  { id: 'plot2', title: 'Lower', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'ML Moving Average',
  shortTitle: 'MLMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<MlMovingAverageInputs> = {}): IndicatorResult {
  const { window: win, sigma, mult, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);
  const srcArr = source.toArray();
  const n = bars.length;

  const warmup = win;

  // Precompute Gaussian kernel weights
  const kernelWeights: number[] = new Array(win);
  for (let j = 0; j < win; j++) {
    const dist = j / sigma;
    kernelWeights[j] = Math.exp(-0.5 * dist * dist);
  }

  const centerArr: number[] = new Array(n).fill(NaN);
  const upperArr: number[] = new Array(n).fill(NaN);
  const lowerArr: number[] = new Array(n).fill(NaN);

  for (let i = warmup - 1; i < n; i++) {
    let weightSum = 0;
    let valueSum = 0;

    // Compute weighted mean
    for (let j = 0; j < win; j++) {
      const idx = i - j;
      if (idx < 0) break;
      const val = srcArr[idx] ?? NaN;
      if (isNaN(val)) continue;
      const w = kernelWeights[j];
      valueSum += w * val;
      weightSum += w;
    }

    if (weightSum === 0) continue;

    const center = valueSum / weightSum;
    centerArr[i] = center;

    // Compute weighted standard deviation
    let varSum = 0;
    for (let j = 0; j < win; j++) {
      const idx = i - j;
      if (idx < 0) break;
      const val = srcArr[idx] ?? NaN;
      if (isNaN(val)) continue;
      const w = kernelWeights[j];
      const diff = val - center;
      varSum += w * diff * diff;
    }

    const wStdev = Math.sqrt(varSum / weightSum);
    upperArr[i] = center + mult * wStdev;
    lowerArr[i] = center - mult * wStdev;
  }

  const plot0 = centerArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup - 1 ? NaN : v,
  }));

  const plot1 = upperArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup - 1 ? NaN : v,
  }));

  const plot2 = lowerArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup - 1 ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2 },
    fills: [{ plot1: 'plot1', plot2: 'plot2', options: { color: '#2962FF15' } }],
  };
}

export const MlMovingAverage = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
