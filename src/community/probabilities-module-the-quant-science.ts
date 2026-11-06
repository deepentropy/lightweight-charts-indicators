/**
 * Probabilities Module (Win Rate %)
 *
 * A simple trade model: a trade opens on a bearish bar (close < open) when no trade is open. An open trade closes
 * as a win (1) on a bullish bar (close > open), else as a loss (0) on a bar with close < close[1]. Each trade outcome
 * is pushed into an array; when the array holds more than `look` outcomes it is cleared. The plot is the average of
 * the array * 100 (na while the array is empty).
 *
 * Reference: "Win Rate % [The Quant Science]" by thequantscience
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ProbabilitiesModuleTheQuantScienceInputs {
  /** Lookback period (trades) */
  look: number;
}

export const defaultInputs: ProbabilitiesModuleTheQuantScienceInputs = {
  look: 30,
};

export const inputConfig: InputConfig[] = [
  { id: 'look', type: 'int', title: 'Lookback period (Trades)', defval: 30, min: 1, max: 500 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Win Rate %', color: color.aqua, lineWidth: 1 },
];

export const metadata = {
  title: 'Win Rate % [The Quant Science]',
  shortTitle: 'Win Rate % [The Quant Science]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number };

interface ProbVars {
  /** var bool in_trade = false */
  inTrade: boolean;
  /** var int trade_outcome = na */
  tradeOutcome: number;
  /** var results_array = array.new_float(0): its size and its count of 1 (the outcomes are 0 or 1) */
  size: number;
  ones: number;
}

interface ProbRun extends BarRunState<ProbVars> {
  plot0: Point[];
}

function study(inputs: Partial<ProbabilitiesModuleTheQuantScienceInputs>): BarStudy<ProbRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: ProbRun = {
        plot0: [], steps: [], vars: { inTrade: false, tradeOutcome: NaN, size: 0, ones: 0 }, lists: [], series: [],
      };
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const entryCondition = lt(b.close, b.open);
      const takeProfitCondExit = gt(b.close, b.open);
      const stopLossCondExit = i > 0 && lt(b.close, bars[i - 1].close);

      const isEntry = !v.inTrade && entryCondition;
      const isTp = v.inTrade && takeProfitCondExit;
      const isSl = v.inTrade && stopLossCondExit;

      if (isEntry) {
        v.inTrade = true;
        v.tradeOutcome = NaN;
      }
      if (isTp) {
        v.inTrade = false;
        v.tradeOutcome = 1;
      } else if (isSl) {
        v.inTrade = false;
        v.tradeOutcome = 0;
      }

      if (!isNaN(v.tradeOutcome) && (isTp || isSl)) {
        // array.push(results_array, trade_outcome); array.clear when its size is above the lookback
        v.size++;
        v.ones += v.tradeOutcome;
        if (v.size > cfg.look) {
          v.size = 0;
          v.ones = 0;
        }
        v.tradeOutcome = NaN;
      }

      // probabilities = array.size(results_array) > 0 ? array.avg(results_array) * 100 : na (the sum of the 0 and 1
      // values divided by the size: the same double as array.avg)
      const value = v.size > 0 ? (v.ones / v.size) * 100 : NaN;
      s.plot0[i] = { time: b.time, value };
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
export function createRun(inputs: Partial<ProbabilitiesModuleTheQuantScienceInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<ProbabilitiesModuleTheQuantScienceInputs> = {},
): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const ProbabilitiesModuleTheQuantScience = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
