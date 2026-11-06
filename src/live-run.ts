/**
 * Live runs (#23): a study that calculates only the newest bars when the forming bar changes or new bars arrive.
 *
 * A study written bar by bar ({@link BarStudy}) gets a run from {@link createBarRun}: the first update calculates every
 * bar; an update whose bars equal the previous ones up to the forming bar of the previous update calculates again from
 * that bar only, from the state kept at the end of the last confirmed bar. The result equals a full run on the same
 * bars. Any other change (history loaded or adjusted, fewer bars, other chart fields) runs the study in full.
 */
import type { Bar } from 'oakscriptjs';
import type { ChartContext } from './chart-context';

/** One state machine stepped once or more per bar and committed when the bar is final (oakscriptjs `taStep`) */
export interface Committable {
  commit(): void;
}

/** A study calculated again on each update of the chart bars. */
export interface IndicatorRun<R = any> {
  /**
   * The study on `bars`. `from`: the first bar calculated (the forming bar of the previous update for a resumed
   * update, 0 for a full run); the outputs of the bars before it are the ones of the previous update.
   */
  update(bars: Bar[], chart?: ChartContext): R & { from: number };
  /** Why the updates are full runs with these inputs and chart (null: resumed) */
  readonly fullRunReason: string | null;
}

/**
 * The state of a study calculated bar by bar.
 * - `steps`: the `taStep` machines (and other {@link Committable}s): committed by the run after each confirmed bar
 * - `lists`: outputs that grow by bar (markers, background colours...): cut back to their length at the last
 *   confirmed bar before the forming bar is calculated again
 * - `vars`: the study's own variables (PineScript `var` and the values of earlier bars): copied at the end of the last
 *   confirmed bar (a shallow copy: replace an array or object value rather than changing it, or give `copyVars`)
 * - `series`: outputs with one value per bar, indexed by bar (written again from the forming bar)
 */
export interface BarRunState<V extends object = Record<string, unknown>> {
  steps: Committable[];
  lists: unknown[][];
  vars: V;
  series: unknown[][];
}

/** A study calculated one bar at a time (see {@link createBarRun}). */
export interface BarStudy<S extends BarRunState<any>, R> {
  /** The state before the first bar: machines, own variables, empty outputs */
  init(bars: Bar[], chart: ChartContext): S;
  /** Calculates bar `i` (the bars after it are not read; `bars[i]` may be the forming bar) */
  bar(s: S, i: number, bars: Bar[]): void;
  /** The result from the outputs of every bar */
  result(s: S, bars: Bar[], chart: ChartContext): R;
  /** Copy of `s.vars` (default: a shallow copy) */
  copyVars?(vars: S['vars']): S['vars'];
  /**
   * Why the study runs in full on every update with these inputs and chart (null or undefined: resumed): a feature
   * that depends on the bar count, the clock or other data
   */
  fullRunReason?(chart: ChartContext): string | null | undefined;
  /**
   * What the study reads from the whole set of bars before the first one (the chart timeframe from the bar gaps, the
   * time unit...): an update whose key differs from the previous one runs in full
   */
  key?(bars: Bar[], chart: ChartContext): string;
}

/** Chart context fields that only describe the last bar (barstate of the forming bar): they do not change the history */
const LAST_BAR_FIELDS = new Set(['lastBarConfirmed', 'lastBarNew', 'realtime', 'now']);

function sameChart(a: ChartContext, b: ChartContext): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (LAST_BAR_FIELDS.has(k)) continue;
    if (!Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  }
  return true;
}

const FIELDS = 6;

/** The values of bars `from..n-1` in `copy` (grown when needed) */
function copyBars(bars: readonly Bar[], n: number, copy: Float64Array, from: number): Float64Array {
  let values = copy;
  if (values.length < n * FIELDS) {
    values = new Float64Array(Math.max(16, n * 2) * FIELDS);
    values.set(copy.subarray(0, from * FIELDS));
  }
  for (let i = from; i < n; i++) {
    const b = bars[i]!;
    const o = i * FIELDS;
    values[o] = b.time as number;
    values[o + 1] = b.open;
    values[o + 2] = b.high;
    values[o + 3] = b.low;
    values[o + 4] = b.close;
    values[o + 5] = b.volume ?? NaN;
  }
  return values;
}

/** Bars `0..count-1` have the values of `copy` (NaN equal to NaN) */
function sameBars(copy: Float64Array, bars: readonly Bar[], count: number): boolean {
  for (let i = 0; i < count; i++) {
    const b = bars[i]!;
    const o = i * FIELDS;
    if (
      !Object.is(copy[o], b.time as number) || !Object.is(copy[o + 1], b.open) || !Object.is(copy[o + 2], b.high) ||
      !Object.is(copy[o + 3], b.low) || !Object.is(copy[o + 4], b.close) || !Object.is(copy[o + 5], b.volume ?? NaN)
    ) {
      return false;
    }
  }
  return true;
}

/**
 * A run of a study written bar by bar. Each update calculates the bars from the forming bar of the previous update
 * when the bars before it are unchanged, else every bar.
 */
export function createBarRun<S extends BarRunState<any>, R>(study: BarStudy<S, R>, chart: ChartContext = {}): IndicatorRun<R> {
  let state: S | null = null;
  let lastChart: ChartContext = chart;
  /** Bars final in `state` (the last update's bars but its last one) */
  let confirmed = 0;
  let copy: Float64Array = new Float64Array(0);
  /** The state at the end of bar `confirmed - 1` */
  let saved: { vars: S['vars']; lists: number[] } | null = null;
  const copyVars = study.copyVars ?? ((v: S['vars']) => ({ ...v }));
  let lastKey: string | undefined;

  return {
    get fullRunReason() {
      return study.fullRunReason?.(lastChart) ?? null;
    },
    update(bars: Bar[], next: ChartContext = lastChart) {
      const n = bars.length;
      const key = study.key?.(bars, next);
      const resume =
        state !== null && saved !== null && n > confirmed && key === lastKey && sameChart(lastChart, next) &&
        !study.fullRunReason?.(next) && sameBars(copy, bars, confirmed);
      lastChart = next;
      lastKey = key;
      let from: number;
      if (resume) {
        const s = state!;
        s.vars = copyVars(saved!.vars);
        s.lists.forEach((list, k) => { list.length = saved!.lists[k]!; });
        from = confirmed;
      } else {
        state = study.init(bars, next);
        confirmed = 0;
        from = 0;
      }
      const s = state!;
      try {
        for (let i = from; i < n; i++) {
          if (i === n - 1) {
            // the end of the last confirmed bar, put back before the forming bar is calculated again
            saved = { vars: copyVars(s.vars), lists: s.lists.map((l) => l.length) };
            confirmed = i;
          }
          study.bar(s, i, bars);
          if (i < n - 1) for (const m of s.steps) m.commit();
        }
        if (n === 0) {
          saved = { vars: copyVars(s.vars), lists: s.lists.map((l) => l.length) };
          confirmed = 0;
        }
        for (const out of s.series) out.length = n;
        copy = copyBars(bars, confirmed, copy, Math.min(from, confirmed));
        return Object.assign(study.result(s, bars, next) as object, { from }) as R & { from: number };
      } catch (e) {
        // a runtime error of the study (as calculate gives it): the state is incomplete, the next update runs in full
        state = null;
        saved = null;
        throw e;
      }
    },
  };
}

/** The result of a run without its `from` (the result of `calculate`) */
export function fullResult<R extends { from: number }>(r: R): Omit<R, 'from'> {
  const { from: _from, ...rest } = r;
  return rest;
}

/** The bar sources a live run reads from the bars (another study's output is not one: it is not in the bars) */
const BAR_SOURCES = new Set(['open', 'high', 'low', 'close', 'hl2', 'hlc3', 'ohlc4', 'hlcc4', 'volume']);

/** True when `src` is read from the bars (a source input that is not the output of another study) */
export function isBarSource(src: string): boolean {
  return BAR_SOURCES.has(src);
}

/** The value of a bar source on one bar, with the operations of oakscriptjs `getSourceSeries` (same doubles) */
export function barSource(src: string): (b: Bar) => number {
  switch (src) {
    case 'open': return (b) => b.open;
    case 'high': return (b) => b.high;
    case 'low': return (b) => b.low;
    case 'hl2': return (b) => (b.high + b.low) / 2;
    case 'hlc3': return (b) => (b.high + b.low + b.close) / 3;
    case 'ohlc4': return (b) => (b.open + b.high + b.low + b.close) / 4;
    case 'hlcc4': return (b) => (b.high + b.low + b.close * 2) / 4;
    case 'volume': return (b) => b.volume ?? NaN;
    default: return (b) => b.close;
  }
}

/**
 * `ta.pivothigh(source, left, right)` / `ta.pivotlow` with constant lengths, one bar at a time: the non-na values kept
 * with their bar, the window is the last `left + right + 1` of them, the highest (lowest) the newest of equal values,
 * a pivot when it is on the bar `right` bars back (the rules of the oakscriptjs array function; no taStep machine yet,
 * oakscriptjs #202).
 */
export class PivotStep implements Committable {
  private values: number[] = [];
  private bars: number[] = [];
  private pending: { value: number; bar: number } | null = null;

  constructor(private readonly left: number, private readonly right: number, private readonly isHigh: boolean) {}

  /** The pivot found on bar `bar` (its value, else NaN) */
  step(bar: number, value: number): number {
    const kept = value !== undefined && value !== null && Number.isFinite(value);
    this.pending = kept ? { value, bar } : null;
    const left = Math.trunc(this.left);
    const right = Math.trunc(this.right);
    const count = this.values.length + (kept ? 1 : 0);
    if (!(bar >= left + right) || count === 0) return NaN;
    const at = (j: number) => (j === this.values.length ? value : this.values[j]!);
    const barAt = (j: number) => (j === this.values.length ? bar : this.bars[j]!);
    const k = count - 1;
    let best = k;
    for (let j = k - 1; j >= 0 && j >= k - left - right; j--) {
      if (this.isHigh ? at(j) > at(best) : at(j) < at(best)) best = j;
    }
    return barAt(best) === bar - right ? at(best) : NaN;
  }

  commit(): void {
    if (this.pending) {
      this.values.push(this.pending.value);
      this.bars.push(this.pending.bar);
      const keep = Math.trunc(this.left) + Math.trunc(this.right) + 1;
      if (this.values.length > keep * 2 + 64) {
        this.values = this.values.slice(-keep);
        this.bars = this.bars.slice(-keep);
      }
    }
    this.pending = null;
  }
}

/** The `alerts` of a result from per-bar flags kept by a live run: one list of times per condition (lists of the run) */
export function liveAlertStates<D extends { id: string; title: string; message?: string }>(
  decls: D[],
  times: number[][],
  lastFlags: boolean[],
): Array<D & { triggered: boolean; times: number[] }> {
  return decls.map((d, k) => ({ ...d, triggered: !!lastFlags[k], times: times[k]!.slice() }));
}

// ── Fast steps with a constant length (the doubles of taStep / taCore; taStep is slower for these, oakScriptJS #204) ──

/**
 * `ta.highest(source, length)` / `ta.lowest` with a constant length, one bar at a time, in constant time per bar (a
 * queue of the values that can still be the extreme): the extreme of the last `length` non-na values, na before bar
 * `length - 1`; +0 wins over -0 for the highest, -0 for the lowest (the doubles of taStep.highest / lowest).
 */
export class WindowExtreme implements Committable {
  private vals: number[] = [];
  private ids: number[] = [];
  private head = 0;
  /** Non-na values committed */
  private kept = 0;
  private bars = 0;
  private pending = NaN;
  private stepped = false;
  private readonly len: number;

  constructor(private readonly lowest: boolean, length: number) {
    this.len = Math.trunc(length);
  }

  /** `b` (newer) replaces `a` in the queue: it is as extreme (the preferred zero is kept) */
  private replaces(a: number, b: number): boolean {
    if (this.lowest) return a > b || (a === b && !(Object.is(a, -0) && Object.is(b, 0)));
    return a < b || (a === b && !(Object.is(a, 0) && Object.is(b, -0)));
  }

  step(value: number): number {
    this.stepped = true;
    this.pending = value;
    const own = Number.isFinite(value);
    const total = this.kept + (own ? 1 : 0);
    if (this.bars < this.len - 1 || total === 0) return NaN;
    const from = total - this.len;
    let h = this.head;
    while (h < this.ids.length && this.ids[h]! < from) h++;
    if (h >= this.ids.length) return value;
    const q = this.vals[h]!;
    if (!own) return q;
    return this.lowest ? Math.min(q, value) : Math.max(q, value);
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.bars++;
    const v = this.pending;
    if (!Number.isFinite(v)) return;
    const id = this.kept++;
    while (this.vals.length > this.head && this.replaces(this.vals[this.vals.length - 1]!, v)) {
      this.vals.pop();
      this.ids.pop();
    }
    this.vals.push(v);
    this.ids.push(id);
    // the values out of the window of the next bars
    while (this.ids[this.head]! < this.kept - this.len) this.head++;
    if (this.head > 1024 && this.head * 2 > this.ids.length) {
      this.vals = this.vals.slice(this.head);
      this.ids = this.ids.slice(this.head);
      this.head = 0;
    }
  }
}

/**
 * `math.sum(source, length)` with a constant length, one bar at a time: the correctly rounded sum of the last `length`
 * non-na values (exact partials, as the oakscriptjs window sums: the same doubles), the previous result on a bar with
 * an na value. The kept partials are copied into a second buffer on a step (no allocation per bar).
 */
export class WindowSum implements Committable {
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
export class WindowSma extends WindowSum {
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
export class WindowStdev implements Committable {
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
