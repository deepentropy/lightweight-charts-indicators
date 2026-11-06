/**
 * Bull Bear Power Indicator
 *
 * Measures the strength of buyers (bulls) and sellers (bears)
 * relative to an exponential moving average.
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface BullBearPowerInputs {
  /** EMA period length */
  length: number;
}

export const defaultInputs: BullBearPowerInputs = {
  length: 13,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 13 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'BBPower', color: '#089981', lineWidth: 1, style: 'columns' },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, color: '#787B86', linestyle: 'solid', title: 'Zero Line' },
];

export const metadata = {
  title: 'Bull Bear Power',
  shortTitle: 'BBP',
  overlay: false,
};

type Point = { time: number; value: number; color: string };

interface BbpRun extends BarRunState<Record<string, never>> {
  ema: ReturnType<typeof taStep.ema>;
  bbpData: Point[];
}

function study(inputs: Partial<BullBearPowerInputs>): BarStudy<BbpRun, IndicatorResult> {
  const { length } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const ema = taStep.ema(length);
      const s: BbpRun = { ema, bbpData: [], steps: [ema], vars: {}, lists: [], series: [] };
      s.series = [s.bbpData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const ema = s.ema.step(b.close);
      // Bull Power = High - EMA
      // Bear Power = Low - EMA
      // BBP = Bull Power + Bear Power = High - EMA + Low - EMA = High + Low - 2*EMA
      const v = (b.high - ema) + (b.low - ema);
      const color = v >= 0 ? '#089981' : '#f23645';
      s.bbpData[i] = { time: b.time, value: v, color };
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.bbpData.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BullBearPowerInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BullBearPowerInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const BullBearPower = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
