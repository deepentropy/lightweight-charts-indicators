/**
 * Hull Moving Average (HMA) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Reduces lag while maintaining smoothness using weighted moving averages.
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface HMAInputs {
  length: number;
  src: SourceType;
}

export const defaultInputs: HMAInputs = {
  length: 9,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 9, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'HMA', color: '#00897B', lineWidth: 2 },
];

export const metadata = {
  title: 'Hull Moving Average',
  shortTitle: 'HMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<HMAInputs> = {}): IndicatorResult {
  const { length, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);

  // HMA = WMA(2*WMA(n/2) - WMA(n), sqrt(n))
  const halfLength = Math.max(1, Math.floor(length / 2));
  const sqrtLength = Math.max(1, Math.floor(Math.sqrt(length)));

  const wma1 = ta.wma(source, halfLength);
  const wma2 = ta.wma(source, length);
  const diff = wma1.mul(2).sub(wma2);
  const hma = ta.wma(diff, sqrtLength);

  const plotData = hma.toArray().map((value: number | undefined, i: number) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plotData },
  };
}

export const HMA = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
