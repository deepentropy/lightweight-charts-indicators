/**
 * Sell & Buy Rates
 *
 * Buy/sell rate based on volume and price action direction.
 * buyRate = SMA(volume when bullish, length). sellRate = SMA(volume when bearish, length).
 *
 * Reference: TradingView "Sell & Buy Rates" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface SellBuyRatesInputs {
  length: number;
}

export const defaultInputs: SellBuyRatesInputs = {
  length: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Buy Rate', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'Sell Rate', color: '#EF5350', lineWidth: 2 },
];

export const metadata = {
  title: 'Sell & Buy Rates',
  shortTitle: 'SBR',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<SellBuyRatesInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };

  const buyVolSeries = new Series(bars, (b) => (b.close > b.open ? (b.volume ?? 0) : 0));
  const sellVolSeries = new Series(bars, (b) => (b.close < b.open ? (b.volume ?? 0) : 0));

  const buyRate = ta.sma(buyVolSeries, length);
  const sellRate = ta.sma(sellVolSeries, length);

  const buyArr = buyRate.toArray();
  const sellArr = sellRate.toArray();

  const plot0 = buyArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < length) ? NaN : v,
  }));

  const plot1 = sellArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < length) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
  };
}

export const SellBuyRates = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
