/**
 * Standard Deviation Indicator
 *
 * Measures volatility by calculating the standard deviation of price.
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface StDevInputs {
  /** Period length */
  length: number;
}

export const defaultInputs: StDevInputs = {
  length: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'StDev', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Standard Deviation',
  shortTitle: 'StDev',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<StDevInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };

  const close = new Series(bars, b => b.close);

  const stdevValues = ta.stdev(close, length);
  const stdevArr = stdevValues.toArray();

  const stdevData = stdevArr.map((value: number | null, i: number) => ({
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
      'plot0': stdevData,
    },
  };
}

export const StandardDeviation = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
