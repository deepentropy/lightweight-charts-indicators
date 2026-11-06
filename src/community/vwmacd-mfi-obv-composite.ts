/**
 * MACD with MFI & OBV (VWMACD-MFI-OBV Composite)
 *
 * A volume-weighted MACD: the difference of a fast and a slow VWMA of the close, with an EMA (or SMA) signal line.
 * The background is green when the MACD is above its signal, red otherwise. The Money Flow Index of hlc3 is plotted,
 * with the On Balance Volume normalised to 0-100 over the last 100 bars ((obv - lowest) / (highest - lowest)). The
 * combined line is the average of the normalised MACD (same normalisation), the MFI and the normalised OBV.
 * Horizontal lines at 0, at the overbought / oversold inputs, and dotted lines at 20, 80 and 50.
 *
 * Reference: "VWMACD-MFI-OBV Composite" by munair
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © munair; @author Striketarget Development Squad, @copyright Virtuous Finance LLC
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface VwmacdMfiObvCompositeInputs {
  /** Fast VWMA length of the MACD */
  fastLength: number;
  /** Slow VWMA length of the MACD */
  slowLength: number;
  /** Signal line length */
  signalLength: number;
  /** SMA instead of EMA for the signal line */
  smaSignal: boolean;
  /** MFI length */
  mfiLength: number;
  /** MFI overbought level */
  mfiOb: number;
  /** MFI oversold level */
  mfiOs: number;
}

export const defaultInputs: VwmacdMfiObvCompositeInputs = {
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  smaSignal: false,
  mfiLength: 14,
  mfiOb: 80,
  mfiOs: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'MACD Fast Length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'MACD Slow Length', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'MACD Signal Smoothing', defval: 9, min: 1 },
  { id: 'smaSignal', type: 'bool', title: 'Simple MA (Signal Line)', defval: false },
  { id: 'mfiLength', type: 'int', title: 'MFI Length', defval: 14, min: 1 },
  { id: 'mfiOb', type: 'int', title: 'MFI Overbought', defval: 80, min: 50, max: 100 },
  { id: 'mfiOs', type: 'int', title: 'MFI Oversold', defval: 20, min: 0, max: 50 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MFI', color: color.purple, lineWidth: 2 },
  { id: 'plot1', title: 'Combined', color: color.yellow, lineWidth: 2 },
  { id: 'plot2', title: 'OBV', color: color.white, lineWidth: 1 },
];

export const metadata = {
  title: 'MACD with MFI & OBV',
  shortTitle: 'MACD-MFI-OBV',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const finite = (x: number) => (Number.isFinite(x) ? x : NaN);

/**
 * `ta.highest(x, length)` / `ta.lowest(x, length)` with a constant length, one bar at a time (the doubles of the
 * `taStep` machines): the extreme of the last `length` finite values, na before bar `length - 1`; a monotonic queue
 * instead of a scan of the window (+0 wins over -0 for the highest, -0 for the lowest, as Math.max / Math.min).
 */
class WindowExtreme implements Committable {
  private vals: number[] = [];
  private idx: number[] = [];
  private head = 0;
  /** Finite values committed */
  private count = 0;
  /** Bars committed */
  private bars = 0;
  private pending = NaN;
  private stepped = false;

  constructor(private readonly length: number, private readonly lowest: boolean) {}

  /** `a` beats or replaces `b` at the back of the queue */
  private beats(a: number, b: number): boolean {
    if (this.lowest) return a < b || (a === b && !(Object.is(b, -0) && Object.is(a, 0)));
    return a > b || (a === b && !(Object.is(b, 0) && Object.is(a, -0)));
  }

  step(value: number): number {
    this.stepped = true;
    this.pending = value;
    const own = Number.isFinite(value);
    if (this.bars < this.length - 1) return NaN;
    // the window: committed values from index `first`
    const first = this.count + (own ? 1 : 0) - this.length;
    let k = this.head;
    while (k < this.idx.length && this.idx[k]! < first) k++;
    const kept = k < this.idx.length ? this.vals[k]! : NaN;
    if (!own) return kept;
    if (Number.isNaN(kept)) return value;
    return this.lowest ? Math.min(kept, value) : Math.max(kept, value);
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.bars++;
    const v = this.pending;
    if (!Number.isFinite(v)) return;
    while (this.idx.length > this.head && this.beats(v, this.vals[this.vals.length - 1]!)) {
      this.vals.pop();
      this.idx.pop();
    }
    this.vals.push(v);
    this.idx.push(this.count);
    this.count++;
    while (this.idx[this.head]! < this.count - this.length) this.head++;
    if (this.head > 1024) {
      this.vals = this.vals.slice(this.head);
      this.idx = this.idx.slice(this.head);
      this.head = 0;
    }
  }
}

/** Non-overlapping partials of an exact sum (Shewchuk), in a typed array with a count */
class Partials {
  p = new Float64Array(32);
  n = 0;

  copyFrom(o: Partials): void {
    if (this.p.length < o.p.length) this.p = new Float64Array(o.p.length);
    this.p.set(o.p.subarray(0, o.n));
    this.n = o.n;
  }

  add(x: number): void {
    const p = this.p;
    const n = this.n;
    let i = 0;
    for (let j = 0; j < n; j++) {
      let y = p[j]!;
      if (Math.abs(x) < Math.abs(y)) {
        const t = x;
        x = y;
        y = t;
      }
      const hi = x + y;
      const lo = y - (hi - x);
      if (lo !== 0) p[i++] = lo;
      x = hi;
    }
    if (i === p.length) {
      const grown = new Float64Array(p.length * 2);
      grown.set(p);
      this.p = grown;
    }
    this.p[i] = x;
    this.n = i + 1;
  }

  /** The exact sum rounded once (round half to even) */
  round(): number {
    const p = this.p;
    let n = this.n;
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
}

/**
 * `math.sum(x, length)` with a constant length, one bar at a time: the correctly rounded sum of the last `length`
 * finite values, NaN while fewer exist; a bar with an na value keeps the previous result (the doubles of the `taStep`
 * sums, without a copy of the state per bar).
 */
class WindowSum implements Committable {
  private values: number[] = [];
  private kept = new Partials();
  private next = new Partials();
  private last = NaN;
  private pendingX = NaN;
  private pendingSum = NaN;
  private stepped = false;

  constructor(private readonly length: number) {}

  step(x: number): number {
    this.stepped = true;
    this.pendingX = x;
    if (!Number.isFinite(x)) return (this.pendingSum = this.last);
    const q = this.next;
    q.copyFrom(this.kept);
    const count = this.values.length;
    if (count >= this.length) q.add(-this.values[count - this.length]!);
    q.add(x);
    return (this.pendingSum = count + 1 >= this.length ? q.round() : NaN);
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.last = this.pendingSum;
    if (!Number.isFinite(this.pendingX)) return;
    const k = this.kept;
    this.kept = this.next;
    this.next = k;
    this.values.push(this.pendingX);
    if (this.values.length > this.length + 4096) this.values = this.values.slice(-this.length);
  }
}

/** `ta.vwma(source, length)` from {@link WindowSum}s: sma(source * volume) / sma(volume), na for a 0 or na average */
class VwmaSum implements Committable {
  private readonly num: WindowSum;
  private readonly den: WindowSum;

  constructor(private readonly length: number) {
    this.num = new WindowSum(length);
    this.den = new WindowSum(length);
  }

  step(value: number, volume: number): number {
    const num = this.num.step(value * volume) / this.length;
    const den = this.den.step(volume) / this.length;
    return den === 0 || Number.isNaN(den) ? NaN : num / den;
  }

  commit(): void {
    this.num.commit();
    this.den.commit();
  }
}

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { bgColors: BgColorData[] };
type Ma = { step(v: number): number; commit(): void };

interface VwmacdRun extends BarRunState<Record<string, never>> {
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<VwmacdMfiObvCompositeInputs>): BarStudy<VwmacdRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const bullBg = String(color.new(color.green, 90));
  const bearBg = String(color.new(color.red, 90));
  let fastMa: VwmaSum;
  let slowMa: VwmaSum;
  let sig: Ma;
  let mfiS: ReturnType<typeof taStep.mfi>;
  let obvS: ReturnType<typeof taStep.obv>;
  let loObv: WindowExtreme;
  let hiObv: WindowExtreme;
  let loMacd: WindowExtreme;
  let hiMacd: WindowExtreme;
  return {
    init() {
      fastMa = new VwmaSum(Math.floor(cfg.fastLength));
      slowMa = new VwmaSum(Math.floor(cfg.slowLength));
      // sma_signal is a constant input: one branch runs on every bar
      if (cfg.smaSignal) {
        const m = taStep.sma();
        sig = { step: (v) => m.step(v, cfg.signalLength), commit: () => m.commit() };
      } else {
        sig = taStep.ema(cfg.signalLength);
      }
      mfiS = taStep.mfi(cfg.mfiLength);
      obvS = taStep.obv();
      loObv = new WindowExtreme(100, true);
      hiObv = new WindowExtreme(100, false);
      loMacd = new WindowExtreme(100, true);
      hiMacd = new WindowExtreme(100, false);
      const s: VwmacdRun = {
        plot0: [], plot1: [], plot2: [], bgColors: [],
        steps: [fastMa, slowMa, sig, mfiS, obvS, loObv, hiObv, loMacd, hiMacd], vars: {}, lists: [], series: [],
      };
      s.lists = [s.bgColors];
      s.series = [s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const volume = b.volume ?? NaN;
      // Volume-weighted MACD
      const macd = fastMa.step(b.close, volume) - slowMa.step(b.close, volume);
      const signal = sig.step(macd);
      // MFI of hlc3
      const mfi = mfiS.step((b.high + b.low + b.close) / 3, volume);
      // norm = 100 * (x - ta.lowest(x, 100)) / (ta.highest(x, 100) - ta.lowest(x, 100)): x / 0 is +-infinity (plot na)
      const obv = obvS.step(b.close, volume);
      const loO = loObv.step(obv);
      const normObv = (100 * (obv - loO)) / (hiObv.step(obv) - loO);
      const loM = loMacd.step(macd);
      const normMacd = (100 * (macd - loM)) / (hiMacd.step(macd) - loM);
      const combined = (normMacd + mfi + normObv) / 3;
      s.plot0[i] = { time, value: finite(mfi), color: color.purple };
      s.plot1[i] = { time, value: finite(combined), color: color.yellow };
      s.plot2[i] = { time, value: finite(normObv), color: color.white };
      s.bgColors.push({ time, color: gt(macd, signal) ? bullBg : bearBg });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        hlines: [
          { value: 0, options: { title: 'Zero Line', color: String(color.new('#787B86', 50)), linestyle: 'dashed' } },
          { value: cfg.mfiOb, options: { title: 'Overbought', color: String(color.new(color.red, 50)), linestyle: 'dashed' } },
          { value: cfg.mfiOs, options: { title: 'Oversold', color: String(color.new(color.green, 50)), linestyle: 'dashed' } },
          { value: 20, options: { title: 'MFI Oversold Line', color: String(color.new(color.green, 50)), linestyle: 'dotted' } },
          { value: 80, options: { title: 'MFI Overbought Line', color: String(color.new(color.red, 50)), linestyle: 'dotted' } },
          { value: 50, options: { title: 'MFI Midpoint', color: String(color.new(color.gray, 70)), linestyle: 'dotted' } },
        ],
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VwmacdMfiObvCompositeInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<VwmacdMfiObvCompositeInputs> = {},
): IndicatorResult & { bgColors: BgColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const VwmacdMfiObvComposite = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
