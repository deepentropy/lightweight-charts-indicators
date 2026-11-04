/**
 * Elliot Wave - Impulse
 *
 * A zig-zag of "zigzagLength" bars: a bar whose high is the highest high of the last zigzagLength bars is a high
 * pivot, a bar whose low is the lowest low is a low pivot. A new pivot in the same direction as the last one replaces
 * it when it goes further (the original keeps the bar of the new pivot even when it keeps the price of the old one).
 * A pivot beyond the pivot two back of the same side has a direction of +-2 (higher high / lower low), else +-1. The
 * last 10 pivots are kept.
 *
 * On every bar the three confirmed pivots before the latest one (points 0, 1 and 2) are tested for the start of an
 * impulse wave: point 1 is a higher high (or a lower low), point 2 a reversal, and the retracement of wave 2 is 0.5,
 * 0.618, 0.764 or 0.854 times wave 1 within "errorPercent" %. A new pattern draws its two waves (green when wave 2
 * goes down, red when it goes up) and replaces the entry, stop, trailing stop and four target lines (1.618, 2, 2.618
 * and 3.236 times wave 2 from point 2) with their labels. A table counts the bullish and bearish patterns.
 *
 * The "source" input is not used by the original. Alert (alertcondition, `alerts` of the result):
 * 'New impulse wave alert', true on the bars where a new wave is drawn.
 *
 * Reference: "Elliot Wave - Impulse" by Trendoscope
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © HeWhoMustNotBeNamed
 */

import {
  ta, str, Series, line, label, table, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type Line, type Label, type IndicatorResult, type InputConfig, type PlotConfig,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface ElliotWaveImpulseInputs {
  /** Source (not used by the original) */
  source: 'open' | 'high' | 'low' | 'close' | 'hl2' | 'hlc3' | 'ohlc4' | 'volume';
  /** Bars of the high / low pivot windows */
  zigzagLength: number;
  /** Tolerance of the wave 2 retracement ratios (%) */
  errorPercent: number;
  /** Entry: part of wave 2 beyond point 2 (%) */
  entryPercent: number;
  /** Width of the wave lines */
  zigzagWidth: number;
  /** Style of the wave lines */
  zigzagStyle: 'dashed' | 'dotted' | 'solid';
}

export const defaultInputs: ElliotWaveImpulseInputs = {
  source: 'close',
  zigzagLength: 10,
  errorPercent: 5,
  entryPercent: 30,
  zigzagWidth: 2,
  zigzagStyle: 'dotted',
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'source', defval: 'close' },
  { id: 'zigzagLength', type: 'int', title: 'zigzagLength', defval: 10, min: 0, step: 5 },
  { id: 'errorPercent', type: 'int', title: 'errorPercent', defval: 5, min: 2, max: 20, step: 5 },
  { id: 'entryPercent', type: 'int', title: 'entryPercent', defval: 30, min: 10, max: 100, step: 10 },
  { id: 'zigzagWidth', type: 'int', title: 'zigzagWidth', defval: 2, min: 1, step: 1 },
  { id: 'zigzagStyle', type: 'string', title: 'zigzagStyle', defval: 'dotted', options: ['dashed', 'dotted', 'solid'] },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'table'];

export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'New impulse wave alert', message: 'New impulse wave detected on {{ticker}}' },
];

export const metadata = {
  title: 'Elliot Wave - Impulse',
  shortTitle: 'EW - Impulse',
  overlay: true,
};

/** study(max_lines_count = 500, max_labels_count = 500) */
const MAX_OBJECTS = 500;
const MAX_PIVOT_SIZE = 10;

// Pine v4 colour constants
const GREEN = '#4CAF50';
const RED = '#FF5252';
const BLUE = '#2196F3';
const BLACK = '#363A45';
const WHITE = '#FFFFFF';

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
/** A float used as a bool before v6: na and 0 are false */
const truthy = (x: number) => !Number.isNaN(x) && x !== 0;

export function calculate(
  bars: Bar[],
  inputs: Partial<ElliotWaveImpulseInputs> = {},
): IndicatorResult & { alerts: AlertConditionState[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const length = cfg.zigzagLength;
  const errMin = (100 - cfg.errorPercent) / 100;
  const errMax = (100 + cfg.errorPercent) / 100;
  const entryRange = cfg.entryPercent / 100;
  const width = cfg.zigzagWidth;
  const style = cfg.zigzagStyle;

  const hb = ta.highestbars(new Series(bars, (b) => b.high), length).toArray();
  const lb = ta.lowestbars(new Series(bars, (b) => b.low), length).toArray();
  /** Pine `time` (ms) */
  const timeMs = (i: number) => (i >= 0 ? bars[i].time * 1000 : NaN);

  resetDrawings({ line: MAX_OBJECTS, label: MAX_OBJECTS });

  const zigzagpivots: number[] = [];
  const zigzagpivotbars: number[] = [];
  const zigzagpivotdirs: number[] = [];
  // var waveLinesArray = array.new_line(2): two na lines at first
  const waveLines: (Line | null)[] = [null, null];
  let targetLines: Line[] = [];
  let targetLabels: Label[] = [];
  const patterncount = [0, 0];

  let pivotDirPrev = NaN; // dir of pivots() on the bar before
  const waveFlags: boolean[] = new Array(n).fill(false);

  const drawLineWithLabel = (i: number, target: number, lbl: string, lineColor: string): [Line, Label] => {
    const t = timeMs(i);
    const timeDiffEnd = t - timeMs(i - 10);
    const timeDiffLabel = t - timeMs(i - 5);
    const targetLine = line.new(t, target, t + timeDiffEnd, target, 'bar_time', undefined, lineColor);
    const targetLabel = label.new(t + timeDiffLabel, target, `${lbl} : ${str.tostring(target)}`, 'bar_time', 'price',
      BLUE, 'none', BLACK, 'normal');
    return [targetLine, targetLabel];
  };

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];

    // pivots(length)
    const phigh = hb[i] === 0 ? b.high : NaN;
    const plow = lb[i] === 0 ? b.low : NaN;
    const pivotDir = truthy(phigh) && Number.isNaN(plow) ? 1 : truthy(plow) && Number.isNaN(phigh) ? -1 : pivotDirPrev;
    const dirchanged = truthy(pivotDir - pivotDirPrev);
    pivotDirPrev = pivotDir;

    // zigzag(): change(dir) is the change of the dir of pivots() (measured: the +-2 set below is not in its history)
    let dir = pivotDir;
    if (truthy(phigh) || truthy(plow)) {
      let value = dir === 1 ? phigh : plow;
      const bar = i;
      if (!dirchanged && zigzagpivots.length >= 1) {
        const pivot = zigzagpivots.shift()!;
        zigzagpivotbars.shift();
        const pivotdir = zigzagpivotdirs.shift()!;
        // the original tests the bar with the new value: the bar of the new pivot is always kept
        value = lt(value * pivotdir, pivot * pivotdir) ? pivot : value;
      }
      if (zigzagpivots.length >= 2) {
        const lastPoint = zigzagpivots[1];
        dir = gt(dir * value, dir * lastPoint) ? dir * 2 : dir;
      }
      zigzagpivots.unshift(value);
      zigzagpivotbars.unshift(bar);
      zigzagpivotdirs.unshift(dir);
      if (zigzagpivots.length > MAX_PIVOT_SIZE) {
        zigzagpivots.pop();
        zigzagpivotbars.pop();
        zigzagpivotdirs.pop();
      }
    }

    // ew_impulse(): waitForConfirmation = true, the latest pivot is left out
    const start = 1;
    let waveFound = false;
    if (zigzagpivots.length >= 3 + start) {
      const point2 = zigzagpivots[start];
      const point2Bar = zigzagpivotbars[start];
      const point2Dir = zigzagpivotdirs[start];
      const point1 = zigzagpivots[start + 1];
      const point1Bar = zigzagpivotbars[start + 1];
      const point1Dir = zigzagpivotdirs[start + 1];
      const point0 = zigzagpivots[start + 2];
      const point0Bar = zigzagpivotbars[start + 2];

      const w1Length = Math.abs(point1 - point0);
      const w2Length = Math.abs(point2 - point1);
      const r2 = w2Length / w1Length;

      const existingW1 = waveLines[0];
      const existingW2 = waveLines[1];
      const existing0 = existingW1 ? line.get_y1(existingW1) : NaN;
      const existing1 = existingW2 ? line.get_y1(existingW2) : NaN;
      const existing2 = existingW2 ? line.get_y2(existingW2) : NaN;

      const d = gt(point0, point1) ? -1 : 1;
      const entry = point2 + d * entryRange * w2Length;
      const stop = point0;
      const tstop = point2 - d * entryRange * w2Length;
      const target1 = point2 + d * 1.618 * w2Length;
      const target2 = point2 + d * 2.0 * w2Length;
      const target3 = point2 + d * 2.618 * w2Length;
      const target4 = point2 + d * 3.236 * w2Length;
      const stopColor = d === 1 ? RED : GREEN;
      const targetColor = d === 1 ? GREEN : RED;

      const ignore = eq(existing0, point0) || eq(existing1, point1) || eq(existing2, point2);
      const inRange = (ratio: number) => gt(r2, ratio * errMin) && lt(r2, ratio * errMax);
      const patternMatched = inRange(0.5) || inRange(0.618) || inRange(0.764) || inRange(0.854);
      const dirMatched = (point1Dir === 2 && point2Dir === -1) || (point1Dir === -2 && point2Dir === 1);
      const directionColor = gt(point1, point2) ? GREEN : RED;
      if (!ignore && patternMatched && dirMatched) {
        const w1 = line.new(point0Bar, point0, point1Bar, point1, 'bar_index', undefined, directionColor, style, width);
        const w2 = line.new(point1Bar, point1, point2Bar, point2, 'bar_index', undefined, directionColor, style, width);
        waveLines[0] = w1;
        waveLines[1] = w2;

        // the loop bounds are read once (Pine v4): every target line and label is deleted
        for (const l of targetLines) line.delete(l);
        for (const l of targetLabels) label.delete(l);
        targetLines = [];
        targetLabels = [];

        const made = [
          drawLineWithLabel(i, entry, 'Entry', BLUE),
          drawLineWithLabel(i, stop, 'Stop', stopColor),
          drawLineWithLabel(i, tstop, 'T.Stop', stopColor),
          drawLineWithLabel(i, target1, 'Target - 1', targetColor),
          drawLineWithLabel(i, target2, 'Target - 2', targetColor),
          drawLineWithLabel(i, target3, 'Target - 3', targetColor),
          drawLineWithLabel(i, target4, 'Target - 4', targetColor),
        ];
        for (const [l, lb2] of made) {
          targetLines.unshift(l);
          targetLabels.unshift(lb2);
        }
        patterncount[d === 1 ? 0 : 1] += 1;
        waveFound = true;
        // The original then deletes the two lines of the pattern before when its three points are the same as this
        // one's; that cannot happen, as equal points set `ignore`.
      }
    }
    waveFlags[i] = waveFound;

    // var stats = table.new(position.top_right, 3, max_pivot_size + 2, border_width = 1), cells on the last bar
    if (i === n - 1) {
      const stats = table.new('top_right', 3, MAX_PIVOT_SIZE + 2, undefined, undefined, undefined, undefined, 1);
      table.cell(stats, 1, 0, 'Bullish', undefined, undefined, WHITE, undefined, undefined, 'auto', BLACK);
      table.cell(stats, 2, 0, 'Bearish', undefined, undefined, WHITE, undefined, undefined, 'auto', BLACK);
      for (let direction = 0; direction <= 1; direction++) {
        table.cell(stats, direction + 1, 1, str.tostring(patterncount[direction]), undefined, undefined, BLACK,
          undefined, undefined, 'auto', WHITE);
      }
    }
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    ...drawingOutputs(bars),
    alerts: alertStates(alertConditions, bars, [waveFlags]),
  };
}

export const ElliotWaveImpulse = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  drawingKinds,
  alertConditions,
};
