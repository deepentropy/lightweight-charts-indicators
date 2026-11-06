/**
 * Strong Engulfing Candlestick (With Alerts)
 *
 * Bullish engulfing: a green bar after a red bar, with a high at or above the previous high, a low at or below the
 * previous low and a body larger than the previous body. Bearish engulfing: the same with a red bar after a green
 * bar. A green label below the bar marks a bullish engulfing, a red label above the bar a bearish engulfing.
 *
 * Alerts: the two alertcondition() calls of the original, "Bullish Engulfing Alert" and "Bearish Engulfing Alert",
 * true on the bars of the bullish / bearish engulfing labels.
 *
 * Reference: "Strong Engulfing Candlestick (With Alerts)" by kyjefive
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type StrongEngulfingCandlestickInputs = Record<string, never>;

export const defaultInputs: StrongEngulfingCandlestickInputs = {};

export const inputConfig: InputConfig[] = [];

// Only markers (plotshape): no line plots
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Strong Engulfing Candlestick (With Alerts)',
  shortTitle: 'Strong Engulfing Candlestick (With Alerts)',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface EngulfingRun extends BarRunState<Record<string, never>> {
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(): BarStudy<EngulfingRun, Result> {
  return {
    init() {
      const s: EngulfingRun = { markers: [], flags: [[], []], times: [[], []], steps: [], vars: {}, lists: [], series: [] };
      s.lists = [s.markers, ...s.times];
      s.series = [...s.flags];
      return s;
    },
    bar(s, i, bars) {
      let bullish = false;
      let bearish = false;
      const b = bars[i];
      if (i >= 1) {
        const p = bars[i - 1];
        bullish = gt(b.close, b.open) && lt(p.close, p.open) && ge(b.high, p.high) && le(b.low, p.low)
          && gt(b.close - b.open, p.open - p.close);
        bearish = lt(b.close, b.open) && gt(p.close, p.open) && ge(b.high, p.high) && le(b.low, p.low)
          && gt(b.open - b.close, p.close - p.open);
        // plotshape(bullish_engulfing, location.belowbar, shape.labelup, color.green, size = size.small)
        if (bullish) s.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: color.green, size: 'small' });
        // plotshape(bearish_engulfing, location.abovebar, shape.labeldown, color.red, size = size.small)
        if (bearish) s.markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: color.red, size: 'small' });
      }
      s.flags[0][i] = bullish;
      s.flags[1][i] = bearish;
      if (bullish) s.times[0].push(b.time as number);
      if (bearish) s.times[1].push(b.time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        // alertcondition(bullish_engulfing) / alertcondition(bearish_engulfing)
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<StrongEngulfingCandlestickInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(), chart);
}

export function calculate(bars: Bar[], inputs: Partial<StrongEngulfingCandlestickInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Engulfing Alert', message: 'Strong Bullish Engulfing detected!' },
  { id: 'alert1', title: 'Bearish Engulfing Alert', message: 'Strong Bearish Engulfing detected!' },
];

export const StrongEngulfingCandlestick = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
