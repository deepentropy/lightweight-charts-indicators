/**
 * Least Squares Moving Average (LSMA) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Uses linear regression to fit a line through recent prices.
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface LSMAInputs {
  length: number;
  src: SourceType;
  offset: number;
}

export const defaultInputs: LSMAInputs = {
  length: 25,
  src: 'close',
  offset: 0,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 25, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'offset', type: 'int', title: 'Offset', defval: 0, min: -500, max: 500 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'LSMA', color: '#FF6D00', lineWidth: 2 },
];

export const metadata = {
  title: 'Least Squares Moving Average',
  shortTitle: 'LSMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<LSMAInputs> = {}): IndicatorResult {
  const { length, src, offset } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);

  // LSMA is linear regression with offset 0 (endpoint of the regression line)
  const lsma = ta.linreg(source, length, offset);

  const plotData = lsma.toArray().map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plotData },
  };
}

export const LSMA = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
