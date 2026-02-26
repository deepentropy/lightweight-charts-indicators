/**
 * Stochastic OTT
 *
 * Optimized Trend Tracker applied to Stochastic oscillator.
 * Calculates Stochastic K, applies OTT trailing stop logic.
 *
 * Reference: TradingView "Stochastic OTT" by Anilcan Ozcan
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface StochasticOTTInputs {
  kLen: number;
  kSmooth: number;
  ottPct: number;
}

export const defaultInputs: StochasticOTTInputs = {
  kLen: 14,
  kSmooth: 3,
  ottPct: 1.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'kLen', type: 'int', title: '%K Length', defval: 14, min: 1 },
  { id: 'kSmooth', type: 'int', title: '%K Smoothing', defval: 3, min: 1 },
  { id: 'ottPct', type: 'float', title: 'OTT Percent', defval: 1.0, min: 0.01, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Stoch', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'OTT', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'Stochastic OTT',
  shortTitle: 'StochOTT',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<StochasticOTTInputs> = {}): IndicatorResult {
  const { kLen, kSmooth, ottPct } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeSeries = new Series(bars, (b) => b.close);
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const rawK = ta.stoch(closeSeries, highSeries, lowSeries, kLen);
  const k = ta.sma(rawK, kSmooth);
  const kArr = k.toArray();

  // OTT: trailing stop on K
  const fup = ottPct / 100;
  const longStop: number[] = new Array(n);
  const shortStop: number[] = new Array(n);
  const dir: number[] = new Array(n);
  const ott: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const val = kArr[i] ?? 50;
    const newLong = val * (1 - fup);
    const newShort = val * (1 + fup);

    if (i === 0) {
      longStop[i] = newLong;
      shortStop[i] = newShort;
      dir[i] = 1;
    } else {
      const prevVal = kArr[i - 1] ?? 50;
      longStop[i] = val > longStop[i - 1] ? Math.max(newLong, longStop[i - 1]) : newLong;
      shortStop[i] = val < shortStop[i - 1] ? Math.min(newShort, shortStop[i - 1]) : newShort;

      if (prevVal <= longStop[i - 1] && val > longStop[i - 1]) {
        dir[i] = 1;
      } else if (prevVal >= shortStop[i - 1] && val < shortStop[i - 1]) {
        dir[i] = -1;
      } else {
        dir[i] = dir[i - 1];
      }
    }
    ott[i] = dir[i] === 1 ? longStop[i] : shortStop[i];
  }

  const warmup = kLen + kSmooth;

  const plot0 = kArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v,
  }));

  const plot1 = ott.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
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

export const StochasticOTT = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
