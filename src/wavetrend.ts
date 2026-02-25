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
  { id: 'plot2', title: 'Diff', color: '#2962FF', lineWidth: 1 },
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

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': toPlot(wt1), 'plot1': toPlot(wt2), 'plot2': toPlot(diff) },
  };
}

export const WaveTrend = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
