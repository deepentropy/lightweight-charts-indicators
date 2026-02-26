/**
 * Slow Stochastic
 *
 * Classic Slow Stochastic oscillator.
 * K = SMA(rawStoch, kSmoothing), D = SMA(K, dSmoothing)
 *
 * Reference: TradingView "Slow Stochastic" by Oshri17
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface SlowStochasticInputs {
  kLength: number;
  kSmoothing: number;
  dSmoothing: number;
}

export const defaultInputs: SlowStochasticInputs = {
  kLength: 14,
  kSmoothing: 3,
  dSmoothing: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'kLength', type: 'int', title: '%K Length', defval: 14, min: 1 },
  { id: 'kSmoothing', type: 'int', title: '%K Smoothing', defval: 3, min: 1 },
  { id: 'dSmoothing', type: 'int', title: '%D Smoothing', defval: 3, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'K', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'D', color: '#EF5350', lineWidth: 1 },
];

export const metadata = {
  title: 'Slow Stochastic',
  shortTitle: 'SlowStoch',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<SlowStochasticInputs> = {}): IndicatorResult {
  const { kLength, kSmoothing, dSmoothing } = { ...defaultInputs, ...inputs };

  const closeSeries = new Series(bars, (b) => b.close);
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  // Raw %K
  const rawK = ta.stoch(closeSeries, highSeries, lowSeries, kLength);

  // Slow K = SMA(rawK, kSmoothing)
  const k = ta.sma(rawK, kSmoothing);

  // D = SMA(K, dSmoothing)
  const d = ta.sma(k, dSmoothing);

  const warmup = kLength + kSmoothing + dSmoothing;

  const kArr = k.toArray();
  const dArr = d.toArray();

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

export const SlowStochastic = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
