/**
 * Fisher Transform Indicator
 *
 * Converts prices into a Gaussian normal distribution, making
 * turning points easier to identify.
 *
 * Based on the standard Fisher Transform indicator.
 */

import { type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface FisherTransformInputs {
  /** Lookback period for highest/lowest calculation */
  length: number;
}

export const defaultInputs: FisherTransformInputs = {
  length: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 9, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fisher', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Trigger', color: '#FF6D00', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_1',  price: 1.5, color: '#E91E63', linestyle: 'dashed', title: '1.5' },
  { id: 'hline_2',  price: 0.75, color: '#787B86', linestyle: 'dashed', title: '0.75' },
  { id: 'hline_3',  price: 0, color: '#E91E63', linestyle: 'dashed', title: '0' },
  { id: 'hline_4',  price: -0.75, color: '#787B86', linestyle: 'dashed', title: '-0.75' },
  { id: 'hline_5',  price: -1.5, color: '#E91E63', linestyle: 'dashed', title: '-1.5' },
];

export const metadata = {
  title: 'Fisher Transform',
  shortTitle: 'Fisher',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number };

interface FisherVars {
  value: number;
  fish1: number;
}

interface FisherRun extends BarRunState<FisherVars> {
  high: WindowExtreme;
  low: WindowExtreme;
  fisher: number[];
  plotData0: Point[];
  plotData1: Point[];
}

function study(inputs: Partial<FisherTransformInputs>): BarStudy<FisherRun, IndicatorResult> {
  const { length } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const high = new WindowExtreme(false, length);
      const low = new WindowExtreme(true, length);
      const s: FisherRun = {
        high, low, fisher: [], plotData0: [], plotData1: [],
        steps: [high, low], vars: { value: NaN, fish1: NaN }, lists: [], series: [],
      };
      s.series = [s.fisher, s.plotData0, s.plotData1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const hl2 = (b.high + b.low) / 2;
      const high_ = s.high.step(hl2);
      const low_ = s.low.step(hl2);
      const nzValue = Number.isNaN(v.value) ? 0 : v.value;
      const nzFish1 = Number.isNaN(v.fish1) ? 0 : v.fish1;
      // A plain division: 0 / 0 is NaN (na), x / 0 is +-infinity
      const raw = 0.66 * ((hl2 - low_) / (high_ - low_) - 0.5) + 0.67 * nzValue;
      v.value = gt(raw, 0.99) ? 0.999 : lt(raw, -0.99) ? -0.999 : raw;
      v.fish1 = 0.5 * Math.log((1 + v.value) / (1 - v.value)) + 0.5 * nzFish1;
      s.fisher[i] = v.fish1;
      s.plotData0[i] = { time: b.time, value: Number.isFinite(v.fish1) ? v.fish1 : NaN };
      const prev = i > 0 ? s.fisher[i - 1] : NaN;
      s.plotData1[i] = { time: b.time, value: Number.isFinite(prev) ? prev : NaN };
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.plotData0.slice(),
          'plot1': s.plotData1.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FisherTransformInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

/**
 * Calculate Fisher Transform
 *
 * high_ = ta.highest(hl2, len), low_ = ta.lowest(hl2, len)
 * round_(val) => val > .99 ? .999 : val < -.99 ? -.999 : val
 * value := round_(.66 * ((hl2 - low_) / (high_ - low_) - .5) + .67 * nz(value[1]))
 * fish1 := .5 * math.log((1 + value) / (1 - value)) + .5 * nz(fish1[1])
 * fish2 = fish1[1]
 * A flat window (high_ == low_) gives 0 / 0 = na: value and fish1 are na on that bar and count as 0 on the next.
 */
export function calculate(bars: Bar[], inputs: Partial<FisherTransformInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const FisherTransform = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
