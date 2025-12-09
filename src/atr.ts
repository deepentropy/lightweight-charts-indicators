/**
 * Average True Range (ATR) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Measures market volatility by calculating the average range between high and low prices.
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

/**
 * ATR indicator input parameters
 */
export interface ATRInputs {
  /** Period length */
  length: number;
  /** Smoothing method */
  smoothing: 'RMA' | 'SMA' | 'EMA' | 'WMA';
}

/**
 * Default input values
 */
export const defaultInputs: ATRInputs = {
  length: 14,
  smoothing: 'RMA',
};

/**
 * Input configuration for UI
 */
export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
  { id: 'smoothing', type: 'string', title: 'Smoothing', defval: 'RMA', options: ['RMA', 'SMA', 'EMA', 'WMA'] },
];

/**
 * Plot configuration
 */
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ATR', color: '#2962FF', lineWidth: 2 },
];

/**
 * Indicator metadata
 */
export const metadata = {
  title: 'Average True Range',
  shortTitle: 'ATR',
  overlay: false,
};

/**
 * Calculate ATR indicator
 *
 * @param bars - OHLCV bar data
 * @param inputs - Indicator parameters (optional, uses defaults)
 * @returns Indicator result with plot data
 */
export function calculate(bars: Bar[], inputs: Partial<ATRInputs> = {}): IndicatorResult {
  const { length, smoothing } = { ...defaultInputs, ...inputs };

  // Calculate True Range
  const trueRange = ta.tr(bars, true);

  // Apply smoothing
  let atr: Series;
  switch (smoothing) {
    case 'SMA':
      atr = ta.sma(trueRange, length);
      break;
    case 'EMA':
      atr = ta.ema(trueRange, length);
      break;
    case 'WMA':
      atr = ta.wma(trueRange, length);
      break;
    case 'RMA':
    default:
      atr = ta.rma(trueRange, length);
      break;
  }

  // Convert to plot format
  const plotData = atr.toArray().map((value, i) => ({
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
 * ATR indicator module
 */
export const ATR = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
