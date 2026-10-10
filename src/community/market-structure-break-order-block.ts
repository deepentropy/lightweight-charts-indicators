/**
 * Market Structure Break & Order Block
 *
 * A zigzag follows the trend: the trend turns down when the low is the lowest of `zigzagLen` bars and turns up when
 * the high is the highest of `zigzagLen` bars. Each turn stores a swing high or a swing low and draws a zigzag line.
 * A market structure break (MSB) is a new swing low below the previous one by more than `fibFactor` of the last
 * swing (bearish), or a new swing high above the previous one by the same rule (bullish). Each break draws a level
 * line, an "MSB" label and two boxes: the order block (the last opposite candle before the move, Bu-OB / Be-OB) and
 * the breaker or mitigation block (Bu-BB / Bu-MB, Be-BB / Be-MB). Boxes follow the price to the right; when the
 * close leaves a box on the wrong side, the oldest box of that list is removed (deleted, or only left as it is when
 * "Delete Old/Broken Boxes" is off).
 *
 * The Pine script keeps at most 500 lines, 500 boxes and 50 labels (the oldest are deleted). It has one
 * alertcondition ("MSB") and alert() calls, which give no output.
 *
 * Reference: "Market Structure Break & Order Block" by EmreKb
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © EmreKb
 */

import { ta, Series, callsite, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LineDrawingData, BoxData, LabelData, PineSize } from '../types';
import { barInterval, barTime } from '../bar-time';

export interface MarketStructureBreakOrderBlockInputs {
  zigzagLen: number;
  showZigzag: boolean;
  /** Part of the last swing that the new swing must pass to confirm a break */
  fibFactor: number;
  textSize: 'tiny' | 'small' | 'normal' | 'large' | 'huge';
  deleteBoxes: boolean;
  buObColor: string;
  buObBorderColor: string;
  buObTextColor: string;
  beObColor: string;
  beObBorderColor: string;
  beObTextColor: string;
  buBbColor: string;
  buBbBorderColor: string;
  buBbTextColor: string;
  beBbColor: string;
  beBbBorderColor: string;
  beBbTextColor: string;
}

// Pine v5 colour constants
const GREEN = '#4CAF50';
const RED = '#FF5252';
// Input defaults color.new(color.green, 70) / color.new(color.red, 70): alpha 0.3
const GREEN_70 = 'rgba(76, 175, 80, 0.3)';
const RED_70 = 'rgba(255, 82, 82, 0.3)';

export const defaultInputs: MarketStructureBreakOrderBlockInputs = {
  zigzagLen: 9,
  showZigzag: true,
  fibFactor: 0.33,
  textSize: 'tiny',
  deleteBoxes: true,
  buObColor: GREEN_70,
  buObBorderColor: GREEN,
  buObTextColor: GREEN,
  beObColor: RED_70,
  beObBorderColor: RED,
  beObTextColor: RED,
  buBbColor: GREEN_70,
  buBbBorderColor: GREEN,
  buBbTextColor: GREEN,
  beBbColor: RED_70,
  beBbBorderColor: RED,
  beBbTextColor: RED,
};

const G_SET = 'Settings';
const G_BU_OB = 'Bu-OB Display Settings';
const G_BE_OB = 'Be-OB Display Settings';
const G_BU_BB = 'Bu-BB & Bu-MB Display Settings';
const G_BE_BB = 'Be-BB & Be-MB Display Settings';

export const inputConfig: InputConfig[] = [
  { id: 'zigzagLen', type: 'int', title: 'ZigZag Length', defval: 9, group: G_SET },
  { id: 'showZigzag', type: 'bool', title: 'Show Zigzag', defval: true, group: G_SET },
  { id: 'fibFactor', type: 'float', title: 'Fib Factor for breakout confirmation', defval: 0.33, min: 0, max: 1, step: 0.01, group: G_SET },
  { id: 'textSize', type: 'string', title: 'Text Size', defval: 'tiny', options: ['tiny', 'small', 'normal', 'large', 'huge'], group: G_SET },
  { id: 'deleteBoxes', type: 'bool', title: 'Delete Old/Broken Boxes', defval: true, group: G_SET },
  { id: 'buObColor', type: 'color', title: 'Color', defval: GREEN_70, group: G_BU_OB, inline: 'Bu-OB Colors' },
  { id: 'buObBorderColor', type: 'color', title: 'Border Color', defval: GREEN, group: G_BU_OB, inline: 'Bu-OB Colors' },
  { id: 'buObTextColor', type: 'color', title: 'Text Color', defval: GREEN, group: G_BU_OB, inline: 'Bu-OB Colors' },
  { id: 'beObColor', type: 'color', title: 'Color', defval: RED_70, group: G_BE_OB, inline: 'Be-OB Colors' },
  { id: 'beObBorderColor', type: 'color', title: 'Border Color', defval: RED, group: G_BE_OB, inline: 'Be-OB Colors' },
  { id: 'beObTextColor', type: 'color', title: 'Text Color', defval: RED, group: G_BE_OB, inline: 'Be-OB Colors' },
  { id: 'buBbColor', type: 'color', title: 'Color', defval: GREEN_70, group: G_BU_BB, inline: 'Bu-BB Colors' },
  { id: 'buBbBorderColor', type: 'color', title: 'Border Color', defval: GREEN, group: G_BU_BB, inline: 'Bu-BB Colors' },
  { id: 'buBbTextColor', type: 'color', title: 'Text Color', defval: GREEN, group: G_BU_BB, inline: 'Bu-BB Colors' },
  { id: 'beBbColor', type: 'color', title: 'Color', defval: RED_70, group: G_BE_BB, inline: 'Be-BB Colors' },
  { id: 'beBbBorderColor', type: 'color', title: 'Border Color', defval: RED, group: G_BE_BB, inline: 'Be-BB Colors' },
  { id: 'beBbTextColor', type: 'color', title: 'Text Color', defval: RED, group: G_BE_BB, inline: 'Be-BB Colors' },
];

// No plot(): the outputs are lines, labels and boxes
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Market Structure Break & Order Block',
  shortTitle: 'MSB-OB',
  overlay: true,
};

// indicator(..., max_lines_count = 500, max_boxes_count = 500); labels: default 50
const MAX_LINES = 500;
const MAX_BOXES = 500;
const MAX_LABELS = 50;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

/** A drawing as the script holds it: x in bar indexes (NaN = na) */
interface LineObj { x1: number; y1: number; x2: number; y2: number; color?: string; width?: number }
interface LabelObj { x: number; y: number; style: 'label_up' | 'label_down'; textColor: string }
interface BoxObj {
  left: number; top: number; right: number; bottom: number;
  bgColor: string; borderColor: string; text: string; textColor: string; deleted: boolean;
}

/** Pine drawing limit: when a creation brings the count above max + 5, the oldest are deleted until max remain. */
function register<T>(list: T[], obj: T, max: number, onDelete?: (o: T) => void): void {
  list.push(obj);
  if (list.length > max + 5) {
    const removed = list.splice(0, list.length - max);
    if (onDelete) removed.forEach(onDelete);
  }
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MarketStructureBreakOrderBlockInputs> = {},
): IndicatorResult & { lines: LineDrawingData[]; labels: LabelData[]; boxes: BoxData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const zz = Math.trunc(cfg.zigzagLen);
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  // to_up = high >= ta.highest(zigzag_len); to_down = low <= ta.lowest(zigzag_len)
  const highestArr = A(ta.highest(new Series(bars, (b) => b.high), zz));
  const lowestArr = A(ta.lowest(new Series(bars, (b) => b.low), zz));

  // Drawings alive (creation order)
  const lineObjs: LineObj[] = [];
  const labelObjs: LabelObj[] = [];
  const boxObjs: BoxObj[] = [];
  const newBox = (b: Omit<BoxObj, 'deleted'>): BoxObj => {
    const box: BoxObj = { ...b, deleted: false };
    register(boxObjs, box, MAX_BOXES, (o) => { o.deleted = true; });
    return box;
  };
  const deleteBox = (b: BoxObj | null) => {
    if (!b || b.deleted) return;
    b.deleted = true;
    const k = boxObjs.indexOf(b);
    if (k >= 0) boxObjs.splice(k, 1);
  };

  // var arrays of 5 na values
  const highPoints: number[] = new Array(5).fill(NaN);
  const highIndex: number[] = new Array(5).fill(NaN);
  const lowPoints: number[] = new Array(5).fill(NaN);
  const lowIndex: number[] = new Array(5).fill(NaN);
  const buObBoxes: Array<BoxObj | null> = new Array(5).fill(null);
  const beObBoxes: Array<BoxObj | null> = new Array(5).fill(null);
  const buBbBoxes: Array<BoxObj | null> = new Array(5).fill(null);
  const beBbBoxes: Array<BoxObj | null> = new Array(5).fill(null);

  // ta.lowest / ta.highest with a series length, ta.barssince: one site per Pine call
  const lowValSite = callsite.lowest();
  const highValSite = callsite.highest();
  const upSince = callsite.barssince();
  const downSince = callsite.barssince();
  const lowIdxSince = callsite.barssince();
  const highIdxSince = callsite.barssince();

  const toUp: boolean[] = new Array(n).fill(false);
  const toDown: boolean[] = new Array(n).fill(false);
  const l0iHist: number[] = new Array(n).fill(NaN);
  const h0iHist: number[] = new Array(n).fill(NaN);
  let trendPrev = NaN;
  let marketPrev = NaN;
  let marketIn = 1; // market as the ta.change call of last_l0 / last_h0 saw it on the previous bar
  let lastL0 = NaN, lastH0 = NaN;
  let buObIndex = NaN, beObIndex = NaN, beBbIndex = NaN, buBbIndex = NaN;

  // `for i = a to b`: counts down when a > b; no iteration when a bound is na
  const loop = (from: number, to: number, body: (k: number) => void) => {
    if (isNaN(from) || isNaN(to)) return;
    if (from <= to) for (let k = from; k <= to; k++) body(k);
    else for (let k = from; k >= to; k--) body(k);
  };
  // open[bar_index - k] / close[bar_index - k]: the bar k (na outside the bars)
  const bearish = (k: number, i: number) => k >= 0 && k <= i && gt(bars[k].open, bars[k].close);
  const bullish = (k: number, i: number) => k >= 0 && k <= i && lt(bars[k].open, bars[k].close);
  const last = (arr: number[], ind: number) => arr[arr.length - 1 - ind];

  for (let i = 0; i < n; i++) {
    const { high, low, close } = bars[i];
    toUp[i] = ge(high, highestArr[i]);
    toDown[i] = le(low, lowestArr[i]);

    // trend := nz(trend[1], 1); trend := trend == 1 and to_down ? -1 : trend == -1 and to_up ? 1 : trend
    const t0 = isNaN(trendPrev) ? 1 : trendPrev;
    const trend = t0 === 1 && toDown[i] ? -1 : t0 === -1 && toUp[i] ? 1 : t0;
    const trendChanged = i > 0 && trend !== trendPrev; // ta.change(trend) != 0 (na on the first bar)
    trendPrev = trend;

    // low_val = ta.lowest(nz(last_trend_up_since > 0 ? last_trend_up_since : 1, 1))
    const lastTrendUpSince = upSince(i > 0 && toUp[i - 1]);
    const lowVal = lowValSite(low, lastTrendUpSince > 0 ? lastTrendUpSince : 1);
    const lowIdx = i - lowIdxSince(eq(lowVal, low));
    const lastTrendDownSince = downSince(i > 0 && toDown[i - 1]);
    const highVal = highValSite(high, lastTrendDownSince > 0 ? lastTrendDownSince : 1);
    const highIdx = i - highIdxSince(eq(highVal, high));

    if (trendChanged) {
      if (trend === 1) {
        lowPoints.push(lowVal);
        lowIndex.push(lowIdx);
      }
      if (trend === -1) {
        highPoints.push(highVal);
        highIndex.push(highIdx);
      }
    }

    const h0 = last(highPoints, 0), h0i = last(highIndex, 0);
    const h1 = last(highPoints, 1), h1i = last(highIndex, 1);
    const l0 = last(lowPoints, 0), l0i = last(lowIndex, 0);
    const l1 = last(lowPoints, 1), l1i = last(lowIndex, 1);
    l0iHist[i] = l0i;
    h0iHist[i] = h0i;

    if (trendChanged && cfg.showZigzag) {
      if (trend === 1) register(lineObjs, { x1: h0i, y1: h0, x2: l0i, y2: l0 }, MAX_LINES);
      if (trend === -1) register(lineObjs, { x1: l0i, y1: l0, x2: h0i, y2: h0 }, MAX_LINES);
    }

    // market := nz(market[1], 1)
    // last_l0 = ta.valuewhen(ta.change(market) != 0, l0, 0), last_h0 likewise. At this point market holds its
    // previous value, and ta.change keeps the values it was called with: the change seen here is the market change
    // of the previous bar. So last_l0 / last_h0 are l0 / h0 one bar after the last break.
    const m0 = isNaN(marketPrev) ? 1 : marketPrev;
    if (i > 0 && m0 !== marketIn) {
      lastL0 = l0;
      lastH0 = h0;
    }
    marketIn = m0;
    const market = eq(lastL0, l0) || eq(lastH0, h0) ? m0
      : m0 === 1 && lt(l0, l1) && lt(l0, l1 - Math.abs(h0 - l1) * cfg.fibFactor) ? -1
        : m0 === -1 && gt(h0, h1) && gt(h0, h1 + Math.abs(h1 - l0) * cfg.fibFactor) ? 1 : m0;
    const marketChanged = i > 0 && market !== marketPrev; // ta.change(market) != 0
    marketPrev = market;

    // Order block and breaker block candles: the last candle of the loop that has the wanted direction
    const l0iBack = i - zz >= 0 ? l0iHist[i - zz] : NaN; // l0i[zigzag_len]
    const h0iBack = i - zz >= 0 ? h0iHist[i - zz] : NaN; // h0i[zigzag_len]
    if (isNaN(buObIndex)) buObIndex = i; // nz(bu_ob_index[1], bar_index)
    loop(h1i, l0iBack, (k) => { if (bearish(k, i)) buObIndex = k; });
    if (isNaN(beObIndex)) beObIndex = i;
    loop(l1i, h0iBack, (k) => { if (bullish(k, i)) beObIndex = k; });
    if (isNaN(beBbIndex)) beBbIndex = i;
    loop(h1i - zz, l1i, (k) => { if (bearish(k, i)) beBbIndex = k; });
    if (isNaN(buBbIndex)) buBbIndex = i;
    loop(l1i - zz, h1i, (k) => { if (bullish(k, i)) buBbIndex = k; });

    if (marketChanged) {
      if (market === 1) {
        register(lineObjs, { x1: h1i, y1: h1, x2: h0i, y2: h1, color: GREEN, width: 2 }, MAX_LINES);
        // label.new(int(math.avg(h1i, l0i)), h1, "MSB", style = label.style_label_down, ...)
        register(labelObjs, { x: Math.trunc((h1i + l0i) / 2), y: h1, style: 'label_down', textColor: GREEN }, MAX_LABELS);
        const buOb = newBox({ left: buObIndex, top: bars[buObIndex].high, right: i + 10, bottom: bars[buObIndex].low,
          bgColor: cfg.buObColor, borderColor: cfg.buObBorderColor, text: 'Bu-OB', textColor: cfg.buObTextColor });
        const buBb = newBox({ left: buBbIndex, top: bars[buBbIndex].high, right: i + 10, bottom: bars[buBbIndex].low,
          bgColor: cfg.buBbColor, borderColor: cfg.buBbBorderColor, text: lt(l0, l1) ? 'Bu-BB' : 'Bu-MB',
          textColor: cfg.buBbTextColor });
        buObBoxes.push(buOb);
        buBbBoxes.push(buBb);
      }
      if (market === -1) {
        register(lineObjs, { x1: l1i, y1: l1, x2: l0i, y2: l1, color: RED, width: 2 }, MAX_LINES);
        register(labelObjs, { x: Math.trunc((l1i + h0i) / 2), y: l1, style: 'label_up', textColor: RED }, MAX_LABELS);
        const beOb = newBox({ left: beObIndex, top: bars[beObIndex].high, right: i + 10, bottom: bars[beObIndex].low,
          bgColor: cfg.beObColor, borderColor: cfg.beObBorderColor, text: 'Be-OB', textColor: cfg.beObTextColor });
        const beBb = newBox({ left: beBbIndex, top: bars[beBbIndex].high, right: i + 10, bottom: bars[beBbIndex].low,
          bgColor: cfg.beBbColor, borderColor: cfg.beBbBorderColor, text: gt(h0, h1) ? 'Be-BB' : 'Be-MB',
          textColor: cfg.beBbTextColor });
        beObBoxes.push(beOb);
        beBbBoxes.push(beBb);
      }
    }

    // f_delete_box: removes the FIRST box of the list (not the box of the loop), and deletes it when delete_boxes
    const shiftBox = (arr: Array<BoxObj | null>) => {
      const first = arr.shift();
      if (cfg.deleteBoxes && first) deleteBox(first);
    };
    // box getters give na for an na or deleted box; setters do nothing
    const top = (b: BoxObj | null) => (b && !b.deleted ? b.top : NaN);
    const bottom = (b: BoxObj | null) => (b && !b.deleted ? b.bottom : NaN);
    const setRight = (b: BoxObj | null) => { if (b && !b.deleted) b.right = i + 10; };
    // `for box in list`: the list is read by position on each iteration, so a removal moves the next boxes
    const each = (arr: Array<BoxObj | null>, body: (b: BoxObj | null) => void) => {
      for (let k = 0; k < arr.length; k++) body(arr[k]);
    };

    each(buObBoxes, (b) => {
      if (lt(close, bottom(b))) shiftBox(buObBoxes);
      else if (lt(close, top(b))) { /* alert */ } else setRight(b);
    });
    each(beObBoxes, (b) => {
      const tp = top(b);
      const bt = bottom(b);
      if (gt(close, tp)) shiftBox(beObBoxes);
      if (gt(close, bt)) { /* alert */ } else setRight(b);
    });
    each(beBbBoxes, (b) => {
      if (gt(close, top(b))) shiftBox(beBbBoxes);
      else if (gt(close, bottom(b))) { /* alert */ } else setRight(b);
    });
    each(buBbBoxes, (b) => {
      if (lt(close, bottom(b))) shiftBox(buBbBoxes);
      else if (lt(close, top(b))) { /* alert */ } else setRight(b);
    });
  }

  // Output: a drawing with an na coordinate is not drawn
  const interval = barInterval(bars);
  const tm = (x: number) => barTime(bars, x, interval);
  const ok = (...v: number[]) => v.every((x) => !isNaN(x));
  const lines: LineDrawingData[] = [];
  for (const l of lineObjs) {
    if (!ok(l.x1, l.y1, l.x2, l.y2) || l.x1 < 0 || l.x2 < 0) continue;
    const out: LineDrawingData = { time1: tm(l.x1), price1: l.y1, time2: tm(l.x2), price2: l.y2 };
    if (l.color !== undefined) out.color = l.color;
    if (l.width !== undefined) out.width = l.width;
    lines.push(out);
  }
  const labels: LabelData[] = [];
  for (const l of labelObjs) {
    if (!ok(l.x, l.y) || l.x < 0) continue;
    // color = color.new(color.black, 100)
    labels.push({ time: tm(l.x), price: l.y, text: 'MSB', color: 'rgba(54, 58, 69, 0)', style: l.style,
      textColor: l.textColor, size: 'small' });
  }
  const boxes: BoxData[] = [];
  for (const b of boxObjs) {
    if (!ok(b.left, b.top, b.right, b.bottom) || b.left < 0) continue;
    boxes.push({ time1: tm(b.left), price1: b.top, time2: tm(b.right), price2: b.bottom, bgColor: b.bgColor,
      borderColor: b.borderColor, text: b.text, textColor: b.textColor, textHAlign: 'right',
      textSize: cfg.textSize as PineSize });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    lines,
    labels,
    boxes,
  };
}

export const MarketStructureBreakOrderBlock = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
