/**
 * Double Median ATR Bands
 *
 * The median of the source over `medianLength` bars, and two bands: the median of (median +- ATR * multiplier) over
 * round(sqrt(medianLength)) bars. The source crossing over the upper band starts an up trend (blue), crossing under
 * the lower band starts a down trend (purple); before the first signal the lines are white. The area between the
 * bands has the trend colour.
 *
 * Reference: "Double Median ATR Bands | MisinkoMaster" by MisinkoMaster
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © MisinkoMaster
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface DoubleMedianAtrBandsInputs {
  /** Length of the median */
  medianLength: number;
  /** Source of the median */
  src: SourceType;
  /** Length of the Average True Range */
  atrLength: number;
  /** ATR multiplier */
  multiplier: number;
}

export const defaultInputs: DoubleMedianAtrBandsInputs = {
  medianLength: 23,
  src: 'close',
  atrLength: 17,
  multiplier: 1.05,
};

export const inputConfig: InputConfig[] = [
  { id: 'medianLength', type: 'int', title: 'Median Length', defval: 23, min: 2, step: 1, group: 'Median' },
  { id: 'src', type: 'source', title: 'src', defval: 'close', group: 'Median' },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 17, min: 2, step: 1, group: 'ATR' },
  { id: 'multiplier', type: 'float', title: 'ATR Multiplier', defval: 1.05, min: 0.05, step: 0.02, group: 'ATR' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Band', color: color.white, lineWidth: 2 },
  { id: 'plot1', title: 'Lower Band', color: color.white, lineWidth: 2 },
  { id: 'plot2', title: 'Median', color: color.white, lineWidth: 1 },
];

export const metadata = {
  title: 'Double Median ATR Bands | MisinkoMaster',
  shortTitle: 'Double Median ATR Bands',
  overlay: true,
};

/**
 * `ta.median(source, length)` one bar at a time: the sorted window of the oakscriptjs array function changed in place
 * (the same insertions and removals, so the same doubles); a step again on the same bar first undoes the pending one.
 */
class MedianWindow implements Committable {
  private readonly sorted: number[] = [];
  /** Kept (non-na) values committed, from position `base` on */
  private kept: number[] = [];
  private base = 0;
  private count = 0;
  private pending = false;
  private insIdx = -1;
  private remIdx = -1;
  private remVal = NaN;
  private pendVal = NaN;
  private readonly len: number;
  private readonly mid: number;

  constructor(length: number) {
    this.len = Math.floor(length);
    this.mid = Math.floor(this.len / 2);
  }

  /** First position whose value is >= v (`after`: > v) */
  private bound(v: number, after: boolean): number {
    const sorted = this.sorted;
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (after ? sorted[m]! <= v : sorted[m]! < v) lo = m + 1;
      else hi = m;
    }
    return lo;
  }

  private undo(): void {
    if (this.remIdx >= 0) this.sorted.splice(this.remIdx, 0, this.remVal);
    if (this.insIdx >= 0) this.sorted.splice(this.insIdx, 1);
    this.insIdx = -1;
    this.remIdx = -1;
  }

  step(value: number): number {
    if (this.pending) this.undo();
    this.pending = true;
    this.insIdx = -1;
    this.remIdx = -1;
    const len = this.len;
    const sorted = this.sorted;
    let count = this.count;
    if (!(len >= 1)) return NaN;
    if (Number.isFinite(value)) {
      count++;
      // before the equal values: the newest first
      const at = this.bound(value, false);
      sorted.splice(at, 0, value);
      this.insIdx = at;
      // the value leaving the window is the oldest, so the last of its equal values
      if (count > len) {
        const k = count - 1 - len;
        const leaving = k === this.count ? value : this.kept[k - this.base]!;
        const r = this.bound(leaving, true) - 1;
        this.remVal = sorted[r]!;
        sorted.splice(r, 1);
        this.remIdx = r;
      }
      this.pendVal = value;
    }
    if (count < len) return NaN;
    const mid = this.mid;
    return len % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
  }

  commit(): void {
    if (!this.pending) return;
    this.pending = false;
    if (this.insIdx < 0) return;
    this.insIdx = -1;
    this.remIdx = -1;
    this.kept.push(this.pendVal);
    this.count++;
    if (this.kept.length > this.len * 2 + 1024) {
      const drop = this.kept.length - this.len;
      this.kept = this.kept.slice(drop);
      this.base += drop;
    }
  }
}

type Point = { time: number; value: number; color: string };

interface DmVars {
  /** var col = color.white; var colT = color.white */
  col: string;
  colT: string;
}

interface DmRun extends BarRunState<DmVars> {
  median: MedianWindow;
  atr: ReturnType<typeof taStep.atr>;
  upper: MedianWindow;
  lower: MedianWindow;
  longX: ReturnType<typeof taStep.crossover>;
  shortX: ReturnType<typeof taStep.crossunder>;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  fillColors: string[];
}

function study(inputs: Partial<DoubleMedianAtrBandsInputs>): BarStudy<DmRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  // sqrtlen = math.abs(math.round(math.sqrt(medianlen)))
  const sqrtLength = Math.abs(Math.round(Math.sqrt(cfg.medianLength)));
  const upLine = String(color.rgb(0, 175, 255, 10));
  const upFill = String(color.rgb(0, 175, 255, 70));
  const downLine = String(color.rgb(175, 0, 255, 10));
  const downFill = String(color.rgb(175, 0, 255, 70));
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      // the length checks of ta.median (an error for a length <= 0)
      if (!(cfg.medianLength > 0)) taStep.median(cfg.medianLength);
      if (!(sqrtLength > 0)) taStep.median(sqrtLength);
      const s: DmRun = {
        median: new MedianWindow(cfg.medianLength), atr: taStep.atr(cfg.atrLength),
        upper: new MedianWindow(sqrtLength), lower: new MedianWindow(sqrtLength),
        longX: taStep.crossover(), shortX: taStep.crossunder(), plot0: [], plot1: [], plot2: [], fillColors: [],
        steps: [], vars: { col: color.white, colT: color.white }, lists: [], series: [],
      };
      s.steps = [s.median, s.atr, s.upper, s.lower, s.longX, s.shortX];
      s.series = [s.plot0, s.plot1, s.plot2, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const src = value(b);
      const median = s.median.step(src);
      const atr = s.atr.step(b.high, b.low, b.close);
      const upper = s.upper.step(median + atr * cfg.multiplier);
      const lower = s.lower.step(median - atr * cfg.multiplier);

      // L = ta.crossover(src, Upper); S = ta.crossunder(src, Lower) (exact comparisons)
      const l = s.longX.step(src, upper);
      const sh = s.shortX.step(src, lower);
      const v = s.vars;
      if (l && !sh) {
        v.col = upLine;
        v.colT = upFill;
      }
      if (sh) {
        v.col = downLine;
        v.colT = downFill;
      }
      const time = b.time as number;
      s.plot0[i] = { time, value: upper, color: v.col };
      s.plot1[i] = { time, value: lower, color: v.col };
      s.plot2[i] = { time, value: median, color: v.col };
      s.fillColors[i] = v.colT;
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        fills: [{ plot1: 'plot0', plot2: 'plot1', colors: s.fillColors.slice() }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DoubleMedianAtrBandsInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DoubleMedianAtrBandsInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const DoubleMedianAtrBands = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
