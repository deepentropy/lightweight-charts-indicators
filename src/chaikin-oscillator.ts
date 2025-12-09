/**
 * Chaikin Oscillator
 *
 * Measures the momentum of the Accumulation/Distribution line.
 * Chaikin Oscillator = EMA(AD, fast) - EMA(AD, slow)
 *
 * AD = cumulative sum of: clv * volume
 * where clv = ((close - low) - (high - close)) / (high - low)
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface ChaikinOscillatorInputs {
  /** Fast EMA length */
  fast: number;
  /** Slow EMA length */
  slow: number;
}

export const defaultInputs: ChaikinOscillatorInputs = {
  fast: 3,
  slow: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'fast', type: 'int', title: 'Fast Length', defval: 3, min: 1 },
  { id: 'slow', type: 'int', title: 'Slow Length', defval: 10, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Chaikin Osc', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Chaikin Oscillator',
  shortTitle: 'Chaikin Osc',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<ChaikinOscillatorInputs> = {}): IndicatorResult {
  const { fast, slow } = { ...defaultInputs, ...inputs };

  // Calculate Accumulation/Distribution Line
  // AD = cumulative sum of MFV (Money Flow Volume)
  // MFV = CLV * volume
  // CLV = ((close - low) - (high - close)) / (high - low)
  const ad: number[] = [];
  let cumAd = 0;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const high = bar.high;
    const low = bar.low;
    const close = bar.close;
    const volume = bar.volume ?? 0;

    if (high === low) {
      // Avoid division by zero
      ad.push(cumAd);
    } else {
      const clv = ((close - low) - (high - close)) / (high - low);
      cumAd += clv * volume;
      ad.push(cumAd);
    }
  }

  // Create a Series from the AD line
  const adSeries = new Series(bars, (_, i) => ad[i]);

  // EMA of AD at fast and slow periods
  const fastEma = ta.ema(adSeries, fast);
  const slowEma = ta.ema(adSeries, slow);

  const fastArr = fastEma.toArray();
  const slowArr = slowEma.toArray();

  // Chaikin Oscillator = Fast EMA - Slow EMA
  const osc: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    const f = fastArr[i];
    const s = slowArr[i];

    if (f == null || s == null) {
      osc.push(NaN);
    } else {
      osc.push(f - s);
    }
  }

  const plotData = osc.map((value, i) => ({
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

export const ChaikinOscillator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
