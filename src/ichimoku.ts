/**
 * Ichimoku Cloud Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * A comprehensive trend-following system that shows support/resistance,
 * momentum, and trend direction all at once.
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

/**
 * Ichimoku Cloud indicator input parameters
 */
export interface IchimokuInputs {
  /** Conversion Line (Tenkan-sen) period */
  conversionPeriods: number;
  /** Base Line (Kijun-sen) period */
  basePeriods: number;
  /** Leading Span B (Senkou Span B) period */
  laggingSpan2Periods: number;
  /** Displacement for Leading Spans and Lagging Span */
  displacement: number;
}

/**
 * Default input values matching TradingView defaults
 */
export const defaultInputs: IchimokuInputs = {
  conversionPeriods: 9,
  basePeriods: 26,
  laggingSpan2Periods: 52,
  displacement: 26,
};

/**
 * Input configuration for UI
 */
export const inputConfig: InputConfig[] = [
  { id: 'conversionPeriods', type: 'int', title: 'Conversion Line Length', defval: 9, min: 1 },
  { id: 'basePeriods', type: 'int', title: 'Base Line Length', defval: 26, min: 1 },
  { id: 'laggingSpan2Periods', type: 'int', title: 'Leading Span B Length', defval: 52, min: 1 },
  { id: 'displacement', type: 'int', title: 'Lagging Span', defval: 26, min: 1 },
];

/**
 * Plot configuration - order matches CSV columns
 */
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Conversion Line', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Base Line', color: '#B71C1C', lineWidth: 1 },
  { id: 'plot2', title: 'Lagging Span', color: '#43A047', lineWidth: 1 },
  { id: 'plot3', title: 'Leading Span A', color: '#A5D6A7', lineWidth: 1 },
  { id: 'plot4', title: 'Leading Span B', color: '#EF9A9A', lineWidth: 1 },
];

/**
 * Indicator metadata
 */
export const metadata = {
  title: 'Ichimoku Cloud',
  shortTitle: 'Ichimoku',
  overlay: true,
};

/**
 * Donchian midline calculation: (highest + lowest) / 2
 */
function donchian(high: Series, low: Series, length: number): Series {
  const highest = ta.highest(high, length);
  const lowest = ta.lowest(low, length);
  return highest.add(lowest).div(2);
}

/**
 * Calculate Ichimoku Cloud indicator
 *
 * @param bars - OHLCV bar data
 * @param inputs - Indicator parameters (optional, uses defaults)
 * @returns Indicator result with plot data
 */
export function calculate(bars: Bar[], inputs: Partial<IchimokuInputs> = {}): IndicatorResult {
  const { conversionPeriods, basePeriods, laggingSpan2Periods, displacement } = { ...defaultInputs, ...inputs };

  const high = new Series(bars, (bar) => bar.high);
  const low = new Series(bars, (bar) => bar.low);
  const close = new Series(bars, (bar) => bar.close);

  // Calculate the main lines
  const conversionLine = donchian(high, low, conversionPeriods);
  const baseLine = donchian(high, low, basePeriods);

  // Leading Span A = average of conversion and base lines
  const leadingSpanA = conversionLine.add(baseLine).div(2);

  // Leading Span B = donchian of laggingSpan2Periods
  const leadingSpanB = donchian(high, low, laggingSpan2Periods);

  // Convert to arrays for manipulation
  const conversionArr = conversionLine.toArray();
  const baseArr = baseLine.toArray();
  const closeArr = close.toArray();
  const leadAArr = leadingSpanA.toArray();
  const leadBArr = leadingSpanB.toArray();

  // Build plot data with proper offsets
  // Conversion Line - no offset
  const conversionData = conversionArr.map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  // Base Line - no offset
  const baseData = baseArr.map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  // Lagging Span - offset backward by (displacement - 1)
  // In TradingView: plot(close, offset = -displacement + 1)
  // This means the value at bar i is plotted at bar i - (displacement - 1)
  const laggingData = bars.map((bar, i) => {
    // The lagging span at position i should show the close from (displacement - 1) bars ahead
    const sourceIndex = i + (displacement - 1);
    const value = sourceIndex < bars.length ? closeArr[sourceIndex] : NaN;
    return {
      time: bar.time,
      value: value ?? NaN,
    };
  });

  // Leading Span A - offset forward by (displacement - 1)
  // In TradingView: plot(leadLine1, offset = displacement - 1)
  // This means the value at bar i is plotted at bar i + (displacement - 1)
  const leadingAData = bars.map((bar, i) => {
    // The leading span at position i should show the value from (displacement - 1) bars ago
    const sourceIndex = i - (displacement - 1);
    const value = sourceIndex >= 0 ? leadAArr[sourceIndex] : NaN;
    return {
      time: bar.time,
      value: value ?? NaN,
    };
  });

  // Leading Span B - offset forward by (displacement - 1)
  const leadingBData = bars.map((bar, i) => {
    const sourceIndex = i - (displacement - 1);
    const value = sourceIndex >= 0 ? leadBArr[sourceIndex] : NaN;
    return {
      time: bar.time,
      value: value ?? NaN,
    };
  });

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': conversionData,
      'plot1': baseData,
      'plot2': laggingData,
      'plot3': leadingAData,
      'plot4': leadingBData,
    },
  };
}

/**
 * Ichimoku Cloud indicator module
 */
export const IchimokuCloud = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
