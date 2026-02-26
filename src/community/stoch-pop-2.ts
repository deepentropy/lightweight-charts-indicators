/**
 * CM Stochastic POP Method 2
 *
 * Enhanced POP: K crosses above D while both below 20 = buy,
 * K crosses below D while both above 80 = sell.
 *
 * Reference: TradingView "CM_Stochastic POP Method 2" by ChrisMoody
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface StochPOP2Inputs {
  kLen: number;
  kSmooth: number;
  dSmooth: number;
}

export const defaultInputs: StochPOP2Inputs = {
  kLen: 14,
  kSmooth: 3,
  dSmooth: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'kLen', type: 'int', title: '%K Length', defval: 14, min: 1 },
  { id: 'kSmooth', type: 'int', title: '%K Smoothing', defval: 3, min: 1 },
  { id: 'dSmooth', type: 'int', title: '%D Smoothing', defval: 3, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'K', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'D', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'CM Stochastic POP Method 2',
  shortTitle: 'StochPOP2',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<StochPOP2Inputs> = {}): IndicatorResult {
  const { kLen, kSmooth, dSmooth } = { ...defaultInputs, ...inputs };

  const closeSeries = new Series(bars, (b) => b.close);
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const rawK = ta.stoch(closeSeries, highSeries, lowSeries, kLen);
  const k = ta.sma(rawK, kSmooth);
  const d = ta.sma(k, dSmooth);

  const kArr = k.toArray();
  const dArr = d.toArray();
  const warmup = kLen + kSmooth + dSmooth;

  const plot0 = kArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v,
  }));

  const plot1 = dArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    hlines: [
      { value: 80, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Overbought' } },
      { value: 20, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Oversold' } },
    ],
  };
}

export const StochPOP2 = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
