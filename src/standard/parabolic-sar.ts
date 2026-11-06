/**
 * Parabolic SAR Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * A trend-following indicator that provides potential entry and exit points.
 * SAR stands for "Stop and Reverse".
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/**
 * Parabolic SAR indicator input parameters
 */
export interface ParabolicSARInputs {
  /** Acceleration Factor start value */
  start: number;
  /** Acceleration Factor increment */
  increment: number;
  /** Acceleration Factor maximum */
  maximum: number;
}

/**
 * Default input values matching the standard indicator defaults
 */
export const defaultInputs: ParabolicSARInputs = {
  start: 0.02,
  increment: 0.02,
  maximum: 0.2,
};

/**
 * Input configuration for UI
 */
export const inputConfig: InputConfig[] = [
  { id: 'start', type: 'float', title: 'start', defval: 0.02 },
  { id: 'increment', type: 'float', title: 'increment', defval: 0.02 },
  { id: 'maximum', type: 'float', title: 'Max value', defval: 0.2 },
];

/**
 * Plot configuration - single output: ParabolicSAR
 */
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ParabolicSAR', color: '#2962FF', lineWidth: 1, style: 'cross' },
];

/**
 * Indicator metadata
 */
export const metadata = {
  title: 'Parabolic SAR',
  shortTitle: 'SAR',
  overlay: true,
};

/**
 * Calculate Parabolic SAR indicator
 *
 * @param bars - OHLCV bar data
 * @param inputs - Indicator parameters (optional, uses defaults)
 * @returns Indicator result with plot data
 */
export function calculate(bars: Bar[], inputs: Partial<ParabolicSARInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

/** The running state of ta.sar (the oakscriptjs function, one bar at a time: the same doubles) */
interface SarVars {
  sarValue: number;
  extremePoint: number;
  acceleration: number;
  isUpTrend: boolean;
}

interface SarRun extends BarRunState<SarVars> {
  sarData: { time: any; value: number }[];
}

function study(inputs: Partial<ParabolicSARInputs>): BarStudy<SarRun, IndicatorResult> {
  const { start, increment: inc, maximum: max } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: SarRun = {
        sarData: [], steps: [], lists: [], series: [],
        vars: { sarValue: NaN, extremePoint: NaN, acceleration: start, isUpTrend: false },
      };
      s.series = [s.sarData];
      return s;
    },
    bar(s, i, bars) {
      if (i === 0) {
        s.sarData[i] = { time: bars[i].time, value: NaN };
        return;
      }
      const v = s.vars;
      let isFirstTrendBar = false;
      if (i === 1) {
        if (bars[i].close > bars[i - 1].close) {
          v.isUpTrend = true;
          v.extremePoint = bars[i].high;
          v.sarValue = bars[i - 1].low;
        } else {
          v.isUpTrend = false;
          v.extremePoint = bars[i].low;
          v.sarValue = bars[i - 1].high;
        }
        isFirstTrendBar = true;
        v.acceleration = start;
      }

      v.sarValue = v.sarValue + v.acceleration * (v.extremePoint - v.sarValue);

      if (v.isUpTrend) {
        if (v.sarValue > bars[i].low) {
          isFirstTrendBar = true;
          v.isUpTrend = false;
          v.sarValue = Math.max(bars[i].high, v.extremePoint);
          v.extremePoint = bars[i].low;
          v.acceleration = start;
        }
      } else {
        if (v.sarValue < bars[i].high) {
          isFirstTrendBar = true;
          v.isUpTrend = true;
          v.sarValue = Math.min(bars[i].low, v.extremePoint);
          v.extremePoint = bars[i].high;
          v.acceleration = start;
        }
      }

      if (!isFirstTrendBar) {
        if (v.isUpTrend) {
          if (bars[i].high > v.extremePoint) {
            v.extremePoint = bars[i].high;
            v.acceleration = Math.min(v.acceleration + inc, max);
          }
        } else {
          if (bars[i].low < v.extremePoint) {
            v.extremePoint = bars[i].low;
            v.acceleration = Math.min(v.acceleration + inc, max);
          }
        }
      }

      if (v.isUpTrend) {
        v.sarValue = Math.min(v.sarValue, bars[i - 1].low);
        if (i > 1) {
          v.sarValue = Math.min(v.sarValue, bars[i - 2].low);
        }
      } else {
        v.sarValue = Math.max(v.sarValue, bars[i - 1].high);
        if (i > 1) {
          v.sarValue = Math.max(v.sarValue, bars[i - 2].high);
        }
      }

      // Convert to plot format
      s.sarData[i] = { time: bars[i].time, value: v.sarValue ?? NaN };
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.sarData.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ParabolicSARInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

/**
 * Parabolic SAR indicator module
 */
export const ParabolicSAR = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
