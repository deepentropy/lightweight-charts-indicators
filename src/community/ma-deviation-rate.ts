/**
 * Moving Average Deviation Rate
 *
 * Measures how far price deviates from its MA as a percentage.
 * deviation_rate = (source - ma) / ma * 100
 *
 * Reference: TradingView "Moving Average Deviation Rate" (community)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { Series } from 'oakscriptjs';

export interface MADeviationRateInputs {
  length: number;
  maType: string;
  src: SourceType;
}

export const defaultInputs: MADeviationRateInputs = {
  length: 20,
  maType: 'sma',
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'sma', options: ['sma', 'ema', 'wma'] },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Deviation Rate', color: '#2962FF', lineWidth: 1 },
];

export const hlineConfig = [
  { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } },
];

export const metadata = {
  title: 'Moving Average Deviation Rate',
  shortTitle: 'MADR',
  overlay: false,
};

function applyMA(src: Series, length: number, maType: string): number[] {
  switch (maType) {
    case 'ema': return ta.ema(src, length).toArray();
    case 'wma': return ta.wma(src, length).toArray();
    default: return ta.sma(src, length).toArray();
  }
}

export function calculate(bars: Bar[], inputs: Partial<MADeviationRateInputs> = {}): IndicatorResult {
  const { length, maType, src } = { ...defaultInputs, ...inputs };
  const srcSeries = getSourceSeries(bars, src);
  const srcArr = srcSeries.toArray();

  const maArr = applyMA(srcSeries, length, maType);

  const plot = maArr.map((maVal, i) => {
    if (i < length || !maVal || maVal === 0) return { time: bars[i].time, value: NaN };
    const deviation = ((srcArr[i] ?? 0) - maVal) / maVal * 100;
    return { time: bars[i].time, value: deviation };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot },
    hlines: hlineConfig.map(h => ({ value: h.value, options: h.options })),
  };
}

export const MADeviationRate = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
