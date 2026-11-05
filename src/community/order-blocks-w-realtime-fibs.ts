/**
 * Order Blocks W/ Realtime Fibs [QuantVue]
 *
 * An order block is the last down bar before a run of up bars (bullish) or the last up bar before a run of down bars
 * (bearish): the bar `Consecutive Bars Required` bars back must be a down (up) bar, at least that many of the bars
 * since must close the other way, and the move from its low (high) to the close must be at least "Percent Gain
 * Required" percent. The block is a box over that bar's range, extended to the current bar until the price comes
 * back into it (low under the top of a bullish block, high over the bottom of a bearish one; or the close with
 * "Close" mitigation) or until it is too long ("Length") or too far from the price ("Distance").
 *
 * Each new block removes every fib line and label of the chart and draws a new fib set from the block bar: the 0
 * level at the current high (bullish) or low (bearish), the 1 level at the block low (high), and the .236 / .382 /
 * .50 / .618 / .786 levels between them, each with a label "<level> ($<price>)". While the set is active its lines
 * follow the current bar, and a new high (low) moves the 0 level and draws the set again, until the price touches the
 * retracement level (a "🔺" / "🔻" mark; with "Stop Fib Recalculation After Retracement" the set then stops). The
 * set ends when the close goes past the block, a new block of the same side appears, or (with the retracement stop)
 * a new extreme after the retracement.
 *
 * Label prices use the symbol tick (chart context, `mintickOf`).
 *
 * Alerts (alert() calls, `alertCalls` of the result): "New Bullish Order Block" / "New Bearish Order Block" (once per
 * bar close) on the bar of a new block when "Show Order Blocks" is on, and "Retracement Level Hit" (once per bar) on
 * the bar of each "🔺" / "🔻" mark, in the order of the sets (newest first).
 *
 * Reference: "Order Blocks W/ Realtime Fibs [QuantVue]" by QuantVue
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © QuantVue
 */

import {
  str, line, label, box, resetDrawings, setDrawingBar, drawingOutputs,
  type Box, type Line, type Label, type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import type { AlertCall, BoxData, LabelData, LineDrawingData } from '../types';
import { mintickOf, type ChartContext } from '../chart-context';

/** The original makes alert() calls */
export const hasAlertFunction = true;

export interface OrderBlocksWRealtimeFibsInputs {
  /** Consecutive Bars Required */
  barsReq: number;
  /** Percent Gain Required */
  percGain: number;
  /** Require Opposite Order Block */
  opposites: boolean;
  /** Mitigation Type */
  mitType: 'Wicks' | 'Close';
  /** Irrelevant Order Block */
  irrOb: 'Length' | 'Distance';
  /** Max Ob Length or Distance */
  maxObLen: number;
  showOb: boolean;
  /** Remove Old or Irrelevant Order Blocks */
  hideOld: boolean;
  bullCol: string;
  bearCol: string;
  showFibs: boolean;
  /** Stop Fib Recalculation After Retracement */
  retraceMax: boolean;
  /** Retracement level */
  retracelev: 'Order Block' | '.50' | '.618' | '.786';
  fibStyle: 'Dashed' | 'Dotted' | 'Solid';
  /** Extend the fib lines to the right */
  extLines: boolean;
  /** Fib Label Color */
  textColor: string;
  show236: boolean;
  color236: string;
  show382: boolean;
  color382: string;
  show50: boolean;
  color50: string;
  show618: boolean;
  color618: string;
  show786: boolean;
  color786: string;
  /** 0 & 1 levels */
  showHl: boolean;
  colorHl: string;
}

export const defaultInputs: OrderBlocksWRealtimeFibsInputs = {
  barsReq: 6,
  percGain: 0.0,
  opposites: false,
  mitType: 'Wicks',
  irrOb: 'Length',
  maxObLen: 150,
  showOb: true,
  hideOld: false,
  bullCol: 'rgba(76, 175, 80, 0.15)',
  bearCol: 'rgba(255, 82, 82, 0.15)',
  showFibs: true,
  retraceMax: true,
  retracelev: 'Order Block',
  fibStyle: 'Dashed',
  extLines: false,
  textColor: 'rgb(255, 253, 253)',
  show236: true,
  color236: '#c2c5ce',
  show382: true,
  color382: '#c2c5ce',
  show50: true,
  color50: '#c2c5ce',
  show618: true,
  color618: '#00ccff',
  show786: true,
  color786: '#c2c5ce',
  showHl: true,
  colorHl: '#c2c5ce',
};

const G0 = 'Order Block Settings';
const G1 = 'Order Block Display Settings';
const G2 = 'Fibs';

export const inputConfig: InputConfig[] = [
  { id: 'barsReq', type: 'int', title: 'Consecutive Bars Required', defval: 6, group: G0,
    tooltip: 'The number of bars required after the last bullish or bearish bar to validate an order block' },
  { id: 'percGain', type: 'float', title: 'Percent Gain Required', defval: 0.0, step: 0.1, group: G0,
    tooltip: 'The minimum percent gain or loss of the consecutive bars required to validate an order block' },
  { id: 'opposites', type: 'bool', title: 'Require Opposite Order Block', defval: false, group: G0,
    tooltip: 'Requires an order block in the opposite direction of the previous order block before a new order block is marked' },
  { id: 'mitType', type: 'string', title: 'Mitigation Type', defval: 'Wicks', options: ['Wicks', 'Close'] },
  { id: 'irrOb', type: 'string', title: 'Irrelevant Order Block ', defval: 'Length', options: ['Length', 'Distance'], group: G0,
    tooltip: 'Method for considering Order Blocks irrelevant. Either too long (length) or too far away from current price (distance)' },
  { id: 'maxObLen', type: 'int', title: 'Max Ob Length or Distance', defval: 150, group: G0,
    tooltip: 'Maximum bar length or % distance away from Order Block to be considered irrelevant' },
  { id: 'showOb', type: 'bool', title: 'Show Order Blocks', defval: true, group: G1 },
  { id: 'hideOld', type: 'bool', title: 'Remove Old or Irrelevant Order Blocks', defval: false, group: G1 },
  { id: 'bullCol', type: 'color', title: 'Bullish Color', defval: 'rgba(76, 175, 80, 0.15)', group: G1 },
  { id: 'bearCol', type: 'color', title: 'Bearish Color', defval: 'rgba(255, 82, 82, 0.15)', group: G1 },
  { id: 'showFibs', type: 'bool', title: 'Show Fibs', defval: true, group: G2 },
  { id: 'retraceMax', type: 'bool', title: 'Stop Fib Recalculation After Retracement', defval: true, group: G2,
    tooltip: 'Will stop fibs from recalculating when a new high or low is made, if the retracement level has been hit' },
  { id: 'retracelev', type: 'string', title: 'Rectracement Level', defval: 'Order Block', options: ['Order Block', '.50', '.618', '.786'], group: G2 },
  { id: 'fibStyle', type: 'string', title: 'Line style ', defval: 'Dashed', options: ['Dashed', 'Dotted', 'Solid'], group: G2, inline: '2' },
  { id: 'extLines', type: 'bool', title: 'Extend', defval: false, group: G2, inline: '2' },
  { id: 'textColor', type: 'color', title: 'Fib Label Color', defval: 'rgb(255, 253, 253)', group: G2 },
  { id: 'show236', type: 'bool', title: '.236', defval: true, inline: '3', group: G2 },
  { id: 'color236', type: 'color', title: '', defval: '#c2c5ce', inline: '3', group: G2 },
  { id: 'show382', type: 'bool', title: '.382', defval: true, inline: '3', group: G2 },
  { id: 'color382', type: 'color', title: '', defval: '#c2c5ce', inline: '3', group: G2 },
  { id: 'show50', type: 'bool', title: '.50', defval: true, inline: '3', group: G2 },
  { id: 'color50', type: 'color', title: '', defval: '#c2c5ce', inline: '3', group: G2 },
  { id: 'show618', type: 'bool', title: '.618', defval: true, inline: '4', group: G2 },
  { id: 'color618', type: 'color', title: '', defval: '#00ccff', inline: '4', group: G2 },
  { id: 'show786', type: 'bool', title: '.786', defval: true, inline: '4', group: G2 },
  { id: 'color786', type: 'color', title: '', defval: '#c2c5ce', inline: '4', group: G2 },
  { id: 'showHl', type: 'bool', title: '0 & 1', defval: true, inline: '4', group: G2 },
  { id: 'colorHl', type: 'color', title: '', defval: '#c2c5ce', inline: '4', group: G2 },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Order Blocks W/ Realtime Fibs [QuantVue]',
  shortTitle: 'Order Blocks W/ Realtime Fibs [QuantVue]',
  overlay: true,
};

/** indicator(max_lines_count = 500, max_labels_count = 500); boxes: the default 50 */
const MAX_LINES = 500;
const MAX_LABELS = 500;
const MAX_BOXES = 50;
/** Default colours of a version 5 script, given explicitly: label background (blue), label and box text */
const V5_BLUE = '#2962FF';
const V5_TEXT = '#363A45';
const NO_COLOR = 'rgba(255, 255, 255, 0)'; // color.new(color.white, 100)

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && a - b >= -EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && b - a >= -EPS;

/** type obFibs */
interface ObFibs {
  a: boolean;
  bull: boolean;
  idx: number;
  l: number;
  h: number;
  chl: number;
  ret: boolean;
  levArr: number[];
  lineArr: Line[];
  labArr: Label[];
}

/** type obBox (its top / bottom fields are not read by the script) */
interface ObBox {
  a: boolean;
  bull: boolean;
  bx: Box;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<OrderBlocksWRealtimeFibsInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { lines: LineDrawingData[]; labels: LabelData[]; boxes: BoxData[]; alertCalls: AlertCall[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const barsReq = cfg.barsReq;
  const mintick = mintickOf(chart);
  // if irrOb == 'Distance': maxObLen := maxObLen / 100 (the int variable keeps the fraction)
  const maxObLen = cfg.irrOb === 'Distance' ? cfg.maxObLen / 100 : cfg.maxObLen;
  const style = cfg.fibStyle === 'Solid' ? 'solid' : cfg.fibStyle === 'Dotted' ? 'dotted' : 'dashed';
  const extend = cfg.extLines ? 'right' : 'none';
  const fibBool = [cfg.showHl, cfg.showHl, cfg.show236, cfg.show382, cfg.show50, cfg.show618, cfg.show786];
  const fibCol = [cfg.colorHl, cfg.colorHl, cfg.color236, cfg.color382, cfg.color50, cfg.color618, cfg.color786];
  const fibLev = ['0', '1', '.236', '.382', '.50', '.618', '.786'];

  resetDrawings({ line: MAX_LINES, label: MAX_LABELS, box: MAX_BOXES });

  const obFibsArr: ObFibs[] = [];
  const obBoxArr: ObBox[] = [];
  let bu = false;
  let be = false;
  let prevBu = false;
  let prevBe = false;
  const alertCalls: AlertCall[] = [];

  /** Draws the fib lines and labels of a set (newest first in its arrays) */
  const drawFibs = (f: ObFibs, i: number) => {
    if (!cfg.showFibs) return;
    for (let k = 0; k < f.levArr.length; k++) {
      if (!fibBool[k]) continue;
      const lev = f.levArr[k];
      f.lineArr.unshift(line.new(f.idx, lev, i, lev, 'bar_index', extend, fibCol[k], style));
      f.labArr.unshift(label.new(f.idx, lev, `${fibLev[k]} ($${str.tostring(lev, 'mintick', mintick)})`, 'bar_index',
        'price', NO_COLOR, 'label_right', cfg.textColor));
    }
  };
  const deleteFibs = (f: ObFibs) => {
    for (const l of f.lineArr) line.delete(l);
    for (const l of f.labArr) label.delete(l);
  };
  // bullish: chl - total * r with total = chl - l; bearish: chl + total * r with total = h - chl
  const bullLevels = (chl: number, l: number) => {
    const total = chl - l;
    return [chl, l, chl - total * 0.236, chl - total * 0.382, chl - total * 0.5, chl - total * 0.618, chl - total * 0.786];
  };
  const bearLevels = (chl: number, h: number) => {
    const total = h - chl;
    return [chl, h, chl + total * 0.236, chl + total * 0.382, chl + total * 0.5, chl + total * 0.618, chl + total * 0.786];
  };

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];

    const back = i >= barsReq ? bars[i - barsReq] : null;
    const backLow = back ? back.low : NaN;
    const backHigh = back ? back.high : NaN;
    const gainBull = (Math.abs(backLow - b.close) / backLow) * 100;
    const gainBear = (Math.abs(backHigh - b.close) / backHigh) * 100;
    const gainCheck = ge(gainBull, cfg.percGain) || ge(gainBear, cfg.percGain);
    const lastDown = back !== null && lt(back.close, back.open);
    const lastUp = back !== null && gt(back.close, back.open);
    let barsCount = 0;
    if (lastDown) {
      for (let k = 0; k <= barsReq; k++) if (gt(bars[i - k].close, bars[i - k].open)) barsCount += 1;
    }
    if (lastUp) {
      for (let k = 0; k <= barsReq; k++) if (lt(bars[i - k].close, bars[i - k].open)) barsCount += 1;
    }

    const bullish = lastDown && barsCount >= barsReq && gainCheck && (cfg.opposites ? !bu : true);
    const bearish = lastUp && barsCount >= barsReq && gainCheck && (cfg.opposites ? !be : true);
    // line.all() / label.all() at the start of the bar (nothing is drawn before here), only read by a new block
    const lines = bullish || bearish ? line.all() : [];
    const labels = bullish || bearish ? label.all() : [];

    if (bullish) {
      for (const l of lines) line.delete(l);
      for (const l of labels) label.delete(l);
      bu = true;
      be = false;
      const f: ObFibs = {
        a: true, bull: true, idx: i - barsReq, l: back!.low, h: back!.high, chl: b.high, ret: false,
        levArr: bullLevels(b.high, back!.low), lineArr: [], labArr: [],
      };
      drawFibs(f, i);
      obFibsArr.unshift(f);
      if (cfg.showOb) {
        obBoxArr.unshift({ a: true, bull: true, bx: box.new(i - barsReq, back!.high, i, back!.low, cfg.bullCol,
          undefined, undefined, undefined, undefined, cfg.bullCol, undefined, undefined, V5_TEXT) });
        alertCalls.push({ time: b.time, message: 'New Bullish Order Block', freq: 'once_per_bar_close' });
      }
    }
    if (bearish) {
      for (const l of lines) line.delete(l);
      for (const l of labels) label.delete(l);
      be = true;
      bu = false;
      const f: ObFibs = {
        a: true, bull: false, idx: i - barsReq, l: back!.low, h: back!.high, chl: b.low, ret: false,
        levArr: bearLevels(b.low, back!.high), lineArr: [], labArr: [],
      };
      drawFibs(f, i);
      obFibsArr.unshift(f);
      if (cfg.showOb) {
        obBoxArr.unshift({ a: true, bull: false, bx: box.new(i - barsReq, back!.high, i, back!.low, cfg.bearCol,
          undefined, undefined, undefined, undefined, cfg.bearCol, undefined, undefined, V5_TEXT) });
        alertCalls.push({ time: b.time, message: 'New Bearish Order Block', freq: 'once_per_bar_close' });
      }
    }

    // fib management
    for (const f of obFibsArr) {
      if (!f.a) continue;
      for (const l of f.lineArr) line.set_x2(l, i);
      const retlev = cfg.retracelev === 'Order Block' ? f.h : cfg.retracelev === '.50' ? f.levArr[4]
        : cfg.retracelev === '.618' ? f.levArr[5] : f.levArr[6];
      if (f.bull) {
        if (le(b.low, retlev) && cfg.retraceMax && !f.ret) {
          f.ret = true;
          label.new(i, b.low, '🔺', 'bar_index', 'belowbar', V5_BLUE, 'none', V5_TEXT);
          alertCalls.push({ time: b.time, message: 'Retracement Level Hit', freq: 'once_per_bar' });
        }
        if (gt(b.high, f.chl) && !f.ret) {
          f.chl = b.high;
          f.levArr = bullLevels(f.chl, f.l);
          deleteFibs(f);
          drawFibs(f, i);
        }
        const newSame = bullish && i > f.idx + barsReq && !cfg.opposites;
        if ((be && !prevBe && cfg.opposites) || lt(b.close, f.l) || newSame || (cfg.retraceMax && gt(b.high, f.chl))) {
          f.a = false;
          if (newSame) deleteFibs(f);
        }
      }
      if (!f.bull) {
        if (ge(b.high, retlev) && cfg.retraceMax && !f.ret) {
          f.ret = true;
          label.new(i, b.low, '🔻', 'bar_index', 'abovebar', V5_BLUE, 'none', V5_TEXT);
          alertCalls.push({ time: b.time, message: 'Retracement Level Hit', freq: 'once_per_bar' });
        }
        if (lt(b.low, f.chl) && !f.ret) {
          f.chl = b.low;
          f.levArr = bearLevels(f.chl, f.h);
          deleteFibs(f);
          drawFibs(f, i);
        }
        const newSame = bearish && i > f.idx + barsReq && !cfg.opposites;
        if ((bu && !prevBu && cfg.opposites) || gt(b.close, f.h) || newSame || (cfg.retraceMax && lt(b.low, f.chl))) {
          f.a = false;
          if (newSame) deleteFibs(f);
        }
      }
    }

    // order block management (runs for the inactive blocks too: an inactive block is already off and its box already
    // deleted with 'Hide Old', so it changes nothing and is skipped)
    for (const o of obBoxArr) {
      if (!o.a) continue;
      if (o.a) box.set_right(o.bx, i);
      const left = box.get_left(o.bx);
      if (o.bull) {
        const src = cfg.mitType === 'Wicks' ? b.low : b.close;
        const top = box.get_top(o.bx);
        if (le(src, top) || (cfg.irrOb === 'Length' && i - left > maxObLen - 1)
          || (cfg.irrOb === 'Distance' && ge(b.low, top * (1 + maxObLen)))) {
          o.a = false;
          if (cfg.hideOld) box.delete(o.bx);
        }
      } else {
        const src = cfg.mitType === 'Wicks' ? b.high : b.close;
        const bottom = box.get_bottom(o.bx);
        if (ge(src, bottom) || (cfg.irrOb === 'Length' && i - left > maxObLen - 1)
          || (cfg.irrOb === 'Distance' && le(b.high, bottom * (1 - maxObLen)))) {
          o.a = false;
          if (cfg.hideOld) box.delete(o.bx);
        }
      }
    }
    prevBu = bu;
    prevBe = be;
  }
  setDrawingBar(null);

  const drawn = drawingOutputs(bars);
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    lines: drawn.lines ?? [],
    labels: drawn.labels ?? [],
    boxes: drawn.boxes ?? [],
    alertCalls,
  };
}

export const OrderBlocksWRealtimeFibs = { calculate, metadata, defaultInputs, inputConfig, plotConfig, hasAlertFunction };
