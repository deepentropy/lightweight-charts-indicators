/**
 * Exponential Moving Average (EMA) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * A weighted moving average that gives more weight to recent prices.
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface EMAInputs {
  length: number;
  src: SourceType;
  offset: number;
}

export const defaultInputs: EMAInputs = {
  length: 9,
  src: 'close',
  offset: 0,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 9, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'offset', type: 'int', title: 'Offset', defval: 0, min: -500, max: 500 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Moving Average Exponential',
  shortTitle: 'EMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<EMAInputs> = {}): IndicatorResult {
  const { length, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);
  const ema = ta.ema(source, length);

  const plotData = ema.toArray().map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plotData },
  };
}

export const EMA = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
