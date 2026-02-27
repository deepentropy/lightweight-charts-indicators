/**
 * Bullish Engulfing Finder
 *
 * Automatic detection of bullish engulfing candlestick patterns.
 * Bullish engulfing: previous candle bearish, current candle bullish,
 * current body fully engulfs previous body.
 *
 * Reference: TradingView "Bullish Engulfing automatic finding script" (community)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';

export interface BullishEngulfingFinderInputs {}

export const defaultInputs: BullishEngulfingFinderInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Close', color: 'transparent', lineWidth: 0, display: 'none' },
];

export const metadata = {
  title: 'Bullish Engulfing Finder',
  shortTitle: 'BullEngulf',
  overlay: true,
};

export function calculate(bars: Bar[], _inputs: Partial<BullishEngulfingFinderInputs> = {}): IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[] } {
  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];

  const plot0 = bars.map((b) => ({ time: b.time, value: NaN }));

  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1];
    const curr = bars[i];

    const prevBearish = prev.close < prev.open;
    const currBullish = curr.close > curr.open;
    const engulfing = prevBearish && currBullish && curr.open <= prev.close && curr.close >= prev.open;

    if (engulfing) {
      markers.push({ time: curr.time, position: 'belowBar', shape: 'arrowUp', color: '#26A69A', text: 'Bull' });
      barColors.push({ time: curr.time, color: '#FFEB3B' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    markers,
    barColors,
  };
}

export const BullishEngulfingFinder = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
