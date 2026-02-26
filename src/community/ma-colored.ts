/**
 * Moving Average Colored EMA/SMA
 *
 * Single MA line colored by direction: green when rising, red when falling.
 *
 * Reference: TradingView "Moving Average Colored EMA/SMA" (community)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { Series } from 'oakscriptjs';

export interface MAColoredInputs {
  length: number;
  maType: string;
  src: SourceType;
}

export const defaultInputs: MAColoredInputs = {
  length: 20,
  maType: 'ema',
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'ema', options: ['ema', 'sma', 'wma'] },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Moving Average Colored',
  shortTitle: 'MAC',
  overlay: true,
};

function applyMA(src: Series, length: number, maType: string): number[] {
  switch (maType) {
    case 'sma': return ta.sma(src, length).toArray();
    case 'wma': return ta.wma(src, length).toArray();
    default: return ta.ema(src, length).toArray();
  }
}

export function calculate(bars: Bar[], inputs: Partial<MAColoredInputs> = {}): IndicatorResult {
  const { length, maType, src } = { ...defaultInputs, ...inputs };
  const srcSeries = getSourceSeries(bars, src);

  const maArr = applyMA(srcSeries, length, maType);

  const plot = maArr.map((v, i) => {
    if (i < length) return { time: bars[i].time, value: NaN };
    const val = v ?? NaN;
    const prev = i > 0 ? (maArr[i - 1] ?? val) : val;
    const color = val > prev ? '#26A69A' : val < prev ? '#EF5350' : '#2962FF';
    return { time: bars[i].time, value: val, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot },
  };
}

export const MAColored = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
