/**
 * Liquidity Indicator
 *
 * Local highs and lows: the high is drawn as a red step line on the bars where it equals the highest high of the
 * last `lengthHigh` bars, and the low as a green step line on the bars where it equals the lowest low of the last
 * `lengthLow` bars. Other bars have no value.
 * Alerts (alertcondition, `alerts` of the result): 'Local High Detected' and 'Local Low Detected' on those bars.
 *
 * Reference: "Liquidity Indicator" by The_Forex_Steward
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Script created by D'Andre B.
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface LiquidityIndicatorInputs {
  /** Lookback period for local highs */
  lengthHigh: number;
  /** Lookback period for local lows */
  lengthLow: number;
}

export const defaultInputs: LiquidityIndicatorInputs = {
  lengthHigh: 10,
  lengthLow: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'lengthHigh', type: 'int', title: 'Lookback Period for Local Highs', defval: 10 },
  { id: 'lengthLow', type: 'int', title: 'Lookback Period for Local Lows', defval: 10 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Local High Line', color: color.red, lineWidth: 2, style: 'stepline' },
  { id: 'plot1', title: 'Local Low Line', color: color.green, lineWidth: 2, style: 'stepline' },
];

export const metadata = {
  title: 'Liquidity Indicator',
  shortTitle: 'Liquidity Indicator',
  overlay: true,
};

/** Pine float comparisons: a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

type Point = { time: number; value: number };
type Result = IndicatorResult & { alerts: AlertConditionState[] };

interface LiquidityRun extends BarRunState<Record<string, never>> {
  highest: WindowExtreme;
  lowest: WindowExtreme;
  plot0: Point[];
  plot1: Point[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<LiquidityIndicatorInputs>): BarStudy<LiquidityRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const highest = new WindowExtreme(false, cfg.lengthHigh);
      const lowest = new WindowExtreme(true, cfg.lengthLow);
      const s: LiquidityRun = {
        highest, lowest, plot0: [], plot1: [], flags: [[], []], times: [[], []],
        steps: [highest, lowest], vars: {}, lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // isLocalHigh = high == ta.highest(high, lengthHigh); isLocalLow = low == ta.lowest(low, lengthLow)
      const isLocalHigh = eq(b.high, s.highest.step(b.high));
      const isLocalLow = eq(b.low, s.lowest.step(b.low));
      s.plot0[i] = { time: b.time, value: isLocalHigh ? b.high : NaN };
      s.plot1[i] = { time: b.time, value: isLocalLow ? b.low : NaN };
      s.flags[0][i] = isLocalHigh;
      s.flags[1][i] = isLocalLow;
      if (isLocalHigh) s.times[0].push(b.time as number);
      if (isLocalLow) s.times[1].push(b.time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        // alertcondition(isLocalHigh, "Local High Detected") / alertcondition(isLocalLow, "Local Low Detected")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<LiquidityIndicatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<LiquidityIndicatorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Local High Detected', message: 'Local high detected at [CurrencyPair] [TimeFrame]' },
  { id: 'alert1', title: 'Local Low Detected', message: 'Local low detected at [CurrencyPair] [TimeFrame]' },
];

export const LiquidityIndicator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
