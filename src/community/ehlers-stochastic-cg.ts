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

export function calculate(bars: Bar[], inputs: Partial<EhlersStochasticCGInputs> = {}): IndicatorResult {
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

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } },
    ],
  };
}

export const EhlersStochasticCG = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
