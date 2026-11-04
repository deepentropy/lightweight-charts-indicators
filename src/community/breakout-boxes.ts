/**
 * Breakout Boxes [ChartPrime]
 *
 * Finds pivot highs and pivot lows ("Pivot Detection Length" bars on each side). When a new pivot high is within
 * 0.2 ATR(200) of the pivot high before it, an upper box starts at the earlier pivot: from its high up by "Upper Box
 * Width" / 10 ATR, with two half-height boxes inside it. A new pivot low near the pivot low before it starts a lower
 * box the same way (down by "Lower Box Width" / 10 ATR). A new box replaces an active one of its side: the old boxes
 * shrink to their left edge and lose their border.
 *
 * While a box is active it grows to the current bar. Its text is the total volume of the bars from 5 bars before its
 * left edge to the current bar; the inner boxes show the share of the volume of rising bars (close above open,
 * "+Volume") and of the other bars ("-Volume"), and their width is that share of the box width. On a closed bar a
 * close crossing over the top of the upper box (under the bottom of the lower box) ends that box and draws a
 * "BreakUp" ("BreakDn") label one ATR below the low (above the high).
 *
 * Only the last 5000 bars are calculated (calc_bars_count of the original). At most 500 boxes and 500 labels are
 * kept.
 *
 * Reference: "Breakout Boxes [ChartPrime]" by ChartPrime
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © ChartPrime
 */

import {
  ta, str, color, callsite, Series, box, label, resetDrawings, setDrawingBar, varDrawing,
  type Box, type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import type { BoxData, LabelData } from '../types';
import { barInterval, barTime } from '../bar-time';
import { lastBarConfirmedOf, type ChartContext } from '../chart-context';
import type { StudyDrawingKind } from '../style-outputs';

export interface BreakoutBoxesInputs {
  /** Bars on each side of a pivot */
  pivotLen: number;
  /** Height of the upper box in tenths of ATR(200) */
  boxWidth1: number;
  boxUpCol: string;
  /** Height of the lower box in tenths of ATR(200) */
  boxWidth2: number;
  boxDnCol: string;
}

export const defaultInputs: BreakoutBoxesInputs = {
  pivotLen: 5,
  boxWidth1: 5,
  boxUpCol: '#ce1c7b',
  boxWidth2: 5,
  boxDnCol: '#1ed87e',
};

export const inputConfig: InputConfig[] = [
  { id: 'pivotLen', type: 'int', title: 'Pivot Detection Length', defval: 5 },
  { id: 'boxWidth1', type: 'int', title: 'Upper Box Width', defval: 5, inline: 'up' },
  { id: 'boxUpCol', type: 'color', title: '', defval: '#ce1c7b', inline: 'up' },
  { id: 'boxWidth2', type: 'int', title: 'Lower Box Width', defval: 5, inline: 'lw' },
  { id: 'boxDnCol', type: 'color', title: '', defval: '#1ed87e', inline: 'lw' },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['box', 'label'];

export const metadata = {
  title: 'Breakout Boxes [ChartPrime]',
  shortTitle: 'Breakout Boxes [ChartPrime]',
  overlay: true,
};

/** indicator(max_boxes_count = 500, max_labels_count = 500) */
const MAX_OBJECTS = 500;
/** indicator(calc_bars_count = 5000): only the last 5000 bars are calculated */
const CALC_BARS = 5000;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  allBars: Bar[],
  inputs: Partial<BreakoutBoxesInputs> = {},
  chart?: ChartContext,
): Omit<IndicatorResult, 'boxes' | 'labels'> & { boxes: BoxData[]; labels: LabelData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const start = Math.max(0, allBars.length - CALC_BARS);
  const bars = allBars.slice(start);
  const n = bars.length;
  const pivotLen = Math.trunc(cfg.pivotLen);
  const boxWidth1 = Math.trunc(cfg.boxWidth1) / 10;
  const boxWidth2 = Math.trunc(cfg.boxWidth2) / 10;
  const { boxUpCol, boxDnCol } = cfg;

  const ph = ta.pivothigh(new Series(bars, (b) => b.high), pivotLen, pivotLen).toArray();
  const pl = ta.pivotlow(new Series(bars, (b) => b.low), pivotLen, pivotLen).toArray();
  const atr = ta.atr(bars, 200).toArray();

  resetDrawings({ box: MAX_OBJECTS, label: MAX_OBJECTS });

  /** One side: the `var` pivot and the `var` Box of the original (body, buy and sell boxes) */
  const side = (isUpper: boolean) => {
    const col = isUpper ? boxUpCol : boxDnCol;
    const width = isUpper ? boxWidth1 : boxWidth2;
    const pivots = isUpper ? ph : pl;
    const fill = String(color.new(col, 90));
    let pivotVal = NaN;
    let pivotIndex = NaN;
    const body = varDrawing<Box>();
    const buy = varDrawing<Box>();
    const sell = varDrawing<Box>();
    const cross = isUpper ? callsite.crossover() : callsite.crossunder();

    // Box / pivot detection
    const detect = (i: number) => {
      const p = pivots[i] ?? NaN;
      if (isNaN(p)) return;
      const atr0 = atr[i] * 0.2;
      if (lt(Math.abs(pivotVal - p), atr0)) {
        const old = body.value;
        if (old && old.right > i - pivotLen) {
          for (const b of [buy.value, sell.value]) {
            if (!b) continue;
            box.set_right(b, old.left);
            box.set_border_color(b, 'transparent');
          }
          box.set_right(old, old.left);
          box.set_border_color(old, 'transparent');
        }
        const far = isUpper ? pivotVal + atr[i] * width : pivotVal - atr[i] * width;
        const mid = (far + pivotVal) / 2;
        const top = isUpper ? far : pivotVal;
        const bottom = isUpper ? pivotVal : far;
        body.value = box.new(pivotIndex, top, i, bottom, col, 2, undefined, undefined, undefined, 'transparent',
          undefined, undefined, '#FFFFFF', 'right');
        // upper: buy = (mid .. pivot), sell = (mid .. top); lower: buy = (mid .. bottom), sell = (mid .. pivot)
        buy.value = box.new(pivotIndex, mid, pivotIndex, isUpper ? pivotVal : far, col, undefined, undefined,
          undefined, undefined, fill, undefined, undefined, '#FFFFFF', 'left');
        sell.value = box.new(pivotIndex, mid, pivotIndex, isUpper ? far : pivotVal, col, undefined, undefined,
          undefined, undefined, fill, undefined, undefined, '#FFFFFF', 'left');
      }
      pivotVal = p;
      pivotIndex = i - pivotLen;
    };

    // Visualisation of the active box
    const draw = (i: number) => {
      const b = body.value;
      if (!b) return;
      let up = 0;
      let down = 0;
      box.set_right(b, i);
      const last = i - (b.left - 5);
      for (let k = 0; k <= last; k++) {
        const bar = i - k >= 0 ? bars[i - k] : undefined;
        const v = bar ? (bar.volume ?? NaN) : NaN;
        if (bar && gt(bar.close, bar.open)) up += v;
        else down += v;
      }
      const tot = up + down;
      box.set_text(b, 'Total ' + str.tostring(tot, 'volume'));
      const size = Math.trunc(b.right - b.left);
      if (buy.value) {
        box.set_right(buy.value, b.left + Math.trunc(size * (up / tot)));
        box.set_text(buy.value, '+Volume ' + str.tostring(up / tot * 100, 'percent'));
      }
      if (sell.value) {
        box.set_right(sell.value, b.left + Math.trunc(size * (down / tot)));
        box.set_text(sell.value, '-Volume ' + str.tostring(down / tot * 100, 'percent'));
      }
    };

    // Breakout signal (closed bars only)
    const breakout = (i: number) => {
      const b = body.value;
      const level = b ? (isUpper ? b.top : b.bottom) : NaN;
      if (!cross(bars[i].close, level)) return;
      body.value = undefined;
      buy.value = undefined;
      sell.value = undefined;
      const bar = bars[i];
      if (isUpper) {
        label.new(i, bar.low - atr[i], '⯁\nBreakUp', 'bar_index', 'price', String(color.new(col, 80)), 'label_up', col);
      } else {
        label.new(i, bar.high + atr[i], 'BreakDn\n⯁', 'bar_index', 'price', String(color.new(col, 80)), 'label_down', col);
      }
    };

    return { detect, draw, breakout };
  };

  const upper = side(true);
  const lower = side(false);
  const lastConfirmed = lastBarConfirmedOf(chart);
  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    upper.detect(i);
    lower.detect(i);
    upper.draw(i);
    lower.draw(i);
    if (i < n - 1 || lastConfirmed) {
      upper.breakout(i);
      lower.breakout(i);
    }
  }
  setDrawingBar(null);

  const interval = barInterval(bars);
  const T = (index: number) => barTime(bars, index, interval);
  const css = (c: unknown) => (c === undefined || c === null ? 'transparent' : String(c));
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    // a box with an na coordinate is not drawn
    boxes: box.all().filter((b) => ![b.left, b.right, b.top, b.bottom].some((v) => isNaN(v))).map((b) => ({
      time1: T(b.left), price1: b.top, time2: T(b.right), price2: b.bottom,
      bgColor: css(b.bgcolor), borderColor: css(b.border_color), borderWidth: b.border_width ?? 1,
      text: b.text ?? '', textSize: 'auto', textColor: '#FFFFFF', textHAlign: b.text_halign ?? 'center',
    })),
    labels: label.all().map((l) => ({
      time: T(l.x), price: l.y, text: l.text ?? '', color: css(l.color), textColor: css(l.textcolor),
      style: l.style as 'label_up' | 'label_down', size: 'normal',
    })),
  };
}

export const BreakoutBoxes = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  drawingKinds,
};
