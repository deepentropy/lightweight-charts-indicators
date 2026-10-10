/**
 * ICT Concepts [LuxAlgo]
 *
 * Several price action tools drawn with lines, boxes and labels:
 * - Market structure: a zigzag of pivot highs / lows (`len` bars on the left, 1 on the right). A close through the
 *   last pivot against the current direction is a market structure shift (MSS); a close through a later pivot in
 *   the same direction is a break of structure (BOS).
 * - Liquidity: three or more zigzag pivots of the same side within ATR(10) / (10 / margin) of the new pivot give a
 *   buyside / sellside liquidity box with a line; the box is coloured when the close enters it and stops when the
 *   close goes through it.
 * - Displacement: a candle with a body above the average body (`len` bars) and both wicks below 36 % of the body.
 * - Fair value gaps (FVG, or implied FVG): a gap between the bar and the bar two bars back around a displacement
 *   candle. Balance price range (BPR): the overlap of the last bullish and bearish gaps.
 * - Volume imbalance (VI): a gap between two candle bodies while the wicks overlap.
 * - Order blocks: the lowest (highest) candle between a swing high (low) and the close that breaks it; a block
 *   whose far side is closed through becomes a breaker block.
 * - NWOG / NDOG: the gap between the Friday close and the Monday open, and between a day's close and the next open.
 * - Fibonacci levels between the last two objects of one tool, and killzone session backgrounds.
 *
 * In the 'Present' mode liquidity, gaps, order blocks, displacement and killzones use the last 501 bars only, and a
 * market structure shift removes the earlier structure lines.
 *
 * Limits of the port:
 * - Days of the week (NWOG / NDOG) are read on the UTC calendar; the original uses the exchange time zone. Equal on
 *   UTC symbols and on symbols whose trading day is inside the UTC day (e.g. US stocks).
 * - The right side of a breaker block box is the current time (the clock of the computer) plus 10 bars, as the
 *   original: it changes with the call time.
 * - The bar interval (10 and 50 bar lengths of time-based drawings) is the most frequent gap between two bars.
 *
 * Reference: "ICT Concepts [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import { ta, Series, color, math, timeframe, time as pineTime, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { executeScript, indicator as declareIndicator, box, line, label } from 'oakscriptjs/script';
import type { BgColorData, BoxData, LabelData, LineDrawingData, MarkerData } from '../types';
import { chartTimeframe } from '../anchor-period';

export interface IctConceptsInputs {
  /** Mode */
  i_mode: 'Present' | 'Historical';
  /** Market Structures */
  showMS: boolean;
  /** Length */
  len: number;
  /** MSS */
  iMSS: boolean;
  cMSSbl: string;
  cMSSbr: string;
  /** BOS */
  iBOS: boolean;
  cBOSbl: string;
  cBOSbr: string;
  /** Show Displacement */
  sDispl: boolean;
  /** Volume Imbalance */
  sVimbl: boolean;
  /** # Visible VI's */
  visVim: number;
  cVimbl: string;
  /** Show Order Blocks */
  showOB: boolean;
  /** Swing Lookback */
  length: number;
  /** Show Last Bullish OB */
  showBull: number;
  /** Show Last Bearish OB */
  showBear: number;
  /** Use Candle Body */
  useBody: boolean;
  bullCss: string;
  bullBrkCss: string;
  bearCss: string;
  bearBrkCss: string;
  /** Show Historical Polarity Changes */
  showLabels: boolean;
  /** Show Liquidity */
  showLq: boolean;
  /** margin */
  margin: number;
  /** # Visible Liq. boxes */
  visLiq: number;
  cLIQ_B: string;
  cLIQ_S: string;
  /** Show FVGs */
  shwFVG: boolean;
  /** Balance Price Range */
  i_BPR: boolean;
  /** Options */
  i_FVG: 'FVG' | 'IFVG';
  /** # Visible FVG's */
  visBxs: number;
  cFVGbl: string;
  cFVGblBR: string;
  cFVGbr: string;
  cFVGbrBR: string;
  /** NWOG */
  iNWOG: boolean;
  cNWOG1: string;
  cNWOG2: string;
  maxNWOG: number;
  /** NDOG */
  iNDOG: boolean;
  cNDOG1: string;
  cNDOG2: string;
  maxNDOG: number;
  /** Fibonacci between last: */
  iFib: 'FVG' | 'BPR' | 'OB' | 'Liq' | 'VI' | 'NWOG' | 'NONE';
  /** Extend lines */
  iExt: boolean;
  /** Show Killzones */
  showKZ: boolean;
  /** New York */
  showNy: boolean;
  nyCss: string;
  /** London Open */
  showLdno: boolean;
  ldnoCss: string;
  /** London Close */
  showLdnc: boolean;
  ldncCss: string;
  /** Asian */
  showAsia: boolean;
  asiaCss: string;
  /** New York hours (time zone America/New_York) */
  nySession: string;
  /** London Open hours (time zone Europe/London) */
  ldnoSession: string;
  /** London Close hours (time zone Europe/London) */
  ldncSession: string;
  /** Asian hours (time zone Asia/Tokyo) */
  asiaSession: string;
}

export const defaultInputs: IctConceptsInputs = {
  i_mode: 'Present',
  showMS: true,
  len: 5,
  iMSS: true,
  cMSSbl: '#00e6a1',
  cMSSbr: '#e60400',
  iBOS: true,
  cBOSbl: '#00e6a1',
  cBOSbr: '#e60400',
  sDispl: false,
  sVimbl: true,
  visVim: 2,
  cVimbl: '#06b2d0',
  showOB: true,
  length: 10,
  showBull: 1,
  showBear: 1,
  useBody: true,
  bullCss: '#3e89fa',
  bullBrkCss: 'rgba(71, 133, 249, 0.15)',
  bearCss: '#FF3131',
  bearBrkCss: 'rgba(249, 255, 87, 0.15)',
  showLabels: false,
  showLq: true,
  margin: 4,
  visLiq: 2,
  cLIQ_B: '#fa451c',
  cLIQ_S: '#1ce4fa',
  shwFVG: true,
  i_BPR: false,
  i_FVG: 'FVG',
  visBxs: 2,
  cFVGbl: '#00e676',
  cFVGblBR: '#808000',
  cFVGbr: '#ff5252',
  cFVGbrBR: '#FF0000',
  iNWOG: true,
  cNWOG1: 'rgba(255, 82, 82, 0.72)',
  cNWOG2: 'rgba(178, 181, 190, 0.5)',
  maxNWOG: 3,
  iNDOG: false,
  cNDOG1: 'rgba(255, 152, 0, 0.8)',
  cNDOG2: 'rgba(77, 208, 225, 0.35)',
  maxNDOG: 1,
  iFib: 'NONE',
  iExt: false,
  showKZ: false,
  showNy: true,
  nyCss: 'rgba(255, 93, 0, 0.07)',
  showLdno: true,
  ldnoCss: 'rgba(0, 188, 212, 0.07)',
  showLdnc: true,
  ldncCss: 'rgba(33, 87, 243, 0.07)',
  showAsia: true,
  asiaCss: 'rgba(233, 30, 99, 0.07)',
  nySession: '0700-0900',
  ldnoSession: '0700-1000',
  ldncSession: '1500-1700',
  asiaSession: '1000-1400',
};

// Non-breaking spaces of the original titles
const sp1 = ' '.repeat(7);
const sp2 = ' '.repeat(14);
const nb = (s: string) => s.replace(/ /g, ' ');

export const inputConfig: InputConfig[] = [
  { id: 'i_mode', type: 'string', title: 'Mode', defval: 'Present', options: ['Present', 'Historical'] },
  { id: 'showMS', type: 'bool', title: '', defval: true, group: 'Market Structures', inline: 'MS' },
  { id: 'len', type: 'int', title: `${nb('     Length   ')}${sp2}`, defval: 5, min: 3, max: 10, group: 'Market Structures', inline: 'MS' },
  { id: 'iMSS', type: 'bool', title: `${nb('       MSS')}${sp1}`, defval: true, group: 'Market Structures', inline: 'M1' },
  { id: 'cMSSbl', type: 'color', title: 'bullish', defval: '#00e6a1', group: 'Market Structures', inline: 'M1' },
  { id: 'cMSSbr', type: 'color', title: 'bearish', defval: '#e60400', group: 'Market Structures', inline: 'M1' },
  { id: 'iBOS', type: 'bool', title: `${nb('       BOS')}${sp1}`, defval: true, group: 'Market Structures', inline: 'BS' },
  { id: 'cBOSbl', type: 'color', title: 'bullish', defval: '#00e6a1', group: 'Market Structures', inline: 'BS' },
  { id: 'cBOSbr', type: 'color', title: 'bearish', defval: '#e60400', group: 'Market Structures', inline: 'BS' },
  { id: 'sDispl', type: 'bool', title: 'Show Displacement', defval: false, group: 'Displacement' },
  { id: 'sVimbl', type: 'bool', title: '', defval: true, group: 'Volume Imbalance', inline: 'VI' },
  { id: 'visVim', type: 'int', title: `${nb("   # Visible VI's  ")}${sp1}`, defval: 2, min: 2, max: 100, group: 'Volume Imbalance', inline: 'VI' },
  { id: 'cVimbl', type: 'color', title: '', defval: '#06b2d0', group: 'Volume Imbalance', inline: 'VI' },
  { id: 'showOB', type: 'bool', title: 'Show Order Blocks', defval: true, group: 'Order Blocks' },
  { id: 'length', type: 'int', title: 'Swing Lookback', defval: 10, min: 3, group: 'Order Blocks' },
  { id: 'showBull', type: 'int', title: 'Show Last Bullish OB', defval: 1, min: 0, group: 'Order Blocks' },
  { id: 'showBear', type: 'int', title: 'Show Last Bearish OB', defval: 1, min: 0, group: 'Order Blocks' },
  { id: 'useBody', type: 'bool', title: 'Use Candle Body', defval: true },
  { id: 'bullCss', type: 'color', title: nb('Bullish OB  '), defval: '#3e89fa', group: 'Order Blocks', inline: 'bullcss' },
  { id: 'bullBrkCss', type: 'color', title: nb('Bullish Break  '), defval: 'rgba(71, 133, 249, 0.15)', group: 'Order Blocks', inline: 'bullcss' },
  { id: 'bearCss', type: 'color', title: 'Bearish OB', defval: '#FF3131', group: 'Order Blocks', inline: 'bearcss' },
  { id: 'bearBrkCss', type: 'color', title: 'Bearish Break', defval: 'rgba(249, 255, 87, 0.15)', group: 'Order Blocks', inline: 'bearcss' },
  { id: 'showLabels', type: 'bool', title: 'Show Historical Polarity Changes', defval: false, group: 'Order Blocks' },
  { id: 'showLq', type: 'bool', title: 'Show Liquidity', defval: true, group: 'Liquidity' },
  { id: 'margin', type: 'float', title: 'margin', defval: 4, min: 2, max: 7, step: 0.1, group: 'Liquidity' },
  { id: 'visLiq', type: 'int', title: '# Visible Liq. boxes', defval: 2, min: 1, max: 50, group: 'Liquidity', tooltip: 'In the same direction' },
  { id: 'cLIQ_B', type: 'color', title: nb('Buyside Liquidity  '), defval: '#fa451c', group: 'Liquidity' },
  { id: 'cLIQ_S', type: 'color', title: 'Sellside Liquidity', defval: '#1ce4fa', group: 'Liquidity' },
  { id: 'shwFVG', type: 'bool', title: 'Show FVGs', defval: true, group: 'Fair Value Gaps' },
  { id: 'i_BPR', type: 'bool', title: 'Balance Price Range', defval: false, group: 'Fair Value Gaps' },
  {
    id: 'i_FVG', type: 'string', title: 'Options', defval: 'FVG', options: ['FVG', 'IFVG'], group: 'Fair Value Gaps',
    tooltip: 'Fair Value Gaps\nor\nImplied Fair Value Gaps',
  },
  { id: 'visBxs', type: 'int', title: "# Visible FVG's", defval: 2, min: 1, max: 20, group: 'Fair Value Gaps', tooltip: 'In the same direction' },
  { id: 'cFVGbl', type: 'color', title: nb('Bullish FVG  '), defval: '#00e676', group: 'Fair Value Gaps', inline: 'FVGbl' },
  { id: 'cFVGblBR', type: 'color', title: 'Break', defval: '#808000', group: 'Fair Value Gaps', inline: 'FVGbl' },
  { id: 'cFVGbr', type: 'color', title: nb('Bearish FVG '), defval: '#ff5252', group: 'Fair Value Gaps', inline: 'FVGbr' },
  { id: 'cFVGbrBR', type: 'color', title: 'Break', defval: '#FF0000', group: 'Fair Value Gaps', inline: 'FVGbr' },
  { id: 'iNWOG', type: 'bool', title: '', defval: true, group: 'NWOG/NDOG', inline: 'NWOG' },
  { id: 'cNWOG1', type: 'color', title: nb('NWOG    '), defval: 'rgba(255, 82, 82, 0.72)', group: 'NWOG/NDOG', inline: 'NWOG' },
  { id: 'cNWOG2', type: 'color', title: '', defval: 'rgba(178, 181, 190, 0.5)', group: 'NWOG/NDOG', inline: 'NWOG' },
  { id: 'maxNWOG', type: 'int', title: 'Show max', defval: 3, min: 0, max: 50, group: 'NWOG/NDOG', inline: 'NWOG' },
  { id: 'iNDOG', type: 'bool', title: '', defval: false, group: 'NWOG/NDOG', inline: 'NDOG' },
  { id: 'cNDOG1', type: 'color', title: nb('NDOG    '), defval: 'rgba(255, 152, 0, 0.8)', group: 'NWOG/NDOG', inline: 'NDOG' },
  { id: 'cNDOG2', type: 'color', title: '', defval: 'rgba(77, 208, 225, 0.35)', group: 'NWOG/NDOG', inline: 'NDOG' },
  { id: 'maxNDOG', type: 'int', title: 'Show max', defval: 1, min: 0, max: 50, group: 'NWOG/NDOG', inline: 'NDOG' },
  { id: 'iFib', type: 'string', title: 'Fibonacci between last: ', defval: 'NONE', options: ['FVG', 'BPR', 'OB', 'Liq', 'VI', 'NWOG', 'NONE'], group: 'Fibonacci' },
  { id: 'iExt', type: 'bool', title: 'Extend lines', defval: false, group: 'Fibonacci' },
  { id: 'showKZ', type: 'bool', title: 'Show Killzones', defval: false, group: 'Killzones' },
  { id: 'showNy', type: 'bool', title: `New${' '}York${sp1}`, defval: true, group: 'Killzones', inline: 'ny' },
  { id: 'nyCss', type: 'color', title: '', defval: 'rgba(255, 93, 0, 0.07)', group: 'Killzones', inline: 'ny' },
  { id: 'showLdno', type: 'bool', title: 'London Open', defval: true, group: 'Killzones', inline: 'lo' },
  { id: 'ldnoCss', type: 'color', title: '', defval: 'rgba(0, 188, 212, 0.07)', group: 'Killzones', inline: 'lo' },
  { id: 'showLdnc', type: 'bool', title: 'London Close', defval: true, group: 'Killzones', inline: 'lc' },
  { id: 'ldncCss', type: 'color', title: '', defval: 'rgba(33, 87, 243, 0.07)', group: 'Killzones', inline: 'lc' },
  { id: 'showAsia', type: 'bool', title: `Asian${sp2}`, defval: true, group: 'Killzones', inline: 'as' },
  { id: 'asiaCss', type: 'color', title: '', defval: 'rgba(233, 30, 99, 0.07)', group: 'Killzones', inline: 'as' },
  { id: 'nySession', type: 'session', title: '', defval: '0700-0900', group: 'Killzones', inline: 'ny' },
  { id: 'ldnoSession', type: 'session', title: '', defval: '0700-1000', group: 'Killzones', inline: 'lo' },
  { id: 'ldncSession', type: 'session', title: '', defval: '1500-1700', group: 'Killzones', inline: 'lc' },
  { id: 'asiaSession', type: 'session', title: '', defval: '1000-1400', group: 'Killzones', inline: 'as' },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'ICT Concepts [LuxAlgo]',
  shortTitle: 'ICT Concepts [LuxAlgo]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const ne = (a: number, b: number) => Math.abs(a - b) > EPS;
/** nz(x, replacement) */
const nz = (x: number, replacement = 0) => (Number.isNaN(x) ? replacement : x);
const pineMin = (a: number, b: number) => math.min(a, b) as number;
const pineMax = (a: number, b: number) => math.max(a, b) as number;
/** Values of a Pine `for i = from to to` loop: it counts down when from > to */
function range(from: number, to: number): number[] {
  const out: number[] = [];
  if (from <= to) for (let i = from; i <= to; i++) out.push(i);
  else for (let i = from; i >= to; i--) out.push(i);
  return out;
}
/** An na colour (drawn transparent) */
const NA_COLOR = NaN;
/** Runtime error of array.get(0) on an empty array */
const EMPTY_ARRAY = "In 'array.get()' function. Index 0 is out of bounds, array size is 0.";

// Colour constants of Pine v5
const LIME = '#00E676';
const RED = '#FF5252';
const SILVER = '#B2B5BE';
const ORANGE = '#FF9800';
const YELLOW = '#FFEB3B';
const GREEN = '#4CAF50';

type Box = ReturnType<typeof box.new>;
type Line = ReturnType<typeof line.new>;
type Label = ReturnType<typeof label.new>;

// Getters / setters of drawing ids that can be na (null)
const bTop = (id: Box | null) => (id ? box.get_top(id) : NaN);
const bBottom = (id: Box | null) => (id ? box.get_bottom(id) : NaN);
const bLeft = (id: Box | null) => (id ? box.get_left(id) : NaN);
const bRight = (id: Box | null) => (id ? box.get_right(id) : NaN);
const delBox = (id: Box | null) => { if (id) box.delete(id); };
const delLine = (id: Line | null) => { if (id) line.delete(id); };
const lX1 = (id: Line | null) => (id ? line.get_x1(id) : NaN);
const lY1 = (id: Line | null) => (id ? line.get_y1(id) : NaN);
const lY2 = (id: Line | null) => (id ? line.get_y2(id) : NaN);

interface Liq { bx: Box | null; broken: boolean; brokenTop: boolean; brokenBtm: boolean; ln: Line | null }
interface Ob { top: number; btm: number; loc: number; breaker: boolean; break_loc: number }
interface Swing { y: number; x: number; crossed: boolean }
interface Fvg { box: Box | null; active: boolean; pos: number }
interface BxLn { b: Box | null; l: Line | null }
interface BxLnLb { bx: Box | null; ln: Line | null; lb: Label | null }
interface TwoLnLb { l1: Line; l2: Line; lb: Label }

export function calculate(
  bars: Bar[],
  inputs: Partial<IctConceptsInputs> = {},
): IndicatorResult & { lines: LineDrawingData[]; boxes: BoxData[]; labels: LabelData[]; markers: MarkerData[]; bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const { len, length, showBull, showBear, visVim, visLiq, visBxs, maxNWOG, maxNDOG, iFib } = cfg;
  const { showMS, iMSS, iBOS, sVimbl, showOB, showLabels, showLq, shwFVG, i_BPR, iNWOG, iNDOG } = cfg;
  const present = cfg.i_mode === 'Present';
  const isFVG = cfg.i_FVG === 'FVG';
  const a = 10 / cfg.margin;
  const showNy = cfg.showNy && cfg.showKZ;
  const showLdno = cfg.showLdno && cfg.showKZ;
  const showLdnc = cfg.showLdnc && cfg.showKZ;
  const showAsia = cfg.showAsia && cfg.showKZ;
  const n = bars.length;
  const msTimes = n > 0 && bars[0].time >= 1e12;
  const T = bars.map((b) => (msTimes ? b.time : b.time * 1000));
  const O = bars.map((b) => b.open);
  const H = bars.map((b) => b.high);
  const L = bars.map((b) => b.low);
  const C = bars.map((b) => b.close);
  const at = (arr: number[], i: number) => (i >= 0 ? arr[i] : NaN);

  // General calculations
  const tf = chartTimeframe(bars);
  const tfMsec = tf === '' ? NaN : timeframe.in_seconds(tf) * 1000;
  const timenow = Date.now();
  const maxSize = 50;
  const perc_Body = 0.36;
  const bxBack = 10;
  const toArr = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const atrArr = toArr(ta.atr(bars, 10));
  const MX = bars.map((b) => Math.max(b.close, b.open));
  const MN = bars.map((b) => Math.min(b.close, b.open));
  const BODY = bars.map((b) => Math.abs(b.close - b.open));
  const meanBody = toArr(ta.sma(Series.fromArray(bars, BODY), len));
  const MAXS = cfg.useBody ? MX : H;
  const MINS = cfg.useBody ? MN : L;
  const highS = Series.fromArray(bars, H);
  const lowS = Series.fromArray(bars, L);
  const phArr = toArr(ta.pivothigh(highS, len, 1));
  const plArr = toArr(ta.pivotlow(lowS, len, 1));
  const upperArr = toArr(ta.highest(highS, length));
  const lowerArr = toArr(ta.lowest(lowS, length));
  const xlocFib = iFib === 'OB' ? 'bar_time' : 'bar_index';
  const ext = cfg.iExt ? 'right' : 'none';
  const plus = iFib === 'OB' ? tfMsec * 50 : 50;

  // Colours
  const fvgBlBg = String(color.new(cfg.cFVGbl, 90));
  const fvgBlLine = String(color.new(cfg.cFVGbl, 65));
  const fvgBrBg = String(color.new(cfg.cFVGbr, 90));
  const fvgBrLine = String(color.new(cfg.cFVGbr, 65));
  const fvgBlBreak = String(color.new(cfg.cFVGblBR, 95));
  const fvgBrBreak = String(color.new(cfg.cFVGbrBR, 95));
  const liqBText = String(color.new(cfg.cLIQ_B, 25));
  const liqSText = String(color.new(cfg.cLIQ_S, 25));
  const liqBLine = String(color.new(cfg.cLIQ_B, 0));
  const liqSLine = String(color.new(cfg.cLIQ_S, 0));
  const liqBBg = String(color.new(cfg.cLIQ_B, 90));
  const liqSBg = String(color.new(cfg.cLIQ_S, 90));

  const markers: MarkerData[] = [];
  const bgColors: BgColorData[] = [];

  const run = executeScript(() => {
    declareIndicator(metadata.title, { overlay: true, max_lines_count: 500, max_boxes_count: 500, max_labels_count: 500 });
    if (n === 0) return;
    const lastIndex = n - 1;

    // Variables
    const MSS = {
      dir: 0,
      l_mssBl: [] as Line[], l_mssBr: [] as Line[], l_bosBl: [] as Line[], l_bosBr: [] as Line[],
      lbMssBl: [] as Label[], lbMssBr: [] as Label[], lbBosBl: [] as Label[], lbBosBr: [] as Label[],
    };
    let friCp = NaN;
    let friCi = NaN;
    let monOp = NaN;
    let monOi = NaN;
    let prDCp = NaN;
    let prDCi = NaN;
    let cuDOp = NaN;
    let cuDOi = NaN;
    const Vimbal: TwoLnLb[] = [];
    const b_liq_B: Liq[] = [{ bx: null, broken: false, brokenTop: false, brokenBtm: false, ln: null }];
    const b_liq_S: Liq[] = [{ bx: null, broken: false, brokenTop: false, brokenBtm: false, ln: null }];
    const bullish_ob: Ob[] = [];
    const bearish_ob: Ob[] = [];
    const bl_NWOG: BxLn[] = [];
    const bl_NDOG: BxLn[] = [];
    const a_bx_ln_lb: BxLnLb[] = [];
    const bFVG_UP: Fvg[] = [];
    const bFVG_DN: Fvg[] = [];
    const bBPR_UP: Fvg[] = [];
    const bBPR_DN: Fvg[] = [];
    const aZZ = {
      d: new Array<number>(maxSize).fill(0),
      x: new Array<number>(maxSize).fill(0),
      y: new Array<number>(maxSize).fill(NaN),
    };
    // Fibonacci lines (created on the first bar, without coordinates)
    const fibLine = (css: string, transp: number, style: 'solid' | 'dashed' | 'dotted', extend: 'none' | 'right') =>
      line.new(NaN, NaN, NaN, NaN, xlocFib, extend, String(color.new(css, transp)), style);
    const _diag = fibLine(SILVER, 50, 'dashed', 'none');
    const _vert = fibLine(SILVER, 50, 'dotted', 'none');
    const _zero = fibLine(SILVER, 5, 'solid', ext);
    const _0236 = fibLine(ORANGE, 25, 'solid', ext);
    const _0382 = fibLine(YELLOW, 25, 'solid', ext);
    const _0500 = fibLine(GREEN, 25, 'solid', ext);
    const _0618 = fibLine(YELLOW, 25, 'solid', ext);
    const _0786 = fibLine(ORANGE, 25, 'solid', ext);
    const _one_ = fibLine(SILVER, 5, 'solid', ext);
    const _1618 = fibLine(YELLOW, 25, 'solid', ext);
    const setLine = (ln: Line, x1: number, y1: number, x2: number, y2: number) => {
      line.set_xy1(ln, x1, y1);
      line.set_xy2(ln, x2, y2);
    };

    const clearLines = (l: Line[]) => { while (l.length > 0) line.delete(l.pop() as Line); };
    const clearLabels = (l: Label[]) => { while (l.length > 0) label.delete(l.pop() as Label); };
    const clearStructure = () => {
      clearLines(MSS.l_bosBl);
      clearLines(MSS.l_bosBr);
      clearLabels(MSS.lbBosBl);
      clearLabels(MSS.lbBosBr);
      clearLines(MSS.l_mssBl);
      clearLines(MSS.l_mssBr);
      clearLabels(MSS.lbMssBl);
      clearLabels(MSS.lbMssBr);
    };
    /** array.get(0) of a line array: a runtime error on an empty array */
    const first = <X>(arr: X[]): X => {
      if (arr.length === 0) throw new Error(EMPTY_ARRAY);
      return arr[0];
    };

    // swings()
    let os = 0;
    let prevOs = NaN;
    let top: Swing = { y: NaN, x: NaN, crossed: false };
    let btm: Swing = { y: NaN, x: NaN, crossed: false };
    // History values
    let imbUP1 = false;
    let imbDN1 = false;
    let blBrkConf1 = NaN;
    let brBrkConf1 = NaN;
    let dow1 = NaN;

    for (let i = 0; i < n; i++) {
      const open = O[i];
      const high = H[i];
      const low = L[i];
      const close = C[i];
      const time = T[i];
      const atr = atrArr[i];
      const per = present ? lastIndex - i <= 500 : true;
      const mx = MX[i];
      const mn = MN[i];
      const isLast = i === lastIndex;
      let blBrkConf = 0;
      let brBrkConf = 0;

      // ---- draw(len, color.yellow) ----
      {
        const x2 = i - 1;
        const ph = phArr[i];
        const pl = plArr[i];
        // if ph (a float as a condition: na and 0 are false)
        if (!Number.isNaN(ph) && ph !== 0) {
          const dir = aZZ.d[0];
          const y1 = aZZ.y[0];
          const y2 = nz(at(H, i - 1));
          if (dir < 1) {
            // previous point was a pivot low: add a point, direction 1
            aZZ.d.unshift(1);
            aZZ.x.unshift(x2);
            aZZ.y.unshift(y2);
            aZZ.d.pop();
            aZZ.x.pop();
            aZZ.y.pop();
          } else if (dir === 1 && gt(ph, y1)) {
            aZZ.x[0] = x2;
            aZZ.y[0] = y2;
          }
          // Liquidity
          if (showLq && per) {
            let count = 0;
            let st_P = 0;
            let st_B = 0;
            let minP = 0;
            let maxP = 10e6;
            for (const k of range(0, maxSize - 1)) {
              if (aZZ.d[k] === 1) {
                const y = aZZ.y[k];
                if (gt(y, ph + atr / a)) break;
                else if (gt(y, ph - atr / a) && lt(y, ph + atr / a)) {
                  count += 1;
                  st_B = aZZ.x[k];
                  st_P = y;
                  if (gt(y, minP)) minP = y;
                  if (lt(y, maxP)) maxP = y;
                }
              }
            }
            if (count > 2) {
              const getB = b_liq_B[0];
              const mid = (minP + maxP) / 2;
              if (st_B === bLeft(getB.bx)) {
                if (getB.bx) {
                  box.set_top(getB.bx, mid + atr / a);
                  box.set_rightbottom(getB.bx, i + 10, mid - atr / a);
                }
              } else {
                b_liq_B.unshift({
                  bx: box.new(st_B, mid + atr / a, i + 10, mid - atr / a, NA_COLOR, undefined, undefined, undefined, undefined,
                    NA_COLOR, 'Buyside liquidity', 'tiny', liqBText, 'left', 'bottom'),
                  broken: false,
                  brokenTop: false,
                  brokenBtm: false,
                  ln: line.new(st_B, st_P, i - 1, st_P, undefined, undefined, liqBLine),
                });
              }
            }
            if (b_liq_B.length > visLiq) {
              const getLast = b_liq_B.pop() as Liq;
              delBox(getLast.bx);
              delLine(getLast.ln);
            }
          }
        }
        if (!Number.isNaN(pl) && pl !== 0) {
          const dir = aZZ.d[0];
          const y1 = aZZ.y[0];
          const y2 = nz(at(L, i - 1));
          if (dir > -1) {
            // previous point was a pivot high: add a point, direction -1
            aZZ.d.unshift(-1);
            aZZ.x.unshift(x2);
            aZZ.y.unshift(y2);
            aZZ.d.pop();
            aZZ.x.pop();
            aZZ.y.pop();
          } else if (dir === -1 && lt(pl, y1)) {
            aZZ.x[0] = x2;
            aZZ.y[0] = y2;
          }
          // Liquidity
          if (showLq && per) {
            let count = 0;
            let st_P = 0;
            let st_B = 0;
            let minP = 0;
            let maxP = 10e6;
            for (const k of range(0, maxSize - 1)) {
              if (aZZ.d[k] === -1) {
                const y = aZZ.y[k];
                if (lt(y, pl - atr / a)) break;
                else if (gt(y, pl - atr / a) && lt(y, pl + atr / a)) {
                  count += 1;
                  st_B = aZZ.x[k];
                  st_P = y;
                  if (gt(y, minP)) minP = y;
                  if (lt(y, maxP)) maxP = y;
                }
              }
            }
            if (count > 2) {
              const getB = b_liq_S[0];
              const mid = (minP + maxP) / 2;
              if (st_B === bLeft(getB.bx)) {
                if (getB.bx) {
                  box.set_top(getB.bx, mid + atr / a);
                  box.set_rightbottom(getB.bx, i + 10, mid - atr / a);
                }
              } else {
                b_liq_S.unshift({
                  bx: box.new(st_B, mid + atr / a, i + 10, mid - atr / a, NA_COLOR, undefined, undefined, undefined, undefined,
                    NA_COLOR, 'Sellside liquidity', 'tiny', liqSText, 'left', 'bottom'),
                  broken: false,
                  brokenTop: false,
                  brokenBtm: false,
                  ln: line.new(st_B, st_P, i - 1, st_P, undefined, undefined, liqSLine),
                });
              }
            }
            if (b_liq_S.length > visLiq) {
              const getLast = b_liq_S.pop() as Liq;
              delBox(getLast.bx);
              delLine(getLast.ln);
            }
          }
        }
        // Market Structure Shift
        if (showMS) {
          const iH = aZZ.d[2] === 1 ? 2 : 1;
          const iL = aZZ.d[2] === -1 ? 2 : 1;
          const yH = aZZ.y[iH];
          const yL = aZZ.y[iL];
          const midX = (k: number) => math.round((aZZ.x[k] + i) / 2) as number;
          const setLin = (k: number, bull: boolean) =>
            line.new(aZZ.x[k], aZZ.y[k], i, aZZ.y[k], undefined, undefined, bull ? LIME : RED, 'dotted');
          const setLab = (k: number, bull: boolean) =>
            label.new(midX(k), aZZ.y[k], 'BOS', undefined, undefined, NA_COLOR, bull ? 'label_down' : 'label_up', bull ? LIME : RED, 'tiny');
          if (gt(close, yH) && aZZ.d[iH] === 1 && MSS.dir < 1) {
            // MSS Bullish
            MSS.dir = 1;
            if (present) clearStructure();
            MSS.l_mssBl.unshift(line.new(aZZ.x[iH], yH, i, yH, undefined, undefined, cfg.cMSSbl));
            MSS.lbMssBl.unshift(label.new(midX(iH), yH, 'MSS', undefined, undefined, NA_COLOR, 'label_down', cfg.cMSSbl, 'tiny'));
          } else if (lt(close, yL) && aZZ.d[iL] === -1 && MSS.dir > -1) {
            // MSS Bearish
            MSS.dir = -1;
            if (present) clearStructure();
            MSS.l_mssBr.unshift(line.new(aZZ.x[iL], yL, i, yL, undefined, undefined, cfg.cMSSbr));
            MSS.lbMssBr.unshift(label.new(midX(iL), yL, 'MSS', undefined, undefined, NA_COLOR, 'label_up', cfg.cMSSbr, 'tiny'));
          } else if (MSS.dir === 1 && gt(close, yH) && iBOS) {
            // BOS Bullish (both sides of `and` are evaluated)
            if (MSS.l_bosBl.length > 0) {
              const c1 = ne(yH, lY2(MSS.l_bosBl[0]));
              const c2 = ne(yH, lY2(first(MSS.l_mssBl)));
              if (c1 && c2) {
                MSS.l_bosBl.unshift(setLin(iH, true));
                MSS.lbBosBl.unshift(setLab(iH, true));
              }
            } else if (ne(yH, lY2(first(MSS.l_mssBl)))) {
              MSS.l_bosBl.unshift(setLin(iH, true));
              MSS.lbBosBl.unshift(setLab(iH, true));
            }
          } else if (MSS.dir === -1 && lt(close, yL) && iBOS) {
            // BOS Bearish
            if (MSS.l_bosBr.length > 0) {
              const c1 = ne(yL, lY2(MSS.l_bosBr[0]));
              const c2 = ne(yL, lY2(first(MSS.l_mssBr)));
              if (c1 && c2) {
                MSS.l_bosBr.unshift(setLin(iL, false));
                MSS.lbBosBr.unshift(setLab(iL, false));
              }
            } else if (ne(yL, lY2(first(MSS.l_mssBr)))) {
              MSS.l_bosBr.unshift(setLin(iL, false));
              MSS.lbBosBr.unshift(setLab(iL, false));
            }
          }
          if (!iMSS) {
            line.set_color(first(MSS.l_mssBl), NA_COLOR);
            label.set_textcolor(first(MSS.lbMssBl), NA_COLOR);
            line.set_color(first(MSS.l_mssBr), NA_COLOR);
            label.set_textcolor(first(MSS.lbMssBr), NA_COLOR);
          }
        }
      }

      if (MSS.l_bosBl.length > 200) {
        line.delete(MSS.l_bosBl.pop() as Line);
        label.delete(MSS.lbBosBl.pop() as Label);
      }
      if (MSS.l_bosBr.length > 200) {
        line.delete(MSS.l_bosBr.pop() as Line);
        label.delete(MSS.lbBosBr.pop() as Label);
      }

      // ---- Killzones: time(timeframe.period, session, time zone) and show ----
      const ny = showNy && pineTime.inSession(time, cfg.nySession, 'America/New_York');
      const ldn_open = showLdno && pineTime.inSession(time, cfg.ldnoSession, 'Europe/London');
      const ldn_close = showLdnc && pineTime.inSession(time, cfg.ldncSession, 'Europe/London');
      const asian = showAsia && pineTime.inSession(time, cfg.asiaSession, 'Asia/Tokyo');

      // ---- Candles ----
      const candle = (k: number) => {
        if (k < 0) return { up: false, dn: false };
        const lBody = lt(H[k] - MX[k], BODY[k] * perc_Body) && lt(MN[k] - L[k], BODY[k] * perc_Body);
        const big = gt(BODY[k], meanBody[k]);
        return { up: big && lBody && gt(C[k], O[k]), dn: big && lBody && lt(C[k], O[k]) };
      };
      const cur = candle(i);
      const prev = candle(i - 1);

      // Imbalance
      const high2 = at(H, i - 2);
      const low2 = at(L, i - 2);
      const imbalanceUP = prev.up && (isFVG ? gt(low, high2) : lt(low, high2));
      const imbalanceDN = prev.dn && (isFVG ? lt(high, low2) : gt(high, low2));

      // ---- Volume Imbalance ----
      const close1 = at(C, i - 1);
      const open1 = at(O, i - 1);
      const high1 = at(H, i - 1);
      const low1 = at(L, i - 1);
      const mx1 = at(MX, i - 1);
      const mn1 = at(MN, i - 1);
      const vImb_Bl = gt(open, close1) && gt(high1, low) && gt(close, close1) && gt(open, open1) && lt(high1, mn);
      const vImb_Br = lt(open, close1) && lt(low1, high) && lt(close, close1) && lt(open, open1) && gt(low1, mx);
      if (sVimbl) {
        if (vImb_Bl) {
          Vimbal.unshift({
            l1: line.new(i - 1, mx1, i + 3, mx1, undefined, undefined, cfg.cVimbl),
            l2: line.new(i, mn, i + 3, mn, undefined, undefined, cfg.cVimbl),
            lb: label.new(i + 3, (mx1 + mn) / 2, 'VI', undefined, undefined, NA_COLOR, 'label_left', cfg.cVimbl),
          });
        }
        if (vImb_Br) {
          Vimbal.unshift({
            l1: line.new(i - 1, mn1, i + 3, mn1, undefined, undefined, cfg.cVimbl),
            l2: line.new(i, mx, i + 3, mx, undefined, undefined, cfg.cVimbl),
            lb: label.new(i + 3, (mn1 + mx) / 2, 'VI', undefined, undefined, NA_COLOR, 'label_left', cfg.cVimbl),
          });
        }
        if (Vimbal.length > visVim) {
          const pop = Vimbal.pop() as TwoLnLb;
          line.delete(pop.l1);
          line.delete(pop.l2);
          label.delete(pop.lb);
        }
      }

      // ---- Fair Value Gap ----
      if (i === 0) {
        for (const _k of range(0, visBxs - 1)) {
          bFVG_UP.unshift({ box: null, active: false, pos: NaN });
          bFVG_DN.unshift({ box: null, active: false, pos: NaN });
          if (i_BPR) {
            bBPR_UP.unshift({ box: null, active: false, pos: NaN });
            bBPR_DN.unshift({ box: null, active: false, pos: NaN });
          }
        }
      }
      const fvgBox = (top_: number, bottom_: number, bg: string, edge: string) =>
        box.new(i - 2, top_, i, bottom_, i_BPR ? NA_COLOR : edge, undefined, undefined, undefined, undefined,
          i_BPR ? NA_COLOR : bg, cfg.i_FVG, 'small', i_BPR ? NA_COLOR : edge);
      if (imbalanceUP && per && shwFVG) {
        if (imbUP1) {
          const b0 = bFVG_UP[0].box;
          if (b0) {
            box.set_lefttop(b0, i - 2, low);
            box.set_rightbottom(b0, i + 8, high2);
          }
        } else {
          bFVG_UP.unshift({ box: fvgBox(isFVG ? low : high2, isFVG ? high2 : low, fvgBlBg, fvgBlLine), active: true, pos: NaN });
          delBox((bFVG_UP.pop() as Fvg).box);
        }
      }
      if (imbalanceDN && per && shwFVG) {
        if (imbDN1) {
          const b0 = bFVG_DN[0].box;
          if (b0) {
            box.set_lefttop(b0, i - 2, low2);
            box.set_rightbottom(b0, i + 8, high);
          }
        } else {
          bFVG_DN.unshift({ box: fvgBox(isFVG ? low2 : high, isFVG ? high : low2, fvgBrBg, fvgBrLine), active: true, pos: NaN });
          delBox((bFVG_DN.pop() as Fvg).box);
        }
      }

      // Balance Price Range (overlap of the 2 latest FVG bull / bear)
      if (i_BPR && bFVG_UP.length > 0 && bFVG_DN.length > 0) {
        const bxUP = bFVG_UP[0].box;
        const bxDN = bFVG_DN[0].box;
        const bxUPbtm = bBottom(bxUP);
        const bxDNbtm = bBottom(bxDN);
        const bxUPtop = bTop(bxUP);
        const bxDNtop = bTop(bxDN);
        const left = pineMin(bLeft(bxUP), bLeft(bxDN));
        const right = pineMax(bRight(bxUP), bRight(bxDN));
        const bprBox = (top_: number, bottom_: number, bg: string, edge: string) =>
          box.new(left, top_, right, bottom_, edge, undefined, undefined, undefined, undefined, bg, 'BPR', 'small', edge);
        if (lt(bxUPbtm, bxDNtop) && lt(bxDNbtm, bxUPbtm)) {
          const b0 = first(bBPR_UP);
          if (left === bLeft(b0.box)) {
            if (b0.active && b0.box) box.set_right(b0.box, right);
          } else {
            bBPR_UP.unshift({
              box: bprBox(bxDNtop, bxUPbtm, fvgBlBg, fvgBlLine),
              active: true,
              pos: gt(close, bxUPbtm) ? 1 : lt(close, bxDNtop) ? -1 : 0,
            });
            delBox((bBPR_UP.pop() as Fvg).box);
          }
        }
        if (lt(bxDNbtm, bxUPtop) && lt(bxUPbtm, bxDNbtm)) {
          const b0 = first(bBPR_DN);
          if (left === bLeft(b0.box)) {
            if (b0.active && b0.box) box.set_right(b0.box, right);
          } else {
            bBPR_DN.unshift({
              box: bprBox(bxUPtop, bxDNbtm, fvgBrBg, fvgBrLine),
              active: true,
              pos: gt(close, bxDNbtm) ? 1 : lt(close, bxUPtop) ? -1 : 0,
            });
            delBox((bBPR_DN.pop() as Fvg).box);
          }
        }
      }

      // FVG's breaks
      for (const k of range(0, Math.min(bxBack, bFVG_UP.length - 1))) {
        const g = bFVG_UP[k];
        if (g.active) {
          const b = g.box;
          if (b) box.set_right(b, i + 8);
          if (lt(low, bTop(b)) && !i_BPR && b) box.set_border_style(b, 'dashed');
          if (lt(low, bBottom(b))) {
            if (!i_BPR && b) {
              box.set_bgcolor(b, fvgBlBreak);
              box.set_border_style(b, 'dotted');
            }
            if (b) box.set_right(b, i);
            g.active = false;
          }
        }
      }
      for (const k of range(0, Math.min(bxBack, bFVG_DN.length - 1))) {
        const g = bFVG_DN[k];
        if (g.active) {
          const b = g.box;
          if (b) box.set_right(b, i + 8);
          if (gt(high, bBottom(b)) && !i_BPR && b) box.set_border_style(b, 'dashed');
          if (gt(high, bTop(b))) {
            if (!i_BPR && b) {
              box.set_bgcolor(b, fvgBrBreak);
              box.set_border_style(b, 'dotted');
            }
            if (b) box.set_right(b, i);
            g.active = false;
          }
        }
      }
      if (i_BPR) {
        const bprBreaks = (list: Fvg[], breakCss: string) => {
          for (const k of range(0, Math.min(bxBack, list.length - 1))) {
            const g = list[k];
            if (!g.active) continue;
            const b = g.box;
            if (b) box.set_right(b, i + 8);
            const broken = () => {
              if (b) {
                box.set_bgcolor(b, breakCss);
                box.set_border_style(b, 'dotted');
                box.set_right(b, i);
              }
              g.active = false;
            };
            if (g.pos === -1) {
              if (gt(high, bBottom(b)) && b) box.set_border_style(b, 'dashed');
              if (gt(high, bTop(b))) broken();
            } else if (g.pos === 1) {
              if (lt(low, bTop(b)) && b) box.set_border_style(b, 'dashed');
              if (lt(low, bBottom(b))) broken();
            }
          }
        };
        bprBreaks(bBPR_UP, fvgBlBreak);
        bprBreaks(bBPR_DN, fvgBrBreak);
      }

      // ---- NWOG / NDOG ----
      if (i === 0) {
        for (const _k of range(0, maxNWOG - 1)) bl_NWOG.unshift({ b: null, l: null });
        for (const _k of range(0, maxNDOG - 1)) bl_NDOG.unshift({ b: null, l: null });
      }
      const dow = pineTime.dayofweek(time, 'UTC');
      if (dow === 6) {
        friCp = close;
        friCi = i;
      }
      // ta.change(dayofweek) as a condition: na (first bar) and 0 are false
      if (!Number.isNaN(dow1) && dow !== dow1) {
        if (dow === 2 && iNWOG) {
          monOp = open;
          monOi = i;
          bl_NWOG.unshift({
            b: box.new(friCi, pineMax(friCp, monOp), monOi, pineMin(friCp, monOp), cfg.cNWOG2, undefined, undefined, 'right', undefined, NA_COLOR),
            l: line.new(monOi, (friCp + monOp) / 2, monOi + 1, (friCp + monOp) / 2, undefined, 'right', cfg.cNWOG1, 'dotted'),
          });
          const bl = bl_NWOG.pop() as BxLn;
          delBox(bl.b);
          delLine(bl.l);
        }
        if (iNDOG) {
          cuDOp = open;
          cuDOi = i;
          prDCp = close1;
          prDCi = i - 1;
          bl_NDOG.unshift({
            b: box.new(prDCi, pineMax(prDCp, cuDOp), cuDOi, pineMin(prDCp, cuDOp), cfg.cNDOG2, undefined, undefined, 'right', undefined, NA_COLOR),
            l: line.new(cuDOi, (prDCp + cuDOp) / 2, cuDOi + 1, (prDCp + cuDOp) / 2, undefined, 'right', cfg.cNDOG1, 'dotted'),
          });
          const bl = bl_NDOG.pop() as BxLn;
          delBox(bl.b);
          delLine(bl.l);
        }
      }

      // ---- Liquidity ----
      for (const k of range(0, b_liq_B.length - 1)) {
        const x = b_liq_B[k];
        if (!x.broken) {
          if (x.bx) box.set_right(x.bx, i + 3);
          if (x.ln) line.set_x2(x.ln, i + 3);
          if (!x.brokenTop && gt(close, bTop(x.bx))) x.brokenTop = true;
          if (!x.brokenBtm && gt(close, bBottom(x.bx))) x.brokenBtm = true;
          if (x.brokenBtm) {
            if (x.bx) box.set_bgcolor(x.bx, liqBBg);
            delLine(x.ln);
            if (x.brokenTop) {
              x.broken = true;
              if (x.bx) box.set_right(x.bx, i);
            }
          }
        }
      }
      for (const k of range(0, b_liq_S.length - 1)) {
        const x = b_liq_S[k];
        if (!x.broken) {
          if (x.bx) box.set_right(x.bx, i + 3);
          if (x.ln) line.set_x2(x.ln, i + 3);
          if (!x.brokenTop && lt(close, bTop(x.bx))) x.brokenTop = true;
          if (!x.brokenBtm && lt(close, bBottom(x.bx))) x.brokenBtm = true;
          if (x.brokenTop) {
            if (x.bx) box.set_bgcolor(x.bx, liqSBg);
            delLine(x.ln);
            if (x.brokenBtm) {
              x.broken = true;
              if (x.bx) box.set_right(x.bx, i);
            }
          }
        }
      }

      // ---- Order Blocks: swings(length) ----
      {
        const hLen = at(H, i - length);
        const lLen = at(L, i - length);
        os = gt(hLen, upperArr[i]) ? 0 : lt(lLen, lowerArr[i]) ? 1 : os;
        if (os === 0 && !Number.isNaN(prevOs) && prevOs !== 0) top = { y: hLen, x: i - length, crossed: false };
        if (os === 1 && !Number.isNaN(prevOs) && prevOs !== 1) btm = { y: lLen, x: i - length, crossed: false };
        prevOs = os;
      }
      if (showOB && per) {
        if (gt(close, top.y) && !top.crossed) {
          top.crossed = true;
          let minima = at(MAXS, i - 1);
          let maxima = at(MINS, i - 1);
          let loc = at(T, i - 1);
          for (const k of range(1, i - top.x - 1)) {
            minima = pineMin(at(MINS, i - k), minima);
            const same = eq(minima, at(MINS, i - k));
            maxima = same ? at(MAXS, i - k) : maxima;
            loc = same ? at(T, i - k) : loc;
          }
          bullish_ob.unshift({ top: maxima, btm: minima, loc, breaker: false, break_loc: NaN });
        }
        if (bullish_ob.length > 0) {
          for (const k of range(bullish_ob.length - 1, 0)) {
            const element = bullish_ob[k];
            if (!element.breaker) {
              if (lt(Math.min(close, open), element.btm)) {
                element.breaker = true;
                element.break_loc = time;
              }
            } else if (gt(close, element.top)) {
              bullish_ob.splice(k, 1);
            } else if (k < showBull && lt(top.y, element.top) && gt(top.y, element.btm)) {
              blBrkConf = 1;
            }
          }
        }
        // Set label
        if (blBrkConf > blBrkConf1 && showLabels) {
          label.new(top.x, top.y, '▼', undefined, undefined, NA_COLOR, 'label_down', String(color.new(cfg.bearCss, 0)), 'tiny');
        }
      }
      if (showOB && per) {
        if (lt(close, btm.y) && !btm.crossed) {
          btm.crossed = true;
          let minima = at(MINS, i - 1);
          let maxima = at(MAXS, i - 1);
          let loc = at(T, i - 1);
          for (const k of range(1, i - btm.x - 1)) {
            maxima = pineMax(at(MAXS, i - k), maxima);
            const same = eq(maxima, at(MAXS, i - k));
            minima = same ? at(MINS, i - k) : minima;
            loc = same ? at(T, i - k) : loc;
          }
          bearish_ob.unshift({ top: maxima, btm: minima, loc, breaker: false, break_loc: NaN });
        }
        if (bearish_ob.length > 0) {
          for (const k of range(bearish_ob.length - 1, 0)) {
            const element = bearish_ob[k];
            if (!element.breaker) {
              if (gt(Math.max(close, open), element.top)) {
                element.breaker = true;
                element.break_loc = time;
              }
            } else if (lt(close, element.btm)) {
              bearish_ob.splice(k, 1);
            } else if (k < showBear && gt(btm.y, element.btm) && lt(btm.y, element.top)) {
              brBrkConf = 1;
            }
          }
        }
        // Set label
        if (brBrkConf > brBrkConf1 && showLabels) {
          label.new(btm.x, btm.y, '▲', undefined, undefined, NA_COLOR, 'label_up', String(color.new(cfg.bullCss, 0)), 'tiny');
        }
      }

      // ---- Set Order Blocks ----
      if (isLast && showOB) {
        const display = (id: Ob, css: string, breakCss: string, bull: boolean) => {
          if (id.breaker) {
            a_bx_ln_lb.unshift({
              bx: box.new(id.loc, id.top, timenow + tfMsec * 10, id.btm, NA_COLOR, undefined, undefined, 'none', 'bar_time', breakCss),
              ln: null,
              lb: null,
            });
          } else {
            const y = bull ? id.btm : id.top;
            a_bx_ln_lb.unshift({
              bx: null,
              ln: line.new(id.loc, y, id.loc + tfMsec * 10, y, 'bar_time', undefined, css, undefined, 2),
              lb: label.new(id.loc + tfMsec * 10, y, bull ? '+OB' : '-OB', 'bar_time', undefined, NA_COLOR,
                bull ? 'label_up' : 'label_down', css, 'small'),
            });
          }
        };
        if (showBull > 0 && bullish_ob.length > 0) {
          for (const k of range(0, Math.min(showBull, bullish_ob.length) - 1)) display(bullish_ob[k], cfg.bullCss, cfg.bullBrkCss, true);
        }
        if (showBear > 0 && bearish_ob.length > 0) {
          for (const k of range(0, Math.min(showBear, bearish_ob.length) - 1)) display(bearish_ob[k], cfg.bearCss, cfg.bearBrkCss, false);
        }
      }

      // ---- Fibonacci ----
      if (isLast) {
        let x1 = 0;
        let y1 = 0;
        let x2 = 0;
        let y2 = 0;
        const between = (up: Box | null, dn: Box | null) => {
          const dnFirst = bLeft(up) > bLeft(dn);
          const dnBottm = gt(bTop(up), bTop(dn));
          x1 = dnFirst ? bLeft(dn) : bLeft(up);
          x2 = dnFirst ? bRight(up) : bRight(dn);
          y1 = dnFirst ? (dnBottm ? bBottom(dn) : bTop(dn)) : dnBottm ? bTop(up) : bBottom(up);
          y2 = dnFirst ? (dnBottm ? bTop(up) : bBottom(up)) : dnBottm ? bBottom(dn) : bTop(dn);
        };
        const betweenAB = (lnA: Line | null, bxA: Box | null, lnB: Line | null, bxB: Box | null) => {
          const xA = nz(lX1(lnA), bLeft(bxA));
          const xB = nz(lX1(lnB), bLeft(bxB));
          const AFirst = xB > xA;
          const yAT = nz(lY1(lnA), bTop(bxA));
          const yAB = nz(lY1(lnA), bBottom(bxA));
          const yBT = nz(lY1(lnB), bTop(bxB));
          const yBB = nz(lY1(lnB), bBottom(bxB));
          const ABottom = lt(yAB, yBB);
          x1 = AFirst ? xA : xB;
          x2 = AFirst ? xB : xA;
          y1 = AFirst ? (ABottom ? yAB : yAT) : ABottom ? yBT : yBB;
          y2 = AFirst ? (ABottom ? yBT : yBB) : ABottom ? yAB : yAT;
        };
        if (iFib === 'FVG') {
          if (bFVG_UP.length > 0 && bFVG_DN.length > 0) between(bFVG_UP[0].box, bFVG_DN[0].box);
        } else if (iFib === 'BPR') {
          if (bBPR_UP.length > 0 && bBPR_DN.length > 0) between(bBPR_UP[0].box, bBPR_DN[0].box);
        } else if (iFib === 'OB') {
          const oSz = a_bx_ln_lb.length;
          if (oSz > 1) betweenAB(a_bx_ln_lb[oSz - 1].ln, a_bx_ln_lb[oSz - 1].bx, a_bx_ln_lb[oSz - 2].ln, a_bx_ln_lb[oSz - 2].bx);
        } else if (iFib === 'Liq') {
          if (b_liq_B.length > 0 && b_liq_S.length > 0) betweenAB(b_liq_B[0].ln, b_liq_B[0].bx, b_liq_S[0].ln, b_liq_S[0].bx);
        } else if (iFib === 'VI') {
          if (Vimbal.length > 1) {
            const AxA = lX1(Vimbal[1].l2);
            const AxB = lX1(Vimbal[1].l1);
            const BxA = lX1(Vimbal[0].l2);
            const BxB = lX1(Vimbal[0].l1);
            const AyA = lY1(Vimbal[1].l2);
            const AyB = lY1(Vimbal[1].l1);
            const ByA = lY1(Vimbal[0].l2);
            const ByB = lY1(Vimbal[0].l1);
            const ABt = gt(pineMin(ByA, ByB), pineMin(AyA, AyB));
            x1 = pineMax(AxA, AxB);
            x2 = pineMax(BxA, BxB);
            y1 = ABt ? pineMin(AyA, AyB) : pineMax(AyA, AyB);
            y2 = ABt ? pineMax(ByA, ByB) : pineMin(ByA, ByB);
          }
        } else if (iFib === 'NWOG') {
          if (bl_NWOG.length > 1) between(bl_NWOG[0].b, bl_NWOG[1].b);
        }
        if (iFib !== 'NONE') {
          const rt = pineMax(x1, x2);
          const _0 = rt === x1 ? y1 : y2;
          const _1 = rt === x1 ? y2 : y1;
          const df = _1 - _0;
          const m0236 = df * 0.236;
          const m0382 = df * 0.382;
          const m0500 = df * 0.5;
          const m0618 = df * 0.618;
          const m0786 = df * 0.786;
          const m1618 = df * 1.618;
          setLine(_diag, x1, y1, x2, y2);
          setLine(_vert, rt, _0, rt, _0 + m1618);
          setLine(_zero, rt, _0, rt + plus, _0);
          setLine(_0236, rt, _0 + m0236, rt + plus, _0 + m0236);
          setLine(_0382, rt, _0 + m0382, rt + plus, _0 + m0382);
          setLine(_0500, rt, _0 + m0500, rt + plus, _0 + m0500);
          setLine(_0618, rt, _0 + m0618, rt + plus, _0 + m0618);
          setLine(_0786, rt, _0 + m0786, rt + plus, _0 + m0786);
          setLine(_one_, rt, _1, rt + plus, _1);
          setLine(_1618, rt, _0 + m1618, rt + plus, _0 + m1618);
        }
      }

      // ---- Displacement ----
      if (cfg.sDispl && per) {
        // a shape below / above the bar reads its series as a bool: na and 0 draw no shape
        if (cur.up && low !== 0) markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: LIME });
        if (cur.dn && high !== 0) markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: RED });
      }

      // ---- Background: killzones ----
      if (per) {
        if (ny) bgColors.push({ time: bars[i].time, color: cfg.nyCss });
        if (ldn_open) bgColors.push({ time: bars[i].time, color: cfg.ldnoCss });
        if (ldn_close) bgColors.push({ time: bars[i].time, color: cfg.ldncCss });
        if (asian) bgColors.push({ time: bars[i].time, color: cfg.asiaCss });
      }

      imbUP1 = imbalanceUP;
      imbDN1 = imbalanceDN;
      blBrkConf1 = blBrkConf;
      brBrkConf1 = brBrkConf;
      dow1 = dow;
    }
  }, bars, {}, { timeUnit: msTimes ? 'ms' : 's' });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    lines: run.result.lines ?? [],
    boxes: run.result.boxes ?? [],
    labels: run.result.labels ?? [],
    markers,
    bgColors,
  };
}

export const IctConcepts = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
