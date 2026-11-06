/**
 * VOLD Ratio Histogram
 *
 * Log ratio of up volume to down volume. Up volume is the volume of the bars with close > open, down volume the
 * volume of the bars with close < open. Both are summed over `length` bars; the histogram is
 * log((sumUp + epsilon) / (sumDown + epsilon)), green at or above 0, red below.
 *
 * Reference: "VOLD Ratio Histogram V2 - [Th16rry] " by Th16rry
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Th16rry
 */

import { math, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSum, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VoldRatioHistogramInputs {
  /** Sum length */
  length: number;
  /** Added to both sums against a division by zero */
  epsilon: number;
}

export const defaultInputs: VoldRatioHistogramInputs = {
  length: 30,
  epsilon: 1.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Période de calcul (somme)', defval: 30, min: 1 },
  { id: 'epsilon', type: 'float', title: 'Epsilon anti-division par zéro', defval: 1.0, min: 0.000001 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VOLD Log Ratio Histogram', color: color.green, lineWidth: 2, style: 'histogram' },
];

export const metadata = {
  title: 'VOLD Ratio Histogram V2 - [Th16rry] ',
  shortTitle: 'VOLD Ratio Histogram V2 - [Th16rry] ',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Point = { time: number; value: number; color: string };

interface VoldRun extends BarRunState<Record<string, never>> {
  up: WindowSum;
  down: WindowSum;
  plot0: Point[];
}

function study(inputs: Partial<VoldRatioHistogramInputs>): BarStudy<VoldRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      // the length check of math.sum (the same runtime error)
      math.sum([], cfg.length);
      const up = new WindowSum(cfg.length);
      const down = new WindowSum(cfg.length);
      const s: VoldRun = { up, down, plot0: [], steps: [up, down], vars: {}, lists: [], series: [] };
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // upVolume = close > open ? volume : 0.0; downVolume = close < open ? volume : 0.0
      const sumUp = s.up.step(gt(b.close, b.open) ? (b.volume ?? NaN) : 0);
      const sumDown = s.down.step(gt(b.open, b.close) ? (b.volume ?? NaN) : 0);
      const v = Math.log((sumUp + cfg.epsilon) / (sumDown + cfg.epsilon));
      s.plot0[i] = { time: b.time, value: Number.isFinite(v) ? v : NaN, color: ge(v, 0) ? color.green : color.red };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        hlines: [{ value: 0, options: { title: 'Équilibre', color: color.gray, linestyle: 'dashed' } }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VoldRatioHistogramInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VoldRatioHistogramInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}


export const VoldRatioHistogram = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
