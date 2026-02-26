/**
 * BUY & SELL VOLUME TO PRICE PRESSURE
 *
 * Buying pressure = EMA(close - low), selling pressure = EMA(high - close).
 * Visualizes buy vs sell pressure as two lines.
 *
 * Reference: TradingView "BUY & SELL VOLUME TO PRICE PRESSURE" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface BuySellPressureInputs {
  length: number;
}

export const defaultInputs: BuySellPressureInputs = {
  length: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Buy Pressure', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'Sell Pressure', color: '#EF5350', lineWidth: 2 },
];

export const metadata = {
  title: 'Buy & Sell Pressure',
  shortTitle: 'BSP',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<BuySellPressureInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };

  const buyRaw = new Series(bars, (b) => b.close - b.low);
  const sellRaw = new Series(bars, (b) => b.high - b.close);

  const buyEma = ta.ema(buyRaw, length).toArray();
  const sellEma = ta.ema(sellRaw, length).toArray();

  const warmup = length;

  const plot0 = buyEma.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || v == null ? NaN : v,
  }));

  const plot1 = sellEma.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || v == null ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
  };
}

export const BuySellPressure = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
