/**
 * Triple Exponential Moving Average (TEMA) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Further reduces lag: TEMA = 3*EMA - 3*EMA(EMA) + EMA(EMA(EMA))
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface TEMAInputs {
  length: number;
  src: SourceType;
  offset: number;
}

export const defaultInputs: TEMAInputs = {
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
  { id: 'plot0', title: 'TEMA', color: '#7B1FA2', lineWidth: 2 },
];

export const metadata = {
  title: 'Triple EMA',
  shortTitle: 'TEMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<TEMAInputs> = {}): IndicatorResult {
  const { length, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);

  // TEMA = 3*EMA - 3*EMA(EMA) + EMA(EMA(EMA))
  const ema1 = ta.ema(source, length);
  const ema2 = ta.ema(ema1, length);
  const ema3 = ta.ema(ema2, length);
  const tema = ema1.mul(3).sub(ema2.mul(3)).add(ema3);

  const plotData = tema.toArray().map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plotData },
  };
}

export const TEMA = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
