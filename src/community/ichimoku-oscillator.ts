/**
 * Ichimoku Oscillator
 *
 * Oscillator derived from Ichimoku components: tenkan - kijun as histogram.
 * Tenkan = (highest high + lowest low) / 2 over conversionPeriods.
 * Kijun = (highest high + lowest low) / 2 over basePeriods.
 *
 * Reference: TradingView "Ichimoku Oscillator" (TV#302)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';

export interface IchimokuOscillatorInputs {
  conversionPeriods: number;
  basePeriods: number;
  laggingSpan: number;
  displacement: number;
  emaLen: number;
}

export const defaultInputs: IchimokuOscillatorInputs = {
  conversionPeriods: 9,
  basePeriods: 26,
  laggingSpan: 52,
  displacement: 13,
  emaLen: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'conversionPeriods', type: 'int', title: 'Conversion Periods', defval: 9, min: 1 },
  { id: 'basePeriods', type: 'int', title: 'Base Periods', defval: 26, min: 1 },
  { id: 'laggingSpan', type: 'int', title: 'Lagging Span', defval: 52, min: 1 },
  { id: 'displacement', type: 'int', title: 'Displacement', defval: 13, min: 1 },
  { id: 'emaLen', type: 'int', title: 'EMA Length', defval: 9, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Cloud', color: '#004600', lineWidth: 1, style: 'area' },
  { id: 'plot1', title: 'ConvBase', color: '#008200', lineWidth: 1, style: 'area' },
  { id: 'plot2', title: 'Lagging', color: '#00BE00', lineWidth: 1, style: 'area' },
  { id: 'plot3', title: 'Oscillator', color: '#00FA00', lineWidth: 1, style: 'area' },
  { id: 'plot4', title: 'EMA', color: '#d1c4e9', lineWidth: 1 },
];

export const metadata = {
  title: 'Ichimoku Oscillator',
  shortTitle: 'IchiOsc',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<IchimokuOscillatorInputs> = {}): IndicatorResult & { markers: MarkerData[]; bgColors: BgColorData[] } {
  const { conversionPeriods, basePeriods, laggingSpan, displacement, emaLen } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const high = new Series(bars, (b) => b.high);
  const low = new Series(bars, (b) => b.low);
  const close = new Series(bars, (b) => b.close);

  // Donchian midline: (highest + lowest) / 2
  const tenkan = ta.highest(high, conversionPeriods).add(ta.lowest(low, conversionPeriods)).div(2);
  const kijun = ta.highest(high, basePeriods).add(ta.lowest(low, basePeriods)).div(2);
  const leadLine1 = tenkan.add(kijun).div(2);
  const leadLine2 = ta.highest(high, laggingSpan).add(ta.lowest(low, laggingSpan)).div(2);

  const tenkanArr = tenkan.toArray();
  const kijunArr = kijun.toArray();
  const leadLine1Arr = leadLine1.toArray();
  const leadLine2Arr = leadLine2.toArray();
  const closeArr = close.toArray();

  const warmup = Math.max(conversionPeriods, basePeriods, laggingSpan, displacement);

  // Pine: mtrend tracks if close is above/below cloud
  // Pine layers: Oscline, Lagging, ConvBase, cloud (stacked area)
  const mtrend: number[] = new Array(n).fill(0);
  const oscLine: number[] = new Array(n).fill(NaN);
  const lagging: number[] = new Array(n).fill(NaN);
  const convBase: number[] = new Array(n).fill(NaN);
  const cloud: number[] = new Array(n).fill(NaN);

  for (let i = warmup; i < n; i++) {
    const c = closeArr[i] ?? 0;
    // Cloud boundaries at displacement offset
    const dIdx = i - (displacement - 1);
    if (dIdx < 0) continue;
    const ll1d = leadLine1Arr[dIdx] ?? 0;
    const ll2d = leadLine2Arr[dIdx] ?? 0;
    const cloudMin = Math.min(ll1d, ll2d);
    const cloudMax = Math.max(ll1d, ll2d);
    const inCloud = c >= cloudMin && c <= cloudMax;

    // mtrend
    if (c > cloudMax) mtrend[i] = 1;
    else if (c < cloudMin) mtrend[i] = -1;
    else mtrend[i] = i > 0 ? mtrend[i - 1] : 0;

    // Layer 1: Oscline
    oscLine[i] = mtrend[i] === 1 ? (c - cloudMin) : (c - cloudMax);

    // Layer 2: Lagging = Oscline + contribution from lagging span
    const ll1dDisp = (i - (displacement - 1)) >= 0 ? (leadLine1Arr[i - (displacement - 1)] ?? 0) : 0;
    const ll2dDisp = (i - (displacement - 1)) >= 0 ? (leadLine2Arr[i - (displacement - 1)] ?? 0) : 0;
    const cloudMaxDisp = Math.max(ll1dDisp, ll2dDisp);
    const cloudMinDisp = Math.min(ll1dDisp, ll2dDisp);
    lagging[i] = oscLine[i] + (mtrend[i] === 1
      ? Math.max(c - cloudMaxDisp, 0)
      : Math.min(c - cloudMinDisp, 0));

    // Layer 3: ConvBase = Lagging + conversion-base spread
    const tk = tenkanArr[i] ?? 0;
    const kj = kijunArr[i] ?? 0;
    convBase[i] = lagging[i] + (mtrend[i] === 1
      ? Math.max(tk - kj, 0)
      : Math.min(tk - kj, 0));

    // Layer 4: cloud = ConvBase + lead line spread
    const ll1 = leadLine1Arr[i] ?? 0;
    const ll2 = leadLine2Arr[i] ?? 0;
    cloud[i] = convBase[i] + (mtrend[i] === 1
      ? Math.max(ll1 - ll2, 0)
      : Math.min(ll1 - ll2, 0));
  }

  // EMA of cloud layer
  const cloudSeries = Series.fromArray(bars, cloud);
  const emaLine = ta.ema(cloudSeries, emaLen).toArray();

  const makePlot = (arr: number[], upColor: string, dnColor: string) =>
    arr.map((v, i) => {
      if (i < warmup || isNaN(v)) return { time: bars[i].time, value: NaN };
      return { time: bars[i].time, value: v, color: mtrend[i] === 1 ? upColor : dnColor };
    });

  const plot0 = makePlot(cloud, '#004600', '#460000');
  const plot1 = makePlot(convBase, '#008200', '#820000');
  const plot2 = makePlot(lagging, '#00BE00', '#BE0000');
  const plot3 = makePlot(oscLine, '#00FA00', '#FA0000');
  const plot4 = emaLine.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup + emaLen || v == null) ? NaN : v,
  }));

  // Pine markers: uptrend = trend==4 signal, downtrend = trend==-4 signal
  // Simplified: oscillator zero-cross markers
  const markers: MarkerData[] = [];
  for (let i = warmup + 1; i < n; i++) {
    const cur = oscLine[i];
    const prev = oscLine[i - 1];
    if (isNaN(cur) || isNaN(prev)) continue;
    if (prev <= 0 && cur > 0) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: '#FFFFFF', text: 'Bull' });
    }
    if (prev >= 0 && cur < 0) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: '#FFEB3B', text: 'Bear' });
    }
  }

  // bgColors: positive cloud = green, negative = blue
  const bgColors: BgColorData[] = [];
  for (let i = warmup; i < n; i++) {
    if (isNaN(cloud[i])) continue;
    if (cloud[i] > 0) {
      bgColors.push({ time: bars[i].time, color: 'rgba(0, 150, 0, 0.1)' });
    } else if (cloud[i] < 0) {
      bgColors.push({ time: bars[i].time, color: 'rgba(0, 0, 150, 0.1)' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3, 'plot4': plot4 },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'dotted' as const, title: 'Zero' } },
    ],
    markers,
    bgColors,
  };
}

export const IchimokuOscillator = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
