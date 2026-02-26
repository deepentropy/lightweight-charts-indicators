/**
 * Candlestick Reversal System
 *
 * Detects reversal candlestick patterns with trend context.
 * Uses SMA for trend: bearish reversals in uptrend, bullish in downtrend.
 *
 * Reference: TradingView "Candlestick Reversal System" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface CandlestickReversalInputs {
  trendLen: number;
}

export const defaultInputs: CandlestickReversalInputs = {
  trendLen: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'trendLen', type: 'int', title: 'Trend SMA Length', defval: 20, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trend SMA', color: '#787B86', lineWidth: 1 },
];

export const metadata = {
  title: 'Candlestick Reversal',
  shortTitle: 'CdlRev',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<CandlestickReversalInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { trendLen } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeSeries = new Series(bars, (b) => b.close);
  const smaArr = ta.sma(closeSeries, trendLen).toArray();

  const markers: MarkerData[] = [];
  const warmup = trendLen;

  const plot0 = smaArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || v == null ? NaN : v,
  }));

  for (let i = warmup; i < n; i++) {
    const sma = smaArr[i];
    if (sma == null) continue;

    const { open, high, close, time } = bars[i];
    const body = Math.abs(close - open);
    const upperShadow = high - Math.max(open, close);
    const lowerShadow = Math.min(open, close) - bars[i].low;
    const isUptrend = close > sma;
    const isDowntrend = close < sma;

    if (isUptrend && i >= 1) {
      const prev = bars[i - 1];

      // Bearish Engulfing in uptrend
      if (prev.close > prev.open && close < open &&
          open >= prev.close && close <= prev.open) {
        markers.push({ time: time as number, position: 'aboveBar', shape: 'arrowDown', color: '#EF5350', text: 'BearEng' });
      }

      // Shooting Star in uptrend
      if (body > 0 && upperShadow > body * 2 && lowerShadow < body * 0.3) {
        markers.push({ time: time as number, position: 'aboveBar', shape: 'arrowDown', color: '#EF5350', text: 'ShootStar' });
      }
    }

    if (isDowntrend && i >= 1) {
      const prev = bars[i - 1];

      // Bullish Engulfing in downtrend
      if (prev.close < prev.open && close > open &&
          open <= prev.close && close >= prev.open) {
        markers.push({ time: time as number, position: 'belowBar', shape: 'arrowUp', color: '#26A69A', text: 'BullEng' });
      }

      // Hammer in downtrend
      if (body > 0 && lowerShadow > body * 2 && upperShadow < body * 0.3) {
        markers.push({ time: time as number, position: 'belowBar', shape: 'arrowUp', color: '#26A69A', text: 'Hammer' });
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    markers,
  };
}

export const CandlestickReversal = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
