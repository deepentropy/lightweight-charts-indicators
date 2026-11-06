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
import { periodStarts, chartTimeframe, hasCalendar, securityBars } from '../anchor-period';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

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

type Point = { time: number; value: number; color: string };

/** Start (UNIX ms, UTC) of the D / W / M calendar period of the day `day` (the UTC rule of `periodStarts`) */
function calendarPeriodStart(day: number, info: ReturnType<typeof timeframe.info>): number {
  const DAY = 86400000;
  const WEEK = 7 * DAY;
  const n = info.multiplier;
  const d = new Date(day);
  const year = d.getUTCFullYear();
  if (info.isdaily) {
    if (n === 1) return day;
    const jan1 = Date.UTC(year, 0, 1);
    return jan1 + Math.floor((day - jan1) / DAY / n) * n * DAY;
  }
  if (info.isweekly) {
    const monday = day - ((d.getUTCDay() + 6) % 7) * DAY;
    if (n === 1) return monday;
    const jan1 = Date.UTC(new Date(monday).getUTCFullYear(), 0, 1);
    const firstMonday = jan1 + ((8 - new Date(jan1).getUTCDay()) % 7) * DAY;
    return firstMonday + Math.floor((monday - firstMonday) / WEEK / n) * n * WEEK;
  }
  return Date.UTC(year, Math.floor(d.getUTCMonth() / n) * n, 1);
}

/** One timeframe of the run: how its periods are found, the bar of the current period, the levels of the previous one */
interface TfState {
  /**
   * 'chart': each chart bar is a period; 'utc': the UTC calendar periods; 'none': a timeframe below the chart
   * timeframe (na levels); 'pre': levels computed on all bars (exchange calendar)
   */
  mode: 'chart' | 'utc' | 'none' | 'pre';
  info: ReturnType<typeof timeframe.info> | null;
  pre: { lows: number[]; highs: number[] } | null;
  /** Period key of the current period, its high / low / close */
  key: number;
  high: number;
  low: number;
  close: number;
  /** pl / ph of the previous period */
  prevLow: number;
  prevHigh: number;
}

interface CmoRun extends BarRunState<{ tfs: TfState[] }> {
  plots: Point[][];
}

function study(inputs: Partial<CmOldschoolProjectedHighLowInputs>): BarStudy<CmoRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  let inMs = false;
  return {
    // the chart timeframe comes from the bar gaps, the time unit from the first bar
    key: (bars, chart) => `${chartTimeframe(bars, chart)}|${bars.length > 0 && bars[0].time >= 1e12}`,
    // with the exchange calendar the periods come from the calendar of the whole bar set
    fullRunReason: (chart) => (hasCalendar(chart) ? 'exchange calendar periods' : null),
    init(bars, chart) {
      inMs = bars.length > 0 && bars[0].time >= 1e12;
      const chartTf = chartTimeframe(bars, chart);
      const tfs: TfState[] = LEVELS.map((l) => {
        const show = cfg[l.key];
        const st: TfState = {
          mode: 'chart', info: null, pre: null, key: NaN, high: NaN, low: NaN, close: NaN, prevLow: NaN, prevHigh: NaN,
        };
        // the levels are computed when hidden too: the plot colours read them
        if (chartTf === '' || timeframe.in_seconds(l.tf) === timeframe.in_seconds(chartTf)) return st;
        // a timeframe below the chart timeframe: the bars do not carry that data
        if (timeframe.in_seconds(l.tf) < timeframe.in_seconds(chartTf)) {
          if (show) throw new Error(`The timeframe "${l.tf}" is lower than the chart timeframe: the bars do not carry that data.`);
          st.mode = 'none';
          return st;
        }
        if (hasCalendar(chart)) {
          const security = timeframeBars(bars, l.tf, chart);
          if (security) {
            const { htf, toChart } = security;
            // pf = hlc3 * 2, pl = pf - high, ph = pf - low; security(tickerid, tf, pl[1]) / (ph[1])
            const pf = htf.map((b) => ((b.high + b.low + b.close) / 3) * 2);
            const pl = htf.map((b, g) => pf[g] - b.high);
            const ph = htf.map((b, g) => pf[g] - b.low);
            st.mode = 'pre';
            st.pre = {
              lows: toChart(pl.map((_v, g) => (g > 0 ? pl[g - 1] : NaN))),
              highs: toChart(ph.map((_v, g) => (g > 0 ? ph[g - 1] : NaN))),
            };
            return st;
          }
        }
        st.mode = 'utc';
        st.info = timeframe.info(l.tf);
        return st;
      });
      const s: CmoRun = { plots: LEVELS.flatMap(() => [[], []]), steps: [], vars: { tfs }, lists: [], series: [] };
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const c = b.close;
      // changed in place: copyVars copies them at the end of the last confirmed bar
      const tfs = s.vars.tfs;
      for (let k = 0; k < LEVELS.length; k++) {
        const st = tfs[k];
        let low = NaN;
        let high = NaN;
        if (st.mode === 'pre') {
          low = st.pre!.lows[i];
          high = st.pre!.highs[i];
        } else if (st.mode !== 'none') {
          // security(tickerid, tf, pl[1]) / (ph[1]): the levels of the bar of the previous period
          let key: number;
          if (st.mode === 'chart') key = i;
          else {
            const t = inMs ? time : time * 1000;
            key = calendarPeriodStart(Math.floor(t / 86400000) * 86400000, st.info!);
          }
          if (i === 0 || key !== st.key) {
            if (i > 0) {
              // pf = hlc3 * 2, pl = pf - high, ph = pf - low
              const pf = ((st.high + st.low + st.close) / 3) * 2;
              st.prevLow = pf - st.high;
              st.prevHigh = pf - st.low;
            }
            st.key = key;
            st.high = b.high;
            st.low = b.low;
            st.close = b.close;
          } else {
            st.high = Math.max(st.high, b.high);
            st.low = Math.min(st.low, b.low);
            st.close = b.close;
          }
          low = st.prevLow;
          high = st.prevHigh;
        }
        const show = cfg[LEVELS[k].key];
        // plot(show and level ? level : na); colour close < pl ? red : yellow, close > ph ? lime : yellow
        s.plots[2 * k][i] = { time, value: show && truthy(low) ? low : NaN, color: lt(c, low) ? RED : YELLOW };
        s.plots[2 * k + 1][i] = { time, value: show && truthy(high) ? high : NaN, color: gt(c, high) ? LIME : YELLOW };
      }
    },
    copyVars: (v) => ({ tfs: v.tfs.map((t) => ({ ...t })) }),
    result(s) {
      const plots: IndicatorResult['plots'] = {};
      s.plots.forEach((p, j) => { plots[`plot${j}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CmOldschoolProjectedHighLowInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<CmOldschoolProjectedHighLowInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const CmOldschoolProjectedHighLow = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
