/**
 * Williams %R Indicator
 *
 * A momentum indicator showing the level of the close relative to the highest high
 * over a lookback period. Range: -100 to 0.
 * Williams %R = -100 * (highest - close) / (highest - lowest)
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface WilliamsRInputs {
  /** Period length */
  length: number;
}

export const defaultInputs: WilliamsRInputs = {
  length: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '%R', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'Williams %R',
  shortTitle: '%R',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<WilliamsRInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };

  const high = new Series(bars, b => b.high);
  const low = new Series(bars, b => b.low);

  // Get highest high and lowest low over the period
  const highestHigh = ta.highest(high, length);
  const lowestLow = ta.lowest(low, length);

  const highArr = highestHigh.toArray();
  const lowArr = lowestLow.toArray();

  // Williams %R = -100 * (highest - close) / (highest - lowest)
  const wrValues: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    const highest = highArr[i];
    const lowest = lowArr[i];

    if (highest == null || lowest == null) {
      wrValues.push(NaN);
      continue;
    }

    const range = highest - lowest;
    if (range === 0) {
      wrValues.push(-50); // Midpoint when no range
    } else {
      wrValues.push(-100 * (highest - bars[i].close) / range);
    }
  }

  const wrData = wrValues.map((value, i) => ({
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
      'plot0': wrData,
    },
  };
}

export const WilliamsPercentRange = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
