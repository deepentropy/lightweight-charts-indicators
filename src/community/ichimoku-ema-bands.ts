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
  laggingSpan2Periods: number;
  displacement: number;
}

export const defaultInputs: IchimokuEMABandsInputs = {
  convLen: 5,
  baseLen: 26,
  emaLen1: 12,
  emaLen2: 26,
  laggingSpan2Periods: 52,
  displacement: 26,
};

export const inputConfig: InputConfig[] = [
  { id: 'convLen', type: 'int', title: 'Conversion Length', defval: 5, min: 1 },
  { id: 'baseLen', type: 'int', title: 'Base Length', defval: 26, min: 1 },
  { id: 'emaLen1', type: 'int', title: 'EMA 1 Length', defval: 12, min: 1 },
  { id: 'emaLen2', type: 'int', title: 'EMA 2 Length', defval: 26, min: 1 },
  { id: 'laggingSpan2Periods', type: 'int', title: 'Lagging Span 2 Periods', defval: 52, min: 1 },
  { id: 'displacement', type: 'int', title: 'Displacement', defval: 26, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Tenkan', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Kijun', color: '#EF5350', lineWidth: 1 },
  { id: 'plot2', title: 'EMA 1', color: '#26A69A', lineWidth: 1 },
  { id: 'plot3', title: 'EMA 2', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot4', title: 'Senkou Span A', color: '#26A69A', lineWidth: 1 },
  { id: 'plot5', title: 'Senkou Span B', color: '#EF5350', lineWidth: 1 },
];

export const metadata = {
  title: 'Ichimoku EMA Bands',
  shortTitle: 'Ichi EMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<IchimokuEMABandsInputs> = {}): IndicatorResult {
  const { convLen, baseLen, emaLen1, emaLen2, laggingSpan2Periods, displacement } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);
  const closeSeries = getSourceSeries(bars, 'close');

  const convHighArr = ta.highest(highSeries, convLen).toArray();
  const convLowArr = ta.lowest(lowSeries, convLen).toArray();
  const baseHighArr = ta.highest(highSeries, baseLen).toArray();
  const baseLowArr = ta.lowest(lowSeries, baseLen).toArray();
  const ema1Arr = ta.ema(closeSeries, emaLen1).toArray();
  const ema2Arr = ta.ema(closeSeries, emaLen2).toArray();

  // Senkou Span B: donchian(laggingSpan2Periods)
  const span2HighArr = ta.highest(highSeries, laggingSpan2Periods).toArray();
  const span2LowArr = ta.lowest(lowSeries, laggingSpan2Periods).toArray();

  const warmup = Math.max(convLen, baseLen, emaLen1, emaLen2);

  // Pre-compute tenkan and kijun values for lead line calculation
  const tenkanVals: number[] = new Array(n);
  const kijunVals: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    tenkanVals[i] = i < warmup ? NaN : (convHighArr[i] + convLowArr[i]) / 2;
    kijunVals[i] = i < warmup ? NaN : (baseHighArr[i] + baseLowArr[i]) / 2;
  }

  const tenkanPlot = tenkanVals.map((v, i) => ({
    time: bars[i].time,
    value: v,
  }));
  const kijunPlot = kijunVals.map((v, i) => ({
    time: bars[i].time,
    value: v,
  }));
  const ema1Plot = ema1Arr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || isNaN(v) ? NaN : v,
  }));
  const ema2Plot = ema2Arr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || isNaN(v) ? NaN : v,
  }));

  // Pine: leadLine1 = avg(conversionLine, baseLine) displaced forward
  // Pine: leadLine2 = donchian(laggingSpan2Periods) displaced forward
  // Displacement means the value at bar i is plotted at bar i+displacement
  const spanAPlot: { time: number; value: number }[] = [];
  const spanBPlot: { time: number; value: number }[] = [];
  for (let i = 0; i < n; i++) {
    // The value at plot position i comes from bar (i - displacement)
    const srcIdx = i - displacement;
    if (srcIdx < 0 || srcIdx < warmup) {
      spanAPlot.push({ time: bars[i].time, value: NaN });
    } else {
      const spanA = (tenkanVals[srcIdx] + kijunVals[srcIdx]) / 2;
      spanAPlot.push({ time: bars[i].time, value: isNaN(spanA) ? NaN : spanA });
    }

    const span2Warmup = Math.max(laggingSpan2Periods, warmup);
    if (srcIdx < 0 || srcIdx < span2Warmup) {
      spanBPlot.push({ time: bars[i].time, value: NaN });
    } else {
      const spanB = (span2HighArr[srcIdx] + span2LowArr[srcIdx]) / 2;
      spanBPlot.push({ time: bars[i].time, value: isNaN(spanB) ? NaN : spanB });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': tenkanPlot, 'plot1': kijunPlot, 'plot2': ema1Plot, 'plot3': ema2Plot, 'plot4': spanAPlot, 'plot5': spanBPlot },
    fills: [
      { plot1: 'plot2', plot2: 'plot3', options: { color: 'rgba(38,166,154,0.1)' } },
      { plot1: 'plot4', plot2: 'plot5', options: { color: 'rgba(192,192,192,0.15)' } },
    ],
  };
}

export const IchimokuEMABands = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
