/**
 * Lucid SAR
 *
 * Enhanced Parabolic SAR with visual improvements.
 * Plots SAR as two separate circle series: one for bullish (SAR below price),
 * one for bearish (SAR above price), providing clear trend direction coloring.
 *
 * Reference: TradingView "Lucid SAR" (TV#388)
 */

import { ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface LucidSarInputs {
  start: number;
  inc: number;
  max: number;
}

export const defaultInputs: LucidSarInputs = {
  start: 0.02,
  inc: 0.02,
  max: 0.2,
};

export const inputConfig: InputConfig[] = [
  { id: 'start', type: 'float', title: 'Start', defval: 0.02, min: 0.001, step: 0.01 },
  { id: 'inc', type: 'float', title: 'Increment', defval: 0.02, min: 0.001, step: 0.01 },
  { id: 'max', type: 'float', title: 'Max', defval: 0.2, min: 0.01, step: 0.01 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SAR Up', color: '#26A69A', lineWidth: 2, style: 'circles' },
  { id: 'plot1', title: 'SAR Down', color: '#EF5350', lineWidth: 2, style: 'circles' },
];

export const metadata = {
  title: 'Lucid SAR',
  shortTitle: 'LSAR',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<LucidSarInputs> = {}): IndicatorResult {
  const { start, inc, max } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // Manual SAR computation
  const sarArr: number[] = new Array(n);
  const sarDirArr: number[] = new Array(n);
  let af = start;
  let ep = bars[0].high;
  sarArr[0] = bars[0].low;
  sarDirArr[0] = 1;

  for (let i = 1; i < n; i++) {
    const prevDir = sarDirArr[i - 1];
    let sar = sarArr[i - 1] + af * (ep - sarArr[i - 1]);

    if (prevDir === 1) {
      sar = Math.min(sar, bars[i - 1].low);
      if (i >= 2) sar = Math.min(sar, bars[i - 2].low);
      if (bars[i].low < sar) {
        sarDirArr[i] = -1;
        sar = ep;
        ep = bars[i].low;
        af = start;
      } else {
        sarDirArr[i] = 1;
        if (bars[i].high > ep) {
          ep = bars[i].high;
          af = Math.min(af + inc, max);
        }
      }
    } else {
      sar = Math.max(sar, bars[i - 1].high);
      if (i >= 2) sar = Math.max(sar, bars[i - 2].high);
      if (bars[i].high > sar) {
        sarDirArr[i] = 1;
        sar = ep;
        ep = bars[i].high;
        af = start;
      } else {
        sarDirArr[i] = -1;
        if (bars[i].low < ep) {
          ep = bars[i].low;
          af = Math.min(af + inc, max);
        }
      }
    }
    sarArr[i] = sar;
  }

  // Split into up (bullish) and down (bearish) series
  const plot0 = sarArr.map((v, i) => ({
    time: bars[i].time,
    value: i < 1 ? NaN : (sarDirArr[i] === 1 ? v : NaN),
  }));

  const plot1 = sarArr.map((v, i) => ({
    time: bars[i].time,
    value: i < 1 ? NaN : (sarDirArr[i] === -1 ? v : NaN),
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
  };
}

export const LucidSar = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
