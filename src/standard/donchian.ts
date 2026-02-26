/**
 * Donchian Channels (DC) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * A trend-following indicator that shows the highest high and lowest low
 * over a specified period, with a midline (basis).
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

/**
 * Donchian Channels indicator input parameters
 */
export interface DonchianInputs {
  /** Lookback period */
  length: number;
  /** Plot offset */
  offset: number;
}

/**
 * Default input values matching TradingView defaults
 */
export const defaultInputs: DonchianInputs = {
  length: 20,
  offset: 0,
};

/**
 * Input configuration for UI
 */
export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
  { id: 'offset', type: 'int', title: 'Offset', defval: 0 },
];

/**
 * Plot configuration - order matches CSV: Basis, Upper, Lower
 */
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Basis', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot1', title: 'Upper', color: '#2962FF', lineWidth: 1 },
  { id: 'plot2', title: 'Lower', color: '#2962FF', lineWidth: 1 },
];

/**
 * Indicator metadata
 */
export const metadata = {
  title: 'Donchian Channels',
  shortTitle: 'DC',
  overlay: true,
};

/**
 * Calculate Donchian Channels indicator
 *
 * @param bars - OHLCV bar data
 * @param inputs - Indicator parameters (optional, uses defaults)
 * @returns Indicator result with plot data
 */
export function calculate(bars: Bar[], inputs: Partial<DonchianInputs> = {}): IndicatorResult {
  const { length, offset } = { ...defaultInputs, ...inputs };

  const high = new Series(bars, (bar) => bar.high);
  const low = new Series(bars, (bar) => bar.low);

  // Calculate upper (highest high) and lower (lowest low)
  const upper = ta.highest(high, length);
  const lower = ta.lowest(low, length);

  // Calculate basis (midline)
  const basis = upper.add(lower).div(2);

  // Convert to arrays
  const basisArr = basis.toArray();
  const upperArr = upper.toArray();
  const lowerArr = lower.toArray();

  // Build plot data with offset
  const basisData = basisArr.map((value, i) => {
    const targetIndex = i + offset;
    return {
      time: bars[i].time,
      value: targetIndex >= 0 && targetIndex < bars.length ? (value ?? NaN) : NaN,
    };
  });

  const upperData = upperArr.map((value, i) => {
    const targetIndex = i + offset;
    return {
      time: bars[i].time,
      value: targetIndex >= 0 && targetIndex < bars.length ? (value ?? NaN) : NaN,
    };
  });

  const lowerData = lowerArr.map((value, i) => {
    const targetIndex = i + offset;
    return {
      time: bars[i].time,
      value: targetIndex >= 0 && targetIndex < bars.length ? (value ?? NaN) : NaN,
    };
  });

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': basisData,
      'plot1': upperData,
      'plot2': lowerData,
    },
  };
}

/**
 * Donchian Channels indicator module
 */
export const DonchianChannels = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
