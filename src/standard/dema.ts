/**
 * Double Exponential Moving Average (DEMA) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Reduces lag by applying EMA twice: DEMA = 2*EMA - EMA(EMA)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DEMAInputs {
  length: number;
  src: SourceType;
}

export const defaultInputs: DEMAInputs = {
  length: 9,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 9, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'DEMA', color: '#43A047', lineWidth: 1 },
];

export const metadata = {
  title: 'Double EMA',
  shortTitle: 'DEMA',
  overlay: true,
};

type Point = { time: number; value: number };

interface DemaRun extends BarRunState<Record<string, never>> {
  ema1: ReturnType<typeof taStep.ema>;
  ema2: ReturnType<typeof taStep.ema>;
  plotData: Point[];
}

function study(inputs: Partial<DEMAInputs>): BarStudy<DemaRun, IndicatorResult> {
  const { length, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const ema1 = taStep.ema(length);
      const ema2 = taStep.ema(length);
      const s: DemaRun = { ema1, ema2, plotData: [], steps: [ema1, ema2], vars: {}, lists: [], series: [] };
      s.series = [s.plotData];
      return s;
    },
    bar(s, i, bars) {
      // DEMA = 2 * EMA - EMA(EMA)
      const e1 = s.ema1.step(value(bars[i]));
      const e2 = s.ema2.step(e1);
      s.plotData[i] = { time: bars[i].time, value: e1 * 2 - e2 };
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
export function createRun(inputs: Partial<DEMAInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DEMAInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const DEMA = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
