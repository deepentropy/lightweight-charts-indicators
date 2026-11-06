/**
 * Coppock Curve Indicator
 *
 * Long-term momentum indicator calculated as a weighted moving average
 * of the sum of two rate of change periods.
 * Coppock = WMA(ROC(long) + ROC(short), wmaLength)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CoppockCurveInputs {
  /** WMA smoothing length */
  wmaLength: number;
  /** Long ROC period */
  longRocLength: number;
  /** Short ROC period */
  shortRocLength: number;
}

export const defaultInputs: CoppockCurveInputs = {
  wmaLength: 10,
  longRocLength: 14,
  shortRocLength: 11,
};

export const inputConfig: InputConfig[] = [
  { id: 'wmaLength', type: 'int', title: 'WMA Length', defval: 10 },
  { id: 'longRocLength', type: 'int', title: 'Long RoC Length', defval: 14 },
  { id: 'shortRocLength', type: 'int', title: 'Short RoC Length', defval: 11 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Coppock Curve', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Coppock Curve',
  shortTitle: 'Coppock',
  overlay: false,
};

type Point = { time: number; value: number };

interface CoppockRun extends BarRunState<Record<string, never>> {
  longRoc: ReturnType<typeof taStep.roc>;
  shortRoc: ReturnType<typeof taStep.roc>;
  wma: ReturnType<typeof taStep.wma>;
  plotData: Point[];
}

function study(inputs: Partial<CoppockCurveInputs>): BarStudy<CoppockRun, IndicatorResult> {
  const { wmaLength, longRocLength, shortRocLength } = { ...defaultInputs, ...inputs };
  return {
    init() {
      // ROC for both periods
      const longRoc = taStep.roc(longRocLength);
      const shortRoc = taStep.roc(shortRocLength);
      const wma = taStep.wma();
      const s: CoppockRun = { longRoc, shortRoc, wma, plotData: [], steps: [longRoc, shortRoc, wma], vars: {}, lists: [], series: [] };
      s.series = [s.plotData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const l = s.longRoc.step(b.close);
      const sh = s.shortRoc.step(b.close);
      // Sum of ROCs
      const rocSum = l == null || sh == null ? NaN : l + sh;
      // WMA of ROC sum
      const value = s.wma.step(rocSum, wmaLength);
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
export function createRun(inputs: Partial<CoppockCurveInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CoppockCurveInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const CoppockCurve = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
