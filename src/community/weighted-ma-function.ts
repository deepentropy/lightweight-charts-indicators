/**
 * A Useful MA Weighting Function (Beta-Weighted MA / BWMA)
 *
 * Custom moving average using the Beta distribution's kernel function:
 *   w(i) = x^(alpha-1) * (1-x)^(beta-1)  where x = i/(length-1)
 * The `alpha` parameter controls lag (higher = more lag, smoother).
 * The `beta` parameter controls negative lag (higher = less lag, more responsive).
 * The MA is colored by an RSI-based gradient from red (oversold) to green (overbought).
 *
 * Reference: TradingView "A Useful MA Weighting Function For Controlling Lag & Smoothness"
 */

import { ta, Series, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface WeightedMAFunctionInputs {
  source: SourceType;
  length: number;
  beta: number;
  alpha: number;
}

export const defaultInputs: WeightedMAFunctionInputs = {
  source: 'close',
  length: 50,
  beta: 3.0,
  alpha: 3.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'length', type: 'int', title: 'Length', defval: 50, min: 2 },
  { id: 'beta', type: 'float', title: '-Lag (Beta)', defval: 3.0, min: 1.0, max: 10.0, step: 0.1 },
  { id: 'alpha', type: 'float', title: '+Lag (Alpha)', defval: 3.0, min: 1.0, max: 10.0, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'BWMA', color: '#FFAB00', lineWidth: 2 },
];

export const metadata = {
  title: 'Beta-Weighted Moving Average',
  shortTitle: 'BWMA',
  overlay: true,
};

/**
 * Interpolate a red-to-green gradient based on a 0..1 ratio.
 * The PineScript uses 200 discrete colors; we approximate with smooth interpolation.
 */
function gradientColor(ratio: number): string {
  // Clamp to 0..1
  const t = Math.max(0, Math.min(1, ratio));
  // Red channel: 255 down to ~48
  // Green channel: ~17 up to ~255
  // Blue channel: 0 throughout (with slight blue in middle transition)
  let r: number, g: number, b: number;

  if (t < 0.5) {
    // Red to yellow-orange zone
    const u = t / 0.5;
    r = 255;
    g = Math.round(17 + u * (171 - 17)); // ~17 to ~171
    b = 0;
  } else {
    // Yellow-orange to green zone
    const u = (t - 0.5) / 0.5;
    r = Math.round(253 - u * (253 - 48));  // ~253 to ~48
    g = Math.round(172 + u * (255 - 172)); // ~172 to ~255
    b = Math.round(u * 133);               // 0 to ~133
  }

  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase();
}

export function calculate(bars: Bar[], inputs: Partial<WeightedMAFunctionInputs> = {}): IndicatorResult {
  const { source, length, beta, alpha } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const srcArr = getSourceSeries(bars, source).toArray();

  // Precompute weights using Beta kernel: w(i) = x^(alpha-1) * (1-x)^(beta-1)
  const weights: number[] = new Array(length);
  let weightSum = 0;
  for (let i = 0; i < length; i++) {
    const x = i / (length - 1);
    const w = Math.pow(x, alpha - 1) * Math.pow(1 - x, beta - 1);
    weights[i] = w;
    weightSum += w;
  }

  // Compute the filtered MA
  const filtArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if (i < length - 1) {
      filtArr[i] = NaN;
      continue;
    }
    let sum = 0;
    for (let j = 0; j < length; j++) {
      const val = srcArr[i - j];
      if (isNaN(val)) { sum = NaN; break; }
      sum += val * weights[j];
    }
    filtArr[i] = isNaN(sum) ? NaN : sum / weightSum;
  }

  // Color based on RSI of the filtered values
  // PineScript: os = rsi(filt, length) / 100
  const filtSeries = Series.fromArray(bars, filtArr);
  const rsiArr = ta.rsi(filtSeries, length).toArray();

  const warmup = length;

  const plot0 = filtArr.map((v, i) => {
    if (i < warmup || isNaN(v)) return { time: bars[i].time, value: NaN };
    const rsiVal = rsiArr[i];
    const ratio = !isNaN(rsiVal) ? rsiVal / 100 : 0.5;
    const color = gradientColor(ratio);
    return { time: bars[i].time, value: v, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
  };
}

export const WeightedMAFunction = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
