/**
 * L1 Moving Average Fingerprint for Long Entry
 *
 * Fingerprints 1-6 are the `maLookback`-bar SMAs of the highest high and the lowest low over three lengths (MAGene).
 * Three weighted means of them (coefficients 1-6) are smoothed again, and their weighted mean (3:2:1) times
 * coefficient 7 is smoothed into fingerprint 10. Fingerprint 11 is xsa(|low - low[1]|, 3, 1) / xsa(max(low - low[1],
 * 0), 3, 1) * 100 (xsa: a 3-bar SMA start, then (src + 2 * prev) / 3). It is multiplied by 10 when close * coefficient
 * 8 <= fingerprint 10, else divided by 10, and smoothed over 3 bars (fingerprint 12). On a bar whose low is the
 * lowest low of 13 bars, part = (highest fingerprint 12 over `fpLookback` bars + 2 * fingerprint 11) / 2, else 0.
 * ReadytoLong = SMA(part, 3) / 200. The background is green while ReadytoLong > 0; triangles below the bar mark the
 * crossovers of ReadytoLong above 1.2, 4.5 and 7.0.
 *
 * Reference: "L1 Moving Average Fingerprint for Long Entry" by blackcat1402
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData, MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface L1MovingAverageFingerprintInputs {
  maGene1: number;
  maGene2: number;
  maGene3: number;
  maLookback: number;
  fpLookback: number;
  fpCoeff1: number;
  fpCoeff2: number;
  fpCoeff3: number;
  fpCoeff4: number;
  fpCoeff5: number;
  fpCoeff6: number;
  fpCoeff7: number;
  fpCoeff8: number;
}

export const defaultInputs: L1MovingAverageFingerprintInputs = {
  maGene1: 485,
  maGene2: 222,
  maGene3: 96,
  maLookback: 17,
  fpLookback: 30,
  fpCoeff1: 0.56,
  fpCoeff2: 0.96,
  fpCoeff3: 0.55,
  fpCoeff4: 1.23,
  fpCoeff5: 0.68,
  fpCoeff6: 1.30,
  fpCoeff7: 1.74,
  fpCoeff8: 1.35,
};

export const inputConfig: InputConfig[] = [
  { id: 'maGene1', type: 'int', title: 'MAGene1', defval: 485, min: 1 },
  { id: 'maGene2', type: 'int', title: 'MAGene2', defval: 222, min: 1 },
  { id: 'maGene3', type: 'int', title: 'MAGene3', defval: 96, min: 1 },
  { id: 'maLookback', type: 'int', title: 'MALookback', defval: 17, min: 1 },
  { id: 'fpLookback', type: 'int', title: 'FPLookback', defval: 30, min: 1 },
  { id: 'fpCoeff1', type: 'float', title: 'FPCoeff1', defval: 0.56, min: 0.01 },
  { id: 'fpCoeff2', type: 'float', title: 'FPCoeff2', defval: 0.96, min: 0.01 },
  { id: 'fpCoeff3', type: 'float', title: 'FPCoeff3', defval: 0.55, min: 0.01 },
  { id: 'fpCoeff4', type: 'float', title: 'FPCoeff4', defval: 1.23, min: 0.01 },
  { id: 'fpCoeff5', type: 'float', title: 'FPCoeff5', defval: 0.68, min: 0.01 },
  { id: 'fpCoeff6', type: 'float', title: 'FPCoeff6', defval: 1.30, min: 0.01 },
  { id: 'fpCoeff7', type: 'float', title: 'FPCoeff7', defval: 1.74, min: 0.01 },
  { id: 'fpCoeff8', type: 'float', title: 'FPCoeff8', defval: 1.35, min: 0.01 },
];

// No plot(): the outputs are a bgcolor and three plotchar markers
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'L1 Moving Average Fingerprint for Long Entry',
  shortTitle: 'L1 SMAFP V6',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const nz = (x: number) => (isNaN(x) ? 0 : x);

/**
 * Pine xsa(src, len, wei) on bar i: running sum sum = nz(sum[1]) - nz(src[len]) + src, ma = sum / len (na while
 * src[len] is na), out = ma on the first bar where out[1] is na, then (src * wei + out[1] * (len - wei)) / len.
 * `st` holds sum[1] and out[1] and takes the values of bar i.
 */
function xsaStep(src: number[], i: number, len: number, wei: number, st: { sum: number; out: number }): number {
  const srcLen = i - len >= 0 ? src[i - len] : NaN;
  const sum = nz(st.sum) - nz(srcLen) + src[i];
  const ma = isNaN(srcLen) ? NaN : sum / len;
  const o = isNaN(st.out) ? ma : (src[i] * wei + st.out * (len - wei)) / len;
  st.sum = sum;
  st.out = o;
  return o;
}

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] };

interface L1Vars {
  /** xsa(src1, 3, 1) and xsa(src2, 3, 1): sum[1] and out[1] (changed in place, copied by copyVars) */
  xsa1: { sum: number; out: number };
  xsa2: { sum: number; out: number };
}

interface L1Run extends BarRunState<L1Vars> {
  hi: WindowExtreme[];
  lo: WindowExtreme[];
  fp: WindowSma[];
  mixes: WindowSma[];
  fp10: WindowSma;
  fp12: WindowSma;
  fpH: WindowExtreme;
  lowest13: WindowExtreme;
  ready: WindowSma;
  crosses: ReturnType<typeof taStep.crossover>[];
  src1: number[];
  src2: number[];
  bgColors: BgColorData[];
  markers: MarkerData[];
}

function study(inputs: Partial<L1MovingAverageFingerprintInputs>): BarStudy<L1Run, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { maGene1, maGene2, maGene3, maLookback: L, fpLookback } = cfg;
  const { fpCoeff1: c1, fpCoeff2: c2, fpCoeff3: c3, fpCoeff4: c4, fpCoeff5: c5, fpCoeff6: c6, fpCoeff7: c7,
    fpCoeff8: c8 } = cfg;
  const genes = [maGene1, maGene2, maGene3];
  const bg = String(color.new(color.green, 70));
  // plotchar(ta.crossover(ReadytoLong, level), ...): Pine keeps only the first character of a plotchar char, so
  // '▲▲' and '▲▲▲' are drawn as '▲'
  const levels: [number, string][] = [
    [1.2, String(color.new(color.yellow, 0))],
    [4.5, String(color.new(color.lime, 0))],
    [7.0, String(color.new(color.green, 0))],
  ];
  return {
    init() {
      // the length checks of ta.highest / ta.lowest and ta.sma
      for (const g of genes) taStep.highest().step(0, g);
      taStep.sma().step(0, L);
      taStep.highest().step(0, fpLookback);
      const s: L1Run = {
        hi: genes.map((g) => new WindowExtreme(false, g)), lo: genes.map((g) => new WindowExtreme(true, g)),
        fp: Array.from({ length: 6 }, () => new WindowSma(L)), mixes: Array.from({ length: 3 }, () => new WindowSma(L)),
        fp10: new WindowSma(L), fp12: new WindowSma(3), fpH: new WindowExtreme(false, fpLookback),
        lowest13: new WindowExtreme(true, 13), ready: new WindowSma(3),
        crosses: levels.map(() => taStep.crossover()), src1: [], src2: [], bgColors: [], markers: [],
        steps: [], vars: { xsa1: { sum: NaN, out: NaN }, xsa2: { sum: NaN, out: NaN } }, lists: [], series: [],
      };
      s.steps = [...s.hi, ...s.lo, ...s.fp, ...s.mixes, s.fp10, s.fp12, s.fpH, s.lowest13, s.ready, ...s.crosses];
      s.lists = [s.bgColors, s.markers];
      s.series = [s.src1, s.src2];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const low = b.low;
      // Basic fingerprints (highest highs and lowest lows smoothed)
      const fp1 = s.fp[0].step(s.hi[0].step(b.high));
      const fp2 = s.fp[1].step(s.hi[1].step(b.high));
      const fp3 = s.fp[2].step(s.hi[2].step(b.high));
      const fp4 = s.fp[3].step(s.lo[0].step(low));
      const fp5 = s.fp[4].step(s.lo[1].step(low));
      const fp6 = s.fp[5].step(s.lo[2].step(low));

      // Composite fingerprints with coefficients
      const fp7 = s.mixes[0].step((fp1 * c1 + fp2 * c1 + fp3 * c1 + fp4 * c2 + fp5 * c2 + fp6 * c2) / 6);
      const fp8 = s.mixes[1].step((fp1 * c3 + fp2 * c3 + fp3 * c3 + fp4 * c4 + fp5 * c4 + fp6 * c4) / 6);
      const fp9 = s.mixes[2].step((fp1 * c5 + fp2 * c5 + fp3 * c5 + fp4 * c6 + fp5 * c6 + fp6 * c6) / 6);
      const fp10 = s.fp10.step((fp7 * 3 + fp8 * 2 + fp9) / 6 * c7);

      // Specialized fingerprint using xsa (low[1] is na on bar 0)
      const prevLow = i > 0 ? bars[i - 1].low : NaN;
      s.src1[i] = i > 0 ? Math.abs(low - prevLow) : NaN;
      s.src2[i] = i > 0 ? Math.max(low - prevLow, 0) : NaN;
      const xsa1 = xsaStep(s.src1, i, 3, 1, v.xsa1);
      const xsa2 = xsaStep(s.src2, i, 3, 1, v.xsa2);
      // A plain division: x / 0 is +-infinity (0 / 0 NaN), the infinite value is used as in Pine
      const fp11 = xsa1 / xsa2 * 100;

      const value = le(b.close * c8, fp10) ? fp11 * 10 : fp11 / 10;
      const fp12 = s.fp12.step(value);

      // Final fingerprint calculations
      const fpH = s.fpH.step(fp12);
      const lowest13 = s.lowest13.step(low);
      const part = le(low, lowest13) ? (fpH + fp11 * 2) / 2 : 0;
      const readyToLong = s.ready.step(part) / 200;

      if (gt(readyToLong, 0)) s.bgColors.push({ time: b.time, color: bg });
      for (let k = 0; k < levels.length; k++) {
        if (s.crosses[k].step(readyToLong, levels[k][0])) {
          // ids char0 / char1 / char2: the three plotchar outputs in declaration order
          s.markers.push({ time: b.time, position: 'belowBar', shape: 'circle', color: 'transparent', text: '▲',
            textColor: levels[k][1], size: 'small', id: `char${k}` });
        }
      }
    },
    copyVars: (v) => ({ xsa1: { ...v.xsa1 }, xsa2: { ...v.xsa2 } }),
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<L1MovingAverageFingerprintInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<L1MovingAverageFingerprintInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const L1MovingAverageFingerprint = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
