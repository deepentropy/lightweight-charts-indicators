/**
 * Fibonacci Zone
 *
 * Fibonacci zones as bands. Plots the golden zone (38.2%-61.8%) boundaries
 * and the 50% midline based on highest high and lowest low.
 *
 * Reference: "Fibonacci Zone" (community)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface FibonacciZoneInputs {
  length: number;
}

export const defaultInputs: FibonacciZoneInputs = {
  length: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 50, min: 2 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'High Border', color: '#00FFFF', lineWidth: 1 },
  { id: 'plot1', title: '76.4%', color: '#00FFFF', lineWidth: 1 },
  { id: 'plot2', title: '61.8%', color: '#787B86', lineWidth: 1 },
  { id: 'plot3', title: '38.2%', color: '#787B86', lineWidth: 1 },
  { id: 'plot4', title: '23.6%', color: '#FF9800', lineWidth: 1 },
  { id: 'plot5', title: 'Low Border', color: '#FF9800', lineWidth: 1 },
];

export const metadata = {
  title: 'Fibonacci Zone',
  shortTitle: 'FibZone',
  overlay: true,
};

type Point = { time: number; value: number };

interface FibZoneRun extends BarRunState<Record<string, never>> {
  highest: WindowExtreme;
  lowest: WindowExtreme;
  plots: Point[][];
}

function study(inputs: Partial<FibonacciZoneInputs>): BarStudy<FibZoneRun, IndicatorResult> {
  const { length } = { ...defaultInputs, ...inputs };
  const warmup = length;
  return {
    init() {
      const highest = new WindowExtreme(false, length);
      const lowest = new WindowExtreme(true, length);
      const s: FibZoneRun = { highest, lowest, plots: [[], [], [], [], [], []], steps: [highest, lowest], vars: {}, lists: [], series: [] };
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time;
      const hh = s.highest.step(bars[i].high);
      const lo = s.lowest.step(bars[i].low);
      const [plot0, plot1, plot2, plot3, plot4, plot5] = s.plots;
      if (i < warmup || isNaN(hh) || isNaN(lo)) {
        plot0[i] = { time, value: NaN };
        plot1[i] = { time, value: NaN };
        plot2[i] = { time, value: NaN };
        plot3[i] = { time, value: NaN };
        plot4[i] = { time, value: NaN };
        plot5[i] = { time, value: NaN };
      } else {
        const hl = hh;                  // High Border
        const ll = lo;                  // Low Border
        const dist = hl - ll;
        const hf = hl - dist * 0.236;   // 76.4% (Highest Fibonacci)
        const cfh = hl - dist * 0.382;  // 61.8% (Center High Fibonacci)
        const cfl = hl - dist * 0.618;  // 38.2% (Center Low Fibonacci)
        const lf = hl - dist * 0.764;   // 23.6% (Lowest Fibonacci)
        plot0[i] = { time, value: hl };
        plot1[i] = { time, value: hf };
        plot2[i] = { time, value: cfh };
        plot3[i] = { time, value: cfl };
        plot4[i] = { time, value: lf };
        plot5[i] = { time, value: ll };
      }
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': p[0].slice(), 'plot1': p[1].slice(), 'plot2': p[2].slice(), 'plot3': p[3].slice(), 'plot4': p[4].slice(), 'plot5': p[5].slice() },
        fills: [
          { plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(0,255,255,0.15)' } },
          { plot1: 'plot2', plot2: 'plot3', options: { color: 'rgba(128,128,128,0.15)' } },
          { plot1: 'plot4', plot2: 'plot5', options: { color: 'rgba(255,152,0,0.15)' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FibonacciZoneInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<FibonacciZoneInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const FibonacciZone = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
