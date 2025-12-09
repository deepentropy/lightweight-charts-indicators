/**
 * Parabolic SAR Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * A trend-following indicator that provides potential entry and exit points.
 * SAR stands for "Stop and Reverse".
 */

import { ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

/**
 * Parabolic SAR indicator input parameters
 */
export interface ParabolicSARInputs {
  /** Acceleration Factor start value */
  start: number;
  /** Acceleration Factor increment */
  increment: number;
  /** Acceleration Factor maximum */
  maximum: number;
}

/**
 * Default input values matching TradingView defaults
 */
export const defaultInputs: ParabolicSARInputs = {
  start: 0.02,
  increment: 0.02,
  maximum: 0.2,
};

/**
 * Input configuration for UI
 */
export const inputConfig: InputConfig[] = [
  { id: 'start', type: 'float', title: 'Start', defval: 0.02, min: 0.0001, step: 0.01 },
  { id: 'increment', type: 'float', title: 'Increment', defval: 0.02, min: 0.0001, step: 0.01 },
  { id: 'maximum', type: 'float', title: 'Max Value', defval: 0.2, min: 0.01, step: 0.01 },
];

/**
 * Plot configuration - single output: ParabolicSAR
 */
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ParabolicSAR', color: '#2962FF', lineWidth: 1 },
];

/**
 * Indicator metadata
 */
export const metadata = {
  title: 'Parabolic SAR',
  shortTitle: 'SAR',
  overlay: true,
};

/**
 * Calculate Parabolic SAR indicator
 *
 * @param bars - OHLCV bar data
 * @param inputs - Indicator parameters (optional, uses defaults)
 * @returns Indicator result with plot data
 */
export function calculate(bars: Bar[], inputs: Partial<ParabolicSARInputs> = {}): IndicatorResult {
  const { start, increment, maximum } = { ...defaultInputs, ...inputs };

  // Calculate SAR using ta.sar (returns a Series)
  const sarSeries = ta.sar(bars, start, increment, maximum);
  const sarValues = sarSeries.toArray();

  // Convert to plot format
  const sarData = sarValues.map((value: number | null, i: number) => ({
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
      'plot0': sarData,
    },
  };
}

/**
 * Parabolic SAR indicator module
 */
export const ParabolicSAR = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
