/**
 * GWAP (Gamma Weighted Average Price)
 *
 * A weighted average of the last `length` closes: the close of i bars ago has the weight gamma^i
 * (i = 0 .. length - 1), GWAP = sum(close[i] * gamma^i) / sum(gamma^i). It is na before bar `length`.
 *
 * Reference: "GWAP (Gamma Weighted Average Price)" by EdgeTools
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface GwapInputs {
  /** Number of closes in the average */
  length: number;
  /** Gamma weight factor: the close of i bars ago has the weight gammaFactor^i */
  gammaFactor: number;
}

export const defaultInputs: GwapInputs = {
  length: 14,
  gammaFactor: 0.92,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length for GWAP Calculation', defval: 14 },
  { id: 'gammaFactor', type: 'float', title: 'Gamma Weight Factor', defval: 0.92, min: 0.5, max: 1.5, step: 0.01 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Gamma Weighted Average Price', color: color.red, lineWidth: 1 },
];

export const metadata = {
  title: 'GWAP (Gamma Weighted Average Price)',
  shortTitle: 'GWAP',
  overlay: true,
};

/** Pine a != b: false when a and b are within 1e-10 (or one is na) */
const ne = (a: number, b: number) => Math.abs(a - b) > 1e-10;

type Point = { time: number; value: number; color: string };

interface GwapRun extends BarRunState<Record<string, never>> {
  plot0: Point[];
}

function study(inputs: Partial<GwapInputs>): BarStudy<GwapRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, gammaFactor } = cfg;
  // gamma_weights[i] = math.pow(gamma_factor, i) (the same on every bar)
  const powers: number[] = [];
  return {
    init() {
      // Pine runtime errors on bar 0: a negative length fails in array.new_float; with length 0, bar_index >= 0 and
      // `for i = 0 to -1` counts down, so array.set writes index 0 of the empty array
      if (length < 0) throw new Error('Cannot create an array with a negative size.');
      if (length === 0) throw new Error("In 'array.set()' function. Index 0 is out of bounds, array size is 0.");
      if (powers.length === 0) for (let i = 0; i < length; i++) powers.push(Math.pow(gammaFactor, i));
      const s: GwapRun = { plot0: [], steps: [], vars: {}, lists: [], series: [] };
      s.series = [s.plot0];
      return s;
    },
    bar(s, bi, bars) {
      const b = bars[bi];
      // gamma_weights = array.new_float(length, 0.0); price_series = array.new_float(length, na);
      // filled only when bar_index >= length (before: na prices, the sum is na and the weights total 0)
      let gwap = NaN;
      if (bi >= length) {
        let weightedSum = 0.0;
        let weightTotal = 0.0;
        for (let i = 0; i < length; i++) {
          weightedSum = weightedSum + bars[bi - i].close * powers[i];
          weightTotal = weightTotal + powers[i];
        }
        gwap = ne(weightTotal, 0) ? weightedSum / weightTotal : NaN;
      }
      s.plot0[bi] = { time: b.time as number, value: Number.isFinite(gwap) ? gwap : NaN, color: color.red };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<GwapInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<GwapInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const Gwap = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
