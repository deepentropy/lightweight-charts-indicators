/**
 * EMA Enveloper
 *
 * EMA with percentage envelope bands above and below.
 * upper = ema * (1 + percent/100), lower = ema * (1 - percent/100).
 *
 * Reference: TradingView "EMA Enveloper" (community)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface EMAEnveloperInputs {
  length: number;
  percent: number;
  src: SourceType;
}

export const defaultInputs: EMAEnveloperInputs = {
  length: 20,
  percent: 2.5,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
  { id: 'percent', type: 'float', title: 'Percent', defval: 2.5, min: 0.1, step: 0.1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Upper', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot2', title: 'Lower', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'EMA Enveloper',
  shortTitle: 'EMAE',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<EMAEnveloperInputs> = {}): IndicatorResult {
  const { length, percent, src } = { ...defaultInputs, ...inputs };
  const srcSeries = getSourceSeries(bars, src);

  const emaArr = ta.ema(srcSeries, length).toArray();
  const mult = percent / 100;

  const plot0 = emaArr.map((v, i) => ({
    time: bars[i].time,
    value: i < length ? NaN : (v ?? NaN),
  }));

  const plot1 = emaArr.map((v, i) => ({
    time: bars[i].time,
    value: i < length ? NaN : ((v ?? 0) * (1 + mult)),
  }));

  const plot2 = emaArr.map((v, i) => ({
    time: bars[i].time,
    value: i < length ? NaN : ((v ?? 0) * (1 - mult)),
  }));

  const fillColors = bars.map((_b, i) => (i < length ? 'transparent' : '#2962FF20'));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2 },
    fills: [{ plot1: 'plot1', plot2: 'plot2', colors: fillColors }],
  };
}

export const EMAEnveloper = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
