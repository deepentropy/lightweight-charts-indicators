/**
 * Opening Range Breakout with 2 Profit Targets
 *
 * The opening range is the high and the low of the first bar of the session, taken on the "Length Of Opening Range"
 * timeframe (60 minutes by default: the first hour). Two profit targets sit above and below the range at a
 * multiple of its height (input value * 0.1). The six levels are drawn as circles while the chart bar is inside the
 * session, with a silver background and a fill between the two range lines. A level turns lime (red for the range
 * low) on the bars that trade through it. A "1" or a "2" marks the bar that reaches target 1 or 2 after five bars
 * that did not.
 *
 * Rules of the original (a version 1 script) kept by the port:
 * - a session without days runs from Monday to Friday; a bar is inside the session when it opens inside it
 * - the trading day of a session starts at the session start (for "1700-1600": at 17:00 of the day before). The
 *   range starts on a range-timeframe bar whose trading day differs from the trading day of the bar before it, both
 *   bars being inside the session. When the symbol has bars between two sessions (e.g. "0930-1600" or "1700-1600"
 *   on a symbol that trades all day), no range ever starts: only the background is drawn
 * - session 0 (24 hours): the range starts on the first range-timeframe bar of each day of the symbol
 * - every chart bar of a range-timeframe bar shows the final value of that bar: the range of the first hour is
 *   drawn from the first chart bar of the day
 *
 * Limits of the port:
 * - the bars of the range timeframe are built from the chart bars, so the range of the first day of the bars is
 *   not known (the original reads earlier bars of that timeframe)
 * - a range timeframe below the chart timeframe needs data that the bars do not carry: the port throws an Error
 *
 * Chart values (third argument): the exchange time zone, in which the session hours are read (without it: UTC),
 * the session of the symbol for the days and the bars of the range timeframe (without it: the UTC calendar and the
 * bars, see src/anchor-period.ts) and the chart timeframe (without it: taken from the bar spacing).
 *
 * Reference: "Opening Range Breakout with 2 Profit Targets." (_CM_Opening-Range-Final) by ChrisMoody
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  color, time, timeframe, resample, periodTime,
  type SessionContext, type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import { periodStarts, securityStarts, chartTimeframe, hasCalendar } from '../anchor-period';
import type { MarkerData, BgColorData } from '../types';
import { timezoneOf, type ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface OpeningRangeBreakoutWith2ProfitTargetsInputs {
  /** Session to use: 0 = 24 hours, 1 to 6 = one of the sessions below */
  sessNum: number;
  /** Separator of the settings dialog (no effect) */
  desc: boolean;
  forexUsBankingOpen: string;
  goldUsOpen: string;
  oilUsOpen: string;
  usStocksOpen: string;
  nyForexOpen: string;
  europeOpen: string;
  /** Profit target 1: multiple of the opening range * 0.1 */
  pt1: number;
  /** Profit target 2: multiple of the opening range * 0.1 */
  pt2: number;
  /** Timeframe of the opening range */
  res: string;
  /** Mark the bars where target 1 and target 2 are reached */
  snp: boolean;
}

export const defaultInputs: OpeningRangeBreakoutWith2ProfitTargetsInputs = {
  sessNum: 4,
  desc: false,
  forexUsBankingOpen: '0800-1700',
  goldUsOpen: '0820-1700',
  oilUsOpen: '0900-1700',
  usStocksOpen: '0930-1600',
  nyForexOpen: '1700-1600',
  europeOpen: '0200-1700',
  pt1: 5,
  pt2: 10,
  res: '60',
  snp: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'sessNum', type: 'int', title: 'Session to use (0 = 24 Hours, Other Numbers Listed Below)', defval: 4, min: 0, max: 6 },
  { id: 'desc', type: 'bool', title: 'Below---Line Plot Start Times and End Times---Change Input Above To Select', defval: false },
  { id: 'forexUsBankingOpen', type: 'session', title: '1 - Forex U.S. Banks Open -- ALL START TIMES = START OF OPENING RANGE!!!', defval: '0800-1700' },
  { id: 'goldUsOpen', type: 'session', title: '2 - Gold U.S. Open -- All End Times are when Lines Stop Plotting', defval: '0820-1700' },
  { id: 'oilUsOpen', type: 'session', title: '3 - Oil U.S. Open', defval: '0900-1700' },
  { id: 'usStocksOpen', type: 'session', title: '4 - U.S. Cash Cash Session - Stocks Session', defval: '0930-1600' },
  { id: 'nyForexOpen', type: 'session', title: '5 - NY Forex Open', defval: '1700-1600' },
  { id: 'europeOpen', type: 'session', title: '6 - Europe', defval: '0200-1700' },
  { id: 'pt1', type: 'int', title: 'Profit Target 1 - Multiple of Opening Range *.1, 5 = .5, 7 = .7, 10 = 1, 15 = 1.5 etc.', defval: 5, min: 1, max: 15 },
  { id: 'pt2', type: 'int', title: 'Profit Target 2 - Multiple of Opening Range *.1, 10 = 1, 15 = 1.5, 18 = 1.8, etc.', defval: 10, min: 1, max: 30 },
  { id: 'res', type: 'timeframe', title: 'Length Of Opening Range?', defval: '60' },
  { id: 'snp', type: 'bool', title: 'Plot 1 and 2 When 1st and 2nd Profit Target are Achieved?', defval: true },
];

// Colour constants of Pine version 1, with the default plot transparency of that version (35)
const V1 = (hex: string) => String(color.new(hex, 35));
const LIME = V1('#00FF00');
const YELLOW = V1('#FFFF00');
const RED = V1('#FF0000');
const FUCHSIA = V1('#FF00FF');
const AQUA = V1('#00FFFF');
const WHITE = String(color.new('#FFFFFF', 0));
const BG = String(color.new('#C0C0C0', 85));
const FILL = String(color.new('#C0C0C0', 70));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Opening Range High', color: YELLOW, lineWidth: 4, style: 'circles' },
  { id: 'plot1', title: 'Opening Range Low', color: YELLOW, lineWidth: 4, style: 'circles' },
  { id: 'plot2', title: 'Profit Target 1 High', color: FUCHSIA, lineWidth: 4, style: 'circles' },
  { id: 'plot3', title: 'Profit Target 1 Low', color: FUCHSIA, lineWidth: 4, style: 'circles' },
  { id: 'plot4', title: 'Profit Target 2 High', color: AQUA, lineWidth: 4, style: 'circles' },
  { id: 'plot5', title: 'Profit Target 2 Low', color: AQUA, lineWidth: 4, style: 'circles' },
];

export const metadata = {
  title: '_CM_Opening-Range-Final',
  shortTitle: '_CM_OpenRange_PlusTargets',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

/**
 * security(tickerid, tf, ...) on the chart symbol: the first chart bar, the start time (unit of the bar times) and
 * the high / low of each bar of timeframe `tf`, and for each chart bar the index of its bar of that timeframe. The
 * chart bars are grouped by the library (`resample`) on the period starts of the period helper.
 */
function timeframeBars(
  bars: Bar[],
  tf: string,
  chartTf: string,
  chart: ChartContext | undefined,
): { first: number[]; start: number[]; high: number[]; low: number[]; group: number[] } {
  const same = tf.trim() === '' || chartTf === '' || timeframe.in_seconds(tf) === timeframe.in_seconds(chartTf);
  if (!same && timeframe.in_seconds(tf) < timeframe.in_seconds(chartTf)) {
    throw new Error(`The timeframe "${tf}" is lower than the chart timeframe "${chartTf}": the bars do not carry that data.`);
  }
  const { bars: htf, group } = resample(bars, same ? bars.map((b) => b.time) : securityStarts(bars, tf, chart));
  const first = group.flatMap((g, i) => (i === 0 || g !== group[i - 1] ? [i] : []));
  return { first, start: htf.map((b) => b.time), high: htf.map((b) => b.high), low: htf.map((b) => b.low), group };
}

type Result = IndicatorResult & { markers: MarkerData[]; bgColors: BgColorData[] };
type Point = { time: number; value: number; color: string };

const DAY = 86400000;

/** True when a bar of the set is on a Saturday or a Sunday (UTC): the days of `periodStarts` start at 00:00 UTC */
function hasWeekendBars(bars: ReadonlyArray<{ time: number }>): boolean {
  const ms = bars.length > 0 && bars[0].time >= 1e12;
  return bars.some((b) => {
    const wd = new Date(ms ? b.time : b.time * 1000).getUTCDay();
    return wd === 0 || wd === 6;
  });
}

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

/**
 * One timeframe bar by bar: 'chart' (the chart bar times are the period starts), 'utc' (the periods of the UTC rule
 * of `periodStarts`), grouped as `resample` does, with the high / low of the current bar of the timeframe so far.
 */
interface TfState {
  mode: 'chart' | 'utc';
  info: ReturnType<typeof timeframe.info> | null;
  /** Length (ms) of an intraday period */
  len: number;
  /** periodStarts state: UTC day of the bar before, session start of its day, calendar key, period start, nD count */
  prevDay: number;
  sessionStart: number;
  prevKey: number;
  start: number;
  tradingYear: number;
  tradingDays: number;
  prevTradingDay: number;
  /** Period start of the current bar of the timeframe (in the unit of the bar times) */
  out: number;
  /** First chart bar of the current period */
  first: number;
  hi: number;
  lo: number;
}

function tfState(mode: TfState['mode'], tf: string): TfState {
  const info = mode === 'utc' ? timeframe.info(tf) : null;
  return {
    mode, info, len: info?.isintraday ? timeframe.in_seconds(tf) * 1000 : 0,
    prevDay: NaN, sessionStart: NaN, prevKey: NaN, start: NaN, tradingYear: NaN, tradingDays: -1, prevTradingDay: NaN,
    out: NaN, first: 0, hi: NaN, lo: NaN,
  };
}

/** True when chart bar `i` (time `time`, `t` in ms) opens a new period of the timeframe (periodStarts / resample) */
function opensPeriod(st: TfState, i: number, time: number, t: number, everyDay: boolean, ms: boolean): boolean {
  let out: number;
  if (st.mode === 'chart') out = time;
  else {
    const info = st.info!;
    const day = Math.floor(t / DAY) * DAY;
    if (day !== st.prevDay) st.sessionStart = everyDay ? day : t;
    st.prevDay = day;
    if (info.isintraday) {
      st.start = st.len >= DAY ? st.sessionStart : st.sessionStart + Math.floor((t - st.sessionStart) / st.len) * st.len;
    } else if (info.isdaily && info.multiplier > 1 && !everyDay) {
      // n trading days (UTC days with bars) counted from the first trading day of the year
      const year = new Date(day).getUTCFullYear();
      if (year !== st.tradingYear) {
        st.tradingYear = year;
        st.tradingDays = -1;
      }
      if (day !== st.prevTradingDay) {
        st.tradingDays++;
        st.prevTradingDay = day;
        if (st.tradingDays % info.multiplier === 0) st.start = t;
      }
    } else {
      const key = calendarPeriodStart(day, info);
      if (key !== st.prevKey) st.start = everyDay ? key : t;
      st.prevKey = key;
    }
    out = ms ? st.start : Math.floor(st.start / 1000);
  }
  // resample: a new bar of the timeframe when the period start differs from the bar before's
  const opens = i === 0 || out !== st.out;
  st.out = out;
  return opens;
}

interface OrbVars {
  /** The bars of the range timeframe; the trading days of the symbol (session 0) */
  tf: TfState | null;
  day: TfState | null;
  /** bartimeSess of the bar of the range timeframe before the current one */
  prevSessDay: number;
  /** newbarSess of the current bar of the range timeframe */
  curNew: boolean;
  /** high_range / low_range before the current bar of the range timeframe */
  hrBefore: number;
  lrBefore: number;
}

interface OrbRun extends BarRunState<OrbVars> {
  /** high_range / low_range of each chart bar (exchange calendar: from the whole bar set) */
  pre: { highRes: number[]; lowRes: number[] } | null;
  active: boolean[];
  plots: Point[][];
  markers: MarkerData[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<OpeningRangeBreakoutWith2ProfitTargetsInputs>): BarStudy<OrbRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  // Session selection: 0 = no session (24 hours)
  const sessions = [cfg.forexUsBankingOpen, cfg.goldUsOpen, cfg.oilUsOpen, cfg.usStocksOpen, cfg.nyForexOpen, cfg.europeOpen];
  const picked = cfg.sessNum >= 1 && cfg.sessNum <= 6 ? sessions[cfg.sessNum - 1] : '0000-0000';
  // A version 1 session without days runs from Monday to Friday
  const sessToUse = picked.includes(':') ? picked : `${picked}:23456`;
  const allDay = cfg.sessNum === 0;
  const pft1 = cfg.pt1 * 0.1;
  const pft2 = cfg.pt2 * 0.1;
  let ms = false;
  let everyDay = false;
  let tz = 'Etc/UTC';
  let chartMs = NaN;
  let resCtx: SessionContext | null = null;

  /** The outputs of chart bar i from the opening range of its bar of the range timeframe */
  function outputs(plots: Point[][], markers: MarkerData[], bars: Bar[], i: number, active: boolean, highRes: number, lowRes: number): void {
    const { high, low } = bars[i];
    const t = bars[i].time;
    const range = highRes - lowRes;
    const highRes2 = highRes + range * pft1;
    const lowRes2 = lowRes - range * pft1;
    const highRes3 = highRes + range * pft2;
    const lowRes3 = lowRes - range * pft2;

    const show = (v: number) => (active ? v : NaN);
    plots[0][i] = { time: t, value: show(highRes), color: gt(high, highRes) ? LIME : YELLOW };
    plots[1][i] = { time: t, value: show(lowRes), color: lt(low, lowRes) ? RED : YELLOW };
    plots[2][i] = { time: t, value: show(highRes2), color: gt(high, highRes2) ? LIME : FUCHSIA };
    plots[3][i] = { time: t, value: show(lowRes2), color: lt(low, lowRes2) ? LIME : FUCHSIA };
    plots[4][i] = { time: t, value: show(highRes3), color: gt(high, highRes3) ? LIME : AQUA };
    plots[5][i] = { time: t, value: show(lowRes3), color: lt(low, lowRes3) ? LIME : AQUA };

    // The level is reached on this bar and was not on the five bars before
    const H = (k: number) => (k >= 0 ? bars[k].high : NaN);
    const L = (k: number) => (k >= 0 ? bars[k].low : NaN);
    const upHit = (lvl: number) => ge(high, lvl) && [1, 2, 3, 4, 5].every((k) => lt(H(i - k), lvl));
    const downHit = (lvl: number) => le(low, lvl) && [1, 2, 3, 4, 5].every((k) => gt(L(i - k), lvl));
    const mark = (id: string, position: 'aboveBar' | 'belowBar', text: string) => {
      markers.push({ id, time: t, position, shape: 'circle', color: 'transparent', text, textColor: WHITE });
    };
    if (cfg.snp && active) {
      if (upHit(highRes2)) mark('char0', 'aboveBar', '1');
      if (downHit(lowRes2) && gt(low, lowRes3)) mark('char1', 'belowBar', '1');
      if (upHit(highRes3)) mark('char2', 'aboveBar', '2');
      if (downHit(lowRes3)) mark('char3', 'belowBar', '2');
    }
  }

  return {
    // the chart timeframe from the bar gaps, the time unit of the first bar and the weekend bars of the set (the
    // start of the UTC days of the periods)
    key: (bars, chart) => `${chartTimeframe(bars, chart)}|${bars.length > 0 && bars[0].time >= 1e12}|${hasWeekendBars(bars)}`,
    // with the exchange calendar the bars of the range timeframe come from the calendar of the whole bar set
    fullRunReason: (chart) => (hasCalendar(chart) ? 'exchange calendar periods' : null),
    init(bars, chart) {
      const n = bars.length;
      tz = timezoneOf(chart);
      const chartTf = chartTimeframe(bars, chart);
      ms = n > 0 && bars[0].time >= 1e12;
      everyDay = hasWeekendBars(bars);
      chartMs = chartTf === '' ? NaN : timeframe.in_seconds(chartTf) * 1000;

      // time('D', session) of the library on the bars of the range timeframe: the start of the day's session period,
      // na outside it (the chart session of the context is not read when the session argument is given).
      // time('D'): the start of the day of the symbol.
      const resTf = cfg.res.trim() === '' ? chartTf : cfg.res;
      const ctx: SessionContext = { timeframe: resTf || '1D', timezone: tz, session: sessToUse, timeUnit: ms ? 'ms' : 's' };
      resCtx = ctx;
      const tf = cfg.res;
      const same = tf.trim() === '' || chartTf === '' || timeframe.in_seconds(tf) === timeframe.in_seconds(chartTf);
      let pre: OrbRun['pre'] = null;
      let tfSt: TfState | null = null;
      let day: TfState | null = null;
      if (hasCalendar(chart)) {
        // the periods of the exchange calendar: the opening range of each chart bar from the whole bar set
        const dayStarts = periodStarts(bars, 'D', chart);
        const sessionDay = (barTime: number, firstBar: number): number => {
          if (allDay) return dayStarts[firstBar];
          return periodTime(barTime, 'D', ctx, sessToUse);
        };
        // Range timeframe: bartimeSess = time('D', session), newbarSess = bartimeSess != bartimeSess[1] (false with
        // na), high_range = valuewhen(newbarSess, high, 0)
        const { first, start: tfStart, high: tfHigh, low: tfLow, group } = timeframeBars(bars, cfg.res, chartTf, chart);
        const highRange: number[] = [];
        const lowRange: number[] = [];
        let hr = NaN;
        let lr = NaN;
        for (let j = 0; j < first.length; j++) {
          const cur = sessionDay(tfStart[j], first[j]);
          const prev = j > 0 ? sessionDay(tfStart[j - 1], first[j - 1]) : NaN;
          if (!isNaN(cur) && !isNaN(prev) && cur !== prev) {
            hr = tfHigh[j];
            lr = tfLow[j];
          }
          highRange.push(hr);
          lowRange.push(lr);
        }
        pre = { highRes: group.map((g) => highRange[g]), lowRes: group.map((g) => lowRange[g]) };
      } else {
        // the checks of timeframeBars and periodStarts (the same errors)
        if (!same && timeframe.in_seconds(tf) < timeframe.in_seconds(chartTf)) {
          throw new Error(`The timeframe "${tf}" is lower than the chart timeframe "${chartTf}": the bars do not carry that data.`);
        }
        if (!same) periodStarts([], tf);
        tfSt = tfState(same ? 'chart' : 'utc', tf);
        day = allDay ? tfState('utc', 'D') : null;
      }
      const s: OrbRun = {
        pre, active: [], plots: [[], [], [], [], [], []], markers: [], bgColors: [],
        steps: [],
        vars: { tf: tfSt, day, prevSessDay: NaN, curNew: false, hrBefore: NaN, lrBefore: NaN },
        lists: [], series: [],
      };
      s.lists = [s.markers, s.bgColors];
      s.series = [s.active, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const v = s.vars;
      if (!s.pre) {
        // changed in place: copyVars copies them at the end of the last confirmed bar
        const st = v.tf!;
        const tMs = ms ? t : t * 1000;
        // time('D') of this chart bar (session 0: the start of the day of the symbol)
        let dayOut = NaN;
        if (v.day) {
          opensPeriod(v.day, i, t, tMs, everyDay, ms);
          dayOut = v.day.out;
        }
        const opens = opensPeriod(st, i, t, tMs, everyDay, ms);
        if (opens) {
          if (i > 0) {
            // the bar of the range timeframe before is complete: its chart bars show its final range (lookahead)
            const hr = v.curNew ? st.hi : v.hrBefore;
            const lr = v.curNew ? st.lo : v.lrBefore;
            for (let j = st.first; j < i; j++) outputs(s.plots, s.markers, bars, j, s.active[j], hr, lr);
            v.hrBefore = hr;
            v.lrBefore = lr;
          }
          // bartimeSess = time('D', session) of the new bar of the range timeframe; newbarSess against the bar before
          const cur = allDay ? dayOut : periodTime(st.out, 'D', resCtx!, sessToUse);
          v.curNew = !isNaN(cur) && !isNaN(v.prevSessDay) && cur !== v.prevSessDay;
          v.prevSessDay = cur;
          st.first = i;
          st.hi = b.high;
          st.lo = b.low;
        } else {
          st.hi = Math.max(st.hi, b.high);
          st.lo = Math.min(st.lo, b.low);
        }
      }
      // time(tf, session) is not na: the bar opens inside the session (the clock-change rule of the library)
      const active = allDay || time.inSession(ms ? t : t * 1000, sessToUse, tz, Number.isFinite(chartMs) ? chartMs : undefined);
      s.active[i] = active;
      if (s.pre) outputs(s.plots, s.markers, bars, i, active, s.pre.highRes[i], s.pre.lowRes[i]);
      if (active) s.bgColors.push({ time: t, color: BG });
    },
    copyVars: (v) => ({ ...v, tf: v.tf ? { ...v.tf } : null, day: v.day ? { ...v.day } : null }),
    result(s, bars) {
      const n = bars.length;
      const plots = s.plots.map((p) => p.slice());
      const markers = s.markers.slice();
      const v = s.vars;
      if (v.tf && n > 0) {
        // the last bar of the range timeframe is still open: its chart bars show its range so far
        const st = v.tf;
        const hr = v.curNew ? st.hi : v.hrBefore;
        const lr = v.curNew ? st.lo : v.lrBefore;
        for (let j = st.first; j < n; j++) outputs(plots, markers, bars, j, s.active[j], hr, lr);
      }
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: plots[0], plot1: plots[1], plot2: plots[2], plot3: plots[3], plot4: plots[4], plot5: plots[5] },
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: FILL, title: 'Opening Range Fill' } }],
        markers,
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(
  inputs: Partial<OpeningRangeBreakoutWith2ProfitTargetsInputs> = {},
  chart: ChartContext = {},
): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<OpeningRangeBreakoutWith2ProfitTargetsInputs> = {},
  chart?: ChartContext,
): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const OpeningRangeBreakoutWith2ProfitTargets = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
