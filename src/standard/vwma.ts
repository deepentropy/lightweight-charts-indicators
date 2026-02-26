/**
 * Volume Weighted Moving Average (VWMA) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * A moving average weighted by volume.
 */

import { Series, ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface VWMAInputs {
  length: number;
  src: SourceType;
  offset: number;
}

export const defaultInputs: VWMAInputs = {
  length: 20,
  src: 'close',
  offset: 0,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'offset', type: 'int', title: 'Offset', defval: 0, min: -500, max: 500 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VWMA', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Volume Weighted Moving Average',
  shortTitle: 'VWMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<VWMAInputs> = {}): IndicatorResult {
  const { length, src, offset } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);
  const volume = new Series(bars, (bar) => bar.volume ?? 0);
  const vwmaArr = ta.vwma(source, length, volume).toArray();

  const plotData = bars.map((bar, i) => {
    const srcIdx = i - offset;
    return { time: bar.time, value: (srcIdx >= 0 && srcIdx < bars.length) ? (vwmaArr[srcIdx] ?? NaN) : NaN };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plotData },
  };
}

export const VWMA = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
