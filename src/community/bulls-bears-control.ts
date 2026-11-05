/**
 * CM_TotalConsecutive_Up_Down_V2
 *
 * Histograms of the bars since the close was last above (red, "Price Down") / below (lime, "Price Up") the midpoint
 * (hl2) of the bar before, or the close of the bar before when "Use Midpoint" is off or the midpoint count is 0 / na.
 * Optional lines over the four counts (midpoint and close based, down and up): their highest over a lookback, their
 * standard deviation times a multiple, their moving average (each drawn only where non-zero). A dashed yellow
 * horizontal line at the "Horizontal Line" level.
 *
 * Version 1 plots have a default transparency of 35: the plot colours have an alpha of 0.65.
 *
 * Reference: "CM_TotalConsecutive_Up_Down_V2" by ChrisMoody
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface BullsBearsInputs {
  useMidpoint: boolean;
  showHighestMidpoint: boolean;
  showHighestClose: boolean;
  showStdevMidpoint: boolean;
  showStdevClose: boolean;
  showMaMidpoint: boolean;
  showMaClose: boolean;
  hlength: number;
  lookbackLength: number;
  stdevLength: number;
  stdevMult: number;
  maLength: number;
}

export const defaultInputs: BullsBearsInputs = {
  useMidpoint: true,
  showHighestMidpoint: false,
  showHighestClose: false,
  showStdevMidpoint: false,
  showStdevClose: false,
  showMaMidpoint: false,
  showMaClose: false,
  hlength: 4,
  lookbackLength: 50,
  stdevLength: 50,
  stdevMult: 2,
  maLength: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'useMidpoint', type: 'bool', title: 'Check = Use Midpoint, UnCheck = Use Prev Close', defval: true },
  { id: 'showHighestMidpoint', type: 'bool', title: 'Highest Bar Look Back Period - Using Midpoint?', defval: false },
  { id: 'showHighestClose', type: 'bool', title: 'Highest Bar Look Back Period - Using Close?', defval: false },
  { id: 'showStdevMidpoint', type: 'bool', title: 'Standard Dev - Using Midpoint?', defval: false },
  { id: 'showStdevClose', type: 'bool', title: 'Standard Dev - Using Close?', defval: false },
  { id: 'showMaMidpoint', type: 'bool', title: 'Moving Average - Using Midpoint?', defval: false },
  { id: 'showMaClose', type: 'bool', title: 'Moving Average - Using Close?', defval: false },
  { id: 'hlength', type: 'int', title: 'Horizontal Line', defval: 4, min: 1 },
  { id: 'lookbackLength', type: 'int', title: 'Highest Bar Look Back Period', defval: 50, min: 1 },
  { id: 'stdevLength', type: 'int', title: 'Standard Dev Length', defval: 50, min: 1 },
  { id: 'stdevMult', type: 'int', title: 'Standard Dev Multiple', defval: 2, min: 1 },
  { id: 'maLength', type: 'int', title: 'Moving Average length', defval: 20, min: 1 },
];

// Colour constants of Pine version 1, with the default plot transparency of that version (35)
const V1 = (hex: string) => String(color.new(hex, 35));
const RED = V1('#FF0000');
const LIME = V1('#00FF00');

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Price Down Based On Midpoint or Close', color: RED, lineWidth: 3, style: 'histogram' },
  { id: 'plot1', title: 'Price Up Based On Midpoint or Close', color: LIME, lineWidth: 3, style: 'histogram' },
  { id: 'plot2', title: 'Highest Down Bar Lookback - Midpoint', color: RED, lineWidth: 4 },
  { id: 'plot3', title: 'Highest Up Bar Lookback - Midpoint', color: LIME, lineWidth: 4 },
  { id: 'plot4', title: 'Highest Down Bar Lookback - Close', color: RED, lineWidth: 4 },
  { id: 'plot5', title: 'Highest Up Bar Lookback - Close', color: LIME, lineWidth: 4 },
  { id: 'plot6', title: 'StdDev of Down Bars - Midpoint', color: RED, lineWidth: 4 },
  { id: 'plot7', title: 'StdDev of Up Bars - Midpoint', color: LIME, lineWidth: 4 },
  { id: 'plot8', title: 'StdDev of Down Bars - Close', color: RED, lineWidth: 4 },
  { id: 'plot9', title: 'StdDev of Up Bars - Close', color: LIME, lineWidth: 4 },
  { id: 'plot10', title: 'MA of Down Bars - Midpoint', color: RED, lineWidth: 4 },
  { id: 'plot11', title: 'MA of Up Bars - Midpoint', color: LIME, lineWidth: 4 },
  { id: 'plot12', title: 'MA of Down Bars - Close', color: RED, lineWidth: 4 },
  { id: 'plot13', title: 'MA of Up Bars - Close', color: LIME, lineWidth: 4 },
];

export const metadata = {
  title: 'CM_TotalConsecutive_Up_Down_V2',
  shortTitle: 'CM_TotalConsec_Up_Down_V2',
  overlay: false,
};

/** A number as a Pine version 1 condition: true when not na and not 0 */
const truthy = (v: number) => !isNaN(v) && v !== 0;

/**
 * `ta.highest(source, length)` / `ta.lowest` with a constant length, one bar at a time, in constant time per bar (a
 * queue of the values that can still be the extreme): the extreme of the last `length` non-na values, na before bar
 * `length - 1`; +0 wins over -0 for the highest, -0 for the lowest (the doubles of taStep.highest / lowest).
 */
class WindowExtreme implements Committable {
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

type Point = { time: number; value: number };

interface BbVars {
  /** The bar of the last true condition (barssince), -1 before: down_BarM, up_BarM, down_BarC, up_BarC */
  lastDownM: number;
  lastUpM: number;
  lastDownC: number;
  lastUpC: number;
}

interface BbRun extends BarRunState<BbVars> {
  smas: WindowSma[];
  stdevs: WindowStdev[];
  highests: WindowExtreme[];
  plots: Point[][];
}

function study(inputs: Partial<BullsBearsInputs>): BarStudy<BbRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  // The display toggles of the highest / stdev / MA lines: [midpoint, close]
  const shows = [
    [cfg.showHighestMidpoint, cfg.showHighestClose],
    [cfg.showStdevMidpoint, cfg.showStdevClose],
    [cfg.showMaMidpoint, cfg.showMaClose],
  ];
  return {
    init() {
      const s: BbRun = {
        smas: Array.from({ length: 4 }, () => new WindowSma(cfg.maLength)),
        stdevs: Array.from({ length: 4 }, () => new WindowStdev(cfg.stdevLength)),
        highests: Array.from({ length: 4 }, () => new WindowExtreme(false, cfg.lookbackLength)),
        plots: Array.from({ length: 14 }, () => []),
        steps: [], vars: { lastDownM: -1, lastUpM: -1, lastDownC: -1, lastUpC: -1 }, lists: [], series: [],
      };
      s.steps = [...s.smas, ...s.stdevs, ...s.highests];
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const time = b.time as number;

      // down_BarC = close > close[1]; up_BarC = close < close[1]; down_BarM = close > hl2[1]; up_BarM = close < hl2[1]
      // (na on bar 0: the comparisons are false)
      const prev = i > 0 ? bars[i - 1] : null;
      const hl2Prev = prev ? (prev.high + prev.low) / 2 : NaN;
      if (prev && b.close > hl2Prev) v.lastDownM = i;
      if (prev && b.close < hl2Prev) v.lastUpM = i;
      if (prev && b.close > prev.close) v.lastDownC = i;
      if (prev && b.close < prev.close) v.lastUpC = i;
      // barssince(cond): 0 on a bar where it is true, then +1 per bar; na until it is first true
      const since = (last: number) => (last < 0 ? NaN : i - last);
      const bs = [since(v.lastDownM), since(v.lastUpM), since(v.lastDownC), since(v.lastUpC)];
      const [bsDownM, bsUpM, bsDownC, bsUpC] = bs;

      // plot(dopm and barssince(down_BarM) ? barssince(down_BarM) : barssince(down_BarC))
      const p = s.plots;
      p[0][i] = { time, value: cfg.useMidpoint && truthy(bsDownM) ? bsDownM : bsDownC };
      p[1][i] = { time, value: cfg.useMidpoint && truthy(bsUpM) ? bsUpM : bsUpC };
      // plot(on and x ? x : na)
      const gated = (k: number, on: boolean, x: number) => {
        p[k][i] = { time, value: on && truthy(x) ? x : NaN };
      };
      for (let k = 0; k < 4; k++) {
        const x = bs[k];
        const hb = s.highests[k].step(x);
        const sd = s.stdevs[k].step(x) * cfg.stdevMult;
        const avg = s.smas[k].step(x);
        const close = k >= 2 ? 1 : 0;
        gated(2 + k, shows[0][close], hb);
        gated(6 + k, shows[1][close], sd);
        gated(10 + k, shows[2][close], avg);
      }
    },
    result(s) {
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        // hline(hlength, title="Horizontal Line", linestyle=dashed, linewidth=4, color=yellow)
        hlines: [
          { value: cfg.hlength, options: { color: '#FFFF00', linestyle: 'dashed', linewidth: 4, title: 'Horizontal Line' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BullsBearsInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BullsBearsInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const BullsBears = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
