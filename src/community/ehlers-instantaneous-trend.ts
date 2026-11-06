/**
 * Ehlers Instantaneous Trend
 *
 * John Ehlers' adaptive trend filter using a 2nd-order IIR filter.
 * IT[i] = (a - a²/4)*src + 0.5*a²*src[1] - (a - 0.75*a²)*src[2] + 2*(1-a)*IT[1] - (1-a)²*IT[2]
 * Lag = 2*IT - IT[2]
 *
 * Reference: "Ehlers Instantaneous Trend [LazyBear]"
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface EhlersInstantaneousTrendInputs {
  alpha: number;
  colorBars: boolean;
}

export const defaultInputs: EhlersInstantaneousTrendInputs = {
  alpha: 0.07,
  colorBars: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'alpha', type: 'float', title: 'Alpha', defval: 0.07, min: 0.01, max: 1.0, step: 0.01 },
  { id: 'colorBars', type: 'bool', title: 'Color Bars', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trigger', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'ITrend', color: '#EF5350', lineWidth: 1 },
];

export const metadata = {
  title: 'Ehlers Instantaneous Trend',
  shortTitle: 'EIT',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] };

interface EitRun extends BarRunState<Record<string, never>> {
  src: number[];
  it: number[];
  lagPlot: Point[];
  itPlot: Point[];
  upFill: string[];
  downFill: string[];
  barColors: BarColorData[];
}

function study(inputs: Partial<EhlersInstantaneousTrendInputs>): BarStudy<EitRun, Result> {
  const { alpha, colorBars } = { ...defaultInputs, ...inputs };
  const a = alpha;
  const warmup = 7;
  return {
    init() {
      const s: EitRun = {
        src: [], it: [], lagPlot: [], itPlot: [], upFill: [], downFill: [], barColors: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.lists = [s.barColors];
      s.series = [s.src, s.it, s.lagPlot, s.itPlot, s.upFill, s.downFill];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const srcArr = s.src;
      const it = s.it;
      srcArr[i] = (b.high + b.low) / 2;
      const s0 = srcArr[i] ?? 0;
      const s1 = i > 0 ? (srcArr[i - 1] ?? 0) : s0;
      const s2 = i > 1 ? (srcArr[i - 2] ?? 0) : s0;

      if (i < 7) {
        // Warmup: simple average
        it[i] = (s0 + 2 * s1 + s2) / 4;
      } else {
        it[i] = (a - (a * a / 4)) * s0
          + 0.5 * a * a * s1
          - (a - 0.75 * a * a) * s2
          + 2 * (1 - a) * it[i - 1]
          - (1 - a) * (1 - a) * it[i - 2];
      }

      const v = it[i];
      // The original's fills go from its hidden "Dummy" plot (the lower of trend and trigger) to the trigger ('UpTrend',
      // green) and to the trend ('DownTrend', red): one of them has a height on each bar. Here: two fills between the
      // trigger and the trend, each coloured on the bars where the original's has a height.
      if (i < warmup) {
        s.lagPlot[i] = { time: b.time, value: NaN };
        s.itPlot[i] = { time: b.time, value: NaN };
        s.upFill[i] = 'transparent';
        s.downFill[i] = 'transparent';
        return;
      }
      const lag = 2 * v - (i >= 2 ? it[i - 2] : v);
      const bullish = lag > v;
      const color = bullish ? '#26A69A' : '#EF5350';
      if (colorBars) s.barColors.push({ time: b.time as number, color });
      s.lagPlot[i] = { time: b.time, value: lag, color };
      s.itPlot[i] = { time: b.time, value: v, color };
      s.upFill[i] = bullish ? 'rgba(0,128,0,0.15)' : 'transparent';
      s.downFill[i] = !bullish ? 'rgba(255,0,0,0.15)' : 'transparent';
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.lagPlot.slice(), 'plot1': s.itPlot.slice() },
        fills: [
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'UpTrend', color: 'rgba(0,128,0,0.15)' }, colors: s.upFill.slice() },
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'DownTrend', color: 'rgba(255,0,0,0.15)' }, colors: s.downFill.slice() },
        ],
        barColors: s.barColors.slice(),
      } as Result;
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EhlersInstantaneousTrendInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<EhlersInstantaneousTrendInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars)) as unknown as IndicatorResult;
}

export const EhlersInstantaneousTrend = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
