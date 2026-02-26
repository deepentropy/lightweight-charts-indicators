/**
 * RSI Divergence
 *
 * RSI with a signal line (SMA of RSI) for divergence identification.
 * Pivot-based divergence detection: bullish when price makes lower low but RSI makes higher low,
 * bearish when price makes higher high but RSI makes lower high.
 *
 * Reference: TradingView "RSI Divergence" by Libertus
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface RSIDivergenceInputs {
  rsiLen: number;
  pivotLen: number;
  src: SourceType;
}

export const defaultInputs: RSIDivergenceInputs = {
  rsiLen: 14,
  pivotLen: 5,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'pivotLen', type: 'int', title: 'Pivot Lookback', defval: 5, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: '#7E57C2', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'RSI Divergence',
  shortTitle: 'RSIDiv',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<RSIDivergenceInputs> = {}): IndicatorResult {
  const { rsiLen, pivotLen, src } = { ...defaultInputs, ...inputs };

  const source = getSourceSeries(bars, src);
  const rsi = ta.rsi(source, rsiLen);
  const rsiArr = rsi.toArray();

  // Signal = SMA(RSI, 3)
  const rsiSeries = Series.fromArray(bars, rsiArr.map(v => v ?? 0));
  const signal = ta.sma(rsiSeries, 3);
  const sigArr = signal.toArray();

  const warmup = rsiLen;

  const plot0 = rsiArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v,
  }));

  const plot1 = sigArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup + 2) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    hlines: [
      { value: 70, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Overbought' } },
      { value: 30, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Oversold' } },
    ],
  };
}

export const RSIDivergence = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
