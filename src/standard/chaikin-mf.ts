/**
 * Chaikin Money Flow (CMF) Indicator
 *
 * Measures the amount of Money Flow Volume over a specific period.
 * CMF = Sum(Money Flow Volume, n) / Sum(Volume, n)
 * where Money Flow Volume = ((Close - Low) - (High - Close)) / (High - Low) * Volume
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ChaikinMFInputs {
  /** Period length */
  length: number;
}

export const defaultInputs: ChaikinMFInputs = {
  length: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 20, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'CMF', color: '#43A047', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, color: '#787B86', linestyle: 'dashed', title: 'Zero' },
];

export const metadata = {
  title: 'Chaikin Money Flow',
  shortTitle: 'CMF',
  overlay: false,
};

type Point = { time: number; value: number };

interface CmfRun extends BarRunState<Record<string, never>> {
  ad: number[];
  vol: number[];
  plotData: Point[];
}

function study(inputs: Partial<ChaikinMFInputs>): BarStudy<CmfRun, IndicatorResult> {
  const { length } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: CmfRun = { ad: [], vol: [], plotData: [], steps: [], vars: {}, lists: [], series: [] };
      s.series = [s.ad, s.vol, s.plotData];
      return s;
    },
    bar(s, i, bars) {
      const ad = s.ad;
      const vol = s.vol;
      // Calculate Money Flow Multiplier and Money Flow Volume for each bar
      // ad = close==high and close==low or high==low ? 0 : ((2*close-low-high)/(high-low))*volume
      const bar = bars[i];
      const high = bar.high;
      const low = bar.low;
      const close = bar.close;
      const v = bar.volume ?? 0;
      vol[i] = v;
      ad[i] = (close === high && close === low) || high === low ? 0 : ((2 * close - low - high) / (high - low)) * v;

      // CMF = Sum(ad, length) / Sum(volume, length)
      let value: number;
      if (i < length - 1) {
        value = NaN;
      } else {
        let sumAD = 0;
        let sumVol = 0;
        for (let j = i - length + 1; j <= i; j++) {
          sumAD += ad[j];
          sumVol += vol[j];
        }
        value = sumVol === 0 ? 0 : sumAD / sumVol;
      }
      s.plotData[i] = { time: bar.time, value };
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
export function createRun(inputs: Partial<ChaikinMFInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ChaikinMFInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const ChaikinMF = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
