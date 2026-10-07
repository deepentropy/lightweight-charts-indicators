/**
 * Timeframe periods of the bars, for ports with a timeframe input (PineScript `time(tf)`, `timeframe.change(tf)`),
 * and the chart timeframe of the bars (lower-timeframe volume ports).
 *
 * The original computes periods from the exchange time zone and the trading sessions of the symbol, which the bars
 * do not carry. The port uses the UTC calendar and takes the session start of a trading day from the bars:
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
 * Exact on UTC 24x7 symbols and on symbols whose trading day is inside the UTC day with bars from the session start
 * (e.g. US stocks); not on sessions that cross 00:00 UTC (futures, forex). Before the first bar the port has no
 * trading days: the first period of the bars (the first year for "nD" on symbols that do not trade every day) can
 * differ.
 */

import { barInterval, timeframe } from 'oakscriptjs';

const DAY = 86400000;
const WEEK = 7 * DAY;

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
 * differs from the previous bar's. `tf` = "" (the chart timeframe) gives the bar times.
 * @throws RangeError for a string that is not a timeframe, or a tick timeframe
 */
export function periodStarts(bars: ReadonlyArray<{ time: number }>, tf: string): number[] {
  if (tf.trim() === '') return bars.map((b) => b.time);
  const info = timeframe.info(tf);
  if (info.isticks) throw new RangeError(`Unsupported timeframe "${tf}"`);
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
 * Chart timeframe of the bars ("1", "60", "1D", "1W", "1M", ...), from the most frequent gap between two bars
 * (`barInterval`): one day on daily bars even with weekends and holidays, 28 to 31 days on monthly bars.
 * Empty string with fewer than 2 bars.
 */
export function chartTimeframe(bars: ReadonlyArray<{ time: number }>): string {
  const gap = barInterval(bars);
  const s = Math.round(bars.length > 0 && bars[0].time >= 1e12 ? gap / 1000 : gap);
  if (!(s > 0)) return '';
  if (s < 86400) return timeframe.from_seconds(s);
  if (s < 7 * 86400) return `${Math.round(s / 86400)}D`;
  if (s < 28 * 86400) return `${Math.round(s / (7 * 86400))}W`;
  return `${Math.max(1, Math.round(s / timeframe.in_seconds('1M')))}M`;
}
