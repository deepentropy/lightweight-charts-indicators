/**
 * Entry Points
 *
 * Overlay indicator with buy/sell signals based on EMA touch logic.
 * No visible EMA plot on chart - only markers.
 *
 * Buy: close > ema AND low <= ema AND open > ema, OR open < ema AND close > ema
 *      (price touches EMA from above = buy signal)
 * Sell: close < ema AND high >= ema AND open < ema, OR open > ema AND close < ema
 *       (price touches EMA from below = sell signal)
 *
 * Reference: TradingView "Entry points" (community)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface EntryPointsInputs {
  period: number;
}

export const defaultInputs: EntryPointsInputs = {
  period: 100,
};

export const inputConfig: InputConfig[] = [
  { id: 'period', type: 'int', title: 'Period', defval: 100, min: 1 },
];

// No visible plots - only markers on overlay
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Entry Points',
  shortTitle: 'EntryPts',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<EntryPointsInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { period } = { ...defaultInputs, ...inputs };
  const closeSeries = getSourceSeries(bars, 'close');
  const emaArr = ta.ema(closeSeries, period).toArray();

  const markers: MarkerData[] = [];

  for (let i = period; i < bars.length; i++) {
    const ema = emaArr[i];
    if (ema == null || isNaN(ema)) continue;

    const { close, low, high, open } = bars[i];

    // Pine: buy = close > b and low <= b and open > b or open < b and close > b
    const buy = (close > ema && low <= ema && open > ema) || (open < ema && close > ema);
    // Pine: sell = close < b and high >= b and open < b or open > b and close < b
    const sell = (close < ema && high >= ema && open < ema) || (open > ema && close < ema);

    if (buy) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#4CAF50', text: 'Buy' });
    }
    if (sell) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#EF5350', text: 'Sell' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
  };
}

export const EntryPoints = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
