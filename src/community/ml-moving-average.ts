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
import type { MarkerData, BgColorData } from '../types';

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

export function calculate(bars: Bar[], inputs: Partial<MlMovingAverageInputs> = {}): IndicatorResult & { markers: MarkerData[]; bgColors: BgColorData[] } {
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

  // Compute trend state: os = 1 if close > upper and center rising, 0 if close < lower and center falling
  const os: number[] = new Array(n).fill(0);
  for (let i = warmup; i < n; i++) {
    const c = bars[i].close;
    const prev = i > warmup ? os[i - 1] : 0;
    const rising = i > warmup && !isNaN(centerArr[i]) && !isNaN(centerArr[i - 1]) && centerArr[i] > centerArr[i - 1];
    const falling = i > warmup && !isNaN(centerArr[i]) && !isNaN(centerArr[i - 1]) && centerArr[i] < centerArr[i - 1];
    if (c > upperArr[i] && rising) os[i] = 1;
    else if (c < lowerArr[i] && falling) os[i] = 0;
    else os[i] = prev;
  }

  const bullCss = '#3179f5';
  const bearCss = '#e91e63';

  const plot0 = centerArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup - 1 ? NaN : v,
    color: os[i] ? bullCss : bearCss,
  }));

  const plot1 = upperArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup - 1 ? NaN : v,
  }));

  const plot2 = lowerArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup - 1 ? NaN : v,
  }));

  // Markers: circle on trend change (os != os[1])
  const markers: MarkerData[] = [];
  for (let i = warmup + 1; i < n; i++) {
    if (os[i] !== os[i - 1] && !isNaN(centerArr[i])) {
      markers.push({
        time: bars[i].time,
        position: 'inBar',
        shape: 'circle',
        color: os[i] ? bullCss : bearCss,
        text: os[i] ? 'Bull' : 'Bear',
      });
    }
  }

  // bgColors: subtle background tint for current trend state
  const bgColors: BgColorData[] = [];
  for (let i = warmup; i < n; i++) {
    if (os[i] !== os[i - 1]) {
      bgColors.push({
        time: bars[i].time,
        color: os[i] ? 'rgba(49,121,245,0.08)' : 'rgba(233,30,99,0.08)',
      });
    }
  }

  // Two gradient fills: center-to-upper (blue/bull) and center-to-lower (pink/bear), matching Pine
  const upperFillColors = bars.map((_b, i) => {
    if (i < warmup - 1 || isNaN(centerArr[i])) return 'transparent';
    return 'rgba(91,156,246,0.5)';
  });

  const lowerFillColors = bars.map((_b, i) => {
    if (i < warmup - 1 || isNaN(centerArr[i])) return 'transparent';
    return 'rgba(233,30,99,0.5)';
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2 },
    fills: [
      { plot1: 'plot1', plot2: 'plot0', options: { color: 'rgba(91,156,246,0.5)' }, colors: upperFillColors },
      { plot1: 'plot0', plot2: 'plot2', options: { color: 'rgba(233,30,99,0.5)' }, colors: lowerFillColors },
    ],
    markers,
    bgColors,
  };
}

export const MlMovingAverage = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
