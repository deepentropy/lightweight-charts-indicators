/**
 * CM Guppy EMA
 *
 * Guppy system: 6 short EMAs (3,5,8,10,12,15) + 6 long EMAs (30,35,40,45,50,60).
 * Short group shows trader activity, long group shows investor sentiment.
 *
 * Reference: TradingView "CM_Guppy EMA" by ChrisMoody
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface CMGuppyEMAInputs {
  src: SourceType;
}

export const defaultInputs: CMGuppyEMAInputs = {
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Short EMA 3', color: '#26A69A', lineWidth: 1 },
  { id: 'plot1', title: 'Short EMA 5', color: '#2E7D32', lineWidth: 1 },
  { id: 'plot2', title: 'Short EMA 8', color: '#388E3C', lineWidth: 1 },
  { id: 'plot3', title: 'Short EMA 10', color: '#43A047', lineWidth: 1 },
  { id: 'plot4', title: 'Short EMA 12', color: '#4CAF50', lineWidth: 1 },
  { id: 'plot5', title: 'Short EMA 15', color: '#66BB6A', lineWidth: 1 },
  { id: 'plot6', title: 'Long EMA 30', color: '#EF5350', lineWidth: 1 },
  { id: 'plot7', title: 'Long EMA 35', color: '#E53935', lineWidth: 1 },
  { id: 'plot8', title: 'Long EMA 40', color: '#D32F2F', lineWidth: 1 },
  { id: 'plot9', title: 'Long EMA 45', color: '#C62828', lineWidth: 1 },
  { id: 'plot10', title: 'Long EMA 50', color: '#B71C1C', lineWidth: 1 },
  { id: 'plot11', title: 'Long EMA 60', color: '#880E4F', lineWidth: 1 },
];

export const metadata = {
  title: 'CM Guppy EMA',
  shortTitle: 'GuppyEMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<CMGuppyEMAInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const src = getSourceSeries(bars, cfg.src);

  const shortLengths = [3, 5, 8, 10, 12, 15];
  const longLengths = [30, 35, 40, 45, 50, 60];
  const allLengths = [...shortLengths, ...longLengths];
  const warmup = 60;

  const emaArrays = allLengths.map((len) => ta.ema(src, len).toArray());

  const plots: Record<string, Array<{ time: number; value: number }>> = {};

  for (let idx = 0; idx < allLengths.length; idx++) {
    const arr = emaArrays[idx];
    plots[`plot${idx}`] = arr.map((v, i) => {
      if (i < warmup || isNaN(v)) return { time: bars[i].time, value: NaN };
      return { time: bars[i].time, value: v };
    });
  }

  // Short cloud fill between plot0 (EMA 3) and plot5 (EMA 15)
  const shortFillColors = bars.map((_b, i) => (i < warmup ? 'transparent' : '#26A69A40'));
  // Long cloud fill between plot6 (EMA 30) and plot11 (EMA 60)
  const longFillColors = bars.map((_b, i) => (i < warmup ? 'transparent' : '#EF535040'));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    fills: [
      { plot1: 'plot0', plot2: 'plot5', colors: shortFillColors },
      { plot1: 'plot6', plot2: 'plot11', colors: longFillColors },
    ],
  };
}

export const CMGuppyEMA = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
