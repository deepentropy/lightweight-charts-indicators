/**
 * Polynomial Regression Moving Average (PRMA)
 *
 * On the first bar, an OLS kernel is built for a polynomial of `degree` fitted on `length` points
 * (x = 0 .. length - 1): kernel = x_last * (X'X)^-1 * X', with X the Vandermonde matrix and x_last the powers of
 * length - 1. A fractional degree blends the kernels of the two nearest integer degrees. On each bar with
 * `length` bars of history, the prediction is the kernel weighted sum of the last `length` source values (0 before).
 * The prediction is smoothed 1 to 10 times with the chosen method (SMA, EMA, WMA, RMA, HMA, DEMA, TEMA, VWMA,
 * Gaussian or none). The line is green when it rises and fuchsia otherwise. A turn up with the close above the line
 * gives an "L" label below the bar; a turn down with the close below the line gives an "S" label above the bar.
 *
 * Reference: "Polynomial Regression Moving Average (PRMA)" by ZakAlgoTrade
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: @ ZakAlgoTrade
 */

import {
  taStep, color, matrix, math, type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
  type SourceType, type PineMatrix,
} from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, WindowVwma, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

type SmoothType = 'None' | 'SMA' | 'EMA' | 'WMA' | 'RMA' | 'HMA' | 'DEMA' | 'TEMA' | 'VWMA' | 'Gaussian';

export interface PolynomialRegressionMovingAverageInputs {
  source: SourceType;
  /** Regression period */
  length: number;
  /** Polynomial degree (a fractional degree blends two kernels) */
  degree: number;
  colorUp: string;
  colorDn: string;
  /** Smoothing method */
  smoothType: SmoothType;
  /** Smoothing length */
  smoothLen: number;
  /** Number of times the smoothing is applied (1 to 10) */
  smoothIter: number;
  /** Show the L / S signals */
  showSig: boolean;
}

export const defaultInputs: PolynomialRegressionMovingAverageInputs = {
  source: 'close',
  length: 100,
  degree: 4.0,
  colorUp: 'rgb(36, 223, 23)',
  colorDn: color.fuchsia,
  smoothType: 'EMA',
  smoothLen: 5,
  smoothIter: 1,
  showSig: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'length', type: 'int', title: 'Period', defval: 100, min: 2 },
  { id: 'degree', type: 'float', title: 'Degree', defval: 4.0, min: 1.0, step: 0.1 },
  { id: 'colorUp', type: 'color', title: 'Up', defval: 'rgb(36, 223, 23)' },
  { id: 'colorDn', type: 'color', title: 'Down', defval: color.fuchsia },
  {
    id: 'smoothType', type: 'string', title: 'Smoothing Method', defval: 'EMA',
    options: ['None', 'SMA', 'EMA', 'WMA', 'RMA', 'HMA', 'DEMA', 'TEMA', 'VWMA', 'Gaussian'],
  },
  { id: 'smoothLen', type: 'int', title: 'Smoothing Length', defval: 5, min: 1 },
  { id: 'smoothIter', type: 'int', title: 'Smoothing Iterations', defval: 1, min: 1, max: 10 },
  { id: 'showSig', type: 'bool', title: 'Show Signals', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'PRMA', color: 'rgb(36, 223, 23)', lineWidth: 2 },
];

export const metadata = {
  title: 'Polynomial Regression Moving Average (PRMA)',
  shortTitle: 'Polynomial Regression Moving Average (PRMA)',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** get_ols_weights(length, deg): x_last * (X'X)^-1 * X' (1 x length matrix) */
function olsWeights(length: number, deg: number): PineMatrix<number> {
  const X = matrix.new_matrix<number>(length, deg + 1, 0.0);
  for (let i = 0; i < length; i++) {
    for (let j = 0; j <= deg; j++) matrix.set(X, i, j, math.pow(i, j) as number);
  }
  const Xt = matrix.transpose(X);
  const XtX = matrix.mult(Xt, X) as PineMatrix<number>;
  const XtXInv = matrix.inv(XtX);
  // Pine runtime error on a singular X'X (e.g. length 3, degree 4)
  if (XtXInv === null) {
    throw new Error("In the 'matrix.inv()' function. Cannot inverse a singular matrix (matrix  determinant is zero).");
  }
  const hFull = matrix.mult(XtXInv, Xt) as PineMatrix<number>;
  const xLast = matrix.new_matrix<number>(1, deg + 1, 0.0);
  for (let j = 0; j <= deg; j++) matrix.set(xLast, 0, j, math.pow(length - 1, j) as number);
  return matrix.mult(xLast, hFull) as PineMatrix<number>;
}

/** mat_scale(m, s) / mat_add(m1, m2) of the Pine script */
function matScale(m: PineMatrix<number>, s: number): PineMatrix<number> {
  const r = matrix.rows(m);
  const c = matrix.columns(m);
  const res = matrix.new_matrix<number>(r, c, 0.0);
  for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) matrix.set(res, i, j, matrix.get(m, i, j) * s);
  return res;
}
function matAdd(m1: PineMatrix<number>, m2: PineMatrix<number>): PineMatrix<number> {
  const r = matrix.rows(m1);
  const c = matrix.columns(m1);
  const res = matrix.new_matrix<number>(r, c, 0.0);
  for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) matrix.set(res, i, j, matrix.get(m1, i, j) + matrix.get(m2, i, j));
  return res;
}

type Smoother = { step(v: number, volume: number): number; commit(): void };
type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

/** The Gaussian smoothing of the script on one bar: sum of nz(src[i]) * w[i] / sum of the weights (its own history) */
class GaussianStep implements Committable {
  private values: number[] = [];
  private pending = NaN;
  private stepped = false;
  private readonly w: number[] = [];

  constructor(private readonly len: number) {
    // sigma = len / 3
    const sigma = len / 3.0;
    for (let i = 0; i < len; i++) this.w.push(math.exp(-0.5 * (math.pow(i / sigma, 2) as number)) as number);
  }

  step(x: number): number {
    this.stepped = true;
    this.pending = x;
    const n = this.values.length;
    let sum = 0.0;
    let wsum = 0.0;
    for (let i = 0; i < this.len; i++) {
      const p = i === 0 ? x : n - i >= 0 ? this.values[n - i] : NaN;
      sum += (isNaN(p) ? 0 : p) * this.w[i];
      wsum += this.w[i];
    }
    return sum / wsum;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.values.push(this.pending);
    if (this.values.length > this.len * 2 + 1024) this.values = this.values.slice(-this.len);
  }
}

interface PrmaVars {
  prevUp: boolean;
  prevDn: boolean;
}

interface PrmaRun extends BarRunState<PrmaVars> {
  /** The kernel weights (built on the first bar) */
  kernel: number[];
  smoothers: Smoother[];
  src: number[];
  prma: number[];
  plot0: Point[];
  markers: MarkerData[];
}

function study(inputs: Partial<PolynomialRegressionMovingAverageInputs>): BarStudy<PrmaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, degree, smoothType, smoothLen, smoothIter } = cfg;
  const value = barSource(cfg.source);

  // Smoothing: each iteration is its own call site, run on every bar
  const smoothOnce = (len: number): Smoother => {
    const ema = (l: number) => taStep.ema(l);
    switch (smoothType) {
      case 'SMA': return new WindowSma(len);
      case 'EMA': { const m = ema(len); return { step: (x) => m.step(x), commit: () => m.commit() }; }
      case 'WMA': { const m = taStep.wma(); return { step: (x) => m.step(x, len), commit: () => m.commit() }; }
      case 'RMA': { const m = taStep.rma(len); return { step: (x) => m.step(x), commit: () => m.commit() }; }
      case 'HMA': {
        // halfLen = math.max(int(len / 2), 1); sqrtLen = math.max(int(math.sqrt(len)), 1)
        const halfLen = Math.max(Math.trunc(len / 2), 1);
        const sqrtLen = Math.max(Math.trunc(Math.sqrt(len)), 1);
        const wHalf = taStep.wma();
        const wFull = taStep.wma();
        const outer = taStep.wma();
        return {
          step: (x) => outer.step(2 * wHalf.step(x, halfLen) - wFull.step(x, len), sqrtLen),
          commit: () => { wHalf.commit(); wFull.commit(); outer.commit(); },
        };
      }
      case 'DEMA': {
        const e1 = ema(len);
        const e2 = ema(len);
        return {
          step: (x) => { const v = e1.step(x); return 2 * v - e2.step(v); },
          commit: () => { e1.commit(); e2.commit(); },
        };
      }
      case 'TEMA': {
        const e1 = ema(len);
        const e2 = ema(len);
        const e3 = ema(len);
        return {
          step: (x) => { const v = e1.step(x); const v2 = e2.step(v); return 3 * (v - v2) + e3.step(v2); },
          commit: () => { e1.commit(); e2.commit(); e3.commit(); },
        };
      }
      case 'VWMA': return new WindowVwma(len);
      case 'Gaussian': { const m = new GaussianStep(len); return { step: (x) => m.step(x), commit: () => m.commit() }; }
      default: return { step: (x) => x, commit: () => {} };
    }
  };

  return {
    fullRunReason: () => (isBarSource(cfg.source) ? null : 'source of another study'),
    init() {
      const smoothers: Smoother[] = [];
      if (smoothType !== 'None') {
        for (let k = 1; k <= Math.min(smoothIter, 10); k++) smoothers.push(smoothOnce(smoothLen));
      }
      const s: PrmaRun = {
        kernel: [], smoothers, src: [], prma: [], plot0: [], markers: [],
        steps: smoothers, vars: { prevUp: false, prevDn: false }, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.src, s.prma, s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const src = value(b);
      s.src[i] = src;
      // Kernel, built on the first bar (barstate.isfirst)
      if (i === 0) {
        const degF = Math.floor(degree);
        const degC = Math.ceil(degree);
        const weight = degree - degF;
        const kFloor = olsWeights(length, Math.trunc(degF));
        const kernel = degF === degC
          ? kFloor
          : matAdd(matScale(kFloor, 1.0 - weight), matScale(olsWeights(length, Math.trunc(degC)), weight));
        s.kernel = [];
        for (let k = 0; k < length; k++) s.kernel.push(matrix.get(kernel, 0, k));
      }

      // if not na(source[length]): nr_pred = sum of kernel(0, i) * source[length - 1 - i]
      let nrPred = 0;
      if (i >= length && !isNaN(s.src[i - length])) {
        let sum = 0.0;
        for (let k = 0; k < length; k++) sum += s.kernel[k] * s.src[i - (length - 1 - k)];
        nrPred = sum;
      }
      let prma = nrPred;
      const volume = b.volume ?? NaN;
      for (const m of s.smoothers) prma = m.step(prma, volume);
      s.prma[i] = prma;

      const v = s.vars;
      const prev = i > 0 ? s.prma[i - 1] : NaN;
      const up = gt(prma, prev);
      const dn = lt(prma, prev);
      const t = b.time as number;
      s.plot0[i] = { time: t, value: Number.isFinite(prma) ? prma : NaN, color: up ? cfg.colorUp : cfg.colorDn };
      // plotshape(showSig and sig_buy and close > prma, "Long", shape.labelup, location.belowbar, colorUp, text = "L")
      if (cfg.showSig && up && v.prevDn && gt(b.close, prma)) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: cfg.colorUp, text: 'L',
          textColor: color.white, size: 'tiny' });
      }
      // plotshape(showSig and sig_sell and close < prma, "Short", shape.labeldown, location.abovebar, colorDn, text = "S")
      if (cfg.showSig && dn && v.prevUp && lt(b.close, prma)) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: cfg.colorDn, text: 'S',
          textColor: color.white, size: 'tiny' });
      }
      v.prevUp = up;
      v.prevDn = dn;
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PolynomialRegressionMovingAverageInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<PolynomialRegressionMovingAverageInputs> = {},
): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const PolynomialRegressionMovingAverage = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
