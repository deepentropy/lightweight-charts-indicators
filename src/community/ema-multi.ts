/**
 * EMA 20/50/100/200
 *
 * Four EMA lines at common periods: 20, 50, 100, 200.
 *
 * Reference: TradingView "EMA 20/50/100/200" (community)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface EMAMultiInputs {
  src: SourceType;
}

export const defaultInputs: EMAMultiInputs = {
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA 20', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot1', title: 'EMA 50', color: '#2962FF', lineWidth: 1 },
  { id: 'plot2', title: 'EMA 100', color: '#00E676', lineWidth: 1 },
  { id: 'plot3', title: 'EMA 200', color: '#E91E63', lineWidth: 2 },
];

export const metadata = {
  title: 'EMA 20/50/100/200',
  shortTitle: 'EMA4',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<EMAMultiInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const src = getSourceSeries(bars, cfg.src);

  const lengths = [20, 50, 100, 200];

  const emaArrays = lengths.map((len) => ta.ema(src, len).toArray());

  const plots: Record<string, Array<{ time: number; value: number }>> = {};
  for (let idx = 0; idx < lengths.length; idx++) {
    const arr = emaArrays[idx];
    plots[`plot${idx}`] = arr.map((v, i) => ({
      time: bars[i].time,
      value: i < lengths[idx] ? NaN : (v ?? NaN),
    }));
  }

  // Dynamic fills between adjacent EMAs: green when shorter EMA > longer EMA, red otherwise
  const fillColors01: string[] = [];
  const fillColors12: string[] = [];
  const fillColors23: string[] = [];

  for (let i = 0; i < bars.length; i++) {
    const e20 = emaArrays[0][i];
    const e50 = emaArrays[1][i];
    const e100 = emaArrays[2][i];
    const e200 = emaArrays[3][i];

    if (i < 200 || isNaN(e20) || isNaN(e50) || isNaN(e100) || isNaN(e200)) {
      fillColors01.push('rgba(0,0,0,0)');
      fillColors12.push('rgba(0,0,0,0)');
      fillColors23.push('rgba(0,0,0,0)');
    } else {
      fillColors01.push(e20 > e50 ? 'rgba(0,230,118,0.15)' : 'rgba(255,109,0,0.15)');
      fillColors12.push(e50 > e100 ? 'rgba(0,230,118,0.15)' : 'rgba(255,109,0,0.15)');
      fillColors23.push(e100 > e200 ? 'rgba(0,230,118,0.15)' : 'rgba(255,109,0,0.15)');
    }
  }

  const fills = [
    { plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(0,230,118,0.15)' }, colors: fillColors01 },
    { plot1: 'plot1', plot2: 'plot2', options: { color: 'rgba(0,230,118,0.15)' }, colors: fillColors12 },
    { plot1: 'plot2', plot2: 'plot3', options: { color: 'rgba(0,230,118,0.15)' }, colors: fillColors23 },
  ];

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    fills,
  };
}

export const EMAMulti = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
