/**
 * Support and Resistance Signals MTF [LuxAlgo]
 *
 * Pivot highs / lows of `length` bars on each side open resistance / support zones: a box from the pivot price to
 * the pivot price -+ a margin (the relative range of the last `length` bars * 0.17 * margin) and a line at the
 * pivot price. A new pivot opens a zone only when it is outside the two newest zones of its side; else the zone it
 * touches is extended. The two newest zones of each side are followed bar by bar:
 * - breakout ('B' label): the previous close is beyond the zone (by 17 % of the zone range with "Avoid False
 *   Breakouts"); the zone ends and a zone of the other side starts at the same prices
 * - test ('T' label) and retest after a breakout ('R' label) of the zone
 * - rejection (label without text): a long wick (>= 1.618 * atr(17)) on high volume (>= 1.618 * sma(volume, 17))
 * - manipulation zone (box): the bar crosses the zone edge but closes within the manipulation margin
 * Optional swing labels on the pivots. Label tooltips give the signal name and the trading activity of the bar.
 *
 * The detection timeframe is not another data series: it only scales the detection length by
 * (timeframe minutes / chart timeframe minutes). The chart timeframe is the most frequent gap
 * between two bars; a daily chart counts 1440 minutes, a weekly one 10080, a monthly one 302400, as the original.
 * All outputs are drawings (at most 500 boxes, 500 lines and 500 labels). The swing label tooltips use the symbol
 * price tick (syminfo.mintick): bars carry no symbol info, the port uses a tick of 0.01.
 *
 * Reference: "Support and Resistance Signals MTF [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: (c) LuxAlgo
 */

import { ta, str, compare, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LabelData, LineDrawingData, BoxData, PineSize } from '../types';
import { barInterval, barTime } from '../bar-time';

type SignalSize = 'Auto' | 'Tiny' | 'Small' | 'Normal' | 'None';

export interface SupportResistanceSignalsMtfInputs {
  /** Detection Timeframe */
  srTF: 'Chart' | '15 Minutes' | '1 Hour' | '4 Hours' | '1 Day' | '1 Week';
  /** Detection Length */
  srLN: number;
  /** Support Resistance Margin */
  srMR: number;
  /** Support line colour */
  srSLC: string;
  /** Support zone colour */
  srSZC: string;
  /** Resistance line colour */
  srRLC: string;
  /** Resistance zone colour */
  srRZC: string;
  /** Check Previous Historical S&R Zone */
  srHST: boolean;
  /** Manupulation Zones */
  mnSH: boolean;
  /** Manupulation Margin */
  mnMR: number;
  /** Manipulation zone colour, support */
  mnSZC: string;
  /** Manipulation zone colour, resistance */
  mnRZC: string;
  /** Avoid False Breakouts */
  srFBO: boolean;
  /** Breakout colour, bullish */
  srBUC: string;
  /** Breakout colour, bearish */
  srBDC: string;
  /** Breakout label size */
  srBS: SignalSize;
  /** Test colour, bullish */
  srTUC: string;
  /** Test colour, bearish */
  srTDC: string;
  /** Test label size */
  srTS: SignalSize;
  /** Retest colour, bullish */
  srRUC: string;
  /** Retest colour, bearish */
  srRDC: string;
  /** Retest label size */
  srRS: SignalSize;
  /** Rejection colour, bullish */
  srPUC: string;
  /** Rejection colour, bearish */
  srPDC: string;
  /** Rejection label size */
  srPS: SignalSize;
  /** Swing Levels */
  swSH: 'Auto' | 'Small' | 'Normal' | 'Large' | 'None';
  /** Swing high colour */
  swHC: string;
  /** Swing low colour */
  swLC: string;
}

// Input colour defaults: color.new(c, 53 / 83 / 73 / 33) of the original
const TEAL_LINE = 'rgba(8,153,129,0.47)';
const TEAL_ZONE = 'rgba(8,153,129,0.17)';
const RED_LINE = 'rgba(242,54,69,0.47)';
const RED_ZONE = 'rgba(242,54,69,0.17)';
const TEAL_SIG = 'rgba(8,153,129,0.67)';
const RED_SIG = 'rgba(242,54,69,0.67)';
const WHITE = '#FFFFFF';
/** syminfo.mintick is not available to the port (Bar has no symbol info) */
const MINTICK = 0.01;
/** Pine: indicator(max_boxes_count = 500, max_lines_count = 500, max_labels_count = 500) */
const MAX_COUNT = 500;

export const defaultInputs: SupportResistanceSignalsMtfInputs = {
  srTF: 'Chart',
  srLN: 15,
  srMR: 2,
  srSLC: TEAL_LINE,
  srSZC: TEAL_ZONE,
  srRLC: RED_LINE,
  srRZC: RED_ZONE,
  srHST: true,
  mnSH: true,
  mnMR: 1.3,
  mnSZC: 'rgba(41,98,255,0.27)',
  mnRZC: 'rgba(255,152,0,0.27)',
  srFBO: true,
  srBUC: TEAL_SIG,
  srBDC: RED_SIG,
  srBS: 'Tiny',
  srTUC: 'rgba(41,98,255,0.67)',
  srTDC: 'rgba(224,64,251,0.67)',
  srTS: 'Tiny',
  srRUC: TEAL_SIG,
  srRDC: RED_SIG,
  srRS: 'Tiny',
  srPUC: TEAL_SIG,
  srPDC: RED_SIG,
  srPS: 'Tiny',
  swSH: 'None',
  swHC: RED_SIG,
  swLC: TEAL_SIG,
};

const SR_GROUP = 'Support & Resistance Settings';
const MN_GROUP = 'Manupulations';
const SIG_GROUP = 'Signals';
const OTH_GROUP = 'Others';
const SIZES = ['Auto', 'Tiny', 'Small', 'Normal', 'None'];

export const inputConfig: InputConfig[] = [
  {
    id: 'srTF', type: 'string', title: 'Detection Timeframe', defval: 'Chart',
    options: ['Chart', '15 Minutes', '1 Hour', '4 Hours', '1 Day', '1 Week'], group: SR_GROUP,
    tooltip: 'tip : in ranging markets higher timeframe resolution or higher detection length might help reduce the noise',
  },
  { id: 'srLN', type: 'int', title: 'Detection Length', defval: 15, group: SR_GROUP },
  { id: 'srMR', type: 'float', title: 'Support Resistance Margin', defval: 2, min: 0.1, max: 10, step: 0.1, group: SR_GROUP },
  { id: 'srSLC', type: 'color', title: '   - Support,     Lines', defval: TEAL_LINE, inline: 'srS', group: SR_GROUP },
  { id: 'srSZC', type: 'color', title: 'Zones', defval: TEAL_ZONE, inline: 'srS', group: SR_GROUP },
  { id: 'srRLC', type: 'color', title: '   - Resistance, Lines', defval: RED_LINE, inline: 'srR', group: SR_GROUP },
  { id: 'srRZC', type: 'color', title: 'Zones', defval: RED_ZONE, inline: 'srR', group: SR_GROUP },
  { id: 'srHST', type: 'bool', title: 'Check Previous Historical S&R Zone', defval: true, group: SR_GROUP },
  { id: 'mnSH', type: 'bool', title: 'Manupulation Zones', defval: true, group: MN_GROUP },
  { id: 'mnMR', type: 'float', title: 'Manupulation Margin', defval: 1.3, min: 0.1, max: 10, step: 0.1, group: MN_GROUP },
  { id: 'mnSZC', type: 'color', title: 'Manupulation Zones, Support', defval: 'rgba(41,98,255,0.27)', inline: 'LQ', group: MN_GROUP },
  { id: 'mnRZC', type: 'color', title: 'Resistance', defval: 'rgba(255,152,0,0.27)', inline: 'LQ', group: MN_GROUP },
  {
    id: 'srFBO', type: 'bool', title: 'Avoid False Breakouts', defval: true, group: SIG_GROUP,
    tooltip: 'Filters the breakouts that failed to continue beyond a level',
  },
  { id: 'srBUC', type: 'color', title: 'Breakouts, Bullish', defval: TEAL_SIG, inline: 'srB', group: SIG_GROUP },
  { id: 'srBDC', type: 'color', title: 'Bearish', defval: RED_SIG, inline: 'srB', group: SIG_GROUP },
  { id: 'srBS', type: 'string', title: '', defval: 'Tiny', options: SIZES, inline: 'srB', group: SIG_GROUP },
  { id: 'srTUC', type: 'color', title: 'Tests,        Bullish', defval: 'rgba(41,98,255,0.67)', inline: 'srT', group: SIG_GROUP },
  { id: 'srTDC', type: 'color', title: 'Bearish', defval: 'rgba(224,64,251,0.67)', inline: 'srT', group: SIG_GROUP },
  { id: 'srTS', type: 'string', title: '', defval: 'Tiny', options: SIZES, inline: 'srT', group: SIG_GROUP },
  { id: 'srRUC', type: 'color', title: 'Retests,     Bullish', defval: TEAL_SIG, inline: 'srR', group: SIG_GROUP },
  { id: 'srRDC', type: 'color', title: 'Bearish', defval: RED_SIG, inline: 'srR', group: SIG_GROUP },
  { id: 'srRS', type: 'string', title: '', defval: 'Tiny', options: SIZES, inline: 'srR', group: SIG_GROUP },
  { id: 'srPUC', type: 'color', title: 'Rejections, Bullish', defval: TEAL_SIG, inline: 'srP', group: SIG_GROUP },
  { id: 'srPDC', type: 'color', title: 'Bearish', defval: RED_SIG, inline: 'srP', group: SIG_GROUP },
  { id: 'srPS', type: 'string', title: '', defval: 'Tiny', options: SIZES, inline: 'srP', group: SIG_GROUP },
  { id: 'swSH', type: 'string', title: 'Swing Levels', defval: 'None', options: ['Auto', 'Small', 'Normal', 'Large', 'None'], inline: 'sw', group: OTH_GROUP },
  { id: 'swHC', type: 'color', title: 'H', defval: RED_SIG, inline: 'sw', group: OTH_GROUP },
  { id: 'swLC', type: 'color', title: 'L', defval: TEAL_SIG, inline: 'sw', group: OTH_GROUP },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Support and Resistance Signals MTF [LuxAlgo]',
  shortTitle: 'LuxAlgo - Support Resistance Signals MTF',
  overlay: true,
};

/** A box / line / label as Pine keeps it: x coordinates are bar indexes */
interface Bx { left: number; top: number; right: number; bottom: number; bg: string; deleted: boolean }
interface Ln { x1: number; y1: number; x2: number; y2: number; color: string; width: number; deleted: boolean }
interface Lb { x: number; y: number; text: string; color: string; style: 'label_up' | 'label_down'; textColor: string; size: PineSize; tooltip: string }
/** Pine type SnR: zone box, manipulation box, level line, breakout / test / retest / manipulation status, margin */
interface SnR { bx: Bx | null; lq: Bx | null; ln: Ln | null; b: boolean; t: boolean; r: boolean; l: boolean; m: number }

/** Pine math.max / math.min: na when an argument is na */
const pmax = (a: number, b: number) => (Number.isNaN(a) || Number.isNaN(b) ? NaN : Math.max(a, b));
const pmin = (a: number, b: number) => (Number.isNaN(a) || Number.isNaN(b) ? NaN : Math.min(a, b));
const { gt, lt, ge, le, ne, eq } = compare;

/** Pine f_getSize */
function labelSize(s: string): PineSize {
  switch (s) {
    case 'Tiny': return 'tiny';
    case 'Small': return 'small';
    case 'Normal': return 'normal';
    case 'Large': return 'large';
    case 'Huge': return 'huge';
    default: return 'auto';
  }
}

/** Chart timeframe in minutes as the original counts it (ch_m); NaN below one minute */
function chartMinutes(bars: Bar[]): number {
  const seconds = barInterval(bars) / (bars.length > 0 && bars[0].time >= 1e12 ? 1000 : 1);
  if (!(seconds > 0)) return NaN;
  if (seconds >= 28 * 86400) return 10080 * 30;
  if (seconds >= 7 * 86400) return 10080;
  if (seconds >= 86400) return 1440;
  return seconds >= 60 ? seconds / 60 : NaN;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<SupportResistanceSignalsMtfInputs> = {},
): IndicatorResult & { labels: LabelData[]; lines: LineDrawingData[]; boxes: BoxData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const { srTF, srMR, srSLC, srSZC, srRLC, srRZC, srHST, mnSH, mnMR, mnSZC, mnRZC, srFBO, srBS, srTS, srRS, srPS, srPUC, srPDC, swSH, swHC, swLC } = cfg;
  const n = bars.length;
  const empty = {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    labels: [] as LabelData[],
    lines: [] as LineDrawingData[],
    boxes: [] as BoxData[],
  };
  if (n === 0) return empty;

  // srLN := srLN * tf_m / ch_m keeps the fractional quotient (15 * 15 / 60 = 3.75). The lengths of ta.highest,
  // ta.lowest, ta.pivothigh / pivotlow and the history offset use its integer part; the comparisons of bar indexes
  // (srLNf below) use the fractional value.
  const chM = chartMinutes(bars);
  const tfM = srTF === 'Chart' ? chM : srTF === '15 Minutes' ? 15 : srTF === '1 Hour' ? 60 : srTF === '4 Hours' ? 240 : srTF === '1 Day' ? 1440 : 10080;
  const srLNf = cfg.srLN * tfM / chM;
  const srLN = Math.trunc(srLNf);
  if (!(srLN >= 1)) {
    throw new Error("Invalid value of the 'length' argument (" + (Number.isNaN(srLN) ? 'NaN' : srLN.toFixed(1)) + ") in the 'highest' function. It must be > 0.");
  }

  // 'None' hides a signal kind: na colours
  const srBUC = srBS !== 'None' ? cfg.srBUC : 'transparent';
  const srBDC = srBS !== 'None' ? cfg.srBDC : 'transparent';
  const srBTC = srBS !== 'None' ? WHITE : 'transparent';
  const srTUC = srTS !== 'None' ? cfg.srTUC : 'transparent';
  const srTDC = srTS !== 'None' ? cfg.srTDC : 'transparent';
  const srTTC = srTS !== 'None' ? WHITE : 'transparent';
  const srRUC = srRS !== 'None' ? cfg.srRUC : 'transparent';
  const srRDC = srRS !== 'None' ? cfg.srRDC : 'transparent';
  const srRTC = srRS !== 'None' ? WHITE : 'transparent';
  const lineWidth = le(srMR, 0.5) ? 2 : 3;

  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const highS = new Series(bars, (b) => b.high);
  const lowS = new Series(bars, (b) => b.low);
  const vol = bars.map((b) => (b.volume === undefined || b.volume === null || Number.isNaN(b.volume) ? NaN : b.volume));
  const nzVol = vol.map((v) => (Number.isNaN(v) ? 0 : v));
  const pHST = A(ta.highest(highS, srLN));
  const pLST = A(ta.lowest(lowS, srLN));
  const atr = A(ta.atr(bars, 17));
  const vSMA = A(ta.sma(Series.fromArray(bars, nzVol), 17));
  const ppH = A(ta.pivothigh(highS, srLN, srLN));
  const ppL = A(ta.pivotlow(lowS, srLN, srLN));
  const isLLS = bars.map((b, i) => ge(Math.abs(b.low - Math.min(b.open, b.close)), 1.618 * atr[i]));
  const isLUS = bars.map((b, i) => ge(Math.abs(b.high - Math.max(b.open, b.close)), 1.618 * atr[i]));
  const isHV = nzVol.map((v, i) => ge(v, 1.618 * vSMA[i]));
  const isLV = nzVol.map((v, i) => le(v, 0.618 * vSMA[i]));
  const vST = bars.map((_b, i) => (isHV[i] ? '\n *High Trading Activity' : isLV[i] ? '\n *Low Trading Activity' : '\n *Average Trading Activity'));

  // Live objects in creation order. A creation that brings the count above max + 5 deletes the oldest objects
  // until max remain; a deleted object is na: its getters give na, its setters do nothing.
  let boxes: Bx[] = [];
  let lines: Ln[] = [];
  let labels: Lb[] = [];
  const newBox = (left: number, top: number, right: number, bottom: number, bg: string): Bx => {
    const b: Bx = { left, top, right, bottom, bg, deleted: false };
    boxes.push(b);
    if (boxes.length > MAX_COUNT + 5) {
      for (const old of boxes.splice(0, boxes.length - MAX_COUNT)) old.deleted = true;
    }
    return b;
  };
  const newLine = (x1: number, y1: number, x2: number, y2: number, lineColor: string): Ln => {
    const l: Ln = { x1, y1, x2, y2, color: lineColor, width: lineWidth, deleted: false };
    lines.push(l);
    if (lines.length > MAX_COUNT + 5) {
      for (const old of lines.splice(0, lines.length - MAX_COUNT)) old.deleted = true;
    }
    return l;
  };
  const newLabel = (x: number, y: number, text: string, labelColor: string, style: 'label_up' | 'label_down', textColor: string, size: string, tooltip: string) => {
    labels.push({ x, y, text, color: labelColor, style, textColor, size: labelSize(size), tooltip });
    if (labels.length > MAX_COUNT + 5) labels = labels.slice(labels.length - MAX_COUNT);
  };
  const live = (o: Bx | Ln | null): boolean => o !== null && !o.deleted;
  const top = (s: SnR) => (live(s.bx) ? s.bx!.top : NaN);
  const bottom = (s: SnR) => (live(s.bx) ? s.bx!.bottom : NaN);
  const left = (s: SnR) => (live(s.bx) ? s.bx!.left : NaN);
  const right = (s: SnR) => (live(s.bx) ? s.bx!.right : NaN);
  const lqRight = (s: SnR) => (live(s.lq) ? s.lq!.right : NaN);
  const lqTop = (s: SnR) => (live(s.lq) ? s.lq!.top : NaN);
  const lqBottom = (s: SnR) => (live(s.lq) ? s.lq!.bottom : NaN);
  /** bx.set_right(x) and ln.set_x2(x) */
  const extendBox = (s: SnR, x: number) => { if (live(s.bx)) s.bx!.right = x; };
  const extendLine = (s: SnR, x: number) => { if (live(s.ln)) s.ln!.x2 = x; };
  const blank = (): SnR => ({ bx: null, lq: null, ln: null, b: false, t: false, r: false, l: false, m: NaN });
  /** SnR.new(box.new(...), box.new(na, na, na, na), line.new(...), false, false, false, false, m) */
  const newSnR = (bLeft: number, bTop: number, bRight: number, bBottom: number, bg: string, lineY: number, lineColor: string, m: number): SnR => {
    const bx = newBox(bLeft, bTop, bRight, bBottom, bg);
    const lq = newBox(NaN, NaN, NaN, NaN, 'transparent');
    const ln = newLine(bLeft, lineY, bRight, lineY, lineColor);
    return { bx, lq, ln, b: false, t: false, r: false, l: false, m };
  };

  const R: SnR[] = [blank()];
  const S: SnR[] = [blank()];
  let lR = blank();
  let lS = blank();
  let lRt = blank();
  let lSt = blank();
  // var pivotPoint pp: last / previous pivot bar and prices, cross status
  const pp = { x: NaN, x1: NaN, h: NaN, h1: NaN, l: NaN, l1: NaN, hx: false, lx: false };
  let mss = 0;

  /** f_getTradedVolume(_l, _o): volume sum of _l bars from _o bars back */
  const tradedVolume = (i: number, len: number, offset: number): number => {
    let v = 0;
    if (Number.isNaN(len)) return v;
    const end = len - 1;
    // Pine `for x = 0 to end` counts down when end < 0
    for (let x = 0; end >= 0 ? x <= end : x >= end; x += end >= 0 ? 1 : -1) {
      const k = i - offset - x;
      v += k >= 0 && k <= i ? vol[k] : NaN;
    }
    return v;
  };
  const swingVolumeText = (i: number, sts: number, traded: number): string =>
    (nzVol[i] !== 0
      ? '\n -Traded Volume : ' + str.tostring(traded, 'volume') + ' (' + str.tostring(sts - 1) + ' bars)'
        + '\n    *Average Volume/Bar : ' + str.tostring(traded / (sts - 1), 'volume')
      : '');

  for (let i = 0; i < n; i++) {
    const bar = bars[i];
    const c = bar.close;
    const h = bar.high;
    const l = bar.low;
    const prev = i > 0 ? bars[i - 1] : undefined;
    const c1 = prev ? prev.close : NaN;
    const o1 = prev ? prev.open : NaN;
    const h1 = prev ? prev.high : NaN;
    const l1 = prev ? prev.low : NaN;
    const i1 = prev ? i - 1 : NaN;
    const vST1 = prev ? vST[i - 1] : '';
    const m = (pHST[i] - pLST[i]) / pHST[i];

    // ------------------------------------------------------------------ pivot high: new resistance zone
    if (!Number.isNaN(ppH[i])) {
      pp.h1 = pp.h;
      pp.h = ppH[i];
      pp.x1 = pp.x;
      pp.x = i - srLN;
      pp.hx = false;
      const open = () => {
        R.unshift(newSnR(pp.x, pp.h, i, pp.h * (1 - m * 0.17 * srMR), srRZC, pp.h, srRLC, m));
        lS.t = false;
      };
      if (R.length > 1) {
        lR = R[0];
        lRt = R[1];
        if (lt(pp.h, bottom(lR) * (1 - lR.m * 0.17 * srMR)) || gt(pp.h, top(lR) * (1 + lR.m * 0.17 * srMR))) {
          if (lt(pp.x, left(lR)) && gt(pp.x + srLNf, left(lR)) && lt(c, bottom(lR))) {
            // no zone
          } else if (lt(pp.h, bottom(lRt) * (1 - lRt.m * 0.17 * srMR)) || gt(pp.h, top(lRt) * (1 + lRt.m * 0.17 * srMR))) {
            open();
          } else {
            extendBox(lRt, i);
            extendLine(lRt, i);
          }
        } else if (ne(top(lR), top(lS))) {
          extendBox(lR, i);
          extendLine(lR, i);
        }
      } else {
        open();
      }

      if (swSH !== 'None') {
        const sts = pp.x - pp.x1;
        const traded = tradedVolume(i, sts, srLN);
        // an na string adds nothing to the text
        const swH = gt(pp.h, pp.h1) ? 'Higher High' : lt(pp.h, pp.h1) ? 'Lower High' : '';
        const tooltip = 'Swing High (' + swH + ') : ' + str.tostring(pp.h, 'mintick', MINTICK)
          + (mss === -1 && lt(pp.h, pp.h1) ? '\n    *Counter-Trend Move' : '')
          + '\n -Price Change : ↑ %' + str.tostring((pp.h - pp.l) * 100 / pp.l, '#.##')
          + swingVolumeText(i, sts, traded);
        newLabel(pp.x, pp.h, '◈', 'transparent', 'label_down', swHC, swSH, tooltip);
      }
    }

    if (gt(c1, pp.h) && gt(c, pp.h) && !pp.hx) {
      pp.hx = true;
      mss = 1;
    }

    // ------------------------------------------------------------------ pivot low: new support zone
    if (!Number.isNaN(ppL[i])) {
      pp.l1 = pp.l;
      pp.l = ppL[i];
      pp.x1 = pp.x;
      pp.x = i - srLN;
      pp.lx = false;
      const open = () => {
        S.unshift(newSnR(pp.x, pp.l * (1 + m * 0.17 * srMR), i, pp.l, srSZC, pp.l, srSLC, m));
        lR.t = false;
      };
      if (S.length > 2) {
        lS = S[0];
        lSt = S[1];
        if (lt(pp.l, bottom(lS) * (1 - lS.m * 0.17 * srMR)) || gt(pp.l, top(lS) * (1 + lS.m * 0.17 * srMR))) {
          if (lt(pp.x, left(lS)) && gt(pp.x + srLNf, left(lS)) && gt(c, top(lS))) {
            // no zone
          } else if (lt(pp.l, bottom(lSt) * (1 - lSt.m * 0.17 * srMR)) || gt(pp.l, top(lSt) * (1 + lSt.m * 0.17 * srMR))) {
            open();
          } else {
            extendBox(lSt, i);
            extendLine(lSt, i);
          }
        } else if (ne(bottom(lS), bottom(lR))) {
          extendBox(lS, i);
          extendLine(lS, i);
        }
      } else {
        open();
      }

      if (swSH !== 'None') {
        const sts = pp.x - pp.x1;
        const traded = tradedVolume(i, sts, srLN);
        const swL = lt(pp.l, pp.l1) ? 'Lower Low' : gt(pp.l, pp.l1) ? 'Higher Low' : '';
        const tooltip = 'Swing Low (' + swL + ') : ' + str.tostring(pp.l, 'mintick', MINTICK)
          + (mss === 1 && gt(pp.l, pp.l1) ? '\n    *Counter-Trend Move' : '')
          + '\n -Price Change : ↓ %' + str.tostring((pp.h - pp.l) * 100 / pp.h, '#.##')
          + swingVolumeText(i, sts, traded);
        newLabel(pp.x, pp.l, '◈', 'transparent', 'label_up', swLC, swSH, tooltip);
      }
    }

    if (lt(c1, pp.l) && lt(c, pp.l) && !pp.lx) {
      pp.lx = true;
      mss = -1;
    }

    /**
     * Signals of a resistance zone `z`; `s` is the support zone used for the retest / test conditions.
     * `newest`: the newest zone (R[0]): its test also needs "no retest yet", and it carries the rejection label.
     */
    const resistance = (z: SnR, s: SnR, newest: boolean) => {
      const breakout = () => {
        extendBox(z, i1);
        extendLine(z, i1);
        z.b = true;
        z.r = false;
        newLabel(i1, l1 * (1 - z.m * 0.017), '▲\n\nB', srBUC, 'label_up', srBTC, srBS, 'Bullish Breakout' + vST1);
        // The broken resistance becomes a support zone
        S.unshift(newSnR(i1, top(z), i + 1, bottom(z), srSZC, bottom(z), srSLC, z.m));
      };
      if (srFBO && gt(c1, top(z) * (1 + z.m * 0.17)) && !z.b) {
        breakout();
      } else if (gt(c1, top(z)) && !z.b && !srFBO) {
        breakout();
      } else if (s.b && lt(o1, top(z)) && gt(h1, bottom(z)) && lt(c1, bottom(z)) && !z.r && ne(i1, left(z))) {
        newLabel(i1, h1 * (1 + z.m * 0.017), 'R', srRDC, 'label_down', srRTC, srRS, 'Re-test of Resistance Zone' + vST1);
        z.r = true;
        extendBox(z, i);
        extendLine(z, i);
      } else if (gt(h1, bottom(z)) && lt(c1, top(z)) && lt(c, top(z)) && !z.t && (!newest || !z.r) && !z.b && !s.b && ne(i1, left(z))) {
        newLabel(i1, h1 * (1 + z.m * 0.017), 'T', srTDC, 'label_down', srTTC, srTS, 'Test of Resistance Zone' + vST1);
        z.t = true;
        extendBox(z, i);
        extendLine(z, i);
      } else if (gt(h, bottom(z) * (1 - z.m * 0.17)) && !z.b) {
        if (gt(h, bottom(z))) extendBox(z, i);
        extendLine(z, i);
      }

      if (newest && prev && isLLS[i - 1] && isHV[i - 1] && srPS !== 'None') {
        newLabel(i1, l1 * (1 - z.m * 0.017), '', srPUC, 'label_up', WHITE, srPS, 'Rejection of Lower Prices' + vST1);
      }

      if (mnSH) {
        const limit = top(z) * (1 + z.m * 0.17 * mnMR);
        const inside = gt(h, top(z)) && le(c, limit) && eq(i, right(z));
        if (inside && !z.l) {
          if (gt(lqRight(z) + srLNf, i)) {
            if (live(z.lq)) {
              z.lq!.right = i + 1;
              z.lq!.top = pmin(pmax(h, lqTop(z)), limit);
            }
          } else if (live(z.lq)) {
            z.lq!.left = i1;
            z.lq!.top = pmin(h, limit);
            z.lq!.right = i + 1;
            z.lq!.bottom = top(z);
            z.lq!.bg = mnRZC;
          }
          z.l = true;
        } else if (inside && z.l) {
          if (live(z.lq)) {
            z.lq!.right = i + 1;
            z.lq!.top = pmin(pmax(h, lqTop(z)), limit);
          }
        } else if (z.l && (ge(c, limit) || lt(c, bottom(z)))) {
          z.l = false;
        }
      }
    };

    /**
     * Signals of a support zone `z`; `r` is the resistance zone used for the retest / test conditions.
     * `newest`: the newest zone (S[0]): after a breakout with "Avoid False Breakouts" the other conditions are
     * still checked (the original has `if` there, not `else if`), and it carries the rejection label.
     * `marginZone`: the zone whose margin ends the manipulation status (S[0] for both zones, as the original).
     */
    const support = (z: SnR, r: SnR, newest: boolean, marginZone: SnR) => {
      const breakout = () => {
        extendBox(z, i1);
        extendLine(z, i1);
        z.b = true;
        z.r = false;
        newLabel(i1, h1 * (1 + z.m * 0.017), 'B\n\n▼', srBDC, 'label_down', srBTC, srBS, 'Bearish Breakout' + vST1);
        // The broken support becomes a resistance zone
        R.unshift(newSnR(i1, top(z), i + 1, bottom(z), srRZC, top(z), srRLC, z.m));
      };
      let done = false;
      if (srFBO && lt(c1, bottom(z) * (1 - z.m * 0.17)) && !z.b) {
        breakout();
        done = !newest;
      }
      if (done) {
        // else-if chain of the older zone: nothing more
      } else if (lt(c1, bottom(z)) && !z.b && !srFBO) {
        breakout();
      } else if (r.b && gt(o1, bottom(z)) && lt(l1, top(z)) && gt(c1, top(z)) && !z.r && ne(i1, left(z))) {
        newLabel(i1, l1 * (1 - z.m * 0.017), 'R', srRUC, 'label_up', srRTC, srRS, 'Re-test of Support Zone' + vST1);
        z.r = true;
        extendBox(z, i);
        extendLine(z, i);
      } else if (lt(l1, top(z)) && gt(c1, bottom(z)) && gt(c, bottom(z)) && !z.t && !z.b && !r.b && ne(i1, left(z))) {
        newLabel(i1, l1 * (1 - z.m * 0.017), 'T', srTUC, 'label_up', srTTC, srTS, 'Test of Support Zone' + vST1);
        z.t = true;
        extendBox(z, i);
        extendLine(z, i);
      } else if (lt(l, top(z) * (1 + z.m * 0.17)) && !z.b) {
        if (lt(l, top(z))) extendBox(z, i);
        extendLine(z, i);
      }

      if (newest && prev && isLUS[i - 1] && isHV[i - 1] && srPS !== 'None') {
        newLabel(i1, h1 * (1 + z.m * 0.017), '', srPDC, 'label_down', WHITE, srPS, 'Rejection of Higher Prices' + vST1);
      }

      if (mnSH) {
        const limit = bottom(z) * (1 - z.m * 0.17 * mnMR);
        const inside = lt(l, bottom(z)) && ge(c, limit) && eq(i, right(z));
        if (inside && !z.l) {
          if (gt(lqRight(z) + srLNf, i)) {
            if (live(z.lq)) {
              z.lq!.right = i + 1;
              z.lq!.bottom = pmax(pmin(l, lqBottom(z)), limit);
            }
          } else if (live(z.lq)) {
            z.lq!.left = i1;
            z.lq!.top = bottom(z);
            z.lq!.right = i + 1;
            z.lq!.bottom = pmax(l, limit);
            z.lq!.bg = mnSZC;
          }
          z.l = true;
        } else if (inside && z.l) {
          if (live(z.lq)) {
            z.lq!.right = i + 1;
            z.lq!.bottom = pmax(pmin(l, lqBottom(z)), limit);
          }
        } else if (z.l && (le(c, bottom(z) * (1 - marginZone.m * 0.17 * mnMR)) || gt(c, top(z)))) {
          z.l = false;
        }
      }
    };

    // ------------------------------------------------------------------ the two newest zones of each side
    if (R.length > 0) {
      lR = R[0];
      resistance(lR, lS, true);
    }
    if (R.length > 1 && srHST) {
      lRt = R[1];
      if (ne(top(lR), top(lRt))) resistance(lRt, lSt, false);
    }
    if (S.length > 1) {
      lS = S[0];
      support(lS, lR, true, lS);
    }
    if (S.length > 2 && srHST) {
      lSt = S[1];
      if (ne(bottom(lS), bottom(lSt))) support(lSt, lRt, false, lS);
    }
  }

  const interval = barInterval(bars);
  const timeOf = (index: number) => barTime(bars, index, interval);
  // An object with an na coordinate is not drawn (the manipulation box of a zone without manipulation)
  const ok = (...v: number[]) => v.every(Number.isFinite);
  const result = empty;
  for (const b of boxes) {
    const time1 = timeOf(b.left);
    const time2 = timeOf(b.right);
    if (ok(time1, time2, b.top, b.bottom)) {
      result.boxes.push({ time1, price1: b.top, time2, price2: b.bottom, bgColor: b.bg, borderColor: 'transparent' });
    }
  }
  for (const ln of lines) {
    const time1 = timeOf(ln.x1);
    const time2 = timeOf(ln.x2);
    if (ok(time1, time2, ln.y1, ln.y2)) {
      result.lines.push({ time1, price1: ln.y1, time2, price2: ln.y2, color: ln.color, width: ln.width });
    }
  }
  for (const lb of labels) {
    const time = timeOf(lb.x);
    if (ok(time, lb.y)) {
      result.labels.push({ time, price: lb.y, text: lb.text, color: lb.color, style: lb.style, textColor: lb.textColor, size: lb.size, tooltip: lb.tooltip });
    }
  }
  return result;
}

export const SupportResistanceSignalsMtf = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
