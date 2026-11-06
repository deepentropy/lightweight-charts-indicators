/**
 * Time Weighted Average Price (TWAP) Indicator
 *
 * Cumulative average of source within anchor periods.
 * Resets at each new anchor period boundary (timeframe.change(anchor)).
 *
 * 'Anchor Period' accepts any timeframe ("" = the chart timeframe: every bar is its own period). The original takes
 * the periods from the exchange time zone and sessions. The port reads the time zone and the session from the chart
 * context (third argument of calculate) and takes the periods of the exchange calendar. Without them it takes the
 * periods from the UTC calendar and the bars (see src/anchor-period.ts): exact on UTC 24x7 symbols and on symbols
 * whose trading day is inside the UTC day (e.g. US stocks), after the first period of the bars; not on sessions
 * that cross 00:00 UTC.
 */

import {
  timeframe, periodTime, chartSessions, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
  type SessionContext,
} from 'oakscriptjs';
import { chartTimeframe, hasCalendar } from '../anchor-period';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TWAPInputs {
  /** Anchor period: any timeframe string ("1D", "1W", "240", ...; "" = chart timeframe) */
  anchor: string;
  src: SourceType;
  offset: number;
}

export const defaultInputs: TWAPInputs = {
  anchor: '1D',
  src: 'ohlc4',
  offset: 0,
};

export const inputConfig: InputConfig[] = [
  { id: 'anchor', type: 'timeframe', title: 'Anchor Period', defval: '1D' },
  { id: 'src', type: 'source', title: 'Source', defval: 'ohlc4' },
  { id: 'offset', type: 'int', title: 'Offset', defval: 0, display: 'none' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'TWAP', color: '#dd7a28', lineWidth: 1 },
];

export const metadata = {
  title: 'Time Weighted Average Price',
  shortTitle: 'TWAP',
  overlay: true,
};

const DAY = 86400000;
const WEEK = 7 * DAY;

/** Start (UNIX ms, UTC) of the D / W / M calendar period that contains the day `day` (the UTC rule of `periodStarts`) */
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

/** True when a bar of the set is on a Saturday or a Sunday (UTC): the UTC days of `periodStarts` start at 00:00 UTC */
function hasWeekendBars(bars: ReadonlyArray<{ time: number }>): boolean {
  const ms = bars.length > 0 && bars[0].time >= 1e12;
  return bars.some((b) => {
    const wd = new Date(ms ? b.time : b.time * 1000).getUTCDay();
    return wd === 0 || wd === 6;
  });
}

/**
 * The exchange calendar of `periodStarts` (the session context of the chart timeframe, the time zone and the session
 * of the chart context), or null when periodStarts takes the UTC periods of the bars
 */
function exchangeCalendar(bars: Bar[], chart: ChartContext): { ctx: SessionContext; unit: number } | null {
  if (!hasCalendar(chart) || bars.length === 0) return null;
  const tf = chartTimeframe(bars, chart);
  if (tf === '') return null;
  const ms = bars[0].time >= 1e12;
  const ctx: SessionContext = {
    timeframe: tf, timezone: chart.timezone, session: chart.session, regularSession: chart.regularSession,
    timeUnit: ms ? 'ms' : 's',
  };
  try {
    chartSessions(ctx);
    periodTime(bars[0].time, '1D', ctx);
  } catch {
    return null;
  }
  return { ctx, unit: ms ? 1 : 1000 };
}

type Point = { time: number; value: number };

interface TwapVars {
  sum: number;
  count: number;
  /** periodStarts of the previous bar */
  prevStart: number;
  /** The UTC rule of periodStarts: day and session start of the previous bar, period key, start, "nD" count */
  prevDay: number;
  sessionStart: number;
  prevKey: number;
  start: number;
  tradingYear: number;
  tradingDays: number;
  prevTradingDay: number;
}

interface TwapRun extends BarRunState<TwapVars> {
  twapArr: number[];
  plotData: Point[];
}

function study(inputs: Partial<TWAPInputs>): BarStudy<TwapRun, IndicatorResult> {
  const { anchor, src, offset } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const chartTf = anchor.trim() === '';
  /** Set by init (they read the chart and the bars) */
  let info: ReturnType<typeof timeframe.info> | null = null;
  let calendar: { ctx: SessionContext; unit: number } | null = null;
  let ms = false;
  let everyDay = false;
  let len = 0;

  /** periodStarts(bars, anchor, chart)[i], from the state of the bars before it */
  const periodStart = (v: TwapVars, i: number, bars: Bar[]): number => {
    const b = bars[i];
    if (chartTf) return b.time;
    const inf = info!;
    if (calendar) {
      const t = periodTime(b.time, anchor, calendar.ctx);
      if (!Number.isNaN(t)) return t / calendar.unit;
      return i > 0 && chartSessions(calendar.ctx).bars.stray(b.time * calendar.unit) ? v.prevStart : b.time;
    }
    const t = ms ? b.time : b.time * 1000;
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
    return ms ? v.start : Math.floor(v.start / 1000);
  };

  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    // periodStarts reads the time unit, the weekend bars of the set and the chart timeframe of the calendar
    key: (bars, chart) => {
      if (chartTf) return '';
      const n = bars.length;
      return `${n > 0 && bars[0].time >= 1e12}|${hasWeekendBars(bars)}|${hasCalendar(chart) && n > 0 ? chartTimeframe(bars, chart) : ''}`;
    },
    init(bars, chart) {
      if (!chartTf) {
        info = timeframe.info(anchor);
        if (info.isticks) throw new RangeError(`Unsupported timeframe "${anchor}"`);
        calendar = exchangeCalendar(bars, chart);
        ms = bars.length > 0 && bars[0].time >= 1e12;
        everyDay = hasWeekendBars(bars);
        len = info.isintraday ? timeframe.in_seconds(anchor) * 1000 : 0;
      }
      const s: TwapRun = {
        twapArr: [], plotData: [], steps: [],
        vars: {
          sum: 0, count: 0, prevStart: NaN, prevDay: NaN, sessionStart: NaN, prevKey: NaN, start: NaN, tradingYear: NaN,
          tradingDays: -1, prevTradingDay: NaN,
        },
        lists: [], series: [],
      };
      s.series = [s.twapArr, s.plotData];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const start = periodStart(v, i, bars);
      // timeframe.change(anchor)
      if (i > 0 && start !== v.prevStart) {
        v.sum = 0;
        v.count = 0;
      }
      v.prevStart = start;

      const val = value(bars[i]);
      if (val != null && !isNaN(val)) {
        v.sum += val;
        v.count++;
      }

      s.twapArr[i] = v.count > 0 ? v.sum / v.count : NaN;
      if (offset === 0) s.plotData[i] = { time: bars[i].time, value: s.twapArr[i] };
    },
    result(s, bars) {
      // a plot moved by the offset: from the values of every bar (the last bars are na for a negative offset)
      const plotData = offset === 0 ? s.plotData.slice() : bars.map((bar, i) => {
        const srcIdx = i - offset;
        return { time: bar.time, value: (srcIdx >= 0 && srcIdx < bars.length) ? s.twapArr[srcIdx] : NaN };
      });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': plotData },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TWAPInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TWAPInputs> = {}, chart?: ChartContext): IndicatorResult {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const TWAP = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
