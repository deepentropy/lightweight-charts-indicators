/**
 * Reversal Correlation Pressure [OmegaTools]
 *
 * Pressure: the z-score of the high / low correlation over `length` bars against its SMA / stdev over 5 * `length`
 * bars, clamped to [0, 2], drawn as columns (gradient colour above 1, grey otherwise). Signals: the close z-score
 * over `length` bars below -2 (long) / above 2 (short). Two rolling backtests (the last 250 outcomes of the signals of
 * 10 bars before, split by the pressure state of that bar: above 1 or not) keep the signal when the pressure state
 * of the current bar has the better win rate: mean reversion (pressure > 1 vs < 1) and trend following (signals
 * reversed, pressure > 1 vs <= 0). The sum of both gives arrows on the price pane (the original's plotarrow with
 * force_overlay, `arrows` of the result, id 'arrow0') and bar colours.
 *
 * Reference: "Reversal Correlation Pressure [OmegaTools]" by OmegaTools
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © OmegaTools
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ArrowData } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface ReversalCorrelationPressureInputs {
  /** Correlation / z-score length */
  length: number;
}

export const defaultInputs: ReversalCorrelationPressureInputs = {
  length: 21,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 21 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Pressure', color: '#2962FF', lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'Reversal Correlation Pressure [OmegaTools]',
  shortTitle: 'Reversal Correlation Pressure [OmegaTools]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;

const UP = '#2962ff';
const DOWN = '#e91e63';
const X = 10;
const MAX_SIZE = 250;

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

/** `ta.stdev(source, length)` (biased) with a constant length, from {@link WindowSum}s of the values and squares */
class WindowStdev implements Committable {
  private readonly sums: WindowSum;
  private readonly squares: WindowSum;
  private readonly len: number;

  constructor(length: number) {
    this.len = Math.floor(length);
    this.sums = new WindowSum(length);
    this.squares = new WindowSum(length);
  }

  /** The biased variance */
  variance(value: number): number {
    const sum = this.sums.step(value);
    const sq = this.squares.step(value === undefined || value === null || !Number.isFinite(value) ? NaN : value * value);
    if (this.len <= 0) return NaN;
    const mean = sum / this.len;
    return sq / this.len - mean * mean;
  }

  step(value: number): number {
    const v = this.variance(value);
    return Number.isNaN(v) ? NaN : v > 0 ? Math.sqrt(v) : 0;
  }

  commit(): void {
    this.sums.commit();
    this.squares.commit();
  }
}

/** `ta.correlation(a, b, length)` with a constant length: cov = sma(a * b) - sma(a) * sma(b), r = cov / sqrt(var(a) * var(b)) */
class WindowCorrelation implements Committable {
  private readonly meanXY: WindowSma;
  private readonly meanX: WindowSma;
  private readonly meanY: WindowSma;
  private readonly varX: WindowStdev;
  private readonly varY: WindowStdev;

  constructor(length: number) {
    this.meanXY = new WindowSma(length);
    this.meanX = new WindowSma(length);
    this.meanY = new WindowSma(length);
    this.varX = new WindowStdev(length);
    this.varY = new WindowStdev(length);
  }

  step(a: number, b: number): number {
    const product = a === null || a === undefined || b === null || b === undefined ? NaN : a * b;
    const mxy = this.meanXY.step(product);
    const cov = mxy - this.meanX.step(a) * this.meanY.step(b);
    const vx = this.varX.variance(a);
    const vy = this.varY.variance(b);
    if (Number.isNaN(cov)) return NaN;
    // a covariance within 1e-10 of 0 gives 0; a zero denominator gives na (a division by zero)
    if (Math.abs(cov) <= 1e-10) return 0;
    const denominator = Math.sqrt(vx * vy);
    return denominator === 0 ? NaN : cov / denominator;
  }

  commit(): void {
    this.meanXY.commit();
    this.meanX.commit();
    this.meanY.commit();
    this.varX.commit();
    this.varY.commit();
  }
}

/** The `var` arrays of one backtester() call site and their sums (of 0 / 1 values: exact) */
interface Backtest {
  c1: number[];
  c2: number[];
  s1: number;
  s2: number;
}

/**
 * backtester(long, short, cond1, cond2, x): one call site (its own `var` arrays) called on every bar.
 * Returns the output (1, -1 or 0) of bar `i`.
 */
function backtester(bt: Backtest, close: number[], i: number, long: boolean[], short: boolean[], cond1: boolean[], cond2: boolean[]): number {
  const j = i - X;
  const push1 = (v: number) => { bt.c1.push(v); bt.s1 += v; };
  const push2 = (v: number) => { bt.c2.push(v); bt.s2 += v; };
  if (j >= 0 && long[j]) {
    if (cond1[j]) push1(gt(close[i], close[j]) ? 1 : 0);
    if (cond2[j]) push2(gt(close[i], close[j]) ? 1 : 0);
  }
  if (j >= 0 && short[j]) {
    if (cond1[j]) push1(lt(close[i], close[j]) ? 1 : 0);
    if (cond2[j]) push2(lt(close[i], close[j]) ? 1 : 0);
  }
  if (bt.c1.length > MAX_SIZE) bt.s1 -= bt.c1.shift()!;
  if (bt.c2.length > MAX_SIZE) bt.s2 -= bt.c2.shift()!;
  // c.sum() / c.size() * 100: na (0 / 0) for an empty array
  const wr1 = (bt.s1 / bt.c1.length) * 100;
  const wr2 = (bt.s2 / bt.c2.length) * 100;
  let output = 0;
  if ((gt(wr1, wr2) && cond1[i]) || (gt(wr2, wr1) && cond2[i])) {
    if (long[i]) output = 1;
    if (short[i]) output = -1;
  }
  return output;
}

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { arrows: ArrowData[]; barColors: BarColorData[] };

interface RcpVars {
  mr: Backtest;
  tf: Backtest;
}

interface RcpRun extends BarRunState<RcpVars> {
  corr: WindowCorrelation;
  corrMean: WindowSma;
  corrDev: WindowStdev;
  mean: WindowSma;
  dev: WindowStdev;
  close: number[];
  long: boolean[];
  short: boolean[];
  zAbove1: boolean[];
  zBelow1: boolean[];
  zLe0: boolean[];
  plot0: Point[];
  arrows: ArrowData[];
  barColors: BarColorData[];
}

const copyBacktest = (b: Backtest): Backtest => ({ c1: b.c1.slice(), c2: b.c2.slice(), s1: b.s1, s2: b.s2 });

function study(inputs: Partial<ReversalCorrelationPressureInputs>): BarStudy<RcpRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const lnt = cfg.length;
  const grey = String(color.new(color.gray, 50));
  const bottom = String(color.new('#1100fc', 30));
  const top = String(color.new('#ee00ff', 0));
  return {
    init() {
      const s: RcpRun = {
        corr: new WindowCorrelation(lnt), corrMean: new WindowSma(lnt * 5), corrDev: new WindowStdev(lnt * 5),
        mean: new WindowSma(lnt), dev: new WindowStdev(lnt),
        close: [], long: [], short: [], zAbove1: [], zBelow1: [], zLe0: [], plot0: [], arrows: [], barColors: [],
        steps: [],
        vars: { mr: { c1: [], c2: [], s1: 0, s2: 0 }, tf: { c1: [], c2: [], s1: 0, s2: 0 } },
        lists: [], series: [],
      };
      s.steps = [s.corr, s.corrMean, s.corrDev, s.mean, s.dev];
      s.lists = [s.arrows, s.barColors];
      s.series = [s.close, s.long, s.short, s.zAbove1, s.zBelow1, s.zLe0, s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const c = b.close;
      s.close[i] = c;
      const corr = s.corr.step(b.high, b.low);
      const corrMean = s.corrMean.step(corr);
      const corrDev = s.corrDev.step(corr);
      // z = math.min(math.max((corr - sma) / stdev, -0), 2): x / 0 is +-infinity (clamped), 0 / 0 is na
      const z = Math.min(Math.max((corr - corrMean) / corrDev, -0), 2);

      const zscore = (c - s.mean.step(c)) / s.dev.step(c);
      s.long[i] = lt(zscore, -2);
      s.short[i] = gt(zscore, 2);
      const zAbove1 = gt(z, 1);
      s.zAbove1[i] = zAbove1;
      s.zBelow1[i] = lt(z, 1);
      s.zLe0[i] = le(z, 0);

      const signalmr = backtester(s.vars.mr, s.close, i, s.long, s.short, s.zAbove1, s.zBelow1);
      const signaltf = backtester(s.vars.tf, s.close, i, s.short, s.long, s.zAbove1, s.zLe0);

      const zcol = zAbove1 ? String(color.from_gradient(z, 1, 2, bottom, top)) : grey;
      // plot(z != 0 ? z : na, 'Pressure', zcol, style = plot.style_columns)
      s.plot0[i] = { time: t, value: ne(z, 0) ? z : NaN, color: zcol };
      const signal = signalmr + signaltf;
      // plotarrow(signal, 'Filtered Signal', #2962ff, #e91e63, 0, 10, 15, force_overlay = true)
      if (signal > 0) {
        s.arrows.push({ time: t, id: 'arrow0', value: signal, color: UP });
        s.barColors.push({ time: t, color: UP });
      } else if (signal < 0) {
        s.arrows.push({ time: t, id: 'arrow0', value: signal, color: DOWN });
        s.barColors.push({ time: t, color: DOWN });
      }
    },
    copyVars: (v) => ({ mr: copyBacktest(v.mr), tf: copyBacktest(v.tf) }),
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        arrows: s.arrows.slice(),
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ReversalCorrelationPressureInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<ReversalCorrelationPressureInputs> = {},
): IndicatorResult & { arrows: ArrowData[]; barColors: BarColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const ReversalCorrelationPressure = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
