/**
 * ICT Sessions [Killzones]
 *
 * Draws four intraday sessions ("killzones": London Open, New York Open, Asian Range and London Close) as boxes
 * around the daily high and low of the symbol. Each session has four lines: the daily high plus a margin, the
 * daily high, the daily low and the daily low minus a margin (margin = daily range x 1 % x "Box Height"). The
 * lines are transparent; the fills between them make the boxes (a high box, a middle fill and a low box). The daily
 * high and low are also drawn as circles ("Show High / Low").
 *
 * A bar is in a session when its time is in the session string, in the exchange time zone (PineScript
 * `time(period, session) != 0`; na outside the session). In this version 2 script a session without days covers
 * Monday to Friday only. The daily high and low come from
 * `security(tickerid, 'D', high / low)` of this version 2 script: every chart bar of a day shows the high and low of
 * that whole day (the last day shows its values so far). A value of 0 or na is not drawn (`ph ? ph : na`).
 *
 * Chart context (optional third argument of calculate): the exchange time zone (`timezone`) places the sessions,
 * and with the session of the symbol (`session`) the days follow the exchange calendar (src/anchor-period.ts).
 * Without it the port uses UTC and the UTC days of the bars. On a chart timeframe above one day the daily values
 * need bars that the chart does not carry: the port throws an Error.
 *
 * Reference: "ICT Sessions [Killzones]" by leonsholo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Created By BryceWH, modified by @leonsholo, adapted from Chris Moody's original indicator HLOC
 */

import {
  color, timeframe, mapToChart, barInterval, time as pineTime,
  type IndicatorResult, type InputConfig, type PlotConfig, type FillConfig, type Bar,
} from 'oakscriptjs';
import { chartTimeframe, higherTimeframeBars } from '../anchor-period';
import { timezoneOf, type ChartContext } from '../chart-context';

export interface IctSessionsInputs {
  /** Show High / Low */
  shl: boolean;
  /** KillZone London Open */
  londonkz: string;
  /** KillZone NY Open */
  newyorkkz: string;
  /** KillZone Asian Range */
  asiakz: string;
  /** KillZone London Close */
  londonckz: string;
  /** Box Height (% of the daily range) */
  boxheight: number;
  /** Fill Middle */
  fillcheck: boolean;
}

export const defaultInputs: IctSessionsInputs = {
  shl: true,
  londonkz: '0100-0500',
  newyorkkz: '0700-1000',
  asiakz: '2015-0000',
  londonckz: '1000-1200',
  boxheight: 2.0,
  fillcheck: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'shl', type: 'bool', title: 'Show High / Low', defval: true },
  { id: 'londonkz', type: 'session', title: 'KillZone London Open', defval: '0100-0500' },
  { id: 'newyorkkz', type: 'session', title: 'KillZone NY Open', defval: '0700-1000' },
  { id: 'asiakz', type: 'session', title: 'KillZone Asian Range', defval: '2015-0000' },
  { id: 'londonckz', type: 'session', title: 'KillZone London Close', defval: '1000-1200' },
  { id: 'boxheight', type: 'float', title: 'Box Height', defval: 2.0 },
  { id: 'fillcheck', type: 'bool', title: 'Fill Middle', defval: true },
];

// Plot colour of the version 2 constant gray with the default plot transparency of that version (35)
const GRAY = String(color.new('#808080', 35));

/** Plot titles of each session, in the order of the original (the titles repeat as in the original) */
const SESSIONS: Array<{ input: keyof IctSessionsInputs; titles: string[] }> = [
  { input: 'londonkz', titles: ['London Killzone High', 'London KillzoneLow', 'London Killzone High', 'London Killzone Low'] },
  { input: 'newyorkkz', titles: ['New York Killzone High', 'New York Killzone Low', 'New York Killzone High', 'New York Killzone Low'] },
  { input: 'asiakz', titles: ['Asia Zone High', 'Asia Zone Low', 'Asia Zone High', 'Asia Zone Low'] },
  { input: 'londonckz', titles: ['London Close High', 'London Close Low', 'London Close High', 'London Close Low'] },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Daily High', color: GRAY, lineWidth: 2, style: 'circles' },
  { id: 'plot1', title: 'Daily Low', color: GRAY, lineWidth: 2, style: 'circles' },
  // color = na: the session lines are not drawn, only their fills
  ...SESSIONS.flatMap((s, g) => s.titles.map((title, k) => ({
    id: `plot${2 + g * 4 + k}`, title, color: 'transparent', lineWidth: 2, style: 'linebr' as const,
  }))),
];

/** Fill titles of each session: high box, middle, low box */
const FILL_TITLES = [
  ['London High Box', 'London Fill Middle', 'London Low Box'],
  ['New York High Box', 'NewYork Fill Middle', 'New York Low Box'],
  ['Asia High Box', 'Asia Fill Middle', 'Asia Low Box'],
  ['London Close High Box', 'London Close Fill Middle', 'London Close Low Box'],
];

const YELLOW = '#E1BC29';
const GREEN = '#3BB273';
const WHITE = '#FFFFFF';

/**
 * Fill colours (colourcheck = 1): London boxes lineColour (#E1BC29, transp 25), London middle lineColour4
 * (#E1BC29 with Fill Middle, else white; transp 75); the other sessions: boxes lineColour2 (#3BB273, transp 25),
 * middle lineColour3 (#3BB273 with Fill Middle, else white; transp 85).
 */
function fillColors(fillcheck: boolean): string[][] {
  return SESSIONS.map((_s, g) => {
    const box = g === 0 ? YELLOW : GREEN;
    const middle = fillcheck ? box : WHITE;
    return [String(color.new(box, 25)), String(color.new(middle, g === 0 ? 75 : 85)), String(color.new(box, 25))];
  });
}

/** Plot pairs of the fills of session g: fill(high, high2), fill(high, low), fill(low, low2) */
const fillPairs = (g: number): Array<[string, string]> => {
  const p = (k: number) => `plot${2 + g * 4 + k}`;
  return g === 0 ? [[p(1), p(0)], [p(1), p(2)], [p(2), p(3)]] : [[p(0), p(1)], [p(1), p(2)], [p(2), p(3)]];
};

export const fillConfig: FillConfig[] = fillColors(true).flatMap((cols, g) => fillPairs(g).map(([plot1, plot2], k) => ({
  id: `fill${g * 3 + k}`, plot1, plot2, color: cols[k], palette: [cols[k]], title: FILL_TITLES[g][k],
})));

export const metadata = {
  title: 'ICT Killzone',
  shortTitle: 'ICT Killzone',
  overlay: true,
};

/**
 * security(tickerid, 'D', high) and low of this version 2 script: every chart bar of a day shows the value of that
 * whole day. On a daily chart it is the chart series itself.
 */
function dailyHighLow(bars: Bar[], chart?: ChartContext): { ph: number[]; pl: number[] } {
  const chartTf = chartTimeframe(bars, chart);
  const day = timeframe.in_seconds('D');
  if (chartTf === '' || timeframe.in_seconds(chartTf) === day) {
    return { ph: bars.map((b) => b.high), pl: bars.map((b) => b.low) };
  }
  if (timeframe.in_seconds(chartTf) > day) {
    throw new Error(`ICT Sessions: the daily high and low need daily bars, and the chart timeframe "${chartTf}" is above one day.`);
  }
  const { htf, group } = higherTimeframeBars(bars, 'D', chart);
  return {
    ph: mapToChart(htf.map((b) => b.high), group, [], true, false),
    pl: mapToChart(htf.map((b) => b.low), group, [], true, false),
  };
}

export function calculate(bars: Bar[], inputs: Partial<IctSessionsInputs> = {}, chart?: ChartContext): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const tz = timezoneOf(chart);
  const ms = chart?.timeUnit === 'ms' || (chart?.timeUnit === undefined && n > 0 && bars[0].time >= 1e12);
  const barMs = n > 1 ? barInterval(bars) * (ms ? 1 : 1000) : undefined;
  const { ph, pl } = n > 0 ? dailyHighLow(bars, chart) : { ph: [], pl: [] };

  // a number as a condition: na and 0 are false
  const truthy = (x: number) => !Number.isNaN(x) && x !== 0;
  const plots: Record<string, Array<{ time: number; value: number }>> = {};
  const series = (f: (i: number) => number) => bars.map((b, i) => ({ time: b.time, value: f(i) }));

  plots.plot0 = series((i) => (cfg.shl && truthy(ph[i]) ? ph[i] : NaN));
  plots.plot1 = series((i) => (cfg.shl && truthy(pl[i]) ? pl[i] : NaN));

  const high2 = ph.map((h, i) => h + (h - pl[i]) * 0.01 * cfg.boxheight);
  const low2 = pl.map((l, i) => l - (ph[i] - l) * 0.01 * cfg.boxheight);
  SESSIONS.forEach((s, g) => {
    // BarInSession(sess) => time(period, sess) != 0. In this version a session without days covers Monday to Friday
    const raw = String(cfg[s.input]).trim();
    const session = raw.includes(':') ? raw : `${raw}:23456`;
    const inSession = bars.map((b) => pineTime.inSession(ms ? b.time : b.time * 1000, session, tz, barMs));
    const values = [high2, ph, pl, low2];
    const conds = [ph, ph, pl, pl];
    values.forEach((v, k) => {
      plots[`plot${2 + g * 4 + k}`] = series((i) => (truthy(conds[k][i]) && inSession[i] ? v[i] : NaN));
    });
  });

  const cols = fillColors(cfg.fillcheck);
  const fills = SESSIONS.flatMap((_s, g) => fillPairs(g).map(([plot1, plot2], k) => ({
    id: `fill${g * 3 + k}`, plot1, plot2, options: { title: FILL_TITLES[g][k] },
    colors: bars.map(() => cols[g][k]),
  })));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    fills,
  };
}

export const IctSessions = { calculate, metadata, defaultInputs, inputConfig, plotConfig, fillConfig };
