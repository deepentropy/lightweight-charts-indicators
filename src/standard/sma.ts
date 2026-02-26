/**
 * Simple Moving Average (SMA) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Matches TradingView's built-in SMA indicator.
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

/**
 * SMA indicator input parameters
 */
export interface SMAInputs {
  /** SMA period length */
  len: number;
  /** Price source */
  src: SourceType;
  /** Plot offset */
  offset: number;
}

/**
 * Default input values
 */
export const defaultInputs: SMAInputs = {
  len: 9,
  src: 'close',
  offset: 0,
};

/**
 * Input configuration for UI
 */
export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Length', defval: 9, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'offset', type: 'int', title: 'Offset', defval: 0, min: -500, max: 500 },
];

/**
 * Plot configuration
 */
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA', color: '#2962FF', lineWidth: 2 },
];

/**
 * Indicator metadata
 */
export const metadata = {
  title: 'Simple Moving Average',
  shortTitle: 'SMA',
  overlay: true,
};

/**
 * Calculate SMA indicator
 *
 * @param bars - OHLCV bar data
 * @param inputs - Indicator parameters (optional, uses defaults)
 * @returns Indicator result with plot data
 */
export function calculate(bars: Bar[], inputs: Partial<SMAInputs> = {}): IndicatorResult {
  const { len, src } = { ...defaultInputs, ...inputs };

  // Get source series
  const source = getSourceSeries(bars, src);

  // Calculate SMA
  const smaResult = ta.sma(source, len);

  // Convert to plot format
  const plotData = smaResult.toArray().map((value, i) => ({
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
 * SMA indicator module
 */
export const SMA = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
