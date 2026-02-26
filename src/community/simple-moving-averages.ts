/**
 * Simple Moving Averages
 *
 * Five SMA lines at common periods: 10, 20, 50, 100, 200.
 *
 * Reference: TradingView "Simple Moving Averages" (community)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface SimpleMovingAveragesInputs {
  src: SourceType;
}

export const defaultInputs: SimpleMovingAveragesInputs = {
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SMA 10', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot1', title: 'SMA 20', color: '#2962FF', lineWidth: 1 },
  { id: 'plot2', title: 'SMA 50', color: '#00E676', lineWidth: 1 },
  { id: 'plot3', title: 'SMA 100', color: '#E91E63', lineWidth: 1 },
  { id: 'plot4', title: 'SMA 200', color: '#9C27B0', lineWidth: 2 },
];

export const metadata = {
  title: 'Simple Moving Averages',
  shortTitle: 'SMA5',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<SimpleMovingAveragesInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const src = getSourceSeries(bars, cfg.src);

  const lengths = [10, 20, 50, 100, 200];

  const smaArrays = lengths.map((len) => ta.sma(src, len).toArray());

  const plots: Record<string, Array<{ time: number; value: number }>> = {};
  for (let idx = 0; idx < lengths.length; idx++) {
    const arr = smaArrays[idx];
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

export const SimpleMovingAverages = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
