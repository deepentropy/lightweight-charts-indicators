/**
 * Wavelet Filter with Adaptive Upsampling
 *
 * On each bar, a two-level Haar-like wavelet decomposition of the log returns log(src / src[1]) of the last
 * min(bar_index, 5000) bars: high pass (a - b) / sqrt(2) and low pass (a + b) / sqrt(2) of consecutive returns,
 * downsampled by 2. The detail (high pass) coefficients of each level are soft-thresholded with the universal
 * threshold stdev * sqrt(2 * log(n)). The level 2 detail and approximation are added, upsampled (sinusoidal,
 * least-squares sinusoid fit with a Quinn-Fernandes frequency estimate, or linear midpoint) and added to the level 1
 * detail. The reconstructed log return of the bar is element bar_index % size of that series; the cumulative
 * series multiplies 1 by (1 + reconstructed return) on each bar.
 *
 * Reference: "Wavelet Filter with Adaptive Upsampling [BackQuant]" by BackQuant
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © BackQuant :)
 */

import { array, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type WaveletUpsampleType = 'Sinusoidal Upsample' | 'Advanced Upsample' | 'Simple Upsample';

export interface WaveletFilterWithAdaptiveUpsamplingInputs {
  /** Source */
  src: SourceType;
  /** Frequency of the sinusoidal upsample; also the convergence tolerance of the frequency estimate */
  freq: number;
  /** Phase shift of the sinusoidal upsample */
  phase: number;
  /** Consideration length for the frequency estimation and the least squares fit; the script runs from bar npast + 1 */
  npast: number;
  /** Upsample factor of the advanced upsample */
  upp: number;
  /** Upsampling function */
  upsampleType: WaveletUpsampleType;
  /** Show the reconstructed (cumulative) series */
  showeq: boolean;
  /** Show the reconstructed log returns */
  showlr: boolean;
}

export const defaultInputs: WaveletFilterWithAdaptiveUpsamplingInputs = {
  src: 'close',
  freq: 1,
  phase: 0,
  npast: 2,
  upp: 2,
  upsampleType: 'Sinusoidal Upsample',
  showeq: true,
  showlr: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close', group: 'High and Low Pass Filters' },
  { id: 'freq', type: 'float', title: 'Frequency', defval: 1, group: 'Interpolation' },
  { id: 'phase', type: 'int', title: 'Phase Shift', defval: 0, group: 'Interpolation' },
  { id: 'npast', type: 'int', title: 'Consideration Length for Frequency estimation and Least Squares Fitting Calculation', defval: 2 },
  { id: 'upp', type: 'int', title: 'Upsample Factor', defval: 2 },
  { id: 'upsampleType', type: 'string', title: 'Type of Upsampling Process/Function to use', defval: 'Sinusoidal Upsample',
    options: ['Sinusoidal Upsample', 'Advanced Upsample', 'Simple Upsample'] },
  { id: 'showeq', type: 'bool', title: 'Show Reconstructed Series', defval: true, group: 'Plotting' },
  { id: 'showlr', type: 'bool', title: 'Show Reconstructed Log Returns', defval: false, group: 'Plotting' },
];

const WHITE = '#FFFFFF';
const UP = '#00FF00';
const DOWN = '#FF0000';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Cumulative Series', color: WHITE, lineWidth: 1 },
  { id: 'plot1', title: 'Reconstructed Log Return Histogram', color: UP, lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'Wavelet Filter with Adaptive Upsampling [BackQuant]',
  shortTitle: 'Wavelet Filter [BackQuant]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false); != false with na / infinity */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ne = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) > EPS;
const isNa = (x: number) => !Number.isFinite(x);

/** Pine array.get: a negative index counts from the end; out of bounds is a runtime error */
function aget(arr: number[], index: number): number {
  const k = index < 0 ? arr.length + index : index;
  if (k < 0 || k >= arr.length) {
    throw new Error(`In 'array.get()' function. Index ${index} is out of bounds, array size is ${arr.length}.`);
  }
  return arr[k];
}

/** Pine array.set: a negative index counts from the end; out of bounds is a runtime error */
function aset(arr: number[], index: number, value: number): void {
  const k = index < 0 ? arr.length + index : index;
  if (k < 0 || k >= arr.length) {
    throw new Error(`In 'array.set()' function. Index ${index} is out of bounds, array size is ${arr.length}.`);
  }
  arr[k] = value;
}

/** Pine `for i = from to to by step`: counts down when from > to (the step sign is taken from the bounds) */
function pineFor(from: number, to: number, step: number, body: (i: number) => void): void {
  const s = Math.abs(step);
  if (from <= to) for (let i = from; i <= to; i += s) body(i);
  else for (let i = from; i >= to; i -= s) body(i);
}

const C = 1 / Math.sqrt(2);
const highPass = (a: number, b: number) => (a - b) * C;
const lowPass = (a: number, b: number) => (a + b) * C;

/** coeff > threshold ? coeff - threshold : coeff < -threshold ? coeff + threshold : 0 */
const softThreshold = (coeff: number, threshold: number) =>
  (gt(coeff, threshold) ? coeff - threshold : lt(coeff, -threshold) ? coeff + threshold : 0);

/** Size of the linear and the sinusoidal upsample of an array of `size` values (an array of 0 or 1 value is kept) */
const upsampledSize = (size: number) => (size <= 1 ? size : size * 2 - 1);

/** Element k of the linear upsample: the original values with their midpoints between them */
function upsampleAt(arr: number[], k: number): number {
  if (arr.length <= 1) return aget(arr, k);
  if (k % 2 === 0) return aget(arr, k / 2);
  const a = aget(arr, (k - 1) / 2);
  const b = aget(arr, (k + 1) / 2);
  return (a + b) / 2;
}

/** Element k of the sinusoidal upsample: amplitude * sin(pi * freq + phase) + midpoint between the original values */
function sinusoidalUpsampleAt(arr: number[], k: number, freq: number, phase: number): number {
  if (arr.length <= 1) return aget(arr, k);
  if (k % 2 === 0) return aget(arr, k / 2);
  const a = aget(arr, (k - 1) / 2);
  const b = aget(arr, (k + 1) / 2);
  const amplitude = (b - a) / 2;
  const midPoint = (a + b) / 2;
  return amplitude * Math.sin(Math.PI * freq + phase) + midPoint;
}

/** Pine stops a loop that runs too long with a runtime error; a frequency estimate that does not converge throws */
const MAX_WHILE = 1_000_000;

/** Least squares sinusoid fit of the first npast values (Quinn-Fernandes frequency), sampled npast * factor times */
function advancedUpsample(srcarr: number[], npast: number, frqtol: number, upsampleFactor: number, barIndex: number): number[] {
  if (!(srcarr.length > 1 && barIndex > npast)) return [];
  let alpha = 0.0;
  let beta = 2.0;
  const srcsample = array.new_float(srcarr.length, NaN);
  aset(srcsample, 0, aget(srcarr, 0));
  let iterations = 0;
  while (gt(Math.abs(alpha - beta), frqtol)) {
    if (++iterations > MAX_WHILE) throw new Error('Loop takes too long to execute (> 500 ms)');
    alpha = beta;
    const last = Math.min(npast - 1, srcarr.length - 1);
    pineFor(1, last, 1, (i) => {
      const dxPrev = i > 1 ? aget(srcsample, i - 1) - aget(srcsample, i - 2) : 0.0;
      if (i < srcarr.length) aset(srcsample, i, aget(srcarr, i) + alpha * dxPrev);
    });
    let num = 0.0;
    let den = 0.0;
    pineFor(1, last, 1, (i) => {
      num += aget(srcsample, i - 1) * (aget(srcsample, i) + (i > 1 ? aget(srcsample, i - 2) : 0.0));
      den += aget(srcsample, i - 1) * aget(srcsample, i - 1);
    });
    beta = num / den;
  }
  const w = Math.acos(Math.min(Math.max(beta / 2.0, -1.0), 1.0));

  let Sc = 0.0;
  let Ss = 0.0;
  let Scc = 0.0;
  let Sss = 0.0;
  let Scs = 0.0;
  let Sx = 0.0;
  let Sxc = 0.0;
  let Sxs = 0.0;
  const n = npast;
  pineFor(0, Math.min(npast - 1, srcarr.length - 1), 1, (i) => {
    const c = Math.cos(w * i);
    const s = Math.sin(w * i);
    const dx = aget(srcarr, i);
    Sc += c;
    Ss += s;
    Scc += c * c;
    Sss += s * s;
    Scs += c * s;
    Sx += dx;
    Sxc += dx * c;
    Sxs += dx * s;
  });
  Sc /= n;
  Ss /= n;
  Scc /= n;
  Sss /= n;
  Scs /= n;
  Sx /= n;
  Sxc /= n;
  Sxs /= n;

  const den = Math.pow(Scs - Sc * Ss, 2) - (Scc - Sc * Sc) * (Sss - Ss * Ss);
  let a = 0.0;
  let b = 0.0;
  const m = Sx;
  // `den != 0`: false within 1e-10 and with na
  if (ne(den, 0)) {
    a = ((Sxs - Sx * Ss) * (Scs - Sc * Ss) - (Sxc - Sx * Sc) * (Sss - Ss * Ss)) / den;
    b = ((Sxc - Sx * Sc) * (Scs - Sc * Ss) - (Sxs - Sx * Ss) * (Scc - Sc * Sc)) / den;
  }
  const out: number[] = [];
  pineFor(0, npast * upsampleFactor - 1, 1, (i) => {
    const t = i / upsampleFactor;
    out.push(m + a * Math.cos(w * t) + b * Math.sin(w * t));
  });
  return out;
}

type Point = { time: number; value: number; color?: string };

interface WaveletVars {
  /** var float reconstructed_equity = na */
  reconstructed: number;
  /** var float Series = 1.0 */
  series: number;
}

interface WaveletRun extends BarRunState<WaveletVars> {
  src: number[];
  logRoc: number[];
  high1: number[];
  low1: number[];
  high2: number[];
  low2: number[];
  plot0: Point[];
  plot1: Point[];
}

function study(inputs: Partial<WaveletFilterWithAdaptiveUpsamplingInputs>): BarStudy<WaveletRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const npast = cfg.npast;
  const source = barSource(cfg.src);
  const value = (x: number) => (Number.isFinite(x) ? x : NaN);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: WaveletRun = {
        src: [], logRoc: [], high1: [], low1: [], high2: [], low2: [], plot0: [], plot1: [],
        steps: [], vars: { reconstructed: NaN, series: 1.0 }, lists: [], series: [],
      };
      s.series = [s.src, s.logRoc, s.high1, s.low1, s.high2, s.low2, s.plot0, s.plot1];
      return s;
    },
    bar(s, bi, bars) {
      const v = s.vars;
      const { src, logRoc, high1, low1, high2, low2 } = s;
      src[bi] = source(bars[bi]);
      // LogRoC = math.log(src / src[1])
      logRoc[bi] = bi > 0 ? Math.log(src[bi] / src[bi - 1]) : NaN;
      // The script decomposes the last min(bar_index, 5000) returns again on every bar, but each coefficient depends
      // only on the bar it starts at: the level 1 pair (LogRoC[t], LogRoC[t - 1]) and the level 2 pair of the level 1
      // low pass values of bars t and t - 2. Each bar computes its own; a bar reads its downsampled arrays from them
      // (every second bar back for level 1, every fourth for level 2) and only the element bar_index % size of the
      // reconstruction.
      high1[bi] = highPass(logRoc[bi], bi > 0 ? logRoc[bi - 1] : NaN);
      low1[bi] = lowPass(logRoc[bi], bi > 0 ? logRoc[bi - 1] : NaN);
      high2[bi] = highPass(low1[bi], bi > 1 ? low1[bi - 2] : NaN);
      low2[bi] = lowPass(low1[bi], bi > 1 ? low1[bi - 2] : NaN);

      if (bi > 0 && bi > npast) {
        // for i = 0 to math.min(bar_index, 5000) - 1: high and low pass of LogRoC[i] and LogRoC[i + 1], downsampled
        const size = Math.min(bi, 5000);
        const downsampledHigh: number[] = [];
        for (let i = 0; i < size; i += 2) downsampledHigh.push(high1[bi - i]);
        const downsampledLowSize = downsampledHigh.length;

        // Noise level of the level 1 detail; universal threshold
        const noiseEstimate = array.stdev(downsampledHigh);
        const n = downsampledHigh.length;
        const adaptiveThreshold = noiseEstimate * Math.sqrt(2 * Math.log(n));

        // Level 2: `for i = 0 to array.size(downsampledLow) - 2` counts down with one value and reads past its end
        if (downsampledLowSize < 2) {
          throw new Error(`In 'array.get()' function. Index 1 is out of bounds, array size is ${downsampledLowSize}.`);
        }
        const secondDownsampledHigh: number[] = [];
        const secondDownsampledLow: number[] = [];
        for (let i = 0; i < downsampledLowSize - 1; i += 2) {
          secondDownsampledHigh.push(high2[bi - 2 * i]);
          secondDownsampledLow.push(low2[bi - 2 * i]);
        }
        const secondNoiseEstimate = array.stdev(secondDownsampledHigh);
        const secondN = secondDownsampledHigh.length;
        const secondAdaptiveThreshold = secondNoiseEstimate * Math.sqrt(2 * Math.log(secondN));

        // Upsampling and reconstruction
        const firstReconSize = Math.min(secondDownsampledHigh.length, secondDownsampledLow.length);
        const firstReconstruct = array.new_float(firstReconSize, NaN);
        for (let j = 0; j < firstReconSize; j++) {
          const hiVal = softThreshold(secondDownsampledHigh[j], secondAdaptiveThreshold);
          const loVal = secondDownsampledLow[j];
          if (!isNa(hiVal) && !isNa(loVal)) firstReconstruct[j] = hiVal + loVal;
        }

        const advanced = cfg.upsampleType === 'Advanced Upsample'
          ? advancedUpsample(firstReconstruct, npast, cfg.freq, cfg.upp, bi)
          : null;
        const upSampledSize = advanced ? advanced.length : upsampledSize(firstReconSize);
        if (upSampledSize > 0) {
          const finalReconSize = Math.min(upSampledSize, n);
          const k = bi % finalReconSize;
          const approxVal = advanced
            ? aget(advanced, k)
            : cfg.upsampleType === 'Sinusoidal Upsample'
              ? sinusoidalUpsampleAt(firstReconstruct, k, cfg.freq, cfg.phase)
              : upsampleAt(firstReconstruct, k);
          const detailVal = softThreshold(downsampledHigh[k], adaptiveThreshold);
          v.reconstructed = !isNa(approxVal) && !isNa(detailVal) ? approxVal + detailVal : NaN;
        }
      }
      // Series := Series * (1 + reconstructed_equity) (on the forming bar from the value of the last confirmed bar)
      if (bi > npast && !isNa(v.reconstructed)) v.series = v.series * (1 + v.reconstructed);
      const time = bars[bi].time;
      // plot(showeq ? Series : na, title = "Cumulative Series", color = color.white)
      s.plot0[bi] = { time, value: cfg.showeq ? value(v.series) : NaN, color: WHITE };
      // plot(showlr ? reconstructed_equity : na, style = plot.style_columns, color = reconstructed_equity > 0 ? #00ff00 : #ff0000)
      s.plot1[bi] = { time, value: cfg.showlr ? value(v.reconstructed) : NaN, color: gt(v.reconstructed, 0) ? UP : DOWN };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<WaveletFilterWithAdaptiveUpsamplingInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<WaveletFilterWithAdaptiveUpsamplingInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}


export const WaveletFilterWithAdaptiveUpsampling = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
