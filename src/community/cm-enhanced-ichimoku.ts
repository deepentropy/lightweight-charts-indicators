/**
 * CM Enhanced Ichimoku Cloud V5
 *
 * Ichimoku Cloud with EMA overlay. Standard Ichimoku components:
 * Tenkan-sen, Kijun-sen, Senkou Span A/B, plus an EMA overlay.
 *
 * Reference: TradingView "CM_Enhanced Ichimoku Cloud V5" by ChrisMoody (community)
 */

import { ta, Series, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface CMEnhancedIchimokuInputs {
  conversionLen: number;
  baseLen: number;
  spanBLen: number;
  displacement: number;
  emaLen: number;
}

export const defaultInputs: CMEnhancedIchimokuInputs = {
  conversionLen: 9,
  baseLen: 26,
  spanBLen: 52,
  displacement: 26,
  emaLen: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'conversionLen', type: 'int', title: 'Conversion Length', defval: 9, min: 1 },
  { id: 'baseLen', type: 'int', title: 'Base Length', defval: 26, min: 1 },
  { id: 'spanBLen', type: 'int', title: 'Span B Length', defval: 52, min: 1 },
  { id: 'displacement', type: 'int', title: 'Displacement', defval: 26, min: 1 },
  { id: 'emaLen', type: 'int', title: 'EMA Length', defval: 20, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Tenkan', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Kijun', color: '#EF5350', lineWidth: 1 },
  { id: 'plot2', title: 'Span A', color: '#26A69A', lineWidth: 1 },
  { id: 'plot3', title: 'Span B', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot4', title: 'EMA', color: '#FFEB3B', lineWidth: 2 },
];

export const metadata = {
  title: 'CM Enhanced Ichimoku Cloud V5',
  shortTitle: 'CM Ichimoku',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<CMEnhancedIchimokuInputs> = {}): IndicatorResult {
  const { conversionLen, baseLen, spanBLen, displacement, emaLen } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);
  const closeSeries = getSourceSeries(bars, 'close');

  const convHighArr = ta.highest(highSeries, conversionLen).toArray();
  const convLowArr = ta.lowest(lowSeries, conversionLen).toArray();
  const baseHighArr = ta.highest(highSeries, baseLen).toArray();
  const baseLowArr = ta.lowest(lowSeries, baseLen).toArray();
  const spanBHighArr = ta.highest(highSeries, spanBLen).toArray();
  const spanBLowArr = ta.lowest(lowSeries, spanBLen).toArray();
  const emaArr = ta.ema(closeSeries, emaLen).toArray();

  const warmup = Math.max(conversionLen, baseLen, spanBLen, emaLen);

  const tenkanPlot: { time: number; value: number }[] = [];
  const kijunPlot: { time: number; value: number }[] = [];
  const spanAPlot: { time: number; value: number }[] = [];
  const spanBPlot: { time: number; value: number }[] = [];
  const emaPlot: { time: number; value: number }[] = [];

  // Pre-calculate Span A and Span B values for displacement
  const spanAValues: number[] = new Array(n);
  const spanBValues: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const tenkan = (convHighArr[i] + convLowArr[i]) / 2;
    const kijun = (baseHighArr[i] + baseLowArr[i]) / 2;
    spanAValues[i] = (tenkan + kijun) / 2;
    spanBValues[i] = (spanBHighArr[i] + spanBLowArr[i]) / 2;

    tenkanPlot.push({ time: bars[i].time, value: i < warmup ? NaN : tenkan });
    kijunPlot.push({ time: bars[i].time, value: i < warmup ? NaN : kijun });
    emaPlot.push({ time: bars[i].time, value: i < warmup || isNaN(emaArr[i]) ? NaN : emaArr[i] });
  }

  // Span A/B are displaced forward; since we can't plot future bars, we shift values
  for (let i = 0; i < n; i++) {
    const srcIdx = i - displacement;
    if (srcIdx < 0 || srcIdx < warmup) {
      spanAPlot.push({ time: bars[i].time, value: NaN });
      spanBPlot.push({ time: bars[i].time, value: NaN });
    } else {
      spanAPlot.push({ time: bars[i].time, value: spanAValues[srcIdx] });
      spanBPlot.push({ time: bars[i].time, value: spanBValues[srcIdx] });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': tenkanPlot, 'plot1': kijunPlot, 'plot2': spanAPlot, 'plot3': spanBPlot, 'plot4': emaPlot },
    fills: [{ plot1: 'plot2', plot2: 'plot3', options: { color: 'rgba(38,166,154,0.1)' } }],
  };
}

export const CMEnhancedIchimoku = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
