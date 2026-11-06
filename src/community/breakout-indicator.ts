/**
 * Breakout Indicator
 *
 * Draws a long and a short breakout price from a start time, shifted `offset` bars to the right.
 * A price of 0 hides its line (Pine inputs are picked on the chart; the defaults are 0).
 * Alert (alertcondition, `alerts` of the result): 'Breakout Alert!', true when the close is above the long price or
 * below the short price (prices above 0, from the breakout time).
 *
 * Reference: "Breakout Indicator" by ZenAndTheArtOfTrading
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { barTime, barInterval } from '../bar-time';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertcondition */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Breakout Alert!', message: 'Breakout signal for {{ticker}}' },
];

export interface BreakoutIndicatorInputs {
  /** Breakout time (UNIX ms, Pine input.time); 0 = from the first bar */
  timeBreakout: number;
  /** Long breakout price (Pine input.price); 0 = no long line */
  longBreakout: number;
  /** Short breakout price (Pine input.price); 0 = no short line */
  shortBreakout: number;
  /** Plot offset in bars */
  offset: number;
}

export const defaultInputs: BreakoutIndicatorInputs = {
  timeBreakout: 0,
  longBreakout: 0,
  shortBreakout: 0,
  offset: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'timeBreakout', type: 'time', title: 'Breakout Time', defval: 0 },
  { id: 'longBreakout', type: 'float', title: 'Long Breakout Price', defval: 0 },
  { id: 'shortBreakout', type: 'float', title: 'Short Breakout Price', defval: 0 },
  { id: 'offset', type: 'int', title: 'Offset', defval: 5 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Long Breakout Price', color: color.green, lineWidth: 1 },
  { id: 'plot1', title: 'Short Breakout Price', color: color.red, lineWidth: 1 },
];

export const metadata = {
  title: 'Breakout Indicator',
  shortTitle: 'BKOI',
  overlay: true,
};

type Result = IndicatorResult & { alerts: AlertConditionState[] };

interface BreakoutRun extends BarRunState<Record<string, never>> {
  longVal: number[];
  shortVal: number[];
  alertFlags: boolean[];
  times: number[][];
}

function study(inputs: Partial<BreakoutIndicatorInputs>): BarStudy<BreakoutRun, Result> {
  const { timeBreakout, longBreakout, shortBreakout, offset } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: BreakoutRun = { longVal: [], shortVal: [], alertFlags: [], times: [[]], steps: [], vars: {}, lists: [], series: [] };
      s.lists = [...s.times];
      s.series = [s.longVal, s.shortVal, s.alertFlags];
      return s;
    },
    bar(s, i, bars) {
      // Pine values on bar i (time is the bar open time in ms)
      const started = bars[i].time * 1000 >= timeBreakout;
      s.longVal[i] = longBreakout > 0 && started ? longBreakout : NaN;
      s.shortVal[i] = shortBreakout > 0 && started ? shortBreakout : NaN;
      // longAlert = longBreakout > 0 and close > longBreakout and time >= timeBreakout (shortAlert: close < shortBreakout)
      const longAlert = longBreakout > 0 && bars[i].close > longBreakout && started;
      const shortAlert = shortBreakout > 0 && bars[i].close < shortBreakout && started;
      const flag = longAlert || shortAlert;
      s.alertFlags[i] = flag;
      if (flag) s.times[0].push(bars[i].time as number);
    },
    result(s, bars) {
      const n = bars.length;
      const interval = barInterval(bars);
      // plot(..., offset = k): the value of bar i is drawn on bar i + k (k bars after the last bar for the last values)
      const shifted = (vals: number[]) =>
        Array.from({ length: n + Math.max(0, offset) }, (_, j) => {
          const src = j - offset;
          return { time: barTime(bars, j, interval), value: src >= 0 && src < n ? vals[src] : NaN };
        });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: shifted(s.longVal), plot1: shifted(s.shortVal) },
        // alertcondition(longAlert or shortAlert, "Breakout Alert!")
        alerts: liveAlertStates(alertConditions, s.times, [n > 0 && s.alertFlags[n - 1]]),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BreakoutIndicatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<BreakoutIndicatorInputs> = {},
): IndicatorResult & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const BreakoutIndicator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
