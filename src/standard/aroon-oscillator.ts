/**
 * Aroon Oscillator
 *
 * The difference between Aroon Up and Aroon Down. Oscillates between -100 and
 * +100; positive values indicate an uptrend, negative a downtrend.
 *
 * Based on TradingView's built-in "Aroon Oscillator" (STD;Aroon_Oscillator).
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';

export interface AroonOscillatorInputs {
  /** Period length */
  length: number;
}

export const defaultInputs: AroonOscillatorInputs = {
  length: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Aroon Oscillator', color: '#FF6D00', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, color: '#787B86', linestyle: 'dashed', title: 'Zero' },
];

export const metadata = {
  title: 'Aroon Oscillator',
  shortTitle: 'Aroon Osc',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<AroonOscillatorInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };

  const oscArr: number[] = [];

  for (let i = 0; i < bars.length; i++) {
    if (i < length) {
      oscArr.push(NaN);
      continue;
    }

    let highestIdx = i;
    let lowestIdx = i;
    let highestVal = -Infinity;
    let lowestVal = Infinity;

    for (let j = i - length; j <= i; j++) {
      if (bars[j].high > highestVal) { highestVal = bars[j].high; highestIdx = j; }
      if (bars[j].low < lowestVal) { lowestVal = bars[j].low; lowestIdx = j; }
    }

    const aroonUp = (100 * (length - (i - highestIdx))) / length;
    const aroonDown = (100 * (length - (i - lowestIdx))) / length;
    oscArr.push(aroonUp - aroonDown);
  }

  const plotData = oscArr.map((value, i) => ({ time: bars[i].time, value }));

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': plotData,
    },
  };
}

export const AroonOscillator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
