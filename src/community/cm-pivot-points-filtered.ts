/**
 * CM Pivot Points M-W-D-4H-1H Filtered
 *
 * Classic pivot levels of the previous 1 hour, 4 hour, daily, weekly, monthly and yearly bar of the same symbol:
 * pivot = (high + low + close) / 3, R1 / S1, R2 / S2 = pivot +- (high - low), R3 / S3 (1 hour and 4 hour only) and
 * the 3-bar average of the pivot. With "Show Filtered Pivots" only the pivot, R1 and S1 are drawn, and R1 / S1
 * depend on the move of the pivot: when the pivot rises more than 0.0025 above the mean of the last two pivots, R1
 * is pivot + range; when it falls more than 0.0025 below, S1 is pivot - range.
 *
 * As in the original, the "4 Hour S3" plot follows the weekly switch (not the 4 hour switch).
 *
 * The bars of each timeframe are built from the chart bars (periods from the UTC calendar and the bars, see
 * src/anchor-period.ts): the levels of a period need the full previous bar of that timeframe in the chart bars (3
 * bars for the pivot average). As in the original (a version 1 script), every chart bar of a period shows the
 * levels of that period. A timeframe below the chart timeframe needs data that the bars do not carry: the port
 * throws an Error when such a timeframe is switched on.
 *
 * Periods and the chart context (optional third argument of calculate): with the exchange time zone and the session
 * of the symbol (`timezone`, `session`) the periods are those of the exchange calendar (its trading days, holidays
 * and session hours), and a bar of a higher timeframe is complete on the chart bar whose close reaches the end of
 * its period, see src/anchor-period.ts.
 * Without them the port uses the UTC calendar and the bars, as described in this header. `timeframe`, when given,
 * is the chart timeframe; without it the chart timeframe is read from the bar spacing.
 *
 * Reference: "CM_Pivot Points_M-W-D-4H-1H_Filtered" by ChrisMoody
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, Series, color, timeframe, resample, mapToChart,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import { periodStarts, chartTimeframe, hasCalendar, securityBars } from '../anchor-period';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CmPivotPointsFilteredInputs {
  /** Show Filtered Pivots */
  pf: boolean;
  /** Show Pivot Average */
  sa: boolean;
  /** Show 1 Hour Pivots */
  sh: boolean;
  /** Show 4 Hour Pivots */
  sf: boolean;
  /** Show Daily Pivots */
  sd: boolean;
  /** Show Weekly Pivots */
  sw: boolean;
  /** Show Monthly Pivots */
  sm: boolean;
  /** Show Yearly Pivots */
  sy: boolean;
  /** Show R3 & S3 (1 hour and 4 hour only) */
  sh3: boolean;
}

export const defaultInputs: CmPivotPointsFilteredInputs = {
  pf: true,
  sa: true,
  sh: false,
  sf: false,
  sd: false,
  sw: false,
  sm: true,
  sy: false,
  sh3: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'pf', type: 'bool', title: 'Show Filtered Pivots', defval: true },
  { id: 'sa', type: 'bool', title: 'Show Pivot Average', defval: true },
  { id: 'sh', type: 'bool', title: 'Show 1 Hour Pivots?', defval: false },
  { id: 'sf', type: 'bool', title: 'Show 4 Hour Pivots?', defval: false },
  { id: 'sd', type: 'bool', title: 'Show Daily Pivots?', defval: false },
  { id: 'sw', type: 'bool', title: 'Show Weekly Pivots?', defval: false },
  { id: 'sm', type: 'bool', title: 'Show Monthly Pivots?', defval: true },
  { id: 'sy', type: 'bool', title: 'Show Yearly Pivots?', defval: false },
  { id: 'sh3', type: 'bool', title: 'Show R3 & S3 Only On 1 Hour & 4 Hour?', defval: false },
];

// Colour constants of Pine version 1, with the default plot transparency of that version (35)
const V1 = (hex: string) => String(color.new(hex, 35));
const ORANGE = V1('#FF7F00');
const FUCHSIA = V1('#FF00FF');
const CRIMSON = V1('#DC143C');
const LIME = V1('#00FF00');
const MAROON = V1('#800000');
const FOREST = V1('#228B22');
const SALMON = V1('#FA8072');
const INDIAN_RED = V1('#CD5C5C');

type Level = 'avg' | 'pivot' | 'r1' | 's1' | 'r2' | 's2' | 'r3' | 's3';
type Switch = 'sh' | 'sf' | 'sd' | 'sw' | 'sm' | 'sy';
interface Spec {
  title: string;
  tf: string;
  level: Level;
  /** Input that shows the plot */
  on: Switch;
  color: string;
  width: number;
  style: 'cross' | 'circles';
}

/** The plots of one timeframe, in the order of the original */
function group(
  name: string, tf: string, on: Switch, widths: [number, number], levels: Level[],
  opt: { style?: 'cross' | 'circles'; r1Color?: string; s3On?: Switch } = {},
): Spec[] {
  const titles: Record<Level, string> = {
    avg: 'Pivot Average', pivot: 'Pivot', r1: 'R1', s1: 'S1', r2: 'R2', s2: 'S2', r3: 'R3', s3: 'S3',
  };
  const colors: Record<Level, string> = {
    avg: ORANGE, pivot: FUCHSIA, r1: opt.r1Color ?? CRIMSON, s1: LIME, r2: MAROON, s2: FOREST, r3: SALMON, s3: INDIAN_RED,
  };
  return levels.map((level) => ({
    title: `${name} ${titles[level]}`,
    tf,
    level,
    on: level === 's3' && opt.s3On ? opt.s3On : on,
    color: colors[level],
    width: level === 'avg' ? widths[0] : widths[1],
    style: level === 'avg' ? 'cross' : opt.style ?? 'circles',
  }));
}

const SIX: Level[] = ['avg', 'pivot', 'r1', 's1', 'r2', 's2'];
const EIGHT: Level[] = [...SIX, 'r3', 's3'];
const SPECS: Spec[] = [
  ...group('Hourly', '60', 'sh', [2, 2], EIGHT),
  // plot(sw and ftime_S3 ? ftime_S3 : na, title = "4 Hour S3"): the weekly switch, as in the original
  ...group('4 Hour', '240', 'sf', [2, 3], EIGHT, { s3On: 'sw' }),
  ...group('Daily', 'D', 'sd', [2, 3], SIX),
  ...group('Weekly', 'W', 'sw', [3, 4], SIX),
  ...group('Monthly', 'M', 'sm', [4, 5], SIX, { r1Color: V1('#DC145C') }),
  ...group('Yearly', '12M', 'sy', [4, 6], SIX, { style: 'cross' }),
];

export const plotConfig: PlotConfig[] = SPECS.map((s, j) => ({
  id: `plot${j}`, title: s.title, color: s.color, lineWidth: s.width, style: s.style,
}));

export const metadata = {
  title: 'CM_Pivot Points_M-W-D_4H_1H_Filtered',
  shortTitle: 'CM_Pivots_Filtered',
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
function timeframeBars(bars: Bar[], tf: string, context?: ChartContext): { htf: Bar[]; toChart: (values: number[]) => number[] } {
  const chart = chartTimeframe(bars, context);
  if (tf.trim() === '' || chart === '' || timeframe.in_seconds(tf) === timeframe.in_seconds(chart)) {
    return { htf: bars, toChart: (values) => values };
  }
  if (timeframe.in_seconds(tf) < timeframe.in_seconds(chart)) {
    throw new Error(`The timeframe "${tf}" is lower than the chart timeframe "${chart}": the bars do not carry that data.`);
  }
  // With the exchange calendar of the chart context (time zone and session): the periods come from the library rule
  // (see anchor-period.ts); without it, the periods of the UTC calendar and the bars, grouped by the library
  const exchange = securityBars(bars, tf, context);
  const { bars: htf, group } = exchange ? { bars: exchange.htf, group: exchange.group } : resample(bars, periodStarts(bars, tf));
  // lookahead: every chart bar of a period shows the value of the period
  return { htf, toChart: (values) => mapToChart(values, group, [], true, false) };
}

/** security(tickerid, tf, level[1]) of every level: the levels of the previous bar of timeframe `tf`, on the chart bars */
function levelsOf(bars: Bar[], tf: string, pf: boolean, sh3: boolean, context?: ChartContext): Record<Level, number[]> {
  const { htf, toChart } = timeframeBars(bars, tf, context);
  const m = htf.length;
  const pivot = htf.map((b) => (b.high + b.low + b.close) / 3.0);
  const smaP = ta.sma(Series.fromArray(htf, pivot), 3).toArray().map((v) => v ?? NaN);
  const out: Record<Level, number[]> = { avg: smaP, pivot, r1: [], s1: [], r2: [], s2: [], r3: [], s3: [] };
  for (let i = 0; i < m; i++) {
    const { high, low } = htf[i];
    const p = pivot[i];
    const mean = (p + (i > 0 ? pivot[i - 1] : NaN)) / 2;
    const bull = gt(p, mean + 0.0025);
    const bear = lt(p, mean - 0.0025);
    const r1 = pf && bear ? p + (p - low) : pf && bull ? p + (high - low) : p + (p - low);
    const s1 = pf && bull ? p - (high - p) : pf && bear ? p - (high - low) : p - (high - p);
    out.r1.push(r1);
    out.s1.push(s1);
    out.r2.push(pf ? NaN : p + (high - low));
    out.s2.push(pf ? NaN : p - (high - low));
    // r3 = sh3 and r1 + (high - low) ? r1 + (high - low) : na
    const r3 = r1 + (high - low);
    const s3 = s1 - (high - low);
    out.r3.push(sh3 && truthy(r3) ? r3 : NaN);
    out.s3.push(sh3 && truthy(s3) ? s3 : NaN);
  }
  const previous = (a: number[]) => toChart(a.map((_v, i) => (i > 0 ? a[i - 1] : NaN)));
  return {
    avg: previous(out.avg), pivot: previous(out.pivot), r1: previous(out.r1), s1: previous(out.s1),
    r2: previous(out.r2), s2: previous(out.s2), r3: previous(out.r3), s3: previous(out.s3),
  };
}

type Point = { time: number; value: number };

const DAY = 86400000;
const WEEK = 7 * DAY;
const LEVELS: Level[] = ['avg', 'pivot', 'r1', 's1', 'r2', 's2', 'r3', 's3'];
const NO_LEVELS = LEVELS.map(() => NaN);

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

/** One timeframe of the run: its periods (the UTC rule of `periodStarts`, one bar at a time), the bar of the current
 *  period and the levels of the previous one */
interface TfState {
  /** 'off': not shown; 'chart': each chart bar is a period; 'utc': the UTC calendar periods; 'pre': levels computed
   *  on all bars (exchange calendar) */
  mode: 'off' | 'chart' | 'utc' | 'pre';
  pre: Record<Level, number[]> | null;
  // periodStarts state
  prevDay: number;
  sessionStart: number;
  prevKey: number;
  start: number;
  tradingYear: number;
  tradingDays: number;
  prevTradingDay: number;
  /** Start of the current period (resample: the time of its bar), its high / low / close */
  cur: number;
  high: number;
  low: number;
  close: number;
  /** Pivot of the last completed bar of the timeframe */
  lastPivot: number;
  /** The levels of the previous period (LEVELS order) */
  prev: number[];
}

interface PivotVars {
  tfs: TfState[];
}

interface PivotRun extends BarRunState<PivotVars> {
  /** ta.sma(pivot, 3) of each timeframe, stepped on the bar that completes a bar of the timeframe */
  smas: WindowSma[];
  plots: Point[][];
}

/** The timeframes of SPECS, in their order */
const TFS = [...new Set(SPECS.map((s) => s.tf))];

function study(inputs: Partial<CmPivotPointsFilteredInputs>): BarStudy<PivotRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  // plot(sa and sh and htime_pivotAvg ? htime_pivotAvg : na) / plot(sh and htime_pivot ? htime_pivot : na)
  // r3 / s3 are na without sh3 (r3 = sh3 and ... ? ... : na)
  const SHOWN = SPECS.map((s) => !!cfg[s.on] && (s.level !== 'avg' || cfg.sa) && ((s.level !== 'r3' && s.level !== 's3') || cfg.sh3));
  const SPEC_TF = SPECS.map((s) => TFS.indexOf(s.tf));
  const SPEC_LEVEL = SPECS.map((s) => LEVELS.indexOf(s.level));
  let inMs = false;
  let everyDay = false;
  let infos: Array<ReturnType<typeof timeframe.info>> = [];
  const weekend = (t: number) => {
    const wd = new Date(t).getUTCDay();
    return wd === 0 || wd === 6;
  };
  const someWeekend = (bars: Bar[], ms: boolean) => bars.some((b) => weekend(ms ? b.time : b.time * 1000));
  return {
    // the chart timeframe comes from the bar gaps, the time unit from the first bar, the UTC periods from the days
    // of the whole bar set (bars on a weekend)
    key: (bars, chart) => {
      const ms = bars.length > 0 && bars[0].time >= 1e12;
      return `${chartTimeframe(bars, chart)}|${ms}|${someWeekend(bars, ms)}`;
    },
    // with the exchange calendar the periods come from the calendar of the whole bar set
    fullRunReason: (chart) => (hasCalendar(chart) ? 'exchange calendar periods' : null),
    init(bars, chart) {
      inMs = bars.length > 0 && bars[0].time >= 1e12;
      everyDay = someWeekend(bars, inMs);
      const chartTf = chartTimeframe(bars, chart);
      infos = TFS.map((tf) => timeframe.info(tf));
      // A timeframe is computed only when one of its plots is shown
      const tfs: TfState[] = TFS.map((tf, k) => {
        const st: TfState = {
          mode: 'off', pre: null, prevDay: NaN, sessionStart: NaN, prevKey: NaN, start: NaN, tradingYear: NaN,
          tradingDays: -1, prevTradingDay: NaN, cur: NaN, high: NaN, low: NaN, close: NaN, lastPivot: NaN, prev: NO_LEVELS,
        };
        if (!SPECS.some((s, j) => SHOWN[j] && SPEC_TF[j] === k)) return st;
        if (hasCalendar(chart)) {
          st.mode = 'pre';
          st.pre = levelsOf(bars, tf, cfg.pf, cfg.sh3, chart);
          return st;
        }
        if (tf.trim() === '' || chartTf === '' || timeframe.in_seconds(tf) === timeframe.in_seconds(chartTf)) {
          st.mode = 'chart';
          return st;
        }
        if (timeframe.in_seconds(tf) < timeframe.in_seconds(chartTf)) {
          throw new Error(`The timeframe "${tf}" is lower than the chart timeframe "${chartTf}": the bars do not carry that data.`);
        }
        if (infos[k].isticks) throw new RangeError(`Unsupported timeframe "${tf}"`);
        st.mode = 'utc';
        return st;
      });
      const smas = TFS.map(() => new WindowSma(3));
      const s: PivotRun = { smas, plots: SPECS.map(() => []), steps: smas, vars: { tfs }, lists: [], series: [] };
      s.series = s.plots;
      return s;
    },
    copyVars: (v) => ({ tfs: v.tfs.map((t) => ({ ...t })) }),
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      // changed in place: copyVars copies them at the end of the last confirmed bar
      const tfs = s.vars.tfs;
      for (let k = 0; k < tfs.length; k++) {
        const st = tfs[k];
        if (st.mode === 'off' || st.mode === 'pre') continue;
        // the period of the bar: periodStarts(bars, tf) (each chart bar for the chart timeframe)
        let start: number;
        if (st.mode === 'chart') start = i;
        else {
          const info = infos[k];
          const t = inMs ? time : time * 1000;
          const day = Math.floor(t / DAY) * DAY;
          if (day !== st.prevDay) st.sessionStart = everyDay ? day : t;
          st.prevDay = day;
          if (info.isintraday) {
            const len = timeframe.in_seconds(TFS[k]) * 1000;
            st.start = len >= DAY ? st.sessionStart : st.sessionStart + Math.floor((t - st.sessionStart) / len) * len;
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
          start = inMs ? st.start : Math.floor(st.start / 1000);
        }
        // resample(bars, starts): a new bar of the timeframe when the start differs from the time of the last one
        if (i === 0 || st.cur !== start) {
          if (i > 0) {
            // security(tickerid, tf, level[1]): the levels of the completed bar of the timeframe
            const { high, low, close } = st;
            const p = (high + low + close) / 3.0;
            const avg = s.smas[k].step(p);
            const mean = (p + st.lastPivot) / 2;
            const bull = gt(p, mean + 0.0025);
            const bear = lt(p, mean - 0.0025);
            const pf = cfg.pf;
            const r1 = pf && bear ? p + (p - low) : pf && bull ? p + (high - low) : p + (p - low);
            const s1 = pf && bull ? p - (high - p) : pf && bear ? p - (high - low) : p - (high - p);
            // r3 = sh3 and r1 + (high - low) ? r1 + (high - low) : na
            const r3 = r1 + (high - low);
            const s3 = s1 - (high - low);
            st.prev = [
              avg, p, r1, s1, pf ? NaN : p + (high - low), pf ? NaN : p - (high - low),
              cfg.sh3 && truthy(r3) ? r3 : NaN, cfg.sh3 && truthy(s3) ? s3 : NaN,
            ];
            st.lastPivot = p;
          }
          st.cur = start;
          st.high = b.high;
          st.low = b.low;
          st.close = b.close;
        } else {
          st.high = Math.max(st.high, b.high);
          st.low = Math.min(st.low, b.low);
          st.close = b.close;
        }
      }
      for (let j = 0; j < SPECS.length; j++) {
        let v = NaN;
        if (SHOWN[j]) {
          const st = tfs[SPEC_TF[j]];
          v = st.mode === 'pre' ? st.pre![SPECS[j].level][i] : st.prev[SPEC_LEVEL[j]];
        }
        s.plots[j][i] = { time, value: truthy(v) ? v : NaN };
      }
    },
    result(s) {
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, j) => { plots[`plot${j}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CmPivotPointsFilteredInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CmPivotPointsFilteredInputs> = {}, chart?: ChartContext): IndicatorResult {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const CmPivotPointsFiltered = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
