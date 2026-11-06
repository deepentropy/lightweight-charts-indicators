/**
 * HawkEye Volume Indicator
 *
 * Volume colored by price action analysis. Compares close position relative
 * to midPrice and current range vs previous range.
 *
 * Reference: "HawkEye Volume Indicator" (community)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface HawkEyeVolumeInputs {
  length: number;
}

export const defaultInputs: HawkEyeVolumeInputs = {
  length: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume', color: '#787B86', lineWidth: 4, style: 'columns' },
];

export const metadata = {
  title: 'HawkEye Volume',
  shortTitle: 'HEVol',
  overlay: false,
};

type Point = { time: number; value: number; color: string };

interface HawkEyeRun extends BarRunState<Record<string, never>> {
  plot0: Point[];
}

function study(): BarStudy<HawkEyeRun, IndicatorResult> {
  return {
    init() {
      const s: HawkEyeRun = { plot0: [], steps: [], vars: {}, lists: [], series: [] };
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i];
      const vol = bar.volume ?? 0;
      const midPrice = (bar.high + bar.low) / 2;
      const range = bar.high - bar.low;
      const prevRange = i > 0 ? bars[i - 1].high - bars[i - 1].low : range;

      let color: string;
      if (bar.close > midPrice && range < prevRange) {
        color = '#26A69A'; // green: bullish
      } else if (bar.close < midPrice && range < prevRange) {
        color = '#EF5350'; // red: bearish
      } else {
        color = '#787B86'; // gray: neutral
      }

      s.plot0[i] = { time: bar.time, value: vol, color };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<HawkEyeVolumeInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(), chart);
}

export function calculate(bars: Bar[], _inputs: Partial<HawkEyeVolumeInputs> = {}): IndicatorResult {
  return fullResult(createRun(_inputs).update(bars));
}

export const HawkEyeVolume = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
