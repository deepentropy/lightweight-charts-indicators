/**
 * Relative Strength Index (RSI) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Momentum oscillator measuring the speed and magnitude of price changes.
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface RSIInputs {
  length: number;
  src: SourceType;
}

export const defaultInputs: RSIInputs = {
  length: 14,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: '#7E57C2', lineWidth: 2 },
];

export const metadata = {
  title: 'Relative Strength Index',
  shortTitle: 'RSI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<RSIInputs> = {}): IndicatorResult {
  const { length, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);
  const rsi = ta.rsi(source, length);

  const plotData = rsi.toArray().map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plotData },
  };
}

export const RSI = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
