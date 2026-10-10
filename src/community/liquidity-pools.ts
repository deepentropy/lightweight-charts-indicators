/**
 * Liquidity Pools [LuxAlgo]
 *
 * The script follows the highest candle (`hst`) and the lowest candle (`lst`) of the current move. A later bar whose
 * wick goes above the body top of `hst` while its body stays below it is a contact with the high (the mirror for
 * the low). With `cNum` contacts, at least `gapCount` bars apart, and `wait` bars after the last contact, a
 * liquidity zone is made when the close is on the inner side: a bearish zone from the body top to the high of `hst`,
 * a bullish zone from the low to the body bottom of `lst`. A new zone that overlaps the last one is merged into
 * it. The newest zone of each side has a line that follows the price while the close is outside the zone, and a
 * label with the volume traded inside the zone. A zone leaves the list after two closes in a row through its far
 * side. 'Fill Candles Inside Zones' draws the part of each candle that is inside the last zone.
 *
 * Pine details kept: a merged zone is pushed again in the zone list, so the same zone can be in the list several
 * times; zones that leave the list keep their box, line and label (only the newest 500 of each kind stay).
 *
 * Reference: "Liquidity Pools [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import { color, math, str, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { executeScript, indicator as declareIndicator, box, line, label } from 'oakscriptjs/script';
import type { BoxData, LabelData, LineDrawingData, PlotCandleData } from '../types';

export interface LiquidityPoolsInputs {
  /** Zone Contact Amount */
  cNum: number;
  /** Bars Required Between Each Contact */
  gapCount: number;
  /** Confirmation Bars */
  wait: number;
  volTog: boolean;
  volSize: 'Tiny' | 'Small' | 'Normal' | 'Large' | 'Huge';
  bullColor: string;
  bearColor: string;
  canTog: boolean;
  bullCanColor: string;
  bearCanColor: string;
}

export const defaultInputs: LiquidityPoolsInputs = {
  cNum: 2,
  gapCount: 5,
  wait: 10,
  volTog: true,
  volSize: 'Small',
  bullColor: 'rgba(8, 153, 129, 0.2)',
  bearColor: 'rgba(242, 54, 69, 0.2)',
  canTog: false,
  bullCanColor: '#089981',
  bearCanColor: '#f23645',
};

export const inputConfig: InputConfig[] = [
  {
    id: 'cNum', type: 'int', title: 'Zone Contact Amount', defval: 2, min: 2, group: 'Liquidity Identification',
    tooltip: "The number of times price must bounce from this zone before considering it as a liquidity pool.  \n\nHigher == Less Zones that are 'More Precise'\nLower == More Zones that are 'Less precise'",
  },
  {
    id: 'gapCount', type: 'int', title: 'Bars Required Between Each Contact', defval: 5, min: 0, group: 'Liquidity Identification',
    tooltip: 'The number of bars to wait before checking for another zone contact.',
  },
  {
    id: 'wait', type: 'int', title: 'Confirmation Bars', defval: 10, group: 'Liquidity Identification',
    tooltip: 'Used to Confirm Zones for Validity. \n Waits [X] Bars before drawing Zone.',
  },
  { id: 'volTog', type: 'bool', title: 'Display Volume Labels', defval: true },
  { id: 'volSize', type: 'string', title: 'Volume Label Size', defval: 'Small', options: ['Tiny', 'Small', 'Normal', 'Large', 'Huge'] },
  { id: 'bullColor', type: 'color', title: 'Bull Zone Color  ', defval: 'rgba(8, 153, 129, 0.2)', group: 'Style' },
  { id: 'bearColor', type: 'color', title: 'Bear Zone Color', defval: 'rgba(242, 54, 69, 0.2)', group: 'Style' },
  {
    id: 'canTog', type: 'bool', title: 'Fill Candles Inside Zones', defval: false, group: 'Style',
    tooltip: 'Fills Candles that are inside the last liquidity zone.\n\nNOTE: The candles will only be filled AFTER the Zone is generated. Candles fills will not overlap the zone it is referencing.',
  },
  { id: 'bullCanColor', type: 'color', title: 'Bull Candle Fill  ', defval: '#089981', group: 'Style' },
  { id: 'bearCanColor', type: 'color', title: 'Bear Candle Fill', defval: '#f23645', group: 'Style' },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Liquidity Pools [LuxAlgo]',
  shortTitle: 'LuxAlgo - Liquidity Pools',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => a - b >= -EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

// math.min / math.max of two numbers (na when one is na)
const pineMin = (a: number, b: number) => math.min(a, b) as number;
const pineMax = (a: number, b: number) => math.max(a, b) as number;
/** nz(x, replacement): na and +-infinity give the replacement */
const nz = (x: number, replacement = 0) => (Number.isFinite(x) ? x : replacement);
/** An na colour (drawn transparent) */
const NA_COLOR = NaN;

type Box = ReturnType<typeof box.new>;
type Line = ReturnType<typeof line.new>;
type Label = ReturnType<typeof label.new>;

/** Pine type data: one candle (high, body top, body bottom, low, bar index) */
interface Data {
  h: number;
  t: number;
  b: number;
  l: number;
  bi: number;
}

/** Pine type zn; the first running zones have na drawings (null) */
interface Zn {
  bx: Box | null;
  state: number;
  ln: Line | null;
  vol: number;
  lab: Label | null;
}

// Getters of a box id that can be na
const topOf = (id: Box | null) => (id ? box.get_top(id) : NaN);
const bottomOf = (id: Box | null) => (id ? box.get_bottom(id) : NaN);
const leftOf = (id: Box | null) => (id ? box.get_left(id) : NaN);

export function calculate(
  bars: Bar[],
  inputs: Partial<LiquidityPoolsInputs> = {},
): IndicatorResult & { lines: LineDrawingData[]; boxes: BoxData[]; labels: LabelData[]; plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const { cNum, gapCount, wait, volTog } = cfg;
  const volSize = cfg.volSize.toLowerCase();
  const n = bars.length;
  const invis = String(color.rgb(0, 0, 0, 100));
  const bullLine = String(color.new(cfg.bullColor, 0));
  const bearLine = String(color.new(cfg.bearColor, 0));
  const volText = (v: number) => str.tostring(v, 'volume');
  const bullCandles: PlotCandleData[] = [];
  const bearCandles: PlotCandleData[] = [];

  const run = executeScript(() => {
    declareIndicator(metadata.title, { overlay: true, max_lines_count: 500, max_boxes_count: 500, max_labels_count: 500 });
    if (n === 0) return;
    const first = bars[0];
    const dataOf = (b: Bar, i: number): Data =>
      ({ h: b.high, t: Math.max(b.open, b.close), b: Math.min(b.open, b.close), l: b.low, bi: i });
    let hst = dataOf(first, 0);
    let lst = dataOf(first, 0);
    let hCount = 0;
    let lCount = 0;
    let lastHWick = 0;
    let lastLWick = 0;
    const bullZones: Zn[] = [];
    const bearZones: Zn[] = [];
    let hZn: Zn = { bx: null, state: NaN, ln: null, vol: NaN, lab: null };
    let lZn: Zn = { bx: null, state: NaN, ln: null, vol: NaN, lab: null };
    let hiVol = 0;
    let loVol = 0;
    let bsHw = 0;
    let bsLw = 0;
    // History: h_wick[1], l_wick[1], hst.t[1], hst.t[2], lst.b[1], lst.b[2]
    let hWick1 = false;
    let lWick1 = false;
    let hstT1 = NaN;
    let hstT2 = NaN;
    let lstB1 = NaN;
    let lstB2 = NaN;

    for (let i = 0; i < n; i++) {
      const bar = bars[i];
      const { high, low, close } = bar;
      const volume = bar.volume ?? NaN;
      const cur = dataOf(bar, i);
      const cTop = cur.t;
      const cBot = cur.b;

      // Adjusting High and Low Check Boundaries (hst / lst can be the same object as cur, as in Pine)
      if (gt(high, hst.h) && (gt(cTop, hst.h) || gt(hst.t, cTop))) {
        if (hCount > 1) {
          lst = cur;
          loVol = 0;
          lCount = 0;
        }
        hst = cur;
        hiVol = 0;
        hCount = 1;
        lastHWick = i;
      }
      if (gt(lst.l, low) && (gt(lst.l, cBot) || gt(cBot, lst.b))) {
        if (lCount > 1) {
          hst = cur;
          hiVol = 0;
          hCount = 0;
        }
        lst = cur;
        loVol = 0;
        lCount = 1;
        lastLWick = i;
      }

      // Counting Contacts
      const hWick = gt(high, hst.t) && ge(hst.t, cTop);
      const lWick = gt(lst.b, low) && ge(cBot, lst.b);
      if (hWick1 && eq(hstT1, hstT2) && bsHw > gapCount) {
        hCount += 1;
        lastHWick = i - 1;
      }
      if (lWick1 && eq(lstB1, lstB2) && bsLw > gapCount) {
        lCount += 1;
        lastLWick = i - 1;
      }
      const prevBsHw = i > 0 ? bsHw : NaN;
      const prevBsLw = i > 0 ? bsLw : NaN;
      bsHw = Math.abs(lastHWick - i);
      bsLw = Math.abs(lastLWick - i);

      // High/Low Tracking for Zone Outer Extremes
      if (gt(high, hst.h)) hst.h = high;
      if (gt(lst.l, low)) lst.l = low;

      // Volume Tracking (plain divisions; nz() turns na and +-infinity into 0)
      hiVol += nz((Math.max(high - hst.t, 0) / (high - low)) * volume);
      loVol += nz((Math.max(lst.b - low, 0) / (high - low)) * volume);

      // Zone Management (Creation & Merging); ta.crossover(bs_hw, wait) runs on every bar
      const crossH = bsHw > wait && prevBsHw <= wait;
      const crossL = bsLw > wait && prevBsLw <= wait;
      if (hCount >= cNum && crossH && gt(hst.t, close)) {
        const top = topOf(hZn.bx);
        if (hZn.bx && hst.bi === leftOf(hZn.bx)) {
          box.set_top(hZn.bx, pineMax(hst.h, top));
          box.set_bottom(hZn.bx, pineMin(hst.t, top));
        } else if (hZn.bx && ge(top, hst.h) && ge(hst.t, top)) {
          box.set_right(hZn.bx, i);
          hZn.vol += hiVol;
          bearZones.push(hZn);
        } else if (hZn.bx && gt(hst.h, top) && gt(top, hst.t)) {
          box.set_top(hZn.bx, pineMax(hst.t, top));
          box.set_bottom(hZn.bx, pineMin(hst.h, top));
          box.set_right(hZn.bx, i);
          hZn.vol += hiVol;
          bearZones.push(hZn);
        } else {
          hZn = {
            bx: box.new(hst.bi, hst.h, i, hst.t, NA_COLOR, undefined, undefined, undefined, undefined, cfg.bearColor),
            state: 0,
            ln: line.new(hst.bi, hst.t, i, NaN, undefined, undefined, bearLine),
            vol: hiVol,
            lab: label.new(i, NaN, volText(hiVol) + '\n', undefined, undefined, invis, 'label_right', bearLine, volSize, 'right'),
          };
          bearZones.push(hZn);
        }
      }
      if (lCount >= cNum && crossL && gt(close, lst.b)) {
        const top = topOf(lZn.bx);
        const bot = bottomOf(lZn.bx);
        if (lZn.bx && lst.bi === leftOf(lZn.bx)) {
          box.set_top(lZn.bx, pineMax(lst.b, top));
          box.set_bottom(lZn.bx, pineMin(lst.l, bot));
        } else if (lZn.bx && ge(top, lst.b) && ge(lst.l, bot)) {
          box.set_right(lZn.bx, i);
          lZn.vol += loVol;
          bullZones.push(lZn);
        } else if (lZn.bx && ((gt(lst.b, top) && gt(top, lst.l)) || (gt(lst.b, bot) && gt(bot, lst.l)) || (gt(lst.b, top) && gt(bot, lst.l)))) {
          box.set_top(lZn.bx, pineMax(lst.b, top));
          box.set_bottom(lZn.bx, pineMin(lst.l, bot));
          box.set_right(lZn.bx, i);
          lZn.vol += loVol;
          bullZones.push(lZn);
        } else {
          lZn = {
            bx: box.new(lst.bi, lst.b, i, lst.l, NA_COLOR, undefined, undefined, undefined, undefined, cfg.bullColor),
            state: 0,
            ln: line.new(lst.bi, lst.b, i, NaN, undefined, undefined, bullLine),
            vol: loVol,
            lab: label.new(i, NaN, '\n' + volText(loVol), undefined, undefined, invis, 'label_right', bullLine, volSize, 'right'),
          };
          bullZones.push(lZn);
        }
      }

      // get_civ: volume of the candle inside the zone
      const civ = (id: Box | null) => {
        const top = topOf(id);
        const bot = bottomOf(id);
        const h = gt(high, top) ? top : high;
        const l = gt(bot, low) ? bot : low;
        return nz((h - l) / (high - low), 1) * volume;
      };
      // get_cfp: the candle limited to the zone
      const cfp = (id: Box | null) => {
        const top = topOf(id);
        const bot = bottomOf(id);
        const clamp = (v: number) => (gt(bot, v) ? bot : gt(v, top) ? top : v);
        return { open: clamp(cTop), high: clamp(high), low: clamp(low), close: clamp(cBot) };
      };
      const inside = (top: number, bot: number) =>
        (gt(top, high) && gt(high, bot)) || (gt(top, low) && gt(low, bot)) || (ge(high, top) && ge(bot, low));
      let g: ReturnType<typeof cfp> | null = null;
      let r: ReturnType<typeof cfp> | null = null;

      // Zone Management (Extention & Deletion): bull zones
      for (let k = bullZones.length - 1; k >= 0; k--) {
        const z = bullZones[k];
        const bot = bottomOf(z.bx);
        const top = topOf(z.bx);
        if (k === bullZones.length - 1) {
          if (gt(close, top)) {
            if (z.ln) {
              line.set_y1(z.ln, top);
              line.set_xy2(z.ln, i, top);
            }
            if (volTog && z.lab) label.set_xy(z.lab, i, top);
          }
          if (inside(top, bot)) {
            z.vol += civ(z.bx);
            if (leftOf(z.bx) === leftOf(lZn.bx)) g = cfp(lZn.bx);
          }
          if (z.lab) label.set_text(z.lab, '\n' + volText(z.vol));
        } else if (gt(bottomOf(lZn.bx), bot)) {
          if (z.ln) line.set_y2(z.ln, NaN);
          if (z.lab) label.set_y(z.lab, NaN);
        }
        if (gt(bot, close)) {
          if (z.state < 0) bullZones.splice(k, 1);
          z.state -= 1;
        } else {
          z.state = 0;
        }
      }

      // Bear zones
      for (let k = bearZones.length - 1; k >= 0; k--) {
        const z = bearZones[k];
        const bot = bottomOf(z.bx);
        const top = topOf(z.bx);
        if (k === bearZones.length - 1) {
          if (gt(bot, close)) {
            if (z.ln) {
              line.set_y1(z.ln, bot);
              line.set_xy2(z.ln, i, bot);
            }
            if (volTog && z.lab) label.set_xy(z.lab, i, bot);
          }
          if (inside(top, bot)) {
            z.vol += civ(z.bx);
            if (leftOf(hZn.bx) === leftOf(z.bx)) r = cfp(hZn.bx);
          }
          if (z.lab) label.set_text(z.lab, volText(z.vol) + '\n');
        } else if (gt(bot, topOf(hZn.bx))) {
          if (z.ln) line.set_y2(z.ln, NaN);
          if (z.lab) label.set_y(z.lab, NaN);
        }
        if (gt(close, top)) {
          if (z.state < 0) bearZones.splice(k, 1);
          z.state -= 1;
        } else {
          z.state = 0;
        }
      }

      // Colored Candles: plotcandle(canTog ? g_o : na, g_h, g_l, g_c, ...), no candle when a value is na
      const pushCandle = (out: PlotCandleData[], c: ReturnType<typeof cfp> | null, css: string) => {
        if (!cfg.canTog || !c || [c.open, c.high, c.low, c.close].some((v) => Number.isNaN(v))) return;
        out.push({ time: bar.time, ...c, color: css, wickColor: css, borderColor: eq(c.open, c.close) ? invis : css });
      };
      pushCandle(bullCandles, g, cfg.bullCanColor);
      pushCandle(bearCandles, r, cfg.bearCanColor);

      hWick1 = hWick;
      lWick1 = lWick;
      hstT2 = hstT1;
      hstT1 = hst.t;
      lstB2 = lstB1;
      lstB1 = lst.b;
    }
  }, bars);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    lines: run.result.lines ?? [],
    boxes: run.result.boxes ?? [],
    labels: run.result.labels ?? [],
    plotCandles: { bullCandles, bearCandles },
  };
}

export const LiquidityPools = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
