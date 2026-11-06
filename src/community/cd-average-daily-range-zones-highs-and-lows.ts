/**
 * CD_Average Daily Range Zones
 *
 * Average daily range (ADR) levels around the open of the day. The daily range is high - low of a daily bar; the
 * 10-day and 5-day ADR are the averages of the ranges of the 10 / 5 days before the current day. The levels are
 * the daily open plus and minus half of each ADR, drawn as circles; a fill joins the two high levels (maroon) and
 * the two low levels (lime).
 *
 * Daily bars on an intraday chart: they are built from the chart bars (periods from the UTC calendar and the bars,
 * or the exchange calendar of the chart context, see src/anchor-period.ts). As in the original (a version 1
 * script), every chart bar of a day shows the values of that day: the daily open and the ranges of the days
 * before, all known from the first bar of the day. On daily charts the daily bars are the chart bars. A chart
 * timeframe above one day needs data that the bars do not carry: the port throws an Error.
 *
 * Reference: "CD_Average Daily Range Zones- highs and lows of the day" by cristian.d
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  color, timeframe, resample, mapToChart,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import { periodStarts, chartTimeframe, securityBars, hasCalendar } from '../anchor-period';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type CdAverageDailyRangeZonesInputs = Record<string, never>;

export const defaultInputs: CdAverageDailyRangeZonesInputs = {};

export const inputConfig: InputConfig[] = [];

// Colour constants of Pine version 1, with the default plot transparency of that version (35)
const RED = String(color.new('#FF0000', 35));
const GREEN = String(color.new('#008000', 35));
/** fill(..., color = lime) / fill(..., color = maroon): default fill transparency 90 */
const LIME_FILL = String(color.new('#00FF00', 90));
const MAROON_FILL = String(color.new('#800000', 90));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ADR High10', color: RED, lineWidth: 2, style: 'circles' },
  { id: 'plot1', title: 'ADR LOW10', color: GREEN, lineWidth: 2, style: 'circles' },
  { id: 'plot2', title: 'ADR High5', color: RED, lineWidth: 2, style: 'circles' },
  { id: 'plot3', title: 'ADR LOW5', color: GREEN, lineWidth: 2, style: 'circles' },
];

export const metadata = {
  title: 'CD_Average Daily Range Zones',
  shortTitle: 'CD_Daily High/Low Zones V01',
  overlay: true,
};

/**
 * security(tickerid, 'D', ...) on the chart symbol: the daily bars built from the chart bars, and the function that
 * brings one value per daily bar back to the chart bars. Version 1 rule: every chart bar of a day shows the value
 * of the day (no gaps).
 */
function dailyBars(bars: Bar[], context?: ChartContext): { htf: Bar[]; toChart: (values: number[]) => number[] } {
  const tf = 'D';
  const chart = chartTimeframe(bars, context);
  if (chart === '' || timeframe.in_seconds(tf) === timeframe.in_seconds(chart)) {
    return { htf: bars, toChart: (values) => values };
  }
  if (timeframe.in_seconds(tf) < timeframe.in_seconds(chart)) {
    throw new Error(`The timeframe "${tf}" is lower than the chart timeframe "${chart}": the bars do not carry that data.`);
  }
  const exchange = securityBars(bars, tf, context);
  const { bars: htf, group } = exchange ? { bars: exchange.htf, group: exchange.group } : resample(bars, periodStarts(bars, tf));
  // lookahead: every chart bar of a period shows the value of the period
  return { htf, toChart: (values) => mapToChart(values, group, [], true, false) };
}

const DAY_MS = 86400000;

type Point = { time: number; value: number; color: string };

interface CdVars {
  /** Open, high and low of the daily bar of the current day */
  open: number;
  high: number;
  low: number;
  /** UTC day of the previous chart bar (intraday charts) */
  day: number;
  /** Ranges of the days before the current one, the newest first (at most 10) */
  past: number[];
}

interface CdRun extends BarRunState<CdVars> {
  /** Every chart bar is a daily bar (daily chart, or a timeframe not known) */
  daily: boolean;
  /** The bar times are in milliseconds */
  ms: boolean;
  /** The values of the exchange calendar (computed in full by the security function) */
  calendar: { OPEN: number[]; A10: number[]; A5: number[] } | null;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
}

function study(): BarStudy<CdRun, IndicatorResult> {
  return {
    // the daily bars of the exchange calendar come from the library's sessions: computed in full on each update
    fullRunReason: (chart) => (hasCalendar(chart) ? 'exchange calendar' : null),
    // the chart timeframe (from the bar gaps without chart.timeframe) and the unit of the bar times
    key: (bars, chart) => `${chartTimeframe(bars, chart)}|${bars.length > 0 && bars[0].time >= 1e12 ? 'ms' : 's'}`,
    init(bars, chart) {
      const s: CdRun = {
        daily: true, ms: bars.length > 0 && bars[0].time >= 1e12, calendar: null,
        plot0: [], plot1: [], plot2: [], plot3: [],
        steps: [], vars: { open: NaN, high: NaN, low: NaN, day: NaN, past: [] }, lists: [], series: [],
      };
      s.series = [s.plot0, s.plot1, s.plot2, s.plot3];
      if (hasCalendar(chart)) {
        const { htf, toChart } = dailyBars(bars, chart);
        const v = dailyValues(htf);
        s.calendar = { OPEN: toChart(v.open), A10: toChart(v.adr10), A5: toChart(v.adr5) };
        return s;
      }
      const tf = 'D';
      const chartTf = chartTimeframe(bars, chart);
      if (chartTf !== '' && timeframe.in_seconds(tf) !== timeframe.in_seconds(chartTf)) {
        if (timeframe.in_seconds(tf) < timeframe.in_seconds(chartTf)) {
          throw new Error(`The timeframe "${tf}" is lower than the chart timeframe "${chartTf}": the bars do not carry that data.`);
        }
        s.daily = false;
      }
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      let OPEN: number;
      let A10: number;
      let A5: number;
      if (s.calendar) {
        OPEN = s.calendar.OPEN[i];
        A10 = s.calendar.A10[i];
        A5 = s.calendar.A5[i];
      } else {
        const v = s.vars;
        // a new daily bar: every chart bar on daily charts, else the first bar of a UTC day (periodStarts)
        const day = Math.floor((s.ms ? b.time : b.time * 1000) / DAY_MS);
        const first = i === 0 || s.daily || day !== v.day;
        v.day = day;
        if (first) {
          if (i > 0) {
            // dayrange = high - low of the daily bar that ends
            v.past.unshift(v.high - v.low);
            if (v.past.length > 10) v.past.length = 10;
          }
          v.open = b.open;
          v.high = b.high;
          v.low = b.low;
        } else {
          v.high = Math.max(v.high, b.high);
          v.low = Math.min(v.low, b.low);
        }
        const past = v.past;
        const m = past.length;
        // (r1+r2+...+r10) / 10 and (r1+...+r5) / 5, summed in the order of the source
        let sum = m >= 1 ? past[0] : NaN;
        for (let k = 2; k <= 5; k++) sum += k <= m ? past[k - 1] : NaN;
        A5 = sum / 5;
        for (let k = 6; k <= 10; k++) sum += k <= m ? past[k - 1] : NaN;
        A10 = sum / 10;
        // lookahead: every chart bar of a day shows the value of the day
        OPEN = v.open;
      }
      const time = b.time;
      const h10 = OPEN + A10 / 2;
      const l10 = OPEN - A10 / 2;
      const h5 = OPEN + A5 / 2;
      const l5 = OPEN - A5 / 2;
      s.plot0[i] = { time, value: Number.isFinite(h10) ? h10 : NaN, color: RED };
      s.plot1[i] = { time, value: Number.isFinite(l10) ? l10 : NaN, color: GREEN };
      s.plot2[i] = { time, value: Number.isFinite(h5) ? h5 : NaN, color: RED };
      s.plot3[i] = { time, value: Number.isFinite(l5) ? l5 : NaN, color: GREEN };
    },
    copyVars: (v) => ({ ...v, past: v.past.slice() }),
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice() },
        fills: [
          // fill(adrlow10, adrlow5, color = lime)
          { plot1: 'plot1', plot2: 'plot3', options: { color: LIME_FILL } },
          // fill(adrhigh10, adrhigh5, color = maroon)
          { plot1: 'plot0', plot2: 'plot2', options: { color: MAROON_FILL } },
        ],
      };
    },
  };
}

/** The open and the 10-day / 5-day ADR of each daily bar */
function dailyValues(htf: Bar[]): { open: number[]; adr10: number[]; adr5: number[] } {
  const m = htf.length;
  // dayrange = high - low of each daily bar
  const range = htf.map((b) => b.high - b.low);
  const r = (k: number, j: number) => (j - k >= 0 ? range[j - k] : NaN);
  const open: number[] = [];
  const adr10: number[] = [];
  const adr5: number[] = [];
  for (let j = 0; j < m; j++) {
    open.push(htf[j].open);
    // (r1+r2+...+r10) / 10 and (r1+...+r5) / 5, summed in the order of the source
    let s = r(1, j);
    for (let k = 2; k <= 5; k++) s += r(k, j);
    adr5.push(s / 5);
    for (let k = 6; k <= 10; k++) s += r(k, j);
    adr10.push(s / 10);
  }
  return { open, adr10, adr5 };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<CdAverageDailyRangeZonesInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(), chart);
}

export function calculate(
  bars: Bar[],
  _inputs: Partial<CdAverageDailyRangeZonesInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  return fullResult(createRun(_inputs, chart).update(bars));
}

export const CdAverageDailyRangeZones = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
