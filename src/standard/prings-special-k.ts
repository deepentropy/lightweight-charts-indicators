/**
 * Pring's Special K
 *
 * Martin Pring's "Special K" combines short-, intermediate- and long-term
 * smoothed Rate-of-Change values into a single momentum curve, summing twelve
 * SMA-of-ROC terms with ascending weights (1,2,3,4 within each band).
 *
 * Canonical daily parameters (Pring):
 *   ROC:    10  15  20  30 | 40  65  75 100 | 195 265 390 530
 *   SMA:    10  10  10  15 | 50  65  75 100 | 130 130 130 195
 *   weight:  1   2   3   4 |  1   2   3   4 |   1   2   3   4
 *
 * Based on the standard "Pring's Special K" indicator.
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type Committable, type BarStudy, type IndicatorRun } from '../live-run';

export interface PringsSpecialKInputs {
  // Canonical fixed parameters; no user inputs.
}

export const defaultInputs: PringsSpecialKInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Special K', color: '#2962FF', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, color: '#787B86', linestyle: 'dashed', title: 'Zero' },
];

export const metadata = {
  title: "Pring's Special K",
  shortTitle: 'Special K',
  overlay: false,
};

const ROC_LEN = [10, 15, 20, 30, 40, 65, 75, 100, 195, 265, 390, 530];
const SMA_LEN = [10, 10, 10, 15, 50, 65, 75, 100, 130, 130, 130, 195];
const WEIGHT = [1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4];

/**
 * `math.sum(source, length)` with a constant length, one bar at a time: the correctly rounded sum of the last `length`
 * non-na values (exact partials, as the oakscriptjs window sums: the same doubles), the previous result on a bar with
 * an na value. The kept partials are copied into a second buffer on a step (no allocation per bar).
 */
class WindowSum implements Committable {
  private values: number[] = [];
  private p = new Float64Array(16);
  private n = 0;
  private q = new Float64Array(16);
  private qn = 0;
  private last = NaN;
  private next = NaN;
  private pending = NaN;
  private stepped = false;
  private readonly len: number;

  constructor(length: number) {
    this.len = Math.floor(length);
  }

  /** Adds `x` to the partials of `q` exactly (Shewchuk) */
  private add(x: number): void {
    let q = this.q;
    const n = this.qn;
    let i = 0;
    for (let j = 0; j < n; j++) {
      let y = q[j]!;
      if (Math.abs(x) < Math.abs(y)) {
        const t = x;
        x = y;
        y = t;
      }
      const hi = x + y;
      const lo = y - (hi - x);
      if (lo !== 0) q[i++] = lo;
      x = hi;
    }
    if (i === q.length) {
      const grown = new Float64Array(q.length * 2);
      grown.set(q);
      this.q = q = grown;
    }
    q[i] = x;
    this.qn = i + 1;
  }

  /** The exact sum of the partials of `q` rounded once (round half to even) */
  private round(): number {
    const p = this.q;
    let n = this.qn;
    if (n === 0) return 0;
    let hi = p[--n]!;
    while (n > 0) {
      const x = hi;
      const y = p[--n]!;
      hi = x + y;
      const lo = y - (hi - x);
      if (lo !== 0) {
        if (n > 0 && ((lo < 0 && p[n - 1]! < 0) || (lo > 0 && p[n - 1]! > 0))) {
          const y2 = lo * 2;
          const x2 = hi + y2;
          if (y2 === x2 - hi) hi = x2;
        }
        break;
      }
    }
    return hi;
  }

  step(value: number): number {
    this.stepped = true;
    if (!(this.len >= 1)) { this.pending = NaN; this.next = NaN; return NaN; }
    if (value === undefined || value === null || !Number.isFinite(value)) {
      this.pending = NaN;
      this.next = this.last;
      return this.last;
    }
    if (this.q.length < this.p.length) this.q = new Float64Array(this.p.length);
    this.q.set(this.p.subarray(0, this.n));
    this.qn = this.n;
    const count = this.values.length;
    if (count >= this.len) this.add(-this.values[count - this.len]!);
    this.add(value);
    this.pending = value;
    this.next = count + 1 >= this.len ? this.round() : NaN;
    return this.next;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.last = this.next;
    if (Number.isNaN(this.pending)) return;
    const p = this.p;
    this.p = this.q;
    this.n = this.qn;
    this.q = p;
    this.values.push(this.pending);
    if (this.values.length > this.len * 2 + 1024) this.values = this.values.slice(-this.len);
  }
}

/** `ta.sma(source, length)` with a constant length: {@link WindowSum} divided by the length */
class WindowSma extends WindowSum {
  private readonly div: number;

  constructor(length: number) {
    super(length);
    this.div = Math.floor(length);
  }

  override step(value: number): number {
    return super.step(value) / this.div;
  }
}

type Point = { time: number; value: number };

interface SpecialKRun extends BarRunState<Record<string, never>> {
  rocs: ReturnType<typeof taStep.roc>[];
  smas: WindowSma[];
  plotData: Point[];
}

function study(): BarStudy<SpecialKRun, IndicatorResult> {
  return {
    init() {
      const rocs = ROC_LEN.map((len) => taStep.roc(len));
      const smas = SMA_LEN.map((len) => new WindowSma(len));
      const s: SpecialKRun = { rocs, smas, plotData: [], steps: [...rocs, ...smas], vars: {}, lists: [], series: [] };
      s.series = [s.plotData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // Each term = weight * sma(roc(close, rocLen), smaLen)
      let sum = 0;
      for (let k = 0; k < ROC_LEN.length; k++) {
        const v = s.smas[k].step(s.rocs[k].step(b.close));
        if (v == null || isNaN(v)) sum = NaN;
        else sum += WEIGHT[k] * v;
      }
      s.plotData[i] = { time: b.time, value: sum };
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.plotData.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<PringsSpecialKInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(), chart);
}

export function calculate(bars: Bar[], _inputs: Partial<PringsSpecialKInputs> = {}): IndicatorResult {
  return fullResult(createRun(_inputs).update(bars));
}

export const PringsSpecialK = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
