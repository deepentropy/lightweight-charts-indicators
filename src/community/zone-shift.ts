/**
 * Zone Shift [ChartPrime]
 *
 * A trend band around the average of an EMA ("Length") and an HMA (length - 40) of the close: the middle line, and a
 * top / bottom line at +/- the 200-bar SMA of the bar range (high - low). On a confirmed bar, a low that crosses
 * above the top line starts an up trend (the low becomes the trend initiation level); a high that crosses below the
 * bottom line starts a down trend (the high becomes the level). In an up trend, a close or low that crosses back above
 * the level draws a retest label below the bar; in a down trend a close or high that crosses back below it draws one
 * above the bar (at least 6 bars between two retests). Bars and candles take the trend colour.
 *
 * Outputs: the middle line (drawn on every second bar), the top and bottom lines, the trend initiation level (drawn
 * on every second bar, broken where the level changes), bar colours, coloured candles and the retest labels (at most
 * 500 kept).
 *
 * Chart context: `chart.fg_color` (line colours; #DBDBDB, the dark theme value, without a context) and the state of
 * the last bar (`barstate.isconfirmed`: an open last bar does not change the trend or draw a retest).
 *
 * Reference: "Zone Shift [ChartPrime]" by ChartPrime
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © ChartPrime
 */

import {
  ta, color, Series, label, resetDrawings, setDrawingBar, drawingOutputs,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type BarColorConfig,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import type { BarColorData, PlotCandleData } from '../types';
import { foregroundColorOf, lastBarConfirmedOf, type ChartContext } from '../chart-context';

export interface ZoneShiftInputs {
  length: number;
  upColor: string;
  dnColor: string;
}

export const defaultInputs: ZoneShiftInputs = {
  length: 100,
  upColor: '#00E676',
  dnColor: '#2962FF',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length 60-200', defval: 100, min: 60, max: 200 },
  { id: 'upColor', type: 'color', title: '', defval: '#00E676', inline: 'colors' },
  { id: 'dnColor', type: 'color', title: '', defval: '#2962FF', inline: 'colors' },
];

const FG = '#DBDBDB';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Middle', color: FG, lineWidth: 1 },
  { id: 'plot1', title: 'Top', color: FG, lineWidth: 1 },
  { id: 'plot2', title: 'Bottom', color: FG, lineWidth: 1 },
  { id: 'plot3', title: 'Trend Initiation Level', color: FG, lineWidth: 1, style: 'linebr' },
];

export const barColorConfig: BarColorConfig[] = [{ id: 'barcolor0', kind: 'barcolor', title: 'Bar Color' }];

export const plotCandleConfig = [{ id: 'candle0', title: 'CandleColor' }];

export const drawingKinds: StudyDrawingKind[] = ['label'];

export const metadata = {
  title: 'Zone Shift [ChartPrime]',
  shortTitle: 'Zone Shift [ChartPrime]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
/** Pine `!=`: false when one side is na */
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<ZoneShiftInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { barColors: BarColorData[]; plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const length = Math.trunc(cfg.length);
  const fg = foregroundColorOf(chart);
  const lastConfirmed = lastBarConfirmedOf(chart);
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  const close = new Series(bars, (b) => b.close);
  const ema = A(ta.ema(close, length));
  const hma = A(ta.hma(close, length - 40));
  const dist = A(ta.sma(new Series(bars, (b) => b.high - b.low), 200));

  // indicator(max_labels_count = 500)
  resetDrawings({ label: 500 });

  const noLabel = String(color.new('#363A45', 100)); // color.new(color.black, 100)
  const plot0: { time: number; value: number; color?: string }[] = [];
  const plot1: { time: number; value: number; color?: string }[] = [];
  const plot2: { time: number; value: number; color?: string }[] = [];
  const plot3: { time: number; value: number; color?: string }[] = [];
  const barColors: BarColorData[] = [];
  const candles: PlotCandleData[] = [];

  let trend = false;
  let trendStart = NaN;
  let lastRetest = 0;
  const topArr = new Array<number>(n);
  const botArr = new Array<number>(n);
  const tsArr = new Array<number>(n);

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const p = i > 0 ? bars[i - 1] : null;
    const mid = (ema[i] + hma[i]) / 2;
    const top = mid + dist[i];
    const bot = mid - dist[i];
    topArr[i] = top;
    botArr[i] = bot;
    const confirmed = i < n - 1 || lastConfirmed;
    const top1 = i > 0 ? topArr[i - 1] : NaN;
    const bot1 = i > 0 ? botArr[i - 1] : NaN;

    if (confirmed) {
      if (gt(b.low, top) && lt(p ? p.low : NaN, top1) && !trend) {
        trend = true;
        trendStart = b.low;
      }
      if (lt(b.high, bot) && gt(p ? p.high : NaN, bot1) && trend) {
        trend = false;
        trendStart = b.high;
      }
    }
    tsArr[i] = trendStart;
    const ts1 = i > 0 ? tsArr[i - 1] : NaN;
    const trendCol = trend ? cfg.upColor : cfg.dnColor;

    // Retest TrendStart Level
    if (confirmed) {
      const c1 = p ? p.close : NaN;
      const l1 = p ? p.low : NaN;
      const h1 = p ? p.high : NaN;
      if (((gt(b.close, trendStart) && lt(c1, ts1)) || (gt(b.low, trendStart) && lt(l1, ts1))) && trend && i - lastRetest > 5) {
        lastRetest = i;
        label.new(i, b.low, '⯁', 'bar_index', 'price', noLabel, 'label_up', trendCol);
      }
      if (((gt(c1, trendStart) && lt(b.close, ts1)) || (gt(h1, trendStart) && lt(b.high, ts1))) && !trend && i - lastRetest > 5) {
        lastRetest = i;
        label.new(i, b.high, '⯁', 'bar_index', 'price', noLabel, 'label_down', trendCol);
      }
    }

    const even = i % 2 === 0;
    const t = b.time;
    plot0.push({ time: t, value: mid, color: even ? fg : 'transparent' });
    plot1.push({ time: t, value: top, color: fg });
    plot2.push({ time: t, value: bot, color: fg });
    barColors.push({ id: 'barcolor0', time: t, color: trendCol });
    candles.push({
      time: t, open: b.open, high: b.high, low: b.low, close: b.close,
      color: trendCol, wickColor: trendCol, borderColor: trendCol,
    });
    // trendStart != trendStart[1] ? na : trendStart
    plot3.push({ time: t, value: ne(trendStart, ts1) ? NaN : trendStart, color: even ? fg : 'transparent' });
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2, plot3 },
    barColors,
    plotCandles: { candle0: candles },
    ...drawingOutputs(bars),
  };
}

export const ZoneShift = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  barColorConfig,
  plotCandleConfig,
  drawingKinds,
};
