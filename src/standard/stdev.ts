/**
 * Standard Deviation Indicator
 *
 * Measures volatility by calculating the standard deviation of price.
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface StDevInputs {
  /** Period length */
  length: number;
}

export const defaultInputs: StDevInputs = {
  length: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 20, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'StDev', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Standard Deviation',
  shortTitle: 'StDev',
  overlay: false,
};

type Point = { time: number; value: number };

interface StDevRun extends BarRunState<Record<string, never>> {
  dev: WindowStdev;
  stdevData: Point[];
}

function study(inputs: Partial<StDevInputs>): BarStudy<StDevRun, IndicatorResult> {
  const { length } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const dev = new WindowStdev(length);
      const s: StDevRun = { dev, stdevData: [], steps: [dev], vars: {}, lists: [], series: [] };
      s.series = [s.stdevData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      s.stdevData[i] = { time: b.time as number, value: s.dev.step(b.close) };
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.stdevData.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<StDevInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<StDevInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const StandardDeviation = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
