/**
 * Mass Index Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Identifies trend reversals by examining range between high and low.
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface MassIndexInputs {
  length: number;
}

export const defaultInputs: MassIndexInputs = {
  length: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 10, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Mass Index', color: '#E91E63', lineWidth: 2 },
];

export const metadata = {
  title: 'Mass Index',
  shortTitle: 'MI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<MassIndexInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };

  const high = new Series(bars, (bar) => bar.high);
  const low = new Series(bars, (bar) => bar.low);

  // Mass Index = Sum(EMA(high-low, 9) / EMA(EMA(high-low, 9), 9), length)
  const range = high.sub(low);
  const ema1 = ta.ema(range, 9);
  const ema2 = ta.ema(ema1, 9);
  const ratio = ema1.div(ema2);

  // Calculate rolling sum of ratio over 'length' periods
  const ratioArr = ratio.toArray();
  const massIndexArr: (number | undefined)[] = [];

  for (let i = 0; i < bars.length; i++) {
    if (i < length - 1) {
      massIndexArr.push(undefined);
    } else {
      let sum = 0;
      let validCount = 0;
      for (let j = 0; j < length; j++) {
        const val = ratioArr[i - j];
        if (val !== undefined && !isNaN(val)) {
          sum += val;
          validCount++;
        }
      }
      massIndexArr.push(validCount === length ? sum : undefined);
    }
  }

  const plotData = massIndexArr.map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plotData },
  };
}

export const MassIndex = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
