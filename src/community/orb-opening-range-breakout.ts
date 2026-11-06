/**
 * ORB - Opening Range Breakout
 *
 * High and low of the opening range: the bars inside the session "Session Time" (every day of the week). On the
 * first bar of the session the range is the high and the low of that bar; on the next bars of the session it grows
 * with each new high or low. After the session the two levels stay until the next session starts. The levels are
 * only shown on intraday bars whose timeframe (in minutes) is not above "ORB total time (minutes)". A line has no
 * colour on the bar where its level changes.
 *
 * The session hours are read in the exchange time zone of the symbol, given by the optional third argument (see
 * src/chart-context.ts); without it they are read in UTC.
 *
 * Chart timeframe: `timeframe` of the chart context (optional third argument of calculate) when given; without it
 * the chart timeframe is read from the bar spacing (the most frequent gap between two bars).
 *
 * Reference: "ORB" by zzzcrypto123
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { time as pineTime, timeframe, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { chartTimeframe } from '../anchor-period';
import { timezoneOf, type ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface OrbOpeningRangeBreakoutInputs {
  /** Highest chart timeframe (minutes) that shows the levels */
  inputMax: number;
  /** Session of the opening range */
  sess: string;
}

export const defaultInputs: OrbOpeningRangeBreakoutInputs = {
  inputMax: 5,
  sess: '0915-0920',
};

export const inputConfig: InputConfig[] = [
  { id: 'inputMax', type: 'int', title: 'ORB total time (minutes)', defval: 5 },
  { id: 'sess', type: 'session', title: 'Session Time', defval: '0915-0920' },
];

const GREEN = '#4CAF50';
const RED = '#FF5252';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ORB High', color: GREEN, lineWidth: 2 },
  { id: 'plot1', title: 'ORB Low', color: RED, lineWidth: 2 },
];

export const metadata = {
  title: 'ORB',
  shortTitle: 'ORB',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; a != b when they differ by more (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ne = (a: number, b: number) => Math.abs(a - b) > EPS;

type Point = { time: number; value: number; color?: string };

interface OrbVars {
  prevIn: boolean;
  prevHigh: number;
  prevLow: number;
}

interface OrbRun extends BarRunState<OrbVars> {
  plot0: Point[];
  plot1: Point[];
}

function study(inputs: Partial<OrbOpeningRangeBreakoutInputs>): BarStudy<OrbRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  // t = time(timeframe.period, sess + ":1234567")
  const session = `${cfg.sess}:1234567`;
  let inMs = false;
  let hide = false;
  let timezone = '';
  let barMs: number | undefined;
  /** The chart timeframe read by `key` (called before `init` on each update) */
  let tf = '';
  return {
    // the chart timeframe comes from the bar gaps, the time unit from the first bar
    key: (bars, chart) => {
      tf = chartTimeframe(bars, chart);
      return `${tf}|${bars.length > 0 && bars[0].time >= 1e12}`;
    },
    init(bars, chart) {
      inMs = bars.length > 0 && bars[0].time >= 1e12;
      // hide = timeframe.isintraday and timeframe.multiplier <= inputMax
      const info = tf === '' ? null : timeframe.info(tf);
      hide = info !== null && info.isintraday && info.multiplier <= cfg.inputMax;
      timezone = timezoneOf(chart);
      // bar size for the clock-change rule of the session test (intraday bars)
      barMs = info !== null && info.isintraday ? timeframe.in_seconds(tf) * 1000 : undefined;
      const s: OrbRun = {
        plot0: [], plot1: [], steps: [], vars: { prevIn: false, prevHigh: NaN, prevLow: NaN }, lists: [], series: [],
      };
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const { time, high, low } = bars[i];
      const inSession = pineTime.inSession(inMs ? time : time * 1000, session, timezone, barMs);
      const isFirst = inSession && !v.prevIn;
      let orbHigh = isFirst ? high : v.prevHigh;
      let orbLow = isFirst ? low : v.prevLow;
      if (gt(high, orbHigh) && inSession) orbHigh = high;
      if (gt(orbLow, low) && inSession) orbLow = low;
      // color = orb_high[1] != orb_high ? na : color.green
      s.plot0[i] = { time, value: hide ? orbHigh : NaN, color: ne(v.prevHigh, orbHigh) ? 'transparent' : GREEN };
      s.plot1[i] = { time, value: hide ? orbLow : NaN, color: ne(v.prevLow, orbLow) ? 'transparent' : RED };
      v.prevIn = inSession;
      v.prevHigh = orbHigh;
      v.prevLow = orbLow;
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<OrbOpeningRangeBreakoutInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<OrbOpeningRangeBreakoutInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const OrbOpeningRangeBreakout = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
