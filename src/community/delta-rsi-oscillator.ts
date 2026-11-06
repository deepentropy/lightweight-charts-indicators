/**
 * Delta-RSI Oscillator
 *
 * A smoothed time derivative of the RSI, drawn as columns: on each bar a polynomial of order `Polynomial Order` is
 * fitted by least squares (pseudoinverse of the Vandermonde matrix from a modified Gram-Schmidt QR decomposition) to
 * the last `Frame Length` RSI values, and its derivative at the last point of the frame is the D-RSI. The columns are
 * green (above 0, rising: dark; falling: light) or red (below 0, rising: light; falling: dark). A signal line (EMA of
 * the D-RSI, can be hidden) and a zero line.
 *
 * Reference: "Delta-RSI Oscillator" by tbiktag
 * Original notice: © tbiktag
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DeltaRsiOscillatorInputs {
  /** RSI Source */
  src: SourceType;
  /** RSI Length */
  rsiLength: number;
  /** Polynomial Order */
  degree: number;
  /** Frame Length (must be greater than Order) */
  window: number;
  /** Show D-RSI Signal Line */
  showSignal: boolean;
  /** D-RSI Signal Length */
  signalLength: number;
}

export const defaultInputs: DeltaRsiOscillatorInputs = {
  src: 'close',
  rsiLength: 14,
  degree: 2,
  window: 18,
  showSignal: true,
  signalLength: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'RSI Source', defval: 'close' },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'degree', type: 'int', title: 'Polynomial Order', defval: 2, min: 1 },
  { id: 'window', type: 'int', title: 'Frame Length (must be greater than Order)', defval: 18, min: 2 },
  { id: 'showSignal', type: 'bool', title: 'Show D-RSI Signal Line', defval: true },
  { id: 'signalLength', type: 'int', title: 'D-RSI Signal Length', defval: 9 },
];

/** Column colours: plotColor = drsi >= 0 ? drsi[1] < drsi ? #26A748 : #C1E5CB : drsi[1] < drsi ? #FBBEC2 : #BA3840 */
const UP_RISING = '#26A748';
const UP_FALLING = '#C1E5CB';
const DOWN_RISING = '#FBBEC2';
const DOWN_FALLING = '#BA3840';
/** color.silver */
const SILVER = '#B2B5BE';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'D-RSI', color: '#2196F3', lineWidth: 2, style: 'columns' },
  { id: 'plot1', title: 'Signal Line', color: SILVER, lineWidth: 2 },
  { id: 'plot2', title: 'Zero Line', color: SILVER, lineWidth: 1 },
];

export const metadata = {
  title: 'Delta-RSI Oscillator',
  shortTitle: 'D-RSI',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

// --- implied 2d matrices stored by column: A[i + nrows * j] ---

const mget = (A: number[], i: number, j: number, nrows: number) => A[i + nrows * j];
const mset = (A: number[], value: number, i: number, j: number, nrows: number) => { A[i + nrows * j] = value; };

function transpose(A: number[], nrows: number, ncolumns: number): number[] {
  const AT = new Array<number>(nrows * ncolumns).fill(0);
  for (let i = 0; i <= nrows - 1; i++) {
    for (let j = 0; j <= ncolumns - 1; j++) mset(AT, mget(A, i, j, nrows), j, i, ncolumns);
  }
  return AT;
}

function multiply(A: number[], B: number[], nrowsA: number, ncolumnsA: number, ncolumnsB: number): number[] {
  const C = new Array<number>(nrowsA * ncolumnsB).fill(0);
  const nrowsB = ncolumnsA;
  for (let i = 0; i <= nrowsA - 1; i++) {
    for (let j = 0; j <= ncolumnsB - 1; j++) {
      let elementC = 0;
      for (let k = 0; k <= ncolumnsA - 1; k++) elementC = elementC + mget(A, i, k, nrowsA) * mget(B, k, j, nrowsB);
      mset(C, elementC, i, j, nrowsA);
    }
  }
  return C;
}

function vnorm(X: number[], n: number): number {
  let norm = 0;
  for (let i = 0; i <= n - 1; i++) norm = norm + Math.pow(X[i], 2);
  return Math.sqrt(norm);
}

/** QR decomposition with the modified Gram-Schmidt algorithm (column oriented) */
function qrDiag(A: number[], nrows: number, ncolumns: number): [number[], number[]] {
  const Q = new Array<number>(nrows * ncolumns).fill(0);
  const R = new Array<number>(ncolumns * ncolumns).fill(0);
  const a = new Array<number>(nrows).fill(0);
  for (let i = 0; i <= nrows - 1; i++) a[i] = mget(A, i, 0, nrows);
  let r = vnorm(a, nrows);
  mset(R, r, 0, 0, ncolumns);
  for (let i = 0; i <= nrows - 1; i++) mset(Q, a[i] / r, i, 0, nrows);
  if (ncolumns !== 1) {
    for (let k = 1; k <= ncolumns - 1; k++) {
      for (let i = 0; i <= nrows - 1; i++) a[i] = mget(A, i, k, nrows);
      for (let j = 0; j <= k - 1; j++) {
        r = 0;
        for (let i = 0; i <= nrows - 1; i++) r = r + mget(Q, i, j, nrows) * a[i];
        mset(R, r, j, k, ncolumns);
        for (let i = 0; i <= nrows - 1; i++) a[i] = a[i] - r * mget(Q, i, j, nrows);
      }
      r = vnorm(a, nrows);
      mset(R, r, k, k, ncolumns);
      for (let i = 0; i <= nrows - 1; i++) mset(Q, a[i] / r, i, k, nrows);
    }
  }
  return [Q, R];
}

/** Pseudoinverse R^-1 * Q^T (ncolumns x nrows) */
function pinv(A: number[], nrows: number, ncolumns: number): number[] {
  const [Q, R] = qrDiag(A, nrows, ncolumns);
  const QT = transpose(Q, nrows, ncolumns);
  const Rinv = new Array<number>(ncolumns * ncolumns).fill(0);
  mset(Rinv, 1 / mget(R, 0, 0, ncolumns), 0, 0, ncolumns);
  if (ncolumns !== 1) {
    for (let j = 1; j <= ncolumns - 1; j++) {
      for (let i = 0; i <= j - 1; i++) {
        let r = 0;
        for (let k = i; k <= j - 1; k++) r = r + mget(Rinv, i, k, ncolumns) * mget(R, k, j, ncolumns);
        mset(Rinv, r, i, j, ncolumns);
      }
      for (let k = 0; k <= j - 1; k++) {
        mset(Rinv, -mget(Rinv, k, j, ncolumns) / mget(R, j, j, ncolumns), k, j, ncolumns);
      }
      mset(Rinv, 1 / mget(R, j, j, ncolumns), j, j, ncolumns);
    }
  }
  return multiply(Rinv, QT, ncolumns, ncolumns, nrows);
}

type Point = { time: number; value: number; color?: string };

interface DeltaRun extends BarRunState<Record<string, never>> {
  rsi: ReturnType<typeof taStep.rsi>;
  signal: ReturnType<typeof taStep.ema>;
  rsiArr: number[];
  drsi: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
}

function study(inputs: Partial<DeltaRsiOscillatorInputs>): BarStudy<DeltaRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const { window, degree } = cfg;
  // diff(_src, _window, _degree): derivative at the last point of the frame of the fitted polynomial
  // Vandermonde matrix (window x degree + 1): z = 0 .. window - 1
  const J = new Array<number>(window * (degree + 1)).fill(0);
  for (let i = 0; i <= window - 1; i++) {
    for (let j = 0; j <= degree; j++) mset(J, Math.pow(i, j), i, j, window);
  }
  // The matrix only depends on the inputs: the same on every bar
  const C = pinv(J, window, degree + 1);
  const Y = new Array<number>(window).fill(NaN);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: DeltaRun = {
        rsi: taStep.rsi(cfg.rsiLength), signal: taStep.ema(cfg.signalLength),
        rsiArr: [], drsi: [], plot0: [], plot1: [], plot2: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.rsi, s.signal];
      s.series = [s.rsiArr, s.drsi, s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(s, bar, bars) {
      const b = bars[bar];
      const src = s.rsiArr;
      src[bar] = s.rsi.step(value(b));
      for (let j = 0; j <= window - 1; j++) {
        const k = bar - (window - 1 - j);
        Y[j] = k >= 0 ? src[k] : NaN;
      }
      const coef = multiply(C, Y, degree + 1, window, 1);
      let d = 0;
      for (let i = 1; i <= degree; i++) d = d + i * coef[i] * Math.pow(window - 1, i - 1);
      const drsi = Number.isFinite(d) ? d : NaN;
      s.drsi[bar] = drsi;
      const signal = s.signal.step(drsi);

      const prev = bar > 0 ? s.drsi[bar - 1] : NaN;
      const rising = lt(prev, drsi);
      const col = ge(drsi, 0) ? (rising ? UP_RISING : UP_FALLING) : (rising ? DOWN_RISING : DOWN_FALLING);
      s.plot0[bar] = { time: b.time, value: drsi, color: col };
      // plot(issignal ? singalline : na)
      s.plot1[bar] = { time: b.time, value: cfg.showSignal ? signal : NaN };
      s.plot2[bar] = { time: b.time, value: 0 };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DeltaRsiOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DeltaRsiOscillatorInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const DeltaRsiOscillator = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
