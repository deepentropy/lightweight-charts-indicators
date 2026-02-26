/**
 * Triple MA Forecast
 *
 * Three SMAs colored by slope direction: green when rising, red when falling.
 *
 * Reference: TradingView "Triple MA Forecast" (community)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface TripleMAForecastInputs {
  len1: number;
  len2: number;
  len3: number;
  src: SourceType;
}

export const defaultInputs: TripleMAForecastInputs = {
  len1: 10,
  len2: 20,
  len3: 50,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'len1', type: 'int', title: 'Length 1', defval: 10, min: 1 },
  { id: 'len2', type: 'int', title: 'Length 2', defval: 20, min: 1 },
  { id: 'len3', type: 'int', title: 'Length 3', defval: 50, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SMA 1', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot1', title: 'SMA 2', color: '#2962FF', lineWidth: 1 },
  { id: 'plot2', title: 'SMA 3', color: '#00E676', lineWidth: 1 },
];

export const metadata = {
  title: 'Triple MA Forecast',
  shortTitle: '3MAF',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<TripleMAForecastInputs> = {}): IndicatorResult {
  const { len1, len2, len3, src } = { ...defaultInputs, ...inputs };
  const srcSeries = getSourceSeries(bars, src);

  const lengths = [len1, len2, len3];
  const smaArrays = lengths.map((len) => ta.sma(srcSeries, len).toArray());

  const plots: Record<string, Array<{ time: number; value: number; color?: string }>> = {};
  for (let idx = 0; idx < lengths.length; idx++) {
    const arr = smaArrays[idx];
    plots[`plot${idx}`] = arr.map((v, i) => {
      if (i < lengths[idx]) return { time: bars[i].time, value: NaN };
      const val = v ?? NaN;
      const prev = i > 0 ? (arr[i - 1] ?? val) : val;
      const color = val > prev ? '#26A69A' : val < prev ? '#EF5350' : '#787B86';
      return { time: bars[i].time, value: val, color };
    });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
  };
}

export const TripleMAForecast = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
