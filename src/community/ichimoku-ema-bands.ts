/**
 * Ichimoku EMA Bands
 *
 * Ichimoku cloud with EMA-based bands.
 * Standard Tenkan-sen and Kijun-sen plus two EMA bands.
 *
 * Reference: TradingView "Ichimoku EMA Bands" (community)
 */

import { ta, Series, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface IchimokuEMABandsInputs {
  convLen: number;
  baseLen: number;
  emaLen1: number;
  emaLen2: number;
}

export const defaultInputs: IchimokuEMABandsInputs = {
  convLen: 9,
  baseLen: 26,
  emaLen1: 12,
  emaLen2: 26,
};

export const inputConfig: InputConfig[] = [
  { id: 'convLen', type: 'int', title: 'Conversion Length', defval: 9, min: 1 },
  { id: 'baseLen', type: 'int', title: 'Base Length', defval: 26, min: 1 },
  { id: 'emaLen1', type: 'int', title: 'EMA 1 Length', defval: 12, min: 1 },
  { id: 'emaLen2', type: 'int', title: 'EMA 2 Length', defval: 26, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Tenkan', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Kijun', color: '#EF5350', lineWidth: 1 },
  { id: 'plot2', title: 'EMA 1', color: '#26A69A', lineWidth: 1 },
  { id: 'plot3', title: 'EMA 2', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'Ichimoku EMA Bands',
  shortTitle: 'Ichi EMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<IchimokuEMABandsInputs> = {}): IndicatorResult {
  const { convLen, baseLen, emaLen1, emaLen2 } = { ...defaultInputs, ...inputs };

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);
  const closeSeries = getSourceSeries(bars, 'close');

  const convHighArr = ta.highest(highSeries, convLen).toArray();
  const convLowArr = ta.lowest(lowSeries, convLen).toArray();
  const baseHighArr = ta.highest(highSeries, baseLen).toArray();
  const baseLowArr = ta.lowest(lowSeries, baseLen).toArray();
  const ema1Arr = ta.ema(closeSeries, emaLen1).toArray();
  const ema2Arr = ta.ema(closeSeries, emaLen2).toArray();

  const warmup = Math.max(convLen, baseLen, emaLen1, emaLen2);

  const tenkanPlot = convHighArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (v + convLowArr[i]) / 2,
  }));
  const kijunPlot = baseHighArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (v + baseLowArr[i]) / 2,
  }));
  const ema1Plot = ema1Arr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || isNaN(v) ? NaN : v,
  }));
  const ema2Plot = ema2Arr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || isNaN(v) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': tenkanPlot, 'plot1': kijunPlot, 'plot2': ema1Plot, 'plot3': ema2Plot },
    fills: [{ plot1: 'plot2', plot2: 'plot3', options: { color: 'rgba(38,166,154,0.1)' } }],
  };
}

export const IchimokuEMABands = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
