/**
 * Triple Exponential Moving Average (TEMA) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Further reduces lag: TEMA = 3*EMA - 3*EMA(EMA) + EMA(EMA(EMA))
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TEMAInputs {
  length: number;
}

export const defaultInputs: TEMAInputs = {
  length: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 9, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'TEMA', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Triple EMA',
  shortTitle: 'TEMA',
  overlay: true,
};

type Point = { time: number; value: number };

interface TemaRun extends BarRunState<Record<string, never>> {
  ema1: ReturnType<typeof taStep.ema>;
  ema2: ReturnType<typeof taStep.ema>;
  ema3: ReturnType<typeof taStep.ema>;
  plotData: Point[];
}

function study(inputs: Partial<TEMAInputs>): BarStudy<TemaRun, IndicatorResult> {
  const { length } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const ema1 = taStep.ema(length);
      const ema2 = taStep.ema(length);
      const ema3 = taStep.ema(length);
      const s: TemaRun = { ema1, ema2, ema3, plotData: [], steps: [ema1, ema2, ema3], vars: {}, lists: [], series: [] };
      s.series = [s.plotData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // TEMA = 3*EMA - 3*EMA(EMA) + EMA(EMA(EMA))
      const e1 = s.ema1.step(b.close);
      const e2 = s.ema2.step(e1);
      const e3 = s.ema3.step(e2);
      s.plotData[i] = { time: b.time as number, value: e1 * 3 - e2 * 3 + e3 };
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
export function createRun(inputs: Partial<TEMAInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TEMAInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const TEMA = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
