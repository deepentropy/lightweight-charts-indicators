/**
 * Fibonacci Auto Trend Scouter
 *
 * Two swing trackers, a long one (21 bars) and a short one (8 bars). A bar that makes the highest high of the
 * period (and not the lowest low) turns the direction up, a bar that makes the lowest low turns it down. Each turn
 * adds a swing point (extreme value, bar time, source price) to a list of 7 points; while the direction holds, a
 * more extreme bar replaces the newest point.
 *
 * From the 7 points of each tracker, on the last bar:
 * - trend lines: a top line and a bottom line between two pairs of points ("Front" = points 1-2, "Mid" = 3-4,
 *   "Back" = 5-6), each with an optional copy extended to the right, coloured by the slope of the channel middle;
 *   an optional "sight" line from the middle of two points through the close; an optional custom pair of lines
 *   between points of both trackers
 * - Fibonacci levels (0, 0.236, 0.382, 0.5, 0.618, 0.786, 1) between the lowest and the highest source price of
 *   the 7 points, recomputed when the newest point changes. Each level has a state from the close (next
 *   resistance, next support, far ...): the next levels and the chosen number of far levels are drawn as short
 *   lines around the last bar, the next levels with a label
 * - optional labels on the swing points and on the two ends of the Fibonacci range
 *
 * Three levels of other timeframes of the same symbol: the EMA of the source on that timeframe, drawn on the last
 * `Size` bars, with a label after the last bar. Every chart bar of a period shows the value of that period at its
 * end (the last period is still open). The bars of the timeframe are built from the chart bars, so the average
 * starts at the first chart bar (the original reads the whole history of the timeframe: the first values differ
 * until the average has converged) and the close of a day or a week is the close of its last chart bar (on stocks
 * the original has the official close of the day, which can differ by a few cents). A level whose
 * timeframe is below the chart timeframe needs data that the bars do not carry: the port throws an Error (with
 * the default timeframes 360 and 720 this happens on daily and higher bars: switch the plot and the label of
 * that level off, or choose a timeframe at or above the chart timeframe).
 *
 * Periods and the chart context (optional third argument of calculate): with the exchange time zone and the
 * session of the symbol (`timezone`, `session`) the periods are those of the exchange calendar, see
 * src/anchor-period.ts. Without them the port uses the UTC calendar and the bars. `timeframe`, when given, is the
 * chart timeframe; without it the chart timeframe is read from the bar spacing.
 *
 * Not ported: the plot style and width inputs of the three levels (the plot configuration is static: a line of
 * width 4, the defaults).
 *
 * Reference: "Fibonacci Auto Trend Scouter" by sirkriz
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: (c) sirkriz
 */

import {
  ta, taCore, taStep, getSourceSeries, color, timeframe, str, array, resample, mapToChart,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import { periodStarts, chartTimeframe, securityBars, hasCalendar } from '../anchor-period';
import type { ChartContext } from '../chart-context';
import type { LabelData, LineDrawingData } from '../types';
import { barSource, createBarRun, fullResult, isBarSource, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

type Pair = 'Front' | 'Mid' | 'Back';
type Dash = 'Solid' | 'Dashed' | 'Dotted';
type Group = 'Long' | 'Short';
type Trend = 's1' | 's2';
type AnyTrend = Trend | 's3';
type Level = 1 | 2 | 3;
type Ratio = '0' | '236' | '382' | '50' | '618' | '786' | '1';
type FibSide = 'fibLong' | 'fibShort';

export type FibonacciAutoTrendScouterInputs = {
  /** Source of the swing point prices (and of the swing extremes when `trendData` is "Source") */
  src: SourceType;
  /** Swing extremes: the source, or the bar high / low */
  trendData: 'Source' | 'High/Low';
  mediumPeriod: number;
  smallPeriod: number;
  showSmCoordLabels: boolean;
  showMdCoordLabels: boolean;
  s3ShowTop: boolean;
  s3TopFromGroup: Group;
  s3TopFromPair: Pair;
  s3TopToGroup: Group;
  s3TopToPair: Pair;
  s3ShowBtm: boolean;
  s3BottomFromGroup: Group;
  s3BottomFromPair: Pair;
  s3BottomToGroup: Group;
  s3BottomToPair: Pair;
  showFibSrcLine: boolean;
  showFibLabelsGroup: boolean;
  showFibSrcLabel: boolean;
  showFibFarLabels: boolean;
  showFibSrcLabelInfo: 'Ratio' | 'Order' | 'None';
  fibColorStyle: 'Multi' | 'Kind' | 'Default';
  fibColorResistance: string;
  fibColorSupport: string;
  fibColorDefaultS: string;
  fibColorDefault: string;
}
  // Short trend (s1) and long trend (s2): the pairs of points of the top and bottom lines, the sight line
  & { [K in `${Trend}${'TopFrom' | 'TopTo' | 'BottomFrom' | 'BottomTo'}`]: Pair }
  & { [K in `${Trend}${'ShowSight'}`]: boolean }
  & { [K in `${Trend}${'SightStyle'}`]: Dash }
  & { [K in `${Trend}${'SightWidth'}`]: number }
  // Lines of the short, long and custom (s3) trends
  & { [K in `${AnyTrend}${'LineStyle' | 'XlineStyle'}`]: Dash }
  & { [K in `${AnyTrend}${'LineWidth' | 'XlineWidth'}`]: number }
  & { [K in `${AnyTrend}${'LineExtend' | 'UseColors'}`]: boolean }
  & { [K in `${AnyTrend}${'ColorUp' | 'ColorDn' | 'ColorDefault'}`]: string }
  // Levels of other timeframes
  & { [K in `htf${Level}${'Show' | 'Label'}`]: boolean }
  & { [K in `htf${Level}Source`]: SourceType }
  & { [K in `htf${Level}Timeframe`]: string }
  & { [K in `htf${Level}${'Length' | 'Size' | 'Width'}`]: number }
  & { [K in `htf${Level}Style`]: 'Line' | 'Cross' | 'Circle' }
  & { [K in `htf${Level}Color`]: string }
  // Level colours: `fibColor<ratio>` colours the levels of the long tracker, `smFibColor<ratio>` those of the short one
  & { [K in `${'fibColor' | 'smFibColor'}${Ratio}`]: string }
  // Level lines of the long and the short tracker
  & { [K in `${FibSide}${'Far' | 'ActiveWidth' | 'InactiveWidth' | 'Left' | 'Right'}`]: number }
  & { [K in `${FibSide}${'ActiveStyle' | 'InactiveStyle'}`]: Dash };

const PAIRS: Pair[] = ['Front', 'Mid', 'Back'];
const DASHES: Dash[] = ['Solid', 'Dashed', 'Dotted'];
const GROUPS: Group[] = ['Long', 'Short'];
const LEVELS: Level[] = [1, 2, 3];
const RATIOS: Ratio[] = ['0', '236', '382', '50', '618', '786', '1'];

/** Spaces of the original input titles (U+2000 ... U+200D, used there to align the settings) */
const sp = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_v, k) => String.fromCharCode(from + k)).join('');
const EM = '\u2001';

interface Def extends InputConfig { id: keyof FibonacciAutoTrendScouterInputs }

function trendInputs(t: Trend, group: string, tag: string, up: string, down: string): Def[] {
  const n = t === 's1' ? '1' : '2';
  return [
    { id: `${t}TopFrom`, type: 'string', title: 'Top', defval: 'Back', options: PAIRS, group, inline: `${t}topsel` },
    { id: `${t}TopTo`, type: 'string', title: '--->', defval: 'Mid', options: PAIRS, group, inline: `${t}topsel` },
    { id: `${t}BottomFrom`, type: 'string', title: 'Bottom', defval: 'Back', options: PAIRS, group, inline: `${t}btmsel` },
    { id: `${t}BottomTo`, type: 'string', title: '--->', defval: 'Mid', options: PAIRS, group, inline: `${t}btmsel` },
    { id: `${t}LineStyle`, type: 'string', title: 'Lines', defval: 'Solid', options: DASHES, group, inline: `t${t}line` },
    { id: `${t}LineWidth`, type: 'int', title: '', defval: 4, min: 1, group, inline: `t${t}line` },
    { id: `${t}LineExtend`, type: 'bool', title: 'Extend', defval: true, group, inline: `extend${n}` },
    { id: `${t}XlineStyle`, type: 'string', title: '', defval: 'Dashed', options: DASHES, group, inline: `extend${n}` },
    { id: `${t}XlineWidth`, type: 'int', title: '', defval: 1, min: 1, group, inline: `extend${n}` },
    { id: `${t}ShowSight`, type: 'bool', title: 'Sight', defval: false, group, inline: `sight${n}` },
    { id: `${t}SightStyle`, type: 'string', title: '', defval: 'Solid', options: DASHES, group, inline: `sight${n}` },
    { id: `${t}SightWidth`, type: 'int', title: '', defval: 2, min: 1, group, inline: `sight${n}` },
    { id: `${t}UseColors`, type: 'bool', title: 'Colors: ', defval: true, group, inline: tag },
    { id: `${t}ColorUp`, type: 'color', title: 'Up', defval: up, group, inline: tag },
    { id: `${t}ColorDn`, type: 'color', title: 'Down', defval: down, group, inline: tag },
    { id: `${t}ColorDefault`, type: 'color', title: 'Default', defval: '#FFFFFF', group, inline: tag },
  ];
}

function customInputs(): Def[] {
  const group = 'Custom Trend';
  const side = (show: 's3ShowTop' | 's3ShowBtm', name: 'Top' | 'Bottom', tag: string): Def[] => [
    { id: show, type: 'bool', title: name, defval: false, group, inline: `${tag}1` },
    { id: `s3${name}FromGroup`, type: 'string', title: '', defval: 'Long', options: GROUPS, group, inline: `${tag}1` },
    { id: `s3${name}FromPair`, type: 'string', title: '', defval: 'Mid', options: PAIRS, group, inline: `${tag}1` },
    { id: `s3${name}ToGroup`, type: 'string', title: '--->', defval: 'Short', options: GROUPS, group, inline: `${tag}2` },
    { id: `s3${name}ToPair`, type: 'string', title: '', defval: 'Mid', options: PAIRS, group, inline: `${tag}2` },
  ];
  return [
    ...side('s3ShowTop', 'Top', 's3topsel'),
    ...side('s3ShowBtm', 'Bottom', 's3btmsel'),
    { id: 's3LineStyle', type: 'string', title: 'Lines', defval: 'Solid', options: DASHES, group, inline: 'ts3line' },
    { id: 's3LineWidth', type: 'int', title: '', defval: 2, min: 1, group, inline: 'ts3line' },
    { id: 's3LineExtend', type: 'bool', title: 'Extend', defval: false, group, inline: 'extend2' },
    { id: 's3XlineStyle', type: 'string', title: '', defval: 'Dashed', options: DASHES, group, inline: 'extend2' },
    { id: 's3XlineWidth', type: 'int', title: '', defval: 1, min: 1, group, inline: 'extend2' },
    { id: 's3UseColors', type: 'bool', title: 'Colors: ', defval: false, group, inline: 'T2Color' },
    { id: 's3ColorUp', type: 'color', title: 'Up', defval: 'rgba(103, 58, 183, 0.9)', group, inline: 'T2Color' },
    { id: 's3ColorDn', type: 'color', title: 'Down', defval: 'rgba(156, 39, 176, 0.9)', group, inline: 'T2Color' },
    { id: 's3ColorDefault', type: 'color', title: 'Default', defval: '#FFFFFF', group, inline: 'T2Color' },
  ];
}

function levelInputs(k: Level, tf: string, colour: string): Def[] {
  const group = `Higher TF Level ${k}`;
  const tag = (m: number) => `htf${k}_${m}`;
  return [
    { id: `htf${k}Show`, type: 'bool', title: 'Show Plot', defval: true, group, inline: tag(0) },
    { id: `htf${k}Label`, type: 'bool', title: 'Show Label', defval: true, group, inline: tag(0) },
    { id: `htf${k}Source`, type: 'source', title: '', defval: 'close', group, inline: tag(1) },
    { id: `htf${k}Timeframe`, type: 'timeframe', title: '', defval: tf, group, inline: tag(1) },
    { id: `htf${k}Length`, type: 'int', title: 'Length', defval: 13, group, inline: tag(3) },
    { id: `htf${k}Size`, type: 'int', title: 'Size', defval: 200, min: 1, group, inline: tag(3) },
    { id: `htf${k}Style`, type: 'string', title: 'Style: ', defval: 'Line', options: ['Line', 'Cross', 'Circle'], group, inline: tag(2) },
    { id: `htf${k}Width`, type: 'int', title: '', defval: 4, min: 0, group, inline: tag(2) },
    { id: `htf${k}Color`, type: 'color', title: '', defval: colour, group, inline: tag(2) },
  ];
}

function fibColourInputs(): Def[] {
  const group = 'Fibonacci';
  // ratio, default colour, title of the first input, title of the second one
  const rows: Array<[Ratio, string, string, string]> = [
    ['0', '#d1d4dc', `Short 0${EM}`, `${EM.repeat(6)}Long 0${EM}`],
    ['236', '#81c784', 'Short .236', `${EM.repeat(4)} Long .236`],
    ['382', '#4caf50', 'Short .382', `${EM.repeat(4)} Long .382`],
    ['50', '#f44336', 'Short .50', `${EM.repeat(5)} Long .50`],
    ['618', '#fbc02d', 'Short .618', `${EM.repeat(4)} Long .618`],
    ['786', '#64b5f6', 'Short .786', `${EM.repeat(4)} Long .786`],
    ['1', '#d1d4dc', `Short 1${EM}`, `${EM.repeat(6)} Long 1${EM}`],
  ];
  return rows.flatMap(([r, c, first, second]): Def[] => [
    { id: `fibColor${r}`, type: 'color', title: first, defval: c, group, inline: `fibcol${r}` },
    { id: `smFibColor${r}`, type: 'color', title: second, defval: c, group, inline: `fibcol${r}` },
  ]);
}

function fibLineInputs(side: FibSide, group: string, far: string, left: number, right: number, row: string): Def[] {
  return [
    { id: `${side}Far`, type: 'int', title: far, defval: 1, min: 0, max: 6, group },
    { id: `${side}ActiveStyle`, type: 'string', title: 'Active Line', defval: 'Solid', options: DASHES, group, inline: 'fibactive' },
    { id: `${side}ActiveWidth`, type: 'int', title: '', defval: 2, min: 1, group, inline: 'fibactive' },
    { id: `${side}InactiveStyle`, type: 'string', title: 'Inactive Line', defval: 'Dotted', options: DASHES, group, inline: 'fibinactive' },
    { id: `${side}InactiveWidth`, type: 'int', title: '', defval: 1, min: 1, group, inline: 'fibinactive' },
    { id: `${side}Left`, type: 'int', title: 'Size: Left', defval: left, min: 0, group, inline: row },
    { id: `${side}Right`, type: 'int', title: 'Right', defval: right, min: 0, group, inline: row },
  ];
}

const DEFS: Def[] = [
  { id: 'src', type: 'source', title: 'Source data:', defval: 'hlc3', group: 'Trend', inline: 'period' },
  { id: 'trendData', type: 'string', title: 'Trend Coords:', defval: 'High/Low', options: ['Source', 'High/Low'], group: 'Trend', inline: 'period2' },
  { id: 'mediumPeriod', type: 'int', title: 'Length: \u200D\u200DLong', defval: 21, group: 'Trend', inline: 'period1' },
  { id: 'smallPeriod', type: 'int', title: 'Short', defval: 8, group: 'Trend', inline: 'period1' },
  { id: 'showSmCoordLabels', type: 'bool', title: 'Short HH/LL Labels', defval: false, group: 'Trend' },
  { id: 'showMdCoordLabels', type: 'bool', title: 'Long HH/LL Labels', defval: false, group: 'Trend' },
  ...trendInputs('s1', 'Short Trend', 'TColor', 'rgba(33, 150, 243, 0.9)', 'rgba(255, 152, 0, 0.9)'),
  ...trendInputs('s2', 'Long Trend', 'T2Color', 'rgba(76, 175, 80, 0.9)', 'rgba(255, 82, 82, 0.9)'),
  ...customInputs(),
  ...levelInputs(1, '360', 'rgba(255, 235, 59, 0.5)'),
  ...levelInputs(2, '720', 'rgba(0, 188, 212, 0.5)'),
  ...levelInputs(3, '1D', 'rgba(178, 181, 190, 0.5)'),
  { id: 'showFibSrcLine', type: 'bool', title: `Show source line${sp(0x2000, 0x200d)}`, defval: false, group: 'Fibonacci', inline: 'fiblvlconf1' },
  { id: 'showFibLabelsGroup', type: 'bool', title: 'Show TF on labels', defval: false, group: 'Fibonacci', inline: 'fiblvlconf1' },
  { id: 'showFibSrcLabel', type: 'bool', title: `Show source labels${sp(0x2001, 0x2009)}`, defval: false, group: 'Fibonacci', inline: 'fiblvlconf2' },
  { id: 'showFibFarLabels', type: 'bool', title: 'Show far labels', defval: false, group: 'Fibonacci', inline: 'fiblvlconf2' },
  { id: 'showFibSrcLabelInfo', type: 'string', title: 'Show Info', defval: 'Order', options: ['Ratio', 'Order', 'None'], group: 'Fibonacci', inline: 'fiblvlconf3' },
  { id: 'fibColorStyle', type: 'string', title: 'Coloring', defval: 'Multi', options: ['Multi', 'Kind', 'Default'], group: 'Fibonacci', inline: 'fiblvlconf3' },
  { id: 'fibColorResistance', type: 'color', title: 'Resistance', defval: '#e91e63', group: 'Fibonacci', inline: 'fibrescol' },
  { id: 'fibColorSupport', type: 'color', title: `${sp(0x2000, 0x200d)}Support`, defval: '#2196f3', group: 'Fibonacci', inline: 'fibrescol' },
  ...fibColourInputs(),
  { id: 'fibColorDefaultS', type: 'color', title: 'Default Short', defval: '#FFFFFF', group: 'Fibonacci', inline: 'fibdefcol' },
  { id: 'fibColorDefault', type: 'color', title: `${sp(0x2000, 0x2004)}Default Long`, defval: '#B2B5BE', group: 'Fibonacci', inline: 'fibdefcol' },
  ...fibLineInputs('fibLong', 'Fib Long TF', 'Long TF far levels shown', 20, 10, 'fibsizerow1'),
  ...fibLineInputs('fibShort', 'Fib Short TF', 'Short TF far levels shown', 10, 20, 'fibsizerow2'),
];

export const inputConfig: InputConfig[] = DEFS;

export const defaultInputs = Object.fromEntries(DEFS.map((d) => [d.id, d.defval])) as FibonacciAutoTrendScouterInputs;

export const plotConfig: PlotConfig[] = LEVELS.map((k) => ({
  id: `plot${k - 1}`, title: 'HTF 1', color: String(defaultInputs[`htf${k}Color`]), lineWidth: 4,
}));

export const metadata = {
  title: 'Fibonacci Auto Trend Scouter',
  shortTitle: 'FATS',
  overlay: true,
};

// Colour constants of Pine version 4
const CLEAR_BLACK = String(color.new('#363A45', 100));
const CLEAR_WHITE = String(color.new('#FFFFFF', 100));
const WHITE = '#FFFFFF';
const YELLOW = '#FFEB3B';
const BLUE = '#2196F3';

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
/** A number used as a condition: na and 0 are false */
const truthy = (v: number) => !isNaN(v) && v !== 0;

const dash = (d: Dash) => (d === 'Solid' ? 'solid' : d === 'Dashed' ? 'dashed' : 'dotted');

/** A swing point: the extreme value, the bar time (ms) and the source price */
interface Ball { v: number; x: number; y: number }

/** One swing tracker (the long or the short one) */
interface Track {
  /** True: the swing test reads the extreme as a condition (0 is false), as the short tracker of the original */
  asCondition: boolean;
  direction: number;
  /** value, time, price of each point, the newest first (21 numbers at most) */
  bag: number[];
  ready: boolean;
  /** The 7 points (na until the list is full) */
  balls: Ball[];
  /** True when the newest point differs from the one of the previous bar */
  changed: boolean;
  /** The 7 Fibonacci levels (empty until the first change of a full list) */
  fibs: number[];
}

const NO_BALLS: Ball[] = Array.from({ length: 7 }, () => ({ v: NaN, x: NaN, y: NaN }));
const MAX_BAG = 21;

/** Range of the 7 points: lowest and highest price with their times, and the direction from the older to the newer */
function fibSource(balls: Ball[]): { minX: number; minY: number; maxX: number; maxY: number; dir: number } {
  const values = balls.map((b) => b.y);
  const maxY = array.max(values);
  const maxIdx = array.indexof(values, maxY);
  const maxX = maxIdx >= 0 ? balls[maxIdx].x : NaN;
  const minY = array.min(values);
  const minIdx = array.indexof(values, minY);
  const minX = minIdx >= 0 ? balls[minIdx].x : NaN;
  return { minX, minY, maxX, maxY, dir: lt(minX, maxX) ? 1 : gt(minX, maxX) ? -1 : 0 };
}

const addPoint = (bag: number[], value: number, time: number, price: number) => {
  bag.unshift(value, time, price);
  if (bag.length > MAX_BAG) bag.length -= 3;
};

/**
 * One bar of a tracker: `highZero` / `lowZero` are ta.highestbars / ta.lowestbars(period) == 0 (the bar holds the
 * extreme of the period), `hic` / `loc` the extremes of the bar, `ms` its time (ms), `src` its source price
 */
function stepTrack(t: Track, i: number, highZero: boolean, lowZero: boolean, hic: number, loc: number, ms: number, src: number): void {
  const highCoord = highZero ? hic : NaN;
  const lowCoord = lowZero ? loc : NaN;
  const newHigh = (t.asCondition ? truthy(highCoord) : !isNaN(highCoord)) && isNaN(lowCoord);
  const newLow = (t.asCondition ? truthy(lowCoord) : !isNaN(lowCoord)) && isNaN(highCoord);
  const before = t.direction;
  t.direction = newHigh ? 1 : newLow ? -1 : t.direction;
  const value = t.direction === 1 ? highCoord : lowCoord;
  // change(direction) is na on the first bar
  if (i > 0 && t.direction !== before) {
    addPoint(t.bag, value, ms, src);
  } else if (t.bag.length === 0) {
    addPoint(t.bag, value, ms, src);
  } else if ((t.direction === 1 && gt(value, t.bag[0])) || (t.direction === -1 && lt(value, t.bag[0]))) {
    t.bag[0] = value;
    t.bag[1] = ms;
    t.bag[2] = src;
  }

  const previous = t.balls[0];
  t.ready = t.bag.length > 18;
  t.balls = t.ready
    ? Array.from({ length: 7 }, (_v, k) => ({ v: t.bag[3 * k], x: Math.round(t.bag[3 * k + 1]), y: t.bag[3 * k + 2] }))
    : NO_BALLS;
  const first = t.balls[0];
  t.changed = truthy(first.y - previous.y) || truthy(first.x - previous.x) || truthy(first.v - previous.v);

  if (t.ready && t.changed) {
    const { minY, maxY, dir } = fibSource(t.balls);
    // getFibRetracements(dir, L, H) with L = the older end of the range: the levels go from the newer end (0) back
    const L = dir === 1 ? minY : maxY;
    const H = dir === 1 ? maxY : minY;
    t.fibs = [H, ...[23.6, 38.2, 50.0, 61.8, 78.6].map((p) => H - (H - L) * (p / 100)), L];
  }
}

const newTrack = (asCondition: boolean): Track => ({
  asCondition, direction: 0, bag: [], ready: false, balls: NO_BALLS, changed: false, fibs: [],
});

type Point = [time: number, price: number];

/** The higher (top) or lower (bottom) point of a pair of swing points; the price is the source or the extreme */
function selection(t: Track, top: boolean, pair: Pair, useSrc: boolean): Point {
  const k = pair === 'Front' ? 0 : pair === 'Mid' ? 2 : 4;
  const a = t.balls[k];
  const b = t.balls[k + 1];
  const y1 = useSrc ? a.y : a.v;
  const y2 = useSrc ? b.y : b.v;
  const y = top ? Math.max(y1, y2) : Math.min(y1, y2);
  return [eq(y, y1) ? a.x : b.x, y];
}

/** Top and bottom line of a tracker, and the direction of the middle of the channel */
function channel(t: Track, id: Trend, cfg: FibonacciAutoTrendScouterInputs): { topFrom: Point; topTo: Point; bottomFrom: Point; bottomTo: Point; up: boolean } {
  const useSrc = cfg.trendData === 'Source';
  const topFrom = selection(t, true, cfg[`${id}TopFrom`], useSrc);
  const topTo = selection(t, true, cfg[`${id}TopTo`], useSrc);
  const bottomFrom = selection(t, false, cfg[`${id}BottomFrom`], useSrc);
  const bottomTo = selection(t, false, cfg[`${id}BottomTo`], useSrc);
  return { topFrom, topTo, bottomFrom, bottomTo, up: gt((topTo[1] + bottomTo[1]) / 2, (topFrom[1] + bottomFrom[1]) / 2) };
}

/**
 * State of a level from the close: 0 = top level still rising (the bar high), 1 = far resistance, 2 = next
 * resistance, 3 = next support, 4 = far support, 5 = bottom level still falling (the bar low), -1 = none.
 */
function fibState(dir: number, prev: number, level: number, next: number, bar: Bar): number {
  const c = bar.close;
  if (dir === 1 && prev === -1) return eq(level, bar.high) ? 0 : gt(c, level) ? 3 : lt(c, next) ? 1 : 2;
  if (dir === 1 && next === -1) return lt(c, level) ? 2 : gt(c, next) ? 4 : 3;
  if (dir === 1) {
    return ge(c, level) && le(c, prev) ? 3 : ge(c, level) && ge(c, prev) ? 4
      : le(c, level) && ge(c, next) ? 2 : le(c, level) && le(c, next) ? 1 : -1;
  }
  if (dir === -1 && next === -1) return gt(c, level) ? 3 : lt(c, prev) ? 1 : 2;
  if (dir === -1 && prev === -1) return eq(level, bar.low) ? 5 : lt(c, level) ? 2 : gt(c, next) ? 4 : 3;
  if (dir === -1) {
    return ge(c, level) && le(c, next) ? 3 : ge(c, level) && ge(c, next) ? 4
      : le(c, level) && ge(c, prev) ? 2 : le(c, level) && le(c, prev) ? 1 : -1;
  }
  return -1;
}

/** States of the 7 levels (0 for every level before the first levels exist) */
function fibStates(fibs: number[], dir: number, bar: Bar): number[] {
  return RATIOS.map((_r, k) => (fibs.length >= k + 1
    ? fibState(dir, k === 0 ? -1 : fibs[k - 1], fibs[k], k === 6 ? -1 : fibs[k + 1], bar)
    : 0));
}

/** "1 D 2 H 3 m " from a number of seconds (seconds only below one day) */
function timeToString(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds - d * 86400) / 3600);
  const m = Math.floor((seconds - d * 86400 - h * 3600) / 60);
  const s = Math.floor(seconds - d * 86400 - h * 3600 - m * 60);
  let ret = d > 0 ? `${str.tostring(d)} D ` : '';
  ret += h > 0 ? `${str.tostring(h)} H ` : '';
  ret += m > 0 ? `${str.tostring(m)} m ` : '';
  if (d === 0) ret += s > 0 ? `${str.tostring(s)} s ` : '';
  return ret;
}

/** Name of a timeframe on its label: a number of minutes as a duration, else the timeframe string */
function timeframeToString(tf: string): string {
  const chars = str.split(tf, '');
  const last = str.tonumber(chars[chars.length - 1]);
  return last === null || Number.isNaN(last) ? tf : timeToString((str.tonumber(tf) ?? NaN) * 60);
}

/**
 * security(tickerid, tf, ...) on the chart symbol with lookahead: the bars of timeframe `tf` built from the chart
 * bars, and the function that brings one value per bar of that timeframe back to the chart bars (every chart bar
 * of a period shows the value of the period).
 */
function timeframeBars(bars: Bar[], tf: string, name: string, context?: ChartContext): { htf: Bar[]; toChart: (values: number[]) => number[] } {
  const chart = chartTimeframe(bars, context);
  if (tf.trim() === '' || chart === '' || timeframe.in_seconds(tf) === timeframe.in_seconds(chart)) {
    return { htf: bars, toChart: (values) => values };
  }
  if (timeframe.in_seconds(tf) < timeframe.in_seconds(chart)) {
    throw new Error(`Fibonacci Auto Trend Scouter: the timeframe "${tf}" of ${name} is lower than the chart timeframe "${chart}": the chart bars do not have that data (choose another timeframe or switch "Show Plot" and "Show Label" of that level off)`);
  }
  const exchange = securityBars(bars, tf, context);
  if (exchange) return { htf: exchange.htf, toChart: (values) => mapToChart(values, exchange.group, exchange.latest, true, false) };
  // Without it: periods of the UTC calendar and the bars, grouped by the library
  const { bars: htf, group } = resample(bars, periodStarts(bars, tf, context));
  return { htf, toChart: (values) => mapToChart(values, group, group, true, false) };
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
 * The periods of a timeframe bar by bar: 'chart' (each chart bar is a bar of the timeframe), 'utc' (the periods of
 * the UTC rule of `periodStarts`, grouped as `resample` does)
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
  /** Period start of the current period (in the unit of the bar times) */
  out: number;
  /** First chart bar of the current period */
  first: number;
}

function tfState(mode: TfState['mode'], tf: string): TfState {
  const info = mode === 'utc' ? timeframe.info(tf) : null;
  return {
    mode, info, len: info?.isintraday ? timeframe.in_seconds(tf) * 1000 : 0,
    prevDay: NaN, sessionStart: NaN, prevKey: NaN, start: NaN, tradingYear: NaN, tradingDays: -1, prevTradingDay: NaN,
    out: NaN, first: 0,
  };
}

/** True when chart bar `i` (`t`: its time in ms) opens a new period of the timeframe (periodStarts / resample) */
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

type PlotPoint = { time: number; value: number; color?: string };

/** The ema of a level on the completed bars of its timeframe (out of the run state: caught up from `finals`) */
interface LevelEma {
  m: ReturnType<typeof taStep.ema>;
  /** Completed bars of the timeframe committed into `m` */
  committed: number;
}

/** A level of another timeframe bar by bar: its periods and the bar of the timeframe so far */
interface LevelState {
  tf: TfState;
  /** The bar of the timeframe so far (resample: open of the first bar, highest high, lowest low, last close, volume sum) */
  bar: Bar;
  /** ema of the current bar of the timeframe so far */
  cur: number;
}

interface FatsVars {
  md: Track;
  sm: Track;
  levels: (LevelState | null)[];
}

interface FatsRun extends BarRunState<FatsVars> {
  /** ta.highestbars / ta.lowestbars of the two trackers (long, short), created on the first bar */
  extremes: WindowExtreme[];
  emas: (LevelEma | null)[];
  /** Source values of the completed bars of each level's timeframe */
  finals: number[][];
  /** Level values from the whole bar set (exchange calendar) */
  pre: (number[] | null)[] | null;
  /** Plot points of each level: drawn, and not drawn (outside the last `Size` bars) */
  shown: PlotPoint[][];
  hidden: PlotPoint[][];
}

function study(inputs: Partial<FibonacciAutoTrendScouterInputs>): BarStudy<FatsRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const src = barSource(cfg.src);
  const useSrc = cfg.trendData === 'Source';
  const active = LEVELS.map((k) => cfg[`htf${k}Show`] || cfg[`htf${k}Label`]);
  const levelSrc = LEVELS.map((k) => barSource(cfg[`htf${k}Source`]));
  let inMs = false;
  let everyDay = false;
  /** The point of chart bar j for a level value */
  const point = (k: Level, time: number, value: number): PlotPoint => (Number.isFinite(value)
    ? { time, value, color: cfg[`htf${k}Color`] }
    : { time, value: NaN });
  return {
    // with the exchange calendar the bars of the level timeframes come from the calendar of the whole bar set
    fullRunReason: (chart) => (![cfg.src, ...LEVELS.map((k) => cfg[`htf${k}Source`])].every(isBarSource)
      ? 'source of another study' : hasCalendar(chart) ? 'exchange calendar periods' : null),
    // the chart timeframe from the bar gaps, the time unit of the first bar and the weekend bars of the set (the
    // start of the UTC days of the periods)
    key: (bars, chart) => `${chartTimeframe(bars, chart)}|${bars.length > 0 && bars[0].time >= 1e12}|${hasWeekendBars(bars)}`,
    init(bars, chart) {
      inMs = bars.length > 0 && bars[0].time >= 1e12;
      everyDay = hasWeekendBars(bars);
      const chartTf = chartTimeframe(bars, chart);
      const calendar = hasCalendar(chart);
      const levels: (LevelState | null)[] = [];
      const emas: (LevelEma | null)[] = [];
      const pre: (number[] | null)[] = [];
      // Levels of other timeframes: ema(source, length) on the bars of the timeframe (the checks of timeframeBars and
      // of ta.ema in the order of the original)
      for (const k of LEVELS) {
        if (!active[k - 1]) {
          levels.push(null);
          emas.push(null);
          pre.push(null);
          continue;
        }
        const tf = cfg[`htf${k}Timeframe`];
        if (calendar) {
          // the periods of the exchange calendar: the level values from the whole bar set
          const { htf, toChart } = timeframeBars(bars, tf, `Higher TF Level ${k}`, chart);
          pre.push(toChart(ta.ema(getSourceSeries(htf, cfg[`htf${k}Source`]), cfg[`htf${k}Length`]).toArray().map((v) => v ?? NaN)));
          levels.push(null);
          emas.push(null);
          continue;
        }
        let mode: TfState['mode'] = 'chart';
        if (!(tf.trim() === '' || chartTf === '' || timeframe.in_seconds(tf) === timeframe.in_seconds(chartTf))) {
          if (timeframe.in_seconds(tf) < timeframe.in_seconds(chartTf)) {
            throw new Error(`Fibonacci Auto Trend Scouter: the timeframe "${tf}" of Higher TF Level ${k} is lower than the chart timeframe "${chartTf}": the chart bars do not have that data (choose another timeframe or switch "Show Plot" and "Show Label" of that level off)`);
          }
          // the checks of periodStarts (a tick timeframe)
          periodStarts([], tf);
          mode = 'utc';
        }
        emas.push({ m: taStep.ema(cfg[`htf${k}Length`]), committed: 0 });
        levels.push({ tf: tfState(mode, tf), bar: { time: 0, open: NaN, high: NaN, low: NaN, close: NaN, volume: NaN }, cur: NaN });
        pre.push(null);
      }
      const s: FatsRun = {
        extremes: [], emas, finals: LEVELS.map(() => []), pre: calendar ? pre : null,
        shown: LEVELS.map(() => []), hidden: LEVELS.map(() => []),
        steps: [],
        vars: { md: newTrack(false), sm: newTrack(true), levels },
        lists: [], series: [],
      };
      // the trackers' machines are created on the first bar: committed through this step
      s.steps = [{ commit: () => { for (const m of s.extremes) m.commit(); } }];
      s.lists = s.finals;
      s.series = [...s.shown, ...s.hidden];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const v = s.vars;
      const t = inMs ? time : time * 1000;
      // Levels of other timeframes
      for (const k of LEVELS) {
        s.hidden[k - 1][i] = { time, value: NaN };
        if (s.pre) {
          const values = s.pre[k - 1];
          if (values) {
            s.shown[k - 1][i] = point(k, time, values[i]);
          }
          continue;
        }
        // changed in place: copyVars copies them at the end of the last confirmed bar
        const lv = v.levels[k - 1];
        if (!lv) continue;
        const st = lv.tf;
        const hb = lv.bar;
        const opens = opensPeriod(st, i, t, everyDay, inMs);
        if (opens && i > 0) {
          // the bar of the timeframe before is complete: its chart bars show its value (lookahead, no gaps)
          for (let j = st.first; j < i; j++) {
            s.shown[k - 1][j] = point(k, bars[j].time, lv.cur);
          }
          s.finals[k - 1].push(levelSrc[k - 1](hb));
        }
        if (opens) {
          st.first = i;
          hb.time = st.out;
          hb.open = b.open;
          hb.high = b.high;
          hb.low = b.low;
          hb.close = b.close;
          hb.volume = b.volume ?? NaN;
        } else {
          hb.high = Math.max(hb.high, b.high);
          hb.low = Math.min(hb.low, b.low);
          hb.close = b.close;
          hb.volume = (hb.volume ?? 0) + (b.volume ?? NaN);
        }
        // the ema of the completed bars (caught up; rebuilt when a recalculated bar no longer completes a period)
        const e = s.emas[k - 1]!;
        const finals = s.finals[k - 1];
        if (e.committed > finals.length) {
          e.m = taStep.ema(cfg[`htf${k}Length`]);
          e.committed = 0;
        }
        while (e.committed < finals.length) {
          e.m.step(finals[e.committed]);
          e.m.commit();
          e.committed++;
        }
        lv.cur = e.m.step(levelSrc[k - 1](st.mode === 'chart' ? b : hb));
      }

      // The trackers: ta.highestbars / ta.lowestbars(period) == 0 on the bar holding the extreme of the period
      if (i === 0) {
        // created on the first bar (the original has no tracker without bars), in the order of the ta calls
        taCore.highestbars([], cfg.mediumPeriod);
        const mdHigh = new WindowExtreme(false, cfg.mediumPeriod);
        taCore.lowestbars([], cfg.mediumPeriod);
        const mdLow = new WindowExtreme(true, cfg.mediumPeriod);
        taCore.highestbars([], cfg.smallPeriod);
        const smHigh = new WindowExtreme(false, cfg.smallPeriod);
        taCore.lowestbars([], cfg.smallPeriod);
        const smLow = new WindowExtreme(true, cfg.smallPeriod);
        s.extremes = [mdHigh, mdLow, smHigh, smLow];
      }
      const price = src(b);
      const hic = useSrc ? price : b.high;
      const loc = useSrc ? price : b.low;
      const own = Number.isFinite(hic);
      const ownLow = Number.isFinite(loc);
      const [mdHigh, mdLow, smHigh, smLow] = s.extremes;
      const zero = (m: WindowExtreme, x: number, kept: boolean) => {
        const e = m.step(x);
        return kept && e === x;
      };
      const mdH = zero(mdHigh, hic, own);
      const mdL = zero(mdLow, loc, ownLow);
      const smH = zero(smHigh, hic, own);
      const smL = zero(smLow, loc, ownLow);
      const ms = time * (inMs ? 1 : 1000);
      stepTrack(v.md, i, mdH, mdL, hic, loc, ms, price);
      stepTrack(v.sm, i, smH, smL, hic, loc, ms, price);
    },
    copyVars: (v) => ({
      md: { ...v.md, bag: v.md.bag.slice() },
      sm: { ...v.sm, bag: v.sm.bag.slice() },
      levels: v.levels.map((lv) => (lv ? { tf: { ...lv.tf }, bar: { ...lv.bar }, cur: lv.cur } : null)),
    }),
    result(s, bars) {
      const n = bars.length;
      const last = n - 1;
      const v = s.vars;
      // the value of each level on the last bar (null: not calculated)
      const levelLast: (number | null)[] = LEVELS.map((k) => {
        if (s.pre) return s.pre[k - 1] ? s.pre[k - 1]![last] : null;
        return v.levels[k - 1] ? v.levels[k - 1]!.cur : null;
      });
      const plots: Record<string, PlotPoint[]> = {};
      LEVELS.forEach((k) => {
        const hidden = s.hidden[k - 1];
        // show_last = Size: only the last `Size` bars are drawn
        const from = n - cfg[`htf${k}Size`];
        const drawn = active[k - 1] && cfg[`htf${k}Show`];
        const cut = Math.min(n, Math.max(0, from));
        const points = drawn ? hidden.slice(0, cut).concat(s.shown[k - 1].slice(cut)) : hidden.slice();
        const lv = v.levels[k - 1];
        if (drawn && lv && n > 0) {
          // the last bar of the timeframe is still open: its chart bars show its value so far
          for (let j = Math.max(lv.tf.first, cut); j < n; j++) points[j] = point(k, bars[j].time, lv.cur);
        }
        plots[`plot${k - 1}`] = points;
      });
      const lines: LineDrawingData[] = [];
      const labels: LabelData[] = [];
      if (n > 0) lastBarDrawings(bars, cfg, v.md, v.sm, levelLast, lines, labels);
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots, lines, labels,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FibonacciAutoTrendScouterInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<FibonacciAutoTrendScouterInputs> = {}, chart?: ChartContext): IndicatorResult {
  return fullResult(createRun(inputs, chart).update(bars));
}

/** The drawings of the last bar: the original deletes and redraws its objects on every bar */
function lastBarDrawings(
  bars: Bar[],
  cfg: FibonacciAutoTrendScouterInputs,
  md: Track,
  sm: Track,
  levelLast: (number | null)[],
  lines: LineDrawingData[],
  labels: LabelData[],
): void {
  const n = bars.length;
  const last = n - 1;
  const unit = bars[0].time >= 1e12 ? 1 : 1000;
  const ms = (i: number) => bars[i].time * unit;
  const bar = bars[last];
  const now = ms(last);
  const candle = last > 0 ? now - ms(last - 1) : NaN;
  type LineOptions = Pick<LineDrawingData, 'color' | 'width' | 'style' | 'extend'>;
  // An object with an na coordinate is not drawn
  const addLine = (x1: number, y1: number, x2: number, y2: number, options: LineOptions) => {
    if ([x1, y1, x2, y2].every(Number.isFinite)) lines.push({ time1: x1 / unit, price1: y1, time2: x2 / unit, price2: y2, ...options });
  };
  const addLabel = (x: number, y: number, options: Omit<LabelData, 'time' | 'price'>) => {
    if (Number.isFinite(x) && Number.isFinite(y)) labels.push({ time: x / unit, price: y, ...options });
  };

  // Labels of the swing points
  const coordLabels = (t: Track, show: boolean, group: Group, type: number) => {
    let pos = gt(t.balls[0].y, t.balls[1].y) ? 1 : 2;
    t.balls.forEach((b, k) => {
      const id = k + 1;
      const above = pos === 1;
      pos = above ? 2 : 1;
      if (!show) return;
      const prev = k < 6 ? t.balls[k + 1] : { x: -1, y: -1 };
      const barsAfterPrev = (b.x - prev.x) / candle;
      const sign = gt(b.y, prev.y) ? '+ ' : '- ';
      const tooltip = ` ${group} ${str.tostring(id)} | $${str.tostring(b.y, '#.##')}`
        + `\n x: ${str.tostring(b.x)}\n y: ${str.tostring(b.y)}\n v: ${str.tostring(b.v)}`
        + '\n----------------------\n Time since last coord:'
        + `\n ${timeToString((b.x - prev.x) / 1000)}\n ${str.tostring(barsAfterPrev)} bars`
        + '\n----------------------\n Value diff to last coord:'
        + `\n ${sign}${str.tostring(Math.abs(b.y - prev.y), '#.##')}`
        + `\n ${sign}${str.tostring(Math.abs((b.y - prev.y) / prev.y) * 100, '#.###')} %`
        + '\n----------------------\n Change per bar: '
        + `\n ${sign}${str.tostring(Math.abs((b.y - prev.y) / barsAfterPrev), '#.##')}`
        + `\n ${sign}${str.tostring(Math.abs(((b.y - prev.y) / barsAfterPrev) / prev.y) * 100, '#.###')} %`
        + '\n-------------------------';
      addLabel(b.x, b.y, {
        yloc: above ? 'abovebar' : 'belowbar',
        color: CLEAR_BLACK,
        textColor: type > 1 ? (type === 2 ? BLUE : YELLOW) : WHITE,
        style: type === 1 ? 'label_down' : 'label_up',
        size: 'small',
        text: above ? `${str.tostring(id)}\n\u25BC` : `\u25B2\n${str.tostring(id)}`,
        tooltip,
      });
    });
  };
  coordLabels(sm, cfg.showSmCoordLabels, 'Short', 1);
  coordLabels(md, cfg.showMdCoordLabels, 'Long', 3);

  // Trend lines
  const useSrc = cfg.trendData === 'Source';
  const NA: Point = [NaN, NaN];
  const trendLine = (id: AnyTrend, from: Point, to: Point, lineColor: string) => {
    addLine(from[0], from[1], to[0], to[1], {
      extend: 'none', color: lineColor, style: dash(cfg[`${id}LineStyle`]), width: cfg[`${id}LineWidth`],
    });
  };
  const extension = (id: AnyTrend, from: Point, to: Point, lineColor: string) => {
    if (!cfg[`${id}LineExtend`]) return;
    addLine(from[0], from[1], to[0], to[1], {
      extend: 'right', color: lineColor, style: dash(cfg[`${id}XlineStyle`]), width: cfg[`${id}XlineWidth`],
    });
  };
  const trend = (id: Trend, t: Track, eye: [Ball, Ball]) => {
    const { topFrom, topTo, bottomFrom, bottomTo, up } = channel(t, id, cfg);
    const colourOf = (isUp: boolean) => (!cfg[`${id}UseColors`] ? cfg[`${id}ColorDefault`] : isUp ? cfg[`${id}ColorUp`] : cfg[`${id}ColorDn`]);
    const lineColor = colourOf(up);
    const own = t.ready;
    trendLine(id, own ? topFrom : NA, own ? topTo : NA, lineColor);
    extension(id, own ? topFrom : NA, own ? topTo : NA, lineColor);
    trendLine(id, own ? bottomFrom : NA, own ? bottomTo : NA, lineColor);
    // as the original: the start of the extended bottom line always waits for the long tracker
    extension(id, md.ready ? bottomFrom : NA, own ? bottomTo : NA, lineColor);
    // sight line: from the middle of two points through the close of the bar
    const show = cfg[`${id}ShowSight`];
    const eyeY = (eye[0].y + eye[1].y) / 2;
    addLine(show ? (eye[0].x + eye[1].x) / 2 : NaN, show ? eyeY : NaN, now, bar.close, {
      extend: 'right', color: colourOf(lt(eyeY, bar.close)), style: dash(cfg[`${id}SightStyle`]), width: cfg[`${id}SightWidth`],
    });
  };
  trend('s1', sm, [sm.balls[2], sm.balls[3]]);
  trend('s2', md, [md.balls[5], md.balls[4]]);

  // Custom lines between points of both trackers
  const custom = (show: boolean, top: boolean, fromGroup: Group, fromPair: Pair, toGroup: Group, toPair: Pair) => {
    const from = selection(fromGroup === 'Long' ? md : sm, top, fromPair, useSrc);
    const to = selection(toGroup === 'Long' ? md : sm, top, toPair, useSrc);
    const lineColor = !cfg.s3UseColors ? cfg.s3ColorDefault : gt(to[1], from[1]) ? cfg.s3ColorUp : cfg.s3ColorDn;
    const on = show && md.ready;
    trendLine('s3', on ? from : NA, on ? to : NA, lineColor);
    extension('s3', on ? from : NA, on ? to : NA, lineColor);
  };
  custom(cfg.s3ShowTop, true, cfg.s3TopFromGroup, cfg.s3TopFromPair, cfg.s3TopToGroup, cfg.s3TopToPair);
  custom(cfg.s3ShowBtm, false, cfg.s3BottomFromGroup, cfg.s3BottomFromPair, cfg.s3BottomToGroup, cfg.s3BottomToPair);

  // Fibonacci range of each tracker: source line and labels
  const kind = cfg.fibColorStyle === 'Kind';
  const source = (t: Track, name: string) => {
    const s = fibSource(t.balls);
    if (cfg.showFibSrcLine) {
      // drawFibSrcLine(dir, x1 = minX, y1 = minY, x2 = maxX, y2 = maxY)
      const highIsFirst = eq(Math.max(s.minY, s.maxY), s.minY);
      const lowIsFirst = eq(Math.min(s.minY, s.maxY), s.minY);
      const xH = highIsFirst ? s.minX : s.maxX;
      const yH = highIsFirst ? s.minY : s.maxY;
      const xL = lowIsFirst ? s.minX : s.maxX;
      const yL = lowIsFirst ? s.minY : s.maxY;
      const up = s.dir === 1;
      addLine(up ? xL : xH, up ? yL : yH, up ? xH : xL, up ? yH : yL, {
        extend: 'none', color: kind ? (up ? cfg.fibColorSupport : cfg.fibColorResistance) : cfg.fibColorDefault,
        style: 'dotted', width: 3,
      });
    }
    if (cfg.showFibSrcLabel) {
      const end = (high: boolean, x: number, y: number) => addLabel(x, y, {
        yloc: high ? 'abovebar' : 'belowbar',
        color: CLEAR_BLACK,
        textColor: kind ? (high ? cfg.fibColorResistance : cfg.fibColorSupport) : cfg.fibColorDefault,
        style: high ? 'label_down' : 'label_up',
        size: 'small',
        text: high ? 'H\n\u25BC' : '\u25B2\nL',
        tooltip: `${name} Fib ${high ? 'High' : 'Low'} \n$( ${str.tostring(y)} )`,
      });
      end(false, s.minX, s.minY);
      end(true, s.maxX, s.maxY);
    }
    return s.dir;
  };
  const mdDir = source(md, 'MD');
  const smDir = source(sm, 'SM');

  // Fibonacci levels: lines, then labels
  const RATIO_TEXT = ['0', '.236', '.382', '.5', '.618', '.768', '1'];
  const fibLevels = (t: Track, dir: number, long: boolean) => {
    const side: FibSide = long ? 'fibLong' : 'fibShort';
    const states = fibStates(t.fibs, dir, bar);
    const first = long ? 1 : 8;
    const nextUp = array.indexof(states, 2) + first;
    const nextDown = array.indexof(states, 3) + first;
    const far = cfg[`${side}Far`];
    const levelColour = (k: number, state: number) => {
      if (cfg.fibColorStyle === 'Multi') return cfg[`${long ? 'fibColor' : 'smFibColor'}${RATIOS[k]}`];
      if (cfg.fibColorStyle === 'Default') return long ? cfg.fibColorDefault : cfg.fibColorDefaultS;
      if (kind && (state === 1 || state === 2)) return cfg.fibColorResistance;
      if (kind && (state === 3 || state === 4)) return cfg.fibColorSupport;
      return cfg.fibColorDefault;
    };
    const isFar = (id: number) => (id >= nextUp && id <= nextUp + far) || (id >= nextDown - far && id <= nextDown);
    const left = now - candle * cfg.fibLongLeft;
    t.fibs.forEach((v, k) => {
      const state = states[k];
      const next = state === 2 || state === 3;
      const draw = isFar(first + k) || next;
      const from = long ? left : now - candle * cfg.fibShortLeft;
      const to = now + candle * cfg[`${side}Right`];
      addLine(draw ? from : NaN, v, draw ? to : NaN, v, {
        style: dash(next || state === 0 ? cfg[`${side}ActiveStyle`] : cfg[`${side}InactiveStyle`]),
        color: levelColour(k, state),
        width: next ? cfg[`${side}ActiveWidth`] : cfg[`${side}InactiveWidth`],
        extend: 'none',
      });
    });
    t.fibs.forEach((v, k) => {
      const state = states[k];
      const draw = (cfg.showFibFarLabels && isFar(first + k)) || state === 2 || state === 3;
      const order = str.tostring(k + 1);
      const details = cfg.showFibSrcLabelInfo === 'Ratio' ? RATIO_TEXT[k] : cfg.showFibSrcLabelInfo === 'Order' ? order : '';
      addLabel(draw ? (long ? left : now + candle * cfg.fibShortRight) : NaN, v, {
        text: `${dir === -1 ? '\u25B2 ' : '\u25BC '}${details}${cfg.showFibLabelsGroup ? (long ? ' L' : ' S') : ''}`,
        color: CLEAR_WHITE,
        style: long ? 'label_right' : 'label_left',
        textColor: levelColour(k, state),
        size: 'normal',
        textAlign: long ? 'right' : 'left',
        tooltip: `${long ? 'Long' : 'Short'} TF [ ${order} ]\nRatio: ${RATIO_TEXT[k]}\nPrice: $${str.tostring(Math.trunc(v))}`,
      });
    });
  };
  fibLevels(md, mdDir, true);
  fibLevels(sm, smDir, false);

  // Labels of the levels of other timeframes, 2 bars after the last bar
  LEVELS.forEach((k) => {
    const value = levelLast[k - 1];
    if (!cfg[`htf${k}Label`] || value === null) return;
    const txt = timeframeToString(cfg[`htf${k}Timeframe`]);
    addLabel(now + candle * 2, value, {
      color: CLEAR_BLACK,
      textColor: cfg[`htf${k}Color`],
      style: 'label_left',
      size: 'normal',
      text: `\u140A ${txt}`,
      tooltip: `HTF  [ ${txt} ] ${str.tostring(value, '#.##')}`,
    });
  });
}


export const FibonacciAutoTrendScouter = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
