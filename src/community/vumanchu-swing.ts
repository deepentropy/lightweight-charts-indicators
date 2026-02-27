/**
 * VuManChu Swing Free
 *
 * Range filter-based momentum indicator with buy/sell signals.
 * Uses EMA-based smoothing for range size calculation and a
 * ratcheting filter that tracks price movement.
 *
 * Reference: TradingView "Range Filter - B&S Signals" (VuManChu Swing Free)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';

export interface VuManChuSwingInputs {
  swingPeriod: number;
  swingMultiplier: number;
  useBarColor: boolean;
}

export const defaultInputs: VuManChuSwingInputs = {
  swingPeriod: 20,
  swingMultiplier: 3.5,
  useBarColor: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'swingPeriod', type: 'int', title: 'Swing Period', defval: 20, min: 1 },
  { id: 'swingMultiplier', type: 'float', title: 'Swing Multiplier', defval: 3.5, min: 0.0000001, step: 0.5 },
  { id: 'useBarColor', type: 'bool', title: 'Bar Colors On/Off', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Filter', color: '#2962FF', lineWidth: 3 },
  { id: 'plot1', title: 'High Band', color: 'transparent', lineWidth: 1 },
  { id: 'plot2', title: 'Low Band', color: 'transparent', lineWidth: 1 },
];

export const metadata = {
  title: 'VuManChu Swing Free',
  shortTitle: 'VMC Swing',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<VuManChuSwingInputs> = {}): IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[] } {
  const { swingPeriod, swingMultiplier, useBarColor } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeSeries = new Series(bars, (b) => b.close);
  const closeArr = closeSeries.toArray();

  // Range Size: AC = ema(ema(|close - close[1]|, n), wper) * qty
  // wper = n*2 - 1
  const absChange: number[] = new Array(n);
  absChange[0] = 0;
  for (let i = 1; i < n; i++) {
    absChange[i] = Math.abs((closeArr[i] ?? 0) - (closeArr[i - 1] ?? 0));
  }
  const absChangeSeries = Series.fromArray(bars, absChange);
  const avrng = ta.ema(absChangeSeries, swingPeriod);
  const wper = swingPeriod * 2 - 1;
  const acArr = ta.ema(avrng, wper).toArray().map((v) => ((v ?? 0) * swingMultiplier));

  // Range Filter
  const filt: number[] = new Array(n);
  const hBand: number[] = new Array(n);
  const lBand: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const src = closeArr[i] ?? 0;
    const r = acArr[i] ?? 0;

    if (i === 0) {
      filt[i] = src;
    } else {
      const prevFilt = filt[i - 1];
      if (src - r > prevFilt) {
        filt[i] = src - r;
      } else if (src + r < prevFilt) {
        filt[i] = src + r;
      } else {
        filt[i] = prevFilt;
      }
    }

    hBand[i] = filt[i] + (acArr[i] ?? 0);
    lBand[i] = filt[i] - (acArr[i] ?? 0);
  }

  // Direction
  const fdir: number[] = new Array(n);
  fdir[0] = 0;
  for (let i = 1; i < n; i++) {
    fdir[i] = filt[i] > filt[i - 1] ? 1 : filt[i] < filt[i - 1] ? -1 : fdir[i - 1];
  }

  // Trading conditions
  const warmup = swingPeriod * 2;
  let condIni = 0;
  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];

  for (let i = 0; i < n; i++) {
    const src = closeArr[i] ?? 0;
    const prevSrc = i > 0 ? (closeArr[i - 1] ?? 0) : src;
    const upward = fdir[i] === 1;
    const downward = fdir[i] === -1;

    // longCond = src > filt and (src > src[1] or src < src[1]) and upward
    const longCond = src > filt[i] && upward;
    // shortCond = src < filt and (src < src[1] or src > src[1]) and downward
    const shortCond = src < filt[i] && downward;

    const prevCondIni = condIni;
    if (longCond) condIni = 1;
    else if (shortCond) condIni = -1;

    if (i >= warmup) {
      if (longCond && prevCondIni === -1) {
        markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#008000', text: 'BUY' });
      }
      if (shortCond && prevCondIni === 1) {
        markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#FF0000', text: 'SELL' });
      }
    }

    // Bar colors
    if (useBarColor && i >= warmup) {
      let color: string;
      if (upward && src > filt[i]) {
        color = src > prevSrc ? '#05ff9b' : '#00b36b';
      } else if (downward && src < filt[i]) {
        color = src < prevSrc ? '#ff0583' : '#b8005d';
      } else {
        color = '#cccccc';
      }
      barColors.push({ time: bars[i].time, color });
    }
  }

  // Filter plot with dynamic color
  const plot0 = filt.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const color = fdir[i] === 1 ? '#05ff9b' : fdir[i] === -1 ? '#ff0583' : '#cccccc';
    return { time: bars[i].time, value: v, color };
  });

  const plot1 = hBand.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
  }));

  const plot2 = lBand.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2 },
    fills: [
      { plot1: 'plot1', plot2: 'plot0', options: { color: 'rgba(0,179,107,0.08)' } },
      { plot1: 'plot2', plot2: 'plot0', options: { color: 'rgba(184,0,93,0.08)' } },
    ],
    markers,
    barColors,
  };
}

export const VuManChuSwing = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
