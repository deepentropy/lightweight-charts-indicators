/**
 * Timeframe periods of the bars, for ports with a timeframe input (PineScript `time(tf)`, `timeframe.change(tf)`,
 * `request.security` on the chart symbol), and the chart timeframe of the bars (lower-timeframe volume ports).
 *
 * The original computes periods from the exchange time zone and the trading sessions of the symbol, which the bars
 * do not carry. Every function takes the chart context as an optional last argument (see chart-context.ts).
 *
 * With `chart.timezone` and `chart.session` (the session hours of the symbol, with its corrections and holidays
 * when the caller has them; `chart.regularSession` on extended-hours bars), the periods are those of the exchange
 * calendar. The values come from the session functions of oakscriptjs (`periodTime`, `resampleSession`,
 * `chartSessionFlags`, `tradingDayTime`, `barTimeAfter`, `barsUntil`: the values of the script API `time(tf)`,
 * `request.security`, `session.*`, `time_tradingday`), which have the PineScript rules: trading days from the
 * session and its holidays, sessions that cross midnight, "nD" counted in trading days from the first trading day of
 * the year, weeks from Monday, the start of a D / W / M period at the session start of its first trading day, an
 * intraday bar after an early close outside its day and its intraday period for `time(tf)` (in the D / W / M bar of
 * its day for `request.security`), and a higher-timeframe bar completed by the chart bar whose close reaches the end
 * of the period (`securityPeriods`).
 * `chart.timeframe`, when given, is the chart timeframe; else it is taken from the bar spacing.
 *
 * Without the time zone or the session the port uses the UTC calendar and takes the session start of a trading day
 * from the bars:
 * - symbols with bars on Saturdays or Sundays trade every day: each UTC day is a trading day starting at 00:00 UTC
 * - other symbols: the trading days are the UTC days that have bars, and a trading day starts at its first bar
 * Then, as in the original:
 * - "" (the chart timeframe): every bar is its own period
 * - seconds / minutes: periods of the timeframe length aligned on the session start of the trading day
 * - "D": the trading day; "nD": n trading days counted from the first trading day of the year (when the bars start
 *   after it, the count starts at the first bar)
 * - "W": the week from Monday; "nW": n weeks counted from the first Monday of the year
 * - "M": the month; "nM": n months counted from January
 * - `time(tf)` of D / W / M periods: the session start of the first trading day of the period (the first bar of
 *   the period on symbols that do not trade every day)
 * This fallback is exact on UTC 24x7 symbols and on symbols whose trading day is inside the UTC day with bars from
 * the session start (e.g. US stocks); not on sessions that cross 00:00 UTC (futures, forex), and a week or a "nD"
 * period shortened by a holiday is only seen through the bars. Before the first bar the port has no trading days:
 * the first period of the bars (the first year for "nD" on symbols that do not trade every day) can differ.
 */

import {
  barInterval, timeframe, periodTime, tradingDayTime, chartSessionFlags, resampleSession, chartSessions,
  barTimeAfter, barsUntil, afterCompletion, periodsOf, resample, type Bar, type SessionContext, type SessionFlags,
} from 'oakscriptjs';
import type { ChartContext } from './chart-context';

const DAY = 86400000;
const WEEK = 7 * DAY;

/** True when the context gives the exchange calendar: the time zone and the session of the symbol. */
export function hasCalendar(chart?: ChartContext): boolean {
  return !!chart && !!chart.timezone && !!chart.session;
}

/**
 * The session context of the library for the exchange calendar (chart timeframe, time zone, session, unit of the bar
 * times), or null when the context does not give the time zone and the session, the chart timeframe is not known
 * (fewer than 2 bars without `chart.timeframe`) or the library cannot read the time zone or the session. One object
 * per chart context, timeframe and unit: the library caches its calendars per object.
 */
export function calendarOf(
  bars: ReadonlyArray<{ time: number }>,
  chart?: ChartContext,
): { chart: SessionContext; unit: number } | null {
  if (!chart || !hasCalendar(chart) || bars.length === 0) return null;
  const tf = chartTimeframe(bars, chart);
  if (tf === '') return null;
  const ms = bars[0].time >= 1e12;
  const key = `${tf}|${ms ? 'ms' : 's'}`;
  let contexts = sessionContexts.get(chart);
  if (!contexts) {
    contexts = new Map();
    sessionContexts.set(chart, contexts);
  }
  let context = contexts.get(key);
  if (context === undefined) {
    context = {
      timeframe: tf, timezone: chart.timezone, session: chart.session, regularSession: chart.regularSession,
      timeUnit: ms ? 'ms' : 's',
    };
    // a time zone or a session that the library does not read: no calendar, the caller uses the bars
    try {
      chartSessions(context);
      periodTime(bars[0].time, '1D', context);
    } catch {
      context = null;
    }
    contexts.set(key, context);
  }
  return context ? { chart: context, unit: ms ? 1 : 1000 } : null;
}

const sessionContexts = new WeakMap<ChartContext, Map<string, SessionContext | null>>();

/** Start (UNIX ms, UTC) of the D / W / M calendar period that contains the day `day` (00:00 UTC, ms). */
function calendarPeriodStart(day: number, info: ReturnType<typeof timeframe.info>): number {
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

/**
 * PineScript `time(tf)` of each bar: the start of the `tf` period that contains the bar, in the unit of the bar
 * times (seconds as lightweight-charts, or ms). A bar opens a new period (`timeframe.change(tf)`) when its value
 * differs from the previous bar's (see `periodChanges` for the exact PineScript rule). `tf` = "" (the chart
 * timeframe) gives the bar times.
 * With the exchange calendar, `time(tf)` is na on an intraday bar that opens after an early close of its day (D and
 * intraday periods): such a bar keeps the period of the bar before it; a bar for which the calendar finds no trading
 * day is its own period.
 * @throws RangeError for a string that is not a timeframe, or a tick timeframe
 */
export function periodStarts(bars: ReadonlyArray<{ time: number }>, tf: string, chart?: ChartContext): number[] {
  if (tf.trim() === '') return bars.map((b) => b.time);
  const info = timeframe.info(tf);
  if (info.isticks) throw new RangeError(`Unsupported timeframe "${tf}"`);
  const calendar = calendarOf(bars, chart);
  if (calendar) {
    const sessions = chartSessions(calendar.chart).bars;
    const out: number[] = [];
    bars.forEach((b, i) => {
      const t = periodTime(b.time, tf, calendar.chart);
      if (!Number.isNaN(t)) out.push(t / calendar.unit);
      else out.push(i > 0 && sessions.stray(b.time * calendar.unit) ? out[i - 1] : b.time);
    });
    return out;
  }
  const ms = bars.length > 0 && bars[0].time >= 1e12;
  const times = bars.map((b) => (ms ? b.time : b.time * 1000));
  const weekend = (t: number) => {
    const wd = new Date(t).getUTCDay();
    return wd === 0 || wd === 6;
  };
  const everyDay = times.some(weekend);
  const len = info.isintraday ? timeframe.in_seconds(tf) * 1000 : 0;

  const out: number[] = [];
  let prevDay = NaN;
  let sessionStart = NaN;
  let prevKey = NaN;
  let start = NaN;
  let tradingYear = NaN;
  let tradingDays = -1;
  let prevTradingDay = NaN;
  for (const t of times) {
    const day = Math.floor(t / DAY) * DAY;
    if (day !== prevDay) sessionStart = everyDay ? day : t;
    prevDay = day;
    if (info.isintraday) {
      start = len >= DAY ? sessionStart : sessionStart + Math.floor((t - sessionStart) / len) * len;
    } else if (info.isdaily && info.multiplier > 1 && !everyDay) {
      // n trading days (UTC days with bars) counted from the first trading day of the year
      const year = new Date(day).getUTCFullYear();
      if (year !== tradingYear) {
        tradingYear = year;
        tradingDays = -1;
      }
      if (day !== prevTradingDay) {
        tradingDays++;
        prevTradingDay = day;
        if (tradingDays % info.multiplier === 0) start = t;
      }
    } else {
      const key = calendarPeriodStart(day, info);
      if (key !== prevKey) start = everyDay ? key : t;
      prevKey = key;
    }
    out.push(ms ? start : Math.floor(start / 1000));
  }
  return out;
}

/**
 * PineScript `timeframe.change(tf)` of each bar: true on a bar that opens a new `tf` period (false on the first bar).
 * With the exchange calendar it is the rule of the library: a bar whose `time(tf)` is na (an intraday bar after an
 * early close, for D and intraday periods) is no change, and neither is the bar after it. Else: `periodStarts` differs from the
 * previous bar's.
 * @throws RangeError for a string that is not a timeframe, or a tick timeframe
 */
export function periodChanges(bars: ReadonlyArray<{ time: number }>, tf: string, chart?: ChartContext): boolean[] {
  const calendar = tf.trim() === '' ? null : calendarOf(bars, chart);
  if (calendar) {
    if (timeframe.info(tf).isticks) throw new RangeError(`Unsupported timeframe "${tf}"`);
    const times = bars.map((b) => periodTime(b.time, tf, calendar.chart));
    return times.map((t, i) => i > 0 && !Number.isNaN(t) && !Number.isNaN(times[i - 1]) && t !== times[i - 1]);
  }
  const starts = periodStarts(bars, tf, chart);
  return starts.map((t, i) => i > 0 && t !== starts[i - 1]);
}

/**
 * Chart timeframe of the bars ("1", "60", "1D", "1W", "1M", ...): `chart.timeframe` when the context gives it, else
 * from the most frequent gap between two bars (`barInterval`): one day on daily bars even with weekends and
 * holidays, 28 to 31 days on monthly bars. Empty string with fewer than 2 bars and no context value.
 */
export function chartTimeframe(bars: ReadonlyArray<{ time: number }>, chart?: ChartContext): string {
  if (chart?.timeframe) return timeframe.info(chart.timeframe).period;
  const gap = barInterval(bars);
  const s = Math.round(bars.length > 0 && bars[0].time >= 1e12 ? gap / 1000 : gap);
  if (!(s > 0)) return '';
  if (s < 86400) return timeframe.from_seconds(s);
  if (s < 7 * 86400) return `${Math.round(s / 86400)}D`;
  if (s < 28 * 86400) return `${Math.round(s / (7 * 86400))}W`;
  return `${Math.max(1, Math.round(s / timeframe.in_seconds('1M')))}M`;
}

/** Periods of a higher timeframe on the chart bars, as `request.security` on the chart symbol sees them. */
export interface SecurityPeriods {
  /** Start of the period of each chart bar, in the unit of the bar times (D / W / M periods follow the regular hours) */
  starts: number[];
  /** Index of the period of each chart bar (0 for the first period of the bars) */
  group: number[];
  /** Index of the latest completed period at each chart bar (-1: none yet): the value shown without lookahead */
  latest: number[];
  /**
   * True for a chart bar that comes after the bar that completed its period (the premarket bars of the next trading
   * day on extended-hours bars): it still shows the period but is not part of its higher-timeframe bar
   */
  after: boolean[];
  /** True when the last bar completes its period */
  lastCompletes: boolean;
}

/**
 * The periods of timeframe `tf` as PineScript `request.security(syminfo.tickerid, tf, ...)` builds them, from the
 * exchange calendar of the context: a period is complete on the chart bar whose close reaches its end (the session
 * end of its last trading day for D / W / M), or on the first bar of the next period when its last bars are
 * missing. Null when the context does not give the time zone and the session: the caller keeps its own rule.
 * @throws Error when `tf` is lower than the chart timeframe
 */
export function securityPeriods(
  bars: ReadonlyArray<{ time: number }>,
  tf: string,
  chart?: ChartContext,
): SecurityPeriods | null {
  // the library only reads the bar times here
  return resampled(bars.map((b) => ({ time: b.time, open: 1, high: 1, low: 1, close: 1, volume: 1 })), tf, chart)?.periods ?? null;
}

/** `resampleSession` of the library on the chart bars, with the periods in the form of `SecurityPeriods`. */
function resampled(
  bars: Bar[],
  tf: string,
  chart?: ChartContext,
): { periods: SecurityPeriods; htf: Bar[] } | null {
  const calendar = calendarOf(bars, chart);
  if (!calendar) return null;
  const n = bars.length;
  const { bars: htf, group, latest } = resampleSession(bars, tf, calendar.chart);
  // a bar for which the calendar finds no period start is its own period
  const starts = group.map((g, i) => (Number.isNaN(htf[g].time) ? bars[i].time : htf[g].time));
  return {
    periods: {
      starts,
      group,
      latest,
      after: afterCompletion(group, latest),
      lastCompletes: n > 0 && latest[n - 1] === group[n - 1],
    },
    htf,
  };
}

/**
 * Period start of each chart bar for a port that groups the chart bars as `request.security(..., tf)` does: with
 * the exchange calendar of the context the starts of `securityPeriods` (D / W / M periods follow the regular
 * hours), else `periodStarts`. A timeframe below the chart timeframe gives `periodStarts` too.
 */
export function securityStarts(bars: ReadonlyArray<{ time: number }>, tf: string, chart?: ChartContext): number[] {
  if (tf.trim() !== '' && hasCalendar(chart)) {
    const chartTf = chartTimeframe(bars, chart);
    if (chartTf !== '' && timeframe.in_seconds(tf) >= timeframe.in_seconds(chartTf)) {
      const periods = securityPeriods(bars, tf, chart);
      if (periods) return periods.starts;
    }
  }
  return periodStarts(bars, tf, chart);
}

/** The periods of a higher timeframe with their bars. */
export interface SecurityBars extends SecurityPeriods {
  /**
   * Bars of the timeframe built from the chart bars (the bars `after` the completion of their period are left out);
   * `time` is the period start. `htf[group[i]]` is the bar of chart bar i, `htf[latest[i]]` the latest completed bar
   */
  htf: Bar[];
  /** Index of the first chart bar of each bar of the timeframe */
  first: number[];
}

/**
 * `securityPeriods` with the bars of the timeframe built from the chart bars (open of the first bar, highest high,
 * lowest low, close of the last bar, sum of the volumes). Null when the context does not give the time zone and
 * the session (`higherTimeframeBars` adds the UTC rule for that case).
 * @throws Error when `tf` is lower than the chart timeframe
 */
export function securityBars(bars: ReadonlyArray<Bar>, tf: string, chart?: ChartContext): SecurityBars | null {
  const res = resampled(bars as Bar[], tf, chart);
  if (!res) return null;
  const { periods } = res;
  const first: number[] = [];
  periods.group.forEach((g, i) => {
    if (g >= first.length) first.push(i);
  });
  // new objects (on the chart timeframe the library gives the chart bars), the period start as time
  const htf = res.htf.map((b, g) => ({ ...b, time: periods.starts[first[g]], volume: b.volume ?? NaN }));
  return { ...periods, htf, first };
}

/**
 * `securityBars`, and without the exchange calendar the periods of the UTC rule of `periodStarts` grouped and
 * completed by the library (`resample`, `periodsOf`). A chart bar completes its period when its close reaches the
 * end of the period:
 * - symbols with bars on Saturdays or Sundays (and bar closes on them) trade every day: when its close time (the
 *   bar time plus the bar interval) is in another period
 * - other symbols: the last bar of a period; the last bar of the bars when the next bar of the UTC rule of
 *   `timeAfterLastBar` opens another period (always with fewer than 2 bars)
 * The caller handles a timeframe equal to or lower than the chart timeframe.
 * @throws Error when `tf` is lower than the chart timeframe and the context gives the exchange calendar
 */
export function higherTimeframeBars(bars: ReadonlyArray<Bar>, tf: string, chart?: ChartContext): SecurityBars {
  const exchange = securityBars(bars, tf, chart);
  if (exchange) return exchange;
  const n = bars.length;
  const starts = periodStarts(bars, tf);
  const ms = n > 0 && bars[0].time >= 1e12;
  const weekend = (t: number) => {
    const wd = new Date(ms ? t : t * 1000).getUTCDay();
    return wd === 0 || wd === 6;
  };
  const interval = barInterval(bars);
  const closes = bars.map((b) => ({ time: b.time + interval }));
  let reaches: boolean[];
  if (bars.some((b) => weekend(b.time)) && closes.some((b) => weekend(b.time))) {
    const closeStarts = periodStarts(closes, tf);
    reaches = starts.map((s, i) => closeStarts[i] !== s);
  } else {
    const next = timeAfterLastBar(bars, 1);
    const withNext = Number.isNaN(next) ? [] : periodStarts([...bars, { time: next }], tf);
    const lastEnds = withNext.length === 0 || withNext[n] !== withNext[n - 1];
    reaches = starts.map((_s, i) => i < n - 1 || lastEnds);
  }
  const { group, latest } = periodsOf(starts, starts, reaches);
  const first: number[] = [];
  group.forEach((g, i) => {
    if (g >= first.length) first.push(i);
  });
  return {
    starts,
    group,
    latest,
    after: afterCompletion(group, latest),
    lastCompletes: n > 0 && latest[n - 1] === group[n - 1],
    htf: resample(bars as Bar[], starts).bars,
    first,
  };
}

/** PineScript `session.*` flags of each bar. */
export type { SessionFlags } from 'oakscriptjs';

/**
 * PineScript `session.isfirstbar`, `session.islastbar`, `session.ismarket` ... of each bar, from the exchange
 * calendar of the context. Null when the context does not give the time zone and the session.
 */
export function sessionFlags(bars: ReadonlyArray<{ time: number }>, chart?: ChartContext): SessionFlags | null {
  const calendar = calendarOf(bars, chart);
  return calendar ? chartSessionFlags(bars.map((b) => b.time), calendar.chart) : null;
}

/**
 * PineScript `time_tradingday` of each bar: 00:00 UTC of its trading day (on W / M bars, of the last trading day of
 * the bar), in the unit of the bar times. Null when the context does not give the time zone and the session.
 */
export function tradingDays(bars: ReadonlyArray<{ time: number }>, chart?: ChartContext): number[] | null {
  const calendar = calendarOf(bars, chart);
  return calendar ? bars.map((b) => tradingDayTime(b.time, calendar.chart) / calendar.unit) : null;
}

/**
 * Open time of the `count`-th bar after the last bar (PineScript `bar_index + count` on the last bar), in the unit of
 * the bar times; `count` 0 is the last bar. With the exchange calendar of the context: `barTimeAfter` of the library
 * (closed hours, weekends, holidays and days off skipped). Without it, the UTC rule of the bars: on symbols with bars
 * on Saturdays or Sundays, one bar interval per bar; on other symbols, an intraday bar is followed by a bar on the
 * same day while it is earlier in the day than the last bar of the trading day before, else by the first bar of the
 * next weekday (at the time of the first bar of that trading day); D bars by the next weekday; W bars by the next
 * week; M bars by the next month. NaN with fewer than 2 bars (the bar interval is not known).
 */
export function timeAfterLastBar(bars: ReadonlyArray<{ time: number }>, count: number, chart?: ChartContext): number {
  const n = bars.length;
  if (n === 0) return NaN;
  const last = bars[n - 1].time;
  if (count <= 0) return last;
  const calendar = calendarOf(bars, chart);
  if (calendar) {
    const t = barTimeAfter(last, count, calendar.chart);
    if (!Number.isNaN(t)) return t;
  }
  const next = utcNextBar(bars);
  let t = last;
  for (let k = 0; k < count && !Number.isNaN(t); k++) t = next(t);
  return t;
}

/**
 * Number of bars from the last bar to the bar that contains `time` (in the unit of the bar times): 0 when `time` is
 * in the last bar or before it. For a drawing placed at a time after the last bar (`xloc.bar_time`): the chart shows
 * it on the bar of that time, `timeAfterLastBar(bars, k)` with k the result. With the exchange calendar of the
 * context: `barsUntil` of the library; without it, the UTC rule of `timeAfterLastBar`. NaN with fewer than 2 bars or
 * when no bar is found within 100,000 bars.
 */
export function barsAfterLastBar(bars: ReadonlyArray<{ time: number }>, time: number, chart?: ChartContext): number {
  const n = bars.length;
  if (n === 0) return NaN;
  const last = bars[n - 1].time;
  const calendar = calendarOf(bars, chart);
  if (calendar) {
    const k = barsUntil(last, time, calendar.chart);
    if (!Number.isNaN(k)) return k;
  }
  const next = utcNextBar(bars);
  let t = last;
  for (let k = 0; k < 100_000; k++) {
    const after = next(t);
    if (Number.isNaN(after)) return NaN;
    if (after > time) return k;
    t = after;
  }
  return NaN;
}

/** The next bar time after a bar time (unit of the bar times), by the UTC rule of `timeAfterLastBar`. */
function utcNextBar(bars: ReadonlyArray<{ time: number }>): (t: number) => number {
  const n = bars.length;
  const ms = n > 0 && bars[0].time >= 1e12;
  const toMs = (t: number) => (ms ? t : t * 1000);
  const fromMs = (t: number) => (ms ? t : t / 1000);
  const interval = toMs(barInterval(bars));
  if (!(interval > 0)) return () => NaN;
  const weekend = (t: number) => {
    const wd = new Date(t).getUTCDay();
    return wd === 0 || wd === 6;
  };
  if (bars.some((b) => weekend(toMs(b.time)))) return (t) => t + fromMs(interval);
  const nextWeekday = (day: number) => {
    let d = day + DAY;
    while (weekend(d)) d += DAY;
    return d;
  };
  if (interval >= 28 * DAY) {
    const months = Math.max(1, Math.round(interval / (timeframe.in_seconds('1M') * 1000)));
    return (t) => {
      const d = new Date(toMs(t));
      let m = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1) + (toMs(t) % DAY);
      while (weekend(m)) m += DAY;
      return fromMs(m);
    };
  }
  if (interval >= 7 * DAY) return (t) => t + fromMs(interval);
  if (interval >= DAY) {
    const days = Math.round(interval / DAY);
    return (t) => {
      let d = Math.floor(toMs(t) / DAY) * DAY;
      for (let k = 0; k < days; k++) d = nextWeekday(d);
      return fromMs(d + (toMs(t) % DAY));
    };
  }
  // the first and the last bar time of day of the trading day before the last bar's (the last day when it is alone)
  const lastDay = Math.floor(toMs(bars[n - 1].time) / DAY) * DAY;
  let j = n - 1;
  while (j >= 0 && toMs(bars[j].time) >= lastDay) j--;
  const refDay = j < 0 ? lastDay : Math.floor(toMs(bars[j].time) / DAY) * DAY;
  const refLast = j < 0 ? toMs(bars[n - 1].time) - lastDay : toMs(bars[j].time) - refDay;
  let i = j < 0 ? n - 1 : j;
  while (i > 0 && toMs(bars[i - 1].time) >= refDay) i--;
  const refFirst = toMs(bars[i].time) - refDay;
  return (t) => {
    const day = Math.floor(toMs(t) / DAY) * DAY;
    return fromMs(toMs(t) - day < refLast ? toMs(t) + interval : nextWeekday(day) + refFirst);
  };
}
