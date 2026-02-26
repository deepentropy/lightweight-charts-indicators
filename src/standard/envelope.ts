/**
 * Envelope Indicator
 *
 * Price envelope with a moving average basis and upper/lower bands
 * at a fixed percentage distance from the basis.
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface EnvelopeInputs {
  /** Period length */
  length: number;
  /** Percent distance for bands */
  percent: number;
  /** Price source */
  src: SourceType;
  /** Use exponential MA */
  exponential: boolean;
}

export const defaultInputs: EnvelopeInputs = {
  length: 20,
  percent: 10,
  src: 'close',
  exponential: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
  { id: 'percent', type: 'float', title: 'Percent', defval: 10, min: 0.001 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'exponential', type: 'bool', title: 'Exponential', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Basis', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot1', title: 'Upper', color: '#2962FF', lineWidth: 1 },
  { id: 'plot2', title: 'Lower', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Envelope',
  shortTitle: 'Env',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<EnvelopeInputs> = {}): IndicatorResult {
  const { length, percent, src, exponential } = { ...defaultInputs, ...inputs };

  const source = getSourceSeries(bars, src);
  const basis = exponential ? ta.ema(source, length) : ta.sma(source, length);

  const k = percent / 100;
  const upper = basis.mul(1 + k);
  const lower = basis.mul(1 - k);

  const basisData = basis.toArray().map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  const upperData = upper.toArray().map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  const lowerData = lower.toArray().map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': basisData,
      'plot1': upperData,
      'plot2': lowerData,
    },
  };
}

export const Envelope = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
