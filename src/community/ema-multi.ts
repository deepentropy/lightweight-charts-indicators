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

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
  };
}

export const EMAMulti = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
