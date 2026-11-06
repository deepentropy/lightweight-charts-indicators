/**
 * Elder Force Index (EFI) Indicator
 *
 * Measures the power behind price movements using
 * price change and volume.
 * EFI = EMA(change(close) * volume, length)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ElderForceInputs {
  /** EMA period length */
  length: number;
}

export const defaultInputs: ElderForceInputs = {
  length: 13,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 13, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Elder Force Index', color: '#F44336', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, color: '#787B86', linestyle: 'solid', title: 'Zero' },
];

export const metadata = {
  title: 'Elder Force Index',
  shortTitle: 'EFI',
  overlay: false,
};

type Point = { time: number; value: number };

interface EfiRun extends BarRunState<Record<string, never>> {
  ema: ReturnType<typeof taStep.ema>;
  efiData: Point[];
}

function study(inputs: Partial<ElderForceInputs>): BarStudy<EfiRun, IndicatorResult> {
  const { length } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const ema = taStep.ema(length);
      const s: EfiRun = { ema, efiData: [], steps: [ema], vars: {}, lists: [], series: [] };
      s.series = [s.efiData];
      return s;
    },
    bar(s, i, bars) {
      // Calculate change(close) * volume
      const force = i === 0 ? NaN : (bars[i].close - bars[i - 1].close) * (bars[i].volume ?? 0);
      // EMA of force
      const value = s.ema.step(force);
      s.efiData[i] = { time: bars[i].time, value: value ?? NaN };
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.efiData.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ElderForceInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ElderForceInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const ElderForceIndex = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
