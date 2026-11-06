/**
 * Momentum Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Measures the rate of change of price over a specified period.
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MomentumInputs {
  length: number;
  src: SourceType;
}

export const defaultInputs: MomentumInputs = {
  length: 10,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 10, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Mom', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Momentum',
  shortTitle: 'Mom',
  overlay: false,
};

type Point = { time: number; value: number };

interface MomRun extends BarRunState<Record<string, never>> {
  m: { step(v: number): number; commit(): void };
  plotData: Point[];
}

function study(inputs: Partial<MomentumInputs>): BarStudy<MomRun, IndicatorResult> {
  const { length, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const m = taStep.mom(length);
      const s: MomRun = { m, plotData: [], steps: [m], vars: {}, lists: [], series: [] };
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
export function createRun(inputs: Partial<MomentumInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MomentumInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const Momentum = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
