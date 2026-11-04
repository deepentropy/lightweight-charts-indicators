/**
 * Higher Timeframe High & Low [ChartPrime]
 *
 * Plots the high and the low of the previous bar of a higher timeframe (request.security on the chart symbol: on
 * historical bars the latest completed bar seen one chart bar later; on a live last bar, a realtime bar, the bar in
 * progress, as measured: the `barstate.isrealtime` offsets of the original are 0 inside the requested context) and
 * their average, with a gradient fill between the high and the low. The plots break where the
 * higher-timeframe values change. Diamonds mark the bar before a high crossing under the higher-timeframe high
 * ("Resistance") or a low crossing over the higher-timeframe low ("Support"). On the last bar, labels and lines
 * extend the high, the low and the average "Extension" bars to the right. A close crossing over the high or under
 * the low colours the bar green / red; options: trend colours (the colour stays until the other breakout), a
 * background on the bars where a new period starts, and labels on the breakouts.
 *
 * Chart context: `chart.fg_color` / `chart.bg_color` (text and average colours, fill transparency), the exchange
 * calendar for the higher-timeframe bars and the state of the last bar. A timeframe below the chart timeframe needs
 * lower-timeframe bars: the port throws.
 *
 * Reference: "Higher Timeframe High & Low [ChartPrime]" by ChartPrime
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © ChartPrime
 */

import {
  color, callsite, label, line, timeframe as tfns, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type BarColorConfig, type FillConfig, type IndicatorResult, type InputConfig, type MarkerData,
  type PlotConfig, type ShapeConfig,
} from 'oakscriptjs';
import type { BarColorData, BgColorData } from '../types';
import type { StudyDrawingKind } from '../style-outputs';
import { chartTimeframe, higherTimeframeBars } from '../anchor-period';
import { backgroundColorOf, foregroundColorOf, lastBarConfirmedOf, type ChartContext } from '../chart-context';

export interface HigherTimeframeHighLowInputs {
  /** Bars to the right of the last bar for the labels and lines */
  extension: number;
  /** Higher timeframe */
  timeframe: string;
  /** Background on the bars where the higher-timeframe values change */
  separator: boolean;
  /** Trend colours on the bars, stepped average */
  show_trend: boolean;
  /** Labels on the breakouts */
  show_break: boolean;
}

export const defaultInputs: HigherTimeframeHighLowInputs = {
  extension: 50,
  timeframe: 'D',
  separator: false,
  show_trend: false,
  show_break: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'extension', type: 'int', title: 'Extension to the right of High and Low', defval: 50, group: 'Settings' },
  { id: 'timeframe', type: 'timeframe', title: 'timeframe', defval: 'D', group: 'Settings', tooltip: 'Use Higher Timeframe then Current' },
  { id: 'separator', type: 'bool', title: 'Period Separator', defval: false },
  { id: 'show_trend', type: 'bool', title: 'Show Trend?', defval: false },
  { id: 'show_break', type: 'bool', title: 'Show Breakout Labels?', defval: false },
];

const COLOR_DN = '#d41919';
const COLOR_UP = '#13b818';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'High', color: COLOR_DN, lineWidth: 2, style: 'linebr' },
  // style = show_trend ? stepline_diamond : circles (the default is shown)
  { id: 'plot1', title: 'L & H Avg', color: String(color.new('#DBDBDB', 50)), lineWidth: 1, style: 'circles' },
  { id: 'plot2', title: 'Low', color: COLOR_UP, lineWidth: 2, style: 'linebr' },
];

export const fillConfig: FillConfig[] = [
  {
    id: 'fill0', plot1: 'plot0', plot2: 'plot2', title: 'Plots Background',
    topColor: String(color.new(COLOR_DN, 92)), bottomColor: String(color.new(COLOR_UP, 92)),
  },
];

export const shapeConfig: ShapeConfig[] = [
  { id: 'char0', kind: 'char', title: 'Resistance', char: '◆', location: 'abovebar', color: COLOR_DN, size: 'tiny', offset: -1 },
  { id: 'char1', kind: 'char', title: 'Support', char: '◆', location: 'belowbar', color: COLOR_UP, size: 'tiny', offset: -1 },
];

export const barColorConfig: BarColorConfig[] = [
  { id: 'barcolor0', kind: 'barcolor', title: 'Bar Color' },
  { id: 'bgcolor0', kind: 'bgcolor', title: 'Background Color' },
];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label'];

export const metadata = {
  title: 'Higher Timeframe High & Low [ChartPrime]',
  shortTitle: 'H/L HTF [ChartPrime]',
  overlay: true,
};

/** Same colour (chart.bg_color == color.white) */
function sameColor(a: string, b: string): boolean {
  return color.r(a) === color.r(b) && color.g(a) === color.g(b) && color.b(a) === color.b(b) && color.t(a) === color.t(b);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<HigherTimeframeHighLowInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const { extension, show_trend: showTrend, show_break: showBreak, separator } = cfg;
  const tf = cfg.timeframe;
  const fg = foregroundColorOf(chart);
  const bg = backgroundColorOf(chart);
  const live = !lastBarConfirmedOf(chart);

  // pricehigh / pricelow = request.security(syminfo.tickerid, timeframe, high[indexHighTF])[indexCurrTF]
  const priceHigh = new Array<number>(n).fill(NaN);
  const priceLow = new Array<number>(n).fill(NaN);
  const chartTf = chartTimeframe(bars, chart);
  const tfSec = tf.trim() === '' ? 0 : tfns.in_seconds(tf);
  const chartSec = chartTf === '' ? 0 : tfns.in_seconds(chartTf);
  if (tfSec === 0 || tfSec === chartSec || n === 0) {
    // the chart timeframe: high[1] on every bar, the bar itself on a live last bar
    for (let i = 1; i < n; i++) {
      const k = live && i === n - 1 ? i : i - 1;
      priceHigh[i] = bars[k].high;
      priceLow[i] = bars[k].low;
    }
  } else if (tfSec < chartSec) {
    throw new Error('Higher Timeframe High & Low: a timeframe below the chart timeframe needs lower-timeframe bars');
  } else {
    const sec = higherTimeframeBars(bars, tf, chart);
    for (let i = 0; i < n; i++) {
      // a live last bar: the bar in progress; else the latest completed bar one chart bar back
      const g = live && i === n - 1 ? sec.group[i] : i > 0 ? sec.latest[i - 1] : -1;
      if (g >= 0) {
        priceHigh[i] = sec.htf[g].high;
        priceLow[i] = sec.htf[g].low;
      }
    }
  }

  const highBreakX = callsite.crossover();
  const lowBreakX = callsite.crossunder();
  const resistanceX = callsite.crossunder();
  const supportX = callsite.crossover();

  resetDrawings({ line: 2, label: 10 });
  const highPts: { time: number; value: number; color: string }[] = [];
  const avgPts: { time: number; value: number; color: string }[] = [];
  const lowPts: { time: number; value: number; color: string }[] = [];
  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];
  const bgColors: BgColorData[] = [];
  const topValue: number[] = [];
  const bottomValue: number[] = [];
  const topColor: Array<string | null> = [];
  const bottomColor: Array<string | null> = [];

  const highColor = !showTrend ? COLOR_DN : String(color.new(COLOR_DN, 80));
  const lowColor = !showTrend ? COLOR_UP : String(color.new(COLOR_UP, 80));
  const avgColor = showTrend ? String(color.new(fg, 90)) : String(color.new(fg, 50));
  const fillTransp = sameColor(bg, '#FFFFFF') ? 80 : 92;
  const fillTop = !showTrend ? String(color.new(COLOR_DN, fillTransp)) : null;
  const fillBottom = !showTrend ? String(color.new(COLOR_UP, fillTransp)) : null;

  let trendColor: string | null = null; // var color color = na
  let check: boolean | null = null; // var bool check = na
  let prevCheck: boolean | null = null;

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const ph = priceHigh[i];
    const pl = priceLow[i];
    const avg = (pl + ph) / 2;

    const highBreak = highBreakX(b.close, ph);
    const lowBreak = lowBreakX(b.close, pl);
    let color1: string | null = null;
    prevCheck = check;
    if (highBreak) {
      check = true;
      color1 = COLOR_UP;
      trendColor = COLOR_UP;
    } else if (lowBreak) {
      check = false;
      color1 = COLOR_DN;
      trendColor = COLOR_DN;
    }

    // breakout labels: check[1] == false / true (na compares false)
    if (highBreak && prevCheck === false && showBreak) {
      label.new(i, b.low * 0.99, `${tf}\nHigh Break`, 'bar_index', 'price', '#0e4e11', 'label_up', fg, 'small');
    }
    if (lowBreak && prevCheck === true && showBreak) {
      label.new(i, b.high * 1.01, `${tf}\nLow Break`, 'bar_index', 'price', '#6e1414', 'label_down', fg, 'small');
    }

    // change_hl = not ta.change(pricehigh) or not ta.change(pricelow)
    const chH = i > 0 ? ph - priceHigh[i - 1] : NaN;
    const chL = i > 0 ? pl - priceLow[i - 1] : NaN;
    const changeHl = !(chH !== 0 && !Number.isNaN(chH)) || !(chL !== 0 && !Number.isNaN(chL));

    const shown = showTrend || changeHl;
    highPts.push({ time: b.time, value: shown && !Number.isNaN(ph) ? ph : NaN, color: highColor });
    avgPts.push({ time: b.time, value: shown && !Number.isNaN(avg) ? avg : NaN, color: avgColor });
    lowPts.push({ time: b.time, value: shown && !Number.isNaN(pl) ? pl : NaN, color: lowColor });

    // plotchar(..., offset = -1)
    const resistance = resistanceX(b.high, ph);
    const support = supportX(b.low, pl);
    if (i > 0) {
      const t = bars[i - 1].time;
      if (resistance) {
        markers.push({ id: 'char0', time: t, position: 'aboveBar', shape: 'circle', color: 'transparent', text: '◆', textColor: COLOR_DN, size: 'tiny' });
      }
      if (support) {
        markers.push({ id: 'char1', time: t, position: 'belowBar', shape: 'circle', color: 'transparent', text: '◆', textColor: COLOR_UP, size: 'tiny' });
      }
    }

    if (i === n - 1) {
      label.new(i + extension, ph, `⮪ ${tf} High`, 'bar_index', 'price', COLOR_DN, 'label_left', fg, 'normal');
      label.new(i + extension, pl, `⮨ ${tf} Low`, 'bar_index', 'price', '#158d19', 'label_left', fg, 'normal');
      if (changeHl) {
        line.new(i, ph, i + extension, ph, 'bar_index', undefined, COLOR_DN, 'solid', 2);
        line.new(i, pl, i + extension, pl, 'bar_index', undefined, COLOR_UP, undefined, 2);
        line.new(i, avg, i + extension, avg, 'bar_index', undefined, fg, showTrend ? 'solid' : 'dotted', showTrend ? 1 : 2);
      }
    }

    const bc = showTrend ? trendColor : color1;
    if (bc !== null) barColors.push({ id: 'barcolor0', time: b.time, color: bc });
    if (separator && !changeHl) bgColors.push({ id: 'bgcolor0', time: b.time, color: String(color.new(fg, 90)) });

    topValue.push(ph);
    bottomValue.push(pl);
    topColor.push(fillTop);
    bottomColor.push(fillBottom);
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: highPts, plot1: avgPts, plot2: lowPts },
    fills: [{ id: 'fill0', plot1: 'plot0', plot2: 'plot2', options: { title: 'Plots Background' }, gradient: { topValue, bottomValue, topColor, bottomColor } }],
    markers,
    barColors,
    bgColors,
    ...drawingOutputs(bars, n > 0 && bars[0].time >= 1e12 ? 'ms' : 's'),
  };
}

export const HigherTimeframeHighLow = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, fillConfig, shapeConfig, barColorConfig, drawingKinds,
};
