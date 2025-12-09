/**
 * TRIX Indicator
 *
 * Triple Exponential Average Rate of Change.
 * Shows the percent rate of change of a triple exponentially smoothed moving average.
 *
 * Based on TradingView's TRIX indicator.
 */

import { Series, ta, type Bar, type IndicatorResult, type InputConfig, type PlotConfig } from 'oakscriptjs';

export interface TRIXInputs {
  /** EMA period length */
  length: number;
}

export const defaultInputs: TRIXInputs = {
  length: 18,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 18, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'TRIX', color: '#F44336', lineWidth: 2 },
];

export const metadata = {
  title: 'TRIX',
  shortTitle: 'TRIX',
  overlay: false,
};

/**
 * Calculate TRIX
 *
 * Algorithm:
 * 1. Take log of close prices
 * 2. Apply EMA three times
 * 3. Calculate rate of change (1-bar difference)
 * 4. Multiply by 10000 for readability
 */
export function calculate(bars: Bar[], inputs: Partial<TRIXInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };

  // Step 1: Take log of close prices
  const logClose: number[] = bars.map(bar => Math.log(bar.close));
  const logCloseSeries = new Series(bars, (_, i) => logClose[i]);

  // Step 2: Apply EMA three times using ta module
  const ema1 = ta.ema(logCloseSeries, length);
  const ema2 = ta.ema(ema1, length);
  const ema3 = ta.ema(ema2, length);

  // Step 3: Calculate rate of change and multiply by 10000
  const trixChange = ta.change(ema3, 1);
  const trixArr = trixChange.toArray();

  const plotData = trixArr.map((value, i) => ({
    time: bars[i].time,
    value: value !== null ? value * 10000 : NaN,
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

export const TRIX = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
