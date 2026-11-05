/**
 * Three Bar Reversal Pattern [LuxAlgo]
 *
 * Bullish pattern: a falling bar, then a falling bar with a lower low and a lower high, then a rising bar whose high
 * is above the high of the first bar. The bearish pattern is the mirrored case. "Enhanced" keeps the patterns whose
 * third bar closes beyond the first bar, "Normal" the others. A trend filter (moving average cloud, Supertrend or
 * Donchian channels, drawn when selected) keeps the patterns that are aligned with the trend or opposite to it.
 *
 * Each pattern gets a triangle label and two lines (the high of the first bar and the lowest low of the last two
 * bars for a bullish pattern) with a fill between them; a second pair of lines follows the bars while the pattern
 * is open. The pattern is confirmed when a close is beyond the first line (a dot label marks the bar, and a support
 * or resistance box starts, extended until a close crosses it) and it fails when a close is beyond the other line
 * or when the opposite pattern appears. The label tooltip tells the state. At most 500 lines, labels and boxes are
 * kept.
 *
 * The background colour of the chart is only used fully transparent, so the port needs no chart theme.
 *
 * Reference: "Three Bar Reversal Pattern [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import { taStep, color, str, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BoxData, LabelData, LineDrawingData, LinefillData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ThreeBarReversalPatternInputs {
  brpType: 'Normal' | 'Enhanced' | 'All';
  /** Support and resistance derived from the confirmed patterns */
  brpSR: 'Level' | 'Zone' | 'None';
  brpAC: string;
  brpSC: string;
  trendType: 'Moving Average Cloud' | 'Supertrend' | 'Donchian Channels' | 'None';
  trendFilt: 'Aligned' | 'Opposite';
  trendAC: string;
  trendSC: string;
  maType: 'SMA' | 'EMA' | 'HMA' | 'RMA' | 'WMA' | 'VWMA';
  maFLength: number;
  maSLength: number;
  atrPeriod: number;
  factor: number;
  /** Donchian channel length */
  length: number;
}

export const defaultInputs: ThreeBarReversalPatternInputs = {
  brpType: 'All',
  brpSR: 'Level',
  brpAC: '#2962ff',
  brpSC: '#ff9800',
  trendType: 'None',
  trendFilt: 'Aligned',
  trendAC: '#089981',
  trendSC: '#f23645',
  maType: 'HMA',
  maFLength: 50,
  maSLength: 200,
  atrPeriod: 10,
  factor: 3,
  length: 13,
};

export const inputConfig: InputConfig[] = [
  { id: 'brpType', type: 'string', title: 'Pattern Type', defval: 'All', options: ['Normal', 'Enhanced', 'All'] },
  { id: 'brpSR', type: 'string', title: 'Derived Support and Resistance', defval: 'Level', options: ['Level', 'Zone', 'None'] },
  { id: 'brpAC', type: 'color', title: 'Bullish Reversal Patterns', defval: '#2962ff' },
  { id: 'brpSC', type: 'color', title: 'Bearish Reversal Patterns', defval: '#ff9800' },
  { id: 'trendType', type: 'string', title: 'Filtering', defval: 'None', options: ['Moving Average Cloud', 'Supertrend', 'Donchian Channels', 'None'], group: 'Trend Filtering', inline: 'flt' },
  { id: 'trendFilt', type: 'string', title: '', defval: 'Aligned', options: ['Aligned', 'Opposite'], group: 'Trend Filtering', inline: 'flt' },
  { id: 'trendAC', type: 'color', title: 'Bullish Trend', defval: '#089981', inline: 'trnd' },
  { id: 'trendSC', type: 'color', title: ' Bearish Trend', defval: '#f23645', inline: 'trnd' },
  { id: 'maType', type: 'string', title: 'Type', defval: 'HMA', options: ['SMA', 'EMA', 'HMA', 'RMA', 'WMA', 'VWMA'], group: 'Moving Average Settings' },
  { id: 'maFLength', type: 'int', title: 'Fast Length', defval: 50, min: 1, max: 100, group: 'Moving Average Settings' },
  { id: 'maSLength', type: 'int', title: 'Slow Length', defval: 200, min: 100, group: 'Moving Average Settings' },
  { id: 'atrPeriod', type: 'int', title: 'ATR Length', defval: 10, min: 1, group: 'Supertrend Settings' },
  { id: 'factor', type: 'float', title: 'Factor', defval: 3, min: 2, step: 0.1, group: 'Supertrend Settings' },
  { id: 'length', type: 'int', title: 'Length', defval: 13, min: 1, group: 'Donchian Channel Settings' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ma fast', color: String(color.new('#f23645', 81)), lineWidth: 1, style: 'linebr' },
  { id: 'plot1', title: 'ma slow', color: String(color.new('#f23645', 73)), lineWidth: 1, style: 'linebr' },
  { id: 'plot2', title: 'Up Trend', color: String(color.new('#089981', 73)), lineWidth: 1, style: 'linebr' },
  { id: 'plot3', title: 'Down Trend', color: String(color.new('#f23645', 73)), lineWidth: 1, style: 'linebr' },
  { id: 'plot4', title: 'Body Middle', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Donchian Upper', color: String(color.new('#f23645', 73)), lineWidth: 1 },
  { id: 'plot6', title: 'Donchian Lower', color: String(color.new('#f23645', 99)), lineWidth: 1 },
];

export const metadata = {
  title: 'Three Bar Reversal Pattern [LuxAlgo]',
  shortTitle: 'LuxAlgo - Three Bar Reversal Pattern',
  overlay: true,
};

/** indicator(max_labels_count = 500, max_lines_count = 500, max_boxes_count = 500) */
const MAX_OBJECTS = 500;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** Drawings: the objects that a later bar changes are the ones held by a `var` variable (copied by copyVars) */
interface Ln { x1: number; x2: number; y: number; color: string }
interface Lb { x: number; y: number; text: string; textColor: string; up: boolean; tooltip: string }
interface Bx { left: number; right: number; top: number; bottom: number; border: string; bg: string }
interface Lf { line1: Ln; line2: Ln; color: string }

/** The `var` state of one side (the bullish patterns or the bearish patterns) */
interface Side {
  lnA: Ln | null; // the line of the first bar (lnAT / lnSB)
  lnB: Ln | null; // the line of the extreme of the last two bars (lnAB / lnST)
  lnA2: Ln | null;
  lnB2: Ln | null;
  lb: Lb | null;
  bx: Bx | null;
  process: boolean;
  process2: boolean;
  level: number; // bullHigh / bearLow
  process1: boolean | null; // process[1] (na before the first bar)
  process2Back: boolean | null; // process[2]
}

interface TbrVars {
  bull: Side;
  bear: Side;
  os: number;
  /** Live drawings in creation order (a line deleted by the object limit is not in `lines`) */
  lines: Ln[];
  labels: Lb[];
  boxes: Bx[];
}

type Point = { time: number; value: number; color: string };
type Grad = { topValue: number[]; bottomValue: number[]; topColor: Array<string | null>; bottomColor: Array<string | null> };
type Result = Omit<IndicatorResult, 'boxes' | 'labels' | 'lines' | 'linefills'> & {
  boxes: BoxData[]; labels: LabelData[]; lines: LineDrawingData[]; linefills: LinefillData[];
};

interface TbrRun extends BarRunState<TbrVars> {
  maFast: { step(v: number, volume: number): number; commit(): void } | null;
  maSlow: { step(v: number, volume: number): number; commit(): void } | null;
  st: ReturnType<typeof taStep.supertrend>;
  upper: ReturnType<typeof taStep.highest>;
  lower: ReturnType<typeof taStep.lowest>;
  upperArr: number[];
  lowerArr: number[];
  plots: Array<Array<{ time: number; value: number; color?: string }>>;
  grads: Grad[];
  linefills: Lf[];
}

const newSide = (): Side => ({
  lnA: null, lnB: null, lnA2: null, lnB2: null, lb: null, bx: null, process: false, process2: false, level: NaN,
  process1: null, process2Back: null,
});

function study(inputs: Partial<ThreeBarReversalPatternInputs>): BarStudy<TbrRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { brpAC, brpSC, trendAC, trendSC, trendType, trendFilt, brpType, brpSR } = cfg;
  const upTrendCss = String(color.new(trendAC, 73));
  const downTrendCss = String(color.new(trendSC, 73));
  const upFill = String(color.new(trendAC, 81));
  const downFill = String(color.new(trendSC, 81));

  // Trend indicators - moving average cloud
  const movingAverage = (length: number): TbrRun['maFast'] => {
    switch (cfg.maType) {
      case 'SMA': { const m = taStep.sma(); return { step: (v) => m.step(v, length), commit: () => m.commit() }; }
      case 'EMA': { const m = taStep.ema(length); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'HMA': {
        if (length === 1) throw new Error("Invalid value of the 'length' argument (0.0) in the 'wma' function");
        const m = taStep.hma(length);
        return { step: (v) => m.step(v), commit: () => m.commit() };
      }
      case 'RMA': { const m = taStep.rma(length); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, length), commit: () => m.commit() }; }
      case 'VWMA': { const m = taStep.vwma(length); return { step: (v, vol) => m.step(v, vol), commit: () => m.commit() }; }
      default: return null;
    }
  };

  // Live drawings in creation order: when a creation brings the count above max + 5, the oldest are deleted until
  // max remain. An object held by a `var` variable of the script (the lines, the label and the box of the latest
  // pattern of each side) is never deleted by this limit, but it counts. A deleted object ignores later changes
  // (only the held objects change, and they are never deleted).
  const isHeld = (v: TbrVars, o: object) => {
    const a = v.bull;
    const b = v.bear;
    return o === a.lnA || o === a.lnB || o === a.lnA2 || o === a.lnB2 || o === a.lb || o === a.bx
      || o === b.lnA || o === b.lnB || o === b.lnA2 || o === b.lnB2 || o === b.lb || o === b.bx;
  };
  const limit = <T extends object>(v: TbrVars, list: T[]) => {
    if (list.length <= MAX_OBJECTS + 5) return;
    for (let k = 0; k < list.length && list.length > MAX_OBJECTS; ) {
      if (isHeld(v, list[k])) k++;
      else list.splice(k, 1);
    }
  };

  const colours = (css: string) => ({
    css, lineCss: String(color.new(css, 53)), fillCss: String(color.new(css, 73)), textCss: String(color.new(css, 7)),
    border: String(color.new(css, brpSR === 'Zone' ? 73 : 53)),
  });
  const bullCss = colours(brpAC);
  const bearCss = colours(brpSC);
  // a new object and the object limit (then `variable := object`: the variable holds the new object and releases the
  // one before)
  const newLine = (v: TbrVars, x1: number, x2: number, y: number, lineCss: string): Ln => {
    const o = { x1, x2, y, color: lineCss };
    v.lines.push(o);
    limit(v, v.lines);
    return o;
  };
  const newLabel = (v: TbrVars, l: Lb): Lb => {
    v.labels.push(l);
    limit(v, v.labels);
    return l;
  };
  const newBox = (v: TbrVars, b: Bx): Bx => {
    v.boxes.push(b);
    limit(v, v.boxes);
    return b;
  };
  // beyond(x, y): x is on the confirmation side of y (above for a bullish pattern)
  const beyond = (bull: boolean, x: number, y: number) => (bull ? gt(x, y) : lt(x, y));
  const against = (bull: boolean, x: number, y: number) => (bull ? lt(x, y) : gt(x, y));

  /** One bar of one side: the bullish patterns (bull = true) or the bearish patterns */
  const side = (s: TbrRun, sd: Side, bull: boolean, i: number, bars: Bar[], pattern: boolean, opposite: boolean) => {
    const v = s.vars;
    const { lineCss, fillCss, textCss, border } = bull ? bullCss : bearCss;
    const b = bars[i];
    const b1 = i >= 1 ? bars[i - 1] : null;
    const b2 = i >= 2 ? bars[i - 2] : null;
    const close1 = b1 ? b1.close : NaN;

    if (pattern && b1 && b2) {
      const first = bull ? b2.high : b2.low;
      const enhanced = beyond(bull, b.close, first);
      const normal = against(bull, b.close, first);
      if (brpType === 'All' || (brpType === 'Enhanced' ? enhanced : brpType === 'Normal' ? normal : false)) {
        sd.process = true;
        sd.lb = newLabel(v, {
          x: i, y: bull ? b.low : b.high, text: bull ? '▲' : '▼', textColor: textCss, up: bull,
          tooltip: (bull ? 'new bullish pattern detected' : 'new bearish pattern detected') + (enhanced ? ' (enchanced)' : ' (normal)'),
        });
        const extreme = bull ? Math.min(b1.low, b.low) : Math.max(b1.high, b.high);
        // both sides create the line of the first bar, then the line of the extreme
        const lnA = (sd.lnA = newLine(v, i - 2, i, first, lineCss));
        const lnB = (sd.lnB = newLine(v, i - 1, i, extreme, lineCss));
        s.linefills.push({ line1: lnA, line2: lnB, color: fillCss });
        sd.lnA2 = newLine(v, i - 2, i, first, lineCss);
        sd.lnB2 = newLine(v, i - 1, i, extreme, lineCss);
        sd.level = brpSR === 'Zone'
          ? (bull ? Math.max(b1.low, b.low) : Math.min(b1.high, b.high))
          : extreme;
      }
    }

    if (sd.process) {
      const confirm = () => {
        if (!beyond(bull, close1, sd.lnA!.y)) return;
        const lb = sd.lb!;
        if (sd.process1 === true && sd.process2Back !== null && sd.process1 !== sd.process2Back) {
          lb.tooltip = bull
            ? 'enchanced pattern (confirmed at detection)\nprice activity above the pattern high'
            : 'enchanced pattern (confirmed at detection)\nprice activity below the pattern low';
        } else {
          lb.tooltip = 'pattern confirmed ' + str.tostring(i - 1 - lb.x) + ' bars later';
          newLabel(v, {
            x: i - 1, y: bull ? b1!.low : b1!.high, text: '⦁', textColor: textCss, up: bull,
            tooltip: bull ? 'confirmation bar\nprice activity above the pattern high' : 'confirmation bar\nprice activity blow the pattern low',
          });
        }
        sd.process = false;
        sd.bx = bull
          ? newBox(v, { left: i, top: sd.level, right: i, bottom: sd.lnB!.y, border, bg: fillCss })
          : newBox(v, { left: i, top: sd.lnB!.y, right: i, bottom: sd.level, border, bg: fillCss });
        sd.process2 = true;
      };
      const fail = () => {
        if (against(bull, close1, sd.lnB!.y) || opposite) {
          sd.lb!.tooltip = bull ? 'pattern failed\nthe low of the pattern breached' : 'pattern failed\nthe high of the pattern breached';
          sd.process = false;
        }
      };
      // the bullish side tests the confirmation first, the bearish side the failure first
      if (bull) {
        confirm();
        fail();
      } else {
        fail();
        confirm();
      }
      const x2 = sd.process ? i : i - 1;
      sd.lnA2!.x2 = x2;
      sd.lnB2!.x2 = x2;
    }

    if (sd.process2 && brpSR !== 'None') {
      // bxA.get_bottom() / bxS.get_top(): the box of the latest confirmed pattern
      const edge = bull ? sd.bx!.bottom : sd.bx!.top;
      sd.bx!.right = i;
      if (!beyond(bull, b.close, edge)) sd.process2 = false;
    }

    sd.process2Back = sd.process1;
    sd.process1 = sd.process;
  };

  return {
    init() {
      const maFast = movingAverage(cfg.maFLength);
      const maSlow = movingAverage(cfg.maSLength);
      const grad = (): Grad => ({ topValue: [], bottomValue: [], topColor: [], bottomColor: [] });
      const s: TbrRun = {
        maFast, maSlow, st: taStep.supertrend(cfg.factor, cfg.atrPeriod), upper: taStep.highest(), lower: taStep.lowest(),
        upperArr: [], lowerArr: [], plots: Array.from({ length: 7 }, () => []), grads: [grad(), grad(), grad(), grad()],
        linefills: [],
        steps: [],
        vars: { bull: newSide(), bear: newSide(), os: 0, lines: [], labels: [], boxes: [] },
        lists: [], series: [],
      };
      s.steps = [...(maFast ? [maFast] : []), ...(maSlow ? [maSlow] : []), s.st, s.upper, s.lower];
      s.lists = [s.linefills];
      s.series = [
        s.upperArr, s.lowerArr, ...s.plots,
        ...s.grads.flatMap((g) => [g.topValue, g.bottomValue, g.topColor, g.bottomColor]),
      ];
      return s;
    },
    copyVars(v) {
      // the held objects are the only ones changed after their creation: copied, and put in the copied lists
      const lines = v.lines.slice();
      const labels = v.labels.slice();
      const boxes = v.boxes.slice();
      const swap = <T extends object>(list: T[], o: T | null): T | null => {
        if (!o) return o;
        const c = { ...o };
        const k = list.indexOf(o);
        if (k >= 0) list[k] = c;
        return c;
      };
      const copySide = (sd: Side): Side => ({
        ...sd, lnA2: swap(lines, sd.lnA2), lnB2: swap(lines, sd.lnB2), lb: swap(labels, sd.lb), bx: swap(boxes, sd.bx),
      });
      return { bull: copySide(v.bull), bear: copySide(v.bear), os: v.os, lines, labels, boxes };
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const time = b.time;
      const close = b.close;
      const fast = s.maFast ? s.maFast.step(close, b.volume ?? NaN) : NaN;
      const slow = s.maSlow ? s.maSlow.step(close, b.volume ?? NaN) : NaN;
      // Trend indicators - Supertrend; supertrend := barstate.isfirst ? na : supertrend
      const stOut = s.st.step(b.high, b.low, close);
      const direction = stOut[1];
      const supertrend = i === 0 ? NaN : stOut[0];
      // Trend indicators - Donchian channels
      const upper = s.upper.step(close, cfg.length);
      const lower = s.lower.step(close, cfg.length);
      s.upperArr[i] = upper;
      s.lowerArr[i] = lower;

      const p = s.plots;
      const g = s.grads;
      const g0 = g[0];
      const g1 = g[1];
      const g2 = g[2];
      const g3 = g[3];
      const fastAbove = gt(fast, slow);
      const maColor = fastAbove ? trendAC : trendSC;
      const cloud = trendType === 'Moving Average Cloud';
      p[0][i] = { time, value: cloud ? fast : NaN, color: String(color.new(maColor, 81)) };
      p[1][i] = { time, value: cloud ? slow : NaN, color: String(color.new(maColor, 73)) };
      // math.max / math.min give na when one value is na
      const bothMa = !isNaN(fast) && !isNaN(slow);
      g0.topValue[i] = bothMa ? Math.max(fast, slow) : NaN;
      g0.bottomValue[i] = bothMa ? Math.min(fast, slow) : NaN;
      g0.topColor[i] = String(color.new(maColor, fastAbove ? 99 : 81));
      g0.bottomColor[i] = String(color.new(maColor, fastAbove ? 81 : 99));

      const st = trendType === 'Supertrend';
      const up = direction < 0;
      const mid = (b.open + b.close) / 2;
      p[2][i] = { time, value: up && st ? supertrend : NaN, color: upTrendCss };
      p[3][i] = { time, value: !up && st ? supertrend : NaN, color: downTrendCss };
      p[4][i] = { time, value: i > 0 && st ? mid : NaN };
      g1.topValue[i] = supertrend;
      g1.bottomValue[i] = mid;
      g1.topColor[i] = upFill;
      g1.bottomColor[i] = 'transparent';
      g2.topValue[i] = mid;
      g2.bottomValue[i] = supertrend;
      g2.topColor[i] = 'transparent';
      g2.bottomColor[i] = downFill;

      // os := upper > upper[1] ? 1 : lower < lower[1] ? 0 : os
      if (i > 0 && gt(upper, s.upperArr[i - 1])) v.os = 1;
      else if (i > 0 && lt(lower, s.lowerArr[i - 1])) v.os = 0;
      const os = v.os;
      const dc = trendType === 'Donchian Channels';
      p[5][i] = { time, value: dc ? upper : NaN, color: os === 1 ? String(color.new(trendAC, 99)) : downTrendCss };
      p[6][i] = { time, value: dc ? lower : NaN, color: os === 1 ? upTrendCss : String(color.new(trendSC, 99)) };
      g3.topValue[i] = upper;
      g3.bottomValue[i] = lower;
      g3.topColor[i] = os === 1 ? 'transparent' : downFill;
      g3.bottomColor[i] = os === 0 ? 'transparent' : upFill;

      // Trend conditions
      let downTrend = true;
      let upTrend = true;
      const aligned = trendFilt === 'Aligned';
      if (cloud) {
        const below = lt(close, fast) && lt(fast, slow);
        const above = gt(close, fast) && gt(fast, slow);
        downTrend = aligned ? below : above;
        upTrend = aligned ? above : below;
      }
      if (st) {
        downTrend = aligned ? direction > 0 : direction < 0;
        upTrend = aligned ? direction < 0 : direction > 0;
      }
      if (dc) {
        downTrend = aligned ? os === 0 : os === 1;
        upTrend = aligned ? os === 1 : os === 0;
      }

      // 3-bar reversal pattern
      let bullishReversal = false;
      let bearishReversal = false;
      if (i >= 2) {
        const b1 = bars[i - 1];
        const b2 = bars[i - 2];
        bullishReversal = lt(b2.close, b2.open) && lt(b1.low, b2.low) && lt(b1.high, b2.high) && lt(b1.close, b1.open)
          && gt(b.close, b.open) && gt(b.high, b2.high) && upTrend;
        bearishReversal = gt(b2.close, b2.open) && gt(b1.high, b2.high) && gt(b1.low, b2.low) && gt(b1.close, b1.open)
          && lt(b.close, b.open) && lt(b.low, b2.low) && downTrend;
      }
      side(s, v.bull, true, i, bars, bullishReversal, bearishReversal);
      side(s, v.bear, false, i, bars, bearishReversal, bullishReversal);
    },
    result(s, bars) {
      const { lines, labels, boxes } = s.vars;
      const T = (index: number) => bars[index].time;
      const lineOut = (l: Ln): LineDrawingData => ({ time1: T(l.x1), price1: l.y, time2: T(l.x2), price2: l.y, color: l.color });
      const p = s.plots;
      const [g0, g1, g2, g3] = s.grads.map((g) => ({
        topValue: g.topValue.slice(), bottomValue: g.bottomValue.slice(), topColor: g.topColor.slice(), bottomColor: g.bottomColor.slice(),
      }));
      // a fill whose line was deleted by the object limit is not drawn
      const live = new Set<Ln>(lines);
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice() as Point[], plot1: p[1].slice() as Point[], plot2: p[2].slice() as Point[],
          plot3: p[3].slice() as Point[], plot4: p[4].slice(), plot5: p[5].slice() as Point[], plot6: p[6].slice() as Point[],
        },
        fills: [
          { plot1: 'plot0', plot2: 'plot1', gradient: g0 },
          { plot1: 'plot4', plot2: 'plot2', gradient: g1 },
          { plot1: 'plot4', plot2: 'plot3', gradient: g2 },
          { plot1: 'plot5', plot2: 'plot6', gradient: g3 },
        ],
        lines: lines.map(lineOut),
        linefills: s.linefills.filter((f) => live.has(f.line1) && live.has(f.line2))
          .map((f) => ({ line1: lineOut(f.line1), line2: lineOut(f.line2), color: f.color })),
        labels: labels.map((l) => ({
          time: T(l.x), price: l.y, text: l.text, color: 'transparent', textColor: l.textColor,
          style: l.up ? 'label_up' as const : 'label_down' as const, size: 'small' as const, tooltip: l.tooltip,
        })),
        boxes: boxes.map((b) => ({
          time1: T(b.left), price1: b.top, time2: T(b.right), price2: b.bottom, borderColor: b.border, bgColor: b.bg,
        })),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ThreeBarReversalPatternInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ThreeBarReversalPatternInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const ThreeBarReversalPattern = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
