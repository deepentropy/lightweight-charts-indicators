/**
 * Donchian Channels (DC) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * A trend-following indicator that shows the highest high and lowest low
 * over a specified period, with a midline (basis).
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type FillData, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/**
 * Donchian Channels indicator input parameters
 */
export interface DonchianInputs {
  /** Lookback period */
  length: number;
  /** Plot offset */
  offset: number;
}

/**
 * Default input values matching the standard indicator defaults
 */
export const defaultInputs: DonchianInputs = {
  length: 20,
  offset: 0,
};

/**
 * Input configuration for UI
 */
export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 20, min: 1 },
  { id: 'offset', type: 'int', title: 'Offset', defval: 0 },
];

/**
 * Plot configuration - order matches CSV: Basis, Upper, Lower
 */
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Basis', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot1', title: 'Upper', color: '#2962FF', lineWidth: 1 },
  { id: 'plot2', title: 'Lower', color: '#2962FF', lineWidth: 1 },
];

/**
 * Indicator metadata
 */
export const metadata = {
  title: 'Donchian Channels',
  shortTitle: 'DC',
  overlay: true,
};

type Point = { time: number; value: number };

interface DonchianRun extends BarRunState<Record<string, never>> {
  upper: WindowExtreme;
  lower: WindowExtreme;
  basisData: Point[];
  upperData: Point[];
  lowerData: Point[];
}

function study(inputs: Partial<DonchianInputs>): BarStudy<DonchianRun, IndicatorResult> {
  const { length, offset } = { ...defaultInputs, ...inputs };
  return {
    init() {
      // Calculate upper (highest high) and lower (lowest low)
      const upper = new WindowExtreme(false, length);
      const lower = new WindowExtreme(true, length);
      const s: DonchianRun = { upper, lower, basisData: [], upperData: [], lowerData: [], steps: [upper, lower], vars: {}, lists: [], series: [] };
      s.series = [s.basisData, s.upperData, s.lowerData];
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time;
      const u = s.upper.step(bars[i].high);
      const l = s.lower.step(bars[i].low);
      // Calculate basis (midline)
      const basis = (u + l) / 2;
      // Build plot data with offset: na before bar 0 (a negative offset); the bars past the last one are set in result
      const shown = i + offset >= 0;
      s.basisData[i] = { time, value: shown ? (basis ?? NaN) : NaN };
      s.upperData[i] = { time, value: shown ? (u ?? NaN) : NaN };
      s.lowerData[i] = { time, value: shown ? (l ?? NaN) : NaN };
    },
    result(s, bars) {
      const n = bars.length;
      const plot = (data: Point[]) => {
        const out = data.slice();
        // the target bar after the last bar (a positive offset): na
        for (let j = n - 1; j >= 0 && !(j + offset < n); j--) out[j] = { time: bars[j].time, value: NaN };
        return out;
      };
      const fills: FillData[] = [
        { plot1: 'plot1', plot2: 'plot2', options: { color: '#2196F3', transp: 95, title: 'Background' } },
      ];
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': plot(s.basisData),
          'plot1': plot(s.upperData),
          'plot2': plot(s.lowerData),
        },
        fills,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DonchianInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

/**
 * Calculate Donchian Channels indicator
 *
 * @param bars - OHLCV bar data
 * @param inputs - Indicator parameters (optional, uses defaults)
 * @returns Indicator result with plot data
 */
export function calculate(bars: Bar[], inputs: Partial<DonchianInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

/**
 * Donchian Channels indicator module
 */
export const DonchianChannels = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
