/**
 * Simple Moving Averages
 *
 * Ten configurable SMA lines matching Pine source periods: 20,50,100,150,200,250,300,400,500,600.
 * SMAs #1-#5 use blue/orange coloring, #6-#10 use green/red coloring in Pine.
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

const lengths = [20, 50, 100, 150, 200, 250, 300, 400, 500, 600];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SMA #1 (20)', color: '#2196F3', lineWidth: 1 },
  { id: 'plot1', title: 'SMA #2 (50)', color: '#2196F3', lineWidth: 2 },
  { id: 'plot2', title: 'SMA #3 (100)', color: '#2196F3', lineWidth: 1 },
  { id: 'plot3', title: 'SMA #4 (150)', color: '#2196F3', lineWidth: 1 },
  { id: 'plot4', title: 'SMA #5 (200)', color: '#2196F3', lineWidth: 4 },
  { id: 'plot5', title: 'SMA #6 (250)', color: '#4CAF50', lineWidth: 1 },
  { id: 'plot6', title: 'SMA #7 (300)', color: '#4CAF50', lineWidth: 2 },
  { id: 'plot7', title: 'SMA #8 (400)', color: '#4CAF50', lineWidth: 1 },
  { id: 'plot8', title: 'SMA #9 (500)', color: '#4CAF50', lineWidth: 1 },
  { id: 'plot9', title: 'SMA #10 (600)', color: '#4CAF50', lineWidth: 4 },
];

export const metadata = {
  title: 'Simple Moving Averages',
  shortTitle: 'SMAs',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<SimpleMovingAveragesInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const src = getSourceSeries(bars, cfg.src);

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
