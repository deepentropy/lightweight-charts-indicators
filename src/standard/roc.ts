/**
 * Rate of Change (ROC) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Measures the percentage change in price over a specified period.
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ROCInputs {
  length: number;
  src: SourceType;
}

export const defaultInputs: ROCInputs = {
  length: 9,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 9, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ROC', color: '#2962FF', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, color: '#787B86', linestyle: 'solid', title: 'Zero Line' },
];

export const metadata = {
  title: 'Rate Of Change',
  shortTitle: 'ROC',
  overlay: false,
};

type Point = { time: number; value: number };

interface RocRun extends BarRunState<Record<string, never>> {
  m: { step(v: number): number; commit(): void };
  plotData: Point[];
}

function study(inputs: Partial<ROCInputs>): BarStudy<RocRun, IndicatorResult> {
  const { length, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const m = taStep.roc(length);
      const s: RocRun = { m, plotData: [], steps: [m], vars: {}, lists: [], series: [] };
      s.series = [s.plotData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      s.plotData[i] = { time: b.time as number, value: s.m.step(value(b)) ?? NaN };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plotData.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ROCInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ROCInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const ROC = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig };
