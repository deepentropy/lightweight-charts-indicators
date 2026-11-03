/**
 * Strat Assistant
 *
 * Bar types of "The Strat", each bar against the bar before:
 * - 1 (inside): high <= previous high and low >= previous low; "1" below the bar, yellow bar
 * - 2 up: high above the previous high and low not below the previous low; "2" below and an up arrow above, green bar
 * - 2 down: low below the previous low and high not above the previous high; "2" below and a down arrow above, red bar
 * - 3 (outside): high above the previous high and low below the previous low; "3" below, fuchsia bar
 * On the last bar only (show_last = 1), drawn some bars to the right of it:
 * - actionable signals (2 bars right, bottom): "Shooter" (open and close in the lower part of the range: below
 *   high - range * "Action Wick Percentage"), "Hammer" (open and close above low + range * percentage), "Inside Bar";
 * - full timeframe continuity: for the 15 and 30 minute, hour, 4 hour, day, week, month and quarter bars (only those
 *   at or above the chart timeframe), an up arrow (bar green: open <= close) or a down arrow at the close, with the
 *   timeframe name, and "IN" / "O" above it when that bar is an inside / outside bar of the bar before; one bar to the
 *   right per timeframe;
 * - Strat combos (3 bars right, top): 222 continuations, 212 measured moves, 22 / 212 / 322 / 32 / 312 / 122 / 3
 *   reversals, 2222 "RandyJackson".
 * Dashed lines at the high and the low of the previous day (from the start of that day, extended right; intraday and
 * daily charts), optional lines at the high and low of the previous week (weekly charts too; they start at the start
 * of the previous day, as in the original) and an optional debug label with these values.
 *
 * The other timeframes are those of `request.security` without lookahead: on the bars before the last one (and on a
 * closed last bar) the latest completed bar of the timeframe; on an open last bar, as on a realtime bar, the bar in
 * progress. A timeframe equal to the chart timeframe is the chart series. The bars of a timeframe are built from the chart bars: the first period of the chart bars (and
 * the inside / outside test of the period after it) can differ from bars built from the full history of the symbol. The original also requests the 15, 30, 60 and 240 minute bars on higher charts but does not show
 * them there. The previous week lines and the debug label read the daily bars, which a weekly or monthly chart does
 * not have (lower timeframe): the port throws an Error for them on such charts.
 *
 * Chart values read: the chart timeframe, the exchange time zone and session (periods of the other timeframes and
 * the bar times after the last bar), whether the last bar is closed (bar in progress of the other timeframes).
 *
 * Reference: "Strat Assistant" by rickyzcarroll
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © rickyzcarroll
 */

import {
  str, timeframe, line, label, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type ShapeConfig, type BarColorConfig,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import type { BarColorData, MarkerData } from '../types';
import { chartTimeframe, higherTimeframeBars, timeAfterLastBar } from '../anchor-period';
import { lastBarConfirmedOf, type ChartContext } from '../chart-context';

export interface StratAssistantInputs {
  actionWickPercentage: number;
  isPrevDayHighLineActive: boolean;
  prevDayHighColor: string;
  isPrevDayLowLineActive: boolean;
  prevDayLowColor: string;
  isPrevWeekHighLineActive: boolean;
  prevWeekHighColor: string;
  isPrevWeekLowLineActive: boolean;
  prevWeekLowColor: string;
  isFtcActive: boolean;
  isDebugLabelActive: boolean;
}

export const defaultInputs: StratAssistantInputs = {
  actionWickPercentage: 0.75,
  isPrevDayHighLineActive: true,
  prevDayHighColor: '#00E676',
  isPrevDayLowLineActive: true,
  prevDayLowColor: '#880E4F',
  isPrevWeekHighLineActive: false,
  prevWeekHighColor: '#FF9800',
  isPrevWeekLowLineActive: false,
  prevWeekLowColor: '#9C27B0',
  isFtcActive: true,
  isDebugLabelActive: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'actionWickPercentage', type: 'float', title: 'Action Wick Percentage', defval: 0.75 },
  { id: 'isPrevDayHighLineActive', type: 'bool', title: 'Prev Day High Line Active?', defval: true },
  { id: 'prevDayHighColor', type: 'color', title: 'Prev Day High Line Color', defval: '#00E676' },
  { id: 'isPrevDayLowLineActive', type: 'bool', title: 'Prev Day Low Line Active?', defval: true },
  { id: 'prevDayLowColor', type: 'color', title: 'Prev Day High Line Color', defval: '#880E4F' },
  { id: 'isPrevWeekHighLineActive', type: 'bool', title: 'Prev Week High Lines Active?', defval: false },
  { id: 'prevWeekHighColor', type: 'color', title: 'Prev Week High Line Color', defval: '#FF9800' },
  { id: 'isPrevWeekLowLineActive', type: 'bool', title: 'Prev Week Low Lines Active?', defval: false },
  { id: 'prevWeekLowColor', type: 'color', title: 'Prev Week Low Line Color', defval: '#9C27B0' },
  { id: 'isFtcActive', type: 'bool', title: 'Full Time Frame Continuity Active?', defval: true },
  { id: 'isDebugLabelActive', type: 'bool', title: 'Debug Label (Beta)', defval: false },
];

export const plotConfig: PlotConfig[] = [];

const BULL = '#4CAF50';
const BEAR = '#FF5252';
const OUTSIDE = '#E040FB';
const INSIDE = '#F6BE00';
/** color.black of Pine v4 */
const BLACK = '#363A45';
/** Pine v4 default text colour of a shape with a text and no textcolor (color.blue) */
const PINE_TEXT = '#2196F3';

/** The other timeframes of the full timeframe continuity: request timeframe, offset, text */
const FTC = [
  { name: '15', tf: '15', offset: 2, text: '15' },
  { name: '30', tf: '30', offset: 3, text: '30' },
  { name: 'Hour', tf: '60', offset: 4, text: 'H' },
  { name: 'FourHour', tf: '240', offset: 5, text: '4H' },
  { name: 'Day', tf: 'D', offset: 6, text: 'D' },
  { name: 'Week', tf: 'W', offset: 7, text: 'W' },
  { name: 'Month', tf: 'M', offset: 8, text: 'M' },
  { name: 'Quarter', tf: '3M', offset: 9, text: 'Q' },
] as const;

/** Strat combos: title / text, bullish */
const COMBOS: [string, boolean][] = [
  ['222 Bearish \nContinuation', false], ['222 Bullish \nContinuation', true],
  ['212 Bearish Continuation \nMeasured Move', false], ['212 Bullish Continuation \nMeasured Move', true],
  ['22 Bearish \nReversal', false], ['22 Bullish \nReversal', true],
  ['212 Bearish \nReversal', false], ['212 Bullish \nReversal', true],
  ['322 Bearish \nReversal', false], ['322 Bullish \nReversal', true],
  ['32 Bearish \nReversal', false], ['32 Bullish \nReversal', true],
  ['312 Bearish \nReversal', false], ['312 Bullish \nReversal', true],
  ['122 Bearish RevStrat \nReversal', false], ['122 Bullish RevStrat \nReversal', true],
  ['2222 Bearish \nRandyJackson', false], ['2222 Bullish \nRandyJackson', true],
  ['3 Bearish \nRevStrat Reversal', false], ['3 Bullish \nRevStrat Reversal', true],
];

/** plotshape (shape<k>) and plotchar (char<k>) declarations, in the order of the original */
export const shapeConfig: ShapeConfig[] = [
  { id: 'char0', kind: 'char', title: 'One Bar', char: '1', location: 'belowbar', color: INSIDE },
  { id: 'shape0', kind: 'shape', title: 'Two Up Bar Shape', style: 'arrowup', location: 'abovebar', color: BULL },
  { id: 'char1', kind: 'char', title: 'Two Up Bar', char: '2', location: 'belowbar', color: BULL },
  { id: 'shape1', kind: 'shape', title: 'Two Bar Shape', style: 'arrowdown', location: 'abovebar', color: BEAR },
  { id: 'char2', kind: 'char', title: 'Two Down Bar', char: '2', location: 'belowbar', color: BEAR },
  { id: 'char3', kind: 'char', title: 'Three Bar', char: '3', location: 'belowbar', color: OUTSIDE },
  { id: 'shape2', kind: 'shape', title: 'isShooter Label', style: 'flag', location: 'bottom', color: BEAR, text: 'Shooter', textcolor: BEAR, offset: 2 },
  { id: 'shape3', kind: 'shape', title: 'isHammer Label', style: 'flag', location: 'bottom', color: BULL, text: 'Hammer', textcolor: BULL, offset: 2 },
  { id: 'shape4', kind: 'shape', title: 'isInsideBar Label', style: 'flag', location: 'bottom', color: INSIDE, text: 'Inside Bar', textcolor: INSIDE, offset: 2 },
  ...FTC.flatMap((f, k): ShapeConfig[] => [
    { id: `char${4 + 2 * k}`, kind: 'char', title: `isFtc${f.name}Inside`, char: '', text: 'IN\n', location: 'absolute', color: INSIDE },
    { id: `char${5 + 2 * k}`, kind: 'char', title: `isFtc${f.name}Outside`, char: '', text: 'O\n', location: 'absolute', color: OUTSIDE },
    { id: `shape${5 + 2 * k}`, kind: 'shape', title: `isFtc${f.name}Green`, style: 'arrowup', text: f.text, location: 'absolute', color: BULL },
    { id: `shape${6 + 2 * k}`, kind: 'shape', title: `isFtc${f.name}Red`, style: 'arrowdown', text: f.text, location: 'absolute', color: BEAR },
  ]),
  ...COMBOS.map(([title, bull], k): ShapeConfig => ({
    id: `shape${21 + k}`, kind: 'shape', title, style: 'flag', location: 'top', color: bull ? BULL : BEAR, text: title,
    textcolor: bull ? BULL : BEAR, offset: 3,
  })),
];

export const barColorConfig: BarColorConfig[] = [{ id: 'barcolor0', kind: 'barcolor', title: 'Bar Color' }];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label'];

export const metadata = {
  title: 'Strat Assistant',
  shortTitle: 'Strat Assistant',
  overlay: true,
};

/** Pine float comparisons (within 1e-10; na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;
const ge = (a: number, b: number) => a - b >= -1e-10;
const le = (a: number, b: number) => a - b <= 1e-10;

interface Ohlct { o: number[]; c: number[]; h: number[]; l: number[]; t: number[] }

export function calculate(
  bars: Bar[],
  inputs: Partial<StratAssistantInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const ms = n > 0 && bars[0].time >= 1e12;
  const toMs = (t: number) => (ms ? t : t * 1000);
  const base = {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
  };
  resetDrawings();
  if (n === 0) return { ...base, markers: [], barColors: [] };

  const open = bars.map((b) => b.open);
  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);
  const close = bars.map((b) => b.close);
  const at = (a: number[], i: number) => (i >= 0 && i < a.length ? a[i] : NaN);

  // bar types of bar i - r against bar i - l
  const oneBar = (i: number, r: number, l: number) => le(at(high, i - r), at(high, i - l)) && ge(at(low, i - r), at(low, i - l));
  const twoUp = (i: number, r: number, l: number) => gt(at(high, i - r), at(high, i - l)) && !lt(at(low, i - r), at(low, i - l));
  const twoDown = (i: number, r: number, l: number) => lt(at(low, i - r), at(low, i - l)) && !gt(at(high, i - r), at(high, i - l));
  const threeBar = (i: number, r: number, l: number) => gt(at(high, i - r), at(high, i - l)) && lt(at(low, i - r), at(low, i - l));
  const idxOne = (i: number, k: number) => oneBar(i, k, k + 1);
  const idxUp = (i: number, k: number) => twoUp(i, k, k + 1);
  const idxDown = (i: number, k: number) => twoDown(i, k, k + 1);
  const idxThree = (i: number, k: number) => threeBar(i, k, k + 1);

  // chart timeframe (timeframe.period of Pine v4: "15", "D", "W", "M", ...)
  const chartTf = chartTimeframe(bars, chart);
  const chartSec = chartTf === '' ? 86400 : timeframe.in_seconds(chartTf);
  const unit = chartTf.replace(/^\d+/, '');
  const isIntraday = chartSec < 86400;
  const isDaily = !isIntraday && unit === 'D';
  const isWeekly = unit === 'W';
  const isMonthly = unit === 'M';
  const period = isIntraday && unit === '' ? String(chartSec / 60) : chartTf === '1D' ? 'D' : chartTf === '1W' ? 'W' : chartTf === '1M' ? 'M' : chartTf;
  const isPeriod = (...ps: string[]) => ps.includes(period);

  const is15Valid = isPeriod('1', '3', '5', '10', '15');
  const is30Valid = is15Valid || isPeriod('30');
  const isHourValid = is30Valid || isPeriod('60', '45');
  const isFourHourValid = isHourValid || isIntraday;
  const isDayValid = isFourHourValid || isDaily;
  const isWeekValid = isDayValid || isPeriod('W') || isIntraday;
  const isMonthValid = isWeekValid || isMonthly;
  const isQuarterValid = isWeekValid || isDaily || isWeekly || isMonthly;
  const valid = [is15Valid, is30Valid, isHourValid, isFourHourValid, isDayValid, isWeekValid, isMonthValid, isQuarterValid];
  let ftcTimeFrameOffset = 0;
  if (!isQuarterValid) ftcTimeFrameOffset = 8;
  else if (!isMonthValid) ftcTimeFrameOffset = 7;
  else if (!isWeekValid) ftcTimeFrameOffset = 6;
  else if (!isDayValid) ftcTimeFrameOffset = 5;
  else if (!isFourHourValid) ftcTimeFrameOffset = 4;
  else if (!isHourValid) ftcTimeFrameOffset = 3;
  else if (!is30Valid) ftcTimeFrameOffset = 2;
  else if (!is15Valid) ftcTimeFrameOffset = 1;

  // security(syminfo.tickerid, tf, [open, close, high, low, time]) per chart bar; null for a timeframe below the chart
  const lastOpen = !lastBarConfirmedOf(chart);
  const security = (tf: string): Ohlct | null => {
    const sec = timeframe.in_seconds(tf);
    if (sec === chartSec) return { o: open, c: close, h: high, l: low, t: bars.map((b) => toMs(b.time)) };
    if (sec < chartSec) return null;
    const htf = higherTimeframeBars(bars, tf, chart);
    const out: Ohlct = { o: [], c: [], h: [], l: [], t: [] };
    for (let i = 0; i < n; i++) {
      // the latest completed bar of the timeframe; on an open last bar (realtime) the bar in progress
      const g = i === n - 1 && lastOpen ? htf.group[i] : htf.latest[i];
      const b = g >= 0 ? htf.htf[g] : undefined;
      out.o.push(b ? b.open : NaN);
      out.c.push(b ? b.close : NaN);
      out.h.push(b ? b.high : NaN);
      out.l.push(b ? b.low : NaN);
      out.t.push(b ? toMs(b.time) : NaN);
    }
    return out;
  };
  const cache = new Map<string, Ohlct | null>();
  const sec = (tf: string) => {
    if (!cache.has(tf)) cache.set(tf, security(tf));
    return cache.get(tf)!;
  };
  const lowerError = (what: string) => new Error(
    `Strat Assistant: ${what} needs the bars of a timeframe below the chart timeframe, which the chart bars do not have`);

  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];
  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    if (oneBar(i, 0, 1)) markers.push({ id: 'char0', time: t, position: 'belowBar', shape: 'circle', color: 'transparent', text: '1', textColor: INSIDE });
    if (twoUp(i, 0, 1)) {
      markers.push({ id: 'shape0', time: t, position: 'aboveBar', shape: 'arrowUp', color: BULL });
      markers.push({ id: 'char1', time: t, position: 'belowBar', shape: 'circle', color: 'transparent', text: '2', textColor: BULL });
    }
    if (twoDown(i, 0, 1)) {
      markers.push({ id: 'shape1', time: t, position: 'aboveBar', shape: 'arrowDown', color: BEAR });
      markers.push({ id: 'char2', time: t, position: 'belowBar', shape: 'circle', color: 'transparent', text: '2', textColor: BEAR });
    }
    if (threeBar(i, 0, 1)) markers.push({ id: 'char3', time: t, position: 'belowBar', shape: 'circle', color: 'transparent', text: '3', textColor: OUTSIDE });
    // barcolor(getBarColor())
    const bc = oneBar(i, 0, 1) ? INSIDE : threeBar(i, 0, 1) ? OUTSIDE : twoUp(i, 0, 1) ? BULL : twoDown(i, 0, 1) ? BEAR : null;
    if (bc) barColors.push({ id: 'barcolor0', time: t, color: bc });
  }

  // show_last = 1: the shapes below are drawn for the last bar only, `offset` bars to the right of it
  const L = n - 1;
  const timeAt = (offset: number) => (offset <= 0 ? bars[Math.max(0, L + offset)].time : timeAfterLastBar(bars, offset, chart));

  // actionable signals (offset 2)
  const wick = (high[L] - low[L]) * cfg.actionWickPercentage;
  const shooterTop = high[L] - wick;
  const hammerBottom = low[L] + wick;
  const isInsideBar = idxOne(L, 0);
  const isShooter = lt(open[L], shooterTop) && lt(close[L], shooterTop) && !idxOne(L, 0);
  const isHammer = gt(open[L], hammerBottom) && gt(close[L], hammerBottom) && !idxOne(L, 0);
  const flag = (id: string, text: string, col: string, position: 'top' | 'bottom', offset: number) =>
    markers.push({ id, time: timeAt(offset), position, shape: 'flag', color: col, text, textColor: col });
  if (isShooter) flag('shape2', 'Shooter', BEAR, 'bottom', 2);
  if (isHammer) flag('shape3', 'Hammer', BULL, 'bottom', 2);
  if (isInsideBar) flag('shape4', 'Inside Bar', INSIDE, 'bottom', 2);

  // full timeframe continuity
  FTC.forEach((f, k) => {
    if (!valid[k]) return;
    const s = sec(f.tf);
    if (!s) throw lowerError(`the ${f.tf} timeframe`);
    const green = le(s.o[L], s.c[L]);
    const inside = le(s.h[L], at(s.h, L - 1)) && ge(s.l[L], at(s.l, L - 1));
    const outside = gt(s.h[L], at(s.h, L - 1)) && lt(s.l[L], at(s.l, L - 1));
    // the 15 minute arrows need "Full Time Frame Continuity Active?"; the arrows of the other timeframes do not
    const arrows = k === 0 ? cfg.isFtcActive : true;
    const time = timeAt(f.offset - ftcTimeFrameOffset);
    const price = close[L];
    if (cfg.isFtcActive && inside) {
      markers.push({ id: `char${4 + 2 * k}`, time, position: 'atPriceMiddle', price, shape: 'circle', color: 'transparent', text: 'IN\n', textColor: PINE_TEXT });
    }
    if (cfg.isFtcActive && outside) {
      markers.push({ id: `char${5 + 2 * k}`, time, position: 'atPriceMiddle', price, shape: 'circle', color: 'transparent', text: 'O\n', textColor: PINE_TEXT });
    }
    if (arrows && green) {
      markers.push({ id: `shape${5 + 2 * k}`, time, position: 'atPriceMiddle', price, shape: 'arrowUp', color: BULL, text: f.text, textColor: PINE_TEXT });
    }
    if (arrows && !green) {
      markers.push({ id: `shape${6 + 2 * k}`, time, position: 'atPriceMiddle', price, shape: 'arrowDown', color: BEAR, text: f.text, textColor: PINE_TEXT });
    }
  });

  // strat combos (offset 3); index 0 is the last bar
  const combos = [
    idxDown(L, 2) && idxDown(L, 1) && idxDown(L, 0),
    idxUp(L, 2) && idxUp(L, 1) && idxUp(L, 0),
    idxDown(L, 2) && idxOne(L, 1) && idxDown(L, 0),
    idxUp(L, 2) && idxOne(L, 1) && idxUp(L, 0),
    idxUp(L, 1) && idxDown(L, 0) && !idxOne(L, 2) && !idxDown(L, 2) && !idxDown(L, 3) && !idxThree(L, 2),
    idxDown(L, 1) && idxUp(L, 0) && !idxOne(L, 2) && !idxUp(L, 2) && !idxUp(L, 3) && !idxThree(L, 2),
    idxUp(L, 2) && idxOne(L, 1) && idxDown(L, 0),
    idxDown(L, 2) && idxOne(L, 1) && idxUp(L, 0),
    idxThree(L, 2) && idxUp(L, 1) && idxDown(L, 0),
    idxThree(L, 2) && idxDown(L, 1) && idxUp(L, 0),
    idxThree(L, 1) && idxDown(L, 0),
    idxThree(L, 1) && idxUp(L, 0),
    idxThree(L, 2) && idxOne(L, 1) && idxDown(L, 0),
    idxThree(L, 2) && idxOne(L, 1) && idxUp(L, 0),
    idxOne(L, 2) && idxUp(L, 1) && idxDown(L, 0),
    idxOne(L, 2) && idxDown(L, 1) && idxUp(L, 0),
    idxDown(L, 3) && idxDown(L, 2) && idxUp(L, 1) && idxDown(L, 0),
    idxUp(L, 3) && idxUp(L, 2) && idxDown(L, 1) && idxUp(L, 0),
    idxThree(L, 0) && lt(close[L], at(low, L - 1)),
    idxThree(L, 0) && gt(close[L], at(low, L - 1)),
  ];
  combos.forEach((on, k) => {
    if (on) flag(`shape${21 + k}`, COMBOS[k][0], COMBOS[k][1] ? BULL : BEAR, 'top', 3);
  });

  // previous day / week lines and the debug label: created on every bar, the one of the bar before deleted: the
  // objects of the last bar remain
  setDrawingBar(L, true);
  const intradayOrDaily = isIntraday || isDaily;
  const dayLines = (cfg.isPrevDayHighLineActive || cfg.isPrevDayLowLineActive) && intradayOrDaily;
  const weekLines = (cfg.isPrevWeekHighLineActive || cfg.isPrevWeekLowLineActive) && (intradayOrDaily || isWeekly);
  if (dayLines || weekLines || cfg.isDebugLabelActive) {
    const day = sec('D');
    if (!day) throw lowerError(weekLines ? 'the previous week lines (start of the previous day)' : 'the debug label (daily values)');
    const week = weekLines || cfg.isDebugLabelActive ? sec('W') : null;
    if ((weekLines || cfg.isDebugLabelActive) && !week) throw lowerError('the weekly values');
    const x1 = at(day.t, L - 1);
    const x2 = toMs(bars[L].time);
    const dash = (y: number, col: string) => line.new(x1, y, x2, y, 'bar_time', 'right', col, 'dashed', 1);
    if (cfg.isPrevDayHighLineActive && intradayOrDaily) dash(at(day.h, L - 1), cfg.prevDayHighColor);
    if (cfg.isPrevDayLowLineActive && intradayOrDaily) dash(at(day.l, L - 1), cfg.prevDayLowColor);
    if (week && cfg.isPrevWeekHighLineActive && (intradayOrDaily || isWeekly)) dash(at(week.h, L - 1), cfg.prevWeekHighColor);
    if (week && cfg.isPrevWeekLowLineActive && (intradayOrDaily || isWeekly)) dash(at(week.l, L - 1), cfg.prevWeekLowColor);
    if (week && cfg.isDebugLabelActive) {
      const f = (v: number) => str.tostring(v, '#.##');
      const debugText = `PrevDay H|L: ${f(at(day.h, L - 1))}|${f(at(day.l, L - 1))}\n PrevWeek H|L: ${f(at(week.h, L - 1))}|${f(at(week.l, L - 1))}`;
      label.new(L, close[L] - close[L] * 0.003, debugText, 'bar_index', 'price', BLACK, 'label_upper_left', '#FFFFFF',
        'normal', 'left');
    }
  }
  setDrawingBar(null);

  return { ...base, markers, barColors, ...drawingOutputs(bars, ms ? 'ms' : 's') };
}

export const StratAssistant = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  shapeConfig,
  barColorConfig,
  drawingKinds,
};
