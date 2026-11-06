/**
 * Quasimodo Pattern
 *
 * Three-candle pattern. Bullish: a bearish candle, then a bullish candle with a lower low, then a bar whose low is
 * above the high of the first candle. Bearish: a bullish candle, then a bearish candle with a higher high, then a bar
 * whose high is below the low of the first candle. The first candle of the pattern is coloured (barcolor with
 * offset -2: the colour of bar i is drawn on bar i - 2): yellow for bullish, magenta for bearish.
 * Alerts (alertcondition, `alerts` of the result): 'Quasimodo Pattern', true on the third bar of either pattern.
 *
 * Reference: "Quasimodo Pattern" by anodrr2
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Quasimodo Pattern', message: 'A Quasimodo Pattern has appeared!' },
];

export interface QuasimodoPatternInputs {}

export const defaultInputs: QuasimodoPatternInputs = {};

export const inputConfig: InputConfig[] = [];

// Bar colours only (barcolor)
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Quasimodo Pattern',
  shortTitle: 'Quasimodo Pattern',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface QuasimodoRun extends BarRunState<Record<string, never>> {
  barColors: BarColorData[];
  flags: boolean[];
  times: number[];
}

function study(): BarStudy<QuasimodoRun, Result> {
  const bullColor = String(color.rgb(240, 243, 33));
  const bearColor = String(color.rgb(255, 0, 191));
  return {
    init() {
      const s: QuasimodoRun = { barColors: [], flags: [], times: [], steps: [], vars: {}, lists: [], series: [] };
      s.lists = [s.barColors, s.times];
      s.series = [s.flags];
      return s;
    },
    bar(s, i, bars) {
      s.flags[i] = false;
      if (i < 2) return;
      const b = bars[i];
      const b1 = bars[i - 1];
      const b2 = bars[i - 2];
      const bullishQuasimodo = gt(b.low, b2.high) && gt(b1.close, b1.open) && lt(b2.close, b2.open) && gt(b2.low, b1.low);
      const bearishQuasimodo = lt(b.high, b2.low) && lt(b1.close, b1.open) && gt(b2.close, b2.open) && gt(b1.high, b2.high);
      const f = bullishQuasimodo || bearishQuasimodo;
      s.flags[i] = f;
      if (f) s.times.push(b.time as number);
      // barcolor(..., offset = -2): drawn on bar i - 2; the second barcolor call is drawn over the first one
      if (bearishQuasimodo) s.barColors.push({ time: b2.time, color: bearColor });
      else if (bullishQuasimodo) s.barColors.push({ time: b2.time, color: bullColor });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        barColors: s.barColors.slice(),
        // alertcondition(bullishQuasimodo or bearishQuasimodo, "Quasimodo Pattern"): on the bar of the condition
        alerts: liveAlertStates(alertConditions, [s.times], [n > 0 && s.flags[n - 1]]),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<QuasimodoPatternInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(), chart);
}

export function calculate(bars: Bar[], _inputs: Partial<QuasimodoPatternInputs> = {}): Result {
  return fullResult(createRun(_inputs).update(bars));
}

export const QuasimodoPattern = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
