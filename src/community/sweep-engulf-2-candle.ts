/**
 * Sweep Engulf 2 Candle
 *
 * Two-candle engulfing with a sweep of the previous extreme. Bullish: the low is below the previous low and either
 * the close is above the open of a previous bearish candle, or the close is above the close of a previous bullish
 * candle (green label below the bar). Bearish: the high is above the previous high and either the close is below the
 * close of a previous bearish candle, or the close is below the open of a previous bullish candle (red label above
 * the bar).
 *
 * Alerts: the alert conditions "Bullish Engulfing" / "Bearish Engulfing" (`alerts` of the result) are the shown
 * signals; with "Aktifkan Notifikasi" on, every bullish / bearish engulfing bar (shown or not) makes the alert() call
 * "Bullish Engulfing Terbentuk!" / "Bearish Engulfing Terbentuk!" (`alertCalls`, once per bar close).
 *
 * Reference: "Sweep Engulf 2 Candle" by gastrophollic
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertCall, MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SweepEngulf2CandleInputs {
  showBullish: boolean;
  showBearish: boolean;
  /** Alert switch of the alert() calls */
  enableAlert: boolean;
}

export const defaultInputs: SweepEngulf2CandleInputs = {
  showBullish: true,
  showBearish: true,
  enableAlert: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'showBullish', type: 'bool', title: 'Tampilkan Bullish Engulfing', defval: true },
  { id: 'showBearish', type: 'bool', title: 'Tampilkan Bearish Engulfing', defval: true },
  { id: 'enableAlert', type: 'bool', title: 'Aktifkan Notifikasi', defval: true },
];

// No plot(): the only outputs are plotshape markers
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Sweep Engulf 2 Candle',
  shortTitle: 'Sweep Engulf 2 Candle',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; alerts: AlertConditionState[]; alertCalls: AlertCall[] };

interface SweepRun extends BarRunState<{ bull: boolean; bear: boolean }> {
  markers: MarkerData[];
  times: number[][];
  alertCalls: AlertCall[];
}

function study(inputs: Partial<SweepEngulf2CandleInputs>): BarStudy<SweepRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const green = String(color.green);
  const red = String(color.red);
  return {
    init() {
      const s: SweepRun = { markers: [], times: [[], []], alertCalls: [], steps: [], vars: { bull: false, bear: false }, lists: [], series: [] };
      s.lists = [s.markers, ...s.times, s.alertCalls];
      return s;
    },
    bar(s, i, bars) {
      // first bar: low < low[1] / high > high[1] with na is false
      if (i === 0) {
        s.vars.bull = false;
        s.vars.bear = false;
        return;
      }
      const { markers, alertCalls } = s;
      const b = bars[i];
      const p = bars[i - 1];
      const bullishEngulfing = lt(b.low, p.low)
        && ((gt(b.close, p.open) && lt(p.close, p.open)) || (gt(b.close, p.close) && gt(p.close, p.open)));
      const bearishEngulfing = gt(b.high, p.high)
        && ((lt(b.close, p.close) && lt(p.close, p.open)) || (lt(b.close, p.open) && gt(p.close, p.open)));
      if (cfg.showBullish && bullishEngulfing) {
        markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: green, size: 'tiny' });
      }
      if (cfg.showBearish && bearishEngulfing) {
        markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: red, size: 'tiny' });
      }
      // alertcondition(showBullish and bullishEngulfing, ...) / alertcondition(showBearish and bearishEngulfing, ...)
      const bull = cfg.showBullish && bullishEngulfing;
      const bear = cfg.showBearish && bearishEngulfing;
      // the flags of the last bar calculated (the alert states of the last bar)
      s.vars.bull = bull;
      s.vars.bear = bear;
      if (bull) s.times[0].push(b.time as number);
      if (bear) s.times[1].push(b.time as number);
      // if enableAlert: if bullishEngulfing alert(...); if bearishEngulfing alert(...) (alert.freq_once_per_bar_close)
      if (cfg.enableAlert) {
        if (bullishEngulfing) alertCalls.push({ time: b.time, message: 'Bullish Engulfing Terbentuk!', freq: 'once_per_bar_close' });
        if (bearishEngulfing) alertCalls.push({ time: b.time, message: 'Bearish Engulfing Terbentuk!', freq: 'once_per_bar_close' });
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, [n > 0 && s.vars.bull, n > 0 && s.vars.bear]),
        alertCalls: s.alertCalls.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SweepEngulf2CandleInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SweepEngulf2CandleInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Engulfing', message: 'Bullish Engulfing Terbentuk!' },
  { id: 'alert1', title: 'Bearish Engulfing', message: 'Bearish Engulfing Terbentuk!' },
];

export const hasAlertFunction = true;

export const SweepEngulf2Candle = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions, hasAlertFunction };
