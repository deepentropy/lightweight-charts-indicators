/**
 * Sessions on Chart
 *
 * Four trading sessions (London, New York, Tokyo, Sydney), each with its own hours read in New York time. On the
 * bars inside a session the script keeps the low and the high of the session; they restart when a new period of the
 * "Resolution" timeframe (day, week or month) starts.
 * Display: the background of the session bars takes the session colour, or, with "Activate High/Low View", the area
 * between the session low and the session high is filled instead. The low and high plots themselves are invisible.
 *
 * The periods of "Resolution" are counted on the trading days of the session itself, in New York time: a session
 * that goes over midnight is one trading day (the day it ends). The low and high restart on the first session bar
 * of a new period only: with "D" once per trading day (the second part of a session in two parts has no low / high),
 * with "W" / "M" on the first session of the week / month (the other sessions have no low / high).
 * `time(res, session, timezone)` comes from the library (clock-change days placed as in the original).
 *
 * Reference: "Sessions" by Aurocks_AIF
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Aurocks_AIF
 */

import {
  color, periodTime,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SessionContext,
} from 'oakscriptjs';
import { chartTimeframe } from '../anchor-period';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SessionsOnChartInputs {
  /** Fill the area between the session low and high instead of the background */
  bgColor: boolean;
  /** Timeframe whose new period restarts the session low / high */
  res: 'D' | 'W' | 'M';
  london: string;
  ny: string;
  tokyo: string;
  sydney: string;
  London: boolean;
  NY: boolean;
  Tokyo: boolean;
  Sydney: boolean;
}

export const defaultInputs: SessionsOnChartInputs = {
  bgColor: false,
  res: 'D',
  london: '0300-1200:1234567',
  ny: '0800-1700:1234567',
  tokyo: '2000-0400:1234567',
  sydney: '1700-0200:1234567',
  London: true,
  NY: true,
  Tokyo: true,
  Sydney: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'bgColor', type: 'bool', title: 'Activate High/Low View', defval: false },
  { id: 'res', type: 'timeframe', title: 'Resolution', defval: 'D', options: ['D', 'W', 'M'] },
  { id: 'london', type: 'session', title: 'London Session', defval: '0300-1200:1234567' },
  { id: 'ny', type: 'session', title: 'New York Session', defval: '0800-1700:1234567' },
  { id: 'tokyo', type: 'session', title: 'Tokyo Session', defval: '2000-0400:1234567' },
  { id: 'sydney', type: 'session', title: 'Sydney Session', defval: '1700-0200:1234567' },
  { id: 'London', type: 'bool', title: 'London Session', defval: true },
  { id: 'NY', type: 'bool', title: 'New York Session', defval: true },
  { id: 'Tokyo', type: 'bool', title: 'Tokyo Session', defval: true },
  { id: 'Sydney', type: 'bool', title: 'Sydney Session', defval: false },
];

const INVISIBLE = String(color.new('#000000', 100));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'London Low', color: INVISIBLE, lineWidth: 1 },
  { id: 'plot1', title: 'London High', color: INVISIBLE, lineWidth: 1 },
  { id: 'plot2', title: 'New York Low', color: INVISIBLE, lineWidth: 1 },
  { id: 'plot3', title: 'New York High', color: INVISIBLE, lineWidth: 1 },
  { id: 'plot4', title: 'Tokyo Low', color: INVISIBLE, lineWidth: 1 },
  { id: 'plot5', title: 'Tokyo High', color: INVISIBLE, lineWidth: 1 },
  { id: 'plot6', title: 'Sydney Low', color: INVISIBLE, lineWidth: 1 },
  { id: 'plot7', title: 'Sydney High', color: INVISIBLE, lineWidth: 1 },
];

export const metadata = {
  title: 'Sessions',
  shortTitle: 'Sessions',
  overlay: true,
};

const TIMEZONE = 'America/New_York';
// color.new(color.green / red / yellow / blue, 90) of Pine v5
const LONDON_COLOR = String(color.new('#4CAF50', 90));
const NY_COLOR = String(color.new('#FF5252', 90));
const ASIA_COLOR = String(color.new('#FFEB3B', 90));
const SYDNEY_COLOR = String(color.new('#2962FF', 90));

/**
 * time(tf, session, "America/New_York") of a bar (ms), from the library: an intraday timeframe is na outside the
 * session; "D" tests the bar against the day's session period (clock-change days placed as PineScript does; the
 * pause between two runs of a day is inside it); "W" / "M" have no session test and keep the period's time (a bar
 * between two sessions of a week is in that week).
 */
function sessionTime(session: string, tf: string, chartTf: string): (tMs: number) => number {
  // the chart session of the context is not read when the session argument is given
  const ctx: SessionContext = { timeframe: chartTf, timezone: TIMEZONE, session, timeUnit: 'ms' };
  return (tMs) => periodTime(tMs, tf, ctx, session, TIMEZONE);
}

type Point = { time: number; value: number };

interface SessionsVars {
  /** Per session: time(res, sess) of the bar before, the session low and high */
  prevT: number[];
  low: number[];
  high: number[];
}

interface SessionsRun extends BarRunState<SessionsVars> {
  plots: Point[][];
  fill: string[][];
  bgColors: BgColorData[];
}

function study(inputs: Partial<SessionsOnChartInputs>): BarStudy<SessionsRun, IndicatorResult & { bgColors: BgColorData[] }> {
  const cfg = { ...defaultInputs, ...inputs };
  const res = cfg.res.replace(/^1/, '');
  let sessions: Array<{ show: boolean; col: string; sessionT: (t: number) => number; periodT: (t: number) => number }> = [];
  let inMs = false;
  return {
    // the chart timeframe comes from the bar gaps, the time unit from the first bar
    key: (bars) => `${chartTimeframe(bars) || '1D'}|${bars.length > 0 && bars[0].time >= 1e12}`,
    init(bars) {
      inMs = bars.length > 0 && bars[0].time >= 1e12;
      const chartTf = chartTimeframe(bars) || '1D';
      sessions = [
        { hours: cfg.london, show: cfg.London, col: LONDON_COLOR },
        { hours: cfg.ny, show: cfg.NY, col: NY_COLOR },
        { hours: cfg.tokyo, show: cfg.Tokyo, col: ASIA_COLOR },
        { hours: cfg.sydney, show: cfg.Sydney, col: SYDNEY_COLOR },
      ].map((s) => ({
        show: s.show,
        col: s.col,
        // is_session(): time(timeframe.period, sess, "America/New_York"); is_newbar(): time(res, sess, ...)
        sessionT: sessionTime(s.hours, chartTf, chartTf),
        periodT: sessionTime(s.hours, res, chartTf),
      }));
      const s: SessionsRun = {
        plots: Array.from({ length: 8 }, () => []),
        fill: sessions.map(() => []),
        bgColors: [],
        steps: [],
        vars: { prevT: [NaN, NaN, NaN, NaN], low: [NaN, NaN, NaN, NaN], high: [NaN, NaN, NaN, NaN] },
        lists: [],
        series: [],
      };
      s.lists = [s.bgColors];
      s.series = [...s.plots, ...s.fill];
      return s;
    },
    bar(s, i, bars) {
      const { time, high, low } = bars[i];
      const tMs = inMs ? time : time * 1000;
      // changed in place: copyVars copies them at the end of the last confirmed bar
      const { prevT, low: lows, high: highs } = s.vars;
      sessions.forEach((ss, k) => {
        // is_session(): not na(time(timeframe.period, sess, "America/New_York"))
        const inSession = !Number.isNaN(ss.sessionT(tMs));
        // is_newbar(): t = time(res, sess, "America/New_York"); na(t[1]) and not na(t) or t[1] < t
        const t = ss.periodT(tMs);
        const newBar = (Number.isNaN(prevT[k]) && !Number.isNaN(t)) || prevT[k] < t;
        prevT[k] = t;
        // float low = na; low := if session (if newbar low else math.min(low[1], low)) else low
        if (inSession) {
          lows[k] = newBar ? low : Math.min(lows[k], low);
          highs[k] = newBar ? high : Math.max(highs[k], high);
        } else {
          lows[k] = NaN;
          highs[k] = NaN;
        }
        s.plots[2 * k][i] = { time, value: lows[k] };
        s.plots[2 * k + 1][i] = { time, value: highs[k] };
        const on = inSession && ss.show;
        s.fill[k][i] = on && cfg.bgColor ? ss.col : 'transparent';
        if (on && !cfg.bgColor) s.bgColors.push({ time, color: ss.col });
      });
    },
    copyVars: (v) => ({ prevT: v.prevT.slice(), low: v.low.slice(), high: v.high.slice() }),
    result(s) {
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills: s.fill.map((f, k) => ({ plot1: `plot${2 * k}`, plot2: `plot${2 * k + 1}`, colors: f.slice() })),
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SessionsOnChartInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult & { bgColors: BgColorData[] }> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<SessionsOnChartInputs> = {},
): IndicatorResult & { bgColors: BgColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}


export const SessionsOnChart = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
