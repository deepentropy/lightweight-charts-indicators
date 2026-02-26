/**
 * EMA Ribbon
 *
 * Eight EMA lines at Fibonacci-related periods: 5, 8, 13, 21, 34, 55, 89, 144.
 * Expansion signals strong trends, contraction signals consolidation.
 *
 * Reference: TradingView "EMA Ribbon" (community)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface EMARibbonInputs {
  src: SourceType;
}

export const defaultInputs: EMARibbonInputs = {
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA 5', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot1', title: 'EMA 8', color: '#FF9100', lineWidth: 1 },
  { id: 'plot2', title: 'EMA 13', color: '#FFC107', lineWidth: 1 },
  { id: 'plot3', title: 'EMA 21', color: '#CDDC39', lineWidth: 1 },
  { id: 'plot4', title: 'EMA 34', color: '#66BB6A', lineWidth: 1 },
  { id: 'plot5', title: 'EMA 55', color: '#26A69A', lineWidth: 1 },
  { id: 'plot6', title: 'EMA 89', color: '#42A5F5', lineWidth: 1 },
  { id: 'plot7', title: 'EMA 144', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'EMA Ribbon',
  shortTitle: 'EMAR',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<EMARibbonInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const src = getSourceSeries(bars, cfg.src);

  const lengths = [5, 8, 13, 21, 34, 55, 89, 144];

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

export const EMARibbon = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
