/**
 * VWAP MTF (Multi Timeframe)
 *
 * A VWAP of hl2 that restarts at each period of the timeframe input (a week by default): the sums of hl2 * volume
 * and of the volume start again on the first chart bar of a new period. The period of a bar is the start time of
 * its higher-timeframe bar (`security(tickerid, TimeFrame, time)`, version 1: every chart bar of a period gets the
 * value of that period). Before the first period change the sums are na (version 1 self-references start at na).
 * The VWAP is drawn as green circles when the close is above it, else red. Options: the VWAP of the previous period
 * at its last bar (circles, green when the close is above it) and bar colours with the VWAP colour.
 *
 * Version 1 plots have a default transparency of 35: the colours have an alpha of 0.65.
 *
 * Chart values (optional third argument of calculate): the periods follow the exchange calendar of the symbol (time
 * zone and session); without them the UTC rule of anchor-period.ts.
 *
 * Reference: "VWAP MTF" by TheYangGuizi
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, timeframe, type BarColorConfig, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { hasCalendar, securityStarts } from '../anchor-period';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VwapMtfInputs {
  /** Timeframe of the VWAP periods */
  timeFrame: string;
  /** Show barcolors */
  showBcol: boolean;
  /** Show previous VWAP close */
  showPrevVWAP: boolean;
}

export const defaultInputs: VwapMtfInputs = {
  timeFrame: 'W',
  showBcol: false,
  showPrevVWAP: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'timeFrame', type: 'string', title: 'TimeFrame', defval: 'W' },
  { id: 'showBcol', type: 'bool', title: 'Show barcolors', defval: false },
  { id: 'showPrevVWAP', type: 'bool', title: 'Show previous VWAP close', defval: false },
];

// Colour constants of Pine version 1, with the default plot transparency of that version (35)
const V1 = (hex: string) => String(color.new(hex, 35));
const GREEN = V1('#008000');
const RED = V1('#FF0000');

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Plot', color: GREEN, lineWidth: 1, style: 'circles' },
  { id: 'plot1', title: 'Plot', color: GREEN, lineWidth: 1, style: 'circles' },
];

export const barColorConfig: BarColorConfig[] = [{ id: 'barcolor0', kind: 'barcolor', title: 'Bar Color' }];

export const metadata = {
  title: 'VWAP MTF',
  shortTitle: 'VWAP MTF',
  overlay: true,
};

/** Pine float comparison: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;

const DAY = 86400000;
const WEEK = 7 * DAY;

/** Start (UNIX ms, UTC) of the D / W / M calendar period of the day `day` (the UTC rule of `periodStarts`) */
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

const weekend = (t: number) => {
  const wd = new Date(t).getUTCDay();
  return wd === 0 || wd === 6;
};
/** The bars trade every day (a bar on a Saturday or a Sunday, UTC): the days of `periodStarts` start at 00:00 UTC */
const someWeekend = (bars: Bar[], ms: boolean) => bars.some((b) => weekend(ms ? b.time : b.time * 1000));

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { barColors: BarColorData[] };

interface VwapVars {
  vwapsum: number;
  volumesum: number;
  prevwap: number;
  /** myvwap[1] */
  prevVwap: number;
  // periodStarts state (the UTC rule, one bar at a time)
  prevDay: number;
  sessionStart: number;
  prevKey: number;
  start: number;
  tradingYear: number;
  tradingDays: number;
  prevTradingDay: number;
}

interface VwapRun extends BarRunState<VwapVars> {
  /** The period start of each bar */
  starts: number[];
  prevPlot: Point[];
  vwapPlot: Point[];
  barColors: BarColorData[];
}

function study(inputs: Partial<VwapMtfInputs>): BarStudy<VwapRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const tf = cfg.timeFrame;
  /** 'chart': each bar is its own period; 'utc': the UTC rule of periodStarts; 'pre': the starts of the whole set */
  let mode: 'chart' | 'utc' | 'pre' = 'chart';
  let pre: number[] = [];
  let info: ReturnType<typeof timeframe.info> | null = null;
  let len = 0;
  let inMs = false;
  let everyDay = false;
  return {
    // the UTC periods read the time unit of the first bar and the days of the whole bar set (bars on a weekend)
    key: (bars) => {
      const ms = bars.length > 0 && bars[0].time >= 1e12;
      return `${ms}|${someWeekend(bars, ms)}`;
    },
    // with the exchange calendar the periods come from the calendar of the whole bar set
    fullRunReason: (chart) => (hasCalendar(chart) ? 'exchange calendar periods' : null),
    init(bars, chart) {
      inMs = bars.length > 0 && bars[0].time >= 1e12;
      everyDay = someWeekend(bars, inMs);
      // start = security(tickerid, TimeFrame, time); newSession = change(start) (na on the first bar: no new session)
      if (hasCalendar(chart)) {
        mode = 'pre';
        pre = securityStarts(bars, tf, chart);
      } else if (tf.trim() === '') {
        mode = 'chart';
      } else {
        info = timeframe.info(tf);
        if (info.isticks) throw new RangeError(`Unsupported timeframe "${tf}"`);
        len = info.isintraday ? timeframe.in_seconds(tf) * 1000 : 0;
        mode = 'utc';
      }
      const s: VwapRun = {
        starts: [], prevPlot: [], vwapPlot: [], barColors: [], steps: [],
        vars: {
          vwapsum: NaN, volumesum: NaN, prevwap: NaN, prevVwap: NaN, prevDay: NaN, sessionStart: NaN, prevKey: NaN,
          start: NaN, tradingYear: NaN, tradingDays: -1, prevTradingDay: NaN,
        },
        lists: [], series: [],
      };
      s.lists = [s.barColors];
      s.series = [s.starts, s.prevPlot, s.vwapPlot];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      let start: number;
      if (mode === 'pre') start = pre[i];
      else if (mode === 'chart') start = b.time;
      else {
        const inf = info!;
        const t = inMs ? b.time : b.time * 1000;
        const day = Math.floor(t / DAY) * DAY;
        if (day !== v.prevDay) v.sessionStart = everyDay ? day : t;
        v.prevDay = day;
        if (inf.isintraday) {
          v.start = len >= DAY ? v.sessionStart : v.sessionStart + Math.floor((t - v.sessionStart) / len) * len;
        } else if (inf.isdaily && inf.multiplier > 1 && !everyDay) {
          // n trading days (UTC days with bars) counted from the first trading day of the year
          const year = new Date(day).getUTCFullYear();
          if (year !== v.tradingYear) {
            v.tradingYear = year;
            v.tradingDays = -1;
          }
          if (day !== v.prevTradingDay) {
            v.tradingDays++;
            v.prevTradingDay = day;
            if (v.tradingDays % inf.multiplier === 0) v.start = t;
          }
        } else {
          const key = calendarPeriodStart(day, inf);
          if (key !== v.prevKey) v.start = everyDay ? key : t;
          v.prevKey = key;
        }
        start = inMs ? v.start : Math.floor(v.start / 1000);
      }
      s.starts[i] = start;
      const newSession = i > 0 && start !== s.starts[i - 1];
      const hl2 = (b.high + b.low) / 2;
      const vol = b.volume ?? NaN;
      v.vwapsum = newSession ? hl2 * vol : v.vwapsum + hl2 * vol;
      v.volumesum = newSession ? vol : v.volumesum + vol;
      const myvwap = v.vwapsum / v.volumesum;
      const coloring = gt(b.close, myvwap) ? GREEN : RED;
      if (newSession) v.prevwap = v.prevVwap;
      v.prevVwap = myvwap;
      const prevValue = cfg.showPrevVWAP ? v.prevwap : NaN;
      s.prevPlot[i] = { time: b.time, value: Number.isFinite(prevValue) ? prevValue : NaN, color: gt(b.close, v.prevwap) ? GREEN : RED };
      s.vwapPlot[i] = { time: b.time, value: Number.isFinite(myvwap) ? myvwap : NaN, color: coloring };
      if (cfg.showBcol) s.barColors.push({ id: 'barcolor0', time: b.time, color: coloring });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.prevPlot.slice(), plot1: s.vwapPlot.slice() },
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VwapMtfInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VwapMtfInputs> = {}, chart?: ChartContext): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const VwapMtf = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, barColorConfig };
