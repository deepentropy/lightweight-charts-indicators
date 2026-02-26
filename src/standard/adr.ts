/**
 * Average Day Range (ADR) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Calculates the average of the daily price range (high - low) over a specified period.
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

/**
 * ADR indicator input parameters
 */
export interface ADRInputs {
  /** Period length for averaging */
  lengthInput: number;
}

/**
 * Default input values
 */
export const defaultInputs: ADRInputs = {
  lengthInput: 14,
};

/**
 * Input configuration for UI
 */
export const inputConfig: InputConfig[] = [
  { id: 'lengthInput', type: 'int', title: 'Length', defval: 14, min: 1 },
];

/**
 * Plot configuration
 */
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ADR', color: '#2962FF', lineWidth: 2 },
];

/**
 * Indicator metadata
 */
export const metadata = {
  title: 'Average Day Range',
  shortTitle: 'ADR',
  overlay: false,
};

/**
 * Calculate ADR indicator
 *
 * @param bars - OHLCV bar data
 * @param inputs - Indicator parameters (optional, uses defaults)
 * @returns Indicator result with plot data
 */
export function calculate(bars: Bar[], inputs: Partial<ADRInputs> = {}): IndicatorResult {
  const { lengthInput } = { ...defaultInputs, ...inputs };

  // Create series for high and low
  const high = new Series(bars, (bar) => bar.high);
  const low = new Series(bars, (bar) => bar.low);

  // Calculate ADR: SMA of (high - low)
  const range = high.sub(low);
  const adr = ta.sma(range, lengthInput);

  // Convert to plot format
  const plotData = adr.toArray().map((value, i) => ({
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
 * ADR indicator module
 */
export const ADR = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
