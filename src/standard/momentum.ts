/**
 * Momentum Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Measures the rate of change of price over a specified period.
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface MomentumInputs {
  length: number;
  src: SourceType;
}

export const defaultInputs: MomentumInputs = {
  length: 10,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 10, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Mom', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Momentum',
  shortTitle: 'Mom',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<MomentumInputs> = {}): IndicatorResult {
  const { length, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);
  const mom = ta.mom(source, length);

  const plotData = mom.toArray().map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plotData },
  };
}

export const Momentum = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
