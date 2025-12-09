/**
 * Balance of Power (BOP) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Measures the strength of buyers vs sellers by comparing close-open to high-low range.
 */

import { Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

/**
 * BOP indicator input parameters (none required)
 */
export interface BOPInputs {
  // BOP has no configurable inputs
}

/**
 * Default input values
 */
export const defaultInputs: BOPInputs = {};

/**
 * Input configuration for UI
 */
export const inputConfig: InputConfig[] = [];

/**
 * Plot configuration
 */
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'BOP', color: '#2962FF', lineWidth: 2 },
];

/**
 * Indicator metadata
 */
export const metadata = {
  title: 'Balance of Power',
  shortTitle: 'BOP',
  overlay: false,
};

/**
 * Calculate BOP indicator
 *
 * Formula: (close - open) / (high - low)
 *
 * @param bars - OHLCV bar data
 * @param inputs - Indicator parameters (optional, none for BOP)
 * @returns Indicator result with plot data
 */
export function calculate(bars: Bar[], inputs: Partial<BOPInputs> = {}): IndicatorResult {
  // Create OHLC series
  const open = new Series(bars, (bar) => bar.open);
  const high = new Series(bars, (bar) => bar.high);
  const low = new Series(bars, (bar) => bar.low);
  const close = new Series(bars, (bar) => bar.close);

  // Calculate BOP: (close - open) / (high - low)
  const bop = close.sub(open).div(high.sub(low));

  // Convert to plot format
  const plotData = bop.toArray().map((value, i) => ({
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
      'plot0': plotData,
    },
  };
}

/**
 * BOP indicator module
 */
export const BOP = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
