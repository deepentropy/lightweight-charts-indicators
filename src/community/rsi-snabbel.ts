/**
 * RSI Snabbel
 *
 * Dual-period RSI comparison. Fast RSI and slow RSI plotted together.
 * Signals when fast RSI crosses slow RSI.
 *
 * Reference: TradingView "RSI Snabbel"
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface RSISnabbelInputs {
  rsiLen1: number;
  rsiLen2: number;
  src: SourceType;
}

export const defaultInputs: RSISnabbelInputs = {
  rsiLen1: 7,
  rsiLen2: 14,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen1', type: 'int', title: 'Fast RSI Length', defval: 7, min: 1 },
  { id: 'rsiLen2', type: 'int', title: 'Slow RSI Length', defval: 14, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI Fast', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'RSI Slow', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'RSI Snabbel',
  shortTitle: 'RSISnab',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<RSISnabbelInputs> = {}): IndicatorResult {
  const { rsiLen1, rsiLen2, src } = { ...defaultInputs, ...inputs };

  const source = getSourceSeries(bars, src);
  const rsiFast = ta.rsi(source, rsiLen1);
  const rsiSlow = ta.rsi(source, rsiLen2);
  const fastArr = rsiFast.toArray();
  const slowArr = rsiSlow.toArray();

  const warmup = Math.max(rsiLen1, rsiLen2);

  const plot0 = fastArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v,
  }));

  const plot1 = slowArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    hlines: [
      { value: 80, options: { color: '#EF5350', linestyle: 'dashed' as const, title: 'Overbought' } },
      { value: 55, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Upper Mid' } },
      { value: 50, options: { color: '#000000', linestyle: 'dashed' as const, title: 'Midline' } },
      { value: 45, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Lower Mid' } },
      { value: 20, options: { color: '#4CAF50', linestyle: 'dashed' as const, title: 'Oversold' } },
    ],
  };
}

export const RSISnabbel = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
