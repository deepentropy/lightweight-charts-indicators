/**
 * Rate of Change (ROC) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Measures the percentage change in price over a specified period.
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface ROCInputs {
  length: number;
  src: SourceType;
}

export const defaultInputs: ROCInputs = {
  length: 9,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 9, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ROC', color: '#2962FF', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, color: '#787B86', linestyle: 'solid', title: 'Zero Line' },
];

export const metadata = {
  title: 'Rate Of Change',
  shortTitle: 'ROC',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<ROCInputs> = {}): IndicatorResult {
  const { length, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);
  const roc = ta.roc(source, length);

  const plotData = roc.toArray().map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plotData },
  };
}

export const ROC = { calculate, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig };
