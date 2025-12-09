/**
 * Trend Strength Index
 *
 * Measures trend strength using the Pearson correlation between
 * closing prices and bar indices over a rolling window.
 * Range: -1 to 1, where positive = uptrend, negative = downtrend.
 * Formula: correlation(close, bar_index, length)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface TrendStrengthInputs {
  /** Period length */
  length: number;
}

export const defaultInputs: TrendStrengthInputs = {
  length: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trend Strength Index', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Trend Strength Index',
  shortTitle: 'TSI',
  overlay: false,
};

/**
 * Calculate Pearson correlation coefficient between two arrays
 */
function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0) return NaN;

  // Calculate means
  let sumX = 0, sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  // Calculate correlation
  let numerator = 0;
  let sumXSq = 0;
  let sumYSq = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    sumXSq += dx * dx;
    sumYSq += dy * dy;
  }

  const denominator = Math.sqrt(sumXSq * sumYSq);
  if (denominator === 0) return 0;

  return numerator / denominator;
}

export function calculate(bars: Bar[], inputs: Partial<TrendStrengthInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };

  // Extract close prices
  const closes = bars.map(b => b.close);

  // Calculate TSI = correlation(close, bar_index, length)
  const tsValues: number[] = [];

  for (let i = 0; i < bars.length; i++) {
    if (i < length - 1) {
      tsValues.push(NaN);
      continue;
    }

    // Get window of close prices
    const closeWindow = closes.slice(i - length + 1, i + 1);

    // Bar indices for the window (0, 1, 2, ..., length-1)
    const indexWindow = Array.from({ length: length }, (_, j) => j);

    // Calculate correlation
    const corr = pearsonCorrelation(closeWindow, indexWindow);
    tsValues.push(corr);
  }

  const tsData = tsValues.map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': tsData,
    },
  };
}

export const TrendStrengthIndex = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
