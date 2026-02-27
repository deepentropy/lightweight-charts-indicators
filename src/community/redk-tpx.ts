/**
 * RedK Trader Pressure Index (TPX v5.0)
 *
 * Measures bull/bear pressure from high/low changes relative to
 * a 2-bar range baseline. Bull pressure = how far bulls pull
 * highs and lows up; bear pressure = how far bears push them down.
 * Net pressure (TPX) is the WMA-smoothed difference.
 * v3.0 adds optional pre-smoothing; v4.0 adds dominant pressure signals;
 * v5.0 adds TPX swing alerts.
 *
 * Reference: TradingView "RedK Trader Pressure Index (TPX)" by RedKTrader
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface RedKTPXInputs {
  length: number;
  smooth: number;
  controlLevel: number;
  preSmooth: boolean;
  preSmoothLen: number;
  slevelOn: boolean;
  slevel: number;
}

export const defaultInputs: RedKTPXInputs = {
  length: 7,
  smooth: 3,
  controlLevel: 30,
  preSmooth: false,
  preSmoothLen: 3,
  slevelOn: false,
  slevel: 70,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Avg Length', defval: 7, min: 1 },
  { id: 'smooth', type: 'int', title: 'Smoothing', defval: 3, min: 1 },
  { id: 'controlLevel', type: 'int', title: 'Control Level', defval: 30, min: 5, max: 100 },
  { id: 'preSmooth', type: 'bool', title: 'Pre-smoothing?', defval: false },
  { id: 'preSmoothLen', type: 'int', title: 'Pre-smooth Length', defval: 3, min: 1 },
  { id: 'slevelOn', type: 'bool', title: 'Pressure Signal Line', defval: false },
  { id: 'slevel', type: 'int', title: 'Signal Level', defval: 70, min: 0, max: 100 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bull Pressure', color: '#33ff0099', lineWidth: 3, style: 'area' },
  { id: 'plot1', title: 'Bear Pressure', color: '#ff111166', lineWidth: 3, style: 'area' },
  { id: 'plot2', title: 'Net Pressure', color: '#ffffff', lineWidth: 3 },
  { id: 'plot3', title: 'Cold', color: '#800000', lineWidth: 3, style: 'circles' },
  { id: 'plot4', title: 'Hot', color: '#008000', lineWidth: 3, style: 'cross' },
];

export const metadata = {
  title: 'RedK Trader Pressure Index',
  shortTitle: 'RedK TPX',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<RedKTPXInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { length, smooth, controlLevel, preSmooth, preSmoothLen, slevelOn, slevel } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const high = new Series(bars, (b) => b.high);
  const low = new Series(bars, (b) => b.low);

  // 2-bar range: R = highest(2) - lowest(2)
  const highest2Arr = ta.highest(high, 2).toArray();
  const lowest2Arr = ta.lowest(low, 2).toArray();

  // Change in high and low (1-bar)
  const hiChangeArr = ta.change(high, 1).toArray();
  const loChangeArr = ta.change(low, 1).toArray();

  // Calculate raw bull and bear pressure bar-by-bar
  const bullsArr: number[] = new Array(n);
  const bearsArr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const h2 = highest2Arr[i];
    const l2 = lowest2Arr[i];
    const R = (h2 != null && l2 != null && !isNaN(h2) && !isNaN(l2)) ? h2 - l2 : 0;

    const hiChg = hiChangeArr[i];
    const loChg = loChangeArr[i];

    if (R === 0 || i === 0) {
      bullsArr[i] = 0;
      bearsArr[i] = 0;
      continue;
    }

    // Bull pressure: how far bulls pull high and low up
    const hiup = Math.max(hiChg != null && !isNaN(hiChg) ? hiChg : 0, 0);
    const loup = Math.max(loChg != null && !isNaN(loChg) ? loChg : 0, 0);
    bullsArr[i] = Math.min((hiup + loup) / R, 1) * 100;

    // Bear pressure: how far bears push high and low down (converted to positive)
    const hidn = Math.min(hiChg != null && !isNaN(hiChg) ? hiChg : 0, 0);
    const lodn = Math.min(loChg != null && !isNaN(loChg) ? loChg : 0, 0);
    bearsArr[i] = Math.max((hidn + lodn) / R, -1) * -100;
  }

  // WMA of bull and bear pressure
  const bullsSeries = Series.fromArray(bars, bullsArr);
  const bearsSeries = Series.fromArray(bars, bearsArr);
  const avgBullRaw = ta.wma(bullsSeries, length);
  const avgBearRaw = ta.wma(bearsSeries, length);

  // Pine v3.0: optional pre-smoothing (avgbulls = pre_s ? wma(avgbull, pre_sv) : avgbull)
  const avgBullsArr = preSmooth ? ta.wma(avgBullRaw, preSmoothLen).toArray() : avgBullRaw.toArray();
  const avgBearsArr = preSmooth ? ta.wma(avgBearRaw, preSmoothLen).toArray() : avgBearRaw.toArray();

  // Net = avgBulls - avgBears, then WMA smooth
  const netArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const ab = avgBullsArr[i];
    const abear = avgBearsArr[i];
    const abVal = (ab != null && !isNaN(ab)) ? ab : 0;
    const abearVal = (abear != null && !isNaN(abear)) ? abear : 0;
    netArr[i] = abVal - abearVal;
  }

  const netSeries = Series.fromArray(bars, netArr);
  const tpxArr = ta.wma(netSeries, smooth).toArray();

  const warmup = length + smooth;

  const plot0 = avgBullsArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null || isNaN(v)) ? NaN : v,
  }));

  const plot1 = avgBearsArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null || isNaN(v)) ? NaN : v,
  }));

  // Pine: TPX colored by direction: TPX > 0 ? white : gray
  const plot2 = tpxArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null || isNaN(v)) ? NaN : v,
    color: (v != null && !isNaN(v) && v > 0) ? '#ffffff' : '#808080',
  }));

  // Pine: plot(maxbears and slevel_on ? slevel : na, 'Cold', style=circles, color=maroon, linewidth=3)
  // Pine: plot(maxbulls and slevel_on ? slevel : na, 'Hot', style=cross, color=green, linewidth=3)
  const plot3 = bars.map((b, i) => {
    if (!slevelOn || i < warmup) return { time: b.time, value: NaN };
    const avgBear = avgBearsArr[i];
    const maxbears = avgBear != null && !isNaN(avgBear) && avgBear >= controlLevel;
    return { time: b.time, value: maxbears ? slevel : NaN };
  });

  const plot4 = bars.map((b, i) => {
    if (!slevelOn || i < warmup) return { time: b.time, value: NaN };
    const avgBull = avgBullsArr[i];
    const maxbulls = avgBull != null && !isNaN(avgBull) && avgBull >= controlLevel;
    return { time: b.time, value: maxbulls ? slevel : NaN };
  });

  // Markers for TPX swing (crosses 0 line)
  const markers: MarkerData[] = [];
  for (let i = 1; i < n; i++) {
    if (i < warmup) continue;
    const curr = tpxArr[i];
    const prev = tpxArr[i - 1];
    if (curr == null || prev == null || isNaN(curr) || isNaN(prev)) continue;
    if (prev <= 0 && curr > 0) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#33ff00', text: 'Swing' });
    } else if (prev >= 0 && curr < 0) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#ff1111', text: 'Swing' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3, 'plot4': plot4 },
    hlines: [
      { value: 0, options: { color: '#ffee00', linestyle: 'solid' as const, title: 'Zero' } },
      { value: controlLevel, options: { color: '#ffee00', linestyle: 'dotted' as const, title: 'Control Level' } },
    ],
    markers,
  };
}

export const RedKTPX = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
