/**
 * Relative Vigor Index (RVI/RVGI) Indicator
 *
 * Measures the conviction of a recent price action.
 * Based on the relationship between close-open and high-low.
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface RVIInputs {
  /** Period length */
  length: number;
}

export const defaultInputs: RVIInputs = {
  length: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 10, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RVGI', color: '#008000', lineWidth: 1 },
  { id: 'plot1', title: 'Signal', color: '#FF0000', lineWidth: 1 },
];

export const metadata = {
  title: 'Relative Vigor Index',
  shortTitle: 'RVGI',
  overlay: false,
};

/**
 * Symmetrically Weighted Moving Average (SWMA)
 * Weights: 1, 2, 2, 1 (period 4)
 */
function swma(values: number[]): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < 3) {
      result.push(NaN);
      continue;
    }
    const swmaVal = (values[i - 3] + 2 * values[i - 2] + 2 * values[i - 1] + values[i]) / 6;
    result.push(swmaVal);
  }
  return result;
}

export function calculate(bars: Bar[], inputs: Partial<RVIInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };

  // close - open
  const closeMinusOpen = bars.map(b => b.close - b.open);
  // high - low
  const highMinusLow = bars.map(b => b.high - b.low);

  // SWMA of close-open and high-low
  const swmaCloseOpen = swma(closeMinusOpen);
  const swmaHighLow = swma(highMinusLow);

  // Sum over length period
  const rviValues: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (i < length + 2) {
      rviValues.push(NaN);
      continue;
    }

    let sumCloseOpen = 0;
    let sumHighLow = 0;

    for (let j = i - length + 1; j <= i; j++) {
      if (!isNaN(swmaCloseOpen[j])) sumCloseOpen += swmaCloseOpen[j];
      if (!isNaN(swmaHighLow[j])) sumHighLow += swmaHighLow[j];
    }

    if (sumHighLow === 0) {
      rviValues.push(0);
    } else {
      rviValues.push(sumCloseOpen / sumHighLow);
    }
  }

  // Signal = SWMA(RVI)
  const signalValues = swma(rviValues);

  const rviData = rviValues.map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  const signalData = signalValues.map((value, i) => ({
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
      'plot0': rviData,
      'plot1': signalData,
    },
  };
}

export const RVI = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
