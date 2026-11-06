/**
 * Inside Bar (Body-based)
 *
 * An inside bar here compares candle bodies: the body high (max of open and close) is below the previous body high
 * and the body low (min of open and close) is above the previous body low. A green inside bar (close >= open) is
 * coloured green with a green triangle above the bar; a red inside bar is coloured red with a red triangle below the
 * bar. An orange circle above the bar marks two bars in a row (the current and the previous bar) inside the body of
 * the bar two bars back (the mother bar).
 *
 * Alerts: the two alertcondition() calls of the original, "Inside Bar (Body)" (an inside bar of either colour) and
 * "Next Candle Also Inside Bar (Body)" (the orange circle).
 *
 * Reference: "Inside Bar (Body-based) Ind/Alert" by s_b_j
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type InsideBarIndAlertInputs = Record<string, never>;

export const defaultInputs: InsideBarIndAlertInputs = {};

export const inputConfig: InputConfig[] = [];

// Only bar colours (barcolor) and markers (plotshape): no line plots
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Inside Bar (Body-based) Ind/Alert',
  shortTitle: 'Inside Bar (Body-based) Ind/Alert',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface IbiaRun extends BarRunState<Record<string, never>> {
  markers: MarkerData[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

// getBodyHighLow(open[k], close[k]): math.max / math.min (na before bar 0)
const bodyHigh = (bars: Bar[], k: number) => (k >= 0 ? Math.max(bars[k].open, bars[k].close) : NaN);
const bodyLow = (bars: Bar[], k: number) => (k >= 0 ? Math.min(bars[k].open, bars[k].close) : NaN);

function study(): BarStudy<IbiaRun, Result> {
  return {
    init() {
      const s: IbiaRun = { markers: [], barColors: [], flags: [[], []], times: [[], []], steps: [], vars: {}, lists: [], series: [] };
      s.lists = [s.markers, s.barColors, ...s.times];
      s.series = s.flags;
      return s;
    },
    bar(s, i, bars) {
      const t = bars[i].time;
      const curBodyHigh = bodyHigh(bars, i);
      const curBodyLow = bodyLow(bars, i);
      const prevBodyHigh = bodyHigh(bars, i - 1);
      const prevBodyLow = bodyLow(bars, i - 1);
      const isInsideBody = lt(curBodyHigh, prevBodyHigh) && gt(curBodyLow, prevBodyLow);
      const bodyStatus = ge(bars[i].close, bars[i].open) ? 1 : -1;
      const insideSignal = isInsideBody ? bodyStatus : 0;

      // barcolor(insideSignal == 1 ? color.green : na); barcolor(insideSignal == -1 ? color.red : na)
      if (insideSignal === 1) s.barColors.push({ time: t, color: color.green });
      if (insideSignal === -1) s.barColors.push({ time: t, color: color.red });

      // plotshape(insideSignal == 1, triangleup, abovebar, color.green)
      if (insideSignal === 1) s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleUp', color: color.green });
      // plotshape(insideSignal == -1, triangledown, belowbar, color.red)
      if (insideSignal === -1) s.markers.push({ time: t, position: 'belowBar', shape: 'triangleDown', color: color.red });

      // Mother bar two bars back: current and previous body inside its body
      const motherBodyHigh = bodyHigh(bars, i - 2);
      const motherBodyLow = bodyLow(bars, i - 2);
      const curInMother = lt(curBodyHigh, motherBodyHigh) && gt(curBodyLow, motherBodyLow);
      const prevInMother = lt(prevBodyHigh, motherBodyHigh) && gt(prevBodyLow, motherBodyLow);
      const doubleInside = curInMother && prevInMother;
      // plotshape(doubleInside, circle, abovebar, color.orange, size.tiny, 'Two-in-a-row (body)')
      if (doubleInside) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'circle', color: color.orange, size: 'tiny' });
      }
      // isInsideBarMade = insideSignal != 0
      const inside = insideSignal !== 0;
      s.flags[0][i] = inside;
      s.flags[1][i] = doubleInside;
      if (inside) s.times[0].push(t as number);
      if (doubleInside) s.times[1].push(t as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        // alertcondition(isInsideBarMade) / alertcondition(doubleInside)
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<InsideBarIndAlertInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<InsideBarIndAlertInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}


/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Inside Bar (Body)', message: 'Inside Bar (body) came up!' },
  { id: 'alert1', title: 'Next Candle Also Inside Bar (Body)', message: 'Two-in-a-row: current and previous bar inside mother body' },
];

export const InsideBarIndAlert = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
