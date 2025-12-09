/**
 * Volume Oscillator Indicator
 *
 * Measures the difference between two volume EMAs as a percentage.
 * osc = 100 * (shortEMA - longEMA) / longEMA
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface VolumeOscillatorInputs {
  /** Short EMA period */
  shortLength: number;
  /** Long EMA period */
  longLength: number;
}

export const defaultInputs: VolumeOscillatorInputs = {
  shortLength: 5,
  longLength: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'shortLength', type: 'int', title: 'Short Length', defval: 5, min: 1 },
  { id: 'longLength', type: 'int', title: 'Long Length', defval: 10, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume Osc', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Volume Oscillator',
  shortTitle: 'Vol Osc',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<VolumeOscillatorInputs> = {}): IndicatorResult {
  const { shortLength, longLength } = { ...defaultInputs, ...inputs };

  const volume = new Series(bars, b => b.volume ?? 0);

  // Short and Long EMAs of volume
  const shortEMA = ta.ema(volume, shortLength);
  const longEMA = ta.ema(volume, longLength);

  const shortArr = shortEMA.toArray();
  const longArr = longEMA.toArray();

  // Volume Oscillator = 100 * (short - long) / long
  const oscValues: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    const short = shortArr[i];
    const long = longArr[i];

    if (short == null || long == null || long === 0) {
      oscValues.push(NaN);
    } else {
      oscValues.push(100 * (short - long) / long);
    }
  }

  const oscData = oscValues.map((value, i) => ({
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
      'plot0': oscData,
    },
  };
}

export const VolumeOscillator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
