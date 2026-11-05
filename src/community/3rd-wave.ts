/**
 * 3rd Wave
 *
 * Looks for the start of a third wave on a zigzag.
 * - Zigzag: a bar is a pivot high when its high is the highest of the last "ZigZag Period" bars, a pivot low when
 *   its low is the lowest. The direction follows the last pivot; a new direction adds a point, the same direction
 *   moves the last point. The last five points are kept.
 * - With four points or more, wave 1 is the leg between the fourth and the third last point and wave 2 the leg
 *   after it. When wave 2 retraces between the minimum and the maximum rate of wave 1 and the price breaks the end
 *   of wave 1 (the high goes above it in an up move, the low below it in a down move), the breakout is checked once
 *   per zigzag direction.
 * - Volume support: the linear regression of the volume since the start of wave 1 must rise on the breakout bar.
 * - A breakout draws a box from the start of wave 1 to the breakout bar (between the start and the end of wave 1),
 *   the two waves with the labels 0, 1 and 2, a triangle at the start price of wave 1 on the breakout bar, and one
 *   dashed line per target (the start of wave 3 plus a multiple of wave 1, not below 0).
 * - "Zig Zag" draws the zigzag itself.
 *
 * Drawings are kept up to 500 lines, 500 labels and 50 boxes (the oldest are removed).
 *
 * Alerts (alertcondition, `alerts` of the result): 'Breakout Long' / 'Breakout Short', true on the bars of a breakout
 * (with volume support) in an up / down zigzag direction.
 *
 * The zigzag functions are those of version 1 of the library "CreateAndShowZigzag" by LonesomeTheBlue (getZigzag,
 * showZigzag), written in this file.
 *
 * Reference: "3rd Wave" by LonesomeTheBlue
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LonesomeTheBlue
 */

import { taCore, taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BoxData, LabelData, LabelStyle, LineDrawingData } from '../types';
import { barInterval, barTime } from '../bar-time';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ThirdWaveInputs {
  /** ZigZag Period */
  prd: number;
  /** Minimum retracement of wave 2 */
  retRateMin: number;
  /** Maximum retracement of wave 2 */
  retRateMax: number;
  /** Check Volume Support */
  checkvolSupport: boolean;
  target1Enb: boolean;
  target1Ret: number;
  target2Enb: boolean;
  target2Ret: number;
  target3Enb: boolean;
  target3Ret: number;
  target4Enb: boolean;
  target4Ret: number;
  /** Show Wave 1 and 2 */
  showwave12: boolean;
  /** Zone */
  showbo: boolean;
  bupcol: string;
  bdncol: string;
  /** Zig Zag */
  showzigzag: boolean;
  upcol: string;
  dncol: string;
}

export const defaultInputs: ThirdWaveInputs = {
  prd: 8,
  retRateMin: 0.382,
  retRateMax: 0.786,
  checkvolSupport: true,
  target1Enb: true,
  target1Ret: 1.0,
  target2Enb: true,
  target2Ret: 1.618,
  target3Enb: false,
  target3Ret: 2.618,
  target4Enb: false,
  target4Ret: 3.618,
  showwave12: true,
  showbo: true,
  bupcol: 'rgba(0, 255, 0, 0.15)',
  bdncol: 'rgba(255, 0, 0, 0.15)',
  showzigzag: false,
  upcol: '#00E676',
  dncol: '#FF5252',
};

export const inputConfig: InputConfig[] = [
  { id: 'prd', type: 'int', title: 'ZigZag Period', defval: 8, min: 2, max: 50, group: 'setup' },
  { id: 'retRateMin', type: 'float', title: 'Min/Max Retracements', defval: 0.382, min: 0.1, max: 0.9, inline: 'retrate', group: 'setup' },
  { id: 'retRateMax', type: 'float', title: '', defval: 0.786, min: 0.1, max: 0.9, inline: 'retrate', group: 'setup' },
  { id: 'checkvolSupport', type: 'bool', title: 'Check Volume Support', defval: true, group: 'setup' },
  { id: 'target1Enb', type: 'bool', title: 'Target 1', defval: true, inline: 't1', group: 'targets' },
  { id: 'target1Ret', type: 'float', title: '', defval: 1.0, inline: 't1', group: 'targets', tooltip: '%X of wave 1 from the begining of wave 2' },
  { id: 'target2Enb', type: 'bool', title: 'Target 2', defval: true, inline: 't2', group: 'targets' },
  { id: 'target2Ret', type: 'float', title: '', defval: 1.618, inline: 't2', group: 'targets', tooltip: '%X of wave 1 from the begining of wave 2' },
  { id: 'target3Enb', type: 'bool', title: 'Target 3', defval: false, inline: 't3', group: 'targets' },
  { id: 'target3Ret', type: 'float', title: '', defval: 2.618, inline: 't3', group: 'targets', tooltip: '%X of wave 1 from the begining of wave 2' },
  { id: 'target4Enb', type: 'bool', title: 'Target 4', defval: false, inline: 't4', group: 'targets' },
  { id: 'target4Ret', type: 'float', title: '', defval: 3.618, inline: 't4', group: 'targets', tooltip: '%X of wave 1 from the begining of wave 2' },
  { id: 'showwave12', type: 'bool', title: 'Show Wave 1 and 2', defval: true, group: 'colors' },
  { id: 'showbo', type: 'bool', title: 'Zone', defval: true, inline: 'bocol', group: 'colors' },
  { id: 'bupcol', type: 'color', title: '', defval: 'rgba(0, 255, 0, 0.15)', inline: 'bocol', group: 'colors' },
  { id: 'bdncol', type: 'color', title: '', defval: 'rgba(255, 0, 0, 0.15)', inline: 'bocol', group: 'colors' },
  { id: 'showzigzag', type: 'bool', title: 'Zig Zag', defval: false, inline: 'zzcol', group: 'colors' },
  { id: 'upcol', type: 'color', title: '', defval: '#00E676', inline: 'zzcol', group: 'colors' },
  { id: 'dncol', type: 'color', title: '', defval: '#FF5252', inline: 'zzcol', group: 'colors' },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: '3rd Wave',
  shortTitle: '3rd Wave',
  overlay: true,
};

/** indicator(max_lines_count = 500, max_labels_count = 500); the box limit is the default */
const MAX_LINES = 500;
const MAX_LABELS = 500;
const MAX_BOXES = 50;
/** var max_array_size = 10 */
const MAX_ARRAY_SIZE = 10;
/** color.blue, and the default line colour */
const BLUE = '#2962FF';
/** color.new(color.white, 100) */
const NO_COLOR = 'rgba(255, 255, 255, 0)';
/** Text colour of a label that sets none */
const LABEL_TEXT = '#363A45';

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;
/** A number read as a condition: na and 0 are false */
const truthy = (x: number) => !isNaN(x) && Math.abs(x) > EPS;

interface Ln { x1: number; y1: number; x2: number; y2: number; color: string; width?: number; style?: 'dashed'; dead: boolean }
interface Lb {
  x: number; y: number; text: string; color: string; textColor: string; style: LabelStyle; size?: 'small'; dead: boolean;
}
interface Bx { left: number; top: number; right: number; bottom: number; bg: string; dead: boolean }

/** Live drawings of one kind: above max + 5 objects the oldest are deleted until max remain */
class Live<T extends { dead: boolean }> {
  list: T[] = [];
  constructor(private readonly max: number) {}
  add(o: T): T {
    this.list.push(o);
    if (this.list.length > this.max + 5) for (const old of this.list.splice(0, this.list.length - this.max)) old.dead = true;
    return o;
  }
  remove(o: T | null): void {
    if (!o || o.dead) return;
    o.dead = true;
    this.list.splice(this.list.indexOf(o), 1);
  }
  /** A copy with copies of the live objects (`copies`: each object to its copy) */
  clone(copies: Map<T, T>): Live<T> {
    const c = new Live<T>(this.max);
    c.list = this.list.map((o) => {
      const k = { ...o };
      copies.set(o, k);
      return k;
    });
    return c;
  }
}

/** ta.linreg(source, length, offset) on bar i, with the operations of the oakscriptjs array function (same doubles) */
function linregAt(source: number[], i: number, length: number, offset: number): number {
  // a length below 1 throws as ta.linreg does
  if (Math.trunc(length) <= 0) taCore.linreg([], length, offset);
  const len = Math.floor(length);
  if (i < len - 1) return NaN;
  for (let j = 0; j < len; j++) if (isNaN(source[i - j])) return NaN;
  // Least squares as PineScript: x = 1 (oldest) .. len (newest), summed from the oldest value; the intercept is the
  // fitted value at x = 1
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  for (let j = 0; j < len; j++) {
    const x = j + 1;
    const y = source[i - (len - 1 - j)];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }
  const slope = (len * sumXY - sumX * sumY) / (len * sumX2 - sumX * sumX);
  const intercept = sumY / len - (slope * sumX) / len + slope;
  return intercept + slope * (len - 1 - offset);
}

type Result = IndicatorResult & { lines: LineDrawingData[]; labels: LabelData[]; boxes: BoxData[] } & { alerts: AlertConditionState[] };

interface ThirdWaveVars {
  zigzag: number[];
  dir: number;
  prevDir: number;
  canCheckIt: boolean;
  zzline: Ln | null;
  lines: Live<Ln>;
  labels: Live<Lb>;
  boxes: Live<Bx>;
}

interface ThirdWaveRun extends BarRunState<ThirdWaveVars> {
  hh: ReturnType<typeof taStep.highest>;
  ll: ReturnType<typeof taStep.lowest>;
  volume: number[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<ThirdWaveInputs>): BarStudy<ThirdWaveRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { upcol, dncol } = cfg;
  return {
    init() {
      const s: ThirdWaveRun = {
        hh: taStep.highest(), ll: taStep.lowest(), volume: [], flags: [[], []], times: [[], []],
        steps: [],
        vars: {
          zigzag: [], dir: 0, prevDir: NaN, canCheckIt: true, zzline: null,
          lines: new Live<Ln>(MAX_LINES), labels: new Live<Lb>(MAX_LABELS), boxes: new Live<Bx>(MAX_BOXES),
        },
        lists: [], series: [],
      };
      s.steps = [s.hh, s.ll];
      s.lists = s.times;
      s.series = [s.volume, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const { zigzag, lines, labels, boxes } = v;
      const { high, low } = bars[i];
      s.volume[i] = bars[i].volume ?? NaN;
      const oldzigzag = zigzag.slice();
      let longFlag = false;
      let shortFlag = false;

      const addToZigzag = (value: number, bindex: number) => {
        zigzag.unshift(bindex);
        zigzag.unshift(value);
        if (zigzag.length > MAX_ARRAY_SIZE) {
          zigzag.pop();
          zigzag.pop();
        }
      };

      // ta.highestbars(high, prd) == 0 / ta.lowestbars(low, prd) == 0: the bar's value is kept (not na) and is the
      // best of the window (the newest of equal values is this bar), from bar prd - 1
      const hi = s.hh.step(high, cfg.prd);
      const lo = s.ll.step(low, cfg.prd);
      const full = i >= Math.trunc(cfg.prd) - 1;
      // getZigzag()
      const ph = full && Number.isFinite(high) && hi === high ? high : NaN;
      const pl = full && Number.isFinite(low) && lo === low ? low : NaN;
      if (truthy(ph) && isNaN(pl)) v.dir = 1;
      else if (truthy(pl) && isNaN(ph)) v.dir = -1;
      const dir = v.dir;
      const dirChanged = ne(dir, v.prevDir);
      v.prevDir = dir;
      if (truthy(ph) || truthy(pl)) {
        const value = dir === 1 ? ph : pl;
        if (dirChanged) {
          addToZigzag(value, i);
        } else if (zigzag.length === 0) {
          addToZigzag(value, i);
        } else if ((dir === 1 && gt(value, zigzag[0])) || (dir === -1 && lt(value, zigzag[0]))) {
          zigzag[0] = value;
          zigzag[1] = i;
        }
      }

      // showZigzag(): a new last leg; the leg before is deleted when it had the same start (the last point moved)
      if (cfg.showzigzag && zigzag.length >= 4 && oldzigzag.length >= 4) {
        if (ne(zigzag[0], oldzigzag[0]) || ne(zigzag[1], oldzigzag[1])) {
          if (eq(zigzag[2], oldzigzag[2]) && eq(zigzag[3], oldzigzag[3])) lines.remove(v.zzline);
          v.zzline = lines.add({
            x1: Math.round(zigzag[1]), y1: zigzag[0], x2: Math.round(zigzag[3]), y2: zigzag[2],
            color: dir === 1 ? upcol : dncol, width: 2, dead: false,
          });
        }
      }

      // ta.linreg(volume, len, 0) - ta.linreg(volume, len, 1) with a length that changes with the zigzag: ta.linreg
      // keeps no state, so its value on bar i with length L is the value of the fixed-length series of length L on
      // bar i; it is only computed on the bars that read it (a breakout)
      const volSupport = () => {
        if (!cfg.checkvolSupport) return true;
        const len = zigzag.length >= 8 ? i - Math.round(zigzag[7]) : 1;
        return gt(linregAt(s.volume, i, len, 0) - linregAt(s.volume, i, len, 1), 0);
      };
      if (dirChanged) v.canCheckIt = true;

      // A possible 3rd wave: breakout of the end of wave 1 after a retracement inside the range
      if (zigzag.length >= 8 && v.canCheckIt) {
        const w12 = Math.abs(zigzag[2] - zigzag[4]) / Math.abs(zigzag[4] - zigzag[6]);
        if (ge(w12, cfg.retRateMin) && le(w12, cfg.retRateMax)
          && ((dir === 1 && gt(high, zigzag[4])) || (dir === -1 && lt(low, zigzag[4])))) {
          v.canCheckIt = false;
          if (volSupport()) {
            // thereisbo := true: alertcondition(thereisbo and dir == 1) / alertcondition(thereisbo and dir == -1)
            longFlag = dir === 1;
            shortFlag = dir === -1;
            const x7 = Math.round(zigzag[7]);
            const x5 = Math.round(zigzag[5]);
            const x3 = Math.round(zigzag[3]);
            if (cfg.showbo) {
              boxes.add({ left: x7, top: zigzag[4], right: i, bottom: zigzag[6], bg: dir === 1 ? cfg.bupcol : cfg.bdncol, dead: false });
            }
            if (cfg.showwave12) {
              lines.add({ x1: x7, y1: zigzag[6], x2: x5, y2: zigzag[4], color: BLUE, dead: false });
              lines.add({ x1: x5, y1: zigzag[4], x2: x3, y2: zigzag[2], color: BLUE, dead: false });
              const a: LabelStyle = dir === 1 ? 'label_up' : 'label_down';
              const b: LabelStyle = dir === 1 ? 'label_down' : 'label_up';
              labels.add({ x: x7, y: zigzag[6], text: '0', color: NO_COLOR, textColor: BLUE, style: a, dead: false });
              labels.add({ x: x5, y: zigzag[4], text: '1', color: NO_COLOR, textColor: BLUE, style: b, dead: false });
              labels.add({ x: x3, y: zigzag[2], text: '2', color: NO_COLOR, textColor: BLUE, style: a, dead: false });
            }
            labels.add({
              x: i, y: zigzag[6], text: '', color: dir === 1 ? upcol : dncol, textColor: LABEL_TEXT,
              style: dir === 1 ? 'triangleup' : 'triangledown', size: 'small', dead: false,
            });

            const base = zigzag[2];
            const wave1 = Math.abs(zigzag[4] - zigzag[6]);
            const target = (enabled: boolean, ret: number) => {
              if (!enabled) return;
              const y = Math.max(base + dir * wave1 * ret, 0);
              lines.add({ x1: i, y1: y, x2: x7, y2: y, color: BLUE, style: 'dashed', dead: false });
            };
            target(cfg.target1Enb, cfg.target1Ret);
            target(cfg.target2Enb, cfg.target2Ret);
            target(cfg.target3Enb, cfg.target3Ret);
            target(cfg.target4Enb, cfg.target4Ret);
          }
        }
      }
      [longFlag, shortFlag].forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(bars[i].time as number);
      });
    },
    copyVars: (v) => {
      const lineCopies = new Map<Ln, Ln>();
      const lines = v.lines.clone(lineCopies);
      return {
        zigzag: v.zigzag.slice(),
        dir: v.dir,
        prevDir: v.prevDir,
        canCheckIt: v.canCheckIt,
        // a deleted line is not in the list: deleting it again does nothing, as for no line
        zzline: v.zzline ? lineCopies.get(v.zzline) ?? null : null,
        lines,
        labels: v.labels.clone(new Map()),
        boxes: v.boxes.clone(new Map()),
      };
    },
    result(s, bars) {
      const n = bars.length;
      const { lines, labels, boxes } = s.vars;
      const interval = barInterval(bars);
      const T = (index: number) => barTime(bars, index, interval);
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        lines: lines.list.map((l) => ({
          time1: T(l.x1), price1: l.y1, time2: T(l.x2), price2: l.y2, color: l.color,
          ...(l.width ? { width: l.width } : {}),
          ...(l.style ? { style: l.style } : {}),
        })),
        labels: labels.list.map((l) => ({
          time: T(l.x), price: l.y, text: l.text, color: l.color, textColor: l.textColor, style: l.style,
          ...(l.size ? { size: l.size } : {}),
        })),
        boxes: boxes.list.map((b) => ({
          time1: T(b.left), price1: b.top, time2: T(b.right), price2: b.bottom,
          bgColor: b.bg, borderColor: BLUE, borderWidth: 1, borderStyle: 'dotted' as const,
        })),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ThirdWaveInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<ThirdWaveInputs> = {},
): IndicatorResult & { lines: LineDrawingData[]; labels: LabelData[]; boxes: BoxData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Breakout Long', message: 'Breakout Long' },
  { id: 'alert1', title: 'Breakout Short', message: 'Breakout Short' },
];

export const ThirdWave = { calculate, createRun, metadata,
 defaultInputs, inputConfig, plotConfig, alertConditions };
