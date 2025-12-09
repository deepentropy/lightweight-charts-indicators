/**
 * Choppiness Index Indicator
 *
 * Measures market choppiness vs trending.
 * High values (>61.8) indicate choppy/ranging markets.
 * Low values (<38.2) indicate trending markets.
 * CI = 100 * log10(sum(ATR, n) / (highest - lowest)) / log10(n)
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface ChoppinessInputs {
  /** Period length */
  length: number;
}

export const defaultInputs: ChoppinessInputs = {
  length: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'CHOP', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Choppiness Index',
  shortTitle: 'CHOP',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<ChoppinessInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };

  // Calculate ATR(1) for each bar
  const atr1 = ta.atr(bars, 1);
  const atr1Arr = atr1.toArray();

  const high = new Series(bars, b => b.high);
  const low = new Series(bars, b => b.low);

  const highest = ta.highest(high, length);
  const lowest = ta.lowest(low, length);

  const highestArr = highest.toArray();
  const lowestArr = lowest.toArray();

  // CI = 100 * log10(sum(ATR(1), length) / (highest - lowest)) / log10(length)
  const chop: number[] = [];

  for (let i = 0; i < bars.length; i++) {
    if (i < length - 1) {
      chop.push(NaN);
      continue;
    }

    // Sum of ATR(1) over length
    let sumATR = 0;
    for (let j = i - length + 1; j <= i; j++) {
      const atrVal = atr1Arr[j];
      if (atrVal != null && !isNaN(atrVal)) {
        sumATR += atrVal;
      }
    }

    const h = highestArr[i];
    const l = lowestArr[i];

    if (h == null || l == null || h === l) {
      chop.push(NaN);
    } else {
      const range = h - l;
      const ci = 100 * Math.log10(sumATR / range) / Math.log10(length);
      chop.push(ci);
    }
  }

  const plotData = chop.map((value, i) => ({
    time: bars[i].time,
    value,
  }));

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

export const Choppiness = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
