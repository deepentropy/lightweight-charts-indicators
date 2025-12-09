/**
 * Awesome Oscillator (AO) Indicator
 *
 * Measures market momentum using the difference between
 * 5-period and 34-period simple moving averages of the median price.
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface AwesomeOscillatorInputs {
  /** Fast SMA period */
  fastPeriod: number;
  /** Slow SMA period */
  slowPeriod: number;
}

export const defaultInputs: AwesomeOscillatorInputs = {
  fastPeriod: 5,
  slowPeriod: 34,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastPeriod', type: 'int', title: 'Fast Period', defval: 5, min: 1 },
  { id: 'slowPeriod', type: 'int', title: 'Slow Period', defval: 34, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'AO', color: '#009688', lineWidth: 1 },
];

export const metadata = {
  title: 'Awesome Oscillator',
  shortTitle: 'AO',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<AwesomeOscillatorInputs> = {}): IndicatorResult {
  const { fastPeriod, slowPeriod } = { ...defaultInputs, ...inputs };

  // hl2 = (high + low) / 2
  const high = new Series(bars, b => b.high);
  const low = new Series(bars, b => b.low);
  const hl2 = high.add(low).div(2);

  // AO = SMA(hl2, fast) - SMA(hl2, slow)
  const fastSma = ta.sma(hl2, fastPeriod);
  const slowSma = ta.sma(hl2, slowPeriod);
  const ao = fastSma.sub(slowSma);

  const aoArr = ao.toArray();
  const aoData = aoArr.map((value: number | null, i: number) => ({
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
      'plot0': aoData,
    },
  };
}

export const AwesomeOscillator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
