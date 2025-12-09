/**
 * MA Cross Indicator
 *
 * Shows two moving averages and their crossover signals.
 * Uses SMA by default.
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface MACrossInputs {
  /** Short MA period */
  shortLength: number;
  /** Long MA period */
  longLength: number;
}

export const defaultInputs: MACrossInputs = {
  shortLength: 9,
  longLength: 21,
};

export const inputConfig: InputConfig[] = [
  { id: 'shortLength', type: 'int', title: 'Short Length', defval: 9, min: 1 },
  { id: 'longLength', type: 'int', title: 'Long Length', defval: 21, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Short MA', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Long MA', color: '#E91E63', lineWidth: 1 },
];

export const metadata = {
  title: 'MA Cross',
  shortTitle: 'MA Cross',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<MACrossInputs> = {}): IndicatorResult {
  const { shortLength, longLength } = { ...defaultInputs, ...inputs };

  const close = new Series(bars, b => b.close);

  // Calculate SMAs
  const shortMA = ta.sma(close, shortLength);
  const longMA = ta.sma(close, longLength);

  const shortArr = shortMA.toArray();
  const longArr = longMA.toArray();

  const shortData = shortArr.map((value: number | null, i: number) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  const longData = longArr.map((value: number | null, i: number) => ({
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
      'plot0': shortData,
      'plot1': longData,
    },
  };
}

export const MACross = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
