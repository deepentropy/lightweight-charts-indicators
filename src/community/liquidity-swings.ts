/**
 * Liquidity Swings [LuxAlgo]
 *
 * Marks the swing highs and swing lows (pivots with the same number of bars on each side) and measures the
 * activity around them. Each pivot gives an area: from the high to the top of the candle body for a swing high, from
 * the bottom of the body to the low for a swing low ("Wick Extremity"), or the full range of the pivot bar. After the
 * pivot, every bar whose range overlaps the area adds one to a count and its volume to a total. The count and the
 * volume are those of the bar "Pivot Lookback" bars back, as the pivot is known only that many bars later.
 *
 * Drawings per swing: a level line from the pivot bar (it runs 3 bars after the current bar until a close crosses the
 * level, then it stops there and becomes dashed), a box over the bars counted so far, a label with the total volume,
 * and one lighter box per side for the area of the latest pivot. Line, box and label only show when the count (or the
 * volume) is above the filter value. At most 500 lines, 500 boxes and 500 labels are kept.
 *
 * The "Intrabar Precision" option reads the bars of a lower timeframe, which the chart bars do not have: the port
 * throws an Error when it is switched on.
 *
 * Reference: "Liquidity Swings [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import { ta, str, color, callsite, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BoxData, LabelData, LineDrawingData } from '../types';
import { barInterval, barTime } from '../bar-time';

export interface LiquiditySwingsInputs {
  /** Bars on each side of a pivot */
  length: number;
  area: 'Wick Extremity' | 'Full Range';
  /** Count the volume on lower-timeframe bars (not available: throws when true) */
  intraPrecision: boolean;
  intrabarTf: string;
  filterOptions: 'Count' | 'Volume';
  filterValue: number;
  showTop: boolean;
  topCss: string;
  topAreaCss: string;
  showBtm: boolean;
  btmCss: string;
  btmAreaCss: string;
  labelSize: 'Tiny' | 'Small' | 'Normal';
}

export const defaultInputs: LiquiditySwingsInputs = {
  length: 14,
  area: 'Wick Extremity',
  intraPrecision: false,
  intrabarTf: '1',
  filterOptions: 'Count',
  filterValue: 0,
  showTop: true,
  topCss: '#FF5252',
  topAreaCss: 'rgba(255, 82, 82, 0.5)',
  showBtm: true,
  btmCss: '#00897B',
  btmAreaCss: 'rgba(0, 137, 123, 0.5)',
  labelSize: 'Tiny',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Pivot Lookback', defval: 14 },
  { id: 'area', type: 'string', title: 'Swing Area', defval: 'Wick Extremity', options: ['Wick Extremity', 'Full Range'] },
  { id: 'intraPrecision', type: 'bool', title: 'Intrabar Precision', defval: false, inline: 'intrabar' },
  { id: 'intrabarTf', type: 'timeframe', title: '', defval: '1', inline: 'intrabar' },
  { id: 'filterOptions', type: 'string', title: 'Filter Areas By', defval: 'Count', options: ['Count', 'Volume'], inline: 'filter' },
  { id: 'filterValue', type: 'float', title: '', defval: 0, inline: 'filter' },
  { id: 'showTop', type: 'bool', title: 'Swing High', defval: true, inline: 'top', group: 'Style' },
  { id: 'topCss', type: 'color', title: '', defval: '#FF5252', inline: 'top', group: 'Style' },
  { id: 'topAreaCss', type: 'color', title: 'Area', defval: 'rgba(255, 82, 82, 0.5)', inline: 'top', group: 'Style' },
  { id: 'showBtm', type: 'bool', title: 'Swing Low', defval: true, inline: 'btm', group: 'Style' },
  { id: 'btmCss', type: 'color', title: '', defval: '#00897B', inline: 'btm', group: 'Style' },
  { id: 'btmAreaCss', type: 'color', title: 'Area', defval: 'rgba(0, 137, 123, 0.5)', inline: 'btm', group: 'Style' },
  { id: 'labelSize', type: 'string', title: 'Labels Size', defval: 'Tiny', options: ['Tiny', 'Small', 'Normal'], group: 'Style' },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Liquidity Swings [LuxAlgo]',
  shortTitle: 'Liquidity Swings [LuxAlgo]',
  overlay: true,
};

/** indicator(max_lines_count = 500, max_labels_count = 500, max_boxes_count = 500) */
const MAX_OBJECTS = 500;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

interface Ln {
  x1: number;
  x2: number;
  y: number;
  color: string | null;
  dashed: boolean;
  deleted: boolean;
}
interface Bx {
  left: number;
  top: number;
  right: number;
  bottom: number;
  bg: string;
  deleted: boolean;
}
interface Lb {
  x: number;
  y: number;
  text: string;
  textColor: string;
  style: 'label_down' | 'label_up';
  deleted: boolean;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<LiquiditySwingsInputs> = {},
): Omit<IndicatorResult, 'boxes' | 'labels' | 'lines'> & { boxes: BoxData[]; labels: LabelData[]; lines: LineDrawingData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  if (cfg.intraPrecision) {
    throw new Error('Liquidity Swings: "Intrabar Precision" needs the bars of a lower timeframe, which the chart bars do not have');
  }
  const n = bars.length;
  const length = Math.trunc(cfg.length);
  const filterValue = cfg.filterValue;
  const byVolume = cfg.filterOptions === 'Volume';
  const fullRange = cfg.area === 'Full Range';
  const labelSize = cfg.labelSize === 'Small' ? 'small' : cfg.labelSize === 'Normal' ? 'normal' : 'tiny';

  const phArr = ta.pivothigh(new Series(bars, (b) => b.high), length, length).toArray();
  const plArr = ta.pivotlow(new Series(bars, (b) => b.low), length, length).toArray();

  // Live drawings in creation order: when a creation brings the count above max + 5, the oldest are deleted until
  // max remain. An object held by a `var` variable of the script (the area box of each side, and the latest zone box,
  // level line and label of each side) is never deleted by this limit, but it counts. A deleted object ignores
  // later changes.
  const held = new Set<object>();
  const limit = <T extends { deleted: boolean }>(list: T[]) => {
    if (list.length <= MAX_OBJECTS + 5) return;
    for (let k = 0; k < list.length && list.length > MAX_OBJECTS; ) {
      if (held.has(list[k])) k++;
      else list.splice(k, 1)[0].deleted = true;
    }
  };
  /** `variable := object`: the variable holds the new object and releases the one before */
  const hold = <T extends object>(before: T | null, now: T): T => {
    if (before) held.delete(before);
    held.add(now);
    return now;
  };
  const lines: Ln[] = [];
  const boxes: Bx[] = [];
  const labels: Lb[] = [];
  const newLine = (l: Omit<Ln, 'deleted'>): Ln => {
    const o = { ...l, deleted: false };
    lines.push(o);
    limit(lines);
    return o;
  };
  const newBox = (b: Omit<Bx, 'deleted'>): Bx => {
    const o = { ...b, deleted: false };
    boxes.push(o);
    limit(boxes);
    return o;
  };
  const newLabel = (l: Omit<Lb, 'deleted'>): Lb => {
    const o = { ...l, deleted: false };
    labels.push(o);
    limit(labels);
    return o;
  };

  /** One side (swing highs or swing lows) */
  const side = (isTop: boolean) => {
    const show = isTop ? cfg.showTop : cfg.showBtm;
    const css = isTop ? cfg.topCss : cfg.btmCss;
    const areaCss = isTop ? cfg.topAreaCss : cfg.btmAreaCss;
    const pivots = isTop ? phArr : plArr;
    let top = NaN;
    let btm = NaN;
    let crossed: boolean | null = null; // var bool = na
    let x1 = 0;
    // var box = box.new(na, na, na, na, bgcolor = color.new(areaCss, 80), border_color = na): made on the first bar
    let areaBox: Bx | null = null;
    // get_counts()
    let count = 0;
    let vol = 0;
    // set_zone(), set_level(), set_label()
    let zone: Bx | null = null;
    let lvl: Ln | null = null;
    let lbl: Lb | null = null;
    const zoneCross = callsite.crossover();
    const labelCross = callsite.crossover();
    let prevTarget = NaN;
    let prevCrossed: boolean | null = null;

    return (i: number) => {
      if (i === 0) {
        areaBox = hold(null, newBox({ left: NaN, top: NaN, right: NaN, bottom: NaN, bg: String(color.new(areaCss, 80)) }));
      }
      const p = pivots[i] ?? NaN;
      const isPivot = !isNaN(p) && p !== 0;
      const b = bars[i];
      const back = i >= length ? bars[i - length] : null;

      // get_counts(pivot, top, btm): the area of the bar before
      if (isPivot) {
        count = 0;
        vol = 0;
      } else {
        const inside = back !== null && lt(back.low, top) && gt(back.high, btm);
        vol += inside ? (back!.volume ?? NaN) : 0;
        count += inside ? 1 : 0;
      }

      if (isPivot && show) {
        if (isTop) {
          top = back!.high;
          btm = fullRange ? back!.low : Math.max(back!.close, back!.open);
        } else {
          top = fullRange ? back!.high : Math.min(back!.close, back!.open);
          btm = back!.low;
        }
        x1 = i - length;
        crossed = false;
        if (!areaBox!.deleted) {
          areaBox!.left = x1;
          areaBox!.top = top;
          areaBox!.right = x1;
          areaBox!.bottom = btm;
        }
      } else {
        if (isTop ? gt(b.close, top) : lt(b.close, btm)) crossed = true;
        if (!areaBox!.deleted) areaBox!.right = crossed ? x1 : i + 3;
      }

      if (!show) return;
      const target = byVolume ? vol : count;
      const above = gt(target, filterValue);

      // set_zone()
      if (zoneCross(target, filterValue)) {
        zone = hold(zone, newBox({ left: x1, top, right: x1 + count, bottom: btm, bg: areaCss }));
      }
      if (above && zone && !zone.deleted) zone.right = x1 + count;

      // set_level()
      const value = isTop ? top : btm;
      if (isPivot) {
        if (lt(prevTarget, filterValue)) {
          if (lvl && !lvl.deleted) {
            lvl.deleted = true;
            lines.splice(lines.indexOf(lvl), 1);
          }
        } else if (!prevCrossed && lvl && !lvl.deleted) {
          lvl.x2 = i - length;
        }
        lvl = hold(lvl, newLine({ x1: i - length, x2: i, y: value, color: null, dashed: false }));
      }
      if (lvl && !lvl.deleted) {
        if (!prevCrossed) lvl.x2 = i + 3;
        if (crossed && !prevCrossed) {
          lvl.x2 = i;
          lvl.dashed = true;
        }
        if (above) lvl.color = css;
      }
      prevTarget = target;
      prevCrossed = crossed;

      // set_label()
      if (labelCross(target, filterValue)) {
        lbl = hold(lbl, newLabel({
          x: x1, y: value, text: str.tostring(vol, 'volume'), textColor: css, style: isTop ? 'label_down' : 'label_up',
        }));
      }
      if (above && lbl && !lbl.deleted) lbl.text = str.tostring(vol, 'volume');
    };
  };

  const high = side(true);
  const low = side(false);
  for (let i = 0; i < n; i++) {
    high(i);
    low(i);
  }

  const interval = barInterval(bars);
  const T = (index: number) => barTime(bars, index, interval);
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    // a line or a box with an na coordinate is not drawn
    lines: lines.filter((l) => !isNaN(l.y)).map((l) => ({
      time1: T(l.x1), price1: l.y, time2: T(l.x2), price2: l.y, color: l.color ?? 'transparent',
      ...(l.dashed ? { style: 'dashed' as const } : {}),
    })),
    boxes: boxes.filter((b) => !isNaN(b.left) && !isNaN(b.top) && !isNaN(b.bottom)).map((b) => ({
      time1: T(b.left), price1: b.top, time2: T(b.right), price2: b.bottom, bgColor: b.bg, borderColor: 'transparent',
    })),
    labels: labels.map((l) => ({
      time: T(l.x), price: l.y, text: l.text, color: '#00000000', textColor: l.textColor, style: l.style, size: labelSize,
    })),
  };
}

export const LiquiditySwings = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
