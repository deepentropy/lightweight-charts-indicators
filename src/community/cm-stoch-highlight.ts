/**
 * CM Stochastic Highlight Bars
 *
 * Stochastic with highlighted zones. K line colored green when K > D and rising,
 * red when K < D and falling, else default.
 *
 * Reference: TradingView "CM_Stochastic Highlight Bars" by ChrisMoody
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface CMStochHighlightInputs {
  kLen: number;
  kSmooth: number;
  dSmooth: number;
}

export const defaultInputs: CMStochHighlightInputs = {
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
  { id: 'plot1', title: 'D', color: '#787B86', lineWidth: 1 },
];

export const metadata = {
  title: 'CM Stochastic Highlight Bars',
  shortTitle: 'CMStochHL',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<CMStochHighlightInputs> = {}): IndicatorResult {
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

  const plot0 = kArr.map((v, i) => {
    if (v == null || i < warmup) return { time: bars[i].time, value: NaN };
    const dVal = dArr[i] ?? 0;
    const prevK = i > 0 ? (kArr[i - 1] ?? 0) : 0;
    let color = '#2962FF';
    if (v > dVal && v > prevK) color = '#26A69A';
    else if (v < dVal && v < prevK) color = '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

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

export const CMStochHighlight = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
