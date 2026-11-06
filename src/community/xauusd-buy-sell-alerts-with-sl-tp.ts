/**
 * XAUUSD Buy/Sell Alerts with SL & TP
 *
 * Fast and slow EMAs of the close. Buy: the fast EMA crosses over the slow EMA while RSI < 60. Sell: the fast EMA
 * crosses under the slow EMA while RSI > 40.
 *
 * Alerts: alertcondition 'Buy Alert' / 'Sell Alert' (`alerts` of the result) on the buy / sell bars, and alert() calls
 * (`alertCalls`, once per bar close) on the same bars with the entry (close), the stop loss (close -/+ stopLossPips *
 * 0.01) and the take profit (close +/- takeProfitPips * 0.01), as str.tostring(x, format.price) gives them. The two
 * pip inputs only take part in the alert text.
 *
 * Reference: "XAUUSD Buy/Sell Alerts with SL & TP" by alexandrossolomou1
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, str, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertCall, MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original makes alert() calls */
export const hasAlertFunction = true;

export interface XauusdBuySellAlertsWithSlTpInputs {
  emaFastLen: number;
  emaSlowLen: number;
  rsiLen: number;
  /** Stop loss in pips of 0.01 (alert() text only) */
  stopLossPips: number;
  /** Take profit in pips of 0.01 (alert() text only) */
  takeProfitPips: number;
}

export const defaultInputs: XauusdBuySellAlertsWithSlTpInputs = {
  emaFastLen: 9,
  emaSlowLen: 21,
  rsiLen: 14,
  stopLossPips: 300,
  takeProfitPips: 1000,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaFastLen', type: 'int', title: 'Fast EMA Length', defval: 9 },
  { id: 'emaSlowLen', type: 'int', title: 'Slow EMA Length', defval: 21 },
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14 },
  { id: 'stopLossPips', type: 'int', title: 'Stop Loss (pips)', defval: 300 },
  { id: 'takeProfitPips', type: 'int', title: 'Take Profit (pips)', defval: 1000 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast EMA', color: color.green, lineWidth: 1 },
  { id: 'plot1', title: 'Slow EMA', color: color.red, lineWidth: 1 },
];

export const metadata = {
  title: 'XAUUSD Buy/Sell Alerts with SL & TP',
  shortTitle: 'XAUUSD Buy/Sell Alerts with SL & TP',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; alertCalls: AlertCall[] } & { alerts: AlertConditionState[] };

interface XauusdRun extends BarRunState<Record<string, never>> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  rsi: ReturnType<typeof taStep.rsi>;
  emaFast: number[];
  emaSlow: number[];
  plot0: Point[];
  plot1: Point[];
  markers: MarkerData[];
  alertCalls: AlertCall[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<XauusdBuySellAlertsWithSlTpInputs>): BarStudy<XauusdRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const pip = 0.01;
  const fmt = (x: number) => str.tostring(x, 'price');
  return {
    init() {
      const fast = taStep.ema(cfg.emaFastLen);
      const slow = taStep.ema(cfg.emaSlowLen);
      const rsi = taStep.rsi(cfg.rsiLen);
      const s: XauusdRun = {
        fast, slow, rsi, emaFast: [], emaSlow: [], plot0: [], plot1: [], markers: [], alertCalls: [],
        flags: [[], []], times: [[], []], steps: [fast, slow, rsi], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, s.alertCalls, ...s.times];
      s.series = [s.emaFast, s.emaSlow, s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const emaFast = s.emaFast;
      const emaSlow = s.emaSlow;
      emaFast[i] = s.fast.step(b.close) ?? NaN;
      emaSlow[i] = s.slow.step(b.close) ?? NaN;
      const rsi = s.rsi.step(b.close) ?? NaN;
      s.plot0[i] = { time: b.time, value: emaFast[i] };
      s.plot1[i] = { time: b.time, value: emaSlow[i] };
      let buySignal = false;
      let sellSignal = false;
      if (i >= 1) {
        // ta.crossover / ta.crossunder: exact comparisons (no tolerance), a tie on the previous bar counts
        const crossUp = emaFast[i] > emaSlow[i] && emaFast[i - 1] <= emaSlow[i - 1];
        const crossDown = emaFast[i] < emaSlow[i] && emaFast[i - 1] >= emaSlow[i - 1];
        // plotshape(buySignal, "Buy Signal", location.belowbar, color.green, shape.labelup, text = "BUY")
        buySignal = crossUp && lt(rsi, 60);
        sellSignal = crossDown && gt(rsi, 40);
        if (buySignal) {
          s.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'BUY', textColor: color.blue });
        }
        // plotshape(sellSignal, "Sell Signal", location.abovebar, color.red, shape.labeldown, text = "SELL")
        if (sellSignal) {
          s.markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL', textColor: color.blue });
        }
        // alert("XAUUSD BUY\nEntry: " + str.tostring(close, format.price) + "\nSL: " + ... , alert.freq_once_per_bar_close)
        const c = b.close;
        if (buySignal) {
          s.alertCalls.push({ time: b.time, freq: 'once_per_bar_close',
            message: `XAUUSD BUY\nEntry: ${fmt(c)}\nSL: ${fmt(c - cfg.stopLossPips * pip)}\nTP: ${fmt(c + cfg.takeProfitPips * pip)}` });
        }
        if (sellSignal) {
          s.alertCalls.push({ time: b.time, freq: 'once_per_bar_close',
            message: `XAUUSD SELL\nEntry: ${fmt(c)}\nSL: ${fmt(c + cfg.stopLossPips * pip)}\nTP: ${fmt(c - cfg.takeProfitPips * pip)}` });
        }
      }
      s.flags[0][i] = buySignal;
      s.flags[1][i] = sellSignal;
      if (buySignal) s.times[0].push(b.time as number);
      if (sellSignal) s.times[1].push(b.time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
        alertCalls: s.alertCalls.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<XauusdBuySellAlertsWithSlTpInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<XauusdBuySellAlertsWithSlTpInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; alertCalls: AlertCall[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** alertcondition(buySignal / sellSignal) of the original */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Alert', message: 'XAUUSD BUY Signal' },
  { id: 'alert1', title: 'Sell Alert', message: 'XAUUSD SELL Signal' },
];

export const XauusdBuySellAlertsWithSlTp = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
  hasAlertFunction,
};
