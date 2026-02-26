/**
 * Moving Average Shift
 *
 * MA with configurable offset (shifted forward or backward in time).
 *
 * Reference: TradingView "Moving Average Shift" (community)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { Series } from 'oakscriptjs';

export interface MAShiftInputs {
  length: number;
  maType: string;
  offset: number;
  src: SourceType;
}

export const defaultInputs: MAShiftInputs = {
  length: 20,
  maType: 'sma',
  offset: 0,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'sma', options: ['sma', 'ema', 'wma'] },
  { id: 'offset', type: 'int', title: 'Offset', defval: 0 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Moving Average Shift',
  shortTitle: 'MAS',
  overlay: true,
};

function applyMA(src: Series, length: number, maType: string): number[] {
  switch (maType) {
    case 'ema': return ta.ema(src, length).toArray();
    case 'wma': return ta.wma(src, length).toArray();
    default: return ta.sma(src, length).toArray();
  }
}

export function calculate(bars: Bar[], inputs: Partial<MAShiftInputs> = {}): IndicatorResult {
  const { length, maType, offset, src } = { ...defaultInputs, ...inputs };
  const srcSeries = getSourceSeries(bars, src);
  const n = bars.length;

  const maArr = applyMA(srcSeries, length, maType);

  const plot = bars.map((_bar, i) => {
    const srcIdx = i - offset;
    const val = srcIdx >= 0 && srcIdx < n && srcIdx >= length ? (maArr[srcIdx] ?? NaN) : NaN;
    return { time: bars[i].time, value: val };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot },
  };
}

export const MAShift = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
