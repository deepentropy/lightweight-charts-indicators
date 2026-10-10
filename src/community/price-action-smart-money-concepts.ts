/**
 * Price Action Smart Money Concepts [BigBeluga]
 *
 * Market structure on the last `mswindow` bars (or on all bars): a state machine follows the trend with a break
 * level (BOS) and a change-of-character level (CHoCH). A close through a level confirms it (solid line), a wick
 * through it with a close back is a sweep (dotted line, text "x") and moves the level to the wick. In "Adjusted
 * Points" mode the CHoCH level follows the last pivot high / low. Each level is a horizontal line with its text and
 * a circle at its start.
 * Volumetric order blocks: every confirmed break stores the extreme bar of the move (high / low, cut to one ATR(200)
 * in "Length" mode) with its volume. A block is mitigated (removed, or kept as a breaker) when price goes through
 * it; overlapping blocks are removed. Each block shown has a zone box, a box extended to the right, two activity
 * boxes, a dashed mid-line and a text with its volume and its share of the volume of the blocks shown.
 * Fair value gaps (optional): 3-bar gaps with mitigation, breakers, mid-lines and raids. Mapping structure
 * (optional): a polyline through the swing points. Candles can be coloured by the trend.
 *
 * The drawings are those of the last bar. Every bar given to calculate() is a closed bar. The raid marks have the
 * chart foreground colour in the original: there is no chart theme here, the port uses #DBDBDB (the value of the
 * reference run).
 * "Adjusted Points" updates the level on bars whose index is a multiple of the pivot length: the index counts from
 * the first bar given to calculate().
 *
 * Reference: "Price Action Smart Money Concepts [BigBeluga]" by BigBeluga
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: This Pine Script code is subject to the terms of the Mozilla Public License 2.0 at
 * https://mozilla.org/MPL/2.0/ (c) BigBeluga
 */

import { ta, Series, color, compare, math, str, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData, BoxData, LabelData, LabelStyle, LineDrawingData, PineSize, PolylineData } from '../types';

type TextSize = 'Tiny' | 'Small' | 'Normal' | 'Large' | 'Huge';
type Mitigation = 'Close' | 'Wick' | 'Avg';

export interface PriceActionSmartMoneyConceptsInputs {
  /** Limit the market structure to the last `mswindow` bars */
  windowsis: boolean;
  mswindow: number;
  showSwing: boolean;
  /** Number of structure levels shown on each side */
  swingLimit: number;
  swingcssup: string;
  swingcssdn: string;
  showMapping: boolean;
  mappingStyle: '⎯⎯⎯⎯' | '----';
  mappingcss: string;
  candlecss: boolean;
  mstext: TextSize;
  msmode: 'Extreme Points' | 'Adjusted Points';
  mslen: number;
  buildsweep: boolean;
  msbubble: boolean;
  obshow: boolean;
  oblast: number;
  obupcs: string;
  obdncs: string;
  obshowactivity: boolean;
  obactup: string;
  obactdn: string;
  obshowbb: boolean;
  bbup: string;
  bbdn: string;
  obmode: 'Length' | 'Full';
  len: number;
  obmiti: Mitigation;
  obtxt: TextSize | 'Auto';
  showmetric: boolean;
  showline: boolean;
  overlap: boolean;
  wichlap: 'Recent' | 'Old';
  fvg_enable: boolean;
  what_fvg: 'FVG' | 'Breakers';
  fvg_num: number;
  fvg_upcss: string;
  fvg_dncss: string;
  fvgbbup: string;
  fvgbbdn: string;
  fvg_src: Mitigation;
  fvgthresh: number;
  fvgoverlap: boolean;
  fvgline: boolean;
  fvgextend: boolean;
  dispraid: boolean;
}

/** chart.fg_color of the original (no chart theme here) */
const RAID_COLOR = '#DBDBDB';

export const defaultInputs: PriceActionSmartMoneyConceptsInputs = {
  windowsis: true,
  mswindow: 5000,
  showSwing: true,
  swingLimit: 100,
  swingcssup: '#089981',
  swingcssdn: '#f23645',
  showMapping: false,
  mappingStyle: '----',
  mappingcss: '#B2B5BE',
  candlecss: false,
  mstext: 'Tiny',
  msmode: 'Adjusted Points',
  mslen: 5,
  buildsweep: true,
  msbubble: true,
  obshow: true,
  oblast: 5,
  obupcs: 'rgba(8,153,129,0.1)',
  obdncs: 'rgba(242,54,69,0.1)',
  obshowactivity: true,
  obactup: 'rgba(8,153,129,0.5)',
  obactdn: 'rgba(242,54,69,0.5)',
  obshowbb: false,
  bbup: 'rgba(8,153,129,0)',
  bbdn: 'rgba(242,54,69,0)',
  obmode: 'Length',
  len: 5,
  obmiti: 'Close',
  obtxt: 'Normal',
  showmetric: true,
  showline: true,
  overlap: true,
  wichlap: 'Recent',
  fvg_enable: false,
  what_fvg: 'FVG',
  fvg_num: 5,
  fvg_upcss: 'rgba(8,153,129,0.2)',
  fvg_dncss: 'rgba(242,54,69,0.2)',
  fvgbbup: 'rgba(8,153,129,0)',
  fvgbbdn: 'rgba(242,54,69,0)',
  fvg_src: 'Close',
  fvgthresh: 0,
  fvgoverlap: true,
  fvgline: true,
  fvgextend: false,
  dispraid: false,
};

const MSG = 'MARKET STRUCTURE';
const VBG = 'VOLUMETRIC ORDER BLOCKS';
const FVGG = 'FAIR VALUE GAP';
const SIZES = ['Tiny', 'Small', 'Normal', 'Large', 'Huge'];

export const inputConfig: InputConfig[] = [
  { id: 'windowsis', type: 'bool', title: 'Window', defval: true, group: MSG, inline: 'kla' },
  { id: 'mswindow', type: 'int', title: '', defval: 5000, min: 1000, group: MSG, inline: 'kla',
    tooltip: 'Limit market structure calculation to improve memory speed time' },
  { id: 'showSwing', type: 'bool', title: 'Swing', defval: true, group: MSG, inline: 'scss' },
  { id: 'swingLimit', type: 'int', title: '', defval: 100, min: 10, max: 200, group: MSG, inline: 'scss',
    tooltip: '[INPUT] Limit swing structure to tot bars back' },
  { id: 'swingcssup', type: 'color', title: '', defval: '#089981', group: MSG, inline: 'scss' },
  { id: 'swingcssdn', type: 'color', title: '', defval: '#f23645', group: MSG, inline: 'scss' },
  { id: 'showMapping', type: 'bool', title: 'Mapping Structure', defval: false, group: MSG, inline: 'mapping' },
  { id: 'mappingStyle', type: 'string', title: '', defval: '----', options: ['⎯⎯⎯⎯', '----'], group: MSG, inline: 'mapping' },
  { id: 'mappingcss', type: 'color', title: '', defval: '#B2B5BE', group: MSG, inline: 'mapping', tooltip: 'Display Mapping Structure' },
  { id: 'candlecss', type: 'bool', title: 'Color Candles', defval: false, group: MSG, inline: 'txt',
    tooltip: 'Color candle based on trend detection system' },
  { id: 'mstext', type: 'string', title: '', defval: 'Tiny', options: SIZES, group: MSG, inline: 'txt' },
  { id: 'msmode', type: 'string', title: 'Algorithmic Logic', defval: 'Adjusted Points', options: ['Extreme Points', 'Adjusted Points'],
    group: MSG, inline: 'node' },
  { id: 'mslen', type: 'int', title: '', defval: 5, min: 2, group: MSG, inline: 'node' },
  { id: 'buildsweep', type: 'bool', title: 'Build Sweep (x)', defval: true, group: MSG, inline: 'znc',
    tooltip: 'Build sweep on market structure' },
  { id: 'msbubble', type: 'bool', title: 'Bubbles', defval: true, group: MSG, inline: 'bubbles', tooltip: 'Display Circle Bubbles' },
  { id: 'obshow', type: 'bool', title: 'Show Last', defval: true, group: VBG, inline: 'obshow', tooltip: 'Show Last number of orderblock' },
  { id: 'oblast', type: 'int', title: '', defval: 5, min: 0, group: VBG, inline: 'obshow' },
  { id: 'obupcs', type: 'color', title: '', defval: 'rgba(8,153,129,0.1)', group: VBG, inline: 'obshow' },
  { id: 'obdncs', type: 'color', title: '', defval: 'rgba(242,54,69,0.1)', group: VBG, inline: 'obshow' },
  { id: 'obshowactivity', type: 'bool', title: 'Show Buy/Sell Activity', defval: true, group: VBG, inline: 'act',
    tooltip: 'Display internal buy and sell activity' },
  { id: 'obactup', type: 'color', title: '', defval: 'rgba(8,153,129,0.5)', group: VBG, inline: 'act' },
  { id: 'obactdn', type: 'color', title: '', defval: 'rgba(242,54,69,0.5)', group: VBG, inline: 'act' },
  { id: 'obshowbb', type: 'bool', title: 'Show Breakers', defval: false, group: VBG, inline: 'bb', tooltip: 'Display Breakers' },
  { id: 'bbup', type: 'color', title: '', defval: 'rgba(8,153,129,0)', group: VBG, inline: 'bb' },
  { id: 'bbdn', type: 'color', title: '', defval: 'rgba(242,54,69,0)', group: VBG, inline: 'bb' },
  { id: 'obmode', type: 'string', title: 'Construction', defval: 'Length', options: ['Length', 'Full'], group: VBG, inline: 'atr',
    tooltip: '[Length] Use Length to adjust cordinate of the orderblocks\n[Full] Use whole candle body' },
  { id: 'len', type: 'int', title: '', defval: 5, min: 1, group: VBG, inline: 'atr' },
  { id: 'obmiti', type: 'string', title: 'Mitigation Method', defval: 'Close', options: ['Close', 'Wick', 'Avg'], group: VBG,
    tooltip: 'Mitigation method for when to trigger order blocks' },
  { id: 'obtxt', type: 'string', title: 'Metric Size', defval: 'Normal', options: [...SIZES, 'Auto'], group: VBG, inline: 'txt',
    tooltip: 'Order block Metrics text size' },
  { id: 'showmetric', type: 'bool', title: 'Show Metrics', defval: true, group: VBG },
  { id: 'showline', type: 'bool', title: 'Show Mid-Line', defval: true, group: VBG },
  { id: 'overlap', type: 'bool', title: 'Hide Overlap', defval: true, group: VBG, inline: 'ov' },
  { id: 'wichlap', type: 'string', title: '', defval: 'Recent', options: ['Recent', 'Old'], group: VBG, inline: 'ov' },
  { id: 'fvg_enable', type: 'bool', title: '', defval: false, group: FVGG, inline: '1', tooltip: 'Display fair value gap' },
  { id: 'what_fvg', type: 'string', title: '', defval: 'FVG', options: ['FVG', 'Breakers'], group: FVGG, inline: '1',
    tooltip: 'Display fair value gap' },
  { id: 'fvg_num', type: 'int', title: 'Show Last', defval: 5, min: 0, group: FVGG, inline: '1a', tooltip: 'Number of fvg to show' },
  { id: 'fvg_upcss', type: 'color', title: '', defval: 'rgba(8,153,129,0.2)', group: FVGG, inline: '1' },
  { id: 'fvg_dncss', type: 'color', title: '', defval: 'rgba(242,54,69,0.2)', group: FVGG, inline: '1' },
  { id: 'fvgbbup', type: 'color', title: '', defval: 'rgba(8,153,129,0)', group: FVGG, inline: '1' },
  { id: 'fvgbbdn', type: 'color', title: '', defval: 'rgba(242,54,69,0)', group: FVGG, inline: '1' },
  { id: 'fvg_src', type: 'string', title: 'Mitigation', defval: 'Close', options: ['Close', 'Wick', 'Avg'], group: FVGG, inline: '3',
    tooltip: '[Close] Use the close of the body as trigger\n\n[Wick] Use the extreme point of the body as trigger' },
  { id: 'fvgthresh', type: 'float', title: 'Threshold', defval: 0, min: 0, max: 2, step: 0.1, group: FVGG, inline: 'asd',
    tooltip: 'Filter out non significative FVG' },
  { id: 'fvgoverlap', type: 'bool', title: 'Hide Overlap', defval: true, group: FVGG, tooltip: 'Hide overlapping FVG' },
  { id: 'fvgline', type: 'bool', title: 'Show Mid-Line', defval: true, group: FVGG },
  { id: 'fvgextend', type: 'bool', title: 'Extend FVG', defval: false, group: FVGG },
  { id: 'dispraid', type: 'bool', title: 'Display Raids', defval: false, group: FVGG, inline: 'raid' },
];

// plot(na)
export const plotConfig: PlotConfig[] = [{ id: 'plot0', title: 'Plot', color: '#2962FF', lineWidth: 1 }];

export const metadata = {
  title: 'BigBeluga - Smart Money Concepts',
  shortTitle: 'BigBeluga - Smart Money Concepts [1.0.0]',
  overlay: true,
};

/** indicator(max_lines_count = 500, max_labels_count = 500, max_boxes_count = 500, max_polylines_count = 100) */
const MAX_LINES = 500;
const MAX_LABELS = 500;
const MAX_BOXES = 500;

const INVCOL = '#ffffff00';
const { eq, lt, le, gt, ge } = compare;

type LStyle = 'solid' | 'dashed' | 'dotted';

interface Structure {
  zn: number; zz: number; bos: number; choch: number; loc: number; temp: number; trend: number; start: number;
  main: number; xloc: number; upsweep: boolean; dnsweep: boolean; txt: string | null;
}
interface DrawMs { x1: number; x2: number; y: number; txt: string; css: string; style: LStyle }
interface Ob {
  bull: boolean; top: number; btm: number; avg: number; loc: number; css: string; vol: number; dir: number;
  move: number; blPOS: number; brPOS: number; xlocbl: number; xlocbr: number; isbb: boolean; bbloc: number;
}
interface Fvg {
  top: number; btm: number; loc: number; isbb: boolean; bbloc: number; israid: boolean; raidy: number;
  raidloc: number; raidx2: number; active: boolean; raidcs: string;
}
/** Drawing with times in milliseconds, as the script (NaN = na: the object exists but is not drawn) */
interface RawLine { x1: number; x2: number; y1: number; y2: number; color: string; style?: LStyle; extend?: 'right' }
interface RawBox {
  left: number; right: number; top: number; bottom: number; border: string; bg: string; width?: number; extend?: 'right';
}
interface RawLabel {
  x: number; y: number; text: string; color: string; textColor?: string; style: LabelStyle; size: PineSize; index?: boolean;
}

const txSz = (s: string): PineSize => s.toLowerCase() as PineSize;

/** Pine `c ? a : b` on the mitigation method (an unknown method gives na: false) */
function below(method: Mitigation, o: number, c: number, l: number, level: number, avg: number): boolean {
  return method === 'Close' ? lt(Math.min(c, o), level) : method === 'Wick' ? lt(l, level) : method === 'Avg' ? lt(l, avg) : false;
}
function above(method: Mitigation, o: number, c: number, h: number, level: number, avg: number): boolean {
  return method === 'Close' ? gt(Math.max(c, o), level) : method === 'Wick' ? gt(h, level) : method === 'Avg' ? gt(h, avg) : false;
}

/** The four overlap cases of the script between a zone and the reference zone */
function overlaps(s: { top: number; btm: number }, c: { top: number; btm: number }): boolean {
  return (gt(s.btm, c.btm) && lt(s.btm, c.top)) || (lt(s.top, c.top) && gt(s.btm, c.btm))
    || (gt(s.top, c.top) && lt(s.btm, c.btm)) || (lt(s.top, c.top) && gt(s.top, c.btm));
}

export function calculate(
  bars: Bar[],
  inputs: Partial<PriceActionSmartMoneyConceptsInputs> = {},
): IndicatorResult & { lines: LineDrawingData[]; boxes: BoxData[]; labels: LabelData[]; polylines: PolylineData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const {
    windowsis, mswindow, showSwing, swingLimit, swingcssup, swingcssdn, showMapping, mappingStyle, mappingcss, candlecss,
    mstext, msmode, mslen, buildsweep, msbubble, obshow, oblast, obupcs, obdncs, obshowactivity, obactup, obactdn, obshowbb,
    bbup, bbdn, obmode, len, obmiti, obtxt, showmetric, showline, wichlap, fvg_enable, what_fvg, fvg_num, fvg_upcss,
    fvg_dncss, fvg_src, fvgthresh, fvgoverlap, fvgline, fvgextend, dispraid,
  } = cfg;
  const hideOverlap = cfg.overlap;
  const n = bars.length;
  const last = n - 1;

  const H = bars.map((b) => b.high);
  const L = bars.map((b) => b.low);
  const O = bars.map((b) => b.open);
  const C = bars.map((b) => b.close);
  const V = bars.map((b) => b.volume ?? NaN);
  // `time` in milliseconds, as in the script
  const T = bars.map((b) => (b.time as number) * 1000);
  /** x[k] history read: na before the first bar */
  const at = (a: number[], i: number) => (i >= 0 && i < n ? a[i] : NaN);

  // atr = ta.atr(200) / (5 / len)
  const atr200 = ta.atr(bars, 200).toArray().map((v) => v ?? NaN);
  const atr = atr200.map((v) => v / (5 / len));

  // Live drawings, in creation order (all of them are created on the last bar), with the maximum counts of the
  // script: when a creation brings the count above the maximum + 5, the oldest are deleted until the maximum remain
  const rawLines: RawLine[] = [];
  const rawBoxes: RawBox[] = [];
  const rawLabels: RawLabel[] = [];
  const add = <X,>(list: X[], obj: X, max: number): X => {
    list.push(obj);
    if (list.length > max + 5) list.splice(0, list.length - max);
    return obj;
  };
  const newLine = (o: RawLine) => add(rawLines, o, MAX_LINES);
  const newBox = (o: RawBox) => add(rawBoxes, o, MAX_BOXES);
  const newLabel = (o: RawLabel) => add(rawLabels, o, MAX_LABELS);
  const polylines: PolylineData[] = [];

  // var phl = Zphl.new(...) makes two labels without coordinates on the first bar. They are never drawn, and the
  // labels of earlier bars do not count for the maximum on the bar that creates the others: they are left out.

  // ---- market structure and order blocks: structure(swingcssup, swingcssdn, showSwing, false, swingLimit) ----
  // With the window on, the function runs from the bar after last_bar_index - mswindow: its pivots see only those bars
  const first = windowsis ? Math.max(0, last - mswindow + 1) : 0;
  const draw = showSwing;
  const upcss = swingcssup;
  const dncss = swingcssdn;
  const confirmedStyle: LStyle = 'solid'; // internal = false

  let ms: Structure = {
    zn: NaN, zz: NaN, bos: NaN, choch: NaN, loc: NaN, temp: NaN, trend: NaN, start: 0, main: NaN, xloc: NaN,
    upsweep: false, dnsweep: false, txt: null,
  };
  const blob: Ob[] = [];
  const brob: Ob[] = [];
  const bldw: DrawMs[] = [];
  const brdw: DrawMs[] = [];
  let up = NaN;
  let dn = NaN;
  const phn: number[] = [NaN];
  const pln: number[] = [NaN];
  const php: number[] = [NaN];
  const plp: number[] = [NaN];

  // ta.pivothigh(high, mslen, mslen) / ta.pivotlow(low, mslen, mslen) inside the function: history from `first`
  const winBars = bars.slice(first);
  const phArr = n > 0 ? ta.pivothigh(Series.fromArray(winBars, H.slice(first)), mslen, mslen).toArray() : [];
  const plArr = n > 0 ? ta.pivotlow(Series.fromArray(winBars, L.slice(first)), mslen, mslen).toArray() : [];

  /** method find(structure ms, bool use_max, bool sweep, bool useob): offset of the extreme bar since the anchor */
  const find = (i: number, useMax: boolean, sweep: boolean, useob: boolean): number => {
    let min = 99999999;
    let max = 0;
    let idx = 0;
    const anchor = sweep ? ms.xloc : ms.loc;
    const span = i - anchor; // na on the first call: the loops do not run
    const end = span - 1 > 0 ? span - 1 : span;
    if (useMax) {
      for (let k = 0; k <= end; k++) {
        const hk = at(H, i - k);
        max = Math.max(hk, max);
        if (eq(max, hk)) {
          min = at(L, i - k);
          idx = k;
        }
      }
      if (useob && gt(at(H, i - idx - 1), at(H, i - idx))) idx += 1;
    } else {
      for (let k = 0; k <= end; k++) {
        const lk = at(L, i - k);
        min = Math.min(lk, min);
        if (eq(min, lk)) {
          max = at(H, i - k);
          idx = k;
        }
      }
      if (useob && lt(at(L, i - idx - 1), at(L, i - idx))) idx += 1;
    }
    return idx;
  };

  /** method fnOB(ob[] block, bool bull, float cords, int idx) */
  const fnOB = (i: number, block: Ob[], bull: boolean, cords: number, idx: number) => {
    const j = i - idx;
    const dir = gt(at(C, j), at(O, j)) ? 1 : -1;
    const base = { loc: at(T, j), vol: at(V, j), dir, move: 1, blPOS: 1, brPOS: 1, xlocbl: at(T, j), xlocbr: NaN, isbb: false, bbloc: NaN };
    if (bull) block.unshift({ bull: true, top: cords, btm: at(L, j), avg: (cords + at(L, j)) / 2, css: obupcs, ...base });
    else block.unshift({ bull: false, top: at(H, j), btm: cords, avg: (cords + at(H, j)) / 2, css: obdncs, ...base });
  };

  /** method mitigated(ob[] block): `for [i, stuff] in block` reads the array as it is at each step */
  const mitigated = (i: number, block: Ob[]) => {
    for (let k = 0; k < block.length; k++) {
      const s = block[k];
      const dnBreak = (level: number) => below(obmiti, O[i], C[i], L[i], level, s.avg);
      const upBreak = (level: number) => above(obmiti, O[i], C[i], H[i], level, s.avg);
      if (!s.isbb) {
        if (s.bull ? dnBreak(s.btm) : upBreak(s.top)) {
          s.isbb = true;
          s.bbloc = T[i];
          if (!obshowbb) block.splice(k, 1);
        }
      } else if (s.bull ? upBreak(s.top) : dnBreak(s.btm)) {
        block.splice(k, 1);
      }
    }
  };

  /** overlap(ob[] bull, ob[] bear) */
  const removeOverlap = <Z extends { top: number; btm: number }>(bull: Z[], bear: Z[], recent: boolean, fvg: boolean) => {
    for (const list of [bull, bear]) {
      if (list.length > 1) {
        for (let k = list.length - 1; k >= 1; k--) {
          if (overlaps(list[k], list[0])) list.splice(fvg || recent ? k : 0, 1);
        }
      }
    }
    for (const [list, other] of [[bull, bear], [bear, bull]]) {
      if (list.length > 0 && other.length > 0) {
        for (let k = list.length - 1; k >= 0; k--) {
          if (overlaps(list[k], other[0])) list.splice(fvg ? k : recent ? 0 : k, 1);
        }
      }
    }
  };

  /** method umt(ob metric) */
  const umt = (i: number, m: Ob) => {
    if (m.dir === 1) {
      if (m.move === 1) { m.blPOS += 1; m.move = 2; } else if (m.move === 2) { m.blPOS += 1; m.move = 3; } else if (m.move === 3) { m.brPOS += 1; m.move = 1; }
    } else if (m.dir === -1) {
      if (m.move === 1) { m.brPOS += 1; m.move = 2; } else if (m.move === 2) { m.brPOS += 1; m.move = 3; } else if (m.move === 3) { m.blPOS += 1; m.move = 1; }
    }
    const d = T[i] - at(T, i - 1);
    if (d === at(T, i - 1) - at(T, i - 2)) {
      m.xlocbl = m.loc + d * m.blPOS;
      m.xlocbr = m.loc + d * m.brPOS;
    }
  };

  /** method display(ob id, ob[] full, int i) */
  const display = (i: number, id: Ob, full: Ob[], k: number) => {
    const t = T[i];
    if (!id.isbb) {
      newBox({ top: id.top, bottom: id.btm, left: id.loc, right: t, border: 'transparent', bg: id.css });
      newBox({ top: id.top, bottom: id.btm, left: t, right: t + 1, border: 'transparent', bg: id.css, extend: 'right' });
    } else {
      const bb = id.bull ? bbup : bbdn;
      newBox({ top: id.top, bottom: id.btm, left: id.loc, right: id.bbloc, border: 'transparent', bg: id.css });
      newBox({ top: id.top, bottom: id.btm, left: id.bbloc, right: t, border: id.css, bg: bb, width: 2 });
      newBox({ top: id.top, bottom: id.btm, left: t, right: t + 1, border: id.css, bg: bb, extend: 'right' });
    }
    if (obshowactivity) {
      newBox({ top: id.top, bottom: id.avg, left: id.loc, right: id.xlocbl, border: 'transparent', bg: obactup });
      newBox({ top: id.avg, bottom: id.btm, left: id.loc, right: id.xlocbr, border: 'transparent', bg: obactdn });
    }
    if (showline) {
      newLine({ x1: id.loc, x2: t, y1: id.avg, y2: id.avg, color: String(color.new(id.css, 0)), style: 'dashed' });
    }
    if (showmetric) {
      const seq = Math.min(oblast - 1, full.length - 1);
      if (k === seq) {
        let totalVol = 0;
        for (let j = 0; j <= seq; j++) totalVol += full[j].vol;
        for (let y = 0; y <= seq; y++) {
          const ids = full[y];
          const share = Math.floor((ids.vol / totalVol) * 100);
          newLabel({
            x: i - 1, y: ids.avg, index: true, textColor: String(color.new(ids.css, 0)), style: 'label_left', size: txSz(obtxt),
            color: INVCOL, text: `${str.tostring(math.round(ids.vol, 3), 'volume')} (${str.tostring(share)}%)`,
          });
        }
      }
    }
  };

  const barColors: BarColorData[] = [];

  for (let i = first; i < n; i++) {
    const high = H[i];
    const low = L[i];
    const close = C[i];
    const time = T[i];
    let crossup = false;
    let crossdn = false;

    const idbull = find(i, false, false, true);
    const idbear = find(i, true, false, true);
    // btmP / topP use the global atr (ta.atr(200) / (5 / len))
    const hb = at(H, i - idbear);
    const lb = at(L, i - idbear);
    const ab = at(atr, i - idbear);
    const btmP = obmode === 'Length' ? (lt(hb - ab, lb) ? lb : hb - ab) : lb;
    const hu = at(H, i - idbull);
    const lu = at(L, i - idbull);
    const au = at(atr, i - idbull);
    const topP = obmode === 'Length' ? (gt(lu + au, hu) ? hu : lu + au) : hu;

    const ph = phArr[i - first];
    const pl = plArr[i - first];
    if (ph != null && !Number.isNaN(ph) && ph !== 0) {
      phn.unshift(i - mslen);
      php.unshift(at(H, i - mslen));
    }
    if (pl != null && !Number.isNaN(pl) && pl !== 0) {
      pln.unshift(i - mslen);
      plp.unshift(at(L, i - mslen));
    }
    if (php.length > 0 && gt(high, php[0])) {
      php.length = 0;
      phn.length = 0;
    }
    if (plp.length > 0 && lt(low, plp[0])) {
      plp.length = 0;
      pln.length = 0;
    }

    if (Number.isNaN(up)) up = high;
    if (Number.isNaN(dn)) dn = low;
    if (gt(high, up)) {
      up = high;
      dn = low;
      crossup = true;
    }
    if (lt(low, dn)) {
      up = high;
      dn = low;
      crossdn = true;
    }

    if (ms.start === 0) {
      ms = {
        zn: i, zz: NaN, bos: high, choch: low, loc: i, temp: i, trend: 0, start: 1, main: NaN, xloc: i,
        upsweep: false, dnsweep: false, txt: null,
      };
      if (draw) {
        bldw.unshift({ x1: time, x2: time, y: high, txt: 'CHoCH', css: upcss, style: 'dashed' });
        brdw.unshift({ x1: time, x2: time, y: low, txt: 'CHoCH', css: dncss, style: 'dashed' });
      }
    }

    ms.upsweep = false;
    ms.dnsweep = false;

    /** A sweep of the level drawn by dw[0]: it ends there (dotted, "x") and a new level starts on this bar */
    const sweepDraw = (dw: DrawMs[], y: number, txt: string, css: string) => {
      if (!draw) return;
      dw[0].x2 = time;
      dw[0].style = 'dotted';
      dw[0].txt = 'x';
      dw.unshift({ x1: time, x2: time, y, txt, css, style: 'dashed' });
    };

    if (ms.start === 1) {
      if (le(low, ms.choch) && ge(close, ms.choch) && buildsweep) {
        ms.dnsweep = true;
        ms.choch = low;
        ms.xloc = i;
        sweepDraw(brdw, low, 'CHoCH', dncss);
      } else if (ge(high, ms.bos) && le(close, ms.bos) && buildsweep) {
        ms.upsweep = true;
        ms.bos = high;
        ms.xloc = i;
        sweepDraw(bldw, high, 'CHoCH', upcss);
      } else if (le(close, ms.choch)) {
        ms.txt = 'choch';
        fnOB(i, blob, true, topP, idbull);
        ms.trend = -1;
        ms.choch = ms.bos;
        ms.bos = NaN;
        ms.start = 2;
        ms.loc = i;
        ms.main = low;
        ms.temp = ms.loc;
        ms.xloc = i;
        if (draw) {
          brdw[0].x2 = time;
          brdw[0].style = confirmedStyle;
        }
      } else if (ge(close, ms.bos)) {
        ms.txt = 'choch';
        fnOB(i, brob, false, btmP, idbear);
        ms.trend = 1;
        ms.bos = NaN;
        ms.start = 2;
        ms.loc = i;
        ms.main = high;
        ms.temp = ms.loc;
        ms.xloc = i;
        if (draw) {
          bldw[0].x2 = time;
          bldw[0].style = confirmedStyle;
        }
      }
    }

    if (ms.start === 2) {
      // (bar_index % mslen * 2 == 0) is bar_index % mslen == 0
      const adjustBar = (i % mslen) * 2 === 0;
      if (ms.trend === -1) {
        if (le(low, ms.main)) {
          ms.main = low;
          ms.temp = i;
        }
        if (adjustBar && !Number.isNaN(ms.bos) && msmode === 'Adjusted Points' && php.length > 0 && lt(php[0], ms.choch)) {
          ms.choch = php[0];
          ms.loc = phn[0];
          ms.xloc = phn[0];
          ms.temp = phn[0];
          if (draw) {
            bldw[0].x1 = at(T, phn[0]);
            bldw[0].x2 = time;
            bldw[0].y = php[0];
          }
        }
        if (Number.isNaN(ms.bos) && crossup && gt(close, O[i]) && gt(at(C, i - 1), at(O, i - 1))) {
          ms.bos = ms.main;
          ms.loc = ms.temp;
          ms.xloc = ms.loc;
          if (draw) brdw.unshift({ x1: at(T, ms.loc), x2: time, y: at(L, ms.loc), txt: 'BOS', css: dncss, style: 'dashed' });
        }
        if (!Number.isNaN(ms.bos) && draw) brdw[0].x2 = time;
        if (draw) bldw[0].x2 = time;

        if (le(low, ms.bos) && ge(close, ms.bos) && !Number.isNaN(ms.bos) && buildsweep) {
          ms.dnsweep = true;
          ms.bos = low;
          sweepDraw(brdw, low, 'BOS', dncss);
          ms.xloc = i;
        } else if (le(close, ms.bos) && !Number.isNaN(ms.bos)) {
          ms.txt = 'bos';
          ms.zz = ms.bos;
          ms.zn = i;
          fnOB(i, brob, false, btmP, idbear);
          const id = find(i, true, false, false);
          ms.xloc = i;
          ms.bos = NaN;
          ms.choch = at(H, i - id);
          ms.loc = i - id;
          if (draw) {
            brdw[0].x2 = time;
            brdw[0].style = confirmedStyle;
            bldw[0].x1 = at(T, i - id);
            bldw[0].x2 = time;
            bldw[0].y = at(H, i - id);
          }
        }

        if (ge(high, ms.choch) && le(close, ms.choch) && buildsweep) {
          ms.upsweep = true;
          ms.choch = high;
          ms.xloc = i;
          sweepDraw(bldw, high, 'CHoCH', upcss);
        } else if (ge(close, ms.choch)) {
          ms.txt = 'choch';
          ms.zz = ms.choch;
          ms.zn = i;
          fnOB(i, blob, true, topP, idbull);
          const id = find(i, false, false, false);
          if (Number.isNaN(ms.bos)) {
            ms.choch = at(L, i - id);
            if (draw) {
              brdw.unshift({ x1: time, x2: time, y: low, txt: 'BOS', css: dncss, style: 'dashed' });
              brdw[0].x1 = at(T, ms.temp);
            }
          } else {
            ms.choch = ms.bos;
          }
          ms.bos = NaN;
          ms.main = high;
          ms.trend = 1;
          ms.loc = i;
          ms.xloc = i;
          ms.temp = ms.loc;
          if (draw) {
            bldw[0].x2 = time;
            bldw[0].txt = 'CHoCH';
            bldw[0].style = confirmedStyle;
            brdw[0].x2 = time;
            brdw[0].y = ms.choch;
            brdw[0].txt = 'CHoCH';
          }
        }
      } else if (ms.trend === 1) {
        if (ge(high, ms.main)) {
          ms.main = high;
          ms.temp = i;
        }
        if (Number.isNaN(ms.bos) && crossdn && lt(close, O[i]) && lt(at(C, i - 1), at(O, i - 1))) {
          ms.bos = ms.main;
          ms.loc = ms.temp;
          ms.xloc = ms.loc;
          if (draw) bldw.unshift({ x1: at(T, ms.loc), x2: time, y: at(H, ms.loc), txt: 'BOS', css: upcss, style: 'dashed' });
        }
        if (adjustBar && !Number.isNaN(ms.bos) && msmode === 'Adjusted Points' && plp.length > 0 && gt(plp[0], ms.choch)) {
          ms.choch = plp[0];
          ms.loc = pln[0];
          ms.xloc = pln[0];
          ms.temp = pln[0];
          if (draw) {
            brdw[0].x1 = at(T, pln[0]);
            brdw[0].x2 = time;
            brdw[0].y = plp[0];
          }
        }
        if (!Number.isNaN(ms.bos) && draw) bldw[0].x2 = time;
        if (draw) brdw[0].x2 = time;

        if (ge(high, ms.bos) && le(close, ms.bos) && !Number.isNaN(ms.bos) && buildsweep) {
          ms.upsweep = true;
          ms.bos = high;
          sweepDraw(bldw, high, 'BOS', upcss);
          ms.xloc = i;
        } else if (ge(close, ms.bos) && !Number.isNaN(ms.bos)) {
          ms.txt = 'bos';
          ms.zz = ms.bos;
          ms.zn = i;
          fnOB(i, blob, true, topP, idbull);
          const id = find(i, false, false, false);
          ms.xloc = i;
          ms.bos = NaN;
          ms.choch = at(L, i - id);
          ms.loc = i - id;
          if (draw) {
            bldw[0].x2 = time;
            bldw[0].style = confirmedStyle;
            brdw[0].x1 = at(T, i - id);
            brdw[0].x2 = time;
            brdw[0].y = at(L, i - id);
          }
        }

        if (le(low, ms.choch) && ge(close, ms.choch) && buildsweep) {
          ms.dnsweep = true;
          ms.choch = low;
          ms.xloc = i;
          sweepDraw(brdw, low, 'CHoCH', dncss);
        } else if (le(close, ms.choch)) {
          ms.txt = 'choch';
          ms.zz = ms.choch;
          ms.zn = i;
          fnOB(i, brob, false, btmP, idbear);
          const id = find(i, true, false, false);
          if (Number.isNaN(ms.bos)) {
            ms.choch = at(H, i - id);
            if (draw) {
              bldw.unshift({ x1: time, x2: time, y: high, txt: 'BOS', css: upcss, style: 'dashed' });
              bldw[0].x1 = at(T, ms.temp);
            }
          } else {
            ms.choch = ms.bos;
          }
          ms.bos = NaN;
          ms.main = low;
          ms.trend = -1;
          ms.loc = i;
          ms.temp = ms.loc;
          if (draw) {
            brdw[0].x2 = time;
            brdw[0].txt = 'CHoCH';
            brdw[0].style = confirmedStyle;
            bldw[0].y = ms.choch;
            bldw[0].x2 = time;
            bldw[0].txt = 'CHoCH';
          }
          ms.xloc = i;
        }
      }
    }

    if (obshow && oblast > 0) {
      // barstate.isconfirmed: every bar is a closed bar
      mitigated(i, blob);
      mitigated(i, brob);
      if (hideOverlap) removeOverlap(blob, brob, wichlap === 'Recent', false);
      for (const m of blob) umt(i, m);
      for (const m of brob) umt(i, m);

      if (i === last) {
        for (const block of [blob, brob]) {
          for (let k = 0; k <= Math.min(oblast - 1, block.length - 1); k++) display(i, block[k], block, k);
        }
      }
    }

    if (i === last && draw && bldw.length > 0 && brdw.length > 0) {
      for (const [dw, style] of [[bldw, 'label_down'], [brdw, 'label_up']] as Array<[DrawMs[], LabelStyle]>) {
        for (let k = 0; k < dw.length; k++) {
          if (k > swingLimit) continue;
          const obj = dw[k];
          newLine({ x1: obj.x1, x2: obj.x2, y1: obj.y, y2: obj.y, color: obj.css, style: obj.style });
          newLabel({
            x: Math.trunc((obj.x1 + obj.x2) / 2), y: obj.y, color: INVCOL, style, textColor: obj.css, size: txSz(mstext), text: obj.txt,
          });
          if (msbubble) newLabel({ x: obj.x1, y: obj.y, color: String(color.new(obj.css, 80)), style: 'circle', size: 'tiny', text: '' });
        }
      }
    }

    // barcolor(candlecss ? css : na): the trend colour, darker until the structure text is "bos"
    if (candlecss) {
      const css = ms.trend === 1 ? swingcssup : swingcssdn;
      const dark = () => String(color.rgb(color.r(css) * (1 - 0.3), color.g(css) * (1 - 0.3), color.b(css) * (1 - 0.3), 0));
      barColors.push({ time: bars[i].time, color: ms.txt === 'bos' ? css : dark() });
    }
  }

  // ---- fair value gaps: dFVG() ----
  if (fvg_enable && n > 0) {
    const blFVG: Fvg[] = [];
    const brFVG: Fvg[] = [];
    const upfvg: boolean[] = new Array(n).fill(false);
    const dnfvg: boolean[] = new Array(n).fill(false);
    const newFvg = (top: number, btm: number, loc: number): Fvg => ({
      top, btm, loc, isbb: false, bbloc: NaN, israid: false, raidy: NaN, raidloc: NaN, raidx2: NaN, active: false, raidcs: 'transparent',
    });
    const resetRaid = (list: Fvg[]) => {
      if (list.length > 0 && list[0].israid && !list[0].active) {
        Object.assign(list[0], { active: true, raidloc: NaN, raidx2: NaN, raidy: NaN, raidcs: INVCOL });
      }
    };
    for (let i = 0; i < n; i++) {
      const h = H[i];
      const l = L[i];
      const c = C[i];
      const o = O[i];
      const h2 = at(H, i - 2);
      const l2 = at(L, i - 2);
      const c1 = at(C, i - 1);
      const fvatr1 = at(atr200, i - 1);
      const blth = at(L, i - 1) + fvatr1 * fvgthresh;
      const brth = at(H, i - 1) - fvatr1 * fvgthresh;
      // cc = timeframe.change(): true on every bar of the chart timeframe
      if (gt(l, h2) && gt(c1, blth)) upfvg[i] = true;
      if (gt(l2, h) && lt(c1, brth)) dnfvg[i] = true;

      if (i > 0 && upfvg[i - 1]) {
        resetRaid(blFVG);
        blFVG.unshift(newFvg(at(L, i - 1), at(H, i - 3), at(T, i - 3)));
      }
      if (i > 0 && dnfvg[i - 1]) {
        resetRaid(brFVG);
        brFVG.unshift(newFvg(at(L, i - 3), at(H, i - 1), at(T, i - 3)));
      }

      for (let k = 0; k < blFVG.length; k++) {
        const f = blFVG[k];
        const avg = (f.top + f.btm) / 2;
        if (!f.isbb) {
          if (below(fvg_src, o, c, l, f.btm, avg)) {
            f.isbb = true;
            f.bbloc = T[i];
            if (what_fvg === 'FVG') blFVG.splice(k, 1);
          }
        } else if (above(fvg_src, o, c, h, f.top, avg) && what_fvg === 'Breakers') {
          blFVG.splice(k, 1);
        }
      }
      for (let k = 0; k < brFVG.length; k++) {
        const f = brFVG[k];
        const avg = (f.top + f.btm) / 2;
        if (!f.isbb) {
          if (above(fvg_src, o, c, h, f.top, avg)) {
            f.isbb = true;
            f.bbloc = T[i];
            if (what_fvg === 'FVG') brFVG.splice(k, 1);
          }
        } else if (below(fvg_src, o, c, l, f.btm, avg) && what_fvg === 'Breakers') {
          brFVG.splice(k, 1);
        }
      }

      if (fvgoverlap) removeOverlap(blFVG, brFVG, true, true);

      if (dispraid) {
        for (const f of blFVG) {
          if (!f.israid && !f.isbb) {
            if (lt(l, f.top) && gt(c, f.top)) Object.assign(f, { israid: true, raidloc: T[i], raidx2: T[i], raidy: l, raidcs: RAID_COLOR });
          } else if (le(l, f.raidy) && !f.active && !f.isbb) {
            f.active = true;
            f.raidx2 = T[i];
          } else if (!f.active && !f.isbb) {
            f.raidx2 = T[i];
          }
        }
        for (const f of brFVG) {
          if (!f.israid && !f.isbb) {
            if (gt(h, f.btm) && lt(c, f.btm)) Object.assign(f, { israid: true, raidloc: T[i], raidx2: T[i], raidy: h, raidcs: RAID_COLOR });
          } else if (ge(h, f.raidy) && !f.active && !f.isbb) {
            f.active = true;
            f.raidx2 = T[i];
          } else if (!f.active && !f.isbb) {
            f.raidx2 = T[i];
          }
        }
      }
    }

    /** method dispFVG(FVG fvg, int i, bool bull) on the last bar */
    const t = T[last];
    const ext = fvgextend ? { extend: 'right' as const } : {};
    const dispFVG = (f: Fvg, bull: boolean) => {
      const own = bull ? fvg_upcss : fvg_dncss;
      const other = bull ? fvg_dncss : fvg_upcss;
      const mid = (f.top + f.btm) / 2;
      if (!f.isbb) {
        newBox({ top: f.top, bottom: f.btm, left: f.loc, right: t, border: 'transparent', bg: own, ...ext });
        if (fvgline) newLine({ x1: f.loc, x2: t, y1: mid, y2: mid, color: String(color.new(own, 0)), ...ext });
        if (dispraid) {
          newLine({ x1: f.raidloc, x2: f.raidx2, y1: f.raidy, y2: f.raidy, color: f.raidcs });
          newLabel({
            x: Math.trunc((f.raidloc + f.raidx2) / 2), y: f.raidy, text: 'x', textColor: f.raidcs,
            style: bull ? 'label_up' : 'label_down', size: 'small', color: INVCOL,
          });
        }
      } else {
        newBox({ top: f.top, bottom: f.btm, left: f.loc, right: f.bbloc, border: 'transparent', bg: own });
        newBox({ top: f.top, bottom: f.btm, left: f.bbloc, right: t, border: other, bg: other, ...ext });
        if (fvgline) {
          newLine({ x1: f.loc, x2: f.bbloc, y1: mid, y2: mid, color: String(color.new(own, 0)) });
          newLine({ x1: f.bbloc, x2: t, y1: mid, y2: mid, color: String(color.new(other, 0)), style: 'dashed', ...ext });
        }
      }
    };
    if (fvg_num > 0) {
      for (let k = 0; k <= Math.min(fvg_num - 1, blFVG.length - 1); k++) dispFVG(blFVG[k], true);
      for (let k = 0; k <= Math.min(fvg_num - 1, brFVG.length - 1); k++) dispFVG(brFVG[k], false);
    }
  }

  // ---- mapping structure: mapping() ----
  if (showMapping && n > 0) {
    let mUp = NaN;
    let mDn = NaN;
    let point = NaN;
    let trend = 0;
    let idx = NaN;
    let sum = NaN;
    let project = NaN;
    const charts: Array<{ time: number; price: number }> = [];
    /** method IDMIDX(bool use_max, int loc): offset of the highest high / lowest low since bar `loc` */
    const idmidx = (i: number, useMax: boolean, loc: number): number => {
      let min = 99999999;
      let max = 0;
      let id = 0;
      for (let k = 0; k <= i - loc; k++) {
        if (useMax) {
          max = Math.max(at(H, i - k), max);
          if (eq(max, at(H, i - k))) id = k;
        } else {
          min = Math.min(at(L, i - k), min);
          if (eq(min, at(L, i - k))) id = k;
        }
      }
      return id;
    };
    for (let i = 0; i < n; i++) {
      if (Number.isNaN(mUp)) {
        mUp = H[i];
        idx = i;
      }
      if (Number.isNaN(mDn)) {
        mDn = L[i];
        idx = i;
      }
      if (gt(H[i], mUp)) {
        if (trend === -1) {
          const id = idmidx(i, false, idx);
          charts.unshift({ time: T[i - id], price: L[i - id] });
          idx = i;
          point = L[i - id];
          sum = T[i - id];
        }
        mUp = H[i];
        mDn = L[i];
        project = T[i];
        trend = 1;
      }
      if (lt(L[i], mDn)) {
        if (trend === 1) {
          const id = idmidx(i, true, idx);
          charts.unshift({ time: T[i - id], price: H[i - id] });
          idx = i;
          point = H[i - id];
          sum = T[i - id];
        }
        mUp = H[i];
        mDn = L[i];
        project = T[i];
        trend = -1;
      }
    }
    // color.red of Pine v5
    newLine({ x1: sum, x2: project, y1: point, y2: trend === 1 ? mUp : mDn, color: '#FF5252' });
    polylines.push({
      points: charts.map((p) => ({ time: p.time / 1000, price: p.price })), // bar times
      lineColor: mappingcss,
      lineStyle: mappingStyle === '⎯⎯⎯⎯' ? 'solid' : 'dashed',
    });
  }

  // ---- outputs: an object with an na coordinate is not drawn. The x values are times (xloc.bar_time): a time
  // between two bars is drawn on the next bar, as the original does (the middle of a level for its text, the end of
  // an activity box after a session gap); a time after the last bar (time + 1 of the extended boxes) is the last bar
  const ok = (...v: number[]) => v.every((x) => !Number.isNaN(x));
  const tOut = (ms: number): number => {
    let lo = 0;
    let hi = last;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (T[mid] >= ms) hi = mid;
      else lo = mid + 1;
    }
    return bars[lo].time as number;
  };
  const lines: LineDrawingData[] = rawLines.filter((l) => ok(l.x1, l.x2, l.y1, l.y2)).map((l) => ({
    time1: tOut(l.x1), price1: l.y1, time2: tOut(l.x2), price2: l.y2, color: l.color,
    ...(l.style ? { style: l.style } : {}), ...(l.extend ? { extend: l.extend } : {}),
  }));
  const boxes: BoxData[] = rawBoxes.filter((b) => ok(b.left, b.right, b.top, b.bottom)).map((b) => ({
    time1: tOut(b.left), price1: b.top, time2: tOut(b.right), price2: b.bottom, bgColor: b.bg, borderColor: b.border,
    ...(b.width !== undefined ? { borderWidth: b.width } : {}), ...(b.extend ? { extend: b.extend } : {}),
  }));
  const labels: LabelData[] = rawLabels.filter((l) => ok(l.x, l.y) && (!l.index || l.x >= 0)).map((l) => ({
    time: l.index ? (bars[l.x].time as number) : tOut(l.x), price: l.y, text: l.text, color: l.color,
    ...(l.textColor !== undefined ? { textColor: l.textColor } : {}), style: l.style, size: l.size,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: bars.map((b) => ({ time: b.time, value: NaN })) },
    barColors,
    lines,
    boxes,
    labels,
    polylines,
  };
}

export const PriceActionSmartMoneyConcepts = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
