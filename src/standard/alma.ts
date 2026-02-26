/**
 * Arnaud Legoux Moving Average (ALMA) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Uses a Gaussian distribution to reduce lag while maintaining smoothness.
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

/**
 * ALMA indicator input parameters
 */
export interface ALMAInputs {
  /** Period length */
  lengthInput: number;
  /** Offset - controls tradeoff between smoothness (closer to 1) and responsiveness (closer to 0) */
  offsetInput: number;
  /** Sigma - standard deviation applied for sharpness */
  sigmaInput: number;
}

/**
 * Default input values
 */
export const defaultInputs: ALMAInputs = {
  lengthInput: 9,
  offsetInput: 0.85,
  sigmaInput: 6,
};

/**
 * Input configuration for UI
 */
export const inputConfig: InputConfig[] = [
  { id: 'lengthInput', type: 'int', title: 'Length', defval: 9, min: 1 },
  { id: 'offsetInput', type: 'float', title: 'Offset', defval: 0.85, step: 0.01 },
  { id: 'sigmaInput', type: 'float', title: 'Sigma', defval: 6 },
];

/**
 * Plot configuration
 */
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ALMA', color: '#2962FF', lineWidth: 2 },
];

/**
 * Indicator metadata
 */
export const metadata = {
  title: 'Arnaud Legoux Moving Average',
  shortTitle: 'ALMA',
  overlay: true,
};

/**
 * Calculate ALMA indicator
 *
 * @param bars - OHLCV bar data
 * @param inputs - Indicator parameters (optional, uses defaults)
 * @returns Indicator result with plot data
 */
export function calculate(bars: Bar[], inputs: Partial<ALMAInputs> = {}): IndicatorResult {
  const { lengthInput, offsetInput, sigmaInput } = { ...defaultInputs, ...inputs };

  // Use close price as source
  const close = new Series(bars, (bar) => bar.close);

  // Calculate ALMA
  const alma = ta.alma(close, lengthInput, offsetInput, sigmaInput);

  // Convert to plot format
  const plotData = alma.toArray().map((value, i) => ({
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
 * ALMA indicator module
 */
export const ALMA = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
