/**
 * Lucid SAR
 *
 * Enhanced Parabolic SAR with visual improvements.
 * Plots SAR as two separate circle series: one for bullish (SAR below price),
 * one for bearish (SAR above price), providing clear trend direction coloring.
 *
 * Reference: "Lucid SAR"
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

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

type Point = { time: number; value: number };

interface LucidSarVars {
  af: number;
  ep: number;
}

interface LucidSarRun extends BarRunState<LucidSarVars> {
  sarArr: number[];
  sarDirArr: number[];
  plot0: Point[];
  plot1: Point[];
}

function study(inputs: Partial<LucidSarInputs>): BarStudy<LucidSarRun, IndicatorResult> {
  const { start, inc, max } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: LucidSarRun = {
        sarArr: [], sarDirArr: [], plot0: [], plot1: [], steps: [], vars: { af: start, ep: NaN }, lists: [], series: [],
      };
      s.series = [s.sarArr, s.sarDirArr, s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      // Manual SAR computation
      const v = s.vars;
      const sarArr = s.sarArr;
      const sarDirArr = s.sarDirArr;
      const time = bars[i].time;
      if (i === 0) {
        v.ep = bars[0].high;
        sarArr[0] = bars[0].low;
        sarDirArr[0] = 1;
        s.plot0[0] = { time, value: NaN };
        s.plot1[0] = { time, value: NaN };
        return;
      }
      let af = v.af;
      let ep = v.ep;
      const b = bars[i];
      const prevDir = sarDirArr[i - 1];
      const prevSar = sarArr[i - 1];
      let sar = prevSar + af * (ep - prevSar);

      if (prevDir === 1) {
        sar = Math.min(sar, bars[i - 1].low);
        if (i >= 2) sar = Math.min(sar, bars[i - 2].low);
        if (b.low < sar) {
          sarDirArr[i] = -1;
          sar = ep;
          ep = b.low;
          af = start;
        } else {
          sarDirArr[i] = 1;
          if (b.high > ep) {
            ep = b.high;
            af = Math.min(af + inc, max);
          }
        }
      } else {
        sar = Math.max(sar, bars[i - 1].high);
        if (i >= 2) sar = Math.max(sar, bars[i - 2].high);
        if (b.high > sar) {
          sarDirArr[i] = 1;
          sar = ep;
          ep = b.high;
          af = start;
        } else {
          sarDirArr[i] = -1;
          if (b.low < ep) {
            ep = b.low;
            af = Math.min(af + inc, max);
          }
        }
      }
      sarArr[i] = sar;
      v.af = af;
      v.ep = ep;

      // Split into up (bullish) and down (bearish) series
      s.plot0[i] = { time, value: sarDirArr[i] === 1 ? sar : NaN };
      s.plot1[i] = { time, value: sarDirArr[i] === -1 ? sar : NaN };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<LucidSarInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<LucidSarInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const LucidSar = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
