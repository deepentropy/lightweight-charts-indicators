/**
 * Packed series (#29): the per-bar outputs of a live run held as numbers. A run keeps one `{ time, value }` object per
 * bar and per plot in `s.series`; a host that keeps runs alive between updates holds them all. In packed mode (off by
 * default, set by the host with {@link setPackedSeries} before it makes a run) the lists of `s.series` the study writes
 * through a field of its state are packed lists.
 *
 * A packed list reads and writes as the array it stands for (`Array.isArray`, length, index, `push`, the Array
 * methods, iteration). It holds plot points (`{ time, value, ... }`: time and value in two Float64Arrays, the other
 * fields in a list each) or plain numbers (one Float64Array), as its first value is; a value of another kind turns it
 * into a plain list, so every value reads back as it was written, its fields in the same order. `slice()` gives a packed copy (a study's `result()` slices its outputs on
 * every update). {@link packedColumns} gives the columns of a list of points, to send it to another thread.
 */

type Point = { time: number; value: number; [field: string]: unknown };

/** The columns of a packed list of points (its first `n` entries). */
export interface PackedColumns {
  n: number;
  time: Float64Array;
  value: Float64Array;
  /** The other fields of the points, by name (undefined where a point has none). */
  extra: Record<string, unknown[]>;
}

// Shared by every copy of the module (the package's entries bundle it each): a list one makes, another reads.
const PACKED = Symbol.for('lightweight-charts-indicators/packed-series');

/** A plot point: a plain object whose first fields are a numeric `time` and `value` (it reads back with its fields in
 *  the same order). */
function isPoint(p: unknown): p is Point {
  if (p === null || typeof p !== 'object' || Array.isArray(p) || Object.getPrototypeOf(p) !== Object.prototype) return false;
  let k = 0;
  for (const f in p) {
    if (k === 0 && f !== 'time') return false;
    if (k === 1) return f === 'value' && typeof (p as Point).time === 'number' && typeof (p as Point).value === 'number';
    k++;
  }
  return false;
}

class Columns implements PackedColumns {
  /** What the list holds: decided by its first value; `any` keeps them in `items`. */
  kind: 'none' | 'points' | 'numbers' | 'any' = 'none';
  n = 0;
  time: Float64Array;
  value: Float64Array;
  /** 1 where an entry is set (an index past the others leaves holes). */
  has: Uint8Array;
  extra: Record<string, unknown[]> = {};
  items: unknown[] = [];

  constructor(capacity: number) {
    const cap = Math.max(16, capacity);
    this.time = new Float64Array(cap);
    this.value = new Float64Array(cap);
    this.has = new Uint8Array(cap);
  }

  private grow(size: number): void {
    if (size <= this.value.length) return;
    const cap = Math.max(size, this.value.length + (this.value.length >> 1));
    const t = new Float64Array(cap);
    t.set(this.time.subarray(0, this.n));
    const v = new Float64Array(cap);
    v.set(this.value.subarray(0, this.n));
    const h = new Uint8Array(cap);
    h.set(this.has.subarray(0, this.n));
    this.time = t;
    this.value = v;
    this.has = h;
  }

  get(i: number): unknown {
    if (this.kind === 'any') return this.items[i];
    if (i >= this.n || !this.has[i]) return undefined;
    if (this.kind === 'numbers') return this.value[i];
    const p: Point = { time: this.time[i]!, value: this.value[i]! };
    for (const k in this.extra) {
      const x = this.extra[k]![i];
      if (x !== undefined) p[k] = x;
    }
    return p;
  }

  /** Every entry as it was written, in a plain list (the kinds no longer hold the next value). */
  private toAny(): void {
    const items: unknown[] = new Array(this.n);
    for (let i = 0; i < this.n; i++) if (this.has[i]) items[i] = this.get(i);
    this.kind = 'any';
    this.items = items;
    this.time = new Float64Array(0);
    this.value = new Float64Array(0);
    this.has = new Uint8Array(0);
    this.extra = {};
  }

  set(i: number, p: unknown): void {
    if (this.kind === 'none' && p !== undefined) this.kind = isPoint(p) ? 'points' : typeof p === 'number' ? 'numbers' : 'any';
    const fits = this.kind === 'any' || p === undefined || (this.kind === 'points' ? isPoint(p) : typeof p === 'number');
    if (!fits) this.toAny();
    if (this.kind === 'any') {
      this.items[i] = p;
      if (i >= this.n) this.n = i + 1;
      return;
    }
    if (i >= this.n) {
      this.grow(i + 1);
      this.has.fill(0, this.n, i);
      this.n = i + 1;
    }
    this.has[i] = p === undefined ? 0 : 1;
    for (const k in this.extra) {
      const list = this.extra[k]!;
      if (i < list.length) list[i] = undefined;
    }
    if (p === undefined) return;
    if (this.kind === 'numbers') {
      this.value[i] = p as number;
      return;
    }
    const q = p as Point;
    this.time[i] = q.time;
    this.value[i] = q.value;
    for (const k in q) {
      if (k === 'time' || k === 'value') continue;
      const x = q[k];
      if (x !== undefined) (this.extra[k] ??= [])[i] = x;
    }
  }

  setLength(len: number): void {
    if (this.kind === 'any') {
      this.items.length = len;
      this.n = len;
      return;
    }
    if (len < this.n) {
      for (const k in this.extra) {
        const list = this.extra[k]!;
        if (list.length > len) list.length = len;
      }
    } else if (len > this.n) {
      this.grow(len);
      this.has.fill(0, this.n, len);
    }
    this.n = len;
  }

  /** Entries [a, b) in new columns. */
  copy(a: number, b: number): Columns {
    const out = new Columns(Math.max(0, b - a));
    out.kind = this.kind;
    out.n = Math.max(0, b - a);
    if (this.kind === 'any') {
      out.items = this.items.slice(a, b);
      return out;
    }
    out.time.set(this.time.subarray(a, b));
    out.value.set(this.value.subarray(a, b));
    out.has.set(this.has.subarray(a, b));
    for (const k in this.extra) out.extra[k] = this.extra[k]!.slice(a, b);
    return out;
  }
}

const isIndex = (p: string | symbol): p is string => typeof p === 'string' && p !== '' && String(+p >>> 0) === p;

/** Array.prototype.slice's start / end. */
function bound(x: unknown, n: number, fallback: number): number {
  if (x === undefined) return fallback;
  const v = Math.trunc(Number(x)) || 0;
  return v < 0 ? Math.max(0, n + v) : Math.min(v, n);
}

const read = (cols: Columns, i: number): unknown => cols.get(i);

function view(cols: Columns): unknown[] {
  const slice = (start?: unknown, end?: unknown) => {
    const a = bound(start, cols.n, 0);
    return view(cols.copy(a, Math.max(a, bound(end, cols.n, cols.n))));
  };
  return new Proxy([] as unknown[], {
    get(target, prop, receiver) {
      if (prop === 'length') return cols.n;
      if (prop === PACKED) return cols;
      if (prop === 'slice') return slice;
      if (isIndex(prop)) return read(cols, +prop);
      return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value) {
      if (prop === 'length') {
        cols.setLength(value as number);
        return true;
      }
      if (isIndex(prop)) {
        cols.set(+prop, value);
        return true;
      }
      return Reflect.set(target, prop, value);
    },
    has(target, prop) {
      if (isIndex(prop)) return +prop < cols.n && (cols.kind === 'any' ? +prop in cols.items : cols.has[+prop] === 1);
      return Reflect.has(target, prop);
    },
    getOwnPropertyDescriptor(target, prop) {
      if (prop === 'length') return { value: cols.n, writable: true, enumerable: false, configurable: false };
      if (isIndex(prop)) {
        const i = +prop;
        const present = i < cols.n && (cols.kind === 'any' ? i in cols.items : cols.has[i] === 1);
        return present ? { value: read(cols, i), writable: true, enumerable: true, configurable: true } : undefined;
      }
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
    ownKeys(target) {
      const keys: (string | symbol)[] = [];
      for (let i = 0; i < cols.n; i++) if (cols.kind === 'any' ? i in cols.items : cols.has[i] === 1) keys.push(String(i));
      for (const k of Reflect.ownKeys(target)) if (!isIndex(k)) keys.push(k);
      return keys;
    },
    deleteProperty(target, prop) {
      if (isIndex(prop)) {
        const i = +prop;
        if (cols.kind === 'any') delete cols.items[i];
        else if (i < cols.n) cols.set(i, undefined);
        return true;
      }
      return Reflect.deleteProperty(target, prop);
    },
  });
}

let packed = false;

/** Packed mode for the live runs made from now on (off by default). */
export function setPackedSeries(on: boolean): void {
  packed = on;
}

/** True in packed mode. */
export function packedSeriesMode(): boolean {
  return packed;
}

/** A packed list of the entries of `list` (a new one, `list` is not changed). */
export function packedSeries<T = Point>(list: readonly unknown[] = []): T[] {
  const cols = new Columns(list.length);
  for (let i = 0; i < list.length; i++) if (i in list) cols.set(i, list[i]);
  cols.setLength(list.length);
  return view(cols) as T[];
}

/** The columns of a packed list of points, null for any other value. */
export function packedColumns(v: unknown): PackedColumns | null {
  if (v === null || typeof v !== 'object' || !Array.isArray(v)) return null;
  const cols = (v as unknown as Record<symbol, Columns | undefined>)[PACKED];
  return cols && cols.kind === 'points' && cols.has.subarray(0, cols.n).every((x) => x === 1) ? cols : null;
}

/** True for a packed list (any kind). */
export const isPackedSeries = (v: unknown): boolean =>
  v !== null && typeof v === 'object' && Array.isArray(v) && (v as unknown as Record<symbol, unknown>)[PACKED] !== undefined;

/** A packed list of points over columns (sent from another thread). */
export function packedFromColumns<T = Point>(c: PackedColumns): T[] {
  const cols = new Columns(0);
  cols.kind = 'points';
  cols.n = c.n;
  cols.time = c.time;
  cols.value = c.value;
  cols.has = new Uint8Array(c.n).fill(1);
  cols.extra = c.extra;
  return view(cols) as T[];
}

/**
 * The run state `s` with its per-bar outputs packed: the lists of `s.series` that are also a field of the state (the
 * study writes through it) replaced by packed lists, in both places. A list reached otherwise (inside another field)
 * is left as it is: the study's writes would not reach a replacement.
 */
export function packRunState<S extends { series: unknown[][] }>(s: S): S {
  const own = s as unknown as Record<string, unknown>;
  const fields = new Map<unknown, string[]>();
  for (const k of Object.keys(own)) {
    if (k === 'series' || !Array.isArray(own[k])) continue;
    const names = fields.get(own[k]);
    if (names) names.push(k);
    else fields.set(own[k], [k]);
  }
  s.series = s.series.map((list) => {
    const names = fields.get(list);
    if (!names || isPackedSeries(list)) return list;
    const p = packedSeries(list);
    for (const k of names) own[k] = p;
    return p;
  });
  return s;
}
