/**
 * Median Indicator
 *
 * Shows the median price with ATR-based bands and EMA.
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface MedianInputs {
  /** Median calculation length */
  length: number;
  /** ATR length */
  atrLength: number;
  /** ATR multiplier for bands */
  atrMult: number;
}

export const defaultInputs: MedianInputs = {
  length: 3,
  atrLength: 14,
  atrMult: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Median Length', defval: 3, min: 1 },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14, min: 1 },
  { id: 'atrMult', type: 'float', title: 'ATR Multiplier', defval: 2, min: 0 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Median', color: '#FF0000', lineWidth: 3 },
  { id: 'plot1', title: 'Upper Band', color: '#00FF00', lineWidth: 1 },
  { id: 'plot2', title: 'Lower Band', color: '#FF00FF', lineWidth: 1 },
  { id: 'plot3', title: 'Median EMA', color: '#0000FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Median',
  shortTitle: 'Median',
  overlay: true,
};

/**
 * Calculate percentile using nearest rank method
 */
function percentileNearestRank(values: number[], percentile: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

export function calculate(bars: Bar[], inputs: Partial<MedianInputs> = {}): IndicatorResult {
  const { length, atrLength, atrMult } = { ...defaultInputs, ...inputs };

  // hl2 = (high + low) / 2
  const hl2Values = bars.map(b => (b.high + b.low) / 2);

  // Calculate median using percentile_nearest_rank with 50th percentile
  const medianValues: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (i < length - 1) {
      medianValues.push(NaN);
      continue;
    }
    const window = hl2Values.slice(i - length + 1, i + 1);
    medianValues.push(percentileNearestRank(window, 50));
  }

  // Calculate ATR
  const atrSeries = ta.atr(bars, atrLength);
  const atrValues = atrSeries.toArray();

  // Calculate bands
  const upperBand = medianValues.map((m, i) => {
    const atr = atrValues[i];
    if (isNaN(m) || atr == null) return NaN;
    return m + atrMult * atr;
  });

  const lowerBand = medianValues.map((m, i) => {
    const atr = atrValues[i];
    if (isNaN(m) || atr == null) return NaN;
    return m - atrMult * atr;
  });

  // Calculate EMA of median
  const medianSeries = new Series(bars, (_, i) => medianValues[i]);
  const medianEma = ta.ema(medianSeries, length);
  const medianEmaArr = medianEma.toArray();

  // Build plot data
  const medianData = medianValues.map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  const upperData = upperBand.map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  const lowerData = lowerBand.map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  const emaData = medianEmaArr.map((value: number | null, i: number) => ({
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
      'plot0': medianData,
      'plot1': upperData,
      'plot2': lowerData,
      'plot3': emaData,
    },
  };
}

export const Median = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
