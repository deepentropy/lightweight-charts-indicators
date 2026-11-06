/**
 * CM High Low Open Close (daily, weekly and monthly)
 *
 * Open, close, high and low of the current and of the previous bar of three timeframes of the same symbol (daily,
 * weekly and monthly), each switched on by its own input. Current values are drawn as circles, previous values as
 * crosses. A value of 0 is not drawn (`show and value ? value : na`).
 *
 * The bars of each timeframe are built from the chart bars (periods from the UTC calendar and the bars, see
 * src/anchor-period.ts). As in the original (a version 1 script), every chart bar of a period shows the values of
 * that period (the last period is still open). A timeframe equal to the chart timeframe is the chart series itself.
 * A timeframe below the chart timeframe needs data that the bars do not carry: the port throws an Error when such a
 * group is switched on.
 *
 * Periods and the chart context (optional third argument of calculate): with the exchange time zone and the session
 * of the symbol (`timezone`, `session`) the periods are those of the exchange calendar (its trading days, holidays
 * and session hours), and a bar of a higher timeframe is complete on the chart bar whose close reaches the end of
 * its period, see src/anchor-period.ts.
 * Without them the port uses the UTC calendar and the bars, as described in this header. `timeframe`, when given,
 * is the chart timeframe; without it the chart timeframe is read from the bar spacing.
 *
 * Reference: "Code Plots - High, Low, Open, Close—Daily, Weekly, & Monthly!!!" by ChrisMoody
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  color, timeframe, resample, mapToChart,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import { periodStarts, chartTimeframe, hasCalendar, securityBars } from '../anchor-period';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CodePlotsHighLowOpenCloseDailyWeeklyInputs {
  /** Show Todays OHLC? */
  st: boolean;
  /** Show Yesterdays OHLC? */
  sy: boolean;
  /** Show This Weeks OHLC? */
  swt: boolean;
  /** Show Previous Weeks OHLC? */
  swy: boolean;
  /** Show Monthly OHLC? */
  smh: boolean;
  /** Show Previous Months OHLC? */
  spmh: boolean;
}

export const defaultInputs: CodePlotsHighLowOpenCloseDailyWeeklyInputs = {
  st: true,
  sy: false,
  swt: false,
  swy: false,
  smh: false,
  spmh: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'st', type: 'bool', title: 'Show Todays OHLC?', defval: true },
  { id: 'sy', type: 'bool', title: 'Show Yesterdays OHLC?', defval: false },
  { id: 'swt', type: 'bool', title: 'Show This Weeks OHLC?', defval: false },
  { id: 'swy', type: 'bool', title: 'Show Previous Weeks OHLC?', defval: false },
  { id: 'smh', type: 'bool', title: 'Show Monthly OHLC?', defval: false },
  { id: 'spmh', type: 'bool', title: 'Show Previous Months OHLC?', defval: false },
];

// Colour constants of Pine version 1, with the default plot transparency of that version (35)
const V1 = (hex: string) => String(color.new(hex, 35));
const SILVER = V1('#C0C0C0');
const FUCHSIA = V1('#FF00FF');
const GREEN = V1('#008000');
const LIME = V1('#00FF00');
const RED = V1('#FF0000');

type Key = keyof CodePlotsHighLowOpenCloseDailyWeeklyInputs;

/** The three groups: timeframe, inputs, plot titles of the group, line width and high colour */
const GROUPS: Array<{ tf: string; current: Key; previous: Key; titles: string[]; width: number; highColor: string }> = [
  {
    tf: 'D', current: 'st', previous: 'sy', width: 2, highColor: LIME,
    titles: ['Daily Open', 'Previous Days Open', 'Daily Close', 'Previous Days Close', 'Daily High',
      'Previous Daily High', 'Daily Low', 'Previous Daily Low'],
  },
  {
    tf: 'W', current: 'swt', previous: 'swy', width: 3, highColor: GREEN,
    titles: ['Weekly Open', 'Previous Weeks Open', 'Weekly Close', 'Previous Weeks Close', 'Weekly High',
      'Previous Weeks High', 'Weekly Low', 'Previous Weeks Low'],
  },
  {
    tf: 'M', current: 'smh', previous: 'spmh', width: 4, highColor: GREEN,
    titles: ['Monthly Open', 'Previous Months Open', 'Monthly Close', 'Previous Months Close', 'Monthly High',
      'Previous Monthly High', 'Monthly Low', 'Previous Months Low'],
  },
];

/** Colour of the k-th plot of a group (open, close, high, low; each current then previous) */
const colorOf = (k: number, highColor: string) => [SILVER, FUCHSIA, highColor, RED][Math.floor(k / 2)];

export const plotConfig: PlotConfig[] = GROUPS.flatMap((grp, g) => grp.titles.map((title, k) => ({
  id: `plot${g * 8 + k}`,
  title,
  color: colorOf(k, grp.highColor),
  lineWidth: grp.width,
  style: (k % 2 === 0 ? 'circles' : 'cross') as PlotConfig['style'],
})));

export const metadata = {
  title: '_CM_High_Low_Open_Close',
  shortTitle: '_CM_H_L_O_C',
  overlay: true,
};

/**
 * security(tickerid, tf, ...) on the chart symbol: the bars of timeframe `tf` built from the chart bars, and the
 * function that brings one value per bar of that timeframe back to the chart bars. Version 1 rule: every chart bar
 * of a period shows the value of the period (no gaps). Used with the exchange calendar of the context (a full run).
 */
function timeframeBars(bars: Bar[], tf: string, context?: ChartContext): { htf: Bar[]; toChart: (values: number[]) => number[] } {
  const chart = chartTimeframe(bars, context);
  if (chart === '' || timeframe.in_seconds(tf) === timeframe.in_seconds(chart)) {
    return { htf: bars, toChart: (values) => values };
  }
  if (timeframe.in_seconds(tf) < timeframe.in_seconds(chart)) {
    throw new Error(`The timeframe "${tf}" is lower than the chart timeframe "${chart}": the bars do not carry that data.`);
  }
  // With the exchange calendar of the chart context (time zone and session): the periods come from the library rule
  // (see anchor-period.ts); without it, the periods of the UTC calendar and the bars, grouped by the library
  const exchange = securityBars(bars, tf, context);
  const { bars: htf, group } = exchange ? { bars: exchange.htf, group: exchange.group } : resample(bars, periodStarts(bars, tf));
  return { htf, toChart: (values) => mapToChart(values, group, [], true, false) };
}

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

type Point = { time: number; value: number };

/** `show and v ? v : na`: na and 0 are not drawn */
const shown = (v: number) => (!Number.isNaN(v) && v !== 0 ? v : NaN);

/**
 * One group of the run: 'off' (both switches off), 'chart' (each chart bar is a period), 'utc' (the UTC calendar
 * periods), 'pre' (the exchange calendar: the eight values per bar computed on all bars)
 */
interface GroupState {
  mode: 'off' | 'chart' | 'utc' | 'pre';
  info: ReturnType<typeof timeframe.info> | null;
  pre: number[][] | null;
  /** Period key of the current period, its first bar and its open / close / high / low */
  key: number;
  start: number;
  cur: number[];
  /** open / close / high / low of the previous period (na before the second period) */
  prev: number[];
}

interface CodePlotsRun extends BarRunState<{ groups: GroupState[] }> {
  plots: Point[][];
}

function study(inputs: Partial<CodePlotsHighLowOpenCloseDailyWeeklyInputs>): BarStudy<CodePlotsRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  let inMs = false;
  const NONE = [NaN, NaN, NaN, NaN];
  return {
    // the chart timeframe comes from the bar gaps, the time unit from the first bar
    key: (bars, chart) => `${chartTimeframe(bars, chart)}|${bars.length > 0 && bars[0].time >= 1e12}`,
    // with the exchange calendar the periods come from the calendar of the whole bar set
    fullRunReason: (chart) => (hasCalendar(chart) ? 'exchange calendar periods' : null),
    init(bars, chart) {
      inMs = bars.length > 0 && bars[0].time >= 1e12;
      const chartTf = chartTimeframe(bars, chart);
      const groups = GROUPS.map((grp): GroupState => {
        const st: GroupState = { mode: 'off', info: null, pre: null, key: NaN, start: 0, cur: NONE.slice(), prev: NONE.slice() };
        if (!cfg[grp.current] && !cfg[grp.previous]) return st;
        if (hasCalendar(chart)) {
          // open, open[1], close, close[1], high, high[1], low, low[1] of the bars of the timeframe
          const { htf, toChart } = timeframeBars(bars, grp.tf, chart);
          const fields = ['open', 'close', 'high', 'low'] as const;
          st.mode = 'pre';
          st.pre = fields.flatMap((f) => {
            const v = htf.map((b) => b[f]);
            return [toChart(v), toChart(v.map((_x, i) => (i > 0 ? v[i - 1] : NaN)))];
          });
        } else if (chartTf === '' || timeframe.in_seconds(grp.tf) === timeframe.in_seconds(chartTf)) {
          st.mode = 'chart';
        } else {
          if (timeframe.in_seconds(grp.tf) < timeframe.in_seconds(chartTf)) {
            throw new Error(`The timeframe "${grp.tf}" is lower than the chart timeframe "${chartTf}": the bars do not carry that data.`);
          }
          st.mode = 'utc';
          st.info = timeframe.info(grp.tf);
        }
        return st;
      });
      const s: CodePlotsRun = { plots: GROUPS.flatMap(() => Array.from({ length: 8 }, () => [])), steps: [], vars: { groups }, lists: [], series: [] };
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      // changed in place: copyVars copies them at the end of the last confirmed bar
      const groups = s.vars.groups;
      for (let g = 0; g < GROUPS.length; g++) {
        const st = groups[g];
        const grp = GROUPS[g];
        const showCurrent = cfg[grp.current];
        const showPrevious = cfg[grp.previous];
        const plots = s.plots;
        if (st.mode === 'off' || st.mode === 'pre') {
          for (let k = 0; k < 8; k++) {
            const show = k % 2 === 0 ? showCurrent : showPrevious;
            plots[g * 8 + k][i] = { time, value: shown(show ? st.pre![k][i] : NaN) };
          }
          continue;
        }
        let key: number;
        if (st.mode === 'chart') key = i;
        else {
          const t = inMs ? time : time * 1000;
          key = calendarPeriodStart(Math.floor(t / 86400000) * 86400000, st.info!);
        }
        if (i === 0 || key !== st.key) {
          if (i > 0) {
            // the period before is complete: its chart bars show its values (lookahead of the version 1 script)
            if (showCurrent) {
              for (let j = st.start; j < i; j++) {
                for (let f = 0; f < 4; f++) plots[g * 8 + f * 2][j] = { time: bars[j].time, value: shown(st.cur[f]) };
              }
            }
            st.prev[0] = st.cur[0];
            st.prev[1] = st.cur[1];
            st.prev[2] = st.cur[2];
            st.prev[3] = st.cur[3];
          }
          st.key = key;
          st.start = i;
          st.cur[0] = b.open;
          st.cur[1] = b.close;
          st.cur[2] = b.high;
          st.cur[3] = b.low;
        } else {
          st.cur[1] = b.close;
          st.cur[2] = Math.max(st.cur[2], b.high);
          st.cur[3] = Math.min(st.cur[3], b.low);
        }
        for (let f = 0; f < 4; f++) {
          // the values of the current period are written when it is complete (or in result for the last one)
          if (!showCurrent) plots[g * 8 + f * 2][i] = { time, value: NaN };
          plots[g * 8 + f * 2 + 1][i] = { time, value: shown(showPrevious ? st.prev[f] : NaN) };
        }
      }
    },
    copyVars: (v) => ({ groups: v.groups.map((st) => ({ ...st, cur: st.cur.slice(), prev: st.prev.slice() })) }),
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      GROUPS.forEach((grp, g) => {
        const st = s.vars.groups[g];
        const open = cfg[grp.current] && (st.mode === 'chart' || st.mode === 'utc') && n > 0;
        for (let k = 0; k < 8; k++) {
          const points = s.plots[g * 8 + k].slice();
          // the last period is still open: its chart bars show its values so far
          if (open && k % 2 === 0) {
            for (let j = st.start; j < n; j++) points[j] = { time: bars[j].time, value: shown(st.cur[k / 2]) };
          }
          plots[`plot${g * 8 + k}`] = points;
        }
      });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(
  inputs: Partial<CodePlotsHighLowOpenCloseDailyWeeklyInputs> = {},
  chart: ChartContext = {},
): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<CodePlotsHighLowOpenCloseDailyWeeklyInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const CodePlotsHighLowOpenCloseDailyWeekly = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
