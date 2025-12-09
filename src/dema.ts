/**
 * Double Exponential Moving Average (DEMA) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Reduces lag by applying EMA twice: DEMA = 2*EMA - EMA(EMA)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface DEMAInputs {
  length: number;
  src: SourceType;
  offset: number;
}

export const defaultInputs: DEMAInputs = {
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
  { id: 'plot0', title: 'DEMA', color: '#43A047', lineWidth: 2 },
];

export const metadata = {
  title: 'Double EMA',
  shortTitle: 'DEMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<DEMAInputs> = {}): IndicatorResult {
  const { length, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);

  // DEMA = 2 * EMA - EMA(EMA)
  const ema1 = ta.ema(source, length);
  const ema2 = ta.ema(ema1, length);
  const dema = ema1.mul(2).sub(ema2);

  const plotData = dema.toArray().map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plotData },
  };
}

export const DEMA = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
