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

  // Pine: trend variable - cumulative layer strength from -4 to 4
  // Pine uses ATR-based tolerance for whipsaw protection
  const atrLen = 9;
  const atrMult = 2.0;
  const trArr: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const h = bars[i].high, l = bars[i].low, pc = closeArr[i - 1] ?? 0;
    trArr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
  }
  const atrArr: number[] = new Array(n).fill(NaN);
  // RMA(tr, atrLen)
  for (let i = atrLen; i < n; i++) {
    if (isNaN(atrArr[i - 1])) {
      let s = 0;
      for (let j = i - atrLen + 1; j <= i; j++) s += trArr[j];
      atrArr[i] = s / atrLen;
    } else {
      atrArr[i] = (atrArr[i - 1] * (atrLen - 1) + trArr[i]) / atrLen;
    }
  }

  const trendArr: number[] = new Array(n).fill(0);
  const entryLevel: number[] = new Array(n).fill(NaN);

  for (let i = warmup; i < n; i++) {
    const c = closeArr[i] ?? 0;
    const dIdx = i - (displacement - 1);
    if (dIdx < 0) continue;
    const ll1d = leadLine1Arr[dIdx] ?? 0;
    const ll2d = leadLine2Arr[dIdx] ?? 0;
    const cloudMinV = Math.min(ll1d, ll2d);
    const cloudMaxV = Math.max(ll1d, ll2d);
    const tole = !isNaN(atrArr[i]) ? atrArr[i] * atrMult : 0;
    const tk = tenkanArr[i] ?? 0;
    const kj = kijunArr[i] ?? 0;
    const cloudup = (leadLine1Arr[i] ?? 0) >= (leadLine2Arr[i] ?? 0);
    const clouddn = (leadLine1Arr[i] ?? 0) <= (leadLine2Arr[i] ?? 0);
    const convoverbase = tk >= kj;
    const baseoverconv = tk <= kj;
    const anyRising = (i > 0) && ((tk - (tenkanArr[i - 1] ?? 0)) > 0 || (kj - (kijunArr[i - 1] ?? 0)) > 0);
    const anyFalling = (i > 0) && ((tk - (tenkanArr[i - 1] ?? 0)) < 0 || (kj - (kijunArr[i - 1] ?? 0)) < 0);

    const prevTrend = i > 0 ? trendArr[i - 1] : 0;
    const prevMtrend = i > 0 ? mtrend[i - 1] : 0;

    if (mtrend[i] === 1) {
      trendArr[i] = prevMtrend === -1 ? 0 : prevTrend;
      if (trendArr[i] < 4 && c > cloudMaxV) {
        trendArr[i] = (lagging[i] > oscLine[i] ? 1 : 0)
          + (convoverbase && anyRising ? 1 : 0)
          + (cloudup ? 1 : 0)
          + 1;
        if (trendArr[i] === 4) entryLevel[i] = c;
        else entryLevel[i] = i > 0 ? entryLevel[i - 1] : NaN;
      } else {
        trendArr[i] = tk < kj - tole ? 0 : trendArr[i];
        entryLevel[i] = i > 0 ? entryLevel[i - 1] : NaN;
      }
    } else if (mtrend[i] === -1) {
      trendArr[i] = prevMtrend === 1 ? 0 : prevTrend;
      if (trendArr[i] > -4 && c < cloudMinV) {
        trendArr[i] = (lagging[i] < oscLine[i] ? -1 : 0)
          - (baseoverconv && anyFalling ? 1 : 0)
          - (clouddn ? 1 : 0)
          - 1;
        if (trendArr[i] === -4) entryLevel[i] = c;
        else entryLevel[i] = i > 0 ? entryLevel[i - 1] : NaN;
      } else {
        trendArr[i] = tk > kj + tole ? 0 : trendArr[i];
        entryLevel[i] = i > 0 ? entryLevel[i - 1] : NaN;
      }
    } else {
      trendArr[i] = prevTrend;
      entryLevel[i] = i > 0 ? entryLevel[i - 1] : NaN;
    }
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
  const markers: MarkerData[] = [];
  for (let i = warmup + 1; i < n; i++) {
    if (isNaN(cloud[i])) continue;
    const uptrend = trendArr[i] === 4 && trendArr[i] !== trendArr[i - 1];
    const downtrend = trendArr[i] === -4 && trendArr[i] !== trendArr[i - 1];
    if (uptrend) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: '#FFFFFF', text: '' });
    }
    if (downtrend) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: '#FFEB3B', text: '' });
    }
  }

  // Pine: bgColors using trend strength with power(3) intensity scaling
  // uptmult = 159 + math.pow(trend, 3); bgcolup = rgb(0, uptmult, 0, bgtransp) (default green uptrend)
  // dntmult = 159 - math.pow(trend, 3); bgcoldn = rgb(0, 0, dntmult, bgtransp) (default blue downtrend)
  const bgtransp = 60; // default 60% transparency -> alpha = 0.4
  const bgAlpha = 1 - bgtransp / 100;
  const bgColors: BgColorData[] = [];
  for (let i = warmup; i < n; i++) {
    if (isNaN(cloud[i])) continue;
    const t = trendArr[i];
    if (t > 0) {
      // Green uptrend: intensity = 159 + pow(trend, 3), clamped to [0, 255]
      const intensity = Math.max(0, Math.min(255, Math.round(159 + Math.pow(t, 3))));
      bgColors.push({ time: bars[i].time, color: `rgba(0, ${intensity}, 0, ${bgAlpha})` });
    } else if (t < 0) {
      // Blue downtrend: intensity = 159 - pow(trend, 3) (trend is negative, so -pow gives positive)
      const intensity = Math.max(0, Math.min(255, Math.round(159 - Math.pow(t, 3))));
      bgColors.push({ time: bars[i].time, color: `rgba(0, 0, ${intensity}, ${bgAlpha})` });
    } else {
      // In S/R zone (trend == 0): use inSRcolor
      bgColors.push({ time: bars[i].time, color: `rgba(209, 212, 220, ${bgAlpha})` });
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
