/**
 * Awesome Oscillator V2
 *
 * AO with signal line.
 * AO = SMA(hl2, fast) - SMA(hl2, slow)
 * Signal = SMA(AO, signal)
 *
 * Reference: "Awesome Oscillator V2" (community)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AwesomeOscillatorV2Inputs {
  fastPeriod: number;
  slowPeriod: number;
  signalPeriod: number;
}

export const defaultInputs: AwesomeOscillatorV2Inputs = {
  fastPeriod: 5,
  slowPeriod: 34,
  signalPeriod: 7,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastPeriod', type: 'int', title: 'Fast Period', defval: 5, min: 1 },
  { id: 'slowPeriod', type: 'int', title: 'Slow Period', defval: 34, min: 1 },
  { id: 'signalPeriod', type: 'int', title: 'Signal Period', defval: 7, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'AO', color: '#EF5350', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#2962FF', lineWidth: 2 },
];

export const hlineConfig = [
  { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } },
];

export const metadata = {
  title: 'Awesome Oscillator V2',
  shortTitle: 'AOv2',
  overlay: false,
};

type Point = { time: number; value: number };

interface AoRun extends BarRunState<Record<string, never>> {
  fast: WindowSma;
  slow: WindowSma;
  sig: WindowSma;
  aoPlot: Point[];
  signalPlot: Point[];
}

function study(inputs: Partial<AwesomeOscillatorV2Inputs>): BarStudy<AoRun, IndicatorResult> {
  const { fastPeriod, slowPeriod, signalPeriod } = { ...defaultInputs, ...inputs };
  const warmup = slowPeriod;
  return {
    init() {
      const fast = new WindowSma(fastPeriod);
      const slow = new WindowSma(slowPeriod);
      const sig = new WindowSma(signalPeriod);
      const s: AoRun = { fast, slow, sig, aoPlot: [], signalPlot: [], steps: [fast, slow, sig], vars: {}, lists: [], series: [] };
      s.series = [s.aoPlot, s.signalPlot];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const hl2 = (b.high + b.low) / 2;
      const ao = s.fast.step(hl2) - s.slow.step(hl2);
      const signal = s.sig.step(ao);
      s.aoPlot[i] = { time: b.time, value: (i < warmup || ao == null) ? NaN : ao };
      s.signalPlot[i] = { time: b.time, value: (i < warmup + signalPeriod - 1 || signal == null) ? NaN : signal };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.aoPlot.slice(), 'plot1': s.signalPlot.slice() },
        hlines: hlineConfig.map(h => ({ value: h.value, options: h.options })),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AwesomeOscillatorV2Inputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AwesomeOscillatorV2Inputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const AwesomeOscillatorV2 = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
