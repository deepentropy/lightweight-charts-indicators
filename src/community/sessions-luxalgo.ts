/**
 * Sessions [LuxAlgo]
 *
 * Four trading sessions (New York, London, Tokyo, Sydney by default), each with its own hours. The session hours are
 * read in a fixed UTC offset (input "UTC (+/-)"). For each session, on the bars inside it:
 * - Range: a box from the first to the last bar of the session, from the session high to the session low, with the
 *   session name above it
 * - Trendline: the linear regression line of the closes of the session
 * - Mean: the running average of the closes of the session
 * - VWAP: the running volume weighted average of the closes of the session (a plot)
 * - Max/Min: the high and the low of the last finished session, drawn until the next session starts (two plots)
 * A dashboard table shows each session as Active / Inactive, and with the advanced option the correlation of the
 * regression (trend), the cumulative volume and the standard deviation of the closes. Session dividers mark the bars
 * of each session along the bottom of the chart. Day dividers draw a dashed vertical line and the weekday name when a
 * new day starts.
 *
 * Limits of the port:
 * - "Use Exchange Timezone" needs the exchange time zone of the symbol, which the bars do not carry: the port throws
 *   an Error when it is switched on.
 * - The day dividers use the day of the week in the exchange time zone in the original. The port uses the UTC day:
 *   equal on UTC symbols and on symbols whose trading day is inside one UTC day (e.g. US stocks).
 * - The day divider is a vertical line through close + tick and close - tick (extended both ways). The bars carry
 *   no price tick: the port uses a tick of 0.01. The line drawn is the same.
 *
 * Reference: "Sessions [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import { color, str, time as pineTime, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, LineDrawingData, BoxData, LabelData, TableData, TableCellData, TableMergeData, PineSize } from '../types';

export interface SessionsLuxalgoInputs {
  showSessionA: boolean;
  sessionAName: string;
  sessionATime: string;
  sessionARange: boolean;
  sessionATrendline: boolean;
  sessionAMean: boolean;
  sessionAVwap: boolean;
  sessionAMaxMin: boolean;
  showSessionB: boolean;
  sessionBName: string;
  sessionBTime: string;
  sessionBRange: boolean;
  sessionBTrendline: boolean;
  sessionBMean: boolean;
  sessionBVwap: boolean;
  sessionBMaxMin: boolean;
  showSessionC: boolean;
  sessionCName: string;
  sessionCTime: string;
  sessionCRange: boolean;
  sessionCTrendline: boolean;
  sessionCMean: boolean;
  sessionCVwap: boolean;
  sessionCMaxMin: boolean;
  showSessionD: boolean;
  sessionDName: string;
  sessionDTime: string;
  sessionDRange: boolean;
  sessionDTrendline: boolean;
  sessionDMean: boolean;
  sessionDVwap: boolean;
  sessionDMaxMin: boolean;
  /** Fixed UTC offset (hours) of the session times */
  timezoneOffset: number;
  /** Not available in the port (throws) */
  useExchangeTimezone: boolean;
  rangeTransparency: number;
  showRangeOutline: boolean;
  showRangeLabel: boolean;
  sessionAColor: string;
  sessionBColor: string;
  sessionCColor: string;
  sessionDColor: string;
  dashboard: boolean;
  advancedDashboard: boolean;
  dashboardPosition: 'Top Right' | 'Bottom Right' | 'Bottom Left';
  dashboardSize: 'Tiny' | 'Small' | 'Normal' | 'Large' | 'Huge';
  showSessionDivider: boolean;
  showDayDivider: boolean;
}

export const defaultInputs: SessionsLuxalgoInputs = {
  showSessionA: true,
  sessionAName: 'New York',
  sessionATime: '1300-2200',
  sessionARange: true,
  sessionATrendline: false,
  sessionAMean: false,
  sessionAVwap: false,
  sessionAMaxMin: false,
  showSessionB: true,
  sessionBName: 'London',
  sessionBTime: '0700-1600',
  sessionBRange: true,
  sessionBTrendline: false,
  sessionBMean: false,
  sessionBVwap: false,
  sessionBMaxMin: false,
  showSessionC: true,
  sessionCName: 'Tokyo',
  sessionCTime: '0000-0900',
  sessionCRange: true,
  sessionCTrendline: false,
  sessionCMean: false,
  sessionCVwap: false,
  sessionCMaxMin: false,
  showSessionD: true,
  sessionDName: 'Sydney',
  sessionDTime: '2100-0600',
  sessionDRange: true,
  sessionDTrendline: false,
  sessionDMean: false,
  sessionDVwap: false,
  sessionDMaxMin: false,
  timezoneOffset: 0,
  useExchangeTimezone: false,
  rangeTransparency: 90,
  showRangeOutline: true,
  showRangeLabel: true,
  sessionAColor: '#ff5d00',
  sessionBColor: '#2157f3',
  sessionCColor: '#e91e63',
  sessionDColor: '#ffeb3b',
  dashboard: false,
  advancedDashboard: false,
  dashboardPosition: 'Top Right',
  dashboardSize: 'Small',
  showSessionDivider: false,
  showDayDivider: true,
};

const SESSION_DEFAULTS: Array<[string, string, string]> = [
  ['A', 'New York', '1300-2200'],
  ['B', 'London', '0700-1600'],
  ['C', 'Tokyo', '0000-0900'],
  ['D', 'Sydney', '2100-0600'],
];

const sessionInputs = ([k, name, hours]: [string, string, string]): InputConfig[] => {
  const group = `Session ${k}`;
  const overlays = `session${k}Overlays`;
  return [
    { id: `showSession${k}`, type: 'bool', title: 'Enable', defval: true, group, inline: `session${k}`,
      tooltip: 'Enable or disable this session and all of its optional displays.' },
    { id: `session${k}Name`, type: 'string', title: 'Name', defval: name, group, inline: `session${k}`,
      tooltip: 'Set the name displayed for this session.' },
    { id: `session${k}Time`, type: 'session', title: 'Hours', defval: hours, group,
      tooltip: "Set the session's start and end times." },
    { id: `session${k}Range`, type: 'bool', title: 'Range', defval: true, group, inline: overlays,
      tooltip: 'Draw a box around the high-to-low range formed during the session.' },
    { id: `session${k}Trendline`, type: 'bool', title: 'Trendline', defval: false, group, inline: overlays,
      tooltip: 'Draw a linear-regression trendline during the session.' },
    { id: `session${k}Mean`, type: 'bool', title: 'Mean', defval: false, group, inline: overlays,
      tooltip: 'Draw the running arithmetic mean during the session.' },
    { id: `session${k}Vwap`, type: 'bool', title: 'VWAP', defval: false, group, inline: overlays,
      tooltip: 'Plot the running volume-weighted average price during the session.' },
    { id: `session${k}MaxMin`, type: 'bool', title: 'Max/Min', defval: false, group, inline: overlays,
      tooltip: "Extend the completed session's maximum and minimum until the next session begins." },
  ];
};

const COLOR_TOOLTIP = "Select the color used for this session's visuals.";

export const inputConfig: InputConfig[] = [
  ...SESSION_DEFAULTS.flatMap(sessionInputs),
  { id: 'timezoneOffset', type: 'int', title: 'UTC (+/-)', defval: 0, min: -12, max: 14, group: 'Timezone',
    tooltip: 'Set the fixed UTC offset used to interpret all session times.' },
  { id: 'useExchangeTimezone', type: 'bool', title: 'Use Exchange Timezone', defval: false, group: 'Timezone',
    tooltip: "Use the symbol's exchange timezone instead of the fixed UTC offset." },
  { id: 'rangeTransparency', type: 'int', title: 'Range Area Transparency', defval: 90, min: 0, max: 100,
    group: 'Ranges Settings', tooltip: 'Set the transparency of session range boxes from 0 (opaque) to 100 (invisible).' },
  { id: 'showRangeOutline', type: 'bool', title: 'Range Outline', defval: true, group: 'Ranges Settings',
    tooltip: 'Show a dotted outline around each session range box.' },
  { id: 'showRangeLabel', type: 'bool', title: 'Range Label', defval: true, group: 'Ranges Settings',
    tooltip: 'Show the session name above each range box.' },
  { id: 'sessionAColor', type: 'color', title: 'New York', defval: '#ff5d00', group: 'Style', inline: 'sessionColors',
    tooltip: COLOR_TOOLTIP },
  { id: 'sessionBColor', type: 'color', title: 'London', defval: '#2157f3', group: 'Style', inline: 'sessionColors',
    tooltip: COLOR_TOOLTIP },
  { id: 'sessionCColor', type: 'color', title: 'Tokyo', defval: '#e91e63', group: 'Style', inline: 'sessionColors2',
    tooltip: COLOR_TOOLTIP },
  { id: 'sessionDColor', type: 'color', title: 'Sydney', defval: '#ffeb3b', group: 'Style', inline: 'sessionColors2',
    tooltip: COLOR_TOOLTIP },
  { id: 'dashboard', type: 'bool', title: 'Dashboard', defval: false, group: 'Dashboard',
    tooltip: 'Enable or disable the dashboard.' },
  { id: 'advancedDashboard', type: 'bool', title: 'Advanced', defval: false, group: 'Dashboard',
    tooltip: 'Add trend, cumulative volume, and volatility statistics to the dashboard.' },
  { id: 'dashboardPosition', type: 'string', title: 'Position', defval: 'Top Right',
    options: ['Top Right', 'Bottom Right', 'Bottom Left'], group: 'Dashboard', tooltip: 'Select the dashboard location.' },
  { id: 'dashboardSize', type: 'string', title: 'Size', defval: 'Small',
    options: ['Tiny', 'Small', 'Normal', 'Large', 'Huge'], group: 'Dashboard', tooltip: 'Select the dashboard text size.' },
  { id: 'showSessionDivider', type: 'bool', title: 'Show Sessions Divider', defval: false, group: 'Dividers',
    tooltip: 'Mark active session bars and session boundaries along the bottom of the chart.' },
  { id: 'showDayDivider', type: 'bool', title: 'Show Daily Divider', defval: true, group: 'Dividers',
    tooltip: 'Draw a dashed divider and weekday label when a new day begins.' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Session A Maximum', color: '#ff5d00', lineWidth: 1, style: 'linebr' },
  { id: 'plot1', title: 'Session A Minimum', color: '#ff5d00', lineWidth: 1, style: 'linebr' },
  { id: 'plot2', title: 'Session B Maximum', color: '#2157f3', lineWidth: 1, style: 'linebr' },
  { id: 'plot3', title: 'Session B Minimum', color: '#2157f3', lineWidth: 1, style: 'linebr' },
  { id: 'plot4', title: 'Session C Maximum', color: '#e91e63', lineWidth: 1, style: 'linebr' },
  { id: 'plot5', title: 'Session C Minimum', color: '#e91e63', lineWidth: 1, style: 'linebr' },
  { id: 'plot6', title: 'Session D Maximum', color: '#ffeb3b', lineWidth: 1, style: 'linebr' },
  { id: 'plot7', title: 'Session D Minimum', color: '#ffeb3b', lineWidth: 1, style: 'linebr' },
  { id: 'plot8', title: 'Session A VWAP', color: '#ff5d00', lineWidth: 1, style: 'linebr' },
  { id: 'plot9', title: 'Session B VWAP', color: '#2157f3', lineWidth: 1, style: 'linebr' },
  { id: 'plot10', title: 'Session C VWAP', color: '#e91e63', lineWidth: 1, style: 'linebr' },
  { id: 'plot11', title: 'Session D VWAP', color: '#ffeb3b', lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'Sessions [LuxAlgo]',
  shortTitle: 'LuxAlgo - Sessions',
  overlay: true,
};

const BULL_COLOR = '#089981';
const BEAR_COLOR = '#f23645';
const DATA = '#DBDBDB';
const HEADERS = '#808080';
const BACKGROUND = '#161616';
const BORDERS = '#2E2E2E';
const GRAY = '#787B86';
/** max_lines_count / max_boxes_count / max_labels_count of the script */
const MAX_OBJECTS = 500;
/** syminfo.mintick is not available to the port (Bar has no symbol info) */
const MINTICK = 0.01;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const POSITIONS = { 'Top Right': 'top_right', 'Bottom Right': 'bottom_right', 'Bottom Left': 'bottom_left' } as const;

/**
 * Live drawings of one kind, in creation order. Pine keeps at most max objects: a creation that brings the count
 * above max + 5 deletes the oldest until max remain. An object that a `var` variable of the script still refers to is
 * not deleted (measured on the original platform): the box, the label and the lines of the current session of each
 * session stay, however old they are.
 */
class Live<T extends object> {
  items: T[] = [];
  private held = new Map<string, T>();
  add(o: T): T {
    this.items.push(o);
    if (this.items.length > MAX_OBJECTS + 5) {
      const kept = new Set(this.held.values());
      let excess = this.items.length - MAX_OBJECTS;
      this.items = this.items.filter((x) => kept.has(x) || excess-- <= 0);
    }
    return o;
  }
  /** The `var` variable `name` now refers to `o` (the object it referred to before can be deleted) */
  hold(name: string, o: T): T {
    this.held.set(name, o);
    return o;
  }
}

type Point = { time: number; value: number; color?: string };

/** State of getSessionLinearRegression() */
interface Regression {
  length: number;
  cumW: number;
  cum: number;
  cumSq: number;
  first: number;
  last: number;
  deviation: number;
  correlation: number;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<SessionsLuxalgoInputs> = {},
): Omit<IndicatorResult, 'markers'> & {
  markers: MarkerData[]; lines: LineDrawingData[]; boxes: BoxData[]; labels: LabelData[]; tables: TableData[];
} {
  const cfg = { ...defaultInputs, ...inputs };
  if (cfg.useExchangeTimezone) {
    throw new Error('Sessions [LuxAlgo]: "Use Exchange Timezone" needs the exchange time zone of the symbol, '
      + 'which the bars do not carry. Set the UTC offset instead.');
  }
  const n = bars.length;
  const offset = Math.trunc(cfg.timezoneOffset);
  // str.format("UTC{0}{1}", timezoneOffsetInput >= 0 ? "+" : "-", math.abs(timezoneOffsetInput))
  const tz = `UTC${offset >= 0 ? '+' : '-'}${Math.abs(offset)}`;
  const inMs = n > 0 && bars[0].time >= 1e12;
  const ms = (t: number) => (inMs ? t : t * 1000);
  const transparency = Math.trunc(cfg.rangeTransparency);

  const keys = ['A', 'B', 'C', 'D'] as const;
  const c = cfg as unknown as Record<string, boolean | string | number>;
  const sessions = keys.map((k) => ({
    show: c[`showSession${k}`] as boolean,
    name: c[`session${k}Name`] as string,
    hours: c[`session${k}Time`] as string,
    range: c[`session${k}Range`] as boolean,
    trendline: c[`session${k}Trendline`] as boolean,
    mean: c[`session${k}Mean`] as boolean,
    vwap: c[`session${k}Vwap`] as boolean,
    maxMin: c[`session${k}MaxMin`] as boolean,
    color: c[`session${k}Color`] as string,
    // state of getSessionRange()
    startTime: 0,
    high: NaN,
    low: NaN,
    box: null as BoxData | null,
    label: null as LabelData | null,
    // var sessionXMaximum / sessionXMinimum, sessionXVwap
    maximum: NaN,
    minimum: NaN,
    vwapValue: NaN,
    // state of getSessionLinearRegression()
    reg: { length: 0, cumW: NaN, cum: NaN, cumSq: NaN, first: NaN, last: NaN, deviation: NaN, correlation: NaN } as Regression,
    // state of getSessionAverage()
    avgLength: 0,
    avgCum: NaN,
    // state of getSessionVwap()
    numerator: NaN,
    denominator: NaN,
    // var line lineId of the two setSessionLine() call sites
    trendLine: null as LineDrawingData | null,
    meanLine: null as LineDrawingData | null,
    prevActive: false,
  }));

  const lines = new Live<LineDrawingData>();
  const boxes = new Live<BoxData>();
  const labels = new Live<LabelData>();
  const markers: MarkerData[] = [];
  const plots: Record<string, Point[]> = {};
  for (let k = 0; k < 12; k++) plots[`plot${k}`] = [];

  // Dashboard: var table dashboardTable = table.new(...), made on the first bar whatever the dashboard input
  const advanced = cfg.dashboard && cfg.advancedDashboard;
  const columnCount = cfg.advancedDashboard ? 5 : 2;
  const lastColumn = columnCount - 1;
  const textSize = cfg.dashboardSize.toLowerCase() as PineSize;
  const cells = new Map<string, TableCellData>();
  const merges: TableMergeData[] = [];
  const cell = (column: number, row: number, text: string, textColor: string = DATA,
    alignment: 'left' | 'center' | 'right' = 'right', background?: string, height = 0) => {
    // table.cell() outside the table is a Pine runtime error; the script never does it
    const data: TableCellData = { column, row, text, textColor, textSize, textHAlign: alignment };
    if (background !== undefined) data.bgColor = background;
    if (height !== 0) data.height = height;
    cells.set(`${column}:${row}`, data);
  };
  const merge = (startColumn: number, startRow: number, endColumn: number, endRow: number) => {
    merges.push({ startColumn, startRow, endColumn, endRow });
  };

  /** setSessionLine(): one line per session, from its first bar to the current bar */
  const setSessionLine = (site: string, current: LineDrawingData | null, started: boolean, active: boolean, i: number,
    firstValue: number, lastValue: number, col: string): LineDrawingData | null => {
    const t = bars[i].time;
    if (started) {
      return lines.hold(site, lines.add({ time1: t, price1: firstValue, time2: t, price2: lastValue, color: col }));
    }
    if (active && current) {
      current.price1 = firstValue;
      current.time2 = t;
      current.price2 = lastValue;
    }
    return current;
  };

  let prevDay = NaN;
  for (let i = 0; i < n; i++) {
    const bar = bars[i];
    const t = bar.time;
    const tMs = ms(t);
    const { close, high, low } = bar;
    const volume = bar.volume ?? NaN;
    const first = i === 0;
    const last = i === n - 1;

    // sessionXActive = not na(time(timeframe.period, sessionXTimeInput, sessionTimezone))
    const active = sessions.map((s) => pineTime.inSession(tMs, s.hours, tz));
    const started = sessions.map((s, k) => active[k] && !s.prevActive);

    if (first && cfg.dashboard) {
      merge(0, 0, lastColumn, 0);
      cell(0, 0, 'Sessions [LuxAlgo]', DATA, 'center');
      // divider()
      merge(0, 1, lastColumn, 1);
      cell(0, 1, '━━━━━━━━━━━━━━', BORDERS, 'center', undefined, 0.5);
      cell(0, 2, 'Session', HEADERS, 'left');
      cell(1, 2, 'Status', HEADERS);
      if (cfg.advancedDashboard) {
        cell(2, 2, 'Trend', HEADERS);
        cell(3, 2, 'Volume', HEADERS);
        cell(4, 2, 'σ', HEADERS);
      }
      sessions.forEach((s, k) => cell(0, 3 + k, s.name, s.color, 'left'));
    }
    if (last && cfg.dashboard) {
      sessions.forEach((s, k) => {
        const status = s.show ? (active[k] ? 'Active' : 'Inactive') : 'Disabled';
        const statusColor = s.show ? (active[k] ? BULL_COLOR : BEAR_COLOR) : HEADERS;
        cell(1, 3 + k, status, DATA, 'right', statusColor);
      });
    }

    // Session ranges: getSessionRange()
    sessions.forEach((s, k) => {
      if (!(s.show && (s.range || s.maxMin))) return;
      if (started[k]) {
        s.startTime = tMs;
        s.high = high;
        s.low = low;
        if (s.range) {
          s.box = boxes.hold(`box${k}`, boxes.add({
            time1: t, price1: s.high, time2: t, price2: s.low,
            bgColor: String(color.new(s.color, transparency)),
            borderColor: cfg.showRangeOutline ? s.color : 'transparent', borderStyle: 'dotted',
          }));
          if (cfg.showRangeLabel) {
            s.label = labels.hold(`label${k}`, labels.add({
              time: t, price: s.high, text: s.name, textColor: s.color, style: 'label_down', color: '#00000000',
              size: 'tiny',
            }));
          }
        }
      } else if (active[k]) {
        s.high = Math.max(high, s.high);
        s.low = Math.min(low, s.low);
        if (s.range && s.box) {
          s.box.price1 = s.high;
          s.box.time2 = t;
          s.box.price2 = s.low;
          if (cfg.showRangeLabel && s.label) {
            // set_xy(int(math.avg(sessionStartTime, time)), sessionHigh), a time (xloc.bar_time)
            const mid = Math.trunc((s.startTime + tMs) / 2);
            s.label.time = inMs ? mid : mid / 1000;
            s.label.price = s.high;
          }
        }
      }
      s.maximum = active[k] ? NaN : s.high;
      s.minimum = active[k] ? NaN : s.low;
    });

    // Trendlines and dashboard statistics: getSessionLinearRegression()
    sessions.forEach((s, k) => {
      if (!(s.show && (s.trendline || advanced))) return;
      const r = s.reg;
      if (started[k]) {
        r.length = 1;
        r.cumW = close;
        r.cum = close;
        r.cumSq = close * close;
        r.first = close;
        r.last = close;
        r.deviation = 0.0;
        r.correlation = NaN;
      } else if (active[k]) {
        r.length += 1;
        r.cum += close;
        r.cumSq += close * close;
        r.cumW += close * r.length;
        const average = r.cum / r.length;
        const weightedAverage = r.cumW / ((r.length * (r.length + 1)) / 2.0);
        const covariance = ((weightedAverage - average) * (r.length + 1)) / 2.0;
        const variance = Math.max(r.cumSq / r.length - average * average, 0.0);
        const denominator = Math.sqrt(variance) * (Math.sqrt(r.length * r.length - 1.0) / (2.0 * Math.sqrt(3.0)));
        r.deviation = Math.sqrt(variance);
        // correlationDenominator != 0.0 (Pine: equal within 1e-10; na is not different)
        r.correlation = Math.abs(denominator) > 1e-10 ? covariance / denominator : NaN;
        r.first = 4.0 * average - 3.0 * weightedAverage;
        r.last = 3.0 * weightedAverage - 2.0 * average;
      }
      if (advanced) {
        const corr = Number.isFinite(r.correlation) ? r.correlation : NaN;
        const trendColor = Number.isNaN(corr) ? undefined : corr >= -1e-10 ? BULL_COLOR : BEAR_COLOR;
        cell(2, 3 + k, str.tostring(corr, '#.##'), DATA, 'right', trendColor);
        cell(4, 3 + k, str.tostring(r.deviation, '#.####'), DATA);
      }
      if (s.trendline) s.trendLine = setSessionLine(`trend${k}`, s.trendLine, started[k], active[k], i, r.first, r.last, s.color);
    });

    // Session means: getSessionAverage()
    sessions.forEach((s, k) => {
      if (!(s.show && s.mean)) return;
      let average: number;
      if (started[k]) {
        s.avgLength = 1;
        s.avgCum = close;
        average = close;
      } else if (active[k]) {
        s.avgLength += 1;
        s.avgCum += close;
        average = s.avgCum / s.avgLength;
      } else {
        average = NaN;
      }
      s.meanLine = setSessionLine(`mean${k}`, s.meanLine, started[k], active[k], i, average, average, s.color);
    });

    // Session VWAPs: getSessionVwap()
    sessions.forEach((s, k) => {
      if (!(s.show && (s.vwap || advanced))) return;
      if (started[k]) {
        s.numerator = close * volume;
        s.denominator = volume;
      } else if (active[k]) {
        s.numerator += close * volume;
        s.denominator += volume;
      } else {
        s.numerator = NaN;
      }
      if (s.vwap) {
        // denominator != 0.0 ? numerator / denominator : na
        s.vwapValue = Math.abs(s.denominator) > 1e-10 ? s.numerator / s.denominator : NaN;
      }
      if (advanced) cell(3, 3 + k, str.tostring(s.denominator, 'volume'), DATA);
    });

    // Session plots
    sessions.forEach((s, k) => {
      const on = s.show && s.maxMin;
      plots[`plot${2 * k}`].push({ time: t, value: on ? s.maximum : NaN, color: s.color });
      plots[`plot${2 * k + 1}`].push({ time: t, value: on ? s.minimum : NaN, color: s.color });
      const v = s.vwap ? s.vwapValue : NaN;
      plots[`plot${8 + k}`].push({ time: t, value: Number.isFinite(v) ? v : NaN, color: s.color });
    });

    // Session dividers
    if (cfg.showSessionDivider) {
      sessions.forEach((s, k) => {
        if (!s.show) return;
        // Active: shape.square for sessions A and C, shape.labelup for B and D; the shape has no colour (na)
        if (active[k]) {
          markers.push({
            time: t, position: 'bottom', shape: k % 2 === 0 ? 'square' : 'labelUp', color: 'transparent', text: '.',
            textColor: s.color, size: 'tiny',
          });
        }
        if (active[k] !== s.prevActive) {
          markers.push({
            time: t, position: 'bottom', shape: 'labelUp', color: 'transparent', text: '❚', textColor: s.color,
            size: 'tiny',
          });
        }
      });
    }

    // Daily dividers: newDay = currentDay != currentDay[1] (false on the first bar)
    const day = pineTime.dayofweek(tMs, 'UTC');
    const newDay = !first && day !== prevDay;
    if (newDay && cfg.showDayDivider) {
      lines.add({
        time1: t, price1: close + MINTICK, time2: t, price2: close - MINTICK, color: GRAY, extend: 'both',
        style: 'dashed',
      });
      markers.push({
        time: t, position: 'top', shape: 'labelDown', color: 'transparent', text: WEEKDAYS[day - 1], textColor: GRAY,
        size: 'tiny',
      });
    }
    prevDay = day;
    sessions.forEach((s, k) => { s.prevActive = active[k]; });
  }

  const tables: TableData[] = n === 0 ? [] : [{
    position: POSITIONS[cfg.dashboardPosition] ?? 'top_right',
    columns: columnCount,
    rows: 7,
    cells: [...cells.values()],
    ...(merges.length > 0 ? { merges } : {}),
    bgColor: BACKGROUND,
    borderWidth: 0,
    frameColor: BORDERS,
    frameWidth: 1,
    forceOverlay: true,
  }];

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    markers,
    lines: lines.items,
    boxes: boxes.items,
    labels: labels.items,
    tables,
  };
}

export const SessionsLuxalgo = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
