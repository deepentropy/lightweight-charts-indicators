/**
 * Arnaud Legoux Moving Average (ALMA) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Uses a Gaussian distribution to reduce lag while maintaining smoothness.
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { AlmaStep, createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/**
 * ALMA indicator input parameters
 */
export interface ALMAInputs {
  /** Period length */
  lengthInput: number;
  /** Offset - controls tradeoff between smoothness (closer to 1) and responsiveness (closer to 0) */
  offsetInput: number;
  /** Sigma - standard deviation applied for sharpness */
  sigmaInput: number;
}

/**
 * Default input values
 */
export const defaultInputs: ALMAInputs = {
  lengthInput: 9,
  offsetInput: 0.85,
  sigmaInput: 6,
};

/**
 * Input configuration for UI
 */
export const inputConfig: InputConfig[] = [
  { id: 'lengthInput', type: 'int', title: 'Length', defval: 9, min: 1 },
  { id: 'offsetInput', type: 'float', title: 'Offset', defval: 0.85, step: 0.01, tooltip: 'Controls tradeoff between smoothness (closer to 1) and responsiveness (closer to 0).' },
  { id: 'sigmaInput', type: 'float', title: 'Sigma', defval: 6, tooltip: 'This element is a standard deviation that is applied to the combo line in order for it to appear more sharp.' },
];

/**
 * Plot configuration
 */
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ALMA', color: '#2962FF', lineWidth: 1 },
];

/**
 * Indicator metadata
 */
export const metadata = {
  title: 'Arnaud Legoux Moving Average',
  shortTitle: 'ALMA',
  overlay: true,
};

type Point = { time: number; value: number };

interface AlmaRun extends BarRunState<Record<string, never>> {
  alma: AlmaStep;
  plotData: Point[];
}

function study(inputs: Partial<ALMAInputs>): BarStudy<AlmaRun, IndicatorResult> {
  const { lengthInput, offsetInput, sigmaInput } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const alma = new AlmaStep(lengthInput, offsetInput, sigmaInput);
      const s: AlmaRun = { alma, plotData: [], steps: [alma], vars: {}, lists: [], series: [] };
      s.series = [s.plotData];
      return s;
    },
    bar(s, i, bars) {
      // ALMA of the close
      s.plotData[i] = { time: bars[i].time, value: s.alma.step(bars[i].close) };
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
export function createRun(inputs: Partial<ALMAInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

/**
 * Calculate ALMA indicator
 *
 * @param bars - OHLCV bar data
 * @param inputs - Indicator parameters (optional, uses defaults)
 * @returns Indicator result with plot data
 */
export function calculate(bars: Bar[], inputs: Partial<ALMAInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

/**
 * ALMA indicator module
 */
export const ALMA = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
