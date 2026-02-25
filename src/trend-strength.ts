/**
 * Trend Strength Index
 *
 * Measures trend strength using the Pearson correlation between
 * closing prices and bar indices over a rolling window.
 * Range: -1 to 1, where positive = uptrend, negative = downtrend.
 * Formula: correlation(close, bar_index, length)
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

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

export function calculate(bars: Bar[], inputs: Partial<TrendStrengthInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };

  const close = new Series(bars, b => b.close);
  const barIndex = new Series(bars, (_, i) => i);

  const tsArr = ta.correlation(close, barIndex, length).toArray();

  const tsData = tsArr.map((v, i) => ({ time: bars[i].time, value: v ?? NaN }));

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
