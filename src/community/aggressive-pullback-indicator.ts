/**
 * Aggressive Pullback Indicator
 *
 * Marks bullish engulfing candles above a 50 EMA and bearish engulfing candles below it when they follow a pullback
 * (open below / above the open of 2 bars ago) and pass the swing and EMA-touch rules of the script.
 * On a signal bar the stop price (5-bar swing low / high plus an ATR(14) buffer) and the target price (stop distance
 * times the risk:reward) are plotted on the signal bar and on the next bar.
 * Alerts (alertcondition, `alerts` of the result): 'API Alert!', true on the bars of a long or a short signal.
 *
 * Reference: "Aggressive Pullback Indicator" by ZenAndTheArtOfTrading
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface AggressivePullbackIndicatorInputs {
  /** EMA Length */
  emaLength: number;
  /** Stop loss distance from the 5-bar high / low, in ATR(14) */
  stopSizeInput: number;
  /** Risk:reward of the target */
  riskToReward: number;
}

export const defaultInputs: AggressivePullbackIndicatorInputs = {
  emaLength: 50,
  stopSizeInput: 1.0,
  riskToReward: 1.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaLength', type: 'int', title: 'EMA Length:', defval: 50, min: 1 },
  { id: 'stopSizeInput', type: 'float', title: 'Stop Distance (ATR):', defval: 1.0, min: 0.0 },
  { id: 'riskToReward', type: 'float', title: 'R:R:', defval: 1.0, min: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA', color: color.red, lineWidth: 1 },
  { id: 'plot1', title: 'Long Stop Price', color: color.red, lineWidth: 1, style: 'linebr' },
  { id: 'plot2', title: 'Short Stop Price', color: color.red, lineWidth: 1, style: 'linebr' },
  { id: 'plot3', title: 'Long Target Price', color: color.green, lineWidth: 1, style: 'linebr' },
  { id: 'plot4', title: 'Short Target Price', color: color.green, lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'Aggressive Pullback Indicator',
  shortTitle: 'API',
  overlay: true,
};

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface ApiRun extends BarRunState<Record<string, never>> {
  ema: ReturnType<typeof taStep.ema>;
  atr: ReturnType<typeof taStep.atr>;
  lowLow: WindowExtreme;
  highHigh: WindowExtreme;
  highOpen: WindowExtreme;
  lowOpen: WindowExtreme;
  validLong: boolean[];
  validShort: boolean[];
  tradeStopPrice: number[];
  tradeTargetPrice: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  plot4: Point[];
  markers: MarkerData[];
  flags: boolean[];
  times: number[];
}

function study(inputs: Partial<AggressivePullbackIndicatorInputs>): BarStudy<ApiRun, Result> {
  const { emaLength, stopSizeInput, riskToReward } = { ...defaultInputs, ...inputs };
  // x[k] of a bar field (na before the first bar)
  const at = (bars: Bar[], i: number, k: number, f: 'open' | 'high' | 'low' | 'close') => (i - k >= 0 ? bars[i - k][f] : NaN);
  // plot(valid or valid[1] ? valid ? price : price[1] : na)
  const twoBars = (valid: boolean[], price: number[], i: number, time: number): Point => {
    const prev = i > 0 && valid[i - 1];
    const value = valid[i] ? price[i] : prev ? price[i - 1] : NaN;
    return { time, value };
  };
  return {
    init() {
      const ema = taStep.ema(emaLength);
      const atr = taStep.atr(14);
      const lowLow = new WindowExtreme(true, 5);
      const highHigh = new WindowExtreme(false, 5);
      const highOpen = new WindowExtreme(false, 5);
      const lowOpen = new WindowExtreme(true, 5);
      const s: ApiRun = {
        ema, atr, lowLow, highHigh, highOpen, lowOpen, validLong: [], validShort: [], tradeStopPrice: [],
        tradeTargetPrice: [], plot0: [], plot1: [], plot2: [], plot3: [], plot4: [], markers: [], flags: [], times: [],
        steps: [ema, atr, lowLow, highHigh, highOpen, lowOpen], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, s.times];
      s.series = [
        s.validLong, s.validShort, s.tradeStopPrice, s.tradeTargetPrice, s.plot0, s.plot1, s.plot2, s.plot3, s.plot4, s.flags,
      ];
      return s;
    },
    bar(s, i, bars) {
      const { open, close, high, low, time } = bars[i];
      const e = s.ema.step(close);
      const currentATR = s.atr.step(high, low, close);
      const lowest5Low = s.lowLow.step(low);
      const highest5High = s.highHigh.step(high);
      const highest5Open = s.highOpen.step(open);
      const lowest5Open = s.lowOpen.step(open);

      const stopSize = currentATR * stopSizeInput;
      const longEntrySize = close - lowest5Low + stopSize;
      const shortEntrySize = highest5High - close + stopSize;
      const o1 = at(bars, i, 1, 'open'), c1 = at(bars, i, 1, 'close'), o2 = at(bars, i, 2, 'open'), o5 = at(bars, i, 5, 'open');
      const h1 = at(bars, i, 1, 'high'), h2 = at(bars, i, 2, 'high'), l1 = at(bars, i, 1, 'low'), l2 = at(bars, i, 2, 'low');
      const c2 = at(bars, i, 2, 'close');

      // Comparisons with na are false in Pine
      const rule1L = close > e && o1 > c1 && close > open && close >= o1 && c1 >= open && close - open > o1 - c1;
      const rule2L = open < o2;
      const rule3L = close < o5;
      const rule4L = close < highest5Open;
      const rule5L = highest5High > e && (h1 > e || h2 > e);
      const rule6L = close > e && (c1 > e || c2 > e);
      const validLong = rule1L && rule2L && (rule3L || rule4L) && rule5L && rule6L;
      s.validLong[i] = validLong;

      const rule1S = close < e && c1 > o1 && open > close && open >= c1 && o1 >= close && open - close > c1 - o1;
      const rule2S = open > o2;
      const rule3S = close > o5;
      const rule4S = close > lowest5Open;
      const rule5S = lowest5Low < e && (l1 < e || l2 < e);
      const rule6S = close < e && (c1 < e || c2 < e);
      const validShort = rule1S && rule2S && (rule3S || rule4S) && rule5S && rule6S;
      s.validShort[i] = validShort;

      // tradeStopPrice = 0.0 and tradeTargetPrice = 0.0 on every bar (not var)
      let stop = 0.0;
      let target = 0.0;
      if (validLong) {
        stop = close - longEntrySize;
        target = close + longEntrySize * riskToReward;
      }
      if (validShort) {
        stop = close + shortEntrySize;
        target = close - shortEntrySize * riskToReward;
      }
      s.tradeStopPrice[i] = stop;
      s.tradeTargetPrice[i] = target;

      s.plot0[i] = { time, value: e };
      s.plot1[i] = twoBars(s.validLong, s.tradeStopPrice, i, time);
      s.plot2[i] = twoBars(s.validShort, s.tradeStopPrice, i, time);
      s.plot3[i] = twoBars(s.validLong, s.tradeTargetPrice, i, time);
      s.plot4[i] = twoBars(s.validShort, s.tradeTargetPrice, i, time);

      // plotshape(validLong, location.belowbar, color.green, shape.triangleup) and
      // plotshape(validShort, color.red, shape.triangledown) (default location.abovebar, default size.auto)
      if (validLong) s.markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: color.green, size: 'auto' });
      if (validShort) s.markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'auto' });

      // alertcondition(validLong or validShort, "API Alert!")
      const flag = validLong || validShort;
      s.flags[i] = flag;
      if (flag) s.times.push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice(), plot4: s.plot4.slice() },
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, [s.times], [n > 0 && s.flags[n - 1]]),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AggressivePullbackIndicatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AggressivePullbackIndicatorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'API Alert!', message: 'Pullback signal for {{ticker}}' },
];

export const AggressivePullbackIndicator = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
