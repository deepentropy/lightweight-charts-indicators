/**
 * Ichimoku Score Indicator
 *
 * Ichimoku lines on the price pane (Tenkan Sen, Kijun Sen, Chikou Span drawn `displacement` bars back, Senkou Span A
 * drawn `displacement` bars forward, Senkou Span B drawn 26 bars forward, cloud fill yellow / red) and a score in
 * the indicator pane. The score adds or removes points for: the close against the cloud and the cloud shadow (the
 * highest / lowest cloud of the last `kumoShadowPeriod` bars), Tenkan against Kijun with their position against the
 * cloud and their slopes, the close against the close 26 bars ago (Chikou) with the cloud and the consolidation range
 * of `displacement` bars ago, Span A against Span B with the cloud slopes, and the close against Tenkan and Kijun.
 * An optional SMA smooths the score.
 *
 * Reference: "Ichimoku Score [tanayroy]" by tanayroy
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © tanayroy
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { barInterval, barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface IchimokuScoreIndicatorInputs {
  tenkanSenPeriod: number;
  kijunSenPeriod: number;
  senkouBLen: number;
  displacement: number;
  chikouspanConsolidationBar: number;
  kumoShadowPeriod: number;
  priceKumoScore: number;
  priceKumoShadowScore: number;
  tenkanSenKijunSenScore: number;
  tenkanSenKumoScore: number;
  kijunSenKumoScore: number;
  tenkanSenSlopeScore: number;
  kijunSenSlopeScore: number;
  chikouSpanScore: number;
  chikouKumoScore: number;
  chikouConsolidationScore: number;
  senkouASenkouBScore: number;
  kumoSlopeScore: number;
  priceTenkanScore: number;
  priceKijunScore: number;
  showSmoothLine: boolean;
  smaPeriod: number;
}

export const defaultInputs: IchimokuScoreIndicatorInputs = {
  tenkanSenPeriod: 9,
  kijunSenPeriod: 26,
  senkouBLen: 52,
  displacement: 26,
  chikouspanConsolidationBar: 5,
  kumoShadowPeriod: 252,
  priceKumoScore: 2.0,
  priceKumoShadowScore: 0.5,
  tenkanSenKijunSenScore: 2.0,
  tenkanSenKumoScore: 0.5,
  kijunSenKumoScore: 0.5,
  tenkanSenSlopeScore: 0.5,
  kijunSenSlopeScore: 0.5,
  chikouSpanScore: 2.0,
  chikouKumoScore: 0.5,
  chikouConsolidationScore: 0.5,
  senkouASenkouBScore: 2.0,
  kumoSlopeScore: 0.5,
  priceTenkanScore: 2.0,
  priceKijunScore: 2.0,
  showSmoothLine: false,
  smaPeriod: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'tenkanSenPeriod', type: 'int', title: 'Tenkan Sen Length', defval: 9, min: 1 },
  { id: 'kijunSenPeriod', type: 'int', title: 'Kijun Sen Length', defval: 26, min: 1 },
  { id: 'senkouBLen', type: 'int', title: 'Senkou B Length', defval: 52, min: 1 },
  { id: 'displacement', type: 'int', title: 'Displacement', defval: 26, min: 1 },
  { id: 'chikouspanConsolidationBar', type: 'int', title: 'Chikou Consolidation Bar', defval: 5, min: 1 },
  { id: 'kumoShadowPeriod', type: 'int', title: 'Kumo Shadow Analyzing Period', defval: 252, min: 1 },
  { id: 'priceKumoScore', type: 'float', title: 'Close Vs. Kumo', defval: 2.0 },
  { id: 'priceKumoShadowScore', type: 'float', title: 'Close Vs. Kumo Shadow', defval: 0.5 },
  { id: 'tenkanSenKijunSenScore', type: 'float', title: 'Tenkan Vs. Kijun Score', defval: 2.0 },
  { id: 'tenkanSenKumoScore', type: 'float', title: 'Tenkan Sen Vs. Kumo', defval: 0.5 },
  { id: 'kijunSenKumoScore', type: 'float', title: 'Kijun Sen Vs. Kumo', defval: 0.5 },
  { id: 'tenkanSenSlopeScore', type: 'float', title: 'Tenkan Sen Slope Score', defval: 0.5 },
  { id: 'kijunSenSlopeScore', type: 'float', title: 'Kijun Sen Slope Score', defval: 0.5 },
  { id: 'chikouSpanScore', type: 'float', title: 'Chikou Span Score', defval: 2.0 },
  { id: 'chikouKumoScore', type: 'float', title: 'Chikou Vs. Kumo Score', defval: 0.5 },
  { id: 'chikouConsolidationScore', type: 'float', title: 'Chikou Consolidation Score', defval: 0.5 },
  { id: 'senkouASenkouBScore', type: 'float', title: 'SenkouA Vs. SenkouB', defval: 2.0 },
  { id: 'kumoSlopeScore', type: 'float', title: 'Kumo Slope Score', defval: 0.5 },
  { id: 'priceTenkanScore', type: 'float', title: 'Price Vs. Tenkan Sen Score', defval: 2.0 },
  { id: 'priceKijunScore', type: 'float', title: 'Price Vs. Kijun Sen Score', defval: 2.0 },
  { id: 'showSmoothLine', type: 'bool', title: 'Show Smooth Score Line', defval: false },
  { id: 'smaPeriod', type: 'int', title: 'Smooth Period', defval: 9 },
];

// The five Ichimoku plots: force_overlay = true, display = display.all - display.status_line (drawn on the price pane)
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Tenkan Sen', color: color.red, lineWidth: 1, forceOverlay: true },
  { id: 'plot1', title: 'Kijun Sen', color: color.green, lineWidth: 1, forceOverlay: true },
  { id: 'plot2', title: 'Chikou Span', color: color.purple, lineWidth: 1, forceOverlay: true },
  { id: 'plot3', title: 'Senkou Span A', color: color.blue, lineWidth: 1, forceOverlay: true },
  { id: 'plot4', title: 'Senkou Span B', color: color.maroon, lineWidth: 1, forceOverlay: true },
  { id: 'plot5', title: 'Ichimoku Score Line', color: color.green, lineWidth: 1 },
  { id: 'plot6', title: 'Smooth Score Line', color: color.red, lineWidth: 1 },
];

export const metadata = {
  title: 'Ichimoku Score [tanayroy]',
  shortTitle: 'IchimokuScore[TR]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (a == b within 1e-10); na compares false */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
/** `==`: false with na and with +-infinity */
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

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

type Point = { time: number; value: number; color: string };

interface IchiRun extends BarRunState<Record<string, never>> {
  /** donchian(len): ta.lowest(low) / ta.highest(high) of the Tenkan, Kijun and Senkou B lengths */
  lows: WindowExtreme[];
  highs: WindowExtreme[];
  /** Cloud shadow windows of senkou_a[displacement] / senkou_b[displacement] */
  highestA: WindowExtreme;
  lowestA: WindowExtreme;
  highestB: WindowExtreme;
  lowestB: WindowExtreme;
  smooth: WindowSma;
  tenkan: number[];
  kijun: number[];
  senkouA: number[];
  senkouB: number[];
  plot0: Point[];
  plot1: Point[];
  /** plot(close, offset = -displacement): slot i - displacement, written by bar i */
  plot2: Point[];
  /** plot(senkou_a, offset = displacement) / plot(senkou_b, offset = 26): the point drawn on bar i (of bar i - k) */
  plot3: Point[];
  plot4: Point[];
  plot5: Point[];
  plot6: Point[];
  cloud: string[];
}

function study(inputs: Partial<IchimokuScoreIndicatorInputs>): BarStudy<IchiRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const d = cfg.displacement;
  // for i = displacement - 1 to displacement - chikouspan_consolidation_bar: history offsets of the loops
  const kFrom = Math.min(d - 1, d - cfg.chikouspanConsolidationBar);
  const kTo = Math.max(d - 1, d - cfg.chikouspanConsolidationBar);
  // fill(p1, p2, color = senkou_a > senkou_b ? color.new(color.yellow, 70) : color.new(color.red, 70));
  // the colour of bar i goes with the plot points of bar i
  const bullCloud = String(color.new(color.yellow, 70));
  const bearCloud = String(color.new(color.red, 70));
  const lengths = [cfg.tenkanSenPeriod, cfg.kijunSenPeriod, cfg.senkouBLen];
  return {
    init() {
      if (kFrom < 0) throw new Error('Invalid history reference: negative offset (displacement - chikou consolidation bar < 0)');
      const s: IchiRun = {
        lows: lengths.map((l) => new WindowExtreme(true, l)),
        highs: lengths.map((l) => new WindowExtreme(false, l)),
        highestA: new WindowExtreme(false, cfg.kumoShadowPeriod), lowestA: new WindowExtreme(true, cfg.kumoShadowPeriod),
        highestB: new WindowExtreme(false, cfg.kumoShadowPeriod), lowestB: new WindowExtreme(true, cfg.kumoShadowPeriod),
        smooth: new WindowSma(cfg.smaPeriod),
        tenkan: [], kijun: [], senkouA: [], senkouB: [],
        plot0: [], plot1: [], plot2: [], plot3: [], plot4: [], plot5: [], plot6: [], cloud: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [...s.lows, ...s.highs, s.highestA, s.lowestA, s.highestB, s.lowestB, s.smooth];
      s.series = [
        s.tenkan, s.kijun, s.senkouA, s.senkouB, s.plot0, s.plot1, s.plot2, s.plot3, s.plot4, s.plot5, s.plot6, s.cloud,
      ];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      /** x[k]: na before the first bar */
      const at = (x: number[], j: number) => (j >= 0 ? x[j] : NaN);
      // donchian(len) = math.avg(ta.lowest(len), ta.highest(len))
      const donchian = (k: number) => (s.lows[k].step(b.low) + s.highs[k].step(b.high)) / 2;
      const t = donchian(0);
      const kj = donchian(1);
      const senkouA = (t + kj) / 2;
      const senkouB = donchian(2);
      s.tenkan[i] = t;
      s.kijun[i] = kj;
      s.senkouA[i] = senkouA;
      s.senkouB[i] = senkouB;

      // Cloud shadow: highest / lowest of senkou_a[displacement] and senkou_b[displacement] over kumoShadowPeriod bars
      const aD = at(s.senkouA, i - d);
      const bD = at(s.senkouB, i - d);
      const highestA = s.highestA.step(aD);
      const lowestA = s.lowestA.step(aD);
      const highestB = s.highestB.step(bD);
      const lowestB = s.lowestB.step(bD);

      // ta.change(x) / x: plain divisions
      const slope = (x: number[]) => (i > 0 ? x[i] - x[i - 1] : NaN) / x[i];
      const senkouASlp = slope(s.senkouA);
      const senkouBSlp = slope(s.senkouB);
      const tenkanSlp = slope(s.tenkan);
      const kijunSlp = slope(s.kijun);

      const c = b.close;
      let sc = 0.0;
      const kumoUp = ge(aD, bD) ? aD : bD;
      const kumoDown = ge(aD, bD) ? bD : aD;
      const highestCloud = ge(highestA, highestB) ? highestA : highestB;
      const lowestCloud = le(lowestA, lowestB) ? lowestA : lowestB;
      const a2d = at(s.senkouA, i - 2 * d);
      const b2d = at(s.senkouB, i - 2 * d);
      const kumoUpChikou = ge(a2d, b2d) ? a2d : b2d;
      const highAt = (j: number) => (j >= 0 ? bars[j].high : NaN);
      const lowAt = (j: number) => (j >= 0 ? bars[j].low : NaN);
      let chikouHigh = 0.0;
      let chikouLow = lowAt(i - (d - 1));
      for (let k = kFrom; k <= kTo; k++) {
        chikouHigh = Math.max(highAt(i - k), chikouHigh);
        chikouLow = Math.min(lowAt(i - k), chikouLow);
      }

      // Close vs. kumo and kumo shadow
      if (gt(c, kumoUp)) {
        sc += cfg.priceKumoScore;
        sc = lt(c, highestCloud) ? sc - cfg.priceKumoShadowScore : sc + cfg.priceKumoShadowScore;
      } else if (lt(c, kumoDown)) {
        sc -= cfg.priceKumoScore;
        sc = gt(c, lowestCloud) ? sc + cfg.priceKumoShadowScore : sc - cfg.priceKumoShadowScore;
      }

      // Tenkan vs. Kijun
      if (gt(t, kj)) {
        sc += cfg.tenkanSenKijunSenScore;
        sc = gt(t, kumoUp) ? sc + cfg.tenkanSenKumoScore : sc - cfg.tenkanSenKumoScore;
        sc = gt(kj, kumoUp) ? sc + cfg.kijunSenKumoScore : sc - cfg.kijunSenKumoScore;
        sc = gt(kijunSlp, 0) ? sc + cfg.kijunSenSlopeScore : sc - cfg.kijunSenSlopeScore;
        sc = gt(tenkanSlp, 0) ? sc + cfg.tenkanSenSlopeScore : sc - cfg.tenkanSenSlopeScore;
      } else if (lt(t, kj)) {
        sc -= 2.0; // the Pine script removes a constant 2.0 here (not the input score)
        sc = lt(t, kumoUp) ? sc - cfg.tenkanSenKumoScore : sc + cfg.tenkanSenKumoScore;
        sc = lt(kj, kumoUp) ? sc - cfg.kijunSenKumoScore : sc + cfg.kijunSenKumoScore;
        sc = lt(kijunSlp, 0) ? sc - cfg.kijunSenSlopeScore : sc + cfg.kijunSenSlopeScore;
        sc = lt(tenkanSlp, 0) ? sc - cfg.tenkanSenSlopeScore : sc + cfg.tenkanSenSlopeScore;
      }

      // Chikou: close vs. close[26] (a constant 26 in the Pine script)
      if (gt(c, i - 26 >= 0 ? bars[i - 26].close : NaN)) {
        sc += cfg.chikouSpanScore;
        sc = gt(c, kumoUpChikou) ? sc + cfg.chikouKumoScore : sc - cfg.chikouKumoScore;
        sc = le(c, chikouHigh) ? sc - cfg.chikouConsolidationScore : sc + cfg.chikouConsolidationScore;
      } else {
        sc -= cfg.chikouSpanScore;
        sc = le(c, kumoUpChikou) ? sc - cfg.chikouKumoScore : sc + cfg.chikouKumoScore;
        sc = ge(c, chikouLow) ? sc + cfg.chikouConsolidationScore : sc - cfg.chikouConsolidationScore;
      }

      // Span A vs. Span B and the cloud slopes
      const sa = senkouASlp;
      const sb = senkouBSlp;
      if (gt(senkouA, senkouB)) {
        sc += cfg.senkouASenkouBScore;
        if (gt(sa, 0) && eq(sb, 0)) sc += cfg.kumoSlopeScore;
        else if (lt(sa, 0) && eq(sb, 0)) sc -= cfg.kumoSlopeScore;
        else if (gt(sa, 0) && gt(sb, 0)) sc += cfg.kumoSlopeScore;
        else if (lt(sa, 0) && gt(sb, 0)) sc -= cfg.kumoSlopeScore;
      } else if (lt(senkouA, senkouB)) {
        sc -= cfg.senkouASenkouBScore;
        if (lt(sa, 0) && eq(sb, 0)) sc -= cfg.kumoSlopeScore;
        else if (gt(sa, 0) && eq(sb, 0)) sc += cfg.kumoSlopeScore;
        else if (lt(sa, 0) && lt(sb, 0)) sc -= cfg.kumoSlopeScore;
        else if (gt(sa, 0) && lt(sb, 0)) sc += cfg.kumoSlopeScore;
      }

      // Close vs. Tenkan and Kijun
      sc = gt(c, t) ? sc + cfg.priceTenkanScore : sc - cfg.priceTenkanScore;
      sc = gt(c, kj) ? sc + cfg.priceKijunScore : sc - cfg.priceKijunScore;
      const smooth = s.smooth.step(sc);

      s.plot0[i] = { time, value: t, color: color.red };
      s.plot1[i] = { time, value: kj, color: color.green };
      // plot(close, offset = -displacement): bar i is the only writer of slot i - displacement
      if (i - d >= 0) s.plot2[i - d] = { time: bars[i - d].time, value: c, color: color.purple };
      if (i - d >= 0) s.plot3[i] = { time, value: s.senkouA[i - d], color: color.blue };
      if (i - 26 >= 0) s.plot4[i] = { time, value: s.senkouB[i - 26], color: color.maroon };
      s.plot5[i] = { time, value: sc, color: color.green };
      s.plot6[i] = { time, value: cfg.showSmoothLine ? smooth : NaN, color: color.red };
      s.cloud[i] = gt(senkouA, senkouB) ? bullCloud : bearCloud;
    },
    result(s, bars) {
      const n = bars.length;
      // plot(..., offset = k): the value of bar i is drawn on bar i + k (future bars with barTime)
      const interval = barInterval(bars);
      const forward = (slots: Point[], vals: number[], k: number, col: string) => {
        const out = n > k ? slots.slice(k, n) : [];
        for (let i = Math.max(0, n - k); i < n; i++) out.push({ time: barTime(bars, i + k, interval), value: vals[i], color: col });
        return out;
      };
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plot0.slice(),
          plot1: s.plot1.slice(),
          // plot(close, offset = -displacement)
          plot2: s.plot2.slice(0, Math.max(0, n - d)),
          // plot(senkou_a, offset = displacement); plot(senkou_b, offset = 26)
          plot3: forward(s.plot3, s.senkouA, d, color.blue),
          plot4: forward(s.plot4, s.senkouB, 26, color.maroon),
          plot5: s.plot5.slice(),
          plot6: s.plot6.slice(),
        },
        // hline(0, title = "Score Line"): Pine default colour #787B86, dashed
        hlines: [{ value: 0, options: { title: 'Score Line', color: '#787B86', linestyle: 'dashed' } }],
        fills: [{ plot1: 'plot3', plot2: 'plot4', options: { title: 'Plots Background' }, colors: s.cloud.slice() }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<IchimokuScoreIndicatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<IchimokuScoreIndicatorInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const IchimokuScoreIndicator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
