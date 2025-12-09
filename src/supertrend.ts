/**
 * Supertrend Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * A trend-following overlay indicator that uses ATR to calculate
 * dynamic support/resistance levels.
 */

import { ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

/**
 * Supertrend indicator input parameters
 */
export interface SupertrendInputs {
  /** ATR period length */
  atrPeriod: number;
  /** ATR multiplier factor */
  factor: number;
}

/**
 * Default input values matching TradingView defaults
 */
export const defaultInputs: SupertrendInputs = {
  atrPeriod: 10,
  factor: 3.0,
};

/**
 * Input configuration for UI
 */
export const inputConfig: InputConfig[] = [
  { id: 'atrPeriod', type: 'int', title: 'ATR Length', defval: 10, min: 1 },
  { id: 'factor', type: 'float', title: 'Factor', defval: 3.0, min: 0.01, step: 0.01 },
];

/**
 * Plot configuration - order matches CSV: Up Trend, Down Trend
 */
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Up Trend', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'Down Trend', color: '#EF5350', lineWidth: 2 },
];

/**
 * Indicator metadata
 */
export const metadata = {
  title: 'Supertrend',
  shortTitle: 'ST',
  overlay: true,
};

/**
 * Calculate Supertrend indicator
 *
 * @param bars - OHLCV bar data
 * @param inputs - Indicator parameters (optional, uses defaults)
 * @returns Indicator result with plot data
 */
export function calculate(bars: Bar[], inputs: Partial<SupertrendInputs> = {}): IndicatorResult {
  const { atrPeriod, factor } = { ...defaultInputs, ...inputs };

  // Calculate Supertrend using ta.supertrend (returns [Series, Series])
  const [supertrendSeries, directionSeries] = ta.supertrend(bars, factor, atrPeriod);
  const supertrendValues = supertrendSeries.toArray();
  const directions = directionSeries.toArray();

  // Build plot data
  // Up Trend: shown when direction < 0 (bullish)
  // Down Trend: shown when direction >= 0 (bearish)
  // First bar is always NaN (barstate.isfirst check in PineScript)
  const upTrendData = supertrendValues.map((value: number | null, i: number) => ({
    time: bars[i].time,
    value: i === 0 ? NaN : ((directions[i] ?? 1) < 0 ? (value ?? NaN) : NaN),
  }));

  const downTrendData = supertrendValues.map((value: number | null, i: number) => ({
    time: bars[i].time,
    value: i === 0 ? NaN : ((directions[i] ?? 1) >= 0 ? (value ?? NaN) : NaN),
  }));

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': upTrendData,
      'plot1': downTrendData,
    },
  };
}

/**
 * Supertrend indicator module
 */
export const Supertrend = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
