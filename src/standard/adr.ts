/**
 * Average Day Range (ADR) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Calculates the average of the daily price range (high - low) over a specified period.
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/**
 * ADR indicator input parameters
 */
export interface ADRInputs {
  /** Period length for averaging */
  lengthInput: number;
}

/**
 * Default input values
 */
export const defaultInputs: ADRInputs = {
  lengthInput: 14,
};

/**
 * Input configuration for UI
 */
export const inputConfig: InputConfig[] = [
  { id: 'lengthInput', type: 'int', title: 'Length', defval: 14 },
];

/**
 * Plot configuration
 */
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ADR', color: '#2962FF', lineWidth: 1 },
];

/**
 * Indicator metadata
 */
export const metadata = {
  title: 'Average Day Range',
  shortTitle: 'ADR',
  overlay: false,
};

/**
 * Calculate ADR indicator
 *
 * @param bars - OHLCV bar data
 * @param inputs - Indicator parameters (optional, uses defaults)
 * @returns Indicator result with plot data
 */
type Point = { time: number; value: number };

interface AdrRun extends BarRunState<Record<string, never>> {
  adr: WindowSma;
  plotData: Point[];
}

function study(inputs: Partial<ADRInputs>): BarStudy<AdrRun, IndicatorResult> {
  const { lengthInput } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const adr = new WindowSma(lengthInput);
      const s: AdrRun = { adr, plotData: [], steps: [adr], vars: {}, lists: [], series: [] };
      s.series = [s.plotData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // Calculate ADR: SMA of (high - low)
      s.plotData[i] = { time: b.time as number, value: s.adr.step(b.high - b.low) };
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
export function createRun(inputs: Partial<ADRInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ADRInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

/**
 * ADR indicator module
 */
export const ADR = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
