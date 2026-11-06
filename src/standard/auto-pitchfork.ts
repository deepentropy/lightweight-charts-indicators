/**
 * Auto Pitchfork
 *
 * Andrews' pitchfork on the last three confirmed pivots of a zigzag.
 * - Zigzag (ZigZag library v7, deviation 0): pivots of `Depth / 2` bars on each side (at least 2), alternating
 *   highs and lows; a pivot of the same kind moves the last one when it goes further. The pitchfork uses the three
 *   pivots before the last (still moving) one: P0 (oldest), P1 and P2.
 * - Median line: from P0 ("Original"), from P0 at the mid price of P0 and P1 ("Schiff"), from the middle of P0-P1
 *   ("Modified Schiff") or from P2 along the slope of P2 to the middle of P0-P1 ("Inside"), through the middle of
 *   P1-P2 (on a whole bar: the price is corrected when the middle falls between two bars). It extends right (both
 *   ways with "Extend left").
 * - Levels: for each level switched on, two parallel lines at level x half the P1-P2 distance (in bars and price) on
 *   each side of the middle of P1-P2, with the slope of the median line, extended as the median line, and a fill
 *   between them (or between each line and the same side of the level before).
 * - The line P1-P2, the line P0-P1 (all types but "Original") and, for "Inside", the line from the middle of P0-P1
 *   to P2 use the median line colour, width and style.
 *
 * Based on the standard Auto Pitchfork indicator.
 */

import { barTime, color, type Bar, type IndicatorResult, type InputConfig, type PlotConfig } from 'oakscriptjs';
import type { LineDrawingData, LinefillData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

type LineStyleInput = 'Dashed' | 'Dotted' | 'Solid';
type PitchforkType = 'Original' | 'Schiff' | 'Modified Schiff' | 'Inside';

/** Keys of the 9 levels, in the order of their inputs (and of the drawing) */
const LEVEL_KEYS = ['0_25', '0_382', '0_5', '0_618', '0_75', '1', '1_5', '1_75', '2'] as const;
type LevelKey = (typeof LEVEL_KEYS)[number];

/** Default [show, value, colour] of each level (width 1, style "Solid") */
const LEVEL_DEFAULTS: Record<LevelKey, [boolean, number, string]> = {
  '0_25': [false, 0.25, '#ffb74d'],
  '0_382': [false, 0.382, '#81c784'],
  '0_5': [true, 0.5, '#4caf50'],
  '0_618': [false, 0.618, '#009688'],
  '0_75': [false, 0.75, '#64b5f6'],
  '1': [true, 1, '#2962ff'],
  '1_5': [false, 1.5, '#9c27b0'],
  '1_75': [false, 1.75, '#e91e63'],
  '2': [false, 2, '#e91e63'],
};

type LevelInputs = {
  [K in LevelKey as `show_${K}`]: boolean;
} & {
  [K in LevelKey as `value_${K}`]: number;
} & {
  [K in LevelKey as `color_${K}`]: string;
} & {
  [K in LevelKey as `width_${K}`]: number;
} & {
  [K in LevelKey as `style_${K}`]: LineStyleInput;
};

export interface AutoPitchforkInputs extends LevelInputs {
  /** Pivot depth in bars (half on each side) */
  depth: number;
  typeP: PitchforkType;
  /** Transparency (0-100) of the fills between levels */
  backgroundTransparency: number;
  /** Extend the median line and the levels to the left too */
  isExtended: boolean;
  medianColor: string;
  medianWidth: number;
  medianStyle: LineStyleInput;
}

const levelDefaults = Object.fromEntries(
  LEVEL_KEYS.flatMap((k) => {
    const [show, value, css] = LEVEL_DEFAULTS[k];
    return [[`show_${k}`, show], [`value_${k}`, value], [`color_${k}`, css], [`width_${k}`, 1], [`style_${k}`, 'Solid']];
  }),
) as LevelInputs;

export const defaultInputs: AutoPitchforkInputs = {
  depth: 10,
  typeP: 'Original',
  backgroundTransparency: 85,
  isExtended: false,
  medianColor: '#f44336',
  medianWidth: 1,
  medianStyle: 'Solid',
  ...levelDefaults,
};

const DEPTH_TOOLTIP = 'The minimum number of bars that will be taken into account when calculating the indicator.';
const STYLES: LineStyleInput[] = ['Dashed', 'Dotted', 'Solid'];

export const inputConfig: InputConfig[] = [
  { id: 'depth', type: 'int', title: 'Depth', defval: 10, min: 2, tooltip: DEPTH_TOOLTIP },
  { id: 'typeP', type: 'string', title: 'Type', defval: 'Original', options: ['Original', 'Schiff', 'Modified Schiff', 'Inside'] },
  { id: 'backgroundTransparency', type: 'int', title: 'Background Transparency', defval: 85, min: 0, max: 100, display: 'data_window' },
  { id: 'isExtended', type: 'bool', title: 'Extend left', defval: false, display: 'none' },
  {
    id: 'medianColor', type: 'color',
    title: 'Median line                 ',
    defval: '#f44336', inline: 'ML', display: 'data_window',
  },
  { id: 'medianWidth', type: 'int', title: '', defval: 1, min: 1, inline: 'ML', display: 'data_window' },
  { id: 'medianStyle', type: 'string', title: '', defval: 'Solid', options: STYLES, inline: 'ML', display: 'data_window' },
  ...LEVEL_KEYS.flatMap((k, j): InputConfig[] => {
    const [show, value, css] = LEVEL_DEFAULTS[k];
    const inline = `level${j}`;
    const active = `show_${k}`;
    return [
      { id: `show_${k}`, type: 'bool', title: '', defval: show, inline, display: 'data_window' },
      { id: `value_${k}`, type: 'float', title: '', defval: value, min: 0, step: 0.1, inline, display: 'data_window', active },
      { id: `color_${k}`, type: 'color', title: '', defval: css, inline, display: 'data_window', active },
      { id: `width_${k}`, type: 'int', title: '', defval: 1, min: 1, inline, display: 'data_window', active },
      { id: `style_${k}`, type: 'string', title: '', defval: 'Solid', options: STYLES, inline, display: 'data_window', active },
    ];
  }),
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Auto Pitchfork',
  shortTitle: 'Auto Pitchfork',
  overlay: true,
};

export interface AutoPitchforkResult extends IndicatorResult {
  lines: LineDrawingData[];
  linefills: LinefillData[];
}

/** chart.point with a bar index (xloc.bar_index) */
interface Point {
  index: number;
  price: number;
}

const avg = (a: number, b: number) => (a + b) / 2;

/** One zigzag pivot (the parts of the oakscriptjs ZigZag pivot the pitchfork reads), replaced rather than changed */
interface ZzPivot {
  isHigh: boolean;
  start: Point;
  end: Point;
}

interface PitchforkVars {
  /** The pivots of the zigzag (oakscriptjs ZigZag with devThreshold 0, extendLast false) */
  pivots: ZzPivot[];
  lastP: Point | null;
  prevP: Point | null;
  prev2P: Point | null;
}

type PitchforkRun = BarRunState<PitchforkVars>;

/**
 * ZigZag.update(bars[i], i) of the oakscriptjs engine (pivots only: the volumes are not read), one bar at a time:
 * true when a pivot was added or moved. The engine's buffers are the bar values, read from the bars.
 */
function zigZagUpdate(pivots: ZzPivot[], bars: Bar[], i: number, settingsDepth: number): boolean {
  const depth = Math.max(2, Math.floor(settingsDepth / 2));
  // Need enough bars for pivot detection (depth bars before and after)
  if (i + 1 < depth * 2 + 1) return false;
  const findPivotPoint = (isHigh: boolean): Point | null => {
    const pivotIdx = i - depth;
    if (pivotIdx < depth) return null;
    const pivotPrice = isHigh ? bars[pivotIdx].high : bars[pivotIdx].low;
    // For a pivot high, subsequent bars must be strictly lower; for a pivot low, strictly higher
    for (let k = pivotIdx + 1; k <= i; k++) {
      if (isHigh ? bars[k].high > pivotPrice : bars[k].low < pivotPrice) return null;
    }
    // For a pivot high, previous bars must be lower or equal; for a pivot low, higher or equal
    for (let k = pivotIdx - depth; k < pivotIdx; k++) {
      if (isHigh ? bars[k].high >= pivotPrice : bars[k].low <= pivotPrice) return null;
    }
    return { index: i - depth, price: pivotPrice };
  };
  const newPivotPointFound = (isHigh: boolean, point: Point): boolean => {
    const count = pivots.length;
    if (count === 0) {
      pivots.push({ isHigh, start: point, end: point });
      return true;
    }
    const last = pivots[count - 1];
    if (last.isHigh === isHigh) {
      // Same direction - check if this is a more extreme price
      const isMoreExtreme = isHigh ? point.price > last.end.price : point.price < last.end.price;
      if (isMoreExtreme) {
        // the first pivot moves its start with its end
        pivots[count - 1] = { isHigh: last.isHigh, start: count === 1 ? point : last.start, end: point };
        return true;
      }
    } else {
      // Direction change - check if deviation threshold is met
      const dev = 100 * (point.price - last.end.price) / Math.abs(last.end.price);
      const threshold = 0;
      const meetsThreshold = last.isHigh ? dev <= -threshold : dev >= threshold;
      if (meetsThreshold) {
        pivots.push({ isHigh, start: last.end, end: point });
        return true;
      }
    }
    return false;
  };
  const tryFindPivot = (isHigh: boolean): boolean => {
    const point = findPivotPoint(isHigh);
    if (!point) return false;
    return newPivotPointFound(isHigh, point);
  };
  let somethingChanged = tryFindPivot(true);
  // allowZigZagOnOneBar (true): the low is registered too
  somethingChanged = tryFindPivot(false) || somethingChanged;
  return somethingChanged;
}

/** The pitchfork drawn from the last three zigzag points */
function draw(cfg: AutoPitchforkInputs, bars: Bar[], result: AutoPitchforkResult, P0: Point, P1: Point, P2: Point): void {
  const extendLine = cfg.isExtended ? 'both' : 'right';
  const time = (index: number) => barTime(bars, index);
  const styleOf = (s: LineStyleInput) => (s === 'Solid' ? 'solid' : s === 'Dotted' ? 'dotted' : 'dashed');
  const drawLine = (start: Point, end: Point, css: string, width: number, style: LineStyleInput, extend: 'none' | 'right' | 'both') => {
    const l: LineDrawingData = {
      time1: time(start.index), price1: start.price, time2: time(end.index), price2: end.price,
      color: css, width, style: styleOf(style), extend,
    };
    result.lines.push(l);
    return l;
  };

  const calcOffsetPrice = (start: Point, end: Point) => ((start.price - end.price) * 0.5) / Math.abs(start.index - end.index - 0.5);

  // getMedianData(type)
  let startMedian: Point;
  const endMedian: Point = { index: Math.floor(avg(P1.index, P2.index)), price: avg(P1.price, P2.price) };
  const needOffsetEndMedianPrice = (P2.index - P1.index) % 2 !== 0;
  if (cfg.typeP === 'Original') {
    startMedian = { ...P0 };
    endMedian.price += needOffsetEndMedianPrice ? calcOffsetPrice(startMedian, endMedian) : 0;
  } else if (cfg.typeP === 'Schiff') {
    startMedian = { ...P0 };
    startMedian.price = avg(P1.price, P0.price);
    endMedian.price += needOffsetEndMedianPrice ? calcOffsetPrice(startMedian, endMedian) : 0;
  } else if (cfg.typeP === 'Modified Schiff') {
    startMedian = { index: Math.floor(avg(P1.index, P0.index)), price: avg(P1.price, P0.price) };
    const offsetPrice = calcOffsetPrice(startMedian, endMedian);
    startMedian.price += (P0.index - P1.index) % 2 !== 0 ? offsetPrice : 0;
    endMedian.price += needOffsetEndMedianPrice ? offsetPrice : 0;
  } else {
    startMedian = { ...P2 };
    const slopeInside = (avg(P1.price, P0.price) - P2.price) / (avg(P1.index, P0.index) - P2.index);
    startMedian.price = slopeInside * (startMedian.index - avg(P1.index, P2.index)) + endMedian.price;
    endMedian.price -= needOffsetEndMedianPrice ? calcOffsetPrice(startMedian, endMedian) : 0;
  }

  // Lines drawn on each bar where the pitchfork is ready, in the order of the original
  const { medianColor, medianWidth, medianStyle } = cfg;
  if (cfg.typeP === 'Inside') drawLine(endMedian, startMedian, medianColor, medianWidth, medianStyle, extendLine);
  else drawLine(startMedian, endMedian, medianColor, medianWidth, medianStyle, extendLine);
  drawLine(P1, P2, medianColor, medianWidth, medianStyle, 'none');
  if (cfg.typeP !== 'Original') drawLine(P0, P1, medianColor, medianWidth, medianStyle, 'none');
  if (cfg.typeP === 'Inside') {
    drawLine({ index: Math.round(avg(P1.index, P0.index)), price: avg(P1.price, P0.price) }, P2, medianColor, medianWidth, medianStyle, 'none');
  }

  // drawLevel(iDiff, pDiff, level, slopeMedian, ...)
  const drawLevel = (iDiff: number, pDiff: number, level: number, slopeMedian: number, css: string, width: number, style: LineStyleInput) => {
    const iEndMedian = (P1.index + P2.index) / 2;
    const pEndMedian = (P1.price + P2.price) / 2;
    const isSlopeUp = P1.price - P2.price > 1e-10;
    const temp = iEndMedian + (isSlopeUp ? iDiff : -iDiff) * level;
    const start: Point = { index: Math.ceil(temp), price: pEndMedian - pDiff * level };
    const end: Point = { index: start.index + 1, price: slopeMedian * (start.index + 1 - temp) + start.price };
    const isIntBarIndex = temp - Math.ceil(temp);
    const offset = Math.abs(isIntBarIndex) <= 1e-10 ? 0 : ((start.price - end.price) * isIntBarIndex) / (temp - end.index);
    start.price -= offset;
    return drawLine(start, end, css, width, style, extendLine);
  };

  let other1: LineDrawingData | null = null;
  let other2: LineDrawingData | null = null;
  for (const k of LEVEL_KEYS) {
    if (!cfg[`show_${k}`]) continue;
    const level = cfg[`value_${k}`];
    const css = cfg[`color_${k}`];
    const width = cfg[`width_${k}`];
    const style = cfg[`style_${k}`];
    const iDiff = Math.abs(P1.index - P2.index) / 2;
    const pDiff = Math.abs(P1.price - P2.price) / 2;
    const slopeMedian = (endMedian.price - startMedian.price) / (endMedian.index - startMedian.index);
    const lineId1 = drawLevel(-iDiff, -pDiff, level, slopeMedian, css, width, style);
    const lineId2 = drawLevel(iDiff, pDiff, level, slopeMedian, css, width, style);
    const fill = color.new(css, cfg.backgroundTransparency);
    if (other1 && other2) {
      result.linefills.push({ line1: lineId1, line2: other1, color: fill });
      result.linefills.push({ line1: lineId2, line2: other2, color: fill });
    } else {
      result.linefills.push({ line1: lineId1, line2: lineId2, color: fill });
    }
    other1 = lineId1;
    other2 = lineId2;
  }
}

function study(inputs: Partial<AutoPitchforkInputs>): BarStudy<PitchforkRun, AutoPitchforkResult> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      return { steps: [], lists: [], series: [], vars: { pivots: [], lastP: null, prevP: null, prev2P: null } };
    },
    bar(s, i, bars) {
      // Zigzag: the points are updated on each bar where the zigzag changes; the drawings keep their objects (`var`)
      // and take the points of the last bar
      const v = s.vars;
      if (!zigZagUpdate(v.pivots, bars, i, cfg.depth)) return;
      const pivots = v.pivots;
      const count = pivots.length;
      if (count > 1) {
        const p = pivots[count - 2];
        // ZigZag v7: the start of the first pivot moves with its end (the library engine keeps the first point)
        const start = count - 2 === 0 ? p.end : p.start;
        v.lastP = { index: p.end.index, price: p.end.price };
        v.prevP = { index: start.index, price: start.price };
        if (count > 2) {
          const p2 = pivots[count - 3];
          const start2 = count - 3 === 0 ? p2.end : p2.start;
          v.prev2P = { index: start2.index, price: start2.price };
        }
      }
    },
    copyVars: (v) => ({ ...v, pivots: v.pivots.slice() }),
    result(s, bars) {
      const result: AutoPitchforkResult = {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        lines: [],
        linefills: [],
      };
      const { lastP, prevP, prev2P } = s.vars;
      if (!lastP || !prevP || !prev2P) return result;
      draw(cfg, bars, result, prev2P, prevP, lastP);
      return result;
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AutoPitchforkInputs> = {}, chart: ChartContext = {}): IndicatorRun<AutoPitchforkResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AutoPitchforkInputs> = {}): AutoPitchforkResult {
  return fullResult(createRun(inputs).update(bars));
}

export const AutoPitchfork = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
