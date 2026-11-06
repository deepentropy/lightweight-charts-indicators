/**
 * VDUB_BINARY_PRO_3_V2
 *
 * Several tools on the price pane:
 * - a WMA of the close with bands at 2 and 3 times the WMA of the true range, with fills;
 * - a centre band: the SMA of the highs, the SMA of the lows and their middle;
 * - a base line: SMA(close, 3) and SMA(close, 13), with a circle where they cross;
 * - a large and a small channel: the high and the low of the bars of two other timeframes of the same symbol
 *   (drawn while they do not change), with triangles on the bars that reach the large channel;
 * - a zigzag: the lowest low / highest high on the bars where the RMA of hl2 turns up / down, and an optional
 *   second zigzag on the bars that reach the large channel.
 *
 * Other timeframes: the bars of the two channel timeframes are built from the chart bars (periods from the UTC
 * calendar and the bars, see src/anchor-period.ts). As in the original (a version 1 script), every chart bar of a
 * period shows the value of that period at its end (on past bars the value of a period is known from its first
 * bar; the last period is still open). A channel timeframe below the chart timeframe needs data that the bars do
 * not carry: the port throws an Error. With the default timeframes ("30" and "240") the chart must be 30 minutes
 * or lower.
 *
 * Periods and the chart context (optional third argument of calculate): with the exchange time zone and the session
 * of the symbol (`timezone`, `session`) the periods are those of the exchange calendar (its trading days, holidays
 * and session hours), and a bar of a higher timeframe is complete on the chart bar whose close reaches the end of
 * its period, see src/anchor-period.ts.
 * Without them the port uses the UTC calendar and the bars, as described in this header. `timeframe`, when given,
 * is the chart timeframe; without it the chart timeframe is read from the bar spacing.
 *
 * Reference: "VDUB_BINARY_PRO_3_V2" by vdubus
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, taCore, taStep, Series, color, timeframe, resample, mapToChart, type IndicatorResult, type InputConfig, type PlotConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import { periodStarts, chartTimeframe, securityBars, hasCalendar } from '../anchor-period';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VdubBinaryPro3V2Inputs {
  /** WMA length of the close */
  length: number;
  /** WMA length of the true range */
  atrlen: number;
  /** Not used by the original */
  nlookback: number;
  /** Not used by the original */
  scale: number;
  /** Not used by the original */
  nATR: number;
  /** SMA length of the centre band */
  periods: number;
  /** Show the centre band */
  pc: boolean;
  /** Timeframe of the large channel ("30", "240", "D", "W", "M", ...) */
  lrgChannelTf: string;
  /** Number of bars (of the large channel timeframe) of the channel high / low */
  range2: number;
  /** Timeframe of the small channel */
  smlChannelTf: string;
  zigzagLength: number;
  /** Show the second zigzag */
  zigzag2: boolean;
}

export const defaultInputs: VdubBinaryPro3V2Inputs = {
  length: 56,
  atrlen: 100,
  nlookback: 20,
  scale: 1,
  nATR: 14,
  periods: 21,
  pc: true,
  lrgChannelTf: '30',
  range2: 1,
  smlChannelTf: '240',
  zigzagLength: 7,
  zigzag2: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'WMA Length', defval: 56, min: 1 },
  { id: 'atrlen', type: 'int', title: 'ATR Length', defval: 100, min: 1 },
  { id: 'nlookback', type: 'int', title: 'Number of Lookback', defval: 20, min: 1 },
  { id: 'scale', type: 'int', title: 'scale of ATR', defval: 1 },
  { id: 'nATR', type: 'int', title: 'ATR Parameter', defval: 14 },
  { id: 'periods', type: 'int', title: 'MA Period', defval: 21, min: 1 },
  { id: 'pc', type: 'bool', title: 'MA BAND', defval: true },
  { id: 'lrgChannelTf', type: 'string', title: 'LRG_Channel_TF_mins_D_W_M', defval: '30' },
  { id: 'range2', type: 'int', title: 'Range2', defval: 1 },
  { id: 'smlChannelTf', type: 'string', title: 'SML_Channel_TF_mins_D_W_M', defval: '240' },
  { id: 'zigzagLength', type: 'int', title: 'Zingzag_length', defval: 7 },
  { id: 'zigzag2', type: 'bool', title: 'Zigzag2', defval: false },
];

// Colour constants of Pine version 1, with the default plot transparency of that version (35)
const V1 = (hex: string) => String(color.new(hex, 35));
const RED_HEX = '#FF0000';
const GRAY_HEX = '#808080';
const WHITE = V1('#FFFFFF');
const RED = V1(RED_HEX);
const BLACK = V1('#000000');
const GREEN = V1('#008000');
const FUCHSIA = V1('#FF00FF');

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Band 1', color: WHITE, lineWidth: 1 },
  { id: 'plot1', title: 'Upper Band 2', color: WHITE, lineWidth: 1 },
  { id: 'plot2', title: 'Lower Band 1', color: WHITE, lineWidth: 1 },
  { id: 'plot3', title: 'Lower Band 2', color: WHITE, lineWidth: 1 },
  { id: 'plot4', title: 'Centre', color: RED, lineWidth: 4 },
  { id: 'plot5', title: 'Swing High Plot', color: BLACK, lineWidth: 1 },
  { id: 'plot6', title: 'Swing Low Plot', color: BLACK, lineWidth: 1 },
  { id: 'plot7', title: 'Short MA', color: RED, lineWidth: 2 },
  { id: 'plot8', title: 'Long MA', color: V1('#000080'), lineWidth: 4 },
  { id: 'plot9', title: 'MA Cross', color: V1('#0000FF'), lineWidth: 9, style: 'circles' },
  { id: 'plot10', title: 'Large Channel High', color: RED, lineWidth: 2 },
  { id: 'plot11', title: 'Large Channel Low', color: GREEN, lineWidth: 2 },
  { id: 'plot12', title: 'Small Channel High', color: FUCHSIA, lineWidth: 2 },
  { id: 'plot13', title: 'Small Channel Low', color: FUCHSIA, lineWidth: 2 },
  { id: 'plot14', title: 'Zigzag', color: BLACK, lineWidth: 1 },
  { id: 'plot15', title: 'Zigzag 2', color: RED, lineWidth: 3 },
];

// The last fill has transp = 100 in the original: it is not visible
export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot1', plot2: 'plot0', color: String(color.new('#30628E', 80)), title: 'Plots Background' },
  { id: 'fill1', plot1: 'plot3', plot2: 'plot2', color: String(color.new('#30628E', 80)), title: 'Plots Background' },
  { id: 'fill2', plot1: 'plot2', plot2: 'plot0', color: String(color.new('#128E89', 80)), title: 'Plots Background' },
  { id: 'fill3', plot1: 'plot10', plot2: 'plot11', color: String(color.new('#E3CAF1', 100)), title: 'Plots Background' },
];

export const metadata = {
  title: 'VDUB_BINARY_PRO_3_V2',
  shortTitle: 'VDUB_BINARY_PRO_3_V2',
  overlay: true,
};

/** Pine float comparisons: a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
/** a != b: false when one side is na */
const ne = (a: number, b: number) => Math.abs(a - b) > EPS;
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
  // With the exchange calendar of the chart context (time zone and session): the periods and the bars that
  // complete them come from the library rule (see anchor-period.ts)
  const exchange = securityBars(bars, tf, context);
  if (exchange) {
    return { htf: exchange.htf, toChart: (values) => mapToChart(values, exchange.group, exchange.latest, true, false) };
  }
  // Without it: the periods of the UTC calendar rule (see anchor-period.ts), grouped by the library
  const { bars: htf, group } = resample(bars, periodStarts(bars, tf));
  // lookahead on: the latest completed period is not read
  return { htf, toChart: (values) => mapToChart(values, group, group, true, false) };
}

type Point = { time: number; value: number; color?: string };

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] };

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
 * One channel timeframe bar by bar: 'chart' (each chart bar is a bar of the timeframe), 'utc' (the periods of the
 * UTC rule of `periodStarts`, grouped as `resample` does), with the high / low of its current bar so far.
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
}

function tfState(mode: TfState['mode'], tf: string): TfState {
  const info = mode === 'utc' ? timeframe.info(tf) : null;
  return {
    mode, info, len: info?.isintraday ? timeframe.in_seconds(tf) * 1000 : 0,
    prevDay: NaN, sessionStart: NaN, prevKey: NaN, start: NaN, tradingYear: NaN, tradingDays: -1, prevTradingDay: NaN,
    out: NaN, first: 0, groups: 0, hi: NaN, lo: NaN,
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

interface VbpVars {
  large: TfState | null;
  small: TfState | null;
  /** sell / buy of the current bar of the large channel so far, and of the bar before it (final) */
  sellCur: number;
  buyCur: number;
  sellLast: number;
  buyLast: number;
  /** high / low of the bar of the small channel before the current one */
  mHighLast: number;
  mLowLast: number;
  /** isRising[1] (na on the first bar: false in a condition) */
  prevRising: boolean;
}

interface VbpRun extends BarRunState<VbpVars> {
  ma: ReturnType<typeof taStep.wma>;
  tr: ReturnType<typeof taStep.tr>;
  rangema: ReturnType<typeof taStep.wma>;
  smaHigh: WindowSma;
  smaLow: WindowSma;
  short: WindowSma;
  long: WindowSma;
  cross: ReturnType<typeof taStep.cross>;
  rma: ReturnType<typeof taStep.rma>;
  lowest: WindowExtreme;
  highest: WindowExtreme;
  /** Values of the whole bar set (exchange calendar): sell, buy, small channel high and low */
  pre: { sell: number[]; buy: number[]; mHigh: number[]; mLow: number[] } | null;
  hls: number[];
  plots: Point[][];
  bgColors: BgColorData[];
  markers: MarkerData[];
  /** Non-na high / low of the completed bars of the large channel timeframe */
  largeHighs: number[];
  largeLows: number[];
}

function study(inputs: Partial<VdubBinaryPro3V2Inputs>): BarStudy<VbpRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const range2 = Math.trunc(cfg.range2);
  // bgcolor(OutputSignal > 0 ? red : gray, transp = 100): not visible
  const bgRed = String(color.new(RED_HEX, 100));
  const bgGray = String(color.new(GRAY_HEX, 100));
  const maroon = V1('#800000');
  let inMs = false;
  let everyDay = false;
  const pt = (time: number, value: number, colour?: string): Point =>
    (colour === undefined ? { time, value } : { time, value, color: colour });

  /** The outputs of chart bar j that read the large channel (sell / buy of its period: lookahead) */
  function largeOutputs(plots: Point[][], markers: MarkerData[], bars: Bar[], j: number, sell: number, buy: number, first: boolean, sellLast: number, buyLast: number): void {
    const b = bars[j];
    const time = b.time;
    // color = sell != sell[1] ? na : red (the bars after the first of a period have the same value)
    plots[10][j] = pt(time, sell, first && ne(sell, sellLast) ? 'transparent' : RED);
    plots[11][j] = pt(time, buy, first && ne(buy, buyLast) ? 'transparent' : GREEN);
    const hcon = ge(b.high, sell);
    const lcon = le(b.low, buy);
    if (hcon) markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: maroon });
    if (lcon) markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: GREEN });
    plots[15][j] = pt(time, !cfg.zigzag2 ? NaN : hcon ? b.high : lcon ? b.low : NaN);
  }

  /** The small channel points of chart bar j (the high / low of its period: lookahead) */
  function smallOutputs(plots: Point[][], bars: Bar[], j: number, mHigh: number, mLow: number, first: boolean, mHighLast: number, mLowLast: number): void {
    const time = bars[j].time;
    plots[12][j] = pt(time, mHigh, first && ne(mHigh, mHighLast) ? 'transparent' : FUCHSIA);
    plots[13][j] = pt(time, mLow, first && ne(mLow, mLowLast) ? 'transparent' : FUCHSIA);
  }

  return {
    // the chart timeframe from the bar gaps, the time unit of the first bar and the weekend bars of the set (the
    // start of the UTC days of the periods)
    key: (bars, chart) => `${chartTimeframe(bars, chart)}|${bars.length > 0 && bars[0].time >= 1e12}|${hasWeekendBars(bars)}`,
    // with the exchange calendar the bars of the channel timeframes come from the calendar of the whole bar set
    fullRunReason: (chart) => (hasCalendar(chart) ? 'exchange calendar periods' : null),
    init(bars, chart) {
      inMs = bars.length > 0 && bars[0].time >= 1e12;
      everyDay = hasWeekendBars(bars);
      const chartTf = chartTimeframe(bars, chart);
      /** The mode of a timeframe (the checks of timeframeBars, the same errors) */
      const modeOf = (tf: string): TfState['mode'] => {
        if (tf.trim() === '' || chartTf === '' || timeframe.in_seconds(tf) === timeframe.in_seconds(chartTf)) return 'chart';
        if (timeframe.in_seconds(tf) < timeframe.in_seconds(chartTf)) {
          throw new Error(`The timeframe "${tf}" is lower than the chart timeframe "${chartTf}": the bars do not carry that data.`);
        }
        // the checks of periodStarts (a tick timeframe)
        periodStarts([], tf);
        return 'utc';
      };
      // the machines in the order of the ta calls of the original (the same runtime error first)
      taCore.wma([], cfg.length);
      taCore.wma([], cfg.atrlen);
      const smaHigh = new WindowSma(cfg.periods);
      const smaLow = new WindowSma(cfg.periods);
      const short = new WindowSma(3);
      const long = new WindowSma(13);
      let pre: VbpRun['pre'] = null;
      let large: TfState | null = null;
      let small: TfState | null = null;
      if (hasCalendar(chart)) {
        const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
        // Large channel: security(tickerid, tf, highest(Range2)) / lowest(Range2)
        const lg = timeframeBars(bars, cfg.lrgChannelTf, chart);
        const largeHigh = Series.fromArray(lg.htf, lg.htf.map((b) => b.high));
        const largeLow = Series.fromArray(lg.htf, lg.htf.map((b) => b.low));
        const sell = lg.toChart(A(ta.highest(largeHigh, cfg.range2)));
        const buy = lg.toChart(A(ta.lowest(largeLow, cfg.range2)));
        // Small channel: security(tickerid, tf, high) / low
        const sm = timeframeBars(bars, cfg.smlChannelTf, chart);
        pre = { sell, buy, mHigh: sm.toChart(sm.htf.map((b) => b.high)), mLow: sm.toChart(sm.htf.map((b) => b.low)) };
      } else {
        large = tfState(modeOf(cfg.lrgChannelTf), cfg.lrgChannelTf);
        // the length checks of ta.highest / ta.lowest on the bars of the timeframe
        taCore.highest([], cfg.range2);
        taCore.lowest([], cfg.range2);
        small = tfState(modeOf(cfg.smlChannelTf), cfg.smlChannelTf);
      }
      const rma = taStep.rma(cfg.zigzagLength);
      const lowest = new WindowExtreme(true, cfg.zigzagLength);
      const highest = new WindowExtreme(false, cfg.zigzagLength);
      const ma = taStep.wma();
      const tr = taStep.tr(false);
      const rangema = taStep.wma();
      const cross = taStep.cross();
      const s: VbpRun = {
        ma, tr, rangema, smaHigh, smaLow, short, long, cross, rma, lowest, highest, pre,
        hls: [], plots: Array.from({ length: 16 }, () => []), bgColors: [], markers: [], largeHighs: [], largeLows: [],
        steps: [ma, tr, rangema, smaHigh, smaLow, short, long, cross, rma, lowest, highest],
        vars: {
          large, small, sellCur: NaN, buyCur: NaN, sellLast: NaN, buyLast: NaN, mHighLast: NaN, mLowLast: NaN,
          prevRising: false,
        },
        lists: [], series: [],
      };
      s.lists = [s.bgColors, s.markers, s.largeHighs, s.largeLows];
      s.series = [s.hls, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const v = s.vars;
      const P = s.plots;

      // Bands: ma = wma(close, length), rangema = wma(tr, atrlen)
      const ma = s.ma.step(b.close, cfg.length);
      const rangema = s.rangema.step(s.tr.step(b.high, b.low, b.close), cfg.atrlen);
      P[0][i] = pt(time, ma + rangema * 2);
      P[1][i] = pt(time, ma + rangema * 3);
      P[2][i] = pt(time, ma - rangema * 2);
      P[3][i] = pt(time, ma - rangema * 3);

      // Centre band
      const smaHigh = s.smaHigh.step(b.high);
      const smaLow = s.smaLow.step(b.low);
      const spread = smaHigh - smaLow;
      P[4][i] = pt(time, (smaHigh + 2.5 * spread + (smaLow - 2.5 * spread)) / 2);
      // plot(pc and sma(high, periods) ? sma(high, periods) : na): a value of 0 or na is not drawn
      P[5][i] = pt(time, cfg.pc && truthy(smaHigh) ? smaHigh : NaN);
      P[6][i] = pt(time, cfg.pc && truthy(smaLow) ? smaLow : NaN);

      // Base line
      const short = s.short.step(b.close);
      const long = s.long.step(b.close);
      const crossed = s.cross.step(long, short);
      P[7][i] = pt(time, short);
      P[8][i] = pt(time, long);
      P[9][i] = pt(time, crossed ? long : NaN);
      s.bgColors.push({ time, color: ge(long, short) ? bgRed : bgGray });

      if (s.pre) {
        const { sell, buy, mHigh, mLow } = s.pre;
        const prev = (x: number[]) => (i > 0 ? x[i - 1] : NaN);
        largeOutputs(P, s.markers, bars, i, sell[i], buy[i], true, prev(sell), prev(buy));
        smallOutputs(P, bars, i, mHigh[i], mLow[i], true, prev(mHigh), prev(mLow));
      } else {
        // changed in place: copyVars copies them at the end of the last confirmed bar
        const t = inMs ? time : time * 1000;
        const large = v.large!;
        const opensLarge = opensPeriod(large, i, t, everyDay, inMs);
        if (opensLarge && i > 0) {
          // the bar of the timeframe before is complete: its chart bars show its values (lookahead, no gaps)
          for (let j = large.first; j < i; j++) {
            largeOutputs(P, s.markers, bars, j, v.sellCur, v.buyCur, j === large.first, v.sellLast, v.buyLast);
          }
          v.sellLast = v.sellCur;
          v.buyLast = v.buyCur;
          if (Number.isFinite(large.hi)) s.largeHighs.push(large.hi);
          if (Number.isFinite(large.lo)) s.largeLows.push(large.lo);
        }
        addBar(large, i, opensLarge, b);
        // the values of the current bar of the timeframe are written when it is complete (or in result for the last)
        v.sellCur = windowExtreme(s.largeHighs, large.hi, large.groups - 1, range2, false);
        v.buyCur = windowExtreme(s.largeLows, large.lo, large.groups - 1, range2, true);

        const small = v.small!;
        const opensSmall = opensPeriod(small, i, t, everyDay, inMs);
        if (opensSmall && i > 0) {
          for (let j = small.first; j < i; j++) {
            smallOutputs(P, bars, j, small.hi, small.lo, j === small.first, v.mHighLast, v.mLowLast);
          }
          v.mHighLast = small.hi;
          v.mLowLast = small.lo;
        }
        addBar(small, i, opensSmall, b);
      }

      // Zigzag: isRising = hls >= hls[1]
      const hls = s.rma.step((b.high + b.low) / 2);
      s.hls[i] = hls;
      const lowest = s.lowest.step(b.low);
      const highest = s.highest.step(b.high);
      const isRising = ge(hls, i > 0 ? s.hls[i - 1] : NaN);
      P[14][i] = pt(time, isRising && !v.prevRising ? lowest : !isRising && v.prevRising ? highest : NaN);
      v.prevRising = isRising;
    },
    copyVars: (v) => ({ ...v, large: v.large ? { ...v.large } : null, small: v.small ? { ...v.small } : null }),
    result(s, bars) {
      const n = bars.length;
      const P = s.plots.map((p) => p.slice());
      const markers = s.markers.slice();
      const v = s.vars;
      if (v.large && v.small && n > 0) {
        // the last bars of the channel timeframes are still open: their chart bars show their values so far
        const large = v.large;
        for (let j = large.first; j < n; j++) {
          largeOutputs(P, markers, bars, j, v.sellCur, v.buyCur, j === large.first, v.sellLast, v.buyLast);
        }
        const small = v.small;
        for (let j = small.first; j < n; j++) {
          smallOutputs(P, bars, j, small.hi, small.lo, j === small.first, v.mHighLast, v.mLowLast);
        }
      }
      const plots: Record<string, Point[]> = {};
      P.forEach((p, k) => { plots[`plot${k}`] = p; });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills: fillConfig.map((f) => ({ plot1: f.plot1, plot2: f.plot2, options: { color: f.color, title: f.title } })),
        markers,
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VdubBinaryPro3V2Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<VdubBinaryPro3V2Inputs> = {},
  chart?: ChartContext,
): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const VdubBinaryPro3V2 = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, fillConfig };
