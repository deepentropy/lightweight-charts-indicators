/**
 * CM High Low Open Close Weekly-Intraday
 *
 * Open, close, high and low of the current and of the previous bar of five timeframes of the same symbol (weekly,
 * daily, 4 hour, 2 hour and 1 hour), each group switched on by its own input. Current values are drawn as circles,
 * previous values as crosses. A value of 0 is not drawn (`show and value ? value : na`).
 *
 * As in the original, the plots of the 2 hour and 1 hour groups carry the titles of the 4 hour group.
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
 * Reference: "_CM_High_Low_Open_Close_Weekly-Intraday" by ChrisMoody
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  color, timeframe, resample, mapToChart,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import { periodStarts, chartTimeframe, hasCalendar, securityBars } from '../anchor-period';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CmHighLowOpenCloseWeeklyIntradayInputs {
  /** Show This Weeks OHLC? */
  swt: boolean;
  /** Show Previous Weeks OHLC? */
  swy: boolean;
  /** Show Todays OHLC? */
  st: boolean;
  /** Show Yesterdays OHLC? */
  sy: boolean;
  /** Show 4-Hour OHLC? */
  stf: boolean;
  /** Show Previous 4-hour OHLC? */
  syf: boolean;
  /** Show 2-Hour OHLC? */
  stt: boolean;
  /** Show Previous 2-hour OHLC? */
  syt: boolean;
  /** Show 1-Hour OHLC? */
  sto: boolean;
  /** Show Previous 1-hour OHLC? */
  syo: boolean;
}

export const defaultInputs: CmHighLowOpenCloseWeeklyIntradayInputs = {
  swt: false,
  swy: false,
  st: true,
  sy: false,
  stf: false,
  syf: false,
  stt: false,
  syt: false,
  sto: false,
  syo: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'swt', type: 'bool', title: 'Show This Weeks OHLC?', defval: false },
  { id: 'swy', type: 'bool', title: 'Show Previous Weeks OHLC?', defval: false },
  { id: 'st', type: 'bool', title: 'Show Todays OHLC?', defval: true },
  { id: 'sy', type: 'bool', title: 'Show Yesterdays OHLC?', defval: false },
  { id: 'stf', type: 'bool', title: 'Show 4-Hour OHLC?', defval: false },
  { id: 'syf', type: 'bool', title: 'Show Previous 4-hour OHLC?', defval: false },
  { id: 'stt', type: 'bool', title: 'Show 2-Hour OHLC?', defval: false },
  { id: 'syt', type: 'bool', title: 'Show Previous 2-hour OHLC?', defval: false },
  { id: 'sto', type: 'bool', title: 'Show 1-Hour OHLC?', defval: false },
  { id: 'syo', type: 'bool', title: 'Show Previous 1-hour OHLC?', defval: false },
];

// Colour constants of Pine version 1, with the default plot transparency of that version (35)
const V1 = (hex: string) => String(color.new(hex, 35));
const SILVER = V1('#C0C0C0');
const FUCHSIA = V1('#FF00FF');
const GREEN = V1('#008000');
const LIME = V1('#00FF00');
const RED = V1('#FF0000');

/** The five groups: timeframe, plot titles of the group, line width and high colour */
const GROUPS: Array<{ tf: string; current: keyof CmHighLowOpenCloseWeeklyIntradayInputs; previous: keyof CmHighLowOpenCloseWeeklyIntradayInputs; titles: string[]; width: number; highColor: string }> = [
  {
    tf: 'W', current: 'swt', previous: 'swy', width: 3, highColor: GREEN,
    titles: ['Weekly Open', 'Previous Weeks Open', 'Weekly Close', 'Previous Weeks Close', 'Weekly High',
      'Previous Weeks High', 'Weekly Low', 'Previous Weeks Low'],
  },
  {
    tf: 'D', current: 'st', previous: 'sy', width: 2, highColor: LIME,
    titles: ['Daily Open', 'Previous Days Open', 'Daily Close', 'Previous Days Close', 'Daily High',
      'Previous Daily High', 'Daily Low', 'Previous Daily Low'],
  },
  ...['240', '120', '60'].map((tf, g) => ({
    tf,
    current: (['stf', 'stt', 'sto'] as const)[g],
    previous: (['syf', 'syt', 'syo'] as const)[g],
    width: 2,
    highColor: LIME,
    titles: ['4-Hour Open', 'Previous 4-Hour Open', '4-Hour Close', 'Previous 4-Hour Close', '4-Hour High',
      'Previous 4-Hour High', '4-Hour Low', 'Previous 4-Hour Low'],
  })),
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
  title: '_CM_High_Low_Open_Close_Weekly-Intraday',
  shortTitle: '_CM_H_L_O_C_Weekly-Intraday',
  overlay: true,
};

/**
 * security(tickerid, tf, ...) on the chart symbol: the bars of timeframe `tf` built from the chart bars, and the
 * function that brings one value per bar of that timeframe back to the chart bars. Version 1 rule: every chart bar
 * of a period shows the value of the period (no gaps).
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

const DAY = 86400000;

/** Start (UNIX ms, UTC) of the D / W / M calendar period of the day `day` (the UTC rule of `periodStarts`) */
function calendarPeriodStart(day: number, info: ReturnType<typeof timeframe.info>): number {
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

/** True when a bar of the set is on a Saturday or a Sunday (UTC): the days of `periodStarts` start at 00:00 UTC */
function hasWeekendBars(bars: ReadonlyArray<{ time: number }>): boolean {
  const ms = bars.length > 0 && bars[0].time >= 1e12;
  return bars.some((b) => {
    const wd = new Date(ms ? b.time : b.time * 1000).getUTCDay();
    return wd === 0 || wd === 6;
  });
}

type Point = { time: number; value: number };

/** `show and v ? v : na`: na and 0 are not drawn */
const shown = (v: number) => (!Number.isNaN(v) && v !== 0 ? v : NaN);

/**
 * One group of the run: 'off' (both switches off), 'chart' (each chart bar is a period), 'utc' (the UTC calendar
 * periods of `periodStarts`), 'pre' (the exchange calendar: the eight values per bar computed on all bars)
 */
interface GroupState {
  mode: 'off' | 'chart' | 'utc' | 'pre';
  info: ReturnType<typeof timeframe.info> | null;
  /** Length (ms) of an intraday period */
  len: number;
  pre: number[][] | null;
  /** Period key of the current period, its first bar and its open / close / high / low */
  key: number;
  start: number;
  cur: number[];
  /** open / close / high / low of the previous period (na before the second period) */
  prev: number[];
}

interface HlocVars {
  groups: GroupState[];
  /** UTC day of the bar before and the session start of its day (the intraday periods of `periodStarts`) */
  prevDay: number;
  sessionStart: number;
}

interface HlocRun extends BarRunState<HlocVars> {
  plots: Point[][];
}

function study(inputs: Partial<CmHighLowOpenCloseWeeklyIntradayInputs>): BarStudy<HlocRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  let inMs = false;
  let everyDay = false;
  const NONE = [NaN, NaN, NaN, NaN];
  return {
    // the chart timeframe comes from the bar gaps, the time unit from the first bar, the start of the days of the
    // intraday periods from the weekend bars of the set
    key: (bars, chart) => `${chartTimeframe(bars, chart)}|${bars.length > 0 && bars[0].time >= 1e12}|${hasWeekendBars(bars)}`,
    // with the exchange calendar the periods come from the calendar of the whole bar set
    fullRunReason: (chart) => (hasCalendar(chart) ? 'exchange calendar periods' : null),
    init(bars, chart) {
      inMs = bars.length > 0 && bars[0].time >= 1e12;
      everyDay = hasWeekendBars(bars);
      const chartTf = chartTimeframe(bars, chart);
      const groups = GROUPS.map((grp): GroupState => {
        const st: GroupState = { mode: 'off', info: null, len: 0, pre: null, key: NaN, start: 0, cur: NONE.slice(), prev: NONE.slice() };
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
          st.len = st.info.isintraday ? timeframe.in_seconds(grp.tf) * 1000 : 0;
        }
        return st;
      });
      const s: HlocRun = {
        plots: GROUPS.flatMap(() => Array.from({ length: 8 }, () => [])),
        steps: [], vars: { groups, prevDay: NaN, sessionStart: NaN }, lists: [], series: [],
      };
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const v = s.vars;
      // the session start of the UTC day (periodStarts: 00:00 UTC when the set has weekend bars, else the first bar)
      const t = inMs ? time : time * 1000;
      const day = Math.floor(t / DAY) * DAY;
      if (day !== v.prevDay) v.sessionStart = everyDay ? day : t;
      v.prevDay = day;
      // changed in place: copyVars copies them at the end of the last confirmed bar
      const groups = v.groups;
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
        else if (st.info!.isintraday) {
          // the intraday periods of periodStarts: from the session start of the day
          key = st.len >= DAY ? v.sessionStart : v.sessionStart + Math.floor((t - v.sessionStart) / st.len) * st.len;
        } else key = calendarPeriodStart(day, st.info!);
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
    copyVars: (v) => ({ ...v, groups: v.groups.map((st) => ({ ...st, cur: st.cur.slice(), prev: st.prev.slice() })) }),
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
  inputs: Partial<CmHighLowOpenCloseWeeklyIntradayInputs> = {},
  chart: ChartContext = {},
): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<CmHighLowOpenCloseWeeklyIntradayInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const CmHighLowOpenCloseWeeklyIntraday = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
