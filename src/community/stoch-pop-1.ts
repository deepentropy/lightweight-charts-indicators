/**
 * CM Stochastic POP Method 1
 *
 * Stochastic POP: When stochastic is between 40-60, then pops above 60 = buy, below 40 = sell.
 *
 * Reference: TradingView "CM_Stochastic POP Method 1" by ChrisMoody
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface StochPOP1Inputs {
  kLen: number;
  kSmooth: number;
  dSmooth: number;
}

export const defaultInputs: StochPOP1Inputs = {
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
  title: 'CM Stochastic POP Method 1',
  shortTitle: 'StochPOP1',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<StochPOP1Inputs> = {}): IndicatorResult {
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
      { value: 60, options: { color: '#787B86', linestyle: 'dotted' as const, title: 'POP Up' } },
      { value: 40, options: { color: '#787B86', linestyle: 'dotted' as const, title: 'POP Down' } },
      { value: 20, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Oversold' } },
    ],
  };
}

export const StochPOP1 = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
