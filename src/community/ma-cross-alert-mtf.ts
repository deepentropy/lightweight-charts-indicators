/**
 * Moving Average Cross Alert, Multi-Timeframe (MTF)
 *
 * A short and a long moving average (SMA, EMA, WMA or linear regression) of a price source taken from the chart
 * timeframe or from another timeframe of the same symbol. The averages are coloured by their direction (lime
 * rising, red falling, blue flat) with a fill between them, the bars are coloured by the trend (green: short above
 * long, red: short below long, blue otherwise), a cross marks each crossing of the averages, the background marks
 * the bar where the trend turns, and Buy / Sell arrows mark a turn whose close moves in the direction of the new
 * trend.
 *
 * Other timeframe: only the price source comes from that timeframe; the averages run on the chart bars, as in the
 * original. The bars of the other timeframe are built from the chart bars (periods from the UTC calendar and the
 * bars, see src/anchor-period.ts). As in the original (a version 1 script), every chart bar of a period shows the
 * price of that period at its end (on past bars the price of a period is known from its first bar; the last period
 * is still open). A timeframe below the chart timeframe needs data that the bars do not carry: the port throws an
 * Error.
 *
 * Periods and the chart context (optional third argument of calculate): with the exchange time zone and the session
 * of the symbol (`timezone`, `session`) the periods are those of the exchange calendar (its trading days, holidays
 * and session hours), and a bar of a higher timeframe is complete on the chart bar whose close reaches the end of
 * its period, see src/anchor-period.ts.
 * Without them the port uses the UTC calendar and the bars, as described in this header. `timeframe`, when given,
 * is the chart timeframe; without it the chart timeframe is read from the bar spacing.
 *
 * Reference: "Moving Average Cross Alert, Multi-Timeframe (MTF) (by ChartArt)" by ChartArt
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  taStep, Series, color, timeframe, getSourceSeries, resample, mapToChart, type IndicatorResult, type InputConfig,
  type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { MarkerData, BarColorData, BgColorData } from '../types';
import { periodStarts, chartTimeframe, securityBars } from '../anchor-period';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MaCrossAlertMtfInputs {
  /** Price source of the moving averages (the original also offers the volume) */
  pricetype: SourceType | 'volume';
  /** Use the chart timeframe (the timeframe input is ignored) */
  useCurrentRes: boolean;
  /** Timeframe of the price source when `useCurrentRes` is false ("60", "240", "D", "W", "M", ...) */
  resCustom: string;
  shortperiod: number;
  longperiod: number;
  /** 1 = SMA, 2 = EMA, 3 = WMA, 4 = linear regression */
  smoothinput: number;
}

export const defaultInputs: MaCrossAlertMtfInputs = {
  pricetype: 'close',
  useCurrentRes: true,
  resCustom: 'W',
  shortperiod: 50,
  longperiod: 100,
  smoothinput: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'pricetype', type: 'source', title: 'Price Source For The Moving Averages', defval: 'close' },
  { id: 'useCurrentRes', type: 'bool', title: 'Use Current Timeframe As Resolution?', defval: true },
  { id: 'resCustom', type: 'timeframe', title: 'Use Different Timeframe? Then Uncheck The Box Above', defval: 'W' },
  { id: 'shortperiod', type: 'int', title: 'Short Period Moving Average', defval: 50 },
  { id: 'longperiod', type: 'int', title: 'Long Period Moving Average', defval: 100 },
  { id: 'smoothinput', type: 'int', title: 'Moving Average Calculation: (1 = SMA), (2 = EMA), (3 = WMA), (4 = Linear)', defval: 2, min: 1, max: 4 },
];

// Colour constants of Pine version 1. Plots and shapes have the default transparency of that version (35);
// barcolor has none; the background and the fill have transp = 50
const LIME_HEX = '#00FF00';
const RED_HEX = '#FF0000';
const BLUE_HEX = '#0000FF';
const GREEN_HEX = '#008000';
const BLACK_HEX = '#000000';
const V1 = (hex: string) => String(color.new(hex, 35));
const LIME = V1(LIME_HEX);
const RED = V1(RED_HEX);
const BLUE = V1(BLUE_HEX);
const BLACK = V1(BLACK_HEX);

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Short Period Moving Average', color: LIME, lineWidth: 2, style: 'linebr' },
  { id: 'plot1', title: 'Long Period Moving Average', color: LIME, lineWidth: 4, style: 'linebr' },
  { id: 'plot2', title: 'MA Cross', color: BLACK, lineWidth: 4, style: 'cross' },
];

export const metadata = {
  title: 'Moving Average Cross Alert, Multi-Timeframe Option (MTF) (by ChartArt)',
  shortTitle: 'CA_-_MA_cross',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

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
  if (exchange) return { htf: exchange.htf, toChart: (values) => mapToChart(values, exchange.group, exchange.latest, true, false) };
  // Without it: periods of the UTC calendar and the bars, grouped by the library
  const { bars: htf, group } = resample(bars, periodStarts(bars, tf));
  return { htf, toChart: (values) => mapToChart(values, group, group, true, false) };
}

type Point = { time: number; value: number; color: string };
type Ma = { step(v: number): number; commit(): void };

interface MaCrossRun extends BarRunState<Record<string, never>> {
  /** The price of each chart bar from another timeframe (null: the price of the bar itself) */
  price: number[] | null;
  short: Ma | null;
  long: Ma | null;
  cross: ReturnType<typeof taStep.cross>;
  shortArr: number[];
  longArr: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Array<{ time: number; value: number }>;
  barColors: BarColorData[];
  bgColors: BgColorData[];
  markers: MarkerData[];
}

function study(inputs: Partial<MaCrossAlertMtfInputs>): BarStudy<MaCrossRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.pricetype);
  const green50 = String(color.new(GREEN_HEX, 50));
  const red50 = String(color.new(RED_HEX, 50));
  // The averages run on the chart bars
  const average = (len: number): Ma | null => {
    switch (cfg.smoothinput) {
      case 1: return new WindowSma(len);
      case 2: return taStep.ema(len);
      case 3: { const m = taStep.wma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
      case 4: return taStep.linreg(len, 0);
      default: return null;
    }
  };
  const direction = (a: number[], i: number) => {
    const prev = i > 0 ? a[i - 1]! : NaN;
    return gt(a[i]!, prev) ? LIME : lt(a[i]!, prev) ? RED : BLUE;
  };
  return {
    fullRunReason: () => (!cfg.useCurrentRes ? 'price of another timeframe (each bar of a period shows its last price)'
      : isBarSource(cfg.pricetype) ? null : 'source of another study'),
    init(bars, chart) {
      let price: number[] | null = null;
      if (!cfg.useCurrentRes) {
        // price = security(tickerid, res, pricetype), res = useCurrentRes ? period : resCustom
        const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
        const { htf, toChart } = timeframeBars(bars, cfg.resCustom, chart);
        const source = cfg.pricetype === 'volume' ? htf.map((b) => b.volume ?? NaN) : A(getSourceSeries(htf, cfg.pricetype));
        price = toChart(source);
      }
      const short = average(cfg.shortperiod);
      const long = average(cfg.longperiod);
      const cross = taStep.cross();
      const s: MaCrossRun = {
        price, short, long, cross, shortArr: [], longArr: [], plot0: [], plot1: [], plot2: [], barColors: [],
        bgColors: [], markers: [],
        steps: [...(short ? [short] : []), ...(long ? [long] : []), cross], vars: {}, lists: [], series: [],
      };
      s.lists = [s.bgColors, s.markers];
      s.series = [s.shortArr, s.longArr, s.plot0, s.plot1, s.plot2, s.barColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const time = b.time;
      const p = s.price ? s.price[i]! : value(b);
      const short = s.short ? s.short.step(p) ?? NaN : NaN;
      const long = s.long ? s.long.step(p) ?? NaN : NaN;
      s.shortArr[i] = short;
      s.longArr[i] = long;
      const crossed = s.cross.step(short, long);
      s.plot0[i] = { time, value: short, color: direction(s.shortArr, i) };
      s.plot1[i] = { time, value: long, color: direction(s.longArr, i) };
      // MAcrossing = cross(short, long) ? short : na
      s.plot2[i] = { time, value: crossed ? short : NaN };

      const trendingUp = gt(short, long);
      const trendingDown = lt(short, long);
      s.barColors[i] = { time, color: trendingUp ? GREEN_HEX : trendingDown ? RED_HEX : BLUE_HEX };

      // Uptrend = TrendingUp() and TrendingDown()[1]; Downtrend = TrendingDown() and TrendingUp()[1]
      const uptrend = trendingUp && i > 0 && lt(s.shortArr[i - 1]!, s.longArr[i - 1]!);
      const downtrend = trendingDown && i > 0 && gt(s.shortArr[i - 1]!, s.longArr[i - 1]!);
      if (uptrend) s.bgColors.push({ time, color: green50 });
      else if (downtrend) s.bgColors.push({ time, color: red50 });

      // Buy = Uptrend() and close > close[1]; Sell = Downtrend() and close < close[1]
      const prevClose = i > 0 ? bars[i - 1]!.close : NaN;
      if (uptrend && gt(b.close, prevClose)) {
        s.markers.push({ time, position: 'bottom', shape: 'arrowUp', color: BLACK, text: 'Buy' });
      }
      if (downtrend && lt(b.close, prevClose)) {
        s.markers.push({ time, position: 'top', shape: 'arrowDown', color: BLACK, text: 'Sell' });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        // fill(MA1, MA2, color = silver, transp = 50)
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: String(color.new('#C0C0C0', 50)) } }],
        barColors: s.barColors.slice(),
        bgColors: s.bgColors.slice(),
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MaCrossAlertMtfInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MaCrossAlertMtfInputs> = {}, chart?: ChartContext): IndicatorResult {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const MaCrossAlertMtf = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
