/**
 * 3 Bar Reversal
 *
 * a = bars since close >= close[1], b = bars since close <= close[1]. When a or b equals 3 (three closes in a row
 * against the last up / down close), the bar two bars back is coloured purple (barcolor with offset -2: the colour
 * of bar i is drawn on bar i - 2). A lime triangle below the bar when b == 4 and a red triangle above the bar when
 * a == 4.
 * Alert (alertcondition, `alerts` of the result): 'Market Reversal', true on the bars where a or b equals 3.
 *
 * Reference: "3 Bar Reversal" by abbadon9
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © abbadon9
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ThreeBarReversalInputs {}

export const defaultInputs: ThreeBarReversalInputs = {};

export const inputConfig: InputConfig[] = [];

// Markers and bar colours only (plotshape, barcolor)
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: '3 Bar Reversal',
  shortTitle: '3 BAR',
  overlay: true,
};

/** Pine float comparisons: equal within 1e-10; na compares false */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface ThreeBarRun extends BarRunState<Record<string, never>> {
  a: ReturnType<typeof taStep.barssince>;
  b: ReturnType<typeof taStep.barssince>;
  markers: MarkerData[];
  barColors: BarColorData[];
  reversal: boolean[];
  times: number[][];
}

function study(): BarStudy<ThreeBarRun, Result> {
  return {
    init() {
      const a = taStep.barssince();
      const b = taStep.barssince();
      const s: ThreeBarRun = { a, b, markers: [], barColors: [], reversal: [], times: [[]], steps: [a, b], vars: {}, lists: [], series: [] };
      s.lists = [s.markers, s.barColors, ...s.times];
      s.series = [s.reversal];
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i];
      const prev = i > 0 ? bars[i - 1].close : NaN;
      const up = ge(bar.close, prev); // close >= close[1]
      const down = le(bar.close, prev); // close <= close[1]
      const a = s.a.step(up ? 1 : 0);
      const b = s.b.step(down ? 1 : 0);
      const t = bar.time as number;
      // alertcondition(ta.barssince(close >= close[1]) == 3 or ta.barssince(close <= close[1]) == 3, ...)
      const reversal = b === 3 || a === 3;
      s.reversal[i] = reversal;
      if (reversal) s.times[0].push(t);
      // barcolor(isReversing() ? color.purple : na, offset = -2): drawn on bar i - 2
      if ((b === 3 || a === 3) && i >= 2) s.barColors.push({ time: bars[i - 2].time as number, color: color.purple });
      if (b === 4) s.markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: color.lime, size: 'tiny' });
      if (a === 4) s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'tiny' });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, [n > 0 && s.reversal[n - 1]]),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<ThreeBarReversalInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(), chart);
}

export function calculate(
  bars: Bar[],
  _inputs: Partial<ThreeBarReversalInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(_inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Market Reversal', message: 'REVERSAL' },
];

export const ThreeBarReversal = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
