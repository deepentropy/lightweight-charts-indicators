/**
 * vdub_Trend_Master_v (version 1 script that joins several tools of other authors):
 * - MA2: the 144-bar SMA of the close.
 * - An Ichimoku cloud: Lead 1 = mean of the Donchian midlines of 34 and 26 bars, Lead 2 = Donchian midline of 52 bars,
 *   both drawn 26 bars ahead, filled black at 90 % transparency.
 * - Extremes of a higher timeframe (RicardoSantos): highest high / lowest low of the last 2 bars of the timeframe
 *   "ExtremeTimeFrame" (default 240), red / green while the value does not change (no colour on a change).
 * - Previous day high / low (Lachlan Smith), cross style; the weekly / monthly switches draw the DAILY levels too
 *   (as the original), shown only while the weekly / monthly levels exist.
 * - Madrid moving average ribbon: EMA (or SMA) of 5 to 90 bars, each grey / red / silver by its slope and by the
 *   5-bar average against the 100-bar average.
 * - Madrid profit area: fast and slow averages (5 / 90), silver when rising, else red, filled silver.
 * - Jurij: the 10-bar lowest low / highest high channel and a ★ "Sell" / "Buy" mark on a bar whose high (low) is the
 *   highest (lowest) of the 10 bars on each side, drawn 11 bars back. The input "Show PTZ" is not read by the original.
 *
 * Other timeframes: `security(tickerid, tf, ...)` of version 1: every chart bar of a period shows the value of the bar
 * of that timeframe that holds it (as lookahead on, no gaps). The bars of the timeframe are built from the chart bars
 * (exchange calendar of the chart context when given, else the UTC calendar and the bars; see src/anchor-period.ts).
 * A timeframe equal to the chart timeframe is the chart series. A timeframe below the chart timeframe (e.g. the
 * default "240" on a daily chart) needs the bars of that lower timeframe, which the chart does not have: the port
 * throws an Error.
 *
 * Plot colours are the version 1 colour constants with the default plot transparency of that version (35). The
 * untitled Lead plots have no colour in Pine: the version 1 blue. `trackprice = true` of the daily / weekly / monthly
 * plots is not drawn.
 *
 * Reference: "vdub_Trend_Master_v  /  v1 / v2 / v3" by vdubus
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, taCore, taStep, Series, color, timeframe, resample, mapToChart,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type MarkerData,
} from 'oakscriptjs';
import { periodStarts, chartTimeframe, securityBars, hasCalendar } from '../anchor-period';
import type { ChartContext } from '../chart-context';
import { barInterval, barTime } from '../bar-time';
import {
  createBarRun, fullResult, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type Committable, type IndicatorRun,
} from '../live-run';

export interface VdubTrendMasterInputs {
  /** MA2 Period: */
  m2P: number;
  conversionPeriods: number;
  basePeriods: number;
  laggingSpan2Periods: number;
  displacement: number;
  extremeTimeFrame: string;
  extremeTimeWindow: number;
  /** Show Daily High & Lows? */
  disDaily: boolean;
  /** Show Weekly High & Lows? */
  disWeekly: boolean;
  /** Show Monthly High & Lows? */
  disMonthly: boolean;
  /** Exponential MA (ribbon) */
  exponential: boolean;
  /** Fast MA Length */
  fastLen: number;
  /** Slow MA Length */
  slowLen: number;
  /** Exponential MA (profit area) */
  exponential_1: boolean;
  /** h left */
  hLeft: number;
  /** h right */
  hRight: number;
  /** Show PTZ (not read by the original) */
  showPtz: boolean;
  /** Show channel */
  showChannel: boolean;
}

export const defaultInputs: VdubTrendMasterInputs = {
  m2P: 144,
  conversionPeriods: 34,
  basePeriods: 26,
  laggingSpan2Periods: 52,
  displacement: 26,
  extremeTimeFrame: '240',
  extremeTimeWindow: 2,
  disDaily: true,
  disWeekly: false,
  disMonthly: false,
  exponential: true,
  fastLen: 5,
  slowLen: 90,
  exponential_1: true,
  hLeft: 10,
  hRight: 10,
  showPtz: true,
  showChannel: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'm2P', type: 'int', title: 'MA2 Period:', defval: 144 },
  { id: 'conversionPeriods', type: 'int', title: 'conversionPeriods', defval: 34, min: 1 },
  { id: 'basePeriods', type: 'int', title: 'basePeriods', defval: 26, min: 1 },
  { id: 'laggingSpan2Periods', type: 'int', title: 'laggingSpan2Periods', defval: 52, min: 1 },
  { id: 'displacement', type: 'int', title: 'displacement', defval: 26, min: 1 },
  { id: 'extremeTimeFrame', type: 'string', title: 'ExtremeTimeFrame', defval: '240' },
  { id: 'extremeTimeWindow', type: 'int', title: 'ExtremeTimeWindow', defval: 2 },
  { id: 'disDaily', type: 'bool', title: 'Show Daily High & Lows?', defval: true },
  { id: 'disWeekly', type: 'bool', title: 'Show Weekly High & Lows?', defval: false },
  { id: 'disMonthly', type: 'bool', title: 'Show Monthly High & Lows?', defval: false },
  { id: 'exponential', type: 'bool', title: 'Exponential MA', defval: true },
  { id: 'fastLen', type: 'int', title: 'Fast MA Length', defval: 5, min: 1 },
  { id: 'slowLen', type: 'int', title: 'Slow MA Length', defval: 90, min: 1 },
  { id: 'exponential_1', type: 'bool', title: 'exponential_1', defval: true },
  { id: 'hLeft', type: 'int', title: 'h left', defval: 10 },
  { id: 'hRight', type: 'int', title: 'h right', defval: 10 },
  { id: 'showPtz', type: 'bool', title: 'Show PTZ', defval: true },
  { id: 'showChannel', type: 'bool', title: 'Show channel', defval: true },
];

// Colour constants of Pine version 1, with the default plot transparency of that version (35)
const V1 = (hex: string) => String(color.new(hex, 35));
const BLUE = V1('#0000FF');
const RED = V1('#FF0000');
const GREEN = V1('#008000');
const BLACK = V1('#000000');
const SILVER = V1('#C0C0C0');
const GRAY = V1('#808080');

const MMA_LENGTHS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90];
const mmaTitle = (len: number) => `MMA${String(len).padStart(2, '0')}`;

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA2', color: BLUE, lineWidth: 1 },
  { id: 'plot1', title: 'Lead 1', color: BLUE, lineWidth: 1 },
  { id: 'plot2', title: 'Lead 2', color: BLUE, lineWidth: 1 },
  { id: 'plot3', title: 'Extreme High', color: RED, lineWidth: 1 },
  { id: 'plot4', title: 'Extreme Low', color: GREEN, lineWidth: 1 },
  { id: 'plot5', title: 'Daily High', color: BLACK, lineWidth: 1, style: 'cross' },
  { id: 'plot6', title: 'Daily Low', color: BLACK, lineWidth: 1, style: 'cross' },
  { id: 'plot7', title: 'Weekly High', color: SILVER, lineWidth: 1, style: 'cross' },
  { id: 'plot8', title: 'Weekly Low', color: SILVER, lineWidth: 1, style: 'cross' },
  { id: 'plot9', title: 'Monthly High', color: SILVER, lineWidth: 1, style: 'cross' },
  { id: 'plot10', title: 'Monthly Low', color: SILVER, lineWidth: 1, style: 'cross' },
  ...MMA_LENGTHS.map((len, k) => ({
    id: `plot${11 + k}`, title: mmaTitle(len), color: GRAY, lineWidth: len === 5 || len === 90 ? 3 : 1,
  })),
  { id: 'plot29', title: 'Fast MA', color: SILVER, lineWidth: 1 },
  { id: 'plot30', title: 'Slow MA', color: SILVER, lineWidth: 1 },
  { id: 'plot31', title: 'Channel Low', color: SILVER, lineWidth: 1 },
  { id: 'plot32', title: 'Channel High', color: SILVER, lineWidth: 1 },
];

export const metadata = {
  title: 'vdub_Trend_Master_v',
  shortTitle: 'vdub_Trend_Master_v',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;
/** A number used as a condition: na and 0 are false */
const truthy = (v: number) => !isNaN(v) && v !== 0;
const arr = (s: Series) => s.toArray().map((v) => v ?? NaN);

/**
 * security(tickerid, tf, ...) on the chart symbol: the bars of timeframe `tf` built from the chart bars, and the
 * function that brings one value per bar of that timeframe back to the chart bars. Version 1 rule: every chart bar
 * of a period shows the value of the bar of the timeframe that holds it (no gaps).
 */
function timeframeBars(bars: Bar[], tf: string, context?: ChartContext): { htf: Bar[]; toChart: (values: number[]) => number[] } {
  const chart = chartTimeframe(bars, context);
  if (tf.trim() === '' || chart === '' || timeframe.in_seconds(tf) === timeframe.in_seconds(chart)) {
    return { htf: bars, toChart: (values) => values };
  }
  if (timeframe.in_seconds(tf) < timeframe.in_seconds(chart)) {
    throw new Error(`vdub_Trend_Master_v: the timeframe "${tf}" is lower than the chart timeframe "${chart}": the chart bars do not have that data`);
  }
  const exchange = securityBars(bars, tf, context);
  const { bars: htf, group } = exchange ? { bars: exchange.htf, group: exchange.group } : resample(bars, periodStarts(bars, tf));
  return { htf, toChart: (values) => mapToChart(values, group, [], true, false) };
}

export function calculate(bars: Bar[], inputs: Partial<VdubTrendMasterInputs> = {}, chart?: ChartContext): IndicatorResult {
  return fullResult(createRun(inputs, chart).update(bars));
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VdubTrendMasterInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
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

/**
 * One timeframe of security() bar by bar: 'chart' (each chart bar is a bar of the timeframe), 'utc' (the periods of
 * the UTC rule of `periodStarts`, grouped as `resample` does). The high / low of the current bar of the timeframe so
 * far and those of the previous one.
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
  /** Period start of the bar before (in the unit of the bar times) */
  out: number;
  /** First chart bar of the current period, number of periods so far */
  first: number;
  groups: number;
  hi: number;
  lo: number;
  prevHi: number;
  prevLo: number;
}

function tfState(mode: TfState['mode'], tf: string): TfState {
  const info = mode === 'utc' ? timeframe.info(tf) : null;
  return {
    mode, info, len: info?.isintraday ? timeframe.in_seconds(tf) * 1000 : 0,
    prevDay: NaN, sessionStart: NaN, prevKey: NaN, start: NaN, tradingYear: NaN, tradingDays: -1, prevTradingDay: NaN,
    out: NaN, first: 0, groups: 0, hi: NaN, lo: NaN, prevHi: NaN, prevLo: NaN,
  };
}

/** True when chart bar `i` opens a new period of the timeframe (periodStarts / resample, one bar at a time) */
function opensPeriod(st: TfState, i: number, t: number, everyDay: boolean, ms: boolean): boolean {
  if (st.mode === 'chart') return true;
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
  const out = ms ? st.start : Math.floor(st.start / 1000);
  // resample: a new bar of the timeframe when the period start differs from the bar before's
  const opens = i === 0 || out !== st.out;
  st.out = out;
  return opens;
}

/** The high / low of the bar of the timeframe after chart bar `i` (resample: highest high, lowest low) */
function addBar(st: TfState, i: number, opens: boolean, b: Bar): void {
  if (opens) {
    if (i > 0) {
      st.prevHi = st.hi;
      st.prevLo = st.lo;
    }
    st.first = i;
    st.groups++;
    st.hi = b.high;
    st.lo = b.low;
  } else {
    st.hi = Math.max(st.hi, b.high);
    st.lo = Math.min(st.lo, b.low);
  }
}

/** `b` (newer) replaces `a` as the extreme: the rule of ta.highest / ta.lowest (newest of equal values, zero sign) */
function replaces(a: number, b: number, lowest: boolean): boolean {
  if (lowest) return a > b || (a === b && !(Object.is(a, -0) && Object.is(b, 0)));
  return a < b || (a === b && !(Object.is(a, 0) && Object.is(b, -0)));
}

/**
 * ta.highest / ta.lowest(x, len) on bar `g` of the timeframe: the extreme of the last `len` non-na values among the
 * non-na values of the completed bars (`done`) and the value of the current bar; na before bar len - 1
 */
function windowExtreme(done: readonly number[], cur: number, g: number, len: number, lowest: boolean): number {
  if (g < len - 1) return NaN;
  const own = Number.isFinite(cur);
  const from = Math.max(0, done.length - (own ? len - 1 : len));
  let best = NaN;
  for (let k = from; k < done.length; k++) {
    const v = done[k]!;
    if (Number.isNaN(best) || replaces(best, v, lowest)) best = v;
  }
  if (own && (Number.isNaN(best) || replaces(best, cur, lowest))) best = cur;
  return best;
}

type Point = { time: number; value: number; color?: string };
type Ma = Committable & { step(v: number): number };

interface VtmVars {
  ext: TfState | null;
  daily: TfState | null;
  weekly: TfState | null;
  monthly: TfState | null;
  /** TEH / TEL of the current bar of ExtremeTimeFrame so far, and of the bar before it (final) */
  tehCur: number;
  telCur: number;
  tehLast: number;
  telLast: number;
}

interface PrevLevels {
  high: number[];
  low: number[];
}

interface VtmRun extends BarRunState<VtmVars> {
  ma2: WindowSma;
  donch: WindowExtreme[];
  mmas: Ma[];
  ma100: Ma;
  fast: Ma;
  slow: Ma;
  hLeftLow: WindowExtreme;
  hLeftHigh: WindowExtreme;
  fullLow: WindowExtreme;
  fullHigh: WindowExtreme;
  /** Values of the whole bar set (exchange calendar): TEH, TEL, previous D / W / M high and low */
  pre: { teh: number[]; tel: number[]; daily: PrevLevels; weekly: PrevLevels; monthly: PrevLevels } | null;
  lead1: number[];
  lead2: number[];
  mmaVals: number[][];
  fastVals: number[];
  slowVals: number[];
  plots: Point[][];
  markers: MarkerData[];
  /** Non-na high / low of the completed bars of ExtremeTimeFrame */
  extHighs: number[];
  extLows: number[];
}

function study(inputs: Partial<VdubTrendMasterInputs>): BarStudy<VtmRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const extLen = Math.trunc(cfg.extremeTimeWindow);
  const disp = cfg.displacement;
  /** plot(..., offset = displacement): bar i writes the point of bar i - displacement, the last ones in result */
  const shifted = Number.isInteger(disp) && disp >= 0;
  const back = cfg.hRight + 1;
  let interval = 0;
  let inMs = false;
  let everyDay = false;
  const ma = (len: number, exp: boolean): Ma => (exp ? taStep.ema(len) : new WindowSma(len));
  return {
    // the bar interval (future times of the Lead plots), the chart timeframe from the bar gaps, the time unit of the
    // first bar and the weekend bars of the set (the start of the UTC days of the periods)
    key: (bars, chart) =>
      `${barInterval(bars)}|${chartTimeframe(bars, chart)}|${bars.length > 0 && bars[0].time >= 1e12}|${hasWeekendBars(bars)}`,
    // with the exchange calendar the bars of the other timeframes come from the calendar of the whole bar set
    fullRunReason: (chart) => (hasCalendar(chart) ? 'exchange calendar periods' : null),
    init(bars, chart) {
      interval = barInterval(bars);
      inMs = bars.length > 0 && bars[0].time >= 1e12;
      everyDay = hasWeekendBars(bars);
      const chartTf = chartTimeframe(bars, chart);
      /** The mode of a timeframe (the checks of timeframeBars, the same errors) */
      const modeOf = (tf: string): TfState['mode'] => {
        if (tf.trim() === '' || chartTf === '' || timeframe.in_seconds(tf) === timeframe.in_seconds(chartTf)) return 'chart';
        if (timeframe.in_seconds(tf) < timeframe.in_seconds(chartTf)) {
          throw new Error(`vdub_Trend_Master_v: the timeframe "${tf}" is lower than the chart timeframe "${chartTf}": the chart bars do not have that data`);
        }
        // the checks of periodStarts (a tick timeframe)
        periodStarts([], tf);
        return 'utc';
      };
      // the machines in the order of the ta calls of the original (the same runtime error first)
      const ma2 = new WindowSma(cfg.m2P);
      const donch = [cfg.conversionPeriods, cfg.basePeriods, cfg.laggingSpan2Periods].flatMap((len) => [
        new WindowExtreme(true, len), new WindowExtreme(false, len),
      ]);
      let pre: VtmRun['pre'] = null;
      let ext: TfState | null = null;
      let daily: TfState | null = null;
      let weekly: TfState | null = null;
      let monthly: TfState | null = null;
      const anyDaily = cfg.disDaily || cfg.disWeekly || cfg.disMonthly;
      if (hasCalendar(chart)) {
        // Extremes of the timeframe ExtremeTimeFrame: highest(window) / lowest(window) on its bars
        const e = timeframeBars(bars, cfg.extremeTimeFrame, chart);
        const teh = e.toChart(arr(ta.highest(new Series(e.htf, (b) => b.high), cfg.extremeTimeWindow)));
        const tel = e.toChart(arr(ta.lowest(new Series(e.htf, (b) => b.low), cfg.extremeTimeWindow)));
        // security(tickerid, 'D' / 'W' / 'M', high[1]) and low[1]: computed only when a plot reads them
        const previous = (tf: string): PrevLevels => {
          const { htf, toChart } = timeframeBars(bars, tf, chart);
          return {
            high: toChart(htf.map((_b, g) => (g > 0 ? htf[g - 1].high : NaN))),
            low: toChart(htf.map((_b, g) => (g > 0 ? htf[g - 1].low : NaN))),
          };
        };
        const n = bars.length;
        const none = { high: new Array<number>(n).fill(NaN), low: new Array<number>(n).fill(NaN) };
        pre = {
          teh, tel,
          daily: anyDaily ? previous('D') : none,
          weekly: cfg.disWeekly ? previous('W') : none,
          monthly: cfg.disMonthly ? previous('M') : none,
        };
      } else {
        ext = tfState(modeOf(cfg.extremeTimeFrame), cfg.extremeTimeFrame);
        // the length checks of ta.highest / ta.lowest on the bars of the timeframe
        taCore.highest([], cfg.extremeTimeWindow);
        taCore.lowest([], cfg.extremeTimeWindow);
        daily = anyDaily ? tfState(modeOf('D'), 'D') : null;
        weekly = cfg.disWeekly ? tfState(modeOf('W'), 'W') : null;
        monthly = cfg.disMonthly ? tfState(modeOf('M'), 'M') : null;
      }
      const mmas = MMA_LENGTHS.map((len) => ma(len, cfg.exponential));
      const ma100 = ma(100, cfg.exponential);
      const fast = ma(cfg.fastLen, cfg.exponential_1);
      const slow = ma(cfg.slowLen, cfg.exponential_1);
      const hLeftLow = new WindowExtreme(true, cfg.hLeft);
      const hLeftHigh = new WindowExtreme(false, cfg.hLeft);
      const zone = cfg.hLeft + cfg.hRight + 1;
      const fullLow = new WindowExtreme(true, zone);
      const fullHigh = new WindowExtreme(false, zone);
      const s: VtmRun = {
        ma2, donch, mmas, ma100, fast, slow, hLeftLow, hLeftHigh, fullLow, fullHigh, pre,
        lead1: [], lead2: [], mmaVals: MMA_LENGTHS.map(() => []), fastVals: [], slowVals: [],
        plots: Array.from({ length: 33 }, () => []), markers: [], extHighs: [], extLows: [],
        steps: [ma2, ...donch, ...mmas, ma100, fast, slow, hLeftLow, hLeftHigh, fullLow, fullHigh],
        vars: { ext, daily, weekly, monthly, tehCur: NaN, telCur: NaN, tehLast: NaN, telLast: NaN },
        lists: [], series: [],
      };
      s.lists = [s.markers, s.extHighs, s.extLows];
      s.series = [s.lead1, s.lead2, ...s.mmaVals, s.fastVals, s.slowVals, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const v = s.vars;
      const P = s.plots;

      // MA2
      P[0][i] = { time, value: s.ma2.step(b.close) };

      // Ichimoku: donchian(len) = avg(lowest(len), highest(len))
      const d = s.donch;
      const conversionLine = (d[0].step(b.low) + d[1].step(b.high)) / 2;
      const baseLine = (d[2].step(b.low) + d[3].step(b.high)) / 2;
      const leadLine2 = (d[4].step(b.low) + d[5].step(b.high)) / 2;
      s.lead1[i] = (conversionLine + baseLine) / 2;
      s.lead2[i] = leadLine2;
      if (shifted) {
        if (i - disp >= 0) {
          P[1][i - disp] = { time, value: s.lead1[i - disp] };
          P[2][i - disp] = { time, value: s.lead2[i - disp] };
        }
      } else {
        // a negative or fractional offset: the time of an earlier bar (na for a fractional index)
        P[1][i] = { time: barTime(bars, i + disp, interval), value: s.lead1[i] };
        P[2][i] = { time: barTime(bars, i + disp, interval), value: s.lead2[i] };
      }

      // Extremes of ExtremeTimeFrame, the previous D / W / M high and low
      const t = inMs ? time : time * 1000;
      let dHigh: number;
      let dLow: number;
      let wHigh: number;
      let wLow: number;
      let mHigh: number;
      let mLow: number;
      if (s.pre) {
        const { teh, tel } = s.pre;
        // color = TEH != TEH[1] ? na : red (na on the bar after a change only; an na TEH[1] compares false)
        P[3][i] = { time, value: teh[i], color: i > 0 && ne(teh[i], teh[i - 1]) ? 'transparent' : RED };
        P[4][i] = { time, value: tel[i], color: i > 0 && ne(tel[i], tel[i - 1]) ? 'transparent' : GREEN };
        dHigh = s.pre.daily.high[i];
        dLow = s.pre.daily.low[i];
        wHigh = s.pre.weekly.high[i];
        wLow = s.pre.weekly.low[i];
        mHigh = s.pre.monthly.high[i];
        mLow = s.pre.monthly.low[i];
      } else {
        // changed in place: copyVars copies them at the end of the last confirmed bar
        const ext = v.ext!;
        const opens = opensPeriod(ext, i, t, everyDay, inMs);
        if (opens && i > 0) {
          // the bar of the timeframe before is complete: its chart bars show its values (lookahead, no gaps)
          const teh = v.tehCur;
          const tel = v.telCur;
          for (let j = ext.first; j < i; j++) {
            const first = j === ext.first;
            P[3][j] = { time: bars[j].time, value: teh, color: first && j > 0 && ne(teh, v.tehLast) ? 'transparent' : RED };
            P[4][j] = { time: bars[j].time, value: tel, color: first && j > 0 && ne(tel, v.telLast) ? 'transparent' : GREEN };
          }
          v.tehLast = teh;
          v.telLast = tel;
          if (Number.isFinite(ext.hi)) s.extHighs.push(ext.hi);
          if (Number.isFinite(ext.lo)) s.extLows.push(ext.lo);
        }
        addBar(ext, i, opens, b);
        // the values of the current bar of the timeframe are written when it is complete (or in result for the last)
        v.tehCur = windowExtreme(s.extHighs, ext.hi, ext.groups - 1, extLen, false);
        v.telCur = windowExtreme(s.extLows, ext.lo, ext.groups - 1, extLen, true);
        const prevOf = (st: TfState | null): [number, number] => {
          if (!st) return [NaN, NaN];
          addBar(st, i, opensPeriod(st, i, t, everyDay, inMs), b);
          return [st.prevHi, st.prevLo];
        };
        [dHigh, dLow] = prevOf(v.daily);
        [wHigh, wLow] = prevOf(v.weekly);
        [mHigh, mLow] = prevOf(v.monthly);
      }
      // plot(disDaily and dHigh ? dHigh : na); the weekly / monthly plots draw dHigh / dLow (as the original)
      const shown = (on: boolean, cond: number, value: number) => (on && truthy(cond) ? value : NaN);
      P[5][i] = { time, value: shown(cfg.disDaily, dHigh, dHigh) };
      P[6][i] = { time, value: shown(cfg.disDaily, dLow, dLow) };
      P[7][i] = { time, value: shown(cfg.disWeekly, wHigh, dHigh) };
      P[8][i] = { time, value: shown(cfg.disWeekly, wLow, dLow) };
      P[9][i] = { time, value: shown(cfg.disMonthly, mHigh, dHigh) };
      P[10][i] = { time, value: shown(cfg.disMonthly, mLow, dLow) };

      // Madrid ribbon: maColor(ma, maRef): the slope of `ma`, and ma05 against maRef; leadMAColor is maColor(ma05, ma100)
      const vals = s.mmaVals;
      for (let k = 0; k < s.mmas.length; k++) vals[k][i] = s.mmas[k].step(b.close);
      const ma05 = vals[0][i];
      const ma100 = s.ma100.step(b.close);
      const above = gt(ma05, ma100);
      const below = lt(ma05, ma100);
      for (let k = 0; k < s.mmas.length; k++) {
        const m = vals[k];
        const ch = i > 0 ? m[i] - m[i - 1] : NaN;
        let col = GRAY;
        if (ge(ch, 0) && above) col = GRAY;
        else if (lt(ch, 0) && above) col = RED;
        else if (le(ch, 0) && below) col = RED;
        else if (ge(ch, 0) && below) col = SILVER;
        P[11 + k][i] = { time, value: m[i], color: col };
      }

      // Madrid profit area
      const fastMA = s.fast.step(b.close);
      const slowMA = s.slow.step(b.close);
      s.fastVals[i] = fastMA;
      s.slowVals[i] = slowMA;
      P[29][i] = { time, value: fastMA, color: i > 0 && gt(fastMA - s.fastVals[i - 1], 0) ? SILVER : RED };
      P[30][i] = { time, value: slowMA, color: i > 0 && gt(slowMA - s.slowVals[i - 1], 0) ? SILVER : RED };

      // Jurij channel and PTZ
      const hLeftLow = s.hLeftLow.step(b.low);
      const hLeftHigh = s.hLeftHigh.step(b.high);
      const fullLow = s.fullLow.step(b.low);
      const fullHigh = s.fullHigh.step(b.high);
      P[31][i] = { time, value: cfg.showChannel ? hLeftLow : 0 };
      P[32][i] = { time, value: cfg.showChannel ? hLeftHigh : 0 };

      // plotchar(central_bar_is_highest ? -1 : 0, offset = -h_right - 1, color = red, text = "Sell") and the "Buy" one
      // (location belowbar): a value of 0 draws nothing
      const j = i - back;
      if (j >= 0) {
        if (ge(bars[j].high, fullHigh)) {
          s.markers.push({ time: bars[j].time, position: 'aboveBar', shape: 'circle', char: '★', color: RED, text: 'Sell' });
        }
        if (le(bars[j].low, fullLow)) {
          s.markers.push({ time: bars[j].time, position: 'belowBar', shape: 'circle', char: '★', color: GREEN, text: 'Buy' });
        }
      }
    },
    copyVars: (v) => {
      const copy = (st: TfState | null) => (st ? { ...st } : null);
      return { ...v, ext: copy(v.ext), daily: copy(v.daily), weekly: copy(v.weekly), monthly: copy(v.monthly) };
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      if (shifted) {
        // the Lead points of the last bars: on future bars
        for (let i = Math.max(0, n - disp); i < n; i++) {
          plots.plot1[i] = { time: barTime(bars, i + disp, interval), value: s.lead1[i] };
          plots.plot2[i] = { time: barTime(bars, i + disp, interval), value: s.lead2[i] };
        }
      }
      const v = s.vars;
      const ext = v.ext;
      if (ext && n > 0) {
        // the last bar of ExtremeTimeFrame is still open: its chart bars show its values so far
        for (let j = ext.first; j < n; j++) {
          const first = j === ext.first;
          plots.plot3[j] = { time: bars[j].time, value: v.tehCur, color: first && j > 0 && ne(v.tehCur, v.tehLast) ? 'transparent' : RED };
          plots.plot4[j] = { time: bars[j].time, value: v.telCur, color: first && j > 0 && ne(v.telCur, v.telLast) ? 'transparent' : GREEN };
        }
      }
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        markers: s.markers.slice(),
        fills: [
          // fill(p1, p2, color = black, transp = 90)
          { plot1: 'plot1', plot2: 'plot2', options: { color: String(color.new('#000000', 90)) } },
          // fill(p5, p6, color = silver, transp = 75)
          { plot1: 'plot29', plot2: 'plot30', options: { color: String(color.new('#C0C0C0', 75)) } },
        ],
      };
    },
  };
}

export const VdubTrendMasterV = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
