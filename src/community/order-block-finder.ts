/**
 * Order Block Finder (Experimental)
 *
 * A bullish order block is the last down candle before `periods` up candles in a row; a bearish order block is the
 * last up candle before `periods` down candles in a row. The move from the close of the block candle to the close of
 * the last candle of the row must be at least `threshold` percent. The block is found `periods + 1` bars later and
 * drawn back on its own bar: a triangle, the upper and lower limits (open to low for a bullish block, open to high
 * for a bearish block, or high to low with the whole range option), a fill between them and a cross at the average.
 * Three lines extended to the left mark the latest bullish block and three the latest bearish block. Six invisible
 * series keep the latest levels for the data window. Two optional labels: a panel with the latest levels and a
 * documentation label with a tooltip.
 *
 * The six "Latest ..." series are invisible characters (transparency 100) in the Pine script, there only for the data
 * window: they are ported as plots with display 'data_window'.
 * The panel label is placed at the bar close time plus 100 bar intervals: the bar close time is taken as the bar
 * time plus the bar interval (the most frequent gap between two bars).
 *
 * Reference: "Order Block Finder" by wugamlo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © wugamlo
 */

import { str, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, LineDrawingData, LabelData } from '../types';
import { barInterval, barTime } from '../bar-time';

export interface OrderBlockFinderInputs {
  /** Colour scheme: DARK (white / blue) or BRIGHT (green / red) */
  colors: 'DARK' | 'BRIGHT';
  /** Number of candles in a row after the block candle */
  periods: number;
  /** Minimum percent move from the block close to the close of the last candle of the row */
  threshold: number;
  /** Mark the whole high / low range of the block candle */
  usewicks: boolean;
  /** Lines of the latest bullish block */
  showbull: boolean;
  /** Lines of the latest bearish block */
  showbear: boolean;
  /** Documentation label with a tooltip */
  showdocu: boolean;
  /** Panel label with the latest levels */
  infoPan: boolean;
}

export const defaultInputs: OrderBlockFinderInputs = {
  colors: 'DARK',
  periods: 5,
  threshold: 0.0,
  usewicks: false,
  showbull: true,
  showbear: true,
  showdocu: false,
  infoPan: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'colors', type: 'string', title: 'Color Scheme', defval: 'DARK', options: ['DARK', 'BRIGHT'] },
  { id: 'periods', type: 'int', title: 'Relevant Periods to identify OB', defval: 5 },
  { id: 'threshold', type: 'float', title: 'Min. Percent move to identify OB', defval: 0.0, step: 0.1 },
  { id: 'usewicks', type: 'bool', title: 'Use whole range [High/Low] for OB marking?', defval: false },
  { id: 'showbull', type: 'bool', title: 'Show latest Bullish Channel?', defval: true },
  { id: 'showbear', type: 'bool', title: 'Show latest Bearish Channel?', defval: true },
  { id: 'showdocu', type: 'bool', title: 'Show Label for documentation tooltip?', defval: false },
  { id: 'infoPan', type: 'bool', title: 'Show Latest OB Panel?', defval: false },
];

// Pine v4 colour constants
const WHITE = '#FFFFFF';
const GREEN = '#4CAF50';
const BLUE = '#2196F3';
const RED = '#FF5252';
const GRAY = '#787B86';
// plotchar(..., color = #777777, transp = 100)
const HIDDEN = '#77777700';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bullish OB High', color: WHITE, lineWidth: 3, style: 'linebr' },
  { id: 'plot1', title: 'Bullish OB Low', color: WHITE, lineWidth: 3, style: 'linebr' },
  { id: 'plot2', title: 'Bearish OB Low', color: BLUE, lineWidth: 3, style: 'linebr' },
  { id: 'plot3', title: 'Bearish OB High', color: BLUE, lineWidth: 3, style: 'linebr' },
  { id: 'plot4', title: 'Latest Bull High', color: HIDDEN, lineWidth: 1, display: 'data_window' },
  { id: 'plot5', title: 'Latest Bull Avg', color: HIDDEN, lineWidth: 1, display: 'data_window' },
  { id: 'plot6', title: 'Latest Bull Low', color: HIDDEN, lineWidth: 1, display: 'data_window' },
  { id: 'plot7', title: 'Latest Bear High', color: HIDDEN, lineWidth: 1, display: 'data_window' },
  { id: 'plot8', title: 'Latest Bear Avg', color: HIDDEN, lineWidth: 1, display: 'data_window' },
  { id: 'plot9', title: 'Latest Bear Low', color: HIDDEN, lineWidth: 1, display: 'data_window' },
];

export const metadata = {
  title: 'Order Block Finder',
  shortTitle: 'Order Block Finder',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

const TOOLTIP = 'Indicator to help identifying instituational Order Blocks. Often these blocks signal the beginning of a strong move, but there is a high probability, that these prices will be revisited at a later point in time again and therefore are interesting levels to place limit orders. \nBullish Order block is the last down candle before a sequence of up candles. \nBearish Order Block is the last up candle before a sequence of down candles. \nIn the settings the number of required sequential candles can be adjusted. \nFurthermore a %-threshold can be entered which the sequential move needs to achieve in order to validate a relevant Order Block. \nChannels for the last Bullish/Bearish Block can be shown/hidden.';

type Point = { time: number; value: number; color?: string };

export function calculate(
  bars: Bar[],
  inputs: Partial<OrderBlockFinderInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; lines: LineDrawingData[]; labels: LabelData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const periods = Math.trunc(cfg.periods);
  // ob_period = periods + 1: the block candle is ob_period bars back
  const obPeriod = periods + 1;
  if (obPeriod < 0 || periods < 0) {
    // close[ob_period] / close[i] with a negative index
    throw new Error('Order Block Finder: "Relevant Periods to identify OB" must be 0 or more (negative history index).');
  }
  const bullcolor = cfg.colors === 'DARK' ? WHITE : GREEN;
  const bearcolor = cfg.colors === 'DARK' ? BLUE : RED;
  const interval = barInterval(bars);

  const at = (i: number, k: number): Bar | undefined => (i - k >= 0 ? bars[i - k] : undefined);
  const plots: Record<string, Point[]> = {
    plot0: [], plot1: [], plot2: [], plot3: [], plot4: [], plot5: [], plot6: [], plot7: [], plot8: [], plot9: [],
  };
  const markers: MarkerData[] = [];
  const bullFill: string[] = new Array(n).fill('transparent');
  const bearFill: string[] = new Array(n).fill('transparent');

  // var line linebull1 / linebull2 / linebull3, linebear1 / linebear2 / linebear3: deleted and made again on each block
  let bullLines: LineDrawingData[] = [];
  let bearLines: LineDrawingData[] = [];
  // line.new(x1 = bar_index, y1 = y, x2 = bar_index - 1, y2 = y, extend = extend.left, width = 1)
  const channel = (i: number, y: number, col: string, style: 'solid' | 'dashed'): LineDrawingData | null => (
    i < 1 || isNaN(y) ? null
      : { time1: bars[i].time, price1: y, time2: bars[i - 1].time, price2: y, color: col, width: 1, style, extend: 'left' });
  const keep = (l: Array<LineDrawingData | null>) => l.filter((x): x is LineDrawingData => x !== null);

  // var latest_* = 0.0
  let latestBullHigh = 0, latestBullAvg = 0, latestBullLow = 0;
  let latestBearHigh = 0, latestBearAvg = 0, latestBearLow = 0;
  // chper = time - time[1]; chper := change(chper) > 0 ? chper[1] : chper
  let chper = NaN;

  for (let i = 0; i < n; i++) {
    const ob = at(i, obPeriod);
    const prev = at(i, 1);
    // absmove = abs(close[ob_period] - close[1]) / close[ob_period] * 100; relmove = absmove >= threshold
    const absmove = ob && prev ? (Math.abs(ob.close - prev.close) / ob.close) * 100 : NaN;
    const relmove = ge(absmove, cfg.threshold);

    // for i = 1 to periods (counts down when periods < 1)
    let upcandles = 0;
    let downcandles = 0;
    const step = periods >= 1 ? 1 : -1;
    for (let k = 1; step > 0 ? k <= periods : k >= periods; k += step) {
      const b = at(i, k);
      if (b && gt(b.close, b.open)) upcandles++;
      if (b && lt(b.close, b.open)) downcandles++;
    }

    const bullishOB = !!ob && lt(ob.close, ob.open);
    const obBull = bullishOB && upcandles === periods && relmove;
    const obBullHigh = obBull && ob ? (cfg.usewicks ? ob.high : ob.open) : NaN;
    const obBullLow = obBull && ob ? ob.low : NaN;
    const obBullAvg = (obBullHigh + obBullLow) / 2;

    const bearishOB = !!ob && gt(ob.close, ob.open);
    const obBear = bearishOB && downcandles === periods && relmove;
    const obBearHigh = obBear && ob ? ob.high : NaN;
    const obBearLow = obBear && ob ? (cfg.usewicks ? ob.low : ob.open) : NaN;
    const obBearAvg = (obBearLow + obBearHigh) / 2;

    // Plots, shapes and fills with offset = -ob_period: the value of bar i is drawn on bar i - ob_period
    const j = i - obPeriod;
    if (j >= 0) {
      const tj = barTime(bars, j, interval);
      plots.plot0.push({ time: tj, value: obBullHigh, color: bullcolor });
      plots.plot1.push({ time: tj, value: obBullLow, color: bullcolor });
      plots.plot2.push({ time: tj, value: obBearLow, color: bearcolor });
      plots.plot3.push({ time: tj, value: obBearHigh, color: bearcolor });
      if (j < n) {
        // fill(bull1, bull2, color = bullcolor, transp = 0) / fill(bear1, bear2, color = bearcolor, transp = 0)
        bullFill[j] = bullcolor;
        bearFill[j] = bearcolor;
      }
      if (obBull) {
        markers.push({ time: tj, position: 'belowBar', shape: 'triangleUp', color: bullcolor, text: 'Bullish OB',
          textColor: bullcolor, size: 'tiny' });
      }
      if (!isNaN(obBullAvg)) {
        markers.push({ time: tj, position: 'atPriceMiddle', price: obBullAvg, shape: 'cross', color: bullcolor,
          size: 'normal' });
      }
      if (obBear) {
        markers.push({ time: tj, position: 'aboveBar', shape: 'triangleDown', color: bearcolor, text: 'Bearish OB',
          textColor: bearcolor, size: 'tiny' });
      }
      if (!isNaN(obBearAvg)) {
        markers.push({ time: tj, position: 'atPriceMiddle', price: obBearAvg, shape: 'cross', color: bearcolor,
          size: 'normal' });
      }
    }

    // Lines of the latest blocks
    if (obBull && cfg.showbull) {
      bullLines = keep([channel(i, obBullAvg, bullcolor, 'solid'), channel(i, obBullHigh, bullcolor, 'dashed'),
        channel(i, obBullLow, bullcolor, 'dashed')]);
    }
    if (obBear && cfg.showbear) {
      bearLines = keep([channel(i, obBearAvg, bearcolor, 'solid'), channel(i, obBearHigh, bearcolor, 'dashed'),
        channel(i, obBearLow, bearcolor, 'dashed')]);
    }

    // Latest levels
    if (gt(obBullHigh, 0)) latestBullHigh = obBullHigh;
    if (gt(obBullAvg, 0)) latestBullAvg = obBullAvg;
    if (gt(obBullLow, 0)) latestBullLow = obBullLow;
    if (gt(obBearHigh, 0)) latestBearHigh = obBearHigh;
    if (gt(obBearAvg, 0)) latestBearAvg = obBearAvg;
    if (gt(obBearLow, 0)) latestBearLow = obBearLow;
    const t = bars[i].time;
    plots.plot4.push({ time: t, value: latestBullHigh });
    plots.plot5.push({ time: t, value: latestBullAvg });
    plots.plot6.push({ time: t, value: latestBullLow });
    plots.plot7.push({ time: t, value: latestBearHigh });
    plots.plot8.push({ time: t, value: latestBearAvg });
    plots.plot9.push({ time: t, value: latestBearLow });

    const prevChper = chper;
    chper = i > 0 ? t - bars[i - 1].time : NaN;
    if (gt(chper - prevChper, 0)) chper = prevChper;
  }

  // Labels: both are deleted and made again on every bar, so only those of the last bar remain
  const labels: LabelData[] = [];
  if (n > 0) {
    const last = bars[n - 1];
    if (cfg.infoPan && n > 1) {
      // info_panel_x = time_close + round(change(time) * 100); info_panel_y = close
      const fmt = (v: number) => str.tostring(v, '#.##');
      const row = '-----------------------------------------------------';
      const text = '\n' + 'LATEST ORDER BLOCKS' + '\n' + row + '\n' + ' Bullish - High: ' + fmt(latestBullHigh) + '\n'
        + ' Bullish - Avg: ' + fmt(latestBullAvg) + '\n' + ' Bullish - Low: ' + fmt(latestBullLow) + '\n' + row + '\n\n'
        + ' Bearish - High: ' + fmt(latestBearHigh) + '\n' + ' Bearish - Avg: ' + fmt(latestBearAvg) + '\n'
        + ' Bearish - Low: ' + fmt(latestBearLow) + '\n';
      labels.push({
        time: last.time + interval + (last.time - bars[n - 2].time) * 100, price: last.close, text,
        // color.new(#383838, 5)
        color: 'rgba(56, 56, 56, 0.95)', style: 'label_left', textColor: WHITE, size: 'normal',
      });
    }
    if (cfg.showdocu && !isNaN(chper)) {
      // label.new(x = time + chper * 35, y = close, xloc = xloc.bar_time, ...)
      labels.push({
        time: last.time + chper * 35, price: last.close, text: 'DOCU OB', color: GRAY, textColor: WHITE,
        style: 'label_center', size: 'tiny', textAlign: 'left', tooltip: TOOLTIP,
      });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    markers,
    fills: [
      { plot1: 'plot0', plot2: 'plot1', options: { title: 'Bullish OB fill', color: bullcolor }, colors: bullFill },
      { plot1: 'plot2', plot2: 'plot3', options: { title: 'Bearish OB fill', color: bearcolor }, colors: bearFill },
    ],
    lines: [...bullLines, ...bearLines],
    labels,
  };
}

export const OrderBlockFinder = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
