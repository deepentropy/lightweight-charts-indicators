/**
 * Consecutive Higher/Lower Closings
 *
 * Counts the bars in a row where the chosen price (open, high, low or close; close by default) is above the
 * previous value (up count) or below it (down count); an equal or na change resets both counts. A BUY signal when
 * the up count reaches the input count, a SELL signal when the down count reaches its input count. Signals
 * alternate: a BUY only after a SELL (or as the first signal), a SELL only after a BUY (or as the first signal).
 * Alerts (alertcondition, `alerts` of the result): 'Buy Alert' and 'Sell Alert', true on the bars of each signal.
 *
 * Reference: "Custom Buy/Sell Signal (Alternating Signals)" by rahul_joshi_2
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © rahul_joshi_2
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ConsecutiveHigherLowerClosingsInputs {
  /** Consecutive higher values for a BUY */
  consecutiveHigherValues: number;
  /** Consecutive lower values for a SELL */
  consecutiveLowerValues: number;
  /** Price source: open (first match of open, high, low, close wins) */
  useOpen: boolean;
  useHigh: boolean;
  useLow: boolean;
  useClose: boolean;
}

export const defaultInputs: ConsecutiveHigherLowerClosingsInputs = {
  consecutiveHigherValues: 3,
  consecutiveLowerValues: 3,
  useOpen: false,
  useHigh: false,
  useLow: false,
  useClose: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'consecutiveHigherValues', type: 'int', title: 'Consecutive Higher Values for Buy', defval: 3, min: 1 },
  { id: 'consecutiveLowerValues', type: 'int', title: 'Consecutive Lower Values for Sell', defval: 3, min: 1 },
  { id: 'useOpen', type: 'bool', title: 'Use Open', defval: false },
  { id: 'useHigh', type: 'bool', title: 'Use High', defval: false },
  { id: 'useLow', type: 'bool', title: 'Use Low', defval: false },
  { id: 'useClose', type: 'bool', title: 'Use Close', defval: true },
];

// No plot(): the outputs are the BUY / SELL markers
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Custom Buy/Sell Signal (Alternating Signals)',
  shortTitle: 'Custom Buy/Sell Signal (Alternating Signals)',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface ChlcVars {
  upCount: number;
  downCount: number;
  /** 1 = last signal BUY, -1 = last signal SELL */
  lastSignal: number;
  prev: number;
  /** The signals of the last bar calculated (the alerts' triggered state) */
  buy: boolean;
  sell: boolean;
}

interface ChlcRun extends BarRunState<ChlcVars> {
  markers: MarkerData[];
  times: number[][];
}

function study(inputs: Partial<ConsecutiveHigherLowerClosingsInputs>): BarStudy<ChlcRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  // value = close, then open / high / low / close by the first input that is on
  const pick = (b: Bar): number => {
    if (cfg.useOpen) return b.open;
    if (cfg.useHigh) return b.high;
    if (cfg.useLow) return b.low;
    return b.close;
  };
  const textColor = color.blue; // no textcolor: the Pine plotshape default text colour
  return {
    init() {
      const s: ChlcRun = {
        markers: [], times: [[], []],
        steps: [], vars: { upCount: 0, downCount: 0, lastSignal: 0, prev: NaN, buy: false, sell: false }, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const value = pick(bars[i]);
      const valueDiff = value - v.prev; // value - value[1] (na on bar 0)
      v.prev = value;
      if (gt(valueDiff, 0)) {
        v.upCount += 1;
        v.downCount = 0;
      } else if (lt(valueDiff, 0)) {
        v.downCount += 1;
        v.upCount = 0;
      } else {
        v.upCount = 0;
        v.downCount = 0;
      }
      const rawBuy = v.upCount === cfg.consecutiveHigherValues;
      const rawSell = v.downCount === cfg.consecutiveLowerValues;
      let buySignal = false;
      let sellSignal = false;
      if (rawBuy && v.lastSignal !== 1) {
        buySignal = true;
        v.lastSignal = 1;
      }
      if (rawSell && v.lastSignal !== -1) {
        sellSignal = true;
        v.lastSignal = -1;
      }
      const t = bars[i].time;
      // plotshape(buySignal, "Buy Signal", shape.triangleup, location.belowbar, color.lime, size.small, text = "BUY")
      if (buySignal) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: color.lime, text: 'BUY', textColor, size: 'small' });
      }
      // plotshape(sellSignal, "Sell Signal", shape.triangledown, location.abovebar, color.red, size.small, text = "SELL")
      if (sellSignal) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: color.red, text: 'SELL', textColor, size: 'small' });
      }
      // alertcondition(buySignal, "Buy Alert") / alertcondition(sellSignal, "Sell Alert")
      v.buy = buySignal;
      v.sell = sellSignal;
      if (buySignal) s.times[0].push(t as number);
      if (sellSignal) s.times[1].push(t as number);
    },
    result(s, bars) {
      const n = bars.length;
      const v = s.vars;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, [n > 0 && v.buy, n > 0 && v.sell]),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ConsecutiveHigherLowerClosingsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ConsecutiveHigherLowerClosingsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Alert', message: 'BUY Signal' },
  { id: 'alert1', title: 'Sell Alert', message: 'SELL Signal' },
];

export const ConsecutiveHigherLowerClosings = {
  calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions,
};
