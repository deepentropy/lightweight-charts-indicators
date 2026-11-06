/**
 * CM Stochastic POP Method 1
 *
 * Stochastic POP: When stochastic is between 40-60, then pops above 60 = buy, below 40 = sell.
 *
 * Reference: "CM_Stochastic POP Method 1" by ChrisMoody
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface StochPOP1Inputs {
  kLen: number;
  kSmooth: number;
  ul: number;
  ll: number;
}

export const defaultInputs: StochPOP1Inputs = {
  kLen: 14,
  kSmooth: 5,
  ul: 60,
  ll: 30,
};

export const inputConfig: InputConfig[] = [
  { id: 'kLen', type: 'int', title: 'Stochastic Length', defval: 14, min: 1 },
  { id: 'kSmooth', type: 'int', title: 'Smooth K', defval: 5, min: 1 },
  { id: 'ul', type: 'int', title: 'Buy Entry/Exit Line', defval: 60, min: 50 },
  { id: 'll', type: 'int', title: 'Sell Entry/Exit Line', defval: 30, max: 50 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Stochastic', color: '#2962FF', lineWidth: 4 },
  { id: 'upperLine', title: 'Upper Line', color: '#00E676', lineWidth: 4 },
  { id: 'line100', title: '100 Line', color: '#FFFFFF', lineWidth: 1 },
  { id: 'lowerLine', title: 'Lower Line', color: '#FF0000', lineWidth: 4 },
  { id: 'line0', title: '0 Line', color: '#FFFFFF', lineWidth: 1 },
];

export const metadata = {
  title: 'CM Stochastic POP Method 1',
  shortTitle: 'StochPOP1',
  overlay: false,
};

type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] };
type Point = { time: number; value: number; color?: string };

interface StochPop1Run extends BarRunState<Record<string, never>> {
  stoch: ReturnType<typeof taStep.stoch>;
  sma: WindowSma;
  plots: Point[][];
  barColors: BarColorData[];
}

function study(inputs: Partial<StochPOP1Inputs>): BarStudy<StochPop1Run, Result> {
  const { kLen, kSmooth, ul, ll } = { ...defaultInputs, ...inputs };
  const warmup = kLen + kSmooth;
  return {
    init() {
      const s: StochPop1Run = {
        stoch: taStep.stoch(kLen), sma: new WindowSma(kSmooth), plots: [[], [], [], [], []], barColors: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.stoch, s.sma];
      s.lists = [s.barColors];
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const rawK = s.stoch.step(b.close, b.high, b.low);
      const v = s.sma.step(rawK);
      const p = s.plots;
      // Stochastic line with per-bar color: green >= ul, red <= ll, blue otherwise
      if (i < warmup) p[0][i] = { time, value: NaN };
      else p[0][i] = { time, value: v, color: v >= ul ? '#00E676' : v <= ll ? '#FF0000' : '#2962FF' };
      // Zone boundary plots
      p[1][i] = { time, value: ul };
      p[2][i] = { time, value: 100 };
      p[3][i] = { time, value: ll };
      p[4][i] = { time, value: 0 };
      // Barcolor: green when k >= ul (Long), red when k <= ll (Short), blue otherwise (NoTrade)
      if (i >= warmup) {
        if (v >= ul) s.barColors.push({ time, color: '#00E676' });
        else if (v <= ll) s.barColors.push({ time, color: '#FF0000' });
        else s.barColors.push({ time, color: '#2962FF' });
      }
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': p[0].slice(), 'upperLine': p[1].slice(), 'line100': p[2].slice(), 'lowerLine': p[3].slice(), 'line0': p[4].slice() },
        fills: [
          { plot1: 'upperLine', plot2: 'line100', options: { color: 'rgba(0,230,118,0.1)' } },
          { plot1: 'upperLine', plot2: 'lowerLine', options: { color: 'rgba(41,98,255,0.1)' } },
          { plot1: 'lowerLine', plot2: 'line0', options: { color: 'rgba(255,0,0,0.1)' } },
        ],
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<StochPOP1Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<StochPOP1Inputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const StochPOP1 = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
