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

import { ta, str, color, compare, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LabelData, LineDrawingData } from '../types';
import { barInterval, barTime } from '../bar-time';

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

/** A line or label as Pine keeps it: x coordinates are bar indexes */
interface Ln { x1: number; y1: number; x2: number; y2: number; color: string; style?: 'dashed' | 'solid'; width?: number }
interface Lb { x: number; y: number; text: string; color: string; textColor?: string; style: 'label_up' | 'label_down'; tooltip: string }

/** Pine math.max / math.min: na when an argument is na */
const pmax = (a: number, b: number) => (Number.isNaN(a) || Number.isNaN(b) ? NaN : Math.max(a, b));
const pmin = (a: number, b: number) => (Number.isNaN(a) || Number.isNaN(b) ? NaN : Math.min(a, b));

export function calculate(
  bars: Bar[],
  inputs: Partial<PivotPointsHighLowMissedReversalInputs> = {},
): IndicatorResult & { labels: LabelData[]; lines: LineDrawingData[] } {
  const { length, showReg, regPhCss, regPlCss, showMiss, missPhCss, missPlCss, labelCss } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const phArr = ta.pivothigh(new Series(bars, (b) => b.high), length, length).toArray();
  const plArr = ta.pivotlow(new Series(bars, (b) => b.low), length, length).toArray();

  // Live objects in creation order. A creation that brings the count above max + 5 deletes the oldest objects
  // until max remain (Pine max_lines_count / max_labels_count).
  let lines: Ln[] = [];
  let labels: Lb[] = [];
  const newLine = (x1: number, y1: number, x2: number, y2: number, lineColor: string, style?: 'dashed' | 'solid', width?: number): Ln => {
    const l: Ln = { x1, y1, x2, y2, color: lineColor, style, width };
    lines.push(l);
    if (lines.length > MAX_LINES + 5) lines = lines.slice(lines.length - MAX_LINES);
    return l;
  };
  const newLabel = (x: number, y: number, text: string, labelColor: string, style: 'label_up' | 'label_down', tooltip: number, textColor?: string) => {
    labels.push({ x, y, text, color: labelColor, style, tooltip: str.tostring(tooltip, '#.####'), textColor });
    if (labels.length > MAX_LABELS + 5) labels = labels.slice(labels.length - MAX_LABELS);
  };
  const ghostLine = (x: number, y: number, base: string) => newLine(x, y, x, y, String(color.new(base, 50)), undefined, 2);

  // var max = 0., var min = 0., ... ; os[1] is na on the first bar
  let max = 0;
  let min = 0;
  let maxX1 = 0;
  let minX1 = 0;
  let followMax = 0;
  let followMaxX1 = 0;
  let followMin = 0;
  let followMinX1 = 0;
  let os = 0;
  let py1 = 0;
  let px1 = 0;
  let ghost: Ln | undefined;

  for (let i = 0; i < n; i++) {
    const first = i === 0;
    const prevMax = first ? NaN : max;
    const prevMin = first ? NaN : min;
    const prevFollowMax = first ? NaN : followMax;
    const prevFollowMin = first ? NaN : followMin;
    const prevOs = first ? NaN : os;
    const prevGhost = ghost;
    const highL = i >= length ? bars[i - length].high : NaN;
    const lowL = i >= length ? bars[i - length].low : NaN;
    const ph = phArr[i] ?? NaN;
    const pl = plArr[i] ?? NaN;

    max = pmax(highL, max);
    min = pmin(lowL, min);
    followMax = pmax(highL, followMax);
    followMin = pmin(lowL, followMin);

    if (compare.gt(max, prevMax)) {
      maxX1 = i - length;
      followMin = lowL;
    }
    if (compare.lt(min, prevMin)) {
      minX1 = i - length;
      followMax = highL;
    }
    if (compare.lt(followMin, prevFollowMin)) followMinX1 = i - length;
    if (compare.gt(followMax, prevFollowMax)) followMaxX1 = i - length;

    // line.set_x2(ghost_level[1], n)
    if (prevGhost) prevGhost.x2 = i;

    // Pine `if ph`: false for na and 0
    if (!Number.isNaN(ph) && ph !== 0) {
      if (showMiss) {
        if (prevOs === 1) {
          newLabel(minX1, min, '👻', missPlCss, 'label_up', min);
          newLine(px1, py1, minX1, min, missPhCss, 'dashed');
          px1 = minX1;
          py1 = min;
          if (prevGhost) prevGhost.x2 = px1;
          ghost = ghostLine(px1, py1, regPlCss);
        } else if (compare.lt(ph, max)) {
          newLabel(maxX1, max, '👻', missPhCss, 'label_down', max);
          newLabel(followMinX1, followMin, '👻', missPlCss, 'label_up', min);
          newLine(px1, py1, maxX1, max, missPlCss, 'dashed');
          px1 = maxX1;
          py1 = max;
          if (prevGhost) prevGhost.x2 = px1;
          ghost = ghostLine(px1, py1, regPhCss);
          newLine(px1, py1, followMinX1, followMin, missPhCss, 'dashed');
          px1 = followMinX1;
          py1 = followMin;
          ghost.x2 = px1;
          ghost = ghostLine(px1, py1, regPlCss);
        }
      }
      if (showReg) {
        newLabel(i - length, ph, '▼', regPhCss, 'label_down', ph, labelCss);
        newLine(px1, py1, i - length, ph, missPlCss, compare.lt(ph, max) || prevOs === 1 ? 'dashed' : 'solid');
      }
      py1 = ph;
      px1 = i - length;
      os = 1;
      max = ph;
      min = ph;
    }

    if (!Number.isNaN(pl) && pl !== 0) {
      if (showMiss) {
        if (prevOs === 0) {
          newLabel(maxX1, max, '👻', missPhCss, 'label_down', max);
          newLine(px1, py1, maxX1, max, missPlCss, 'dashed');
          px1 = maxX1;
          py1 = max;
          if (prevGhost) prevGhost.x2 = px1;
          ghost = ghostLine(px1, py1, regPhCss);
        } else if (compare.gt(pl, min)) {
          newLabel(followMaxX1, followMax, '👻', missPhCss, 'label_down', max);
          newLabel(minX1, min, '👻', missPlCss, 'label_up', min);
          newLine(px1, py1, minX1, min, missPhCss, 'dashed');
          px1 = minX1;
          py1 = min;
          if (prevGhost) prevGhost.x2 = px1;
          ghost = ghostLine(px1, py1, regPlCss);
          newLine(px1, py1, followMaxX1, followMax, missPlCss, 'dashed');
          px1 = followMaxX1;
          py1 = followMax;
          ghost.x2 = px1;
          ghost = ghostLine(px1, py1, regPhCss);
        }
      }
      if (showReg) {
        newLabel(i - length, pl, '▲', regPlCss, 'label_up', pl, labelCss);
        newLine(px1, py1, i - length, pl, missPhCss, compare.gt(pl, min) || prevOs === 0 ? 'dashed' : 'solid');
      }
      py1 = pl;
      px1 = i - length;
      os = 0;
      max = pl;
      min = pl;
    }

    // barstate.islast: the running extreme since the last pivot
    if (i === n - 1) {
      let y = NaN;
      let x = 0;
      for (let k = 0; k <= i - px1 - 1; k++) {
        const v = os === 1 ? bars[i - k].low : bars[i - k].high;
        // array.min / array.max; array.indexof gives the first (most recent) bar of the extreme
        if (Number.isNaN(y) || (os === 1 ? compare.lt(v, y) : compare.gt(v, y))) {
          y = v;
          x = i - k;
        }
      }
      if (showMiss) {
        if (os === 1) newLabel(x, y, '👻', missPlCss, 'label_up', y);
        else newLabel(x, y, '👻', missPhCss, 'label_down', y);
        newLine(px1, py1, x, y, os === 1 ? missPhCss : missPlCss, 'dashed');
      }
      newLine(x, y, i, y, String(color.new(os === 1 ? missPhCss : missPlCss, 50)), undefined, 2);
    }
  }

  const interval = barInterval(bars);
  const timeOf = (index: number) => barTime(bars, index, interval);
  // An object with an na coordinate (or on a bar before the first bar) is not drawn
  const ok = (...v: number[]) => v.every(Number.isFinite);
  const outLines: LineDrawingData[] = [];
  for (const l of lines) {
    const time1 = timeOf(l.x1);
    const time2 = timeOf(l.x2);
    if (!ok(time1, time2, l.y1, l.y2)) continue;
    outLines.push({
      time1, price1: l.y1, time2, price2: l.y2, color: l.color,
      ...(l.style ? { style: l.style } : {}), ...(l.width ? { width: l.width } : {}),
    });
  }
  const outLabels: LabelData[] = [];
  for (const l of labels) {
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
}

export const PivotPointsHighLowMissedReversal = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
