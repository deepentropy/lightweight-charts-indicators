/**
 * Pivot Points High Low & Missed Reversal Levels [LuxAlgo]
 *
 * Regular pivots: pivot highs / lows of `length` bars on each side, marked with a label and joined by a zigzag.
 * Missed pivots: when two pivots of the same kind follow each other (two highs or two lows), the extreme between
 * them is a missed reversal. It gets a ghost label, dashed zigzag segments and a horizontal "ghost" level that runs
 * until the next missed reversal. On the last bar the script also draws the running extreme since the last pivot
 * (ghost label, dashed segment and level).
 *
 * All outputs are drawings (labels and lines, at most 500 of each).
 *
 * Reference: "Pivot Points High Low & Missed Reversal Levels [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: (c) LuxAlgo
 */

import { str, color, compare, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LabelData, LineDrawingData } from '../types';
import { barInterval, barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';


export interface PivotPointsHighLowMissedReversalInputs {
  /** Pivot Length */
  length: number;
  /** Regular Pivots */
  showReg: boolean;
  /** Regular pivot high colour */
  regPhCss: string;
  /** Regular pivot low colour */
  regPlCss: string;
  /** Missed Pivots */
  showMiss: boolean;
  /** Missed pivot high colour */
  missPhCss: string;
  /** Missed pivot low colour */
  missPlCss: string;
  /** Text Label Color */
  labelCss: string;
}

export const defaultInputs: PivotPointsHighLowMissedReversalInputs = {
  length: 50,
  showReg: true,
  regPhCss: '#ef5350',
  regPlCss: '#26a69a',
  showMiss: true,
  missPhCss: '#ef5350',
  missPlCss: '#26a69a',
  labelCss: '#FFFFFF',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Pivot Length', defval: 50 },
  { id: 'showReg', type: 'bool', title: 'Regular Pivots', defval: true, inline: 'inline1' },
  { id: 'regPhCss', type: 'color', title: 'High', defval: '#ef5350', inline: 'inline1' },
  { id: 'regPlCss', type: 'color', title: 'Low', defval: '#26a69a', inline: 'inline1' },
  { id: 'showMiss', type: 'bool', title: 'Missed Pivots', defval: true, inline: 'inline2' },
  { id: 'missPhCss', type: 'color', title: 'High', defval: '#ef5350', inline: 'inline2' },
  { id: 'missPlCss', type: 'color', title: 'Low', defval: '#26a69a', inline: 'inline2' },
  { id: 'labelCss', type: 'color', title: 'Text Label Color', defval: '#FFFFFF' },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Pivot Points High Low & Missed Reversal Levels [LuxAlgo]',
  shortTitle: 'Pivot Points High Low & Missed Reversal Levels [LuxAlgo]',
  overlay: true,
};

/** Pine: indicator(max_labels_count = 500, max_lines_count = 500) */
const MAX_LABELS = 500;
const MAX_LINES = 500;
/** Text colour of a label created without `textcolor` by a version 5 script */
const DEFAULT_TEXT = '#363A45';

/** A line or label as Pine keeps it: x coordinates are bar indexes */
interface Ln { x1: number; y1: number; x2: number; y2: number; color: string; style?: 'dashed' | 'solid'; width?: number }
interface Lb { x: number; y: number; text: string; color: string; textColor?: string; style: 'label_up' | 'label_down'; tooltip: string }

/** Pine math.max / math.min: na when an argument is na */
const pmax = (a: number, b: number) => (Number.isNaN(a) || Number.isNaN(b) ? NaN : Math.max(a, b));
const pmin = (a: number, b: number) => (Number.isNaN(a) || Number.isNaN(b) ? NaN : Math.min(a, b));

type Result = IndicatorResult & { labels: LabelData[]; lines: LineDrawingData[] };

interface PivotVars {
  /** Live objects in creation order */
  lines: Ln[];
  labels: Lb[];
  ghost: Ln | undefined;
  max: number;
  min: number;
  maxX1: number;
  minX1: number;
  followMax: number;
  followMaxX1: number;
  followMin: number;
  followMinX1: number;
  os: number;
  py1: number;
  px1: number;
}

interface PivotRun extends BarRunState<PivotVars> {
  ph: PivotStep;
  pl: PivotStep;
}

function study(inputs: Partial<PivotPointsHighLowMissedReversalInputs>): BarStudy<PivotRun, Result> {
  const { length, showReg, regPhCss, regPlCss, showMiss, missPhCss, missPlCss, labelCss } = { ...defaultInputs, ...inputs };
  /** The vars of the bar calculated */
  let v: PivotVars;
  // Live objects in creation order. A creation that brings the count above max + 5 deletes the oldest objects
  // until max remain (Pine max_lines_count / max_labels_count).
  const newLine = (x1: number, y1: number, x2: number, y2: number, lineColor: string, style?: 'dashed' | 'solid', width?: number): Ln => {
    const l: Ln = { x1, y1, x2, y2, color: lineColor, style, width };
    v.lines.push(l);
    if (v.lines.length > MAX_LINES + 5) v.lines = v.lines.slice(v.lines.length - MAX_LINES);
    return l;
  };
  // A label made without a text colour (the ghost labels) has the default text colour of a version 5 script
  const newLabel = (x: number, y: number, text: string, labelColor: string, style: 'label_up' | 'label_down', tooltip: number, textColor = DEFAULT_TEXT) => {
    v.labels.push({ x, y, text, color: labelColor, style, tooltip: str.tostring(tooltip, '#.####'), textColor });
    if (v.labels.length > MAX_LABELS + 5) v.labels = v.labels.slice(v.labels.length - MAX_LABELS);
  };
  const ghostLine = (x: number, y: number, base: string) => newLine(x, y, x, y, String(color.new(base, 50)), undefined, 2);
  return {
    init() {
      // ta.pivothigh(high, length, length) / ta.pivotlow(low, length, length)
      const ph = new PivotStep(length, length, true);
      const pl = new PivotStep(length, length, false);
      // var max = 0., var min = 0., ... ; os[1] is na on the first bar
      return {
        ph, pl, steps: [ph, pl], lists: [], series: [],
        vars: {
          lines: [], labels: [], ghost: undefined, max: 0, min: 0, maxX1: 0, minX1: 0, followMax: 0, followMaxX1: 0,
          followMin: 0, followMinX1: 0, os: 0, py1: 0, px1: 0,
        },
      };
    },
    // the lines and labels arrays change in place; of the lines only the ghost level changes after its creation
    copyVars(v) {
      const lines = v.lines.slice();
      let ghost = v.ghost;
      if (ghost) {
        const k = lines.indexOf(ghost);
        ghost = { ...ghost };
        if (k >= 0) lines[k] = ghost;
      }
      return { ...v, lines, labels: v.labels.slice(), ghost };
    },
    bar(s, i, bars) {
      v = s.vars;
      const n = bars.length;
      const first = i === 0;
      const prevMax = first ? NaN : v.max;
      const prevMin = first ? NaN : v.min;
      const prevFollowMax = first ? NaN : v.followMax;
      const prevFollowMin = first ? NaN : v.followMin;
      const prevOs = first ? NaN : v.os;
      const prevGhost = v.ghost;
      const highL = i >= length ? bars[i - length].high : NaN;
      const lowL = i >= length ? bars[i - length].low : NaN;
      const ph = s.ph.step(i, bars[i].high);
      const pl = s.pl.step(i, bars[i].low);

      v.max = pmax(highL, v.max);
      v.min = pmin(lowL, v.min);
      v.followMax = pmax(highL, v.followMax);
      v.followMin = pmin(lowL, v.followMin);

      if (compare.gt(v.max, prevMax)) {
        v.maxX1 = i - length;
        v.followMin = lowL;
      }
      if (compare.lt(v.min, prevMin)) {
        v.minX1 = i - length;
        v.followMax = highL;
      }
      if (compare.lt(v.followMin, prevFollowMin)) v.followMinX1 = i - length;
      if (compare.gt(v.followMax, prevFollowMax)) v.followMaxX1 = i - length;

      // line.set_x2(ghost_level[1], n)
      if (prevGhost) prevGhost.x2 = i;

      // Pine `if ph`: false for na and 0
      if (!Number.isNaN(ph) && ph !== 0) {
        if (showMiss) {
          if (prevOs === 1) {
            newLabel(v.minX1, v.min, '👻', missPlCss, 'label_up', v.min);
            newLine(v.px1, v.py1, v.minX1, v.min, missPhCss, 'dashed');
            v.px1 = v.minX1;
            v.py1 = v.min;
            if (prevGhost) prevGhost.x2 = v.px1;
            v.ghost = ghostLine(v.px1, v.py1, regPlCss);
          } else if (compare.lt(ph, v.max)) {
            newLabel(v.maxX1, v.max, '👻', missPhCss, 'label_down', v.max);
            newLabel(v.followMinX1, v.followMin, '👻', missPlCss, 'label_up', v.min);
            newLine(v.px1, v.py1, v.maxX1, v.max, missPlCss, 'dashed');
            v.px1 = v.maxX1;
            v.py1 = v.max;
            if (prevGhost) prevGhost.x2 = v.px1;
            v.ghost = ghostLine(v.px1, v.py1, regPhCss);
            newLine(v.px1, v.py1, v.followMinX1, v.followMin, missPhCss, 'dashed');
            v.px1 = v.followMinX1;
            v.py1 = v.followMin;
            v.ghost.x2 = v.px1;
            v.ghost = ghostLine(v.px1, v.py1, regPlCss);
          }
        }
        if (showReg) {
          newLabel(i - length, ph, '▼', regPhCss, 'label_down', ph, labelCss);
          newLine(v.px1, v.py1, i - length, ph, missPlCss, compare.lt(ph, v.max) || prevOs === 1 ? 'dashed' : 'solid');
        }
        v.py1 = ph;
        v.px1 = i - length;
        v.os = 1;
        v.max = ph;
        v.min = ph;
      }

      if (!Number.isNaN(pl) && pl !== 0) {
        if (showMiss) {
          if (prevOs === 0) {
            newLabel(v.maxX1, v.max, '👻', missPhCss, 'label_down', v.max);
            newLine(v.px1, v.py1, v.maxX1, v.max, missPlCss, 'dashed');
            v.px1 = v.maxX1;
            v.py1 = v.max;
            if (prevGhost) prevGhost.x2 = v.px1;
            v.ghost = ghostLine(v.px1, v.py1, regPhCss);
          } else if (compare.gt(pl, v.min)) {
            newLabel(v.followMaxX1, v.followMax, '👻', missPhCss, 'label_down', v.max);
            newLabel(v.minX1, v.min, '👻', missPlCss, 'label_up', v.min);
            newLine(v.px1, v.py1, v.minX1, v.min, missPhCss, 'dashed');
            v.px1 = v.minX1;
            v.py1 = v.min;
            if (prevGhost) prevGhost.x2 = v.px1;
            v.ghost = ghostLine(v.px1, v.py1, regPlCss);
            newLine(v.px1, v.py1, v.followMaxX1, v.followMax, missPlCss, 'dashed');
            v.px1 = v.followMaxX1;
            v.py1 = v.followMax;
            v.ghost.x2 = v.px1;
            v.ghost = ghostLine(v.px1, v.py1, regPhCss);
          }
        }
        if (showReg) {
          newLabel(i - length, pl, '▲', regPlCss, 'label_up', pl, labelCss);
          newLine(v.px1, v.py1, i - length, pl, missPhCss, compare.gt(pl, v.min) || prevOs === 0 ? 'dashed' : 'solid');
        }
        v.py1 = pl;
        v.px1 = i - length;
        v.os = 0;
        v.max = pl;
        v.min = pl;
      }

      // barstate.islast: the running extreme since the last pivot
      if (i === n - 1) {
        const os = v.os;
        let y = NaN;
        let x = 0;
        for (let k = 0; k <= i - v.px1 - 1; k++) {
          const val = os === 1 ? bars[i - k].low : bars[i - k].high;
          // array.min / array.max; array.indexof gives the first (most recent) bar of the extreme
          if (Number.isNaN(y) || (os === 1 ? compare.lt(val, y) : compare.gt(val, y))) {
            y = val;
            x = i - k;
          }
        }
        if (showMiss) {
          if (os === 1) newLabel(x, y, '👻', missPlCss, 'label_up', y);
          else newLabel(x, y, '👻', missPhCss, 'label_down', y);
          newLine(v.px1, v.py1, x, y, os === 1 ? missPhCss : missPlCss, 'dashed');
        }
        newLine(x, y, i, y, String(color.new(os === 1 ? missPhCss : missPlCss, 50)), undefined, 2);
      }
    },
    result(s, bars) {
      const interval = barInterval(bars);
      const timeOf = (index: number) => barTime(bars, index, interval);
      // An object with an na coordinate (or on a bar before the first bar) is not drawn
      const ok = (...v: number[]) => v.every(Number.isFinite);
      const outLines: LineDrawingData[] = [];
      for (const l of s.vars.lines) {
        const time1 = timeOf(l.x1);
        const time2 = timeOf(l.x2);
        if (!ok(time1, time2, l.y1, l.y2)) continue;
        outLines.push({
          time1, price1: l.y1, time2, price2: l.y2, color: l.color,
          ...(l.style ? { style: l.style } : {}), ...(l.width ? { width: l.width } : {}),
        });
      }
      const outLabels: LabelData[] = [];
      for (const l of s.vars.labels) {
        const time = timeOf(l.x);
        if (!ok(time, l.y)) continue;
        outLabels.push({
          time, price: l.y, text: l.text, color: l.color, ...(l.textColor ? { textColor: l.textColor } : {}),
          style: l.style, size: 'small', tooltip: l.tooltip,
        });
      }

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        labels: outLabels,
        lines: outLines,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PivotPointsHighLowMissedReversalInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PivotPointsHighLowMissedReversalInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const PivotPointsHighLowMissedReversal = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
