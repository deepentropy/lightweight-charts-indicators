/**
 * Stochastic RSI Indicator
 *
 * Applies the Stochastic formula to RSI values.
 * More sensitive than standard RSI.
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface StochRSIInputs {
  /** K smoothing period */
  smoothK: number;
  /** D smoothing period */
  smoothD: number;
  /** RSI period */
  lengthRSI: number;
  /** Stochastic period */
  lengthStoch: number;
}

export const defaultInputs: StochRSIInputs = {
  smoothK: 3,
  smoothD: 3,
  lengthRSI: 14,
  lengthStoch: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'smoothK', type: 'int', title: 'K', defval: 3, min: 1 },
  { id: 'smoothD', type: 'int', title: 'D', defval: 3, min: 1 },
  { id: 'lengthRSI', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'lengthStoch', type: 'int', title: 'Stochastic Length', defval: 14, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'K', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'D', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'Stochastic RSI',
  shortTitle: 'Stoch RSI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<StochRSIInputs> = {}): IndicatorResult {
  const { smoothK, smoothD, lengthRSI, lengthStoch } = { ...defaultInputs, ...inputs };

  const close = new Series(bars, b => b.close);

  // Calculate RSI
  const rsiSeries = ta.rsi(close, lengthRSI);

  // Apply Stochastic to RSI: stoch(rsi, rsi, rsi, lengthStoch)
  // stoch = 100 * (src - lowest(low, len)) / (highest(high, len) - lowest(low, len))
  // Here src = high = low = rsi
  const stochRsi = ta.stoch(rsiSeries, rsiSeries, rsiSeries, lengthStoch);

  // K = SMA(stoch, smoothK)
  const kSeries = ta.sma(stochRsi, smoothK);

  // D = SMA(K, smoothD)
  const dSeries = ta.sma(kSeries, smoothD);

  const kArr = kSeries.toArray();
  const dArr = dSeries.toArray();

  const kData = kArr.map((value: number | null, i: number) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  const dData = dArr.map((value: number | null, i: number) => ({
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
      'plot0': kData,
      'plot1': dData,
    },
  };
}

export const StochRSI = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
