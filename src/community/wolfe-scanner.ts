/**
 * Wolfe Scanner (Multi - zigzag)
 *
 * A zigzag of length `Length` (a pivot high when the bar makes the highest high of `Length` bars, a pivot low for
 * the lowest low, alternating; the last pivot moves while the price extends, and a pivot is forced after `Length`
 * bars without one) keeps up to `Depth` pivots. Higher-level zigzags are built recursively from it (each level keeps
 * the pivots that make a higher high / lower low and the extreme minor pivots between them, until a level has no
 * fewer pivots than the one below). On every new pivot, for each level from `Min Level` that still has 5 pivots or
 * more, the last 5 pivots of the BASE zigzag are tested (as in the original, the higher levels only set how many
 * times the test runs): pivot 2 is the extreme against the direction, pivot 5 the extreme in the direction, and
 * pivot 1 lies between 3 and 4. Then a line through pivots 1-5 and a line through 2-4 (taken from bar 1 to bar 5)
 * must contract with both slopes of the same sign; the pattern is a Wolfe wave when the lines meet within
 * min(500, 2 x width) bars after pivot 5. Each tested pattern takes the next colour of the theme list (the list
 * turns by one). A Wolfe wave keeps its two wedge lines up to the meeting point, the dotted zigzag legs ("Draw
 * Zigzag") and the dashed projection from pivot 1 through pivot 4 to the meeting bar with a vertical line to the
 * meeting price ("Draw Projection"); other tested patterns are deleted. A pattern that shares 3 pivot bars with one
 * of the last 10 Wolfe waves (or, with "Suppress Overlap", starts inside one of them) is not tested. At most 500 lines
 * are kept.
 *
 * Alerts (alert() calls, `alertCalls` of the result, once per bar): "New Wolfe Wave Identified" on each Wolfe wave.
 *
 * The zigzag is the library "rzigzag" (version 10) by HeWhoMustNotBeNamed (Trendoscope) with "_matrix" (version 5)
 * of the same author; the functions used are written in this file.
 *
 * Reference: "Wolfe Scanner [Trendoscope®]" by Trendoscope
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Trendoscope Pty Ltd, Trendoscope®
 */

import {
  ta, color, Series, line, resetDrawings, setDrawingBar, drawingOutputs,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import type { AlertCall } from '../types';
import type { StudyDrawingKind } from '../style-outputs';

/** The original makes alert() calls */
export const hasAlertFunction = true;

export interface WolfeScannerInputs {
  /** Theme */
  theme: 'Light' | 'Dark';
  /** Suppress Overlap */
  avoidOverlap: boolean;
  /** Draw Zigzag */
  drawZigzag: boolean;
  /** Draw Projection */
  drawProjection: boolean;
  /** Zigzag Length */
  zigzagLength: number;
  /** Zigzag Depth */
  zigzagDepth: number;
  /** Min Level */
  minLevel: number;
}

export const defaultInputs: WolfeScannerInputs = {
  theme: 'Dark',
  avoidOverlap: false,
  drawZigzag: true,
  drawProjection: true,
  zigzagLength: 3,
  zigzagDepth: 250,
  minLevel: 2,
};

export const inputConfig: InputConfig[] = [
  {
    id: 'theme', type: 'string', title: 'Theme', defval: 'Dark', options: ['Light', 'Dark'], group: 'Generic',
    tooltip: 'Chart theme settings. Line and label colors are generted based on the theme settings. If dark theme is selected, '
      + 'lighter colors are used and if light theme is selected, darker colors are used.',
  },
  {
    id: 'avoidOverlap', type: 'bool', title: 'Suppress Overlap', defval: false, group: 'Generic',
    tooltip: 'Avoids plotting wedge if there is an existing wedge at starting point. This does not avoid nesting wedges (Wedge within wedge)',
  },
  { id: 'drawZigzag', type: 'bool', title: 'Draw Zigzag', defval: true, group: 'Generic', tooltip: 'Draw zigzag lines and mark pivots within wedge' },
  { id: 'drawProjection', type: 'bool', title: 'Draw Projection', defval: true, group: 'Generic', tooltip: 'Draw Wolfe projection' },
  { id: 'zigzagLength', type: 'int', title: 'Length', defval: 3, min: 3, step: 5, group: 'Zigzag' },
  { id: 'zigzagDepth', type: 'int', title: 'Depth', defval: 250, min: 3, step: 5, group: 'Zigzag' },
  { id: 'minLevel', type: 'int', title: 'Min Level', defval: 2, min: 1, group: 'Zigzag', tooltip: 'Min Level to calculate Wolfe' },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['line'];

export const metadata = {
  title: 'Wolfe Scanner [Trendoscope®]',
  shortTitle: 'Wolfe [Trendoscope®]',
  overlay: true,
};

const rgb = (r: number, g: number, b: number) => String(color.rgb(r, g, b));

const DARK = [
  rgb(251, 244, 109), rgb(141, 186, 81), rgb(74, 159, 245), rgb(255, 153, 140), rgb(255, 149, 0), rgb(0, 234, 211),
  rgb(167, 153, 183), rgb(255, 210, 113), rgb(119, 217, 112), rgb(95, 129, 228), rgb(235, 146, 190), rgb(198, 139, 89),
  rgb(200, 149, 149), rgb(196, 182, 182), rgb(255, 190, 15), rgb(192, 226, 24), rgb(153, 140, 235), rgb(206, 31, 107),
  rgb(251, 54, 64), rgb(194, 255, 217), rgb(255, 219, 197), rgb(121, 180, 183),
];
const LIGHT = [
  rgb(61, 86, 178), rgb(57, 163, 136), rgb(250, 30, 14), rgb(169, 51, 58), rgb(225, 87, 138), rgb(62, 124, 23),
  rgb(244, 164, 66), rgb(134, 72, 121), rgb(113, 159, 176), rgb(170, 46, 230), rgb(161, 37, 104), rgb(189, 32, 0),
  rgb(16, 86, 82), rgb(200, 92, 92), rgb(63, 51, 81), rgb(114, 106, 149), rgb(171, 109, 35), rgb(247, 136, 18),
  rgb(51, 71, 86), rgb(12, 123, 147), rgb(195, 43, 173),
];

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && a - b <= EPS;

/** A zigzag pivot: [price, bar index, bar time, direction (+-1, +-2 for a higher high / lower low), level] */
type Row = number[];

/** rzigzag addnewpivot(): the direction becomes +-2 when the pivot goes beyond the pivot two back; ma.unshift() */
function addNewPivot(m: Row[], pivot: Row, max: number): void {
  const dir = Math.sign(pivot[3]);
  if (m.length >= 1) {
    if (Math.sign(m[0][3]) === Math.sign(dir)) throw new Error('Direction mismatch');
    if (m.length >= 2) {
      const value = pivot[0];
      const llastValue = m[1][0];
      pivot[3] = gt(dir * value, dir * llastValue) ? dir * 2 : dir;
    }
  }
  m.unshift(pivot.slice());
  if (m.length > max) m.pop();
}

/**
 * addNewPivot() on a zigzag kept with its newest pivot last (the pivot is not copied: the callers pass their own copy)
 */
function pushPivot(m: Row[], pivot: Row, max: number): void {
  const dir = Math.sign(pivot[3]);
  const k = m.length;
  if (k >= 1) {
    if (Math.sign(m[k - 1][3]) === Math.sign(dir)) throw new Error('Direction mismatch');
    if (k >= 2) {
      const value = pivot[0];
      const llastValue = m[k - 2][0];
      pivot[3] = gt(dir * value, dir * llastValue) ? dir * 2 : dir;
    }
  }
  m.push(pivot);
  if (m.length > max) m.shift();
}

/**
 * rzigzag nextlevel(): the next level zigzag of a zigzag (empty when it has no fewer pivots). It is built with its
 * newest pivot last and reversed at the end: adding each pivot at the front moved the whole array every time.
 */
function nextLevel(m: Row[], max: number): Row[] {
  const ml: Row[] = [];
  if (m.length > 0) {
    // the highest high / lowest low since the last level pivot: rows of m, copied with the level count when added
    let bullish: Row | null = null;
    let bearish: Row | null = null;
    const copy = (src: Row): Row => {
      const row = src.slice();
      row[4] = row[4] + 1;
      return row;
    };
    for (let i = m.length - 1; i >= 0; i--) {
      const src = m[i];
      const dir = src[3];
      const newDir = Math.sign(dir);
      const value = src[0];
      if (ml.length > 0) {
        const lastDir = Math.sign(ml[ml.length - 1][3]);
        const lastPivot = ml[ml.length - 1][0];
        if (Math.abs(dir) === 2) {
          if (lastDir === newDir) {
            if (lt(dir * lastPivot, dir * value)) {
              ml.pop();
            } else {
              const tempRow = newDir > 0 ? bearish : bullish;
              if (tempRow) pushPivot(ml, copy(tempRow), max);
              else continue;
            }
          } else {
            const first = newDir > 0 ? bullish : bearish;
            const second = newDir > 0 ? bearish : bullish;
            if (first && second) {
              if (gt(newDir * first[0], newDir * value)) {
                pushPivot(ml, copy(first), max);
                pushPivot(ml, copy(second), max);
              }
            }
          }
          pushPivot(ml, copy(src), max);
          bearish = null;
          bullish = null;
        } else {
          const tempRow = newDir > 0 ? bullish : bearish;
          if (!tempRow || gt(value * dir, tempRow[0] * dir)) {
            if (newDir > 0) bullish = src;
            else bearish = src;
          }
        }
      } else if (Math.abs(dir) === 2) {
        pushPivot(ml, copy(src), max);
      }
    }
  }
  return ml.length >= m.length ? [] : ml.reverse();
}

export function calculate(bars: Bar[], inputs: Partial<WolfeScannerInputs> = {}): IndicatorResult & { alertCalls: AlertCall[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const length = cfg.zigzagLength;
  const depth = cfg.zigzagDepth;

  resetDrawings({ line: 500, label: 500 });

  // ohlc = array.from(high, low): array.max / array.min of the two
  const hiSrc = new Series(bars, (b) => Math.max(b.high, b.low));
  const loSrc = new Series(bars, (b) => Math.min(b.high, b.low));
  const phighA = ta.highest(hiSrc, length).toArray();
  const phighbarA = ta.highestbars(hiSrc, length).toArray();
  const plowA = ta.lowest(loSrc, length).toArray();
  const plowbarA = ta.lowestbars(loSrc, length).toArray();

  const themeColors = (cfg.theme === 'Dark' ? DARK : LIGHT).slice();
  const zigzag: Row[] = [];
  const pivotBarMatrix: number[][] = [];
  const alertCalls: AlertCall[] = [];

  /** wedgeLine(): the two wedge lines, cut at their meeting point when they meet soon enough */
  const wedgeLine = (
    b1: number, p1: number, b5: number, p5: number, b2: number, p2: number, b4: number, p4: number, zgColor: string, lastDir: number,
  ) => {
    const l1t = line.new(b1, p1, b5, p5, 'bar_index', 'both', zgColor);
    const l2t = line.new(b2, p2, b4, p4, 'bar_index', 'both', zgColor);
    const startBar = b1;
    const endBar = b5;
    const l2Start = line.get_price(l2t, startBar);
    const l2End = line.get_price(l2t, endBar);
    line.set_x1(l2t, startBar);
    line.set_y1(l2t, l2Start);
    line.set_x2(l2t, endBar);
    line.set_y2(l2t, l2End);
    const width = Math.abs(endBar - startBar);
    let closingEndBar = endBar;
    let closingEndPrice = l2End;
    let closingSoon = false;
    const isContracting = gt(Math.abs(p1 - l2Start), Math.abs(p5 - l2End));
    const isNotTriangle = Math.sign(p1 - p5) === Math.sign(l2Start - l2End);
    const isWolfeWedge = isContracting && isNotTriangle;
    if (isWolfeWedge) {
      const to = endBar + Math.min(500, 2 * width);
      for (let i = endBar; i <= to; i++) {
        const l1Price = line.get_price(l1t, i);
        const l2Price = line.get_price(l2t, i);
        if (le(lastDir * (l1Price - l2Price), 0)) {
          closingEndBar = i;
          closingSoon = true;
          closingEndPrice = (l1Price + l2Price) / 2;
          break;
        }
      }
      if (closingSoon) {
        line.set_x2(l2t, closingEndBar);
        line.set_y2(l2t, closingEndPrice);
        line.set_x2(l1t, closingEndBar);
        line.set_y2(l1t, closingEndPrice);
      }
    }
    line.set_extend(l1t, 'none');
    line.set_extend(l2t, 'none');
    return { l1t, l2t, closingEndBar, closingEndPrice, isWolfe: isWolfeWedge && closingSoon };
  };

  /** find_wedge(): test the 5 pivots from row `start` of the zigzag */
  const findWedge = (start: number, time: number) => {
    const p5 = zigzag[start][0];
    const b5 = Math.trunc(zigzag[start][1]);
    const lastDir = zigzag[start][3];
    const p4 = zigzag[start + 1][0];
    const b4 = Math.trunc(zigzag[start + 1][1]);
    const p3 = zigzag[start + 2][0];
    const b3 = Math.trunc(zigzag[start + 2][1]);
    const p2 = zigzag[start + 3][0];
    const b2 = Math.trunc(zigzag[start + 3][1]);
    const p1 = zigzag[start + 4][0];
    const b1 = Math.trunc(zigzag[start + 4][1]);

    let existingPattern = false;
    for (const row of pivotBarMatrix) {
      const common = (b1 === row[0] ? 1 : 0) + (b2 === row[1] ? 1 : 0) + (b3 === row[2] ? 1 : 0)
        + (b4 === row[3] ? 1 : 0) + (b5 === row[4] ? 1 : 0);
      if (common >= 3 || (cfg.avoidOverlap && b1 >= row[0] && b1 <= row[4])) {
        existingPattern = true;
        break;
      }
    }
    if (existingPattern) return;

    const basicCondition = lastDir > 0
      ? lt(p2, Math.min(p1, p3, p4, p5)) && gt(p5, Math.max(p1, p2, p3, p4)) && lt(p1, p3) && gt(p1, p4)
      : gt(p2, Math.max(p1, p3, p4, p5)) && lt(p5, Math.min(p1, p2, p3, p4)) && gt(p1, p3) && lt(p1, p4);
    if (!basicCondition) return;

    const zgColor = themeColors.pop()!;
    const { l1t, l2t, closingEndBar, closingEndPrice, isWolfe } = wedgeLine(b1, p1, b5, p5, b2, p2, b4, p4, zgColor, lastDir);
    themeColors.unshift(zgColor);

    if (isWolfe) {
      // ma.unshift(pivotBarMatrix, ..., maxPatternsReference = 10)
      pivotBarMatrix.unshift([b1, b2, b3, b4, b5]);
      if (pivotBarMatrix.length > 10) pivotBarMatrix.pop();
      alertCalls.push({ time, message: 'New Wolfe Wave Identified', freq: 'once_per_bar' });
      if (cfg.drawZigzag) {
        line.new(b1, p1, b2, p2, 'bar_index', 'none', zgColor, 'dotted', 0);
        line.new(b2, p2, b3, p3, 'bar_index', 'none', zgColor, 'dotted', 0);
        line.new(b3, p3, b4, p4, 'bar_index', 'none', zgColor, 'dotted', 0);
        line.new(b4, p4, b5, p5, 'bar_index', 'none', zgColor, 'dotted', 0);
      }
      if (cfg.drawProjection) {
        const lproj = line.new(b1, p1, b4, p4, 'bar_index', 'right', zgColor, 'dashed', 0);
        const lProjEndPrice = line.get_price(lproj, closingEndBar);
        line.set_x2(lproj, closingEndBar);
        line.set_y2(lproj, lProjEndPrice);
        line.set_extend(lproj, 'none');
        line.new(closingEndBar, lProjEndPrice, closingEndBar, closingEndPrice, 'bar_index', 'none', zgColor, 'dashed', 0);
      }
    } else {
      line.delete(l1t);
      line.delete(l2t);
    }
  };

  /** scan_patterns() */
  const scanPatterns = (start: number, newPivot: boolean, time: number) => {
    if (zigzag.length >= start + 5 && newPivot) findWedge(start, time);
  };

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1, n - 1);
    const time = bars[i].time;
    const phigh = phighA[i] ?? NaN;
    const phighbar = phighbarA[i] ?? NaN;
    const plow = plowA[i] ?? NaN;
    const plowbar = plowbarA[i] ?? NaN;

    // rzigzag zigzag()
    let forceDoublePivot = false;
    let distanceFromLastPivot = 0;
    let pDir = 1;
    if (zigzag.length > 0) {
      pDir = Math.sign(zigzag[0][3]);
      distanceFromLastPivot = i - zigzag[0][1];
    }
    if (zigzag.length > 1) {
      const llastPrice = zigzag[1][0];
      forceDoublePivot = pDir === 1 && plowbar === 0 ? lt(plow, llastPrice)
        : pDir === -1 && phighbar === 0 ? gt(phigh, llastPrice) : false;
    }
    const overflow = distanceFromLastPivot >= length;
    let newPivot = false;
    let doublePivot = false;

    if (((pDir === 1 && phighbar === 0) || (pDir === -1 && plowbar === 0)) && zigzag.length >= 1) {
      const value = pDir === 1 ? phigh : plow;
      const pivot = zigzag[0][0];
      const pivotdir = zigzag[0][3];
      if (gt(value * pivotdir, pivot * pivotdir)) {
        zigzag.shift();
        addNewPivot(zigzag, [value, i, time, pDir, 0], depth);
        newPivot = true;
      }
    }
    // `a or b and c` is `a or (b and c)`: the low of an up zigzag is added even after a new high on the same bar
    if ((pDir === 1 && plowbar === 0) || (pDir === -1 && phighbar === 0 && (!newPivot || forceDoublePivot))) {
      const value = pDir === 1 ? plow : phigh;
      addNewPivot(zigzag, [value, i, time, -pDir, 0], depth);
      doublePivot = newPivot;
      newPivot = true;
    }
    if (overflow && !newPivot) {
      const ipivot = pDir === 1 ? plow : phigh;
      const ipivotbar = pDir === 1 ? i + plowbar : i + phighbar;
      addNewPivot(zigzag, [ipivot, ipivotbar, bars[ipivotbar]?.time ?? NaN, -pDir, 0], depth);
      newPivot = true;
    }

    // setup()
    if (newPivot) {
      let ml: Row[] = zigzag;
      let level = 1;
      while (ml.length >= 5) {
        if (level >= cfg.minLevel) {
          scanPatterns(1, doublePivot, time);
          scanPatterns(0, newPivot, time);
        }
        ml = nextLevel(ml, depth);
        level += 1;
      }
    }
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    ...drawingOutputs(bars, n > 0 && bars[0].time >= 1e12 ? 'ms' : 's'),
    alertCalls,
  };
}

export const WolfeScanner = { calculate, metadata, defaultInputs, inputConfig, plotConfig, drawingKinds, hasAlertFunction };
