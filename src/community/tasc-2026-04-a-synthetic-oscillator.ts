/**
 * TASC 2026.04 A Synthetic Oscillator
 *
 * John F. Ehlers' Synthetic Oscillator. The source is smoothed by a 12-bar Hann filter, then bandpass filtered
 * (highpass at the upper bound, Super Smoother at the lower bound) and normalized by its 100-bar RMS: the real
 * component. Its rate of change, normalized the same way, is the imaginary component. The rate of change of the
 * phase angle gives the dominant cycle, limited to the bounds. A bandpass filter (highpass then Ultimate Smoother)
 * at the geometric mean of the bounds gives the phase resets: the cumulative phase adds 2 * pi / cycle per bar and
 * is reset to pi / cycle when the bandpass crosses above 0 and to pi + pi / cycle when it crosses below 0. The
 * oscillator is the sine of the cumulative phase, held when a reset would make it move back in the same quadrant.
 * The filters start on bar_index 4.
 *
 * Reference: "TASC 2026.04 A Synthetic Oscillator" by PineCodersTASC
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';


export interface TascSyntheticOscillatorInputs {
  /** Source series */
  src: SourceType;
  /** Lower bound of the dominant cycle (lowpass period) */
  lb: number;
  /** Upper bound of the dominant cycle (highpass period), greater than the lower bound */
  ub: number;
}

export const defaultInputs: TascSyntheticOscillatorInputs = {
  src: 'close',
  lb: 15,
  ub: 25,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source Series:', defval: 'close' },
  { id: 'lb', type: 'int', title: 'Lower Bound:', defval: 15, min: 3 },
  { id: 'ub', type: 'int', title: 'Upper Bound:', defval: 25, min: 4 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Synthetic Oscillator', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'TASC 2026.04 A Synthetic Oscillator',
  shortTitle: 'SO',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false); a != b when |a - b| > 1e-10 */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ne = (a: number, b: number) => Math.abs(a - b) > EPS;
const nz = (x: number) => (isNaN(x) ? 0 : x);

/** Filter constants of the period: [q, c1, c2] */
function consts(period: number): [number, number, number] {
  const q = Math.exp((-1.414 * Math.PI) / period);
  const c1 = 2.0 * q * Math.cos((1.414 * Math.PI) / period);
  return [q, c1, q * q];
}

/** HP(src, period) on bar i: 0 before bar_index 4, then nz(a0 * (src - 2 * src[1] + src[2]) + c1 * hp[1] - c2 * hp[2]) */
function highPassAt(hp: number[], src: number[], i: number, a0: number, c1: number, c2: number): number {
  return i < 4 ? 0 : nz(a0 * (src[i] - 2 * src[i - 1] + src[i - 2]) + c1 * hp[i - 1] - c2 * hp[i - 2]);
}

/** SuperSmoother(src, period) on bar i: src before bar_index 4, then a0 * (src + src[1]) + c1 * ss[1] - c2 * ss[2] */
function superSmootherAt(ss: number[], src: number[], i: number, a0: number, c1: number, c2: number): number {
  return i < 4 ? src[i] : a0 * (src[i] + src[i - 1]) + c1 * ss[i - 1] - c2 * ss[i - 2];
}

/** UltimateSmoother(src, period) on bar i: src before bar_index 4, then the all-pass minus high-pass response */
function ultimateSmootherAt(us: number[], src: number[], i: number, a0: number, c1: number, c2: number): number {
  if (i < 4) return src[i];
  return (1.0 - a0) * src[i] + (2.0 * a0 - c1) * src[i - 1] + (c2 - a0) * src[i - 2]
    + c1 * nz(us[i - 1]) - c2 * nz(us[i - 2]);
}

/**
 * RMS(src, length) on bar i: math.sum(src * src, length) (na until `length` bars, na while an na value is in the
 * window); sqrt(sum / length) when the sum is not 0, else 0 (an na sum gives 0)
 */
function rmsAt(src: number[], i: number, length: number): number {
  let s = NaN;
  if (i >= length - 1) {
    s = 0;
    for (let k = i - length + 1; k <= i; k++) s += src[k] * src[k];
  }
  return ne(s, 0) ? Math.sqrt(s / length) : 0.0;
}

/** Hann(src, length) on bar i: Hann-window weighted average of src[0 .. length - 1] (na values count as 0) */
function hannAt(src: number[], i: number, length: number): number {
  let filt = 0.0;
  let coef = 0.0;
  for (let c = 1; c <= length; c++) {
    const p = Math.cos((2 * Math.PI * c) / (length + 1));
    filt += (1.0 - p) * nz(i - (c - 1) >= 0 ? src[i - (c - 1)] : NaN);
    coef += 1.0 - p;
  }
  return ne(coef, 0.0) ? filt / coef : 0.0;
}

interface SoVars {
  /** var float ph = 0.0 */
  ph: number;
}

interface SoRun extends BarRunState<SoVars> {
  src: number[];
  price: number[];
  hp: number[];
  lp: number[];
  re: number[];
  roc: number[];
  im: number[];
  hpMid: number[];
  bp: number[];
  so: number[];
  plot: { time: number; value: number }[];
}

function study(inputs: Partial<TascSyntheticOscillatorInputs>): BarStudy<SoRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const { lb, ub } = cfg;
  const value = barSource(cfg.src);
  const [, c1U, c2U] = consts(ub);
  const hpA0 = (1 + c1U + c2U) / 4;
  const [, c1L, c2L] = consts(lb);
  const ssA0 = (1.0 - c1L + c2L) / 2;
  // Bandpass filter at the average dominant cycle period
  const mid = Math.trunc(Math.sqrt(lb * ub));
  const [, c1M, c2M] = consts(mid);
  const hpMidA0 = (1 + c1M + c2M) / 4;
  const usA0 = (1.0 + c1M + c2M) / 4.0;
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      if (lb >= ub) {
        // runtime.error in Pine
        throw new Error("The 'Upper Bound' value must be greater than the 'Lower Bound' value.");
      }
      const s: SoRun = {
        src: [], price: [], hp: [], lp: [], re: [], roc: [], im: [], hpMid: [], bp: [], so: [], plot: [],
        steps: [], vars: { ph: 0.0 }, lists: [], series: [],
      };
      s.series = [s.src, s.price, s.hp, s.lp, s.re, s.roc, s.im, s.hpMid, s.bp, s.so, s.plot];
      return s;
    },
    bar(s, i, bars) {
      const src = value(bars[i]);
      s.src[i] = src;

      // Real component: bandpass filtered and normalized
      s.price[i] = hannAt(s.src, i, 12);
      s.hp[i] = highPassAt(s.hp, s.price, i, hpA0, c1U, c2U);
      const lp = superSmootherAt(s.lp, s.hp, i, ssA0, c1L, c2L);
      s.lp[i] = lp;
      const lpRms = rmsAt(s.lp, i, 100);
      const re = ne(lpRms, 0.0) ? lp / lpRms : 0.0;
      s.re[i] = re;
      // Imaginary component: rate of change, normalized
      const roc = i > 0 ? re - s.re[i - 1] : NaN;
      s.roc[i] = roc;
      const rocRms = rmsAt(s.roc, i, 100);
      const im = ne(rocRms, 0.0) ? roc / rocRms : 0.0;
      s.im[i] = im;

      s.hpMid[i] = highPassAt(s.hpMid, s.src, i, hpMidA0, c1M, c2M);
      const bp = ultimateSmootherAt(s.bp, s.hpMid, i, usA0, c1M, c2M);
      s.bp[i] = bp;

      // Rate of change of the arctangent, limited to the bounds
      const denom = roc * im - (im - (i > 0 ? s.im[i - 1] : NaN)) * re;
      let dc = ne(denom, 0.0) ? (6.28 * (re * re + im * im)) / denom : 0.0;
      dc = Math.max(lb, Math.min(ub, dc));

      // Cumulative phase, reset at 0 and 180 degrees (ta.crossover / ta.crossunder of bp and 0: exact comparisons,
      // no 1e-10 tolerance, unlike the operators)
      const v = s.vars;
      v.ph += (2 * Math.PI) / dc;
      const xo = i > 0 && bp > 0.0 && s.bp[i - 1] <= 0.0;
      const xu = i > 0 && bp < 0.0 && s.bp[i - 1] >= 0.0;
      if (xo) v.ph = Math.PI / dc;
      else if (xu) v.ph = Math.PI + Math.PI / dc;
      const ph = v.ph;

      // Sine of the phase; remove the reset glitch when the move stays in the same quadrant
      let so = Math.sin(ph);
      const prev = i > 0 ? s.so[i - 1] : NaN;
      if (gt(ph, 0.0) && lt(ph, Math.PI / 2) && lt(so, prev)) so = prev;
      else if (gt(ph, Math.PI) && lt(ph, (3 * Math.PI) / 2) && gt(so, prev)) so = prev;
      s.so[i] = so;
      s.plot[i] = { time: bars[i].time, value: so };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot.slice() },
        // hline(0, "Zero Line"): Pine default colour, dashed, width 1
        hlines: [{ value: 0, options: { title: 'Zero Line', color: '#787B86', linestyle: 'dashed', linewidth: 1 } }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TascSyntheticOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TascSyntheticOscillatorInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const TascSyntheticOscillator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
