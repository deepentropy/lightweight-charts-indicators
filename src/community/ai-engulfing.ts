/**
 * AI-EngulfingCandle
 *
 * Engulfing candlestick pattern detection with SMA trend context.
 * Bullish engulfing in downtrend, bearish engulfing in uptrend.
 *
 * Reference: TradingView "AI-EngulfingCandle" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface AIEngulfingInputs {
  trendLen: number;
}

export const defaultInputs: AIEngulfingInputs = {
  trendLen: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'trendLen', type: 'int', title: 'Trend Length', defval: 20, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SMA', color: '#787B86', lineWidth: 1 },
];

export const metadata = {
  title: 'AI Engulfing Candle',
  shortTitle: 'AIEngulf',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<AIEngulfingInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { trendLen } = { ...defaultInputs, ...inputs };
  const closeSeries = new Series(bars, (b) => b.close);
  const smaArr = ta.sma(closeSeries, trendLen).toArray();

  const warmup = trendLen;
  const markers: MarkerData[] = [];

  const plot0 = smaArr.map((v, i) => {
    if (i < warmup || v == null || isNaN(v)) return { time: bars[i].time, value: NaN };
    return { time: bars[i].time, value: v };
  });

  for (let i = warmup; i < bars.length; i++) {
    const prev = bars[i - 1];
    const curr = bars[i];
    const sma = smaArr[i];
    if (sma == null || isNaN(sma)) continue;

    const prevBearish = prev.close < prev.open;
    const currBullish = curr.close > curr.open;
    const bullishEngulfing = prevBearish && currBullish && curr.open <= prev.close && curr.close >= prev.open;

    const prevBullish = prev.close > prev.open;
    const currBearish = curr.close < curr.open;
    const bearishEngulfing = prevBullish && currBearish && curr.open >= prev.close && curr.close <= prev.open;

    if (bullishEngulfing && curr.close < sma) {
      markers.push({ time: curr.time, position: 'belowBar', shape: 'arrowUp', color: '#26A69A', text: 'Bull' });
    }
    if (bearishEngulfing && curr.close > sma) {
      markers.push({ time: curr.time, position: 'aboveBar', shape: 'arrowDown', color: '#EF5350', text: 'Bear' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    markers,
  };
}

export const AIEngulfing = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
