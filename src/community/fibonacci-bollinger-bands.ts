/**
 * Fibonacci Bollinger Bands
 *
 * VWMA basis with 6 Fibonacci stdev bands (upper + lower).
 * Bands at 0.236, 0.382, 0.5, 0.618, 0.764, 1.0 * mult * stdev.
 *
 * Reference: "Fibonacci Bollinger Bands" by Rashad
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface FibonacciBollingerBandsInputs {
  length: number;
  mult: number;
}

export const defaultInputs: FibonacciBollingerBandsInputs = {
  length: 200,
  mult: 3.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 200, min: 1 },
  { id: 'mult', type: 'float', title: 'Multiplier', defval: 3.0, min: 0.1, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Basis', color: '#FF00FF', lineWidth: 2 },
  { id: 'plot1', title: 'Upper 1', color: '#787B86', lineWidth: 1 },
  { id: 'plot2', title: 'Lower 1', color: '#787B86', lineWidth: 1 },
  { id: 'plot3', title: 'Upper 2', color: '#787B86', lineWidth: 1 },
  { id: 'plot4', title: 'Lower 2', color: '#787B86', lineWidth: 1 },
  { id: 'plot5', title: 'Upper 3', color: '#787B86', lineWidth: 1 },
  { id: 'plot6', title: 'Lower 3', color: '#787B86', lineWidth: 1 },
  { id: 'plot7', title: 'Upper 4', color: '#787B86', lineWidth: 1 },
  { id: 'plot8', title: 'Lower 4', color: '#787B86', lineWidth: 1 },
  { id: 'plot9', title: 'Upper 5', color: '#787B86', lineWidth: 1 },
  { id: 'plot10', title: 'Lower 5', color: '#787B86', lineWidth: 1 },
  { id: 'plot11', title: 'Upper 6', color: '#EF5350', lineWidth: 2 },
  { id: 'plot12', title: 'Lower 6', color: '#26A69A', lineWidth: 2 },
];

export const metadata = {
  title: 'Fibonacci Bollinger Bands',
  shortTitle: 'FBB',
  overlay: true,
};

type Point = { time: number; value: number };

interface FbbRun extends BarRunState<Record<string, never>> {
  smaVol: WindowSma;
  smaSrcVol: WindowSma;
  dev: WindowStdev;
  plots: Point[][];
}

const fibs = [0.236, 0.382, 0.5, 0.618, 0.764, 1.0];

function study(inputs: Partial<FibonacciBollingerBandsInputs>): BarStudy<FbbRun, IndicatorResult> {
  const { length, mult } = { ...defaultInputs, ...inputs };
  const src = barSource('hlc3');
  const warmup = length;
  return {
    init() {
      const s: FbbRun = {
        smaVol: new WindowSma(length), smaSrcVol: new WindowSma(length), dev: new WindowStdev(length),
        plots: Array.from({ length: 13 }, () => []), steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.smaVol, s.smaSrcVol, s.dev];
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i]!;
      const time = bar.time as number;
      const v = src(bar);
      const vol = bar.volume ?? 1;
      // VWMA = SMA(src * volume, length) / SMA(volume, length)
      const smaVol = s.smaVol.step(vol);
      const basis = s.smaSrcVol.step(v * vol) / smaVol;
      const d = s.dev.step(v);
      const na = i < warmup;
      s.plots[0]![i] = { time, value: na ? NaN : basis };
      fibs.forEach((f, idx) => {
        s.plots[1 + idx * 2]![i] = { time, value: na ? NaN : basis + f * mult * d };
        s.plots[2 + idx * 2]![i] = { time, value: na ? NaN : basis - f * mult * d };
      });
    },
    result(s) {
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FibonacciBollingerBandsInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<FibonacciBollingerBandsInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const FibonacciBollingerBands = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
