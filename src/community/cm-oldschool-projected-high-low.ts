/**
 * CM Old School Projected High / Low
 *
 * Projected high and low of the next period (formula of Owen Taylor, as given by Larry Williams):
 * pf = 2 * hlc3, projected low = pf - high, projected high = pf - low, taken from the previous bar of the daily,
 * weekly, monthly, quarterly and yearly timeframes. Each level is yellow, red when the close is below the projected
 * low and lime when the close is above the projected high. The daily levels are shown by default.
 *
 * Other timeframes: the bars of each timeframe are built from the chart bars (periods from the UTC calendar and the
 * bars, see src/anchor-period.ts). As in the original (a version 1 script), every chart bar of a period shows the
 * value of that period (here the levels of the period before, so the value is known from the first bar of the
 * period). A timeframe below the chart timeframe needs data that the bars do not carry: the port throws an Error
 * when such a level is switched on.
 *
 * Periods and the chart context (optional third argument of calculate): with the exchange time zone and the session
 * of the symbol (`timezone`, `session`) the periods are those of the exchange calendar (its trading days, holidays
 * and session hours), see src/anchor-period.ts. Without them the port uses the UTC calendar and the bars.
 * `timeframe`, when given, is the chart timeframe; without it the chart timeframe is read from the bar spacing.
 *
 * Reference: "CM_OldSchool_Projected_high_Low" by ChrisMoody
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Created by ChrisMoody 7-21-2014. Daily, Weekly, Monthly, Quarterly, Yearly Projected Highs and
 * Lows. Obtained formula from Larry Williams, original formula from Owen Taylor.
 */

import {
  color, timeframe, resample, mapToChart,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import { periodStarts, chartTimeframe, securityBars } from '../anchor-period';
import type { ChartContext } from '../chart-context';

export interface CmOldschoolProjectedHighLowInputs {
  /** Show Daily Projected High Low? */
  sd: boolean;
  /** Show Weekly Projected High Low? */
  sw: boolean;
  /** Show Monthly Projected High Low? */
  sm: boolean;
  /** Show Quarterly Projected High Low? */
  sq: boolean;
  /** Show Yearly Projected High Low? */
  sy: boolean;
}

export const defaultInputs: CmOldschoolProjectedHighLowInputs = {
  sd: true,
  sw: false,
  sm: false,
  sq: false,
  sy: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'sd', type: 'bool', title: 'Show Daily Projected High Low?', defval: true },
  { id: 'sw', type: 'bool', title: 'Show Weekly Projected High Low?', defval: false },
  { id: 'sm', type: 'bool', title: 'Show Monthly Projected High Low?', defval: false },
  { id: 'sq', type: 'bool', title: 'Show Quarterly Projected High Low?', defval: false },
  { id: 'sy', type: 'bool', title: 'Show Yearly Projected High Low?', defval: false },
];

// Colour constants of Pine version 1, with the default plot transparency of that version (35)
const V1 = (hex: string) => String(color.new(hex, 35));
const RED = V1('#FF0000');
const YELLOW = V1('#FFFF00');
const LIME = V1('#00FF00');

/** The five timeframes: input, Pine timeframe, title prefix, plot style and width */
const LEVELS = [
  { key: 'sd', tf: 'D', name: 'Daily', style: 'circles', width: 3 },
  { key: 'sw', tf: 'W', name: 'Weekly', style: 'circles', width: 4 },
  { key: 'sm', tf: 'M', name: 'Monthly', style: 'cross', width: 3 },
  { key: 'sq', tf: '3M', name: 'Quarterly', style: 'cross', width: 3 },
  { key: 'sy', tf: '12M', name: 'Yearly', style: 'cross', width: 3 },
] as const;

export const plotConfig: PlotConfig[] = LEVELS.flatMap((l, k) => [
  { id: `plot${2 * k}`, title: `${l.name} Projected Low`, color: RED, lineWidth: l.width, style: l.style },
  { id: `plot${2 * k + 1}`, title: `${l.name} Projected High`, color: LIME, lineWidth: l.width, style: l.style },
]);

export const metadata = {
  title: 'CM_OldSchool_Projected_High_Low',
  shortTitle: 'CM_OS_Proj_H_L',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
/** A number used as a condition: na and 0 are false */
const truthy = (v: number) => !isNaN(v) && v !== 0;

/**
 * security(tickerid, tf, ...) on the chart symbol: the bars of timeframe `tf` built from the chart bars, and the
 * function that brings one value per bar of that timeframe back to the chart bars. Version 1 rule: every chart bar
 * of a period shows the value of the period (no gaps).
 */
function timeframeBars(
  bars: Bar[],
  tf: string,
  context?: ChartContext,
): { htf: Bar[]; toChart: (values: number[]) => number[] } | null {
  const chart = chartTimeframe(bars, context);
  if (chart === '' || timeframe.in_seconds(tf) === timeframe.in_seconds(chart)) {
    return { htf: bars, toChart: (values) => values };
  }
  // a timeframe below the chart timeframe: the bars do not carry that data
  if (timeframe.in_seconds(tf) < timeframe.in_seconds(chart)) return null;
  // With the exchange calendar of the chart context (time zone and session): the periods come from the library rule
  // (see anchor-period.ts); without it, the periods of the UTC calendar and the bars, grouped by the library
  const exchange = securityBars(bars, tf, context);
  const { bars: htf, group } = exchange ? { bars: exchange.htf, group: exchange.group } : resample(bars, periodStarts(bars, tf));
  return { htf, toChart: (values) => mapToChart(values, group, [], true, false) };
}

export function calculate(
  bars: Bar[],
  inputs: Partial<CmOldschoolProjectedHighLowInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const plots: IndicatorResult['plots'] = {};

  LEVELS.forEach((l, k) => {
    const show = cfg[l.key];
    let lows: number[] = new Array(n).fill(NaN);
    let highs: number[] = new Array(n).fill(NaN);
    // the levels are computed when hidden too: the plot colours read them
    const security = timeframeBars(bars, l.tf, chart);
    if (!security && show) {
      throw new Error(`The timeframe "${l.tf}" is lower than the chart timeframe: the bars do not carry that data.`);
    }
    if (security) {
      const { htf, toChart } = security;
      // pf = hlc3 * 2, pl = pf - high, ph = pf - low; security(tickerid, tf, pl[1]) / (ph[1])
      const pf = htf.map((b) => ((b.high + b.low + b.close) / 3) * 2);
      const pl = htf.map((b, g) => pf[g] - b.high);
      const ph = htf.map((b, g) => pf[g] - b.low);
      lows = toChart(pl.map((_v, g) => (g > 0 ? pl[g - 1] : NaN)));
      highs = toChart(ph.map((_v, g) => (g > 0 ? ph[g - 1] : NaN)));
    }
    const low: IndicatorResult['plots'][string] = [];
    const high: IndicatorResult['plots'][string] = [];
    for (let i = 0; i < n; i++) {
      const c = bars[i].close;
      // plot(show and level ? level : na); colour close < pl ? red : yellow, close > ph ? lime : yellow
      low.push({ time: bars[i].time, value: show && truthy(lows[i]) ? lows[i] : NaN, color: lt(c, lows[i]) ? RED : YELLOW });
      high.push({ time: bars[i].time, value: show && truthy(highs[i]) ? highs[i] : NaN, color: gt(c, highs[i]) ? LIME : YELLOW });
    }
    plots[`plot${2 * k}`] = low;
    plots[`plot${2 * k + 1}`] = high;
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
  };
}

export const CmOldschoolProjectedHighLow = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
