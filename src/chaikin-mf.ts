/**
 * Chaikin Money Flow (CMF) Indicator
 *
 * Measures the amount of Money Flow Volume over a specific period.
 * CMF = Sum(Money Flow Volume, n) / Sum(Volume, n)
 * where Money Flow Volume = ((Close - Low) - (High - Close)) / (High - Low) * Volume
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface ChaikinMFInputs {
  /** Period length */
  length: number;
}

export const defaultInputs: ChaikinMFInputs = {
  length: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'CMF', color: '#43A047', lineWidth: 1 },
];

export const metadata = {
  title: 'Chaikin Money Flow',
  shortTitle: 'CMF',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<ChaikinMFInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };

  // Calculate Money Flow Multiplier and Money Flow Volume for each bar
  // ad = close==high and close==low or high==low ? 0 : ((2*close-low-high)/(high-low))*volume
  const ad: number[] = [];
  const vol: number[] = [];

  for (let i = 0; i < bars.length; i++) {
    const { high, low, close, volume } = bars[i];
    const v = volume ?? 0;
    vol.push(v);

    if ((close === high && close === low) || high === low) {
      ad.push(0);
    } else {
      ad.push(((2 * close - low - high) / (high - low)) * v);
    }
  }

  // CMF = Sum(ad, length) / Sum(volume, length)
  const cmf: number[] = [];

  for (let i = 0; i < bars.length; i++) {
    if (i < length - 1) {
      cmf.push(NaN);
      continue;
    }

    let sumAD = 0;
    let sumVol = 0;

    for (let j = i - length + 1; j <= i; j++) {
      sumAD += ad[j];
      sumVol += vol[j];
    }

    if (sumVol === 0) {
      cmf.push(0);
    } else {
      cmf.push(sumAD / sumVol);
    }
  }

  const plotData = cmf.map((value, i) => ({
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

export const ChaikinMF = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
