/**
 * Aroon Indicator
 *
 * Identifies trend strength and potential reversals by measuring
 * how long since the highest high and lowest low within the period.
 * Aroon Up = 100 * (length - bars since highest high) / length
 * Aroon Down = 100 * (length - bars since lowest low) / length
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface AroonInputs {
  /** Period length */
  length: number;
}

export const defaultInputs: AroonInputs = {
  length: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Aroon Up', color: '#FB8C00', lineWidth: 1 },
  { id: 'plot1', title: 'Aroon Down', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Aroon',
  shortTitle: 'Aroon',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<AroonInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };

  const aroonUp: number[] = [];
  const aroonDown: number[] = [];

  for (let i = 0; i < bars.length; i++) {
    if (i < length) {
      aroonUp.push(NaN);
      aroonDown.push(NaN);
      continue;
    }

    // Find bars since highest high and lowest low in the lookback period
    // ta.highestbars returns negative offset, so we add length to get bars since
    let highestIdx = i;
    let lowestIdx = i;
    let highestVal = -Infinity;
    let lowestVal = Infinity;

    for (let j = i - length; j <= i; j++) {
      if (bars[j].high > highestVal) {
        highestVal = bars[j].high;
        highestIdx = j;
      }
      if (bars[j].low < lowestVal) {
        lowestVal = bars[j].low;
        lowestIdx = j;
      }
    }

    // Bars since highest/lowest (0 = current bar has highest/lowest)
    const barsSinceHighest = i - highestIdx;
    const barsSinceLowest = i - lowestIdx;

    // Aroon formula: 100 * (length - bars_since) / length
    aroonUp.push(100 * (length - barsSinceHighest) / length);
    aroonDown.push(100 * (length - barsSinceLowest) / length);
  }

  const upData = aroonUp.map((value, i) => ({ time: bars[i].time, value }));
  const downData = aroonDown.map((value, i) => ({ time: bars[i].time, value }));

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': upData,
      'plot1': downData,
    },
  };
}

export const Aroon = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
