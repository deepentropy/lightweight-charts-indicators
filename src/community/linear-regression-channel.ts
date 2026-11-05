/**
 * Linear Regression Channel
 *
 * Separate linear regressions on high and low, plus deviation bands.
 * a = linreg(high, len)
 * b = linreg(low, len)
 * c = b - dev(low, len)   (lower band)
 * d = a + dev(high, len)  (upper band)
 * c and d colored by direction (green rising, red falling).
 *
 * Reference: "Linear Regression Channel" (LRC_SH)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface LinearRegressionChannelInputs {
  length: number;
}

export const defaultInputs: LinearRegressionChannelInputs = {
  length: 300,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 300, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'LinReg High', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'LinReg Low', color: '#2962FF', lineWidth: 1 },
  { id: 'plot2', title: 'Lower Band', color: '#26A69A', lineWidth: 1 },
  { id: 'plot3', title: 'Upper Band', color: '#26A69A', lineWidth: 1 },
];

export const metadata = {
  title: 'Linear Regression Channel',
  shortTitle: 'LRC',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };

/** ta.linreg(source, len, 0) on bar i of `src` (the values of every bar): the doubles of the oakscriptjs array function */
function linregAt(src: number[], i: number, len: number): number {
  if (i < len - 1) return NaN;
  for (let j = 0; j < len; j++) if (isNaN(src[i - j])) return NaN;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  for (let j = 0; j < len; j++) {
    const x = j + 1;
    const y = src[i - (len - 1 - j)];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }
  const slope = (len * sumXY - sumX * sumY) / (len * sumX2 - sumX * sumX);
  const intercept = sumY / len - (slope * sumX) / len + slope;
  return intercept + slope * (len - 1);
}

interface LrcRun extends BarRunState<Record<string, never>> {
  high: number[];
  low: number[];
  devHigh: ReturnType<typeof taStep.stdev>;
  devLow: ReturnType<typeof taStep.stdev>;
  aArr: number[];
  bArr: number[];
  devHighArr: number[];
  devLowArr: number[];
  plots: Point[][];
}

function study(inputs: Partial<LinearRegressionChannelInputs>): BarStudy<LrcRun, IndicatorResult> {
  const { length } = { ...defaultInputs, ...inputs };
  const len = Math.floor(length);
  const warmup = length;
  return {
    init() {
      const s: LrcRun = {
        high: [], low: [], devHigh: taStep.stdev(), devLow: taStep.stdev(),
        aArr: [], bArr: [], devHighArr: [], devLowArr: [], plots: [[], [], [], []],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.devHigh, s.devLow];
      s.series = [s.high, s.low, s.aArr, s.bArr, s.devHighArr, s.devLowArr, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i];
      const time = bar.time;
      // Pine: a = linreg(high, len, 0), b = linreg(low, len, 0)
      s.high[i] = bar.high;
      s.low[i] = bar.low;
      const av = linregAt(s.high, i, len);
      const bv = linregAt(s.low, i, len);
      // Pine: c = -dev(low, len) + b, d = dev(high, len) + a
      const dh = s.devHigh.step(bar.high, length);
      const dl = s.devLow.step(bar.low, length);
      s.aArr[i] = av;
      s.bArr[i] = bv;
      s.devHighArr[i] = dh;
      s.devLowArr[i] = dl;
      const p = s.plots;
      // Plot a = linreg(high)
      p[0][i] = i < warmup || isNaN(av) ? { time, value: NaN } : { time, value: av };
      // Plot b = linreg(low)
      p[1][i] = i < warmup || isNaN(bv) ? { time, value: NaN } : { time, value: bv };
      // Plot c = b - dev(low, len) -- lower band, colored by direction
      if (i < warmup || isNaN(bv) || isNaN(dl)) p[2][i] = { time, value: NaN };
      else {
        const val = bv - dl;
        let color = '#26A69A';
        if (i > warmup) color = val > s.bArr[i - 1] - s.devLowArr[i - 1] ? '#26A69A' : '#EF5350';
        p[2][i] = { time, value: val, color };
      }
      // Plot d = a + dev(high, len) -- upper band, colored by direction
      if (i < warmup || isNaN(av) || isNaN(dh)) p[3][i] = { time, value: NaN };
      else {
        const val = av + dh;
        let color = '#26A69A';
        if (i > warmup) color = val > s.aArr[i - 1] + s.devHighArr[i - 1] ? '#26A69A' : '#EF5350';
        p[3][i] = { time, value: val, color };
      }
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': p[0].slice(), 'plot1': p[1].slice(), 'plot2': p[2].slice(), 'plot3': p[3].slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<LinearRegressionChannelInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<LinearRegressionChannelInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const LinearRegressionChannel = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
