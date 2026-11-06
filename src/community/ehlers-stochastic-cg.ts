/**
 * Ehlers Stochastic Center of Gravity Oscillator
 *
 * Center of Gravity of price over a window, then stochastic normalization.
 * CG = -SUM(j*close[j], length) / SUM(close[j], length) + (length+1)/2
 * Then stochastic of CG, with a 1-bar lagged trigger.
 *
 * Reference: "Ehlers Stochastic CG Oscillator [LazyBear]"
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

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

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] };

interface CgRun extends BarRunState<Record<string, never>> {
  cg: number[];
  rawK: number[];
  plot0: Point[];
  plot1: Point[];
  negColors: string[];
  posColors: string[];
  barColors: BarColorData[];
}

function study(inputs: Partial<EhlersStochasticCGInputs>): BarStudy<CgRun, Result> {
  const { length } = { ...defaultInputs, ...inputs };
  const warmup = length * 2;
  return {
    init() {
      const s: CgRun = {
        cg: [], rawK: [], plot0: [], plot1: [], negColors: [], posColors: [], barColors: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.lists = [s.barColors];
      s.series = [s.cg, s.rawK, s.plot0, s.plot1, s.negColors, s.posColors];
      return s;
    },
    bar(s, i, bars) {
      const { cg, rawK } = s;
      // Compute Center of Gravity
      let num = 0;
      let den = 0;
      for (let j = 0; j < length; j++) {
        const idx = i - j;
        if (idx < 0) break;
        num += (j + 1) * bars[idx].close;
        den += bars[idx].close;
      }
      cg[i] = den !== 0 ? -num / den + (length + 1) / 2 : 0;

      // Stochastic of CG over length
      let maxCg = -Infinity;
      let minCg = Infinity;
      for (let j = 0; j < length; j++) {
        const idx = i - j;
        if (idx < 0) break;
        if (cg[idx] > maxCg) maxCg = cg[idx];
        if (cg[idx] < minCg) minCg = cg[idx];
      }
      rawK[i] = maxCg !== minCg ? (cg[i] - minCg) / (maxCg - minCg) : 0;

      // Trigger = 0.96 * (rawK[i-1] + 0.02)
      const trigger = i > 0 ? 0.96 * (rawK[i - 1] + 0.02) : 0;
      const time = bars[i].time;
      s.plot0[i] = { time, value: i < warmup ? NaN : trigger };
      s.plot1[i] = { time, value: i < warmup ? NaN : rawK[i] };

      // Pine barcolor: v2>v2[1] ? (v2>0?lime:green) : v2<v2[1] ? (v2>0?orange:red) : (v2>0.8?lime:v2<-0.8?red:gray)
      if (i >= warmup) {
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
        s.barColors.push({ time, color });
      }

      // The original: duml = plot(max(v2, t)) (hidden helper), fill(cmil, duml, red, title="NegativeFill") and
      // fill(tl, duml, lime, title="PositiveFill"): the red area shows where CG is below Trigger, the green one where
      // CG is above it. The port draws both between CG and Trigger, each on the bars of its side.
      const above = i >= warmup && rawK[i] >= trigger;
      const below = i >= warmup && rawK[i] < trigger;
      s.negColors[i] = below ? 'rgba(239,83,80,0.15)' : 'transparent';
      s.posColors[i] = above ? 'rgba(0,230,118,0.15)' : 'transparent';
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice() },
        hlines: [
          { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } },
          { value: 0.8, options: { color: '#787B86', linestyle: 'dotted' as const, title: 'OB Level' } },
          { value: -0.8, options: { color: '#787B86', linestyle: 'dotted' as const, title: 'OS Level' } },
        ],
        fills: [
          { plot1: 'plot1', plot2: 'plot0', options: { title: 'NegativeFill', color: 'rgba(239, 83, 80, 0.15)' }, colors: s.negColors.slice() },
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'PositiveFill', color: 'rgba(0, 230, 118, 0.15)' }, colors: s.posColors.slice() },
        ],
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EhlersStochasticCGInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<EhlersStochasticCGInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const EhlersStochasticCG = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
