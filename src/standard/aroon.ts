/**
 * Aroon Indicator
 *
 * Identifies trend strength and potential reversals by measuring
 * how long since the highest high and lowest low within the period.
 * Aroon Up = 100 * (length - bars since highest high) / length
 * Aroon Down = 100 * (length - bars since lowest low) / length
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AroonInputs {
  /** Period length */
  length: number;
}

export const defaultInputs: AroonInputs = {
  length: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 14, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Aroon Up', color: '#FB8C00', lineWidth: 1 },
  { id: 'plot1', title: 'Aroon Down', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Aroon',
  shortTitle: 'Aroon',
  overlay: false,
};

type Point = { time: number; value: number };

interface AroonRun extends BarRunState<Record<string, never>> {
  upData: Point[];
  downData: Point[];
}

function study(inputs: Partial<AroonInputs>): BarStudy<AroonRun, IndicatorResult> {
  const { length } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: AroonRun = { upData: [], downData: [], steps: [], vars: {}, lists: [], series: [] };
      s.series = [s.upData, s.downData];
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time;
      if (i < length) {
        s.upData[i] = { time, value: NaN };
        s.downData[i] = { time, value: NaN };
        return;
      }

      // Find bars since highest high and lowest low in the lookback period
      // ta.highestbars returns negative offset, so we add length to get bars since
      let highestIdx = i;
      let lowestIdx = i;
      let highestVal = -Infinity;
      let lowestVal = Infinity;

      for (let j = i - length; j <= i; j++) {
        if (bars[j].high > highestVal) {
          highestVal = bars[j].high;
          highestIdx = j;
        }
        if (bars[j].low < lowestVal) {
          lowestVal = bars[j].low;
          lowestIdx = j;
        }
      }

      // Bars since highest/lowest (0 = current bar has highest/lowest)
      const barsSinceHighest = i - highestIdx;
      const barsSinceLowest = i - lowestIdx;

      // Aroon formula: 100 * (length - bars_since) / length
      s.upData[i] = { time, value: 100 * (length - barsSinceHighest) / length };
      s.downData[i] = { time, value: 100 * (length - barsSinceLowest) / length };
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.upData.slice(),
          'plot1': s.downData.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AroonInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AroonInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const Aroon = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
