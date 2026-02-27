/**
 * Ehlers Stochastic Center of Gravity Oscillator
 *
 * Center of Gravity of price over a window, then stochastic normalization.
 * CG = -SUM(j*close[j], length) / SUM(close[j], length) + (length+1)/2
 * Then stochastic of CG, with a 1-bar lagged trigger.
 *
 * Reference: TradingView "Ehlers Stochastic CG Oscillator [LazyBear]"
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface EhlersStochasticCGInputs {
  length: number;
}

export const defaultInputs: EhlersStochasticCGInputs = {
  length: 8,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 8, min: 2 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trigger', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'CG', color: '#EF5350', lineWidth: 1 },
];

export const metadata = {
  title: 'Ehlers Stochastic CG Oscillator',
  shortTitle: 'ESCG',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<EhlersStochasticCGInputs> = {}): IndicatorResult & { barColors: BarColorData[] } {
  const { length } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // Compute Center of Gravity
  const cg: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    let num = 0;
    let den = 0;
    for (let j = 0; j < length; j++) {
      const idx = i - j;
      if (idx < 0) break;
      num += (j + 1) * bars[idx].close;
      den += bars[idx].close;
    }
    cg[i] = den !== 0 ? -num / den + (length + 1) / 2 : 0;
  }

  // Stochastic of CG over length
  const rawK: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    let maxCg = -Infinity;
    let minCg = Infinity;
    for (let j = 0; j < length; j++) {
      const idx = i - j;
      if (idx < 0) break;
      if (cg[idx] > maxCg) maxCg = cg[idx];
      if (cg[idx] < minCg) minCg = cg[idx];
    }
    rawK[i] = maxCg !== minCg ? (cg[i] - minCg) / (maxCg - minCg) : 0;
  }

  // Trigger = 0.96 * (rawK[i-1] + 0.02)
  const trigger: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    trigger[i] = i > 0 ? 0.96 * (rawK[i - 1] + 0.02) : 0;
  }

  const warmup = length * 2;

  const plot0 = trigger.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
  }));

  const plot1 = rawK.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
  }));

  // Pine barcolor: v2>v2[1] ? (v2>0?lime:green) : v2<v2[1] ? (v2>0?orange:red) : (v2>0.8?lime:v2<-0.8?red:gray)
  const barColors: BarColorData[] = [];
  for (let i = warmup; i < n; i++) {
    const v2 = rawK[i];
    const v2prev = i > 0 ? rawK[i - 1] : v2;
    let color: string;
    if (v2 > v2prev) {
      color = v2 > 0 ? '#00E676' : '#26A69A';
    } else if (v2 < v2prev) {
      color = v2 > 0 ? '#FF9800' : '#EF5350';
    } else {
      color = v2 > 0.8 ? '#00E676' : v2 < -0.8 ? '#EF5350' : '#787B86';
    }
    barColors.push({ time: bars[i].time, color });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } },
      { value: 0.8, options: { color: '#787B86', linestyle: 'dotted' as const, title: 'OB Level' } },
      { value: -0.8, options: { color: '#787B86', linestyle: 'dotted' as const, title: 'OS Level' } },
    ],
    fills: [
      { plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(239, 83, 80, 0.15)' } },
    ],
    barColors,
  };
}

export const EhlersStochasticCG = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
