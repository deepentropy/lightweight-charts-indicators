/**
 * Volume Profile + Pivot Levels [ChartPrime]
 *
 * A volume profile of the last `Period` bars, drawn on the last bar, with the pivots that sit on its busy prices.
 * - The range between the highest high and the lowest low of the period is cut in `Volume Profile Resolution` bins.
 *   A bin takes the volume of every bar whose close is inside the bin or within one bin size of it.
 * - The profile is one curved line: for each bin a point at its middle price, `round(50 * volume / largest volume)
 *   + 4` bars after the start of the period, closed by the bottom and the top of the range at the start bar.
 * - PoC: a line from the profile point of the largest bin to the last bar, with a label of its volume.
 * - The profile, the PoC line and its label are teal when the period has more rising bars (close above open) than
 *   other bars, else maroon. As in the original, this "delta" adds or subtracts the volume of the last bar once
 *   per bar of the period.
 * - Pivots (highs and lows of `Length` bars on each side) of the period are kept. A pivot whose price is within
 *   one bin size of the middle of a bin with at least `Filter % 0-100` percent of the largest volume, and that is
 *   54 bars or more after the start of the period, gets a label (bin volume and percent), a short line through
 *   the pivot and a dotted level that runs to the first later bar that crosses its price, else to the last bar.
 *   A pivot near two or three such bins gets one set of drawings for each of them, as in the original.
 * - As in the original, a pivot is not removed from the list when the pivot before it in the list is removed on
 *   the same bar (the loop skips it); it is removed on a later bar.
 *
 * Drawings are kept up to 500 lines and 500 labels (the oldest are removed).
 *
 * Reference: "Volume Profile + Pivot Levels [ChartPrime]" by ChartPrime
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © ChartPrime
 */

import { str, array, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LabelData, LineDrawingData, PolylineData } from '../types';
import { barInterval, barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolumeProfilePivotLevelsInputs {
  /** Period */
  start: number;
  /** Volume Profile Resolution */
  bins: number;
  /** PoC */
  poc: boolean;
  /** Display (pivots) */
  pivots: boolean;
  /** Length (pivots) */
  pivotLength: number;
  /** Filter % 0-100 */
  pivotFilter: number;
}

export const defaultInputs: VolumeProfilePivotLevelsInputs = {
  start: 200,
  bins: 50,
  poc: true,
  pivots: true,
  pivotLength: 10,
  pivotFilter: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'start', type: 'int', title: 'Period', defval: 200, max: 500, group: 'Volume Profile' },
  { id: 'bins', type: 'int', title: 'Volume Profile Resolution', defval: 50, group: 'Volume Profile' },
  { id: 'poc', type: 'bool', title: 'PoC', defval: true, group: 'Volume Profile' },
  { id: 'pivots', type: 'bool', title: 'Display', defval: true, group: 'Pivots' },
  { id: 'pivotLength', type: 'int', title: 'Length', defval: 10, group: 'Pivots' },
  { id: 'pivotFilter', type: 'int', title: 'Filter % 0-100', defval: 20, group: 'Pivots' },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Volume Profile + Pivot Levels [ChartPrime]',
  shortTitle: 'Volume Profile + Pivot Levels [ChartPrime]',
  overlay: true,
};

/** max_lines_count, max_labels_count */
const MAX_COUNT = 500;
const MAROON = '#880E4F';
const TEAL = '#089981';
/** Default colour of a line and of a label */
const BLUE = '#2962FF';

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => b - a <= EPS;
const le = (a: number, b: number) => a - b <= EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

interface Pivot { value: number; index: number; isHigh: boolean }
interface Ln {
  x1: number; y1: number; x2: number; y2: number; color: string; width: number; dotted: boolean; overlay: boolean;
  dead: boolean;
}
interface Lb {
  x: number; y: number; text: string; style: 'label_left' | 'label_down' | 'label_up'; color: string; overlay: boolean;
  dead: boolean;
}

/**
 * Live drawings of one kind: above max + 5 objects the oldest are deleted until max remain. The object that a
 * `var` variable of the script refers to (`keep`) is never deleted this way.
 */
class Live<T extends { dead: boolean }> {
  list: T[] = [];
  keep: T | null = null;
  add(o: T): T {
    this.list.push(o);
    if (this.list.length > MAX_COUNT + 5) {
      let extra = this.list.length - MAX_COUNT;
      this.list = this.list.filter((old) => {
        if (extra === 0 || old === this.keep) return true;
        old.dead = true;
        extra--;
        return false;
      });
    }
    return o;
  }
}

type Result = IndicatorResult & { lines: LineDrawingData[]; labels: LabelData[]; polylines: PolylineData[] };

interface VpRun extends BarRunState<{ pivots: Pivot[] }> {
  ph: PivotStep;
  pl: PivotStep;
}

const isValue = (v: number | null | undefined): v is number => v !== null && v !== undefined && !Number.isNaN(v);

function study(inputs: Partial<VolumeProfilePivotLevelsInputs>): BarStudy<VpRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { start, bins, pivotLength } = cfg;
  return {
    init() {
      const ph = new PivotStep(pivotLength, pivotLength, true);
      const pl = new PivotStep(pivotLength, pivotLength, false);
      return { ph, pl, steps: [ph, pl], vars: { pivots: [] }, lists: [], series: [] };
    },
    copyVars: (v) => ({ pivots: v.pivots.slice() }),
    bar(s, i, bars) {
      // Pivots of the period (ta.pivothigh(high, pivotLength, pivotLength), ta.pivotlow(low, ...))
      const pivots = s.vars.pivots;
      const b = bars[i];
      const ph = s.ph.step(i, b.high);
      const pl = s.pl.step(i, b.low);
      if (isValue(ph)) pivots.push({ value: bars[i - pivotLength].high, index: i - pivotLength, isHigh: true });
      if (isValue(pl)) pivots.push({ value: bars[i - pivotLength].low, index: i - pivotLength, isHigh: false });
      // for p in pivots, with a removal inside: the element after a removed one is skipped
      for (let k = 0; k < pivots.length; k++) {
        if (pivots[k].index <= i - start) pivots.splice(k, 1);
      }
    },
    result(s, bars) {
      const pivots = s.vars.pivots;
      const n = bars.length;
      const last = n - 1;
      const lines = new Live<Ln>();
      const labels = new Live<Lb>();
      const polylines: PolylineData[] = [];
      const interval = barInterval(bars);
      // a bar before the first bar (a period longer than the bars) is placed with the bar interval
      const timeOf = (x: number) => (x < 0 && n > 0 ? bars[0].time + x * interval : barTime(bars, x, interval));

      if (n > 0) {
        // barstate.islast
        const H = (j: number) => (last - j >= 0 ? bars[last - j].high : NaN);
        const L = (j: number) => (last - j >= 0 ? bars[last - j].low : NaN);
        const C = (j: number) => (last - j >= 0 ? bars[last - j].close : NaN);
        const O = (j: number) => (last - j >= 0 ? bars[last - j].open : NaN);
        const V = (j: number) => (last - j >= 0 ? bars[last - j].volume ?? NaN : NaN);

        const hl: number[] = [];
        for (let j = 0; j <= start - 1; j++) hl.push(H(j), L(j));
        const top = array.max(hl);
        const bottom = array.min(hl);
        const binSize = (top - bottom) / bins;

        // Volume of each bin; Delta adds the volume of the last bar for a rising bar and subtracts it for the others
        const binVol: number[] = new Array(bins).fill(0);
        const delta: number[] = new Array(bins).fill(0);
        for (let b = 0; b <= bins - 1; b++) {
          const binLow = bottom + binSize * b;
          const binHigh = binLow + binSize;
          for (let j = 0; j <= start - 1; j++) {
            if (ge(C(j), binLow - binSize) && lt(C(j), binHigh + binSize)) binVol[b] += V(j);
            delta[b] += gt(C(j), O(j)) ? V(0) : -V(0);
          }
        }

        const points: Array<{ x: number; y: number }> = [];
        const pivotLevels: Ln[] = [];
        const binMax = array.max(binVol);
        for (let b = 0; b <= bins - 1; b++) {
          const binLow = bottom + binSize * b;
          const binHigh = binLow + binSize;
          const mid = (binLow + binHigh) / 2;
          const binValue = binVol[b];
          const left = last - start;
          const right = left + Math.round(binValue / binMax * 50);
          const volPercent = binValue / binMax * 100;

          if (b === 0) points.push({ x: left, y: binLow });
          points.push({ x: right + 4, y: mid });
          if (b === bins - 1) points.push({ x: left, y: binHigh });

          if (eq(volPercent, 100) && cfg.poc) {
            lines.keep = lines.add({
              x1: right + 4, y1: mid, x2: last, y2: mid, color: BLUE, width: 2, dotted: false, overlay: false, dead: false,
            });
            labels.keep = labels.add({
              x: last, y: mid, text: str.tostring(binValue, 'volume'), style: 'label_left', color: BLUE, overlay: false,
              dead: false,
            });
          }

          if (pivots.length > 0 && cfg.pivots) {
            for (const p of pivots) {
              if (le(Math.abs(mid - p.value), binSize) && ge(volPercent, cfg.pivotFilter) && last - start + 54 <= p.index) {
                const css = p.isHigh ? MAROON : TEAL;
                const vol = str.tostring(binValue, 'volume');
                const pct = str.tostring(volPercent, 'percent');
                labels.add({
                  x: p.index, y: p.value, text: p.isHigh ? `${vol}\n${pct}` : `${pct}\n${vol}`,
                  style: p.isHigh ? 'label_down' : 'label_up', color: css, overlay: true, dead: false,
                });
                lines.add({
                  x1: p.index - pivotLength, y1: p.value, x2: p.index + pivotLength, y2: p.value, color: css, width: 2,
                  dotted: false, overlay: true, dead: false,
                });
                pivotLevels.push(lines.add({
                  x1: p.index, y1: p.value, x2: p.index, y2: p.value, color: css, width: 1, dotted: true, overlay: false,
                  dead: false,
                }));
              }
            }
          }
        }

        // A level ends on the first bar after its pivot that crosses its price (bars read from the oldest)
        for (let j = start - 1; j >= 0; j--) {
          // for p in pivotLevels, with a removal inside: the element after a removed one is skipped
          for (let k = 0; k < pivotLevels.length; k++) {
            const p = pivotLevels[k];
            // a deleted line has no price: the test is false
            const priceVal = p.dead ? NaN : p.y1;
            if (gt(H(j), priceVal) && lt(L(j), priceVal) && last - j > p.x1) {
              p.x2 = last - j;
              pivotLevels.splice(k, 1);
            } else if (!p.dead) {
              p.x2 = last;
            }
          }
        }

        const mColor = gt(array.sum(delta), 0) ? TEAL : MAROON;
        if (lines.keep && !lines.keep.dead) lines.keep.color = mColor;
        if (labels.keep && !labels.keep.dead) labels.keep.color = mColor;
        polylines.push({
          points: points.filter((p) => !Number.isNaN(p.x)).map((p) => ({ time: timeOf(p.x), price: p.y })),
          curved: true, closed: false, lineColor: mColor, lineWidth: 4, forceOverlay: true,
        });
      }

      const outLines: LineDrawingData[] = lines.list.filter((l) => !Number.isNaN(l.x1)).map((l) => ({
        time1: timeOf(l.x1), price1: l.y1, time2: timeOf(l.x2), price2: l.y2, color: l.color, width: l.width,
        ...(l.dotted ? { style: 'dotted' as const } : {}),
        ...(l.overlay ? { forceOverlay: true } : {}),
      }));
      const outLabels: LabelData[] = labels.list.map((l) => ({
        time: timeOf(l.x), price: l.y, text: l.text, color: l.color, textColor: '#FFFFFF', style: l.style,
        ...(l.overlay ? { forceOverlay: true } : {}),
      }));

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        lines: outLines,
        labels: outLabels,
        polylines,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeProfilePivotLevelsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<VolumeProfilePivotLevelsInputs> = {},
): IndicatorResult & { lines: LineDrawingData[]; labels: LabelData[]; polylines: PolylineData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const VolumeProfilePivotLevels = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
