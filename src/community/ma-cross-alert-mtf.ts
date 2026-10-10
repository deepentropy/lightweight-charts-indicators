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
 * Reference: "Moving Average Cross Alert, Multi-Timeframe (MTF) (by ChartArt)" by ChartArt
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, timeframe, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData, BgColorData } from '../types';
import { periodStarts, chartTimeframe } from '../anchor-period';

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
function timeframeBars(bars: Bar[], tf: string): { htf: Bar[]; toChart: (values: number[]) => number[] } {
  const chart = chartTimeframe(bars);
  if (tf.trim() === '' || chart === '' || timeframe.in_seconds(tf) === timeframe.in_seconds(chart)) {
    return { htf: bars, toChart: (values) => values };
  }
  if (timeframe.in_seconds(tf) < timeframe.in_seconds(chart)) {
    throw new Error(`The timeframe "${tf}" is lower than the chart timeframe "${chart}": the bars do not carry that data.`);
  }
  const starts = periodStarts(bars, tf);
  const htf: Bar[] = [];
  const group: number[] = [];
  bars.forEach((b, i) => {
    if (i === 0 || starts[i] !== starts[i - 1]) {
      htf.push({ time: starts[i], open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume ?? NaN });
    } else {
      const last = htf[htf.length - 1];
      last.high = Math.max(last.high, b.high);
      last.low = Math.min(last.low, b.low);
      last.close = b.close;
      last.volume = (last.volume ?? NaN) + (b.volume ?? NaN);
    }
    group.push(htf.length - 1);
  });
  return { htf, toChart: (values) => group.map((g) => values[g]) };
}

export function calculate(bars: Bar[], inputs: Partial<MaCrossAlertMtfInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  // price = security(tickerid, res, pricetype), res = useCurrentRes ? period : resCustom
  const { htf, toChart } = timeframeBars(bars, cfg.useCurrentRes ? '' : cfg.resCustom);
  const source = cfg.pricetype === 'volume' ? htf.map((b) => b.volume ?? NaN) : A(getSourceSeries(htf, cfg.pricetype));
  const price = Series.fromArray(bars, toChart(source));

  // The averages run on the chart bars
  const average = (len: number): number[] => {
    switch (cfg.smoothinput) {
      case 1: return A(ta.sma(price, len));
      case 2: return A(ta.ema(price, len));
      case 3: return A(ta.wma(price, len));
      case 4: return A(ta.linreg(price, len, 0));
      default: return new Array(n).fill(NaN);
    }
  };
  const short = average(cfg.shortperiod);
  const long = average(cfg.longperiod);
  const crossed = ta.cross(Series.fromArray(bars, short), Series.fromArray(bars, long)).toArray();

  const green50 = String(color.new(GREEN_HEX, 50));
  const red50 = String(color.new(RED_HEX, 50));
  const direction = (a: number[], i: number) => {
    const prev = i > 0 ? a[i - 1] : NaN;
    return gt(a[i], prev) ? LIME : lt(a[i], prev) ? RED : BLUE;
  };

  const plot0: Array<{ time: number; value: number; color: string }> = [];
  const plot1: typeof plot0 = [];
  const plot2: Array<{ time: number; value: number }> = [];
  const barColors: BarColorData[] = [];
  const bgColors: BgColorData[] = [];
  const markers: MarkerData[] = [];
  for (let i = 0; i < n; i++) {
    const time = bars[i].time;
    plot0.push({ time, value: short[i], color: direction(short, i) });
    plot1.push({ time, value: long[i], color: direction(long, i) });
    // MAcrossing = cross(short, long) ? short : na
    plot2.push({ time, value: crossed[i] ? short[i] : NaN });

    const trendingUp = gt(short[i], long[i]);
    const trendingDown = lt(short[i], long[i]);
    barColors.push({ time, color: trendingUp ? GREEN_HEX : trendingDown ? RED_HEX : BLUE_HEX });

    // Uptrend = TrendingUp() and TrendingDown()[1]; Downtrend = TrendingDown() and TrendingUp()[1]
    const uptrend = trendingUp && i > 0 && lt(short[i - 1], long[i - 1]);
    const downtrend = trendingDown && i > 0 && gt(short[i - 1], long[i - 1]);
    if (uptrend) bgColors.push({ time, color: green50 });
    else if (downtrend) bgColors.push({ time, color: red50 });

    // Buy = Uptrend() and close > close[1]; Sell = Downtrend() and close < close[1]
    const prevClose = i > 0 ? bars[i - 1].close : NaN;
    if (uptrend && gt(bars[i].close, prevClose)) {
      markers.push({ time, position: 'bottom', shape: 'arrowUp', color: BLACK, text: 'Buy' });
    }
    if (downtrend && lt(bars[i].close, prevClose)) {
      markers.push({ time, position: 'top', shape: 'arrowDown', color: BLACK, text: 'Sell' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2 },
    // fill(MA1, MA2, color = silver, transp = 50)
    fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: String(color.new('#C0C0C0', 50)) } }],
    barColors,
    bgColors,
    markers,
  };
}

export const MaCrossAlertMtf = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
