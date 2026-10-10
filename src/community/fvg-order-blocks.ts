/**
 * FVG Order Blocks [BigBeluga]
 *
 * Looks for fair value gaps on the last 2,000 bars: a bullish gap when the low is above the high of two bars
 * before (and that high is below the previous high, and the low of two bars before is below the low), a bearish gap
 * in the mirrored case, when the gap size in percent is above the filter. Each gap draws a small box with its size,
 * and an order block: a box one ATR(200) high below the bullish gap (above the bearish gap) that runs to 15 bars
 * after the last bar. A bullish block is removed when the high closes the bar below it (a bearish block when the
 * low is above it), or kept in grey with the "Broken Blocks" option; a block that has the top of another block
 * inside it is removed, and only the most recent blocks are kept ("Blocks Amount"). The signals option draws a
 * label when the price leaves a block.
 *
 * The port has no chart theme: the foreground colour of the chart (text and gap boxes) is #DBDBDB, the value of
 * the reference run on a dark chart. Every bar is a closed bar.
 *
 * Reference: "FVG Order Blocks [BigBeluga]" by BigBeluga
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © BigBeluga
 */

import { ta, str, color, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BoxData, LabelData } from '../types';
import { barInterval, barTime } from '../bar-time';

export interface FvgOrderBlocksInputs {
  /** Smallest gap size, in percent of the price */
  filter: number;
  showFvg: boolean;
  /** Number of order blocks kept (per side, less one) */
  boxAmount: number;
  showBroken: boolean;
  showSignal: boolean;
  bullColor: string;
  bearColor: string;
}

export const defaultInputs: FvgOrderBlocksInputs = {
  filter: 0.5,
  showFvg: true,
  boxAmount: 6,
  showBroken: false,
  showSignal: false,
  bullColor: '#14BE94',
  bearColor: 'rgb(194, 25, 25)',
};

export const inputConfig: InputConfig[] = [
  { id: 'filter', type: 'float', title: 'Filter Gaps by %', defval: 0.5, min: 0, max: 100, step: 0.1 },
  { id: 'showFvg', type: 'bool', title: 'Fair Value Gaps', defval: true, inline: '1' },
  { id: 'boxAmount', type: 'int', title: 'Blocks Amount', defval: 6 },
  { id: 'showBroken', type: 'bool', title: 'Broken Blocks', defval: false },
  { id: 'showSignal', type: 'bool', title: 'Order Blocks Signals', defval: false },
  { id: 'bullColor', type: 'color', title: 'Color +/-', defval: '#14BE94', inline: '2' },
  { id: 'bearColor', type: 'color', title: '', defval: 'rgb(194, 25, 25)', inline: '2' },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'FVG Order Blocks [BigBeluga]',
  shortTitle: 'FVG Order Blocks [BigBeluga]',
  overlay: true,
};

/** chart.fg_color of the reference run (dark chart) */
const CHART_FG_COLOR = '#DBDBDB';
/** indicator(max_boxes_count = 500); labels keep the default of 50 */
const MAX_BOXES = 500;
const MAX_LABELS = 50;
const LOOKBACK = 2000;
/** An na colour: fully transparent in color.from_gradient */
const NA_COLOR = 'rgba(0, 0, 0, 0)';

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

/** A box as the script keeps it: bar indexes and prices; a deleted box reads na */
interface Block {
  left: number;
  top: number;
  right: number;
  bottom: number;
  borderColor: string;
  borderWidth: number;
  bgColor: string;
  text: string;
  textSize?: 'small';
  textHAlign?: 'right';
  deleted: boolean;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<FvgOrderBlocksInputs> = {},
): Omit<IndicatorResult, 'boxes' | 'labels'> & { boxes: BoxData[]; labels: LabelData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const last = n - 1;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const H = (i: number) => (i >= 0 ? bars[i].high : NaN);
  const L = (i: number) => (i >= 0 ? bars[i].low : NaN);

  const atr = A(ta.atr(bars, 200));
  // filt_up = (low - high[2]) / low * 100, filt_dn = (low[2] - high) / low[2] * 100
  const filtUp = bars.map((b, i) => ((b.low - H(i - 2)) / b.low) * 100);
  const filtDn = bars.map((b, i) => ((L(i - 2) - b.high) / L(i - 2)) * 100);
  const maxUp = A(ta.highest(Series.fromArray(bars, filtUp), 200));
  const maxDn = A(ta.highest(Series.fromArray(bars, filtDn), 200));

  // Live drawings, in creation order: above max + 5 objects the oldest are deleted until max remain
  const allBoxes: Block[] = [];
  const newBox = (b: Omit<Block, 'deleted'>): Block => {
    const box: Block = { ...b, deleted: false };
    allBoxes.push(box);
    if (allBoxes.length > MAX_BOXES + 5) {
      for (const old of allBoxes.splice(0, allBoxes.length - MAX_BOXES)) old.deleted = true;
    }
    return box;
  };
  const deleteBox = (b: Block | null) => {
    if (!b || b.deleted) return;
    b.deleted = true;
    allBoxes.splice(allBoxes.indexOf(b), 1);
  };
  const top = (b: Block | null) => (b && !b.deleted ? b.top : NaN);
  const bottom = (b: Block | null) => (b && !b.deleted ? b.bottom : NaN);
  let labels: LabelData[] = [];
  const newLabel = (l: LabelData) => {
    labels.push(l);
    if (labels.length > MAX_LABELS + 5) labels = labels.slice(labels.length - MAX_LABELS);
  };

  const fg = CHART_FG_COLOR;
  const fg90 = color.new(fg, 90);
  const fg70 = color.new(fg, 70);
  const brokenBg = String(color.new(fg, 85));
  const bullBg = color.new(cfg.bullColor, 70);
  const bearBg = color.new(cfg.bearColor, 70);

  // var boxes1 = array.new<box>(10, box(na)), var boxes2 = array.new<box>(10, box(na))
  const boxes1: Array<Block | null> = new Array(10).fill(null);
  const boxes2: Array<Block | null> = new Array(10).fill(null);
  let isBullGap = false; // var bool, na before the lookback window (na is false in a condition)
  let isBearGap = false;

  for (let i = 0; i < n; i++) {
    const high = bars[i].high;
    const low = bars[i].low;
    if (last - i < LOOKBACK) {
      isBullGap = lt(H(i - 2), low) && lt(H(i - 2), H(i - 1)) && lt(L(i - 2), low) && gt(filtUp[i], cfg.filter);
      isBearGap = gt(L(i - 2), high) && gt(L(i - 2), L(i - 1)) && gt(H(i - 2), high) && gt(filtDn[i], cfg.filter);
    }

    if (isBullGap) {
      const text = str.tostring(filtUp[i], 'percent');
      if (cfg.showFvg) {
        newBox({
          left: i - 1, top: low, right: i + 5, bottom: H(i - 2), borderColor: 'transparent', borderWidth: 0,
          bgColor: String(color.from_gradient(filtUp[i], 0, maxUp[i], fg90, fg70)), text,
        });
      }
      boxes1.push(newBox({
        left: i - 1, top: H(i - 2), right: last, bottom: H(i - 2) - atr[i], borderColor: cfg.bullColor, borderWidth: 1,
        bgColor: String(color.from_gradient(filtUp[i], 0, maxUp[i], NA_COLOR, bullBg)), text,
        textSize: 'small', textHAlign: 'right',
      }));
    }
    if (isBearGap) {
      const text = str.tostring(filtDn[i], 'percent');
      if (cfg.showFvg) {
        newBox({
          left: i - 1, top: L(i - 2), right: i + 5, bottom: high, borderColor: 'transparent', borderWidth: 0,
          bgColor: String(color.from_gradient(filtDn[i], 0, maxDn[i], fg90, fg70)), text: '-' + text,
        });
      }
      boxes2.push(newBox({
        left: i - 1, top: L(i - 2) + atr[i], right: last, bottom: L(i - 2), borderColor: cfg.bearColor, borderWidth: 1,
        bgColor: String(color.from_gradient(filtDn[i], 0, maxDn[i], NA_COLOR, bearBg)), text,
        textSize: 'small', textHAlign: 'right',
      }));
    }

    // barstate.islast: the blocks run to 15 bars after the last bar
    if (i === last) {
      for (const b of boxes1) if (b && !b.deleted) b.right = i + 15;
      for (const b of boxes2) if (b && !b.deleted) b.right = i + 15;
    }

    // Broken blocks. `for box_id in array` reads the array as it is on each step: after the removal of the
    // current element the next element takes its place and is skipped on this bar.
    for (let k = 0; k < boxes1.length; k++) {
      const b = boxes1[k];
      if (lt(high, bottom(b))) {
        b!.borderWidth = 0;
        b!.bgColor = brokenBg;
        if (!cfg.showBroken) {
          deleteBox(b);
          boxes1.splice(boxes1.indexOf(b), 1);
        }
      }
      if (gt(low, top(b)) && le(L(i - 1), top(b)) && !isBullGap && cfg.showSignal) {
        newLabel({ time: bars[i - 1].time, price: L(i - 1), text: '︽', color: 'transparent', textColor: cfg.bullColor, style: 'label_up' });
      }
      for (let j = 0; j < boxes1.length; j++) {
        const top1 = top(boxes1[j]);
        if (lt(top1, top(b)) && gt(top1, bottom(b))) {
          deleteBox(b);
          boxes1.splice(boxes1.indexOf(b), 1);
        }
      }
    }
    for (let k = 0; k < boxes2.length; k++) {
      const b = boxes2[k];
      if (gt(low, top(b))) {
        b!.borderWidth = 0;
        b!.bgColor = brokenBg;
        if (!cfg.showBroken) {
          deleteBox(b);
          boxes2.splice(boxes2.indexOf(b), 1);
        }
      }
      if (lt(high, bottom(b)) && ge(H(i - 1), bottom(b)) && !isBearGap && cfg.showSignal) {
        newLabel({ time: bars[i - 1].time, price: H(i - 1), text: '﹀', color: 'transparent', textColor: cfg.bearColor, style: 'label_down' });
      }
      for (let j = 0; j < boxes2.length; j++) {
        const top1 = top(boxes2[j]);
        if (lt(top1, top(b)) && gt(top1, bottom(b))) {
          deleteBox(b);
          boxes2.splice(boxes2.indexOf(b), 1);
        }
      }
    }

    // Limit the number of blocks
    if (boxes1.length >= cfg.boxAmount) deleteBox(boxes1.shift() ?? null);
    if (boxes2.length >= cfg.boxAmount) deleteBox(boxes2.shift() ?? null);
  }

  const interval = barInterval(bars);
  const boxes: BoxData[] = [];
  for (const b of allBoxes) {
    // a box with an na coordinate (ATR not ready) or that starts before the first bar is not drawn
    if (isNaN(b.top) || isNaN(b.bottom) || b.left < 0) continue;
    boxes.push({
      time1: barTime(bars, b.left, interval), price1: b.top, time2: barTime(bars, b.right, interval), price2: b.bottom,
      bgColor: b.bgColor, borderColor: b.borderColor, borderWidth: b.borderWidth,
      text: b.text, textColor: fg,
      ...(b.textSize ? { textSize: b.textSize } : {}),
      ...(b.textHAlign ? { textHAlign: b.textHAlign } : {}),
    });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    boxes,
    labels,
  };
}

export const FvgOrderBlocks = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
