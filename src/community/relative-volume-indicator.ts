/**
 * Relative Volume Indicator (RVOL)
 *
 * Relative volume = volume / SMA(volume, lookback), drawn as columns. The column is red below the average volume
 * threshold, yellow below the above-average threshold, green below the extreme threshold and fuchsia otherwise.
 * Dotted horizontal lines at the three thresholds.
 *
 * Reference: "Relative Volume Indicator (RVOL)" by AlgoCollective
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RelativeVolumeIndicatorInputs {
  /** Length of the SMA of the volume */
  lookbackPeriod: number;
  averageVolumeThreshold: number;
  aboveAverageThreshold: number;
  extremeVolumeThreshold: number;
  belowAvgColor: string;
  avgColor: string;
  aboveAvgColor: string;
  extremeColor: string;
}

export const defaultInputs: RelativeVolumeIndicatorInputs = {
  lookbackPeriod: 20,
  averageVolumeThreshold: 0.8,
  aboveAverageThreshold: 1.25,
  extremeVolumeThreshold: 4.0,
  belowAvgColor: color.red,
  avgColor: color.yellow,
  aboveAvgColor: color.green,
  extremeColor: color.fuchsia,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookbackPeriod', type: 'int', title: 'Average Volume Lookback Period', defval: 20, min: 1, group: 'Settings' },
  { id: 'averageVolumeThreshold', type: 'float', title: 'Average Volume Threshold', defval: 0.8, min: 0.1, step: 0.1, group: 'Settings' },
  { id: 'aboveAverageThreshold', type: 'float', title: 'Above Average Threshold', defval: 1.25, min: 0.5, step: 0.05, group: 'Settings' },
  { id: 'extremeVolumeThreshold', type: 'float', title: 'Extreme Volume Threshold', defval: 4.0, min: 1.5, step: 0.5, group: 'Settings' },
  { id: 'belowAvgColor', type: 'color', title: 'Below Average Color', defval: color.red, group: 'Colors', inline: 'color_below' },
  { id: 'avgColor', type: 'color', title: 'Average Color', defval: color.yellow, group: 'Colors', inline: 'color_avg' },
  { id: 'aboveAvgColor', type: 'color', title: 'Above Average Color', defval: color.green, group: 'Colors', inline: 'color_above' },
  { id: 'extremeColor', type: 'color', title: 'Extreme Color', defval: color.fuchsia, group: 'Colors', inline: 'color_extreme' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Relative Volume', color: color.red, lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'Relative Volume Indicator (RVOL)',
  shortTitle: 'Relative Volume Indicator (RVOL)',
  overlay: false,
  precision: 1,
  format: 'volume',
};

/** Pine a < b: b - a > 1e-10 (false with na) */
const lt = (a: number, b: number) => b - a > 1e-10;

type Point = { time: number; value: number; color: string };

interface RvolRun extends BarRunState<Record<string, never>> {
  avg: WindowSma;
  plot0: Point[];
}

function study(inputs: Partial<RelativeVolumeIndicatorInputs>): BarStudy<RvolRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const avg = new WindowSma(cfg.lookbackPeriod);
      const s: RvolRun = { avg, plot0: [], steps: [avg], vars: {}, lists: [], series: [] };
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const volume = b.volume ?? NaN;
      const averageVolume = s.avg.step(volume);
      // A plain division: x / 0 is +-infinity (0 / 0 NaN); the comparisons use the infinite value, the plot shows na
      const rv = volume / averageVolume;
      const c = lt(rv, cfg.averageVolumeThreshold) ? cfg.belowAvgColor
        : lt(rv, cfg.aboveAverageThreshold) ? cfg.avgColor
          : lt(rv, cfg.extremeVolumeThreshold) ? cfg.aboveAvgColor
            : cfg.extremeColor;
      s.plot0[i] = { time: b.time as number, value: Number.isFinite(rv) ? rv : NaN, color: c };
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay,
          precision: metadata.precision, format: metadata.format,
        },
        plots: { plot0: s.plot0.slice() },
        hlines: [
          { value: cfg.averageVolumeThreshold, options: { title: 'Average Volume Threshold', color: color.gray, linestyle: 'dotted', linewidth: 1 } },
          { value: cfg.aboveAverageThreshold, options: { title: 'Above Average Threshold', color: color.gray, linestyle: 'dotted', linewidth: 1 } },
          { value: cfg.extremeVolumeThreshold, options: { title: 'Extreme Volume Threshold', color: color.fuchsia, linestyle: 'dotted', linewidth: 1 } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RelativeVolumeIndicatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RelativeVolumeIndicatorInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const RelativeVolumeIndicator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
