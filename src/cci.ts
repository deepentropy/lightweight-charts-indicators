/**
 * Commodity Channel Index (CCI) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Measures the variation of a security's price from its statistical mean.
 * High values show the price is unusually high compared to average, low values show it's unusually low.
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface CCIInputs {
  length: number;
  src: SourceType;
}

export const defaultInputs: CCIInputs = {
  length: 20,
  src: 'hlc3',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'hlc3' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'CCI', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Commodity Channel Index',
  shortTitle: 'CCI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<CCIInputs> = {}): IndicatorResult {
  const { length, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);
  const cci = ta.cci(source, length);

  const plotData = cci.toArray().map((value: number | undefined, i: number) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plotData },
  };
}

export const CCI = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
