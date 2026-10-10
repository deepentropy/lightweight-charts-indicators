/**
 * Breakout Finder
 *
 * Keeps the pivot highs and pivot lows of the last "Max Breakout Length" bars. A bullish breakout is an up bar
 * that closes above the highest high of the last Period bars and above a group of pivot highs: at least "Minimum
 * Number of Tests" pivots lie in a band below the highest broken pivot (band width = Threshold Rate % of the
 * 300-bar price range). A bearish breakout is the same with pivot lows. Each breakout draws a rectangle of four
 * lines from the oldest tested pivot to the breakout bar, and a triangle below (bullish) or above (bearish) the bar.
 *
 * The original keeps at most 400 lines (max_lines_count): the oldest rectangles are removed.
 * The "Line Style" options are the values of the original: sol (solid), dsh (dashed), dot (dotted).
 *
 * Reference: "Breakout Finder" by LonesomeTheBlue
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LonesomeTheBlue
 */

import { ta, Series, callsite, compare, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, LineDrawingData } from '../types';

export interface BreakoutFinderInputs {
  /** Pivot period (left / right) */
  prd: number;
  /** Max Breakout Length */
  boLen: number;
  /** Threshold Rate % */
  cwidthu: number;
  /** Minimum Number of Tests */
  mintest: number;
  bocolorup: string;
  bocolordown: string;
  /** Line Style: sol (solid), dsh (dashed), dot (dotted) */
  lstyle: 'sol' | 'dsh' | 'dot';
}

// Pine v4 colours: color.blue #2196F3, color.red #FF5252
export const defaultInputs: BreakoutFinderInputs = {
  prd: 5,
  boLen: 200,
  cwidthu: 3,
  mintest: 2,
  bocolorup: '#2196F3',
  bocolordown: '#FF5252',
  lstyle: 'sol',
};

export const inputConfig: InputConfig[] = [
  { id: 'prd', type: 'int', title: 'Period', defval: 5, min: 2 },
  { id: 'boLen', type: 'int', title: 'Max Breakout Length', defval: 200, min: 30, max: 300 },
  { id: 'cwidthu', type: 'float', title: 'Threshold Rate %', defval: 3, min: 1, max: 10 },
  { id: 'mintest', type: 'int', title: 'Minimum Number of Tests', defval: 2, min: 1 },
  { id: 'bocolorup', type: 'color', title: 'Breakout Colors', defval: '#2196F3', inline: 'bocol' },
  { id: 'bocolordown', type: 'color', title: '', defval: '#FF5252', inline: 'bocol' },
  { id: 'lstyle', type: 'string', title: 'Line Style', defval: 'sol', options: ['sol', 'dsh', 'dot'] },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Breakout Finder',
  shortTitle: 'BF',
  overlay: true,
};

/** Pine max_lines_count; a creation that brings the count above max + 5 deletes the oldest lines until max remain */
const MAX_LINES = 400;
const LINE_STYLE = { sol: 'solid', dsh: 'dashed', dot: 'dotted' } as const;

/** Pine `for i = a to b`: counts down when a > b */
function pineRange(a: number, b: number): number[] {
  const out: number[] = [];
  if (a <= b) for (let i = a; i <= b; i++) out.push(i);
  else for (let i = a; i >= b; i--) out.push(i);
  return out;
}

/** Pine array.get: an index outside the array is a runtime error */
function get<T>(arr: T[], i: number): T {
  if (i < 0 || i >= arr.length) throw new Error(`Index ${i} is out of bounds, array size is ${arr.length}`);
  return arr[i];
}

export function calculate(
  bars: Bar[],
  inputs: Partial<BreakoutFinderInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; lines: LineDrawingData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const { prd, mintest, bocolorup, bocolordown } = cfg;
  const boLen = cfg.boLen;
  const cwidthu = cfg.cwidthu / 100;
  const style = LINE_STYLE[cfg.lstyle];
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const highS = new Series(bars, (b) => b.high);
  const lowS = new Series(bars, (b) => b.low);

  // check if PH/PL
  const ph = A(ta.pivothigh(highS, prd, prd));
  const pl = A(ta.pivotlow(lowS, prd, prd));
  const highestPrd = A(ta.highest(highS, prd));
  const lowestPrd = A(ta.lowest(lowS, prd));
  // width: highest(lll) / lowest(lll) with a length that changes per bar
  const highestSite = callsite.highest();
  const lowestSite = callsite.lowest();

  // keep Pivot Points and their locations in the arrays
  const phval: number[] = [];
  const phloc: number[] = [];
  const plval: number[] = [];
  const plloc: number[] = [];

  const markers: MarkerData[] = [];
  // Lines alive, oldest first (Pine object limit): bar indexes and prices
  const live: Array<{ x1: number; y1: number; x2: number; y2: number; color: string }> = [];
  const newLine = (x1: number, y1: number, x2: number, y2: number, color: string) => {
    live.push({ x1, y1, x2, y2, color });
    if (live.length > MAX_LINES + 5) live.splice(0, live.length - MAX_LINES);
  };

  for (let i = 0; i < n; i++) {
    const { open, close } = bars[i];
    const lll = Math.max(Math.min(i, 300), 1);
    const h_ = highestSite(bars[i].high, lll);
    const l_ = lowestSite(bars[i].low, lll);
    const chwidth = (h_ - l_) * cwidthu;

    // keep PH/PL levels and locations (`if ph`: na and 0 are false)
    if (!Number.isNaN(ph[i]) && ph[i] !== 0) {
      phval.unshift(ph[i]);
      phloc.unshift(i - prd);
      if (phval.length > 1) {
        // cleanup old ones
        for (const x of pineRange(phloc.length - 1, 1)) {
          if (i - get(phloc, x) > boLen) {
            phloc.pop();
            phval.pop();
          }
        }
      }
    }
    if (!Number.isNaN(pl[i]) && pl[i] !== 0) {
      plval.unshift(pl[i]);
      plloc.unshift(i - prd);
      if (plval.length > 1) {
        for (const x of pineRange(plloc.length - 1, 1)) {
          if (i - get(plloc, x) > boLen) {
            plloc.pop();
            plval.pop();
          }
        }
      }
    }

    // check bullish cup
    let bomax = NaN;
    let bostart = i;
    let num = 0;
    const hgst = i > 0 ? highestPrd[i - 1] : NaN;
    if (phval.length >= mintest && compare.gt(close, open) && compare.gt(close, hgst)) {
      bomax = get(phval, 0);
      let xx = 0;
      for (const x of pineRange(0, phval.length - 1)) {
        if (compare.ge(get(phval, x), close)) break;
        xx = x;
        bomax = Math.max(bomax, get(phval, x));
      }
      if (xx >= mintest && compare.le(open, bomax)) {
        for (const x of pineRange(0, xx)) {
          if (compare.le(get(phval, x), bomax) && compare.ge(get(phval, x), bomax - chwidth)) {
            num += 1;
            bostart = get(phloc, x);
          }
        }
        if (num < mintest || compare.ge(hgst, bomax)) bomax = NaN;
      }
    }
    const breakout = !Number.isNaN(bomax) && num >= mintest;
    if (breakout) {
      newLine(i, bomax, bostart, bomax, bocolorup);
      newLine(i, bomax - chwidth, bostart, bomax - chwidth, bocolorup);
      newLine(bostart, bomax - chwidth, bostart, bomax, bocolorup);
      newLine(i, bomax - chwidth, i, bomax, bocolorup);
      // plotshape(..., location = location.belowbar, style = shape.triangleup, color = bocolorup, size = size.small)
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: bocolorup, size: 'small' });
    }

    // check bearish cup
    let bomin = NaN;
    bostart = i;
    let num1 = 0;
    const lwst = i > 0 ? lowestPrd[i - 1] : NaN;
    if (plval.length >= mintest && compare.lt(close, open) && compare.lt(close, lwst)) {
      bomin = get(plval, 0);
      let xx = 0;
      for (const x of pineRange(0, plval.length - 1)) {
        if (compare.le(get(plval, x), close)) break;
        xx = x;
        bomin = Math.min(bomin, get(plval, x));
      }
      if (xx >= mintest && compare.ge(open, bomin)) {
        for (const x of pineRange(0, xx)) {
          if (compare.ge(get(plval, x), bomin) && compare.le(get(plval, x), bomin + chwidth)) {
            num1 += 1;
            bostart = get(plloc, x);
          }
        }
        if (num1 < mintest || compare.le(lwst, bomin)) bomin = NaN;
      }
    }
    const breakdown = !Number.isNaN(bomin) && num1 >= mintest;
    if (breakdown) {
      newLine(i, bomin, bostart, bomin, bocolordown);
      newLine(i, bomin + chwidth, bostart, bomin + chwidth, bocolordown);
      newLine(bostart, bomin + chwidth, bostart, bomin, bocolordown);
      newLine(i, bomin + chwidth, i, bomin, bocolordown);
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: bocolordown, size: 'small' });
    }
  }

  // A line with an na coordinate is not drawn
  const lines: LineDrawingData[] = [];
  for (const l of live) {
    if (!Number.isFinite(l.y1) || !Number.isFinite(l.y2)) continue;
    lines.push({ time1: bars[l.x1].time, price1: l.y1, time2: bars[l.x2].time, price2: l.y2, color: l.color, style });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    lines,
  };
}

export const BreakoutFinder = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
