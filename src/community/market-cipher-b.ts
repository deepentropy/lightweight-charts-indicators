/**
 * Market Cipher B
 *
 * WaveTrend oscillator with difference area, cross-detection dots,
 * and cross background lines.
 *
 * Reference: TradingView "Market Cipher B Free version with Buy and sell" (community)
 */

import { ta, getSourceSeries, Series, math, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface MarketCipherBInputs {
  wtChannelLen: number;
  wtAvgLen: number;
  obLevel1: number;
  obLevel2: number;
  osLevel1: number;
  osLevel2: number;
}

export const defaultInputs: MarketCipherBInputs = {
  wtChannelLen: 10,
  wtAvgLen: 21,
  obLevel1: 60,
  obLevel2: 53,
  osLevel1: -60,
  osLevel2: -53,
};

export const inputConfig: InputConfig[] = [
  { id: 'wtChannelLen', type: 'int', title: 'Channel Length', defval: 10, min: 1 },
  { id: 'wtAvgLen', type: 'int', title: 'Average Length', defval: 21, min: 1 },
  { id: 'obLevel1', type: 'int', title: 'Over Bought Level 1', defval: 60 },
  { id: 'obLevel2', type: 'int', title: 'Over Bought Level 2', defval: 53 },
  { id: 'osLevel1', type: 'int', title: 'Over Sold Level 1', defval: -60 },
  { id: 'osLevel2', type: 'int', title: 'Over Sold Level 2', defval: -53 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'wt1', title: 'WT1', color: '#2196F3', lineWidth: 2, style: 'area' },
  { id: 'wt2', title: 'WT2', color: '#0000FF', lineWidth: 1, style: 'area' },
  { id: 'diff', title: 'WT1-WT2', color: '#FFFF00', lineWidth: 1, style: 'area' },
  { id: 'crossLine', title: 'Cross Line', color: '#000000', lineWidth: 5 },
  { id: 'crossDot', title: 'Cross Dot', color: '#00FF00', lineWidth: 6 },
];

export const metadata = {
  title: 'Market Cipher B',
  shortTitle: 'MCB',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<MarketCipherBInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { wtChannelLen, wtAvgLen, obLevel1, obLevel2, osLevel1, osLevel2 } = { ...defaultInputs, ...inputs };

  // WaveTrend: Pine original
  // ap = hlc3, esa = ema(ap, n1), d = ema(abs(ap-esa), n1)
  // ci = (ap-esa)/(0.015*d), tci = ema(ci, n2)
  // wt1 = tci, wt2 = sma(wt1, 4)
  const hlc3 = getSourceSeries(bars, 'hlc3');
  const esa = ta.ema(hlc3, wtChannelLen);
  const d = ta.ema(math.abs(hlc3.sub(esa)) as Series, wtChannelLen);
  const ci = hlc3.sub(esa).div(d.mul(0.015));
  const wt1 = ta.ema(ci, wtAvgLen);
  const wt2 = ta.sma(wt1, 4);

  const wt1Arr = wt1.toArray();
  const wt2Arr = wt2.toArray();

  const warmup = wtChannelLen + wtAvgLen;
  const n = bars.length;

  const toVal = (v: number | null, i: number): number => {
    if (v == null || i < warmup || isNaN(v)) return NaN;
    return v;
  };

  // Pine: plot(wt1, style=area, color=#2196F3)
  const wt1Plot = wt1Arr.map((v, i) => ({ time: bars[i].time, value: toVal(v, i) }));
  // Pine: plot(wt2, style=area, color=blue)
  const wt2Plot = wt2Arr.map((v, i) => ({ time: bars[i].time, value: toVal(v, i) }));

  // Pine: plot(wt1-wt2, color=yellow, style=area)
  const diffPlot = bars.map((b, i) => {
    const v1 = wt1Arr[i];
    const v2 = wt2Arr[i];
    if (v1 == null || v2 == null || i < warmup) return { time: b.time, value: NaN };
    return { time: b.time, value: v1 - v2 };
  });

  // Pine: cross(wt1, wt2) - detect crosses
  // plot(cross(wt1,wt2) ? wt2 : na, color=black, style=line, linewidth=5)
  // plot(cross(wt1,wt2) ? wt2 : na, color=(wt2-wt1>0 ? red : lime), style=circles, linewidth=6)
  const crossLinePlot: { time: number; value: number }[] = [];
  const crossDotPlot: { time: number; value: number; color?: string }[] = [];
  const markers: MarkerData[] = [];

  for (let i = 0; i < n; i++) {
    if (i < warmup + 1 || wt1Arr[i] == null || wt2Arr[i] == null || wt1Arr[i - 1] == null || wt2Arr[i - 1] == null) {
      crossLinePlot.push({ time: bars[i].time, value: NaN });
      crossDotPlot.push({ time: bars[i].time, value: NaN });
      continue;
    }

    const prev1 = wt1Arr[i - 1]!;
    const prev2 = wt2Arr[i - 1]!;
    const curr1 = wt1Arr[i]!;
    const curr2 = wt2Arr[i]!;

    // cross: either crossover or crossunder
    const isCross = (prev1 <= prev2 && curr1 > curr2) || (prev1 >= prev2 && curr1 < curr2);

    if (isCross) {
      crossLinePlot.push({ time: bars[i].time, value: curr2 });
      const dotColor = (curr2 - curr1) > 0 ? '#FF0000' : '#00FF00'; // red if wt2>wt1, lime otherwise
      crossDotPlot.push({ time: bars[i].time, value: curr2, color: dotColor });
    } else {
      crossLinePlot.push({ time: bars[i].time, value: NaN });
      crossDotPlot.push({ time: bars[i].time, value: NaN });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'wt1': wt1Plot,
      'wt2': wt2Plot,
      'diff': diffPlot,
      'crossLine': crossLinePlot,
      'crossDot': crossDotPlot,
    },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'solid' as const, title: 'Zero' } },
      { value: obLevel1, options: { color: '#EF5350', linestyle: 'dashed' as const, title: 'OB1' } },
      { value: osLevel1, options: { color: '#26A69A', linestyle: 'dashed' as const, title: 'OS1' } },
      { value: obLevel2, options: { color: '#EF5350', linestyle: 'dashed' as const, title: 'OB2' } },
      { value: osLevel2, options: { color: '#26A69A', linestyle: 'dashed' as const, title: 'OS2' } },
    ],
    markers,
  };
}

export const MarketCipherB = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
