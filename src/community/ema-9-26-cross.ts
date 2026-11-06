/**
 * EMA 9 / 26 Cross
 *
 * The EMA 9 and the EMA 26 of the close. An X mark is drawn at the EMA 9 value on the bars where the EMA 9 crosses
 * above (Buy X) or below (Sell X) the EMA 26.
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Cross' and 'Bearish Cross', true on the bars of each
 * cross.
 *
 * Reference: "EMA 9 / 26 Cross" by h0s1m001
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © h0s1m001
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The Pine script has no inputs */
export interface Ema926CrossInputs {}

export const defaultInputs: Ema926CrossInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA 9', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'EMA 26', color: color.blue, lineWidth: 1 },
];

export const metadata = {
  title: 'EMA 9 / 26 Cross',
  shortTitle: 'EMA 9 / 26 Cross',
  overlay: true,
};

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface Ema926CrossRun extends BarRunState<Record<string, never>> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  over: ReturnType<typeof taStep.crossover>;
  under: ReturnType<typeof taStep.crossunder>;
  plot0: Point[];
  plot1: Point[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(): BarStudy<Ema926CrossRun, Result> {
  return {
    init() {
      const fast = taStep.ema(9);
      const slow = taStep.ema(26);
      const over = taStep.crossover();
      const under = taStep.crossunder();
      const s: Ema926CrossRun = {
        fast, slow, over, under, plot0: [], plot1: [], markers: [], flags: [[], []], times: [[], []],
        steps: [fast, slow, over, under], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const fast = s.fast.step(b.close) ?? NaN;
      const slow = s.slow.step(b.close) ?? NaN;
      const bull = s.over.step(fast, slow);
      const bear = s.under.step(fast, slow);
      // plotshape(bullCross ? fastEMA : na, "Buy X", shape.xcross, location.absolute, size.normal, color.blue)
      if (bull && !isNaN(fast)) {
        s.markers.push({ id: 'shape0', time: b.time, position: 'atPriceMiddle', price: fast, shape: 'xcross', color: color.blue, size: 'normal' });
      }
      // plotshape(bearCross ? fastEMA : na, "Sell X", shape.xcross, location.absolute, size.normal, color.blue)
      if (bear && !isNaN(fast)) {
        s.markers.push({ id: 'shape1', time: b.time, position: 'atPriceMiddle', price: fast, shape: 'xcross', color: color.blue, size: 'normal' });
      }
      s.plot0[i] = { time: b.time, value: fast };
      s.plot1[i] = { time: b.time, value: slow };
      [Boolean(bull), Boolean(bear)].forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(b.time as number);
      });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        markers: s.markers.slice(),
        // alertcondition(bullCross, "Bullish Cross") / alertcondition(bearCross, "Bearish Cross")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<Ema926CrossInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(), chart);
}

export function calculate(bars: Bar[], _inputs: Partial<Ema926CrossInputs> = {}): Result {
  return fullResult(createRun(_inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Cross', message: 'EMA 9 crossed above EMA 26' },
  { id: 'alert1', title: 'Bearish Cross', message: 'EMA 9 crossed below EMA 26' },
];

export const Ema926Cross = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
