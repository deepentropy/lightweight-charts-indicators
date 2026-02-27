/**
 * CM Enhanced Ichimoku Cloud V5
 *
 * Enhanced Ichimoku Cloud with Tenkan-Sen, Kijun-Sen, Chikou Span,
 * Senkou Span A/B cloud with dynamic trend coloring, and cross arrows.
 *
 * Reference: TradingView "CM_Enhanced Ichimoku Cloud V5" by ChrisMoody (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface CMEnhancedIchimokuInputs {
  conversionLen: number;
  baseLen: number;
  spanBLen: number;
  displacement: number;
  showCrosses: boolean;
}

export const defaultInputs: CMEnhancedIchimokuInputs = {
  conversionLen: 9,
  baseLen: 26,
  spanBLen: 52,
  displacement: 26,
  showCrosses: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'conversionLen', type: 'int', title: 'Tenkan-Sen', defval: 9, min: 1 },
  { id: 'baseLen', type: 'int', title: 'Kijun-Sen', defval: 26, min: 1 },
  { id: 'spanBLen', type: 'int', title: 'Senkou Span B', defval: 52, min: 1 },
  { id: 'displacement', type: 'int', title: 'Displacement', defval: 26, min: 1 },
  { id: 'showCrosses', type: 'bool', title: 'Show Tenkan/Kijun Crosses', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Tenkan-Sen', color: '#00FF00', lineWidth: 4 },
  { id: 'plot1', title: 'Kijun-Sen', color: '#FF00FF', lineWidth: 4 },
  { id: 'plot2', title: 'Senkou Span A', color: '#26A69A', lineWidth: 5 },
  { id: 'plot3', title: 'Senkou Span B', color: '#FF6D00', lineWidth: 5 },
  { id: 'plot4', title: 'Chikou Span', color: '#00FFFF', lineWidth: 4 },
];

export const metadata = {
  title: 'CM Enhanced Ichimoku Cloud V5',
  shortTitle: 'CM Ichimoku',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<CMEnhancedIchimokuInputs> = {}): IndicatorResult {
  const { conversionLen, baseLen, spanBLen, displacement, showCrosses } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const convHighArr = ta.highest(highSeries, conversionLen).toArray();
  const convLowArr = ta.lowest(lowSeries, conversionLen).toArray();
  const baseHighArr = ta.highest(highSeries, baseLen).toArray();
  const baseLowArr = ta.lowest(lowSeries, baseLen).toArray();
  const spanBHighArr = ta.highest(highSeries, spanBLen).toArray();
  const spanBLowArr = ta.lowest(lowSeries, spanBLen).toArray();

  const warmup = Math.max(conversionLen, baseLen, spanBLen);

  const tenkanPlot: { time: number; value: number; color?: string }[] = [];
  const kijunPlot: { time: number; value: number; color?: string }[] = [];
  const spanAPlot: { time: number; value: number; color?: string }[] = [];
  const spanBPlot: { time: number; value: number; color?: string }[] = [];
  const chikouPlot: { time: number; value: number }[] = [];

  // Pre-calculate Tenkan, Kijun, Span A and Span B values
  const tenkanArr: number[] = new Array(n);
  const kijunArr: number[] = new Array(n);
  const spanAValues: number[] = new Array(n);
  const spanBValues: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    tenkanArr[i] = (convHighArr[i] + convLowArr[i]) / 2;
    kijunArr[i] = (baseHighArr[i] + baseLowArr[i]) / 2;
    spanAValues[i] = (tenkanArr[i] + kijunArr[i]) / 2;
    spanBValues[i] = (spanBHighArr[i] + spanBLowArr[i]) / 2;

    // Pine: plot(turning, color=lime, linewidth=4)
    tenkanPlot.push({ time: bars[i].time, value: i < warmup ? NaN : tenkanArr[i], color: '#00FF00' });
    // Pine: plot(standard, color=fuchsia, linewidth=4)
    kijunPlot.push({ time: bars[i].time, value: i < warmup ? NaN : kijunArr[i], color: '#FF00FF' });

    // Chikou Span: close plotted offset by -displacement (shifted backwards)
    // Pine: plot(close, offset=-displacement, color=aqua)
    // At output position i, display close from bar i+displacement (shifted back to here)
    const chikouSrcIdx = i + displacement;
    if (chikouSrcIdx < n) {
      chikouPlot.push({ time: bars[i].time, value: bars[chikouSrcIdx].close });
    } else {
      chikouPlot.push({ time: bars[i].time, value: NaN });
    }
  }

  // Span A/B displaced forward; dynamic color based on Span A vs B
  // Pine: col = leadingSpan1 >= leadingSpan2 ? lime : red
  for (let i = 0; i < n; i++) {
    const srcIdx = i - displacement;
    if (srcIdx < 0 || srcIdx < warmup) {
      spanAPlot.push({ time: bars[i].time, value: NaN });
      spanBPlot.push({ time: bars[i].time, value: NaN });
    } else {
      const sA = spanAValues[srcIdx];
      const sB = spanBValues[srcIdx];
      const col = sA >= sB ? '#00FF00' : '#FF0000';
      spanAPlot.push({ time: bars[i].time, value: sA, color: col });
      spanBPlot.push({ time: bars[i].time, value: sB, color: col });
    }
  }

  // Dynamic fill colors: lime cloud when Span A >= Span B, red cloud otherwise
  const fillColors: string[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const srcIdx = i - displacement;
    if (srcIdx < 0 || srcIdx < warmup) {
      fillColors[i] = 'transparent';
    } else {
      fillColors[i] = spanAValues[srcIdx] >= spanBValues[srcIdx]
        ? 'rgba(0, 255, 0, 0.30)' : 'rgba(255, 0, 0, 0.30)';
    }
  }

  // plotarrow markers for Tenkan/Kijun crosses (Pine: cr1 input, default false)
  const markers: MarkerData[] = [];
  if (showCrosses) {
    for (let i = warmup + 1; i < n; i++) {
      // crossUpTenkanKinjun = turning[1] < standard[1] and turning > standard
      if (tenkanArr[i - 1] < kijunArr[i - 1] && tenkanArr[i] > kijunArr[i]) {
        markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#FFFF00', text: 'TK Cross Up' });
      }
      // crossDnTenkanKinjun = turning[1] > standard[1] and turning < standard
      if (tenkanArr[i - 1] > kijunArr[i - 1] && tenkanArr[i] < kijunArr[i]) {
        markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#FFFF00', text: 'TK Cross Dn' });
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': tenkanPlot, 'plot1': kijunPlot, 'plot2': spanAPlot, 'plot3': spanBPlot, 'plot4': chikouPlot },
    fills: [{ plot1: 'plot2', plot2: 'plot3', options: { color: 'rgba(0, 255, 0, 0.30)' }, colors: fillColors }],
    markers,
  } as IndicatorResult & { markers: MarkerData[] };
}

export const CMEnhancedIchimoku = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
