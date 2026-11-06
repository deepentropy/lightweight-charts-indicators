/**
 * MA Cross Indicator
 *
 * Shows two moving averages and their crossover signals.
 * Uses SMA by default.
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MACrossInputs {
  /** Short MA period */
  shortLength: number;
  /** Long MA period */
  longLength: number;
}

export const defaultInputs: MACrossInputs = {
  shortLength: 9,
  longLength: 21,
};

export const inputConfig: InputConfig[] = [
  { id: 'shortLength', type: 'int', title: 'Short MA Length', defval: 9, min: 1 },
  { id: 'longLength', type: 'int', title: 'Long MA Length', defval: 21, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Short MA', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot1', title: 'Long MA', color: '#43A047', lineWidth: 1 },
  { id: 'plot2', title: 'Cross', color: '#2962FF', lineWidth: 4, style: 'cross' },
];

export const metadata = {
  title: 'MA Cross',
  shortTitle: 'MA Cross',
  overlay: true,
};

type Point = { time: number; value: number };

interface MaCrossRun extends BarRunState<Record<string, never>> {
  short: WindowSma;
  long: WindowSma;
  shortArr: number[];
  longArr: number[];
  shortData: Point[];
  longData: Point[];
  crossData: Point[];
}

function study(inputs: Partial<MACrossInputs>): BarStudy<MaCrossRun, IndicatorResult> {
  const { shortLength, longLength } = { ...defaultInputs, ...inputs };
  return {
    init() {
      // Calculate SMAs
      const short = new WindowSma(shortLength);
      const long = new WindowSma(longLength);
      const s: MaCrossRun = {
        short, long, shortArr: [], longArr: [], shortData: [], longData: [], crossData: [],
        steps: [short, long], vars: {}, lists: [], series: [],
      };
      s.series = [s.shortArr, s.longArr, s.shortData, s.longData, s.crossData];
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i]!.time as number;
      const close = bars[i]!.close;
      const sv = s.short.step(close);
      const l = s.long.step(close);
      s.shortArr[i] = sv;
      s.longArr[i] = l;
      s.shortData[i] = { time, value: sv };
      s.longData[i] = { time, value: l };
      // Cross plot: show short MA value at crossover points, NaN elsewhere
      if (i === 0) {
        s.crossData[i] = { time, value: NaN };
        return;
      }
      const sP = s.shortArr[i - 1]!, lP = s.longArr[i - 1]!;
      const isCross = (sP <= lP && sv > l) || (sP >= lP && sv < l);
      s.crossData[i] = { time, value: isCross ? sv : NaN };
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.shortData.slice(),
          'plot1': s.longData.slice(),
          'plot2': s.crossData.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MACrossInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MACrossInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const MACross = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
