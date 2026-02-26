/**
 * WaveTrend with Crosses
 *
 * Normalized momentum oscillator using EMA of deviation.
 * WT1 = EMA(CI, n2) where CI = (hlc3 - EMA(hlc3, n1)) / (0.015 * EMA(|hlc3 - EMA(hlc3, n1)|, n1))
 * WT2 = SMA(WT1, 4)
 *
 * Reference: TradingView "WaveTrend with Crosses" by LazyBear
 */

import { Series, ta, getSourceSeries, math, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';

export interface WaveTrendInputs {
  channelLength: number;
  averageLength: number;
  obLevel1: number;
  osLevel1: number;
}

export const defaultInputs: WaveTrendInputs = {
  channelLength: 10,
  averageLength: 21,
  obLevel1: 60,
  osLevel1: -60,
};

export const inputConfig: InputConfig[] = [
  { id: 'channelLength', type: 'int', title: 'Channel Length', defval: 10, min: 1 },
  { id: 'averageLength', type: 'int', title: 'Average Length', defval: 21, min: 1 },
  { id: 'obLevel1', type: 'int', title: 'Over Bought Level', defval: 60 },
  { id: 'osLevel1', type: 'int', title: 'Over Sold Level', defval: -60 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'WT1', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'WT2', color: '#EF5350', lineWidth: 1 },
  { id: 'plot2', title: 'Diff', color: '#2962FF', lineWidth: 1, style: 'area' },
];

export const metadata = {
  title: 'WaveTrend',
  shortTitle: 'WT',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<WaveTrendInputs> = {}): IndicatorResult {
  const { channelLength, averageLength } = { ...defaultInputs, ...inputs };

  const ap = getSourceSeries(bars, 'hlc3');
  const esa = ta.ema(ap, channelLength);
  const d = ta.ema(math.abs(ap.sub(esa)) as Series, channelLength);
  const ci = ap.sub(esa).div(d.mul(0.015));
  const wt1 = ta.ema(ci, averageLength);
  const wt2 = ta.sma(wt1, 4);
  const diff = wt1.sub(wt2);

  const toPlot = (s: Series) =>
    s.toArray().map((value, i) => ({ time: bars[i].time, value: value ?? NaN }));

  // Cross circles and barcolor at WT1/WT2 crossover points
  const wt1Arr = wt1.toArray();
  const wt2Arr = wt2.toArray();
  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];
  for (let i = 1; i < bars.length; i++) {
    const w1 = wt1Arr[i]; const w2 = wt2Arr[i];
    const pw1 = wt1Arr[i - 1]; const pw2 = wt2Arr[i - 1];
    if (w1 == null || w2 == null || pw1 == null || pw2 == null) continue;
    const cross = (pw1 <= pw2 && w1 > w2) || (pw1 >= pw2 && w1 < w2);
    if (cross) {
      const bearish = w2 > w1;
      markers.push({
        time: bars[i].time as number,
        position: 'inBar',
        shape: 'circle',
        color: bearish ? '#FF0000' : '#00FF00',
        size: 2,
      });
      barColors.push({
        time: bars[i].time as number,
        color: bearish ? '#00FFFF' : '#FFFF00',
      });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': toPlot(wt1), 'plot1': toPlot(wt2), 'plot2': toPlot(diff) },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'solid', title: 'Zero' } },
      { value: 60, options: { color: '#EF5350', linestyle: 'dashed', title: 'OB1' } },
      { value: -60, options: { color: '#26A69A', linestyle: 'dashed', title: 'OS1' } },
      { value: 53, options: { color: '#EF5350', linestyle: 'dotted', title: 'OB2' } },
      { value: -53, options: { color: '#26A69A', linestyle: 'dotted', title: 'OS2' } },
    ],
    markers,
    barColors,
  } as IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[] };
}

export const WaveTrend = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
