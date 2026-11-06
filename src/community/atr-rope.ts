/**
 * ATR Rope
 *
 * A "rope" follows the source like rope stabilisation in a drawing application: it moves only by the part of the
 * source move that is beyond a threshold of ATR(length) * multiplier (a range filter). The rope colour shows its
 * direction (up / down), and turns to the flat colour when the source crosses the rope. While the direction is
 * flat, consolidation ranges are the running averages of the upper and lower ATR channel lines since the start of
 * the flat period, drawn with a fill; two alternating plot pairs separate consecutive ranges.
 *
 * Reference: "ATR Rope" by SamRecio
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ATRRopeInputs {
  /** Source (Pine nz(source)) */
  src: SourceType;
  /** ATR length */
  len: number;
  /** ATR multiplier: threshold of the rope */
  multi: number;
  /** Show the consolidation ranges */
  rngTog: boolean;
  /** Show the ATR channel (upper / lower lines) */
  atrTog: boolean;
  upCol: string;
  downCol: string;
  flatCol: string;
  /** Fill colour of the consolidation ranges (the range lines use it without transparency) */
  rngCol: string;
}

export const defaultInputs: ATRRopeInputs = {
  src: 'close',
  len: 14,
  multi: 1.5,
  rngTog: true,
  atrTog: false,
  upCol: '#3daa45',
  downCol: '#ff033e',
  flatCol: '#004d92',
  rngCol: '#004d9233',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'len', type: 'int', title: 'ATR Len', defval: 14 },
  { id: 'multi', type: 'float', title: 'Multi', defval: 1.5, min: 0, step: 0.25 },
  { id: 'rngTog', type: 'bool', title: 'Consolidation Ranges', defval: true },
  { id: 'atrTog', type: 'bool', title: 'ATR Channel', defval: false },
  { id: 'upCol', type: 'color', title: 'Up Color', defval: '#3daa45' },
  { id: 'downCol', type: 'color', title: 'Down Color', defval: '#ff033e' },
  { id: 'flatCol', type: 'color', title: 'Flat Color', defval: '#004d92' },
  { id: 'rngCol', type: 'color', title: 'Range Color', defval: '#004d9233' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Rope', color: '#004d92', lineWidth: 3 },
  { id: 'plot1', title: 'Upper', color: '#004d92', lineWidth: 1, visible: 'atrTog' },
  { id: 'plot2', title: 'Lower', color: '#004d92', lineWidth: 1, visible: 'atrTog' },
  { id: 'plot3', title: 'Range High 1', color: '#004d92', lineWidth: 1, style: 'linebr', visible: 'rngTog' },
  { id: 'plot4', title: 'Range Low 1', color: '#004d92', lineWidth: 1, style: 'linebr', visible: 'rngTog' },
  { id: 'plot5', title: 'Range High 2', color: '#004d92', lineWidth: 1, style: 'linebr', visible: 'rngTog' },
  { id: 'plot6', title: 'Range Low 2', color: '#004d92', lineWidth: 1, style: 'linebr', visible: 'rngTog' },
];

export const metadata = {
  title: 'ATR Rope',
  shortTitle: 'ATR Rope',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface RopeVars {
  /** var float _rope = _src (first bar) */
  rope: number;
  /** var dir = 0 */
  dir: number;
  /** var float c_hi = na, var float c_lo = na */
  cHi: number;
  cLo: number;
  /** var float h_sum = 0, var float l_sum = 0, var int c_count = 0 */
  hSum: number;
  lSum: number;
  cCount: number;
  /** var ff = true */
  ff: boolean;
}

interface RopeRun extends BarRunState<RopeVars> {
  atr: ReturnType<typeof taStep.atr>;
  src: number[];
  rope: number[];
  dir: number[];
  plots: Point[][];
}

function study(inputs: Partial<ATRRopeInputs>): BarStudy<RopeRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const nz = (v: number) => (isNaN(v) ? 0 : v);
  const value = barSource(cfg.src);
  // col = dir > 0 ? up_col : dir < 0 ? down_col : flat_col
  const col = (d: number) => (d > 0 ? cfg.upCol : d < 0 ? cfg.downCol : cfg.flatCol);
  // Range lines: color.new(rng_col, 0)
  const rngLine = String(color.new(cfg.rngCol, 0));
  const fillCol = cfg.rngTog ? cfg.rngCol : 'transparent';
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const atr = taStep.atr(cfg.len);
      const s: RopeRun = {
        atr, src: [], rope: [], dir: [], plots: Array.from({ length: 7 }, () => []),
        steps: [atr],
        vars: { rope: NaN, dir: 0, cHi: NaN, cLo: NaN, hSum: 0, lSum: 0, cCount: 0, ff: true },
        lists: [], series: [],
      };
      s.series = [s.src, s.rope, s.dir, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const time = b.time;
      // src = nz(input.source(close)); atr = ta.atr(len) * multi
      const src = nz(value(b) ?? NaN);
      s.src[i] = src;
      const atr = (s.atr.step(b.high, b.low, b.close) ?? NaN) * cfg.multi;

      // rope_smoother(src, atr): _rope += max(|_move| - nz(_threshold), 0) * sign(_move)
      if (i === 0) v.rope = src;
      const move = src - v.rope;
      v.rope += Math.max(Math.abs(move) - nz(atr), 0) * Math.sign(move);
      const rope = v.rope;
      s.rope[i] = rope;
      const upper = rope + atr;
      const lower = rope - atr;

      // dir := rope > rope[1] ? 1 : rope < rope[1] ? -1 : dir (rope[1] is na on the first bar)
      const prevRope = i > 0 ? s.rope[i - 1] : NaN;
      v.dir = gt(rope, prevRope) ? 1 : lt(rope, prevRope) ? -1 : v.dir;
      // if ta.cross(src, rope): dir := 0. Pine's cross needs a strict inequality on the previous bar too
      // (src[1] < rope[1] before a cross up, src[1] > rope[1] before a cross down): a bar where src == rope does
      // not start a cross. ta.cross compares exactly (no 1e-10 tolerance).
      if (i > 0) {
        const crossUp = src > rope && s.src[i - 1] < s.rope[i - 1];
        const crossDown = src < rope && s.src[i - 1] > s.rope[i - 1];
        if (crossUp || crossDown) v.dir = 0;
      }
      s.dir[i] = v.dir;

      // if dir == 0: if dir[1] != 0 -> reset the sums and flip ff; accumulate upper / lower
      // (dir[1] is na on the first bar: na != 0 is false)
      if (v.dir === 0) {
        if (i > 0 && s.dir[i - 1] !== 0) {
          v.hSum = 0;
          v.lSum = 0;
          v.cCount = 0;
          v.ff = !v.ff;
        }
        v.hSum += upper;
        v.lSum += lower;
        v.cCount += 1;
        v.cHi = v.hSum / v.cCount;
        v.cLo = v.lSum / v.cCount;
      }
      const c = col(v.dir);
      const p = s.plots;
      // plot(rope, linewidth = 3, color = col, force_overlay = true)
      p[0][i] = { time, value: rope, color: c };
      // plot(upper / lower, color = col, display = atr_tog ? display.all : display.none)
      p[1][i] = { time, value: upper, color: c };
      p[2][i] = { time, value: lower, color: c };
      // h1 = plot(ff ? na : c_hi), l1 = plot(ff ? na : c_lo), h2 = plot(ff ? c_hi : na), l2 = plot(ff ? c_lo : na)
      p[3][i] = { time, value: v.ff ? NaN : v.cHi, color: rngLine };
      p[4][i] = { time, value: v.ff ? NaN : v.cLo, color: rngLine };
      p[5][i] = { time, value: v.ff ? v.cHi : NaN, color: rngLine };
      p[6][i] = { time, value: v.ff ? v.cLo : NaN, color: rngLine };
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice(),
          plot5: p[5].slice(), plot6: p[6].slice(),
        },
        // fill(h1, l1, rng_col); fill(h2, l2, rng_col) (display = rng_tog ? display.all : display.none)
        fills: [
          { plot1: 'plot3', plot2: 'plot4', colors: new Array<string>(n).fill(fillCol) },
          { plot1: 'plot5', plot2: 'plot6', colors: new Array<string>(n).fill(fillCol) },
        ],
        markers: [],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ATRRopeInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<ATRRopeInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const ATRRope = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
