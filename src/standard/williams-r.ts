/**
 * Williams %R Indicator
 *
 * A momentum indicator showing the level of the close relative to the highest high
 * over a lookback period. Range: -100 to 0.
 * Williams %R = -100 * (highest - close) / (highest - lowest)
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar } from 'oakscriptjs';

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
  { id: 'plot0', title: '%R', color: '#7E57C2', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper', price: -20, color: '#787B86', linestyle: 'solid', title: 'Upper Band' },
  { id: 'hline_mid',   price: -50, color: '#787B86', linestyle: 'dotted', title: 'Middle Level' },
  { id: 'hline_lower', price: -80, color: '#787B86', linestyle: 'solid', title: 'Lower Band' },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill_band', plot1: 'hline_upper', plot2: 'hline_lower', color: '#7E57C219' },
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
  hlineConfig,
  fillConfig,
};
