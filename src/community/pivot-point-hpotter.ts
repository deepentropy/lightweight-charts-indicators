/**
 * Pivot Point
 *
 * Floor-trader pivots of the previous day: PP = (high + low + close) / 3 of the previous day, then three supports
 * and three resistances: R1 = 2 PP - low, S1 = 2 PP - high, R2 = PP + (high - low), S2 = PP - (high - low),
 * R3 = high + 2 (PP - low), S3 = low - 2 (high - PP). The pivot itself is not plotted.
 *
 * The daily bars are built from the chart bars (days from the UTC calendar and the bars, see src/anchor-period.ts);
 * every chart bar of a day shows the levels of that day, and the first day of the data has none. A chart timeframe
 * above one day needs data that the bars do not carry: the port throws an Error.
 * The line width input is not applied (the plot width is static: the default, 2).
 *
 * Periods and the chart context (optional third argument of calculate): with the exchange time zone and the session
 * of the symbol (`timezone`, `session`) the periods are those of the exchange calendar (its trading days, holidays
 * and session hours), see src/anchor-period.ts.
 * Without them the port uses the UTC calendar and the bars, as described in this header. `timeframe`, when given,
 * is the chart timeframe; without it the chart timeframe is read from the bar spacing.
 *
 * Reference: "Pivot Point" by HPotter
 * Original notice: Copyright by HPotter v1.0 10/07/2014
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, timeframe, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { securityStarts, chartTimeframe, hasCalendar } from '../anchor-period';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PivotPointHpotterInputs {
  /** Line width of the plots */
  width: number;
}

export const defaultInputs: PivotPointHpotterInputs = {
  width: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'width', type: 'int', title: 'width', defval: 2, min: 1 },
];

// Default plot transparency of Pine version 1 (35)
const V1 = (hex: string) => String(color.new(hex, 35));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'S1', color: V1('#ff0000'), lineWidth: 2, style: 'circles' },
  { id: 'plot1', title: 'S2', color: V1('#ff002a'), lineWidth: 2, style: 'circles' },
  { id: 'plot2', title: 'S3', color: V1('#ff014a'), lineWidth: 2, style: 'circles' },
  { id: 'plot3', title: 'R1', color: V1('#009600'), lineWidth: 2, style: 'circles' },
  { id: 'plot4', title: 'R2', color: V1('#006F00'), lineWidth: 2, style: 'circles' },
  { id: 'plot5', title: 'R3', color: V1('#004900'), lineWidth: 2, style: 'circles' },
];

export const metadata = {
  title: 'Pivot Point',
  shortTitle: 'Pivot Point',
  overlay: true,
};

/** One day in milliseconds */
const DAY = 86400000;

type Point = { time: number; value: number };

interface PpVars {
  /** The high, low and close of the previous day */
  prevHigh: number;
  prevLow: number;
  prevClose: number;
  /** The high, low and close of the day so far */
  dayHigh: number;
  dayLow: number;
  dayClose: number;
}

interface PpRun extends BarRunState<PpVars> {
  /** The period starts of the exchange calendar (null: UTC days of the bars, found bar by bar) */
  starts: number[] | null;
  /** Bar times in milliseconds */
  ms: boolean;
  plots: Point[][];
}

/**
 * security(tickerid, "D", x[1]) for x = high, low, close: the high, low and close of the previous day on every
 * chart bar of a day (version 1 rule: no gaps, each chart bar of a period shows the value of that period).
 */
function study(_inputs: Partial<PivotPointHpotterInputs>): BarStudy<PpRun, IndicatorResult> {
  return {
    // the chart timeframe from the bar gaps and the unit of the bar times
    key: (bars, chart) => `${chartTimeframe(bars, chart)}|${bars.length > 0 && bars[0].time >= 1e12}`,
    // the exchange calendar: the periods of the whole bar set (securityStarts)
    fullRunReason: (chart) => (hasCalendar(chart) ? 'exchange calendar periods' : null),
    init(bars, context) {
      const chart = chartTimeframe(bars, context);
      if (chart !== '' && timeframe.in_seconds(chart) > timeframe.in_seconds('D')) {
        throw new Error(`Pivot Point: the daily timeframe is lower than the chart timeframe "${chart}": the bars do not carry that data.`);
      }
      const s: PpRun = {
        starts: hasCalendar(context) ? securityStarts(bars, 'D', context) : null,
        ms: bars.length > 0 && bars[0].time >= 1e12,
        plots: [[], [], [], [], [], []],
        steps: [],
        vars: { prevHigh: NaN, prevLow: NaN, prevClose: NaN, dayHigh: NaN, dayLow: NaN, dayClose: NaN },
        lists: [], series: [],
      };
      s.series = [...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      // a new day: the UTC day of the bar differs from the one of the bar before (periodStarts rule)
      let newDay: boolean;
      if (i === 0) newDay = true;
      else if (s.starts) newDay = s.starts[i] !== s.starts[i - 1];
      else {
        const unit = s.ms ? 1 : 1000;
        newDay = Math.floor((b.time * unit) / DAY) !== Math.floor((bars[i - 1].time * unit) / DAY);
      }
      if (newDay) {
        v.prevHigh = v.dayHigh;
        v.prevLow = v.dayLow;
        v.prevClose = v.dayClose;
        v.dayHigh = b.high;
        v.dayLow = b.low;
        v.dayClose = b.close;
      } else {
        v.dayHigh = Math.max(v.dayHigh, b.high);
        v.dayLow = Math.min(v.dayLow, b.low);
        v.dayClose = b.close;
      }
      const xHigh = v.prevHigh;
      const xLow = v.prevLow;
      const xClose = v.prevClose;
      const vPP = (xHigh + xLow + xClose) / 3;
      const time = b.time;
      const p = s.plots;
      p[0][i] = { time, value: vPP - (xHigh - vPP) };
      p[1][i] = { time, value: vPP - (xHigh - xLow) };
      p[2][i] = { time, value: xLow - 2 * (xHigh - vPP) };
      p[3][i] = { time, value: vPP + (vPP - xLow) };
      p[4][i] = { time, value: vPP + (xHigh - xLow) };
      p[5][i] = { time, value: xHigh + 2 * (vPP - xLow) };
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(),
          plot1: p[1].slice(),
          plot2: p[2].slice(),
          plot3: p[3].slice(),
          plot4: p[4].slice(),
          plot5: p[5].slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PivotPointHpotterInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], _inputs: Partial<PivotPointHpotterInputs> = {}, chart?: ChartContext): IndicatorResult {
  return fullResult(createRun(_inputs, chart).update(bars));
}

export const PivotPointHpotter = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
