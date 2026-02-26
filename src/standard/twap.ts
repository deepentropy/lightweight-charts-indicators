/**
 * Time Weighted Average Price (TWAP) Indicator
 *
 * Cumulative average of ohlc4 within anchor period.
 * On daily data with 1D anchor, TWAP = ohlc4 each bar (period resets every bar).
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface TWAPInputs {
  // Anchor period and source are fixed for default behavior
}

export const defaultInputs: TWAPInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'TWAP', color: '#dd7a28', lineWidth: 2 },
];

export const metadata = {
  title: 'Time Weighted Average Price',
  shortTitle: 'TWAP',
  overlay: true,
};

export function calculate(bars: Bar[], _inputs: Partial<TWAPInputs> = {}): IndicatorResult {
  // For daily data with 1D anchor: each bar resets, so TWAP = ohlc4
  const plotData = bars.map(bar => ({
    time: bar.time,
    value: (bar.open + bar.high + bar.low + bar.close) / 4,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plotData },
  };
}

export const TWAP = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
