/**
 * Mass Index Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Identifies trend reversals by examining range between high and low.
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MassIndexInputs {
  length: number;
}

export const defaultInputs: MassIndexInputs = {
  length: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 10, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Mass Index', color: '#E91E63', lineWidth: 1 },
];

export const metadata = {
  title: 'Mass Index',
  shortTitle: 'MI',
  overlay: false,
};

type Point = { time: number; value: number };

interface MassIndexRun extends BarRunState<Record<string, never>> {
  ema1: ReturnType<typeof taStep.ema>;
  ema2: ReturnType<typeof taStep.ema>;
  ratioArr: number[];
  plotData: Point[];
}

function study(inputs: Partial<MassIndexInputs>): BarStudy<MassIndexRun, IndicatorResult> {
  const { length } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const ema1 = taStep.ema(9);
      const ema2 = taStep.ema(9);
      const s: MassIndexRun = { ema1, ema2, ratioArr: [], plotData: [], steps: [ema1, ema2], vars: {}, lists: [], series: [] };
      s.series = [s.ratioArr, s.plotData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // Mass Index = Sum(EMA(high-low, 9) / EMA(EMA(high-low, 9), 9), length)
      const e1 = s.ema1.step(b.high - b.low);
      const e2 = s.ema2.step(e1);
      const ratioArr = s.ratioArr;
      ratioArr[i] = e1 / e2;

      // Calculate rolling sum of ratio over 'length' periods
      let value: number | undefined;
      if (i < length - 1) {
        value = undefined;
      } else {
        let sum = 0;
        let validCount = 0;
        for (let j = 0; j < length; j++) {
          const val = ratioArr[i - j];
          if (val !== undefined && !isNaN(val)) {
            sum += val;
            validCount++;
          }
        }
        value = validCount === length ? sum : undefined;
      }
      s.plotData[i] = { time: b.time, value: value ?? NaN };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plotData.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MassIndexInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MassIndexInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const MassIndex = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
