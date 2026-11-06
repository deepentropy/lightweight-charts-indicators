/**
 * Full Candle Higher/Lower (No Repeats)
 *
 * Higher: close > high[1] and low[1] <= high[2]. Lower: close < low[1] and high[1] >= low[2]. A signal is shown only
 * when the last signal was not the same one (Higher and Lower alternate): a green "Higher" label below the bar, a red
 * "Lower" label above the bar.
 * Alerts (alertcondition, `alerts` of the result): 'Higher Flag' / 'Lower Flag' on the bars of each signal.
 *
 * Reference: "Full Candle Higher/Lower (No Repeats)" by devtiqo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface FullCandleHigherLowerInputs {}

export const defaultInputs: FullCandleHigherLowerInputs = {};

export const inputConfig: InputConfig[] = [];

// No plot(): the outputs are the plotshape markers
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Full Candle Higher/Lower (No Repeats)',
  shortTitle: 'Full Candle Higher/Lower (No Repeats)',
  overlay: true,
};

/** Pine float comparisons: equal within 1e-10; na compares false */
const EPS = 1e-10;
const gt = (a: number, b: number) => !isNaN(a) && !isNaN(b) && a - b > EPS;
const lt = (a: number, b: number) => !isNaN(a) && !isNaN(b) && b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface FullCandleVars {
  /** var string lastSignal */
  lastSignal: string;
}

interface FullCandleRun extends BarRunState<FullCandleVars> {
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(): BarStudy<FullCandleRun, Result> {
  return {
    init() {
      const s: FullCandleRun = {
        markers: [], flags: [[], []], times: [[], []], steps: [], vars: { lastSignal: 'none' }, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const close = bars[i].close;
      const high1 = i >= 1 ? bars[i - 1].high : NaN;
      const low1 = i >= 1 ? bars[i - 1].low : NaN;
      const high2 = i >= 2 ? bars[i - 2].high : NaN;
      const low2 = i >= 2 ? bars[i - 2].low : NaN;
      const isNewHigher = gt(close, high1) && le(low1, high2);
      const isNewLower = lt(close, low1) && ge(high1, low2);

      const v = s.vars;
      const newHigher = isNewHigher && v.lastSignal !== 'newHigher';
      const newLower = isNewLower && v.lastSignal !== 'newLower';

      const t = bars[i].time as number;
      // alertcondition(newHigher, "Higher Flag") / alertcondition(newLower, "Lower Flag")
      s.flags[0][i] = newHigher;
      s.flags[1][i] = newLower;
      if (newHigher) s.times[0].push(t);
      if (newLower) s.times[1].push(t);
      if (newHigher) v.lastSignal = 'newHigher';
      else if (newLower) v.lastSignal = 'newLower';

      // plotshape(newHigher, 'Higher', shape.labelup, location.belowbar, color.green, text = 'Higher', textcolor = color.white, size = size.tiny)
      if (newHigher) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'Higher', textColor: color.white, size: 'tiny' });
      }
      // plotshape(newLower, 'Lower', shape.labeldown, location.abovebar, color.red, text = 'Lower', textcolor = color.white, size = size.tiny)
      if (newLower) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'Lower', textColor: color.white, size: 'tiny' });
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<FullCandleHigherLowerInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(), chart);
}

export function calculate(
  bars: Bar[],
  _inputs: Partial<FullCandleHigherLowerInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(_inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Higher Flag', message: 'Higher flag detected' },
  { id: 'alert1', title: 'Lower Flag', message: 'Lower flag detected' },
];

export const FullCandleHigherLower = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
