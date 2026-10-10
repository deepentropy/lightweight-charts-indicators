/**
 * Buyside & Sellside Liquidity [LuxAlgo]
 *
 * A zig zag of pivot highs and lows (`liqLen` bars on the left, 1 bar on the right) is kept in arrays of 50 points.
 * On a pivot high, the earlier zig zag highs within ATR(10) / margin of it are counted; with more than 2 a buyside
 * liquidity level is made: a solid line from the oldest of these highs, a dotted line that follows the last bar and
 * a text. Sellside levels are made the same way from pivot lows. The last `visLiq` levels of each side are kept.
 * When the high goes above the level margin (the low below it for a sellside level) the level is breached: the
 * dotted line stops and a liquidity zone box starts; it grows while the bars stay within `marBuy` / `marSel` ATR of
 * the level. Liquidity voids (off by default) are large gaps between the low and the high of two bars back (more
 * than ATR(200)), drawn as 13 stacked boxes that extend until the price comes back to their middle.
 * In 'Present' mode levels and voids are only searched on the last 500 bars.
 *
 * Pine details kept: the 6 alert() calls have no output. The boxes of the level margin are invisible (na colours) but
 * part of the output, as in the original.
 *
 * Reference: "Buyside & Sellside Liquidity [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import { ta, Series, color, math, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { executeScript, indicator as declareIndicator, box, line } from 'oakscriptjs/script';
import type { BoxData, LineDrawingData } from '../types';

export interface BuysideSellsideLiquidityInputs {
  /** Detection Length */
  liqLen: number;
  /** Margin (the level margin is ATR(10) * margin / 10) */
  margin: number;
  liqBuy: boolean;
  marBuy: number;
  cLiqB: string;
  liqSel: boolean;
  marSel: number;
  cLiqS: string;
  lqVoid: boolean;
  cLqvB: string;
  cLqvS: string;
  lqText: boolean;
  mode: 'Present' | 'Historical';
  /** Number of visible levels of each side */
  visLiq: number;
}

export const defaultInputs: BuysideSellsideLiquidityInputs = {
  liqLen: 7,
  margin: 6.9,
  liqBuy: true,
  marBuy: 2.3,
  cLiqB: '#4caf50',
  liqSel: true,
  marSel: 2.3,
  cLiqS: '#f23645',
  lqVoid: false,
  cLqvB: '#4caf50',
  cLqvS: '#f23645',
  lqText: false,
  mode: 'Present',
  visLiq: 3,
};

const GROUP = 'Liquidity Detection';

export const inputConfig: InputConfig[] = [
  { id: 'liqLen', type: 'int', title: 'Detection Length', defval: 7, min: 3, max: 13, inline: 'LIQ', group: GROUP },
  { id: 'margin', type: 'float', title: 'Margin', defval: 6.9, min: 4, max: 9, step: 0.1, inline: 'LIQ', group: GROUP },
  { id: 'liqBuy', type: 'bool', title: 'Buyside Liquidity Zones, Margin', defval: true, inline: 'Buyside', group: GROUP },
  { id: 'marBuy', type: 'float', title: '', defval: 2.3, min: 1.5, max: 10, step: 0.1, inline: 'Buyside', group: GROUP },
  { id: 'cLiqB', type: 'color', title: '', defval: '#4caf50', inline: 'Buyside', group: GROUP },
  { id: 'liqSel', type: 'bool', title: 'Sellside Liquidity Zones, Margin', defval: true, inline: 'Sellside', group: GROUP },
  { id: 'marSel', type: 'float', title: '', defval: 2.3, min: 1.5, max: 10, step: 0.1, inline: 'Sellside', group: GROUP },
  { id: 'cLiqS', type: 'color', title: '', defval: '#f23645', inline: 'Sellside', group: GROUP },
  { id: 'lqVoid', type: 'bool', title: 'Liquidity Voids, Bullish', defval: false, inline: 'void', group: GROUP },
  { id: 'cLqvB', type: 'color', title: '', defval: '#4caf50', inline: 'void', group: GROUP },
  { id: 'cLqvS', type: 'color', title: 'Bearish', defval: '#f23645', inline: 'void', group: GROUP },
  { id: 'lqText', type: 'bool', title: 'Label', defval: false, inline: 'void', group: GROUP },
  { id: 'mode', type: 'string', title: 'Mode', defval: 'Present', options: ['Present', 'Historical'], inline: 'MOD', group: GROUP },
  { id: 'visLiq', type: 'int', title: '    # Visible Levels', defval: 3, min: 1, max: 50, inline: 'MOD', group: GROUP },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Buyside & Sellside Liquidity [LuxAlgo]',
  shortTitle: 'LuxAlgo - Buyside & Sellside Liquidity',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

// math.min / math.max of two numbers (na when one is na)
const pineMin = (a: number, b: number) => math.min(a, b) as number;
const pineMax = (a: number, b: number) => math.max(a, b) as number;

/** An na colour (drawn transparent) */
const NA_COLOR = NaN;
const MAX_SIZE = 50;

type Box = ReturnType<typeof box.new>;
type Line = ReturnType<typeof line.new>;

/** Pine type liq; the first element of each array has na drawings (null) */
interface Liq {
  bx: Box | null;
  bxz: Box | null;
  bxt: Box | null;
  brZ: boolean;
  brL: boolean;
  ln: Line | null;
  lne: Line | null;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<BuysideSellsideLiquidityInputs> = {},
): IndicatorResult & { lines: LineDrawingData[]; boxes: BoxData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const { liqLen, marBuy, marSel, visLiq } = cfg;
  const liqMar = 10 / cfg.margin;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  const atr = A(ta.atr(bars, 10));
  const atr200 = A(ta.atr(bars, 200));
  const ph = A(ta.pivothigh(new Series(bars, (b) => b.high), liqLen, 1));
  const pl = A(ta.pivotlow(new Series(bars, (b) => b.low), liqLen, 1));

  const run = executeScript(() => {
    declareIndicator(metadata.title, { overlay: true, max_lines_count: 500, max_boxes_count: 500 });
    // ZZ: direction, bar index and price of the last 50 zig zag points (newest first)
    const zzD = new Array<number>(MAX_SIZE).fill(0);
    const zzX = new Array<number>(MAX_SIZE).fill(0);
    const zzY = new Array<number>(MAX_SIZE).fill(NaN);
    const inOut = (d: number, x: number, y: number) => {
      zzD.unshift(d);
      zzX.unshift(x);
      zzY.unshift(y);
      zzD.pop();
      zzX.pop();
      zzY.pop();
    };
    const emptyLiq = (): Liq => ({ bx: null, bxz: null, bxt: null, brZ: false, brL: false, ln: null, lne: null });
    const liqB: Liq[] = [emptyLiq()];
    const liqS: Liq[] = [emptyLiq()];
    const liqV: Box[] = [];
    const deleteLiq = (x: Liq) => {
      if (x.bx) box.delete(x.bx);
      if (x.bxz) box.delete(x.bxz);
      if (x.bxt) box.delete(x.bxt);
      if (x.ln) line.delete(x.ln);
      if (x.lne) line.delete(x.lne);
    };
    const y1Of = (x: Liq) => (x.ln ? line.get_y1(x.ln) : NaN);
    let prevBull: boolean | null = null; // bull[1] / bear[1]: na when the void block did not run on the previous bar
    let prevBear: boolean | null = null;

    for (let i = 0; i < n; i++) {
      const b = bars[i];
      const per = cfg.mode === 'Present' ? n - 1 - i <= 500 : true;
      const x2 = i - 1;
      const margin = atr[i] / liqMar;

      // Level detection on a pivot (`if ph`: not na and not 0); side 1 = buyside (highs), -1 = sellside (lows)
      const detect = (side: 1 | -1) => {
        const pivot = side === 1 ? ph[i] : pl[i];
        if (Number.isNaN(pivot) || pivot === 0) return;
        const dir = zzD[0];
        const y1 = zzY[0];
        const y2 = i > 0 ? (side === 1 ? bars[i - 1].high : bars[i - 1].low) : 0; // nz(b.h[1])
        if (side === 1 ? dir < 1 : dir > -1) {
          inOut(side, x2, y2);
        } else if (dir === side && (side === 1 ? gt(pivot, y1) : gt(y1, pivot))) {
          zzX[0] = x2;
          zzY[0] = y2;
        }
        if (!per) return;

        let count = 0;
        let stP = 0;
        let stB = 0;
        let minP = 0;
        let maxP = 10e6;
        for (let k = 0; k <= MAX_SIZE - 1; k++) {
          if (zzD[k] !== side) continue;
          const y = zzY[k];
          if (side === 1 ? gt(y, pivot + margin) : gt(pivot - margin, y)) break;
          if (gt(y, pivot - margin) && gt(pivot + margin, y)) {
            count += 1;
            stB = zzX[k];
            stP = y;
            if (gt(y, minP)) minP = y;
            if (gt(maxP, y)) maxP = y;
          }
        }
        if (count <= 2) return;

        const arr = side === 1 ? liqB : liqS;
        const css = side === 1 ? cfg.cLiqB : cfg.cLiqS;
        const getB = arr[0];
        const mid = (minP + maxP) / 2;
        if (getB.bx && stB === box.get_left(getB.bx)) {
          box.set_top(getB.bx, mid + margin);
          box.set_rightbottom(getB.bx, i + 10, mid - margin);
        } else {
          const bx = box.new(stB, mid + margin, i + 10, mid - margin, NA_COLOR, undefined, undefined, undefined, undefined, NA_COLOR);
          const bxz = box.new(NaN, NaN, NaN, NaN, NA_COLOR, undefined, undefined, undefined, undefined, NA_COLOR);
          const bxt = box.new(stB, stP, i + 10, stP, NA_COLOR, undefined, undefined, undefined, undefined, NA_COLOR,
            side === 1 ? 'Buyside liquidity' : 'Sellside liquidity', 'tiny', String(color.new(css, 25)), 'left',
            side === 1 ? 'bottom' : 'top');
          const ln = line.new(stB, stP, i - 1, stP, undefined, undefined, String(color.new(css, 0)));
          const lne = line.new(i - 1, stP, NaN, stP, undefined, undefined, String(color.new(css, 0)), 'dotted');
          arr.unshift({ bx, bxz, bxt, brZ: false, brL: false, ln, lne });
        }
        if (arr.length > visLiq) deleteLiq(arr.pop() as Liq);
      };
      detect(1);
      detect(-1);

      // Level extension, breach and liquidity zone
      for (const x of liqB) {
        if (!x.brL) {
          if (x.lne) line.set_x2(x.lne, i);
          if (x.bx && gt(b.high, box.get_top(x.bx))) {
            x.brL = true;
            x.brZ = true;
            if (x.bxz) {
              box.set_lefttop(x.bxz, i - 1, pineMin(y1Of(x) + marBuy * atr[i], b.high));
              box.set_rightbottom(x.bxz, i + 1, y1Of(x));
              box.set_bgcolor(x.bxz, String(color.new(cfg.cLiqB, cfg.liqBuy ? 73 : 100)));
            }
          }
        } else if (x.brZ) {
          if (gt(b.low, y1Of(x) - marBuy * atr[i]) && gt(y1Of(x) + marBuy * atr[i], b.high)) {
            if (x.bxz) {
              box.set_right(x.bxz, i + 1);
              box.set_top(x.bxz, pineMax(b.high, box.get_top(x.bxz)));
            }
            if (cfg.liqBuy && x.lne) line.set_x2(x.lne, i + 1);
          } else {
            x.brZ = false;
          }
        }
      }
      for (const x of liqS) {
        if (!x.brL) {
          if (x.lne) line.set_x2(x.lne, i);
          if (x.bx && gt(box.get_bottom(x.bx), b.low)) {
            x.brL = true;
            x.brZ = true;
            if (x.bxz) {
              box.set_lefttop(x.bxz, i - 1, y1Of(x));
              box.set_rightbottom(x.bxz, i + 1, pineMax(y1Of(x) - marSel * atr[i], b.low));
              box.set_bgcolor(x.bxz, String(color.new(cfg.cLiqS, cfg.liqSel ? 73 : 100)));
            }
          }
        } else if (x.brZ) {
          if (gt(b.low, y1Of(x) - marSel * atr[i]) && gt(y1Of(x) + marSel * atr[i], b.high)) {
            if (x.bxz) box.set_rightbottom(x.bxz, i + 1, pineMin(b.low, box.get_bottom(x.bxz)));
            if (cfg.liqSel && x.lne) line.set_x2(x.lne, i + 1);
          } else {
            x.brZ = false;
          }
        }
      }

      // Liquidity voids
      if (cfg.lqVoid && per) {
        const h2 = i >= 2 ? bars[i - 2].high : NaN;
        const l2 = i >= 2 ? bars[i - 2].low : NaN;
        const c1 = i >= 1 ? bars[i - 1].close : NaN;
        const bull = gt(b.low - h2, atr200[i]) && gt(b.low, h2) && gt(c1, h2);
        const bear = gt(l2 - b.high, atr200[i]) && gt(l2, b.high) && gt(l2, c1);
        const parts = 13;
        if (bull) {
          const bg = String(color.new(cfg.cLqvB, 90));
          const base = prevBull === true ? bars[i - 1].low : h2;
          const st = Math.abs(b.low - base) / parts;
          for (let k = 0; k <= parts - 1; k++) {
            if (prevBull !== true && cfg.lqText && k === 0) {
              liqV.push(box.new(i - 2, base + k * st, i, base + (k + 1) * st, NA_COLOR, undefined, undefined, undefined, undefined, bg,
                'Liquidity Void   ', 'tiny', NA_COLOR, 'right', 'bottom'));
            } else {
              liqV.push(box.new(i - 2, base + k * st, i, base + (k + 1) * st, NA_COLOR, undefined, undefined, undefined, undefined, bg));
            }
          }
        }
        if (bear) {
          const bg = String(color.new(cfg.cLqvS, 90));
          const st = Math.abs((prevBear === true ? bars[i - 1].high : l2) - b.high) / parts;
          for (let k = 0; k <= parts - 1; k++) {
            if (prevBear !== true && cfg.lqText && k === parts - 1) {
              liqV.push(box.new(i - 2, b.high + k * st, i, b.high + (k + 1) * st, NA_COLOR, undefined, undefined, undefined, undefined, bg,
                'Liquidity Void   ', 'tiny', NA_COLOR, 'right', 'top'));
            } else {
              liqV.push(box.new(i - 2, b.high + k * st, i, b.high + (k + 1) * st, NA_COLOR, undefined, undefined, undefined, undefined, bg));
            }
          }
        }
        prevBull = bull;
        prevBear = bear;
      } else {
        prevBull = null;
        prevBear = null;
      }

      // A void box stops (it leaves the array, the box stays) when the bar reaches its middle
      if (liqV.length > 0) {
        const c1 = i >= 1 ? bars[i - 1].close : NaN;
        // math.sign(a) != math.sign(b); an na side compares false
        const signDiffers = (a: number, c: number) => !Number.isNaN(a) && !Number.isNaN(c) && Math.sign(a) !== Math.sign(c);
        for (let bn = liqV.length - 1; bn >= 0; bn--) {
          if (bn >= liqV.length) continue;
          const cb = liqV[bn];
          const ba = (box.get_bottom(cb) + box.get_top(cb)) / 2;
          if (signDiffers(c1 - ba, b.close - ba) || signDiffers(c1 - ba, b.low - ba) || signDiffers(c1 - ba, b.high - ba)) {
            liqV.splice(bn, 1);
          } else {
            box.set_right(cb, i + 1);
            if (i - box.get_left(cb) > 21) box.set_text_color(cb, String(color.new(color.gray, 25)));
          }
        }
      }
    }
  }, bars);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    lines: run.result.lines ?? [],
    boxes: run.result.boxes ?? [],
  };
}

export const BuysideSellsideLiquidity = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
