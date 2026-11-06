/**
 * ADR% - Average Daily Range %
 *
 * Average daily range in percent: 100 * (sma(dailyHigh / dailyLow, length) - 1), where the daily high and low come
 * from the daily bars of the chart symbol (security(tickerid, 'D', ...) without lookahead: an intraday bar shows the
 * high and low of the latest completed day, and the sma runs on the chart bars). On a daily chart the daily bars are
 * the chart bars. The daily periods follow the exchange calendar of the chart context (time zone and session, see
 * src/anchor-period.ts); without it the UTC calendar of the bars. A chart timeframe above one day is not ported (the
 * bars do not carry the lower-timeframe data): the port throws an Error.
 *
 * Reference: "ADR% - Average Daily Range % by MikeC (AKA TheScrutiniser)" by TheScrutiniser
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Original: alpine_trader. Amended 08/12/20 by TheScrutiniser, MikeC on advise from GlinckEastwoot
 */

import { taCore, barInterval, timeframe, mapToChart, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { chartTimeframe, hasCalendar, higherTimeframeBars, timeAfterLastBar } from '../anchor-period';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AdrAverageDailyRangeByMikecInputs {
  /** sma length */
  length: number;
}

export const defaultInputs: AdrAverageDailyRangeByMikecInputs = {
  length: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 20 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ADR', color: '#FF9800', lineWidth: 1 },
];

export const metadata = {
  title: 'ADR% - Average Daily Range %',
  shortTitle: 'ADR% - Average Daily Range %',
  overlay: false,
};

/** security(tickerid, 'D', high / low): the daily high and low seen by each chart bar (lookahead off, no gaps). */
function dailyHighLow(bars: Bar[], chart?: ChartContext): { high: number[]; low: number[] } {
  const chartTf = chartTimeframe(bars, chart);
  if (chartTf === '' || timeframe.in_seconds(chartTf) === timeframe.in_seconds('D')) {
    return { high: bars.map((b) => b.high), low: bars.map((b) => b.low) };
  }
  if (timeframe.in_seconds(chartTf) > timeframe.in_seconds('D')) {
    throw new Error(`The chart timeframe "${chartTf}" is above one day: the daily bars are not in the chart bars.`);
  }
  const { htf, group, latest } = higherTimeframeBars(bars, 'D', chart);
  return {
    high: mapToChart(htf.map((b) => b.high), group, latest, false, false),
    low: mapToChart(htf.map((b) => b.low), group, latest, false, false),
  };
}

const DAY_MS = 86400000;

type Point = { time: number; value: number };

interface AdrVars {
  /** UTC day of the previous chart bar */
  day: number;
  /** High and low of the day of the previous chart bar (so far) */
  high: number;
  low: number;
  /** High and low of the day before it (NaN before the second day) */
  prevHigh: number;
  prevLow: number;
  /** The previous chart bar closes in the next day (bars every day of the week) */
  reaches: boolean;
}

interface AdrRun extends BarRunState<AdrVars> {
  /** Every chart bar is a daily bar (daily chart, or a timeframe not known) */
  daily: boolean;
  /** The bar times are in milliseconds */
  ms: boolean;
  /** The bars trade every day (weekend bar opens and closes): a bar completes its day when its close is in the next day */
  everyDay: boolean;
  interval: number;
  /** The daily high and low of each chart bar from the exchange calendar (computed in full by the security function) */
  calendar: { high: number[]; low: number[] } | null;
  sma: WindowSma;
  /** dailyHigh / dailyLow of each bar (the bar before the last: the bar after it tells whether it completes its day) */
  ratio: number[];
  /** sma of the ratio of each bar but the last */
  avg: number[];
  /** Own day high and low of each bar, and the ones of the day before */
  dayHigh: number[];
  dayLow: number[];
  prevHigh: number[];
  prevLow: number[];
  plot0: Point[];
}

/** One value of the plot: 100 * (sma - 1), finite */
const adrOf = (avg: number): number => {
  const adr = 100 * ((avg ?? NaN) - 1);
  return Number.isFinite(adr) ? adr : NaN;
};

function study(inputs: Partial<AdrAverageDailyRangeByMikecInputs>): BarStudy<AdrRun, IndicatorResult> {
  const { length } = { ...defaultInputs, ...inputs };
  const weekend = (ms: number) => {
    const wd = new Date(ms).getUTCDay();
    return wd === 0 || wd === 6;
  };
  /** The bars trade every day: bar opens and bar closes on Saturdays or Sundays (the rule of higherTimeframeBars) */
  const tradesEveryDay = (bars: Bar[], ms: boolean, interval: number) => {
    const unit = ms ? 1 : 1000;
    return bars.some((b) => weekend(b.time * unit)) && bars.some((b) => weekend((b.time + interval) * unit));
  };
  return {
    // the daily bars of the exchange calendar come from the library's sessions: computed in full on each update
    fullRunReason: (chart) => (hasCalendar(chart) ? 'exchange calendar' : null),
    // the chart timeframe, the unit of the bar times, the bar interval and the every-day rule read from the whole bar set
    key: (bars, chart) => {
      const ms = bars.length > 0 && bars[0].time >= 1e12;
      const interval = barInterval(bars);
      return `${chartTimeframe(bars, chart)}|${ms ? 'ms' : 's'}|${interval}|${tradesEveryDay(bars, ms, interval)}`;
    },
    init(bars, chart) {
      const ms = bars.length > 0 && bars[0].time >= 1e12;
      const interval = barInterval(bars);
      const sma = new WindowSma(length);
      const s: AdrRun = {
        daily: true, ms, everyDay: false, interval, calendar: null, sma,
        ratio: [], avg: [], dayHigh: [], dayLow: [], prevHigh: [], prevLow: [], plot0: [],
        steps: [sma], lists: [], series: [],
        vars: { day: NaN, high: NaN, low: NaN, prevHigh: NaN, prevLow: NaN, reaches: false },
      };
      s.series = [s.ratio, s.avg, s.dayHigh, s.dayLow, s.prevHigh, s.prevLow, s.plot0];
      const chartTf = chartTimeframe(bars, chart);
      if (chartTf === '' || timeframe.in_seconds(chartTf) === timeframe.in_seconds('D')) return s;
      if (timeframe.in_seconds(chartTf) > timeframe.in_seconds('D')) {
        throw new Error(`The chart timeframe "${chartTf}" is above one day: the daily bars are not in the chart bars.`);
      }
      s.daily = false;
      if (hasCalendar(chart)) s.calendar = dailyHighLow(bars, chart);
      else s.everyDay = tradesEveryDay(bars, ms, interval);
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      // security(tickerid, 'D', high / low) without lookahead: the high and low of the latest completed day. A bar
      // completes its day when it is the last bar of the day (and closes in the next day on every-day bars): the bar
      // after it tells, so the value of bar i - 1 is final on bar i (the last bar is completed in result())
      let ownHigh: number;
      let ownLow: number;
      let prevHigh: number;
      let prevLow: number;
      if (s.calendar) {
        ownHigh = s.calendar.high[i];
        ownLow = s.calendar.low[i];
        prevHigh = ownHigh;
        prevLow = ownLow;
        if (i > 0) s.ratio[i - 1] = s.calendar.high[i - 1] / s.calendar.low[i - 1];
      } else if (s.daily) {
        ownHigh = b.high;
        ownLow = b.low;
        prevHigh = NaN;
        prevLow = NaN;
        if (i > 0) s.ratio[i - 1] = bars[i - 1].high / bars[i - 1].low;
      } else {
        const day = Math.floor((s.ms ? b.time : b.time * 1000) / DAY_MS);
        const first = i === 0 || day !== v.day;
        if (i > 0) {
          // bar i - 1 ends its day when bar i opens another day
          const completes = first && (!s.everyDay || v.reaches);
          s.ratio[i - 1] = completes ? v.high / v.low : v.prevHigh / v.prevLow;
        }
        if (first) {
          if (i > 0) {
            v.prevHigh = v.high;
            v.prevLow = v.low;
          }
          v.high = b.high;
          v.low = b.low;
        } else {
          v.high = Math.max(v.high, b.high);
          v.low = Math.min(v.low, b.low);
        }
        v.day = day;
        if (s.everyDay) {
          const unit = s.ms ? 1 : 1000;
          v.reaches = Math.floor(((b.time + s.interval) * unit) / DAY_MS) !== day;
        }
        ownHigh = v.high;
        ownLow = v.low;
        prevHigh = v.prevHigh;
        prevLow = v.prevLow;
      }
      s.dayHigh[i] = ownHigh;
      s.dayLow[i] = ownLow;
      s.prevHigh[i] = prevHigh;
      s.prevLow[i] = prevLow;
      // ta.sma(ratio, length) of bar i - 1 (bar i writes the plot point of bar i - 1, its own one in result())
      s.ratio[i] = NaN;
      s.avg[i] = NaN;
      s.plot0[i] = { time: b.time as number, value: NaN };
      if (i > 0) {
        const avg = s.sma.step(s.ratio[i - 1]);
        s.avg[i - 1] = avg;
        s.plot0[i - 1] = { time: bars[i - 1].time as number, value: adrOf(avg) };
      }
    },
    copyVars: (v) => ({ ...v }),
    result(s, bars) {
      const n = bars.length;
      const plot0 = s.plot0.slice();
      if (n > 0) {
        // the last bar: it completes its day when the next bar of the UTC rule opens another day (with the exchange
        // calendar the security function gave the values; on daily charts each bar is its day)
        const last = n - 1;
        let completes = true;
        if (!s.calendar && !s.daily) {
          if (s.everyDay) {
            completes = s.vars.reaches;
          } else {
            const next = timeAfterLastBar(bars, 1);
            const unit = s.ms ? 1 : 1000;
            completes = Number.isNaN(next) || Math.floor((next * unit) / DAY_MS) !== Math.floor((bars[last].time * unit) / DAY_MS);
          }
        }
        const ratio = completes ? s.dayHigh[last] / s.dayLow[last] : s.prevHigh[last] / s.prevLow[last];
        let avg: number;
        if (!Number.isFinite(ratio)) {
          // an na value: the sma of the bar before
          avg = last > 0 ? s.avg[last - 1] : NaN;
        } else {
          // the sma of the last length - 1 values of the bars before and this value
          const window: number[] = [];
          for (let k = last - 1; k >= 0 && window.length < length - 1; k--) {
            if (Number.isFinite(s.ratio[k])) window.push(s.ratio[k]);
          }
          window.reverse();
          window.push(ratio);
          const out = taCore.sma(window, length);
          avg = out[out.length - 1] ?? NaN;
        }
        plot0[last] = { time: bars[last].time as number, value: adrOf(avg) };
      }
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0 },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AdrAverageDailyRangeByMikecInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AdrAverageDailyRangeByMikecInputs> = {}, chart?: ChartContext): IndicatorResult {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const AdrAverageDailyRangeByMikec = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
