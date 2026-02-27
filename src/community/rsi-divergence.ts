/**
 * RSI Divergence
 *
 * Plots the difference between fast RSI and slow RSI as a single colored line.
 * divergence = RSI(fast) - RSI(slow)
 * Colored lime when positive, red when negative.
 *
 * Reference: TradingView "RSI Divergence"
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface RSIDivergenceInputs {
  lenFast: number;
  lenSlow: number;
  src: SourceType;
}

export const defaultInputs: RSIDivergenceInputs = {
  lenFast: 5,
  lenSlow: 14,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'lenFast', type: 'int', title: 'Length Fast RSI', defval: 5, min: 1 },
  { id: 'lenSlow', type: 'int', title: 'Length Slow RSI', defval: 14, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Divergence', color: '#26A69A', lineWidth: 2 },
];

export const metadata = {
  title: 'RSI Divergence',
  shortTitle: 'RSIDiv',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<RSIDivergenceInputs> = {}): IndicatorResult {
  const { lenFast, lenSlow, src } = { ...defaultInputs, ...inputs };

  const source = getSourceSeries(bars, src);
  const rsiFast = ta.rsi(source, lenFast).toArray();
  const rsiSlow = ta.rsi(source, lenSlow).toArray();

  const warmup = Math.max(lenFast, lenSlow);

  const plot0 = bars.map((b, i) => {
    const f = rsiFast[i];
    const s = rsiSlow[i];
    if (i < warmup || f == null || s == null) {
      return { time: b.time, value: NaN };
    }
    const div = f - s;
    return { time: b.time, value: div, color: div > 0 ? '#00FF00' : '#FF0000' };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    hlines: [{ value: 0, options: { color: '#787B86', linestyle: 'solid' as const, title: 'Zero' } }],
  };
}

export const RSIDivergence = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
