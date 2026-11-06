/**
 * TRIX Indicator
 *
 * Triple Exponential Average Rate of Change.
 * Shows the percent rate of change of a triple exponentially smoothed moving average.
 *
 * Based on the standard TRIX indicator.
 */

import { taStep, type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TRIXInputs {
  /** EMA period length */
  length: number;
}

export const defaultInputs: TRIXInputs = {
  length: 18,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 18, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'TRIX', color: '#F44336', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, color: '#787B86', linestyle: 'solid', title: 'Zero' },
];

export const metadata = {
  title: 'TRIX',
  shortTitle: 'TRIX',
  overlay: false,
};

/**
 * Calculate TRIX
 *
 * Algorithm:
 * 1. Take log of close prices
 * 2. Apply EMA three times
 * 3. Calculate rate of change (1-bar difference)
 * 4. Multiply by 10000 for readability
 */
type Point = { time: number; value: number };

interface TrixRun extends BarRunState<Record<string, never>> {
  ema1: ReturnType<typeof taStep.ema>;
  ema2: ReturnType<typeof taStep.ema>;
  ema3: ReturnType<typeof taStep.ema>;
  change: ReturnType<typeof taStep.change>;
  plotData: Point[];
}

function study(inputs: Partial<TRIXInputs>): BarStudy<TrixRun, IndicatorResult> {
  const { length } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const ema1 = taStep.ema(length);
      const ema2 = taStep.ema(length);
      const ema3 = taStep.ema(length);
      const change = taStep.change(1);
      const s: TrixRun = { ema1, ema2, ema3, change, plotData: [], steps: [ema1, ema2, ema3, change], vars: {}, lists: [], series: [] };
      s.series = [s.plotData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // Step 1: Take log of close prices
      const logClose = Math.log(b.close);
      // Step 2: Apply EMA three times
      const ema3 = s.ema3.step(s.ema2.step(s.ema1.step(logClose)));
      // Step 3: Calculate rate of change and multiply by 10000
      const value = s.change.step(ema3);
      s.plotData[i] = { time: b.time as number, value: value !== null ? value * 10000 : NaN };
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.plotData.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TRIXInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TRIXInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const TRIX = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
