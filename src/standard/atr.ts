/**
 * Average True Range (ATR) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Measures market volatility by calculating the average range between high and low prices.
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/**
 * ATR indicator input parameters
 */
export interface ATRInputs {
  /** Period length */
  length: number;
  /** Smoothing method */
  smoothing: 'RMA' | 'SMA' | 'EMA' | 'WMA';
}

/**
 * Default input values
 */
export const defaultInputs: ATRInputs = {
  length: 14,
  smoothing: 'RMA',
};

/**
 * Input configuration for UI
 */
export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
  { id: 'smoothing', type: 'string', title: 'Smoothing', defval: 'RMA', options: ['RMA', 'SMA', 'EMA', 'WMA'] },
];

/**
 * Plot configuration
 */
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ATR', color: '#B71C1C', lineWidth: 1 },
];

/**
 * Indicator metadata
 */
export const metadata = {
  title: 'Average True Range',
  shortTitle: 'ATR',
  overlay: false,
};

/**
 * Calculate ATR indicator bar by bar
 */
type Point = { time: number; value: number };
type Smoother = { step(v: number): number; commit(): void };

interface AtrRun extends BarRunState<Record<string, never>> {
  tr: ReturnType<typeof taStep.tr>;
  ma: Smoother;
  plotData: Point[];
}

function study(inputs: Partial<ATRInputs>): BarStudy<AtrRun, IndicatorResult> {
  const { length, smoothing } = { ...defaultInputs, ...inputs };
  const smoother = (): Smoother => {
    switch (smoothing) {
      case 'SMA': return new WindowSma(length);
      case 'EMA': return taStep.ema(length);
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, length), commit: () => m.commit() }; }
      case 'RMA':
      default: return taStep.rma(length);
    }
  };
  return {
    init() {
      // Calculate True Range
      const tr = taStep.tr(true);
      // Apply smoothing
      const ma = smoother();
      const s: AtrRun = { tr, ma, plotData: [], steps: [tr, ma], vars: {}, lists: [], series: [] };
      s.series = [s.plotData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const value = s.ma.step(s.tr.step(b.high, b.low, b.close));
      s.plotData[i] = { time: b.time as number, value: value ?? NaN };
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
export function createRun(inputs: Partial<ATRInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

/**
 * Calculate ATR indicator
 *
 * @param bars - OHLCV bar data
 * @param inputs - Indicator parameters (optional, uses defaults)
 * @returns Indicator result with plot data
 */
export function calculate(bars: Bar[], inputs: Partial<ATRInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

/**
 * ATR indicator module
 */
export const ATR = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
