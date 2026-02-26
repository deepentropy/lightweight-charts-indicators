/**
 * Multiple Moving Averages
 *
 * Six MAs at periods 10, 20, 50, 100, 150, 200 with selectable type.
 *
 * Reference: TradingView "Multiple Moving Averages" (community)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { Series } from 'oakscriptjs';

export interface MultipleMAInputs {
  maType: string;
  src: SourceType;
}

export const defaultInputs: MultipleMAInputs = {
  maType: 'ema',
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'ema', options: ['ema', 'sma', 'wma'] },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA 10', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot1', title: 'MA 20', color: '#2962FF', lineWidth: 1 },
  { id: 'plot2', title: 'MA 50', color: '#00E676', lineWidth: 1 },
  { id: 'plot3', title: 'MA 100', color: '#E91E63', lineWidth: 1 },
  { id: 'plot4', title: 'MA 150', color: '#9C27B0', lineWidth: 1 },
  { id: 'plot5', title: 'MA 200', color: '#FFEB3B', lineWidth: 2 },
];

export const metadata = {
  title: 'Multiple Moving Averages',
  shortTitle: 'MMA',
  overlay: true,
};

function applyMA(src: Series, length: number, maType: string): number[] {
  switch (maType) {
    case 'sma': return ta.sma(src, length).toArray();
    case 'wma': return ta.wma(src, length).toArray();
    default: return ta.ema(src, length).toArray();
  }
}

export function calculate(bars: Bar[], inputs: Partial<MultipleMAInputs> = {}): IndicatorResult {
  const { maType, src } = { ...defaultInputs, ...inputs };
  const srcSeries = getSourceSeries(bars, src);

  const lengths = [10, 20, 50, 100, 150, 200];
  const maArrays = lengths.map((len) => applyMA(srcSeries, len, maType));

  const plots: Record<string, Array<{ time: number; value: number }>> = {};
  for (let idx = 0; idx < lengths.length; idx++) {
    const arr = maArrays[idx];
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

export const MultipleMA = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
