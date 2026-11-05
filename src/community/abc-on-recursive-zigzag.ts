/**
 * ABC on Recursive Zigzag
 *
 * A zigzag of length `Length` (a pivot high when the bar makes the highest high of `Length` bars, a pivot low for
 * the lowest low, alternating; the last pivot moves while the price extends, and a pivot is forced after `Length`
 * bars) holds up to `Depth` pivots. Higher-level zigzags are built recursively from it: each level keeps the pivots
 * that make a higher high / lower low (|dir| = 2) and the extreme minor pivots between them, until a level has no
 * fewer pivots than the one below. On every new pivot each level (from `Minimum Zigzag Level`) is scanned for an
 * ABC: the last three pivots A, B, C where the retracement C of the move A-B is between 0.618 and 0.786 (and the
 * trade condition on the A and B pivot directions). Entry, target and stop come from the ABC extension (or the BC
 * retracement) at the entry / target / stop ratios, rounded to the tick. A pattern whose close is still before the
 * entry is drawn (lines A-B, B-C, dotted A-C, the ratio label, the A / B / C labels, entry-stop and entry-target
 * boxes) with the next colour of the theme list, and tracked: status 1 when the close reaches the entry, 2 at the
 * target; it closes at the stop (or before the entry when it is crossed back below the stop) or the bar after the
 * target, and its last status is counted per direction. At most 10 patterns are tracked with drawings; older ones are
 * tracked without. A table on the last bar shows the counts (invalid / stopped / complete), the win ratio and the
 * risk reward.
 *
 * Alerts (alert() calls, `alertCalls` of the result, once per bar): "New ABC Pattern Detected" for each new pattern
 * found on a level, "ABC Pattern Coordinates Updated" each time a tracked pattern gets a new C.
 *
 * The zigzag is the library "ZigzagLite" (version 3), the drawing types "Drawing" (version 2), the theme colours
 * "utils" (version 1) and the ratios "FibRatios" (version 1) by Trendoscope; the functions used are written in this
 * file.
 *
 * Chart values read: the price tick (targets rounded with round_to_mintick) and the chart background colour (table
 * border). Without a chart context: tick 0.01 and the dark theme colour.
 *
 * Reference: "ABC on Recursive Zigzag [Trendoscope]" by Trendoscope
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Trendoscope Pty Ltd
 */

import {
  taCore, math, str, color, compare, line, label, box, resetDrawings, setDrawingBar, drawingOutputs,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import type { AlertCall, TableData } from '../types';
import { backgroundColorOf, mintickOf, type ChartContext } from '../chart-context';

/** The original makes alert() calls */
export const hasAlertFunction = true;

type Line = ReturnType<typeof line.new>;
type Label = ReturnType<typeof label.new>;
type Box = ReturnType<typeof box.new>;

export interface AbcOnRecursiveZigzagInputs {
  theme: 'DARK' | 'LIGHT';
  zigzagLength: number;
  depth: number;
  minimumZigZagLevel: number;
  base: 'ABC Extension' | 'BC Retracement';
  entryRatio: number;
  targetRatio: number;
  stopRatio: number;
  logScale: boolean;
  useClosePricesForEntry: boolean;
  useClosePricesForTarget: boolean;
  useClosePricesForStop: boolean;
  useClosePricesForRetest: boolean;
  tradeCondition: 'any' | 'trend' | 'reverse' | 'contracting' | 'expanding';
}

export const defaultInputs: AbcOnRecursiveZigzagInputs = {
  theme: 'DARK',
  zigzagLength: 13,
  depth: 200,
  minimumZigZagLevel: 0,
  base: 'ABC Extension',
  entryRatio: 0.3,
  targetRatio: 1.0,
  stopRatio: 0.0,
  logScale: false,
  useClosePricesForEntry: true,
  useClosePricesForTarget: true,
  useClosePricesForStop: true,
  useClosePricesForRetest: true,
  tradeCondition: 'any',
};

const TRADE_CONDITION_TOOLTIP = 'any - no filter\ntrend - Both A and B pivots in the direction of trend. Example, HH, and HL for long signal and LH and LL for short signal\n'
  + 'reverse - Both A and B pivots in the opposite direction of trend. Example, LH, and LL for long signal and HH and HL for short signal\n'
  + 'contracting - Consider only if both A and B pivots are either LH or HL\nexpanding - Consider only if both A and B pivots are either HH or LL';

export const inputConfig: InputConfig[] = [
  { id: 'theme', type: 'string', title: 'Theme', defval: 'DARK', options: ['DARK', 'LIGHT'], group: 'Generic Settings', display: 'none',
    tooltip: 'Chart theme settings. Line and label colors are generted based on the theme settings. If dark theme is selected, lighter colors are used and if light theme is selected, darker colors are used.' },
  { id: 'zigzagLength', type: 'int', title: 'Length', defval: 13, step: 5, min: 3, group: 'Zigzag', display: 'none',
    tooltip: 'Zigzag length for level 0 zigzag' },
  { id: 'depth', type: 'int', title: 'Depth', defval: 200, step: 25, max: 500, group: 'Zigzag', display: 'none',
    tooltip: 'Zigzag depth refers to max number of pivots to show on chart' },
  { id: 'minimumZigZagLevel', type: 'int', title: 'Minimum Zigzag Level', defval: 0, min: 0, group: 'Zigzag', display: 'none',
    tooltip: 'Minimum zigzag level to consider for pattern scanning' },
  { id: 'base', type: 'string', title: 'Base', defval: 'ABC Extension', options: ['ABC Extension', 'BC Retracement'], group: 'ABC', display: 'none',
    tooltip: 'Base on which entry, stop and target are calculated' },
  { id: 'entryRatio', type: 'float', title: 'Entry Ratio', defval: 0.3, min: 0.1, step: 0.1, group: 'ABC', display: 'none',
    tooltip: 'Entry ratio for the calculation of entry level' },
  { id: 'targetRatio', type: 'float', title: 'Target Ratio', defval: 1.0, group: 'ABC', display: 'none',
    tooltip: 'Target Ratio for the calculation of target level' },
  { id: 'stopRatio', type: 'float', title: 'Stop Ratio', defval: 0.0, max: 0.0, step: 0.1, group: 'ABC', display: 'none',
    tooltip: 'Stop Ratio for the calculation of stop level' },
  { id: 'logScale', type: 'bool', title: 'Log Scale', defval: false, group: 'ABC', display: 'none',
    tooltip: 'Use log scale for scanning and targets' },
  { id: 'useClosePricesForEntry', type: 'bool', title: 'Entry', defval: true, group: 'Use Close Prices', inline: 'ucp', display: 'none',
    tooltip: 'Use close prices for tracking' },
  { id: 'useClosePricesForTarget', type: 'bool', title: 'Target', defval: true, group: 'Use Close Prices', inline: 'ucp', display: 'none',
    tooltip: 'Use close prices for tracking' },
  { id: 'useClosePricesForStop', type: 'bool', title: 'Stop', defval: true, group: 'Use Close Prices', inline: 'ucp', display: 'none',
    tooltip: 'Use close prices for tracking' },
  { id: 'useClosePricesForRetest', type: 'bool', title: 'Retest', defval: true, group: 'Use Close Prices', inline: 'ucp', display: 'none',
    tooltip: 'Use close prices for tracking' },
  { id: 'tradeCondition', type: 'string', title: 'Trade Condition', defval: 'any', options: ['any', 'trend', 'reverse', 'contracting', 'expanding'],
    group: 'ABC', display: 'none', tooltip: TRADE_CONDITION_TOOLTIP },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'ABC on Recursive Zigzag [Trendoscope]',
  shortTitle: 'ABC-RZ[Trendoscope]',
  overlay: true,
};

/** indicator(max_lines_count = 500, max_labels_count = 500); boxes: the default 50 */
const MAX_LINES = 500;
const MAX_LABELS = 500;
const MAX_BOXES = 50;

/** utils.getColors(): theme colours */
const DARK_COLORS = [
  [251, 244, 109], [141, 186, 81], [74, 159, 245], [255, 153, 140], [255, 149, 0], [0, 234, 211], [167, 153, 183],
  [255, 210, 113], [119, 217, 112], [95, 129, 228], [235, 146, 190], [198, 139, 89], [200, 149, 149], [196, 182, 182],
  [255, 190, 15], [192, 226, 24], [153, 140, 235], [206, 31, 107], [251, 54, 64], [194, 255, 217], [255, 219, 197],
  [121, 180, 183],
];
const LIGHT_COLORS = [
  [61, 86, 178], [57, 163, 136], [250, 30, 14], [169, 51, 58], [225, 87, 138], [62, 124, 23], [244, 164, 66],
  [134, 72, 121], [113, 159, 176], [170, 46, 230], [161, 37, 104], [189, 32, 0], [16, 86, 82], [200, 92, 92],
  [63, 51, 81], [114, 106, 149], [171, 109, 35], [247, 136, 18], [51, 71, 86], [12, 123, 147], [195, 43, 173],
];

/** ZigzagLite: a zigzag pivot (chart point: bar index and price; the point object is shared by the copies) */
interface Point {
  index: number;
  price: number;
}
interface Pivot {
  point: Point;
  dir: number;
  level: number;
  /**
   * Price ratio to the swing before, not rounded: the library rounds it to 3 decimals on every new pivot, here it is
   * rounded where it is read (the next levels are built again on every new pivot and most ratios are never read). The
   * size and bar ratios of the library are not kept: nothing reads them.
   */
  ratio: number;
}
interface Zigzag {
  length: number;
  numberOfPivots: number;
  level: number;
  pivots: Pivot[];
  newPivot: boolean;
}

const newPivot = (point: Point, dir: number): Pivot => ({ point, dir, level: 0, ratio: 1.0 });
const newZigzag = (length: number, numberOfPivots: number): Zigzag => ({ length, numberOfPivots, level: 0, pivots: [], newPivot: false });

/** ZigzagLite addnewpivot(): direction (2 for a higher high / lower low) and ratios, then unshift with the depth */
function addNewPivot(z: Zigzag, pivot: Pivot): void {
  const dir = Math.sign(pivot.dir);
  if (z.pivots.length >= 1) {
    const lastPivot = z.pivots[0];
    const lastValue = lastPivot.point.price;
    if (Math.sign(lastPivot.dir) === Math.sign(dir)) throw new Error('Direction mismatch');
    if (z.pivots.length >= 2) {
      const llastPivot = z.pivots[1];
      const value = pivot.point.price;
      const llastValue = llastPivot.point.price;
      pivot.dir = compare.gt(dir * value, dir * llastValue) ? dir * 2 : dir;
      pivot.ratio = Math.abs(lastValue - value) / Math.abs(llastValue - lastValue);
    }
  }
  z.pivots.unshift(pivot);
  if (z.pivots.length > z.numberOfPivots) z.pivots.pop();
}

/** ZigzagLite nextlevel(): the zigzag of the next level built from the pivots of this one */
function nextLevel(z: Zigzag): Zigzag {
  const next = newZigzag(z.length, z.numberOfPivots);
  next.level = z.level + 1;
  if (z.pivots.length > 0) {
    let tempBullish: Pivot | null = null;
    let tempBearish: Pivot | null = null;
    for (let i = z.pivots.length - 1; i >= 0; i--) {
      const lPivot: Pivot = { ...z.pivots[i] }; // Pivot.copy(): the point is shared
      const dir = lPivot.dir;
      const newDir = Math.sign(dir);
      const value = lPivot.point.price;
      lPivot.level = lPivot.level + 1;
      if (next.pivots.length > 0) {
        const lastPivot = next.pivots[0];
        const lastDir = Math.sign(lastPivot.dir);
        const lastValue = lastPivot.point.price;
        if (Math.abs(dir) === 2) {
          if (lastDir === newDir) {
            if (compare.lt(dir * lastValue, dir * value)) {
              next.pivots.shift();
            } else {
              const tempPivot = newDir > 0 ? tempBearish : tempBullish;
              if (tempPivot) addNewPivot(next, tempPivot);
              else continue;
            }
          } else {
            const tempFirst = newDir > 0 ? tempBullish : tempBearish;
            const tempSecond = newDir > 0 ? tempBearish : tempBullish;
            if (tempFirst && tempSecond) {
              if (compare.gt(newDir * tempFirst.point.price, newDir * lPivot.point.price)) {
                addNewPivot(next, tempFirst);
                addNewPivot(next, tempSecond);
              }
            }
          }
          addNewPivot(next, lPivot);
          tempBullish = null;
          tempBearish = null;
        } else {
          const tempPivot = newDir > 0 ? tempBullish : tempBearish;
          if (tempPivot) {
            if (compare.gt(lPivot.point.price * dir, tempPivot.point.price * dir)) {
              if (newDir > 0) tempBullish = lPivot;
              else tempBearish = lPivot;
            }
          } else if (newDir > 0) {
            tempBullish = lPivot;
          } else {
            tempBearish = lPivot;
          }
        }
      } else if (Math.abs(dir) === 2) {
        addNewPivot(next, lPivot);
      }
    }
  }
  if (next.pivots.length >= z.pivots.length) next.pivots = [];
  return next;
}

/** Drawing objects of a pattern (Drawing library objects: the last object made by draw()) */
interface AbcDrawing {
  lines: Array<{ from: Point; to: Point; width: number; style: 'solid' | 'dotted'; object: Line | null }>;
  labels: Array<{ point: Point; text: string; yloc: 'price' | 'abovebar' | 'belowbar'; object: Label | null }>;
  boxes: Array<{ p1: Point; p2: Point; bgcolor: string; object: Box | null }>;
}

interface Abc {
  direction: number;
  a: Pivot;
  b: Pivot;
  c: Pivot;
  patternColor: string;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  status: number;
  drawing: AbcDrawing | null;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<AbcOnRecursiveZigzagInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { tables: TableData[]; alertCalls: AlertCall[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const { gt, ge, le, lt, eq } = compare;
  const mintick = mintickOf(chart);
  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);
  const length = cfg.zigzagLength;
  // PivotCandle.init(): ta.highestbars / lowestbars / highest / lowest of max(high, low) / min(high, low), every bar
  const pHighBar = taCore.highestbars(high, length);
  const pLowBar = taCore.lowestbars(low, length);
  const pHighArr = taCore.highest(high, length);
  const pLowArr = taCore.lowest(low, length);

  const condition = { any: 0, trend: 1, reverse: 2, contracting: 3, expanding: 4 }[cfg.tradeCondition] ?? 4;
  const baseVal = cfg.base === 'ABC Extension' ? 1 : 2;

  // FibRatios (precision -1: round_to_mintick; 3 for the ratio)
  const roundTo = (value: number, precision: number) => (precision < 0 ? math.round_to_mintick(value, mintick) : math.round(value, precision));
  const retracement = (a: number, b: number, ratio: number) => roundTo(cfg.logScale ? b * Math.pow(a / b, ratio) : b - (b - a) * ratio, -1);
  const retracementRatio = (a: number, b: number, c: number) => roundTo(cfg.logScale ? Math.log(c / b) / Math.log(a / b) : (b - c) / (b - a), 3);
  const extension = (a: number, b: number, c: number, ratio: number) => roundTo(cfg.logScale ? c * Math.pow(b / a, ratio) : c + (b - a) * ratio, -1);

  const zigzag = newZigzag(length, cfg.depth);
  const abcdPatterns: Abc[] = [];
  const oldPatterns: Abc[] = [];
  const bullishCounts = [0, 0, 0];
  const bearishCounts = [0, 0, 0];
  const alertCalls: AlertCall[] = [];
  let barTime = 0;
  const themeColors = (cfg.theme === 'DARK' ? DARK_COLORS : LIGHT_COLORS).map(([r, g, b]) => String(color.rgb(r, g, b)));

  const calculateTargets = (p: Abc) => {
    const a = p.a.point.price;
    const b = p.b.point.price;
    const c = p.c.point.price;
    p.entryPrice = baseVal === 1 ? extension(a, b, c, cfg.entryRatio) : retracement(b, c, cfg.entryRatio);
    p.targetPrice = baseVal === 1 ? extension(a, b, c, cfg.targetRatio) : retracement(b, c, cfg.targetRatio);
    p.stopPrice = baseVal === 1 ? extension(a, b, c, cfg.stopRatio) : retracement(b, c, cfg.stopRatio);
    return p;
  };
  const withinEntry = (p: Abc, close: number) => {
    const dir = gt(p.c.point.price, p.b.point.price) ? -1 : 1;
    return lt(close * dir, p.entryPrice * dir);
  };

  // Drawing library: delete() deletes the object, draw() deletes it and makes a new one
  const deleteDrawing = (p: Abc) => {
    const d = p.drawing;
    if (d) {
      for (const l of d.lines) if (l.object) line.delete(l.object);
      for (const l of d.labels) if (l.object) label.delete(l.object);
      for (const b of d.boxes) if (b.object) box.delete(b.object);
      p.drawing = null;
    }
    return p;
  };
  const draw = (p: Abc) => {
    const d = p.drawing;
    if (!d) return p; // log.info('this should not be na')
    const col = p.patternColor;
    // ab, bc, ac, abcRatio, a, b, c, entryBox, targetBox
    for (const l of d.lines) {
      if (l.object) line.delete(l.object);
      l.object = line.new(l.from.index, l.from.price, l.to.index, l.to.price, 'bar_index', 'none', col, l.style, l.width);
    }
    for (const l of d.labels) {
      if (l.object) label.delete(l.object);
      l.object = label.new(l.point.index, l.point.price, l.text, 'bar_index', l.yloc, color.blue, 'none', col, 'normal', 'center');
    }
    for (const b of d.boxes) {
      if (b.object) box.delete(b.object);
      b.object = box.new(Math.min(b.p1.index, b.p2.index), Math.max(b.p1.price, b.p2.price), Math.max(b.p1.index, b.p2.index),
        Math.min(b.p1.price, b.p2.price), col, 1, 'solid', 'none', 'bar_index', b.bgcolor, undefined, undefined, '#FFFFFF');
    }
    return p;
  };
  const createDrawing = (p: Abc) => {
    if (p.drawing) deleteDrawing(p);
    const a = p.a.point;
    const b = p.b.point;
    const c = p.c.point;
    // chart.point index fields truncate a fractional value
    const acMid: Point = { index: Math.trunc((a.index + c.index) / 2), price: (a.price + c.price) / 2 };
    const abcRatioValue = retracementRatio(a.price, b.price, c.price);
    const acYloc = lt(a.price, b.price) ? 'belowbar' : 'abovebar';
    const bdYloc = gt(a.price, b.price) ? 'belowbar' : 'abovebar';
    const entryPoint: Point = { index: c.index, price: p.entryPrice };
    const barDiff = Math.min((c.index - a.index) / 2, 490);
    const endIndex = Math.trunc(c.index + barDiff);
    p.drawing = {
      lines: [
        { from: a, to: b, width: 1, style: 'solid', object: null },
        { from: b, to: c, width: 1, style: 'solid', object: null },
        { from: a, to: c, width: 0, style: 'dotted', object: null },
      ],
      labels: [
        { point: acMid, text: str.tostring(abcRatioValue), yloc: 'price', object: null },
        { point: a, text: 'A', yloc: acYloc, object: null },
        { point: b, text: 'B', yloc: bdYloc, object: null },
        { point: c, text: 'C', yloc: acYloc, object: null },
      ],
      boxes: [
        { p1: entryPoint, p2: { index: endIndex, price: p.stopPrice }, bgcolor: String(color.new(color.red, 90)), object: null },
        { p1: entryPoint, p2: { index: endIndex, price: p.targetPrice }, bgcolor: String(color.new(color.green, 90)), object: null },
      ],
    };
    return p;
  };

  const record = (p: Abc) => {
    const counts = p.direction > 0 ? bullishCounts : bearishCounts;
    counts[p.status] += 1;
  };
  const traverse = (patterns: Abc[], bar: Bar) => {
    for (let i = patterns.length - 1; i >= 0; i--) {
      const p = patterns[i];
      const d = p.direction;
      const baseTarget = cfg.useClosePricesForTarget ? bar.close : d > 0 ? bar.high : bar.low;
      const baseStop = cfg.useClosePricesForStop ? bar.close : d > 0 ? bar.low : bar.high;
      const baseEntry = cfg.useClosePricesForEntry ? bar.close : d > 0 ? bar.high : bar.low;
      let newStatus = ge(baseTarget * d, p.targetPrice * d) ? 2 : ge(baseEntry * d, p.entryPrice * d) ? 1 : p.status;
      newStatus = Math.max(p.status, newStatus);
      const closed = (newStatus > 0 && le(baseStop * d, p.stopPrice * d))
        || (newStatus === 0 && le(bar.close * d, p.stopPrice * d)) || p.status === 2;
      p.status = newStatus;
      if (closed) {
        // removePattern(): remove, delete the drawing, count the status
        patterns.splice(i, 1);
        deleteDrawing(p);
        record(p);
      }
    }
  };

  const scanAbc = (z: Zigzag, close: number) => {
    let isAbc = false;
    if (z.pivots.length >= 4) {
      const c = z.pivots[0];
      const b = z.pivots[1];
      const a = z.pivots[2];
      const aDir = Math.abs(a.dir);
      const bDir = Math.abs(b.dir);
      const conditionInLine = condition === 0 || (condition === 1 && aDir === 1 && bDir === 2)
        || (condition === 2 && aDir === 2 && bDir === 1) || (condition === 3 && aDir === 1 && bDir === 1)
        || (condition === 4 && aDir === 2 && bDir === 2);
      const ratio = math.round(c.ratio, 3);
      const ratioInLine = ge(ratio, 0.618) && le(ratio, 0.786);
      if (ratioInLine && conditionInLine) {
        isAbc = true;
        for (const p of abcdPatterns) {
          const existingPattern = eq(p.a.point.price, a.point.price) && eq(p.b.point.price, b.point.price);
          if (existingPattern) {
            if (p.c.point.index > c.point.index && p.status === 0) {
              // update(): new C, targets, and a new drawing when the close is before the entry
              p.c = c;
              // alert('ABC Pattern Coordinates Updated')
              alertCalls.push({ time: barTime, message: 'ABC Pattern Coordinates Updated', freq: 'once_per_bar' });
              calculateTargets(p);
              if (withinEntry(p, close)) draw(createDrawing(deleteDrawing(p)));
            }
            isAbc = false;
            break;
          }
        }
      }
    }
    return isAbc;
  };

  resetDrawings({ line: MAX_LINES, label: MAX_LABELS, box: MAX_BOXES });
  for (let bi = 0; bi < n; bi++) {
    setDrawingBar(bi, bi === n - 1);
    const bar = bars[bi];
    barTime = bar.time as number;

    // zigzag.calculate(array.from(high, low))
    {
      const z = zigzag;
      const pHB = pHighBar[bi];
      const pLB = pLowBar[bi];
      const pHigh = pHighArr[bi];
      const pLow = pLowArr[bi];
      let pDir = 1;
      let lastPivot: Pivot | null = null;
      z.newPivot = false;
      let distanceFromLastPivot = 0;
      let forceDoublePivot = false;
      if (z.pivots.length > 0) {
        lastPivot = z.pivots[0];
        pDir = Math.sign(lastPivot.dir);
        distanceFromLastPivot = bi - lastPivot.point.index;
      }
      if (z.pivots.length > 1) {
        const llastPivot = z.pivots[1];
        forceDoublePivot = pDir === 1 && pLB === 0 ? lt(pLow, llastPivot.point.price)
          : pDir === -1 && pHB === 0 ? gt(pHigh, llastPivot.point.price) : false;
      }
      const overflow = distanceFromLastPivot >= z.length;
      if (((pDir === 1 && pHB === 0) || (pDir === -1 && pLB === 0)) && z.pivots.length >= 1 && lastPivot) {
        const value = pDir === 1 ? pHigh : pLow;
        const removeOld = ge(value * lastPivot.dir, lastPivot.point.price * lastPivot.dir);
        if (removeOld) {
          z.newPivot = true;
          z.pivots.shift();
          addNewPivot(z, newPivot({ index: bi, price: value }, pDir));
        }
      }
      if ((pDir === 1 && pLB === 0) || (pDir === -1 && pHB === 0 && (!z.newPivot || forceDoublePivot))) {
        const value = pDir === 1 ? pLow : pHigh;
        addNewPivot(z, newPivot({ index: bi, price: value }, -pDir));
        z.newPivot = true;
      }
      if (overflow && !z.newPivot) {
        const ipivot = pDir === 1 ? pLow : pHigh;
        const ipivotbar = pDir === 1 ? bi + pLB : bi + pHB;
        addNewPivot(z, newPivot({ index: ipivotbar, price: ipivot }, -pDir));
        z.newPivot = true;
      }
    }

    traverse(abcdPatterns, bar);
    traverse(oldPatterns, bar);

    if (zigzag.newPivot) {
      let ml = zigzag;
      while (ml.pivots.length >= 3) {
        if (ml.level >= cfg.minimumZigZagLevel) {
          if (scanAbc(ml, bar.close)) {
            const patternColor = themeColors.shift() as string;
            // alert('New ABC Pattern Detected')
            alertCalls.push({ time: barTime, message: 'New ABC Pattern Detected', freq: 'once_per_bar' });
            // createAbc(): the last three pivots
            const c = ml.pivots[0];
            const b = ml.pivots[1];
            const a = ml.pivots[2];
            const pattern: Abc = calculateTargets({
              direction: gt(b.point.price, c.point.price) ? 1 : -1, a, b, c, patternColor,
              entryPrice: NaN, stopPrice: NaN, targetPrice: NaN, status: 0, drawing: null,
            });
            if (withinEntry(pattern, bar.close)) {
              draw(createDrawing(pattern));
              abcdPatterns.push(pattern);
              while (abcdPatterns.length > 10) {
                const last = abcdPatterns.shift() as Abc;
                oldPatterns.push(last);
                deleteDrawing(last);
              }
            }
            themeColors.push(patternColor);
          }
        }
        ml = nextLevel(ml);
      }
    }

    while (abcdPatterns.length < 10 && oldPatterns.length > 0) {
      const restoreOld = oldPatterns.pop() as Abc;
      abcdPatterns.unshift(restoreOld);
      draw(restoreOld); // its drawing was deleted: nothing is drawn
    }
  }
  setDrawingBar(null);

  // Table of the last bar
  const tables: TableData[] = [];
  if (n > 0) {
    const maroon = color.maroon;
    const white = '#FFFFFF';
    const cells: TableData['cells'] = [];
    const cell = (column: number, row: number, text: string, bgColor: string) => {
      cells.push({ column, row, text, textColor: white, bgColor, textSize: 'auto' });
    };
    cell(0, 0, 'Direction\\Status', maroon);
    cell(1, 0, 'Invalid', maroon);
    cell(2, 0, 'Stopped', maroon);
    cell(3, 0, 'Complete', maroon);
    cell(4, 0, 'Win Ratio', maroon);
    cell(5, 0, 'Risk Reward', maroon);
    cell(0, 1, 'Bullish', String(color.new(color.green, 50)));
    cell(0, 2, 'Bearish', String(color.new(color.red, 50)));
    const riskReward = (cfg.targetRatio - cfg.entryRatio) / (cfg.entryRatio - cfg.stopRatio);
    const rows: Array<[number, number[], string]> = [
      [1, bullishCounts, String(color.new(color.green, 70))],
      [2, bearishCounts, String(color.new(color.red, 70))],
    ];
    for (const [row, counts, bg] of rows) {
      const [invalid, stopped, completed] = counts;
      cell(1, row, str.tostring(invalid), bg);
      cell(2, row, str.tostring(stopped), bg);
      cell(3, row, str.tostring(completed), bg);
      cell(4, row, str.tostring((completed * 100) / (completed + stopped), 'percent'), bg);
      cell(5, row, str.tostring(riskReward, '#.##'), bg);
    }
    tables.push({ position: 'top_right', columns: 6, rows: 3, cells, borderColor: backgroundColorOf(chart) });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    ...drawingOutputs(bars),
    tables,
    alertCalls,
  };
}

export const AbcOnRecursiveZigzag = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hasAlertFunction,
};
