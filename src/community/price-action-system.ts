/**
 * Price Action Trading System v0.3
 *
 * Price action patterns with MA filter. Detects hammer, engulfing patterns.
 * In uptrend (close > SMA): bullish engulfing or hammer = buy.
 * In downtrend: bearish engulfing or shooting star = sell.
 *
 * Reference: TradingView "Price Action Trading System v0.3" (community)
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface PriceActionSystemInputs {
  maLen: number;
  atrLen: number;
  src: SourceType;
}

export const defaultInputs: PriceActionSystemInputs = {
  maLen: 50,
  atrLen: 14,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'maLen', type: 'int', title: 'MA Length', defval: 50, min: 1 },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 14, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SMA', color: '#787B86', lineWidth: 2 },
];

export const metadata = {
  title: 'Price Action Trading System',
  shortTitle: 'PATS',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<PriceActionSystemInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { maLen, atrLen } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeSeries = new Series(bars, (b) => b.close);
  const sma = ta.sma(closeSeries, maLen);
  const smaArr = sma.toArray();

  const warmup = Math.max(maLen, atrLen);
  const markers: MarkerData[] = [];

  for (let i = warmup + 1; i < n; i++) {
    const curr = bars[i];
    const prev = bars[i - 1];
    const close = curr.close;
    const open = curr.open;
    const high = curr.high;
    const low = curr.low;
    const maVal = smaArr[i] ?? 0;

    const body = Math.abs(close - open);
    const range = high - low;
    if (range === 0) continue;

    const upperShadow = high - Math.max(close, open);
    const lowerShadow = Math.min(close, open) - low;

    const prevBullish = prev.close > prev.open;
    const prevBearish = prev.close < prev.open;
    const bullish = close > open;
    const bearish = close < open;

    const uptrend = close > maVal;
    const downtrend = close < maVal;

    // Hammer: lower shadow > body*2, upper shadow < body*0.3
    const isHammer = lowerShadow > body * 2 && upperShadow < body * 0.3 && range > 0;
    // Shooting star: upper shadow > body*2, lower shadow < body*0.3
    const isShootingStar = upperShadow > body * 2 && lowerShadow < body * 0.3 && range > 0;

    // Bullish engulfing: prev bearish, curr bullish, curr body engulfs prev body
    const isBullishEngulfing = prevBearish && bullish &&
      close > prev.open && open < prev.close;
    // Bearish engulfing: prev bullish, curr bearish, curr body engulfs prev body
    const isBearishEngulfing = prevBullish && bearish &&
      close < prev.open && open > prev.close;

    if (uptrend && (isBullishEngulfing || isHammer)) {
      markers.push({ time: curr.time, position: 'belowBar', shape: 'labelUp', color: '#26A69A', text: 'Buy' });
    } else if (downtrend && (isBearishEngulfing || isShootingStar)) {
      markers.push({ time: curr.time, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'Sell' });
    }
  }

  const plot0 = smaArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    markers,
  };
}

export const PriceActionSystem = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
