/**
 * Historical Volatility (HV) Indicator
 *
 * Measures the annualized standard deviation of log returns.
 * HV = 100 * stdev(ln(close/close[1]), length) * sqrt(annual/per)
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface HistoricalVolatilityInputs {
  /** Period length */
  length: number;
  /** Annual trading days */
  annual: number;
  /** Period multiplier (1 for daily, 7 for weekly) */
  per: number;
}

export const defaultInputs: HistoricalVolatilityInputs = {
  length: 10,
  annual: 365,
  per: 1, // Assumes daily data
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 10, min: 1 },
  { id: 'annual', type: 'int', title: 'Annual', defval: 365 },
  { id: 'per', type: 'int', title: 'Period', defval: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'HV', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Historical Volatility',
  shortTitle: 'HV',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<HistoricalVolatilityInputs> = {}): IndicatorResult {
  const { length, annual, per } = { ...defaultInputs, ...inputs };

  // Calculate log returns
  const logReturns: number[] = [NaN];
  for (let i = 1; i < bars.length; i++) {
    logReturns.push(Math.log(bars[i].close / bars[i - 1].close));
  }

  // Calculate stdev of log returns
  const logReturnsSeries = new Series(bars, (_, i) => logReturns[i]);
  const stdevValues = ta.stdev(logReturnsSeries, length);
  const stdevArr = stdevValues.toArray();

  // Annualize: HV = 100 * stdev * sqrt(annual/per)
  const multiplier = 100 * Math.sqrt(annual / per);

  const hvData = stdevArr.map((value: number | null, i: number) => ({
    time: bars[i].time,
    value: value != null ? value * multiplier : NaN,
  }));

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': hvData,
    },
  };
}

export const HistoricalVolatility = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
