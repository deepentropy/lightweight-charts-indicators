/**
 * Vortex Indicator
 *
 * Identifies the start of a new trend or the continuation of an existing trend.
 * Consists of two oscillators: VI+ (positive) and VI- (negative).
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VortexInputs {
  /** Period length */
  length: number;
}

export const defaultInputs: VortexInputs = {
  length: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 2 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VI +', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'VI -', color: '#E91E63', lineWidth: 1 },
];

export const metadata = {
  title: 'Vortex Indicator',
  shortTitle: 'VI',
  overlay: false,
};

type Point = { time: number; value: number };

interface VortexRun extends BarRunState<Record<string, never>> {
  vmPlus: number[];
  vmMinus: number[];
  trueRange: number[];
  viPlusData: Point[];
  viMinusData: Point[];
}

function study(inputs: Partial<VortexInputs>): BarStudy<VortexRun, IndicatorResult> {
  const { length } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: VortexRun = {
        vmPlus: [], vmMinus: [], trueRange: [], viPlusData: [], viMinusData: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.series = [s.vmPlus, s.vmMinus, s.trueRange, s.viPlusData, s.viMinusData];
      return s;
    },
    bar(s, i, bars) {
      // VM+ = |high - low[1]|
      // VM- = |low - high[1]|
      // True Range = max(high - low, |high - close[1]|, |low - close[1]|)
      // VI+ = sum(VM+, length) / sum(TR, length)
      // VI- = sum(VM-, length) / sum(TR, length)
      const { vmPlus, vmMinus, trueRange } = s;
      if (i === 0) {
        vmPlus[0] = NaN;
        vmMinus[0] = NaN;
        trueRange[0] = NaN;
      } else {
        const high = bars[i].high;
        const low = bars[i].low;
        const prevHigh = bars[i - 1].high;
        const prevLow = bars[i - 1].low;
        const prevClose = bars[i - 1].close;
        vmPlus[i] = Math.abs(high - prevLow);
        vmMinus[i] = Math.abs(low - prevHigh);
        trueRange[i] = Math.max(
          high - low,
          Math.abs(high - prevClose),
          Math.abs(low - prevClose)
        );
      }

      // Calculate VI+ and VI-
      let viPlus = NaN;
      let viMinus = NaN;
      if (!(i < length)) {
        let sumVMPlus = 0;
        let sumVMMinus = 0;
        let sumTR = 0;
        for (let j = i - length + 1; j <= i; j++) {
          if (!isNaN(vmPlus[j])) sumVMPlus += vmPlus[j];
          if (!isNaN(vmMinus[j])) sumVMMinus += vmMinus[j];
          if (!isNaN(trueRange[j])) sumTR += trueRange[j];
        }
        if (sumTR !== 0) {
          viPlus = sumVMPlus / sumTR;
          viMinus = sumVMMinus / sumTR;
        }
      }
      const time = bars[i].time as number;
      s.viPlusData[i] = { time, value: viPlus };
      s.viMinusData[i] = { time, value: viMinus };
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.viPlusData.slice(),
          'plot1': s.viMinusData.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VortexInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VortexInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const VortexIndicator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
