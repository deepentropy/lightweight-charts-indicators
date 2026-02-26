/**
 * All Candlestick Patterns Identifier
 *
 * Detects common candlestick patterns: Doji, Hammer, Engulfing,
 * Morning Star, and Evening Star. Outputs markers on detected bars.
 *
 * Reference: TradingView "All Candlestick Patterns Identifier" (community)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface AllCandlestickPatternsInputs {}

export const defaultInputs: AllCandlestickPatternsInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Close', color: 'transparent', lineWidth: 0, display: 'none' },
];

export const metadata = {
  title: 'All Candlestick Patterns',
  shortTitle: 'CdlPat',
  overlay: true,
};

export function calculate(bars: Bar[], _inputs: Partial<AllCandlestickPatternsInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const n = bars.length;
  const markers: MarkerData[] = [];

  const closePlot = bars.map((b) => ({ time: b.time, value: NaN }));

  for (let i = 0; i < n; i++) {
    const { open, high, low, close, time } = bars[i];
    const body = Math.abs(close - open);
    const range = high - low;
    const upperShadow = high - Math.max(open, close);
    const lowerShadow = Math.min(open, close) - low;

    // Doji: body is very small relative to range
    if (range > 0 && body < range * 0.1) {
      markers.push({ time: time as number, position: 'aboveBar', shape: 'diamond', color: '#FF9800', text: 'Doji' });
    }

    // Hammer: small body at top, long lower shadow, in potential downtrend
    if (body > 0 && lowerShadow > body * 2 && upperShadow < body * 0.3) {
      if (i >= 3 && bars[i - 1].close < bars[i - 2].close && bars[i - 2].close < bars[i - 3].close) {
        markers.push({ time: time as number, position: 'belowBar', shape: 'arrowUp', color: '#26A69A', text: 'Hammer' });
      }
    }

    // Shooting Star: small body at bottom, long upper shadow, in potential uptrend
    if (body > 0 && upperShadow > body * 2 && lowerShadow < body * 0.3) {
      if (i >= 3 && bars[i - 1].close > bars[i - 2].close && bars[i - 2].close > bars[i - 3].close) {
        markers.push({ time: time as number, position: 'aboveBar', shape: 'arrowDown', color: '#EF5350', text: 'ShootStar' });
      }
    }

    // Bullish Engulfing
    if (i >= 1) {
      const prev = bars[i - 1];
      const prevBody = Math.abs(prev.close - prev.open);
      if (prev.close < prev.open && close > open && body > prevBody &&
          open <= prev.close && close >= prev.open) {
        markers.push({ time: time as number, position: 'belowBar', shape: 'arrowUp', color: '#26A69A', text: 'BullEng' });
      }

      // Bearish Engulfing
      if (prev.close > prev.open && close < open && body > prevBody &&
          open >= prev.close && close <= prev.open) {
        markers.push({ time: time as number, position: 'aboveBar', shape: 'arrowDown', color: '#EF5350', text: 'BearEng' });
      }
    }

    // Morning Star (3-bar bullish reversal)
    if (i >= 2) {
      const bar0 = bars[i - 2];
      const bar1 = bars[i - 1];
      const body0 = Math.abs(bar0.close - bar0.open);
      const body1 = Math.abs(bar1.close - bar1.open);
      const range1 = bar1.high - bar1.low;
      if (bar0.close < bar0.open && body0 > 0 &&
          range1 > 0 && body1 < range1 * 0.3 &&
          close > open && close > (bar0.open + bar0.close) / 2) {
        markers.push({ time: time as number, position: 'belowBar', shape: 'arrowUp', color: '#26A69A', text: 'MornStar' });
      }

      // Evening Star (3-bar bearish reversal)
      if (bar0.close > bar0.open && body0 > 0 &&
          range1 > 0 && body1 < range1 * 0.3 &&
          close < open && close < (bar0.open + bar0.close) / 2) {
        markers.push({ time: time as number, position: 'aboveBar', shape: 'arrowDown', color: '#EF5350', text: 'EveStar' });
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': closePlot },
    markers,
  };
}

export const AllCandlestickPatterns = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
