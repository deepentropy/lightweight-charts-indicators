/**
 * Balance of Power (BOP) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Measures the strength of buyers vs sellers by comparing close-open to high-low range.
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/**
 * BOP indicator input parameters (none required)
 */
export interface BOPInputs {
  // BOP has no configurable inputs
}

/**
 * Default input values
 */
export const defaultInputs: BOPInputs = {};

/**
 * Input configuration for UI
 */
export const inputConfig: InputConfig[] = [];

/**
 * Plot configuration
 */
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'BOP', color: '#FF0000', lineWidth: 1 },
];

/**
 * Indicator metadata
 */
export const metadata = {
  title: 'Balance of Power',
  shortTitle: 'BOP',
  overlay: false,
};

type Point = { time: number; value: number };

interface BopRun extends BarRunState<Record<string, never>> {
  plotData: Point[];
}

function study(): BarStudy<BopRun, IndicatorResult> {
  return {
    init() {
      const s: BopRun = { plotData: [], steps: [], vars: {}, lists: [], series: [] };
      s.series = [s.plotData];
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i];
      // Calculate BOP: (close - open) / (high - low)
      const bop = (bar.close - bar.open) / (bar.high - bar.low);
      s.plotData[i] = { time: bar.time as number, value: bop ?? NaN };
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
export function createRun(_inputs: Partial<BOPInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(), chart);
}

/**
 * Calculate BOP indicator
 *
 * Formula: (close - open) / (high - low)
 *
 * @param bars - OHLCV bar data
 * @param inputs - Indicator parameters (optional, none for BOP)
 * @returns Indicator result with plot data
 */
export function calculate(bars: Bar[], _inputs: Partial<BOPInputs> = {}): IndicatorResult {
  return fullResult(createRun(_inputs).update(bars));
}

/**
 * BOP indicator module
 */
export const BOP = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
