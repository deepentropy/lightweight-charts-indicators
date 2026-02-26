/**
 * RSI Cyclic Smoothed
 *
 * Standard RSI with an additional Ehlers-style 2-pole Butterworth smoothing filter.
 * Reduces noise and highlights dominant cycle trends in RSI.
 *
 * Reference: TradingView "RSI Cyclic Smoothed" (TV#603)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface RSICyclicSmoothedInputs {
  rsiLen: number;
  smoothLen: number;
  src: SourceType;
}

export const defaultInputs: RSICyclicSmoothedInputs = {
  rsiLen: 14,
  smoothLen: 5,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'smoothLen', type: 'int', title: 'Smooth Length', defval: 5, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI Smooth', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'RSI Cyclic Smoothed',
  shortTitle: 'RSICS',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<RSICyclicSmoothedInputs> = {}): IndicatorResult {
  const { rsiLen, smoothLen, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);
  const n = bars.length;

  const rsiArr = ta.rsi(source, rsiLen).toArray();

  // 2-pole Butterworth low-pass filter
  const a = Math.exp(-Math.SQRT2 * Math.PI / smoothLen);
  const a2 = a * a;
  const coeff = 2 * a * Math.cos(Math.SQRT2 * Math.PI / smoothLen);
  // Transfer: y[i] = c0 * x[i] + c1 * y[i-1] + c2 * y[i-2]
  // c0 = (1 - coeff + a2), c1 = coeff, c2 = -a2 ... normalized
  // Actually: b = 1 - coeff + a2; y = b*x + coeff*y1 - a2*y2
  // But standard 2-pole Butterworth: y[i] = b0*x + b1*y[i-1] + b2*y[i-2]
  const b0 = 1 - coeff + a2;
  const b1 = coeff;
  const b2 = -a2;

  const smoothArr: number[] = new Array(n);
  const warmup = rsiLen + smoothLen;

  for (let i = 0; i < n; i++) {
    const x = rsiArr[i];
    if (x == null || i < rsiLen) {
      smoothArr[i] = NaN;
      continue;
    }
    const y1 = i > 0 && !isNaN(smoothArr[i - 1]) ? smoothArr[i - 1] : x;
    const y2 = i > 1 && !isNaN(smoothArr[i - 2]) ? smoothArr[i - 2] : y1;
    smoothArr[i] = b0 * x + b1 * y1 + b2 * y2;
  }

  const plot0 = smoothArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || isNaN(v)) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    hlines: [
      { value: 70, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Overbought' } },
      { value: 30, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Oversold' } },
      { value: 50, options: { color: '#787B86', linestyle: 'dotted' as const, title: 'Middle' } },
    ],
  };
}

export const RSICyclicSmoothed = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
