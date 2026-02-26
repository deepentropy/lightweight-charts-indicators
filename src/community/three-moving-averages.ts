/**
 * Three Moving Averages
 *
 * Three configurable MAs with selectable type (EMA/SMA/WMA).
 *
 * Reference: TradingView "Three Moving Averages" (community)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { Series } from 'oakscriptjs';

export interface ThreeMovingAveragesInputs {
  len1: number;
  len2: number;
  len3: number;
  maType: string;
  src: SourceType;
}

export const defaultInputs: ThreeMovingAveragesInputs = {
  len1: 9,
  len2: 21,
  len3: 55,
  maType: 'ema',
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'len1', type: 'int', title: 'Length 1', defval: 9, min: 1 },
  { id: 'len2', type: 'int', title: 'Length 2', defval: 21, min: 1 },
  { id: 'len3', type: 'int', title: 'Length 3', defval: 55, min: 1 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'ema', options: ['ema', 'sma', 'wma'] },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA 1', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot1', title: 'MA 2', color: '#2962FF', lineWidth: 1 },
  { id: 'plot2', title: 'MA 3', color: '#00E676', lineWidth: 1 },
];

export const metadata = {
  title: 'Three Moving Averages',
  shortTitle: '3MA',
  overlay: true,
};

function applyMA(src: Series, length: number, maType: string): number[] {
  switch (maType) {
    case 'sma': return ta.sma(src, length).toArray();
    case 'wma': return ta.wma(src, length).toArray();
    default: return ta.ema(src, length).toArray();
  }
}

export function calculate(bars: Bar[], inputs: Partial<ThreeMovingAveragesInputs> = {}): IndicatorResult {
  const { len1, len2, len3, maType, src } = { ...defaultInputs, ...inputs };
  const srcSeries = getSourceSeries(bars, src);

  const lengths = [len1, len2, len3];
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

export const ThreeMovingAverages = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
