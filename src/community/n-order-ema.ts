/**
 * N Order EMA
 *
 * An EMA of order N built as a recursive IIR filter y[n] = sum b_m x[n-m] - sum a_k y[n-k], with fc = 2 / (period + 1)
 * and r = 1 - fc. Four discretizations: Impulse Matched (a_k = C(N, k)(-r)^k, b_m from the impulse response, DC
 * normalized), All Pole (same a, b = [fc^N, 0, ...]), Matched Z-Transform (same a, b_m = C(N-1, m) fc^N / 2^(N-1)) and
 * Bilinear (K = tan(w/2) with w = 2 / period clamped to (0, pi), q = (K - 1) / (K + 1), a_k = C(N, k) q^k,
 * b_m = C(N, m) (K / (K + 1))^N). The binomial coefficients come from a Lanczos gamma rounded to 8 decimals. The
 * filter starts with the first source value; history before the first bar is the oldest known value. The EMA, DEMA
 * (2 e1 - e2), TEMA (3 (e1 - e2) + e3) or HEMA (EMA of 2 EMA(P/2) - EMA(P) with period max(1, sqrt(P))) of the
 * filter is drawn.
 *
 * Reference: "N Order EMA" by The_Peaceful_Lizard
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © The_Peaceful_Lizard
 */

import { math, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type NOrderEmaStyle = 'ema' | 'dema' | 'hema' | 'tema';
export type NOrderIirStyle = 'All Pole' | 'Impulse Matched' | 'Matched Z-Transform' | 'Bilinear Transform';

export interface NOrderEmaInputs {
  source: SourceType;
  /** Nominal smoothing length */
  period: number;
  /** Filter order (number of recursive sections) */
  order: number;
  emaStyle: NOrderEmaStyle;
  iirStyle: NOrderIirStyle;
}

export const defaultInputs: NOrderEmaInputs = {
  source: 'close',
  period: 9,
  order: 1,
  emaStyle: 'ema',
  iirStyle: 'Impulse Matched',
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'period', type: 'float', title: 'Period', defval: 9, min: 1, step: 0.125 },
  { id: 'order', type: 'int', title: 'Order', defval: 1, min: 1 },
  { id: 'emaStyle', type: 'string', title: 'EMA Style', defval: 'ema', options: ['ema', 'dema', 'hema', 'tema'] },
  {
    id: 'iirStyle', type: 'string', title: 'Discretization', defval: 'Impulse Matched',
    options: ['All Pole', 'Impulse Matched', 'Matched Z-Transform', 'Bilinear Transform'],
  },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'N Order EMA',
  shortTitle: 'N Order EMA',
  overlay: true,
};

const nz = (v: number, r = 0) => (isNaN(v) ? r : v);

/** Lanczos-style gamma approximation, rounded to 8 decimals; na for x <= 0 */
const Q = [75122.6331530, 80916.6278952, 36308.2951477, 8687.24529705, 1168.92649479, 83.8676043424, 2.50662827511];
function gamma(x: number): number {
  let g = NaN;
  if (x > 0) {
    let numerator = 0;
    let denominator = 1;
    const a = Math.pow(x + 5.5, x + 0.5) * Math.exp(-(x + 5.5));
    for (let n = 0; n <= 6; n++) {
      numerator += Q[n] * Math.pow(x, n);
      denominator *= x + n;
    }
    g = math.round((numerator / denominator) * a, 8);
  }
  return g;
}
const factorial = (x: number) => gamma(x + 1);
const nChooseK = (n: number, k: number) => factorial(n) / (factorial(k) * factorial(n - k));
const clampOmega = (w: number) => Math.max(1.0e-6, Math.min(w, Math.PI - 1.0e-6));

function coefficients(style: NOrderIirStyle, period: number, order: number): { a: number[]; b: number[] } {
  const a: number[] = [];
  const b: number[] = [];
  if (style === 'Bilinear Transform') {
    const wc = clampOmega(2 / period);
    const K = Math.tan(wc * 0.5);
    const q = (K - 1) / (K + 1);
    for (let k = 1; k <= order; k++) a.push(nChooseK(order, k) * Math.pow(q, k));
    const g = Math.pow(K / (K + 1), order);
    for (let m = 0; m <= order; m++) b.push(nChooseK(order, m) * g);
    return { a, b };
  }
  const fc = 2 / (period + 1);
  const r = 1 - fc;
  // write_den_*: the three other styles use a_k = C(order, k) * (-r)^k
  for (let k = 1; k <= order; k++) a.push(nChooseK(order, k) * Math.pow(-r, k));
  if (style === 'Impulse Matched') {
    let sum = 0;
    for (let m = 0; m <= order - 1; m++) sum += nChooseK(m + order - 1, order - 1) * Math.pow(r, m);
    const S = 1 / sum;
    for (let m = 0; m <= order - 1; m++) {
      b.push(Math.pow(fc, order) * nChooseK(m + order - 1, order - 1) * Math.pow(r, m) * S);
    }
  } else if (style === 'All Pole') {
    b.push(Math.pow(fc, order));
    if (order > 1) for (let m = 1; m <= order - 1; m++) b.push(0.0);
  } else {
    const dcDenom = Math.pow(1 - r, order);
    let sum = 0;
    for (let m = 0; m <= order - 1; m++) sum += nChooseK(order - 1, m);
    const g = dcDenom / sum;
    for (let m = 0; m <= order - 1; m++) b.push(nChooseK(order - 1, m) * g);
  }
  return { a, b };
}

/** One call site of the inner `ema(source, period, order, style)`: its own `var IIR` and its own source history */
class IirSite {
  private y: number[] = [];
  private a: number[] = [];
  private b: number[] = [];
  private filter = NaN;
  /** The last source values (the newest last; `histCount` values seen in all) */
  private hist: number[] = [];
  private histCount = 0;
  private prevSize = NaN;
  private prevPeriod = NaN;
  private prevOrder = NaN;

  /** `keep`: source values kept, at least the longest coefficient list */
  constructor(private readonly style: NOrderIirStyle, private readonly keep: number) {}

  /** A copy with its own arrays (the coefficient arrays are replaced, never changed: shared) */
  clone(): IirSite {
    const c = new IirSite(this.style, this.keep);
    c.y = this.y.slice();
    c.a = this.a;
    c.b = this.b;
    c.filter = this.filter;
    c.hist = this.hist.slice();
    c.histCount = this.histCount;
    c.prevSize = this.prevSize;
    c.prevPeriod = this.prevPeriod;
    c.prevOrder = this.prevOrder;
    return c;
  }

  step(bar: number, source: number, period: number, order: number): number {
    // update_coeffs_*: barstate.isfirst or period != period[1] or order != order[1]
    if (bar === 0 || period !== this.prevPeriod || order !== this.prevOrder) {
      ({ a: this.a, b: this.b } = coefficients(this.style, period, order));
    }
    this.prevPeriod = period;
    this.prevOrder = order;
    this.hist.push(source);
    this.histCount++;
    if (this.hist.length > this.keep * 2 + 1024) this.hist = this.hist.slice(-this.keep);
    const hist = this.hist;
    const count0 = this.histCount;
    const x = (n: number) => (n < count0 ? hist[hist.length - 1 - n] : NaN);

    const size = this.a.length;
    // size != size[1] (na on the first bar compares false)
    if (!isNaN(this.prevSize) && size !== this.prevSize) this.y.length = 0;
    this.prevSize = size;
    while (this.y.length < size) this.y.push(nz(source));
    this.y.pop();
    this.y.unshift(nz(this.filter, nz(source)));
    this.filter = 0;
    let firstValue = nz(source);
    if (this.style === 'Bilinear Transform') {
      for (let m = 0; m < this.b.length; m++) {
        const xm = x(m);
        if (!isNaN(xm)) firstValue = xm;
        this.filter += nz(xm, firstValue) * this.b[m];
      }
      for (let k = 0; k < size; k++) this.filter -= nz(this.y[k]) * this.a[k];
    } else {
      // impulse matched / all pole loop over y.size(), matched z over b.size()
      const count = this.style === 'Matched Z-Transform' ? this.b.length : this.y.length;
      for (let n = 0; n < count; n++) {
        const xn = x(n);
        if (!isNaN(xn)) firstValue = xn;
        const f = nz(xn, firstValue) * this.b[n] - nz(this.y[n]) * this.a[n];
        this.filter += f;
      }
    }
    return this.filter;
  }
}

interface NOrderVars {
  s1: IirSite;
  s2: IirSite;
  s3: IirSite;
  /** fixnan(nz(source)) */
  lastSource: number;
}

interface NOrderRun extends BarRunState<NOrderVars> {
  plot0: { time: any; value: number }[];
}

function study(inputs: Partial<NOrderEmaInputs>): BarStudy<NOrderRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.source);
  const order = Math.trunc(cfg.order);
  // safe_period = fixnan(clamp(nz(period), 1)): max(min(period, max float), 1)
  const period = Math.max(Math.min(nz(cfg.period), 1.7976931348623158e308), 1);
  const style = cfg.iirStyle;
  // the coefficient lists have at most max(order, 0) + 1 values (constant period and order)
  const keep = Math.max(order, 0) + 2;
  return {
    fullRunReason: () => (isBarSource(cfg.source) ? null : 'source of another study'),
    init() {
      const s: NOrderRun = {
        plot0: [], steps: [], lists: [], series: [],
        vars: { s1: new IirSite(style, keep), s2: new IirSite(style, keep), s3: new IirSite(style, keep), lastSource: NaN },
      };
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const vs = s.vars;
      const { s1, s2, s3 } = vs;
      // safe_source = fixnan(nz(source))
      const v = nz(value(bars[i]));
      vs.lastSource = isNaN(v) ? vs.lastSource : v;
      const x = vs.lastSource;
      let out: number;
      if (cfg.emaStyle === 'dema') {
        const e1 = s1.step(i, x, period, order);
        const e2 = s2.step(i, e1, period, order);
        out = 2 * e1 - e2;
      } else if (cfg.emaStyle === 'tema') {
        const e1 = s1.step(i, x, period, order);
        const e2 = s2.step(i, e1, period, order);
        const e3 = s3.step(i, e2, period, order);
        out = 3 * (e1 - e2) + e3;
      } else if (cfg.emaStyle === 'hema') {
        const e1 = s1.step(i, x, period / 2, order);
        const e2 = s2.step(i, x, period, order);
        const delta = 2 * e1 - e2;
        out = s3.step(i, delta, Math.max(1, Math.sqrt(period)), order);
      } else {
        out = s1.step(i, x, period, order);
      }
      s.plot0[i] = { time: bars[i].time, value: Number.isFinite(out) ? out : NaN };
    },
    copyVars: (v) => ({ s1: v.s1.clone(), s2: v.s2.clone(), s3: v.s3.clone(), lastSource: v.lastSource }),
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<NOrderEmaInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<NOrderEmaInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const NOrderEma = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
