/**
 * Bollinger Bands Fibonacci Ratios
 *
 * SMA with 3 upper and 3 lower bands at Fibonacci ATR ratios.
 * Bands = SMA +/- ATR * fibRatio
 *
 * Reference: "Bollinger Bands Fibonacci Ratios" (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface BBFibonacciRatiosInputs {
  length: number;
  fibRatio1: number;
  fibRatio2: number;
  fibRatio3: number;
}

export const defaultInputs: BBFibonacciRatiosInputs = {
  length: 20,
  fibRatio1: 1.618,
  fibRatio2: 2.618,
  fibRatio3: 4.236,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
  { id: 'fibRatio1', type: 'float', title: 'Fib Ratio 1', defval: 1.618, min: 0.01, step: 0.001 },
  { id: 'fibRatio2', type: 'float', title: 'Fib Ratio 2', defval: 2.618, min: 0.01, step: 0.001 },
  { id: 'fibRatio3', type: 'float', title: 'Fib Ratio 3', defval: 4.236, min: 0.01, step: 0.001 },
];

export const plotConfig: PlotConfig[] = [
  // Pine uses style=cross for SMA; cross not supported, kept as line
  { id: 'plot0', title: 'Basis', color: '#FF6D00', lineWidth: 2 },
  { id: 'plot1', title: 'Upper 1', color: '#2962FF', lineWidth: 1 },
  { id: 'plot2', title: 'Lower 1', color: '#2962FF', lineWidth: 1 },
  { id: 'plot3', title: 'Upper 2', color: '#2962FF', lineWidth: 1 },
  { id: 'plot4', title: 'Lower 2', color: '#2962FF', lineWidth: 1 },
  { id: 'plot5', title: 'Upper 3', color: '#2962FF', lineWidth: 1 },
  { id: 'plot6', title: 'Lower 3', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'BB Fibonacci Ratios',
  shortTitle: 'BB Fib',
  overlay: true,
};

type Point = { time: number; value: number };

interface BbFibRun extends BarRunState<Record<string, never>> {
  sma: WindowSma;
  atr: ReturnType<typeof taStep.atr>;
  out: Point[][];
}

function study(inputs: Partial<BBFibonacciRatiosInputs>): BarStudy<BbFibRun, IndicatorResult> {
  const { length, fibRatio1, fibRatio2, fibRatio3 } = { ...defaultInputs, ...inputs };
  const warmup = length;
  return {
    init() {
      const sma = new WindowSma(length);
      const atr = taStep.atr(length);
      const out: Point[][] = [[], [], [], [], [], [], []];
      return { sma, atr, out, steps: [sma, atr], vars: {}, lists: [], series: out };
    },
    bar(s, i, bars) {
      const b = bars[i];
      const sm = s.sma.step(b.close);
      const a = s.atr.step(b.high, b.low, b.close);
      const na = i < warmup || sm == null || a == null;
      const o = s.out;
      o[0][i] = { time: b.time, value: na ? NaN : sm };
      o[1][i] = { time: b.time, value: na ? NaN : sm + a * fibRatio1 };
      o[2][i] = { time: b.time, value: na ? NaN : sm - a * fibRatio1 };
      o[3][i] = { time: b.time, value: na ? NaN : sm + a * fibRatio2 };
      o[4][i] = { time: b.time, value: na ? NaN : sm - a * fibRatio2 };
      o[5][i] = { time: b.time, value: na ? NaN : sm + a * fibRatio3 };
      o[6][i] = { time: b.time, value: na ? NaN : sm - a * fibRatio3 };
    },
    result(s) {
      const o = s.out;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          'plot0': o[0].slice(),
          'plot1': o[1].slice(),
          'plot2': o[2].slice(),
          'plot3': o[3].slice(),
          'plot4': o[4].slice(),
          'plot5': o[5].slice(),
          'plot6': o[6].slice(),
        },
        fills: [
          { plot1: 'plot5', plot2: 'plot6', options: { color: 'rgba(41,98,255,0.05)' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BBFibonacciRatiosInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BBFibonacciRatiosInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const BBFibonacciRatios = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
