/**
 * LGMM (flat buffers) - multivariate poly + latent states
 *
 * A rolling least-squares fit of the source on the features x = [1, t, (t^2), p1..pK] (t = bar index, pk = latent
 * state weights) over the last `trainBars` bars. The sums A = sum(x x') and b = sum(x y) are kept in ring buffers
 * (the oldest row is subtracted when the window is full) and A beta = b is solved by Gauss-Jordan elimination (a
 * pivot below 1e-9 is replaced by 1e-9). The fair value is beta . x. The state weights are triangular memberships of
 * the window segments, or normal densities of the bar index from the "mu,sigma;..." pairs input, normalised to a sum
 * of 1. Bands: fair value +- mult * stdev(src - fair value, trainBars) * (1 + entropy(p) / log(K)). Buy when the lower
 * band crosses over the source, Sell when the upper band crosses under it.
 *
 * Reference: "LGMM (flat buffers) — multivariate poly + latent states" by vsov
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, array, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface LgmmMultivariatePolyLatentStatesInputs {
  /** Price source */
  src: SourceType;
  /** Training window */
  trainBars: number;
  /** Polynomial degree (1 or 2) */
  polyDeg: number;
  /** Hidden states (1 to 3) */
  nStates: number;
  /** Band width (x sigma) */
  stdMult: number;
  /** Offline mu,sigma pairs ("mu1,sigma1;mu2,sigma2; ..."); empty: triangular segment weights */
  gmmParams: string;
}

export const defaultInputs: LgmmMultivariatePolyLatentStatesInputs = {
  src: 'close',
  trainBars: 252,
  polyDeg: 2,
  nStates: 3,
  stdMult: 2.0,
  gmmParams: '',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Price source', defval: 'close' },
  { id: 'trainBars', type: 'int', title: 'Training window', defval: 252, min: 50 },
  { id: 'polyDeg', type: 'int', title: 'Polynomial degree', defval: 2, min: 1, max: 2, step: 1 }, // Pine options = [1, 2]
  { id: 'nStates', type: 'int', title: 'Hidden states (K≤3)', defval: 3, min: 1, max: 3 },
  { id: 'stdMult', type: 'float', title: 'Band width (×σ)', defval: 2.0, min: 0.5 },
  { id: 'gmmParams', type: 'string', title: 'Offline μ,σ pairs (μ1,σ1;μ2,σ2; …)', defval: '' },
];

const UPPER_COL = String(color.new(color.green, 0));
const LOWER_COL = String(color.new(color.red, 0));
const FILL_COL = String(color.new(color.gray, 85));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fair value', color: color.orange, lineWidth: 1 },
  { id: 'plot1', title: 'Upper band', color: UPPER_COL, lineWidth: 1 },
  { id: 'plot2', title: 'Lower band', color: LOWER_COL, lineWidth: 1 },
];

export const metadata = {
  title: 'LGMM (flat buffers) — multivariate poly + latent states',
  shortTitle: 'LGMM (flat buffers) — multivariate poly + latent states',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** Pine str.tonumber: na when the text is not a number */
const toNumber = (s: string) => (s.trim() === '' ? NaN : Number(s));

/** Pine array.get with a bounds check (runtime error as Pine) */
function get<T>(arr: T[], i: number): T {
  if (i < 0 || i >= arr.length) throw new Error(`Index ${i} is out of bounds, array size is ${arr.length}`);
  return arr[i];
}

function normalPdf(x: number, mu: number, sigma: number): number {
  const inv = 1.0 / (Math.sqrt(2.0 * Math.PI) * sigma);
  return inv * Math.exp(-Math.pow(x - mu, 2) / (2.0 * Math.pow(sigma, 2)));
}

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };
type Point = { time: number; value: number; color: string };

interface LgmmVars {
  /** sum x x', sum x y, the ring buffers of the window rows (changed in place) */
  aFlat: number[];
  bVec: number[];
  histFeat: number[];
  histY: number[];
  ptr: number;
  seen: number;
}

interface LgmmRun extends BarRunState<LgmmVars> {
  sd: ReturnType<typeof taStep.stdev>;
  buyX: ReturnType<typeof taStep.crossover>;
  sellX: ReturnType<typeof taStep.crossunder>;
  fair: Point[];
  upper: Point[];
  lower: Point[];
  markers: MarkerData[];
}

function study(inputs: Partial<LgmmMultivariatePolyLatentStatesInputs>): BarStudy<LgmmRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { trainBars, polyDeg, nStates, stdMult, gmmParams } = cfg;
  const value = barSource(cfg.src);
  const d = (Number(polyDeg) === 1 ? 2 : 3) + nStates; // [1, t, (t^2), p1..pK]
  const mat = (i: number, j: number) => i * d + j;
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const sd = taStep.stdev();
      const buyX = taStep.crossover();
      const sellX = taStep.crossunder();
      const s: LgmmRun = {
        sd, buyX, sellX, fair: [], upper: [], lower: [], markers: [],
        steps: [sd, buyX, sellX],
        vars: {
          aFlat: new Array(d * d).fill(0.0), // sum x x'
          bVec: new Array(d).fill(0.0), // sum x y
          histFeat: new Array(trainBars * d).fill(NaN),
          histY: new Array(trainBars).fill(NaN),
          ptr: 0,
          seen: 0,
        },
        lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.fair, s.upper, s.lower];
      return s;
    },
    copyVars: (v) => ({ ...v, aFlat: v.aFlat.slice(), bVec: v.bVec.slice(), histFeat: v.histFeat.slice(), histY: v.histY.slice() }),
    bar(s, bi, bars) {
      const v = s.vars;
      const { aFlat, bVec, histFeat, histY } = v;
      const t = bi;

      // Latent probabilities p1..pK
      const p: number[] = new Array(nStates).fill(0.0);
      if (gmmParams.length > 0) {
        const parts = gmmParams.split(';');
        for (let k = 0; k <= Math.min(parts.length - 1, nStates - 1); k++) {
          const f = get(parts, k).split(',');
          const mu = toNumber(get(f, 0));
          const sgRaw = toNumber(get(f, 1));
          const sg = isNaN(sgRaw) ? NaN : Math.max(sgRaw, 1e-6);
          p[k] = normalPdf(t, mu, sg);
        }
      } else {
        const seg = trainBars / nStates;
        for (let k = 0; k <= nStates - 1; k++) {
          const mid = (k + 0.5) * seg;
          const dist = Math.abs(t - (bi - mid));
          p[k] = Math.max(0.0, 1.0 - dist / seg);
        }
      }
      // Normalise
      const sumP = array.sum(p);
      for (let k = 0; k <= nStates - 1; k++) p[k] = p[k] / sumP;

      const x: number[] = [1.0, t];
      if (Number(polyDeg) === 2) x.push(t * t);
      for (let k = 0; k <= nStates - 1; k++) x.push(p[k]);
      const y = value(bars[bi]);

      // Rolling-sum update
      const windowFull = v.seen >= trainBars;
      const base = v.ptr * d;
      // 1) remove the outgoing row
      if (windowFull) {
        const oldY = histY[v.ptr];
        for (let i = 0; i < d; i++) {
          const oldXi = histFeat[base + i];
          if (!isNaN(oldXi)) {
            bVec[i] = bVec[i] - oldXi * oldY;
            for (let j = 0; j < d; j++) {
              const idx = mat(i, j);
              aFlat[idx] = aFlat[idx] - oldXi * histFeat[base + j];
            }
          }
        }
      }
      // 2) write the new row into the buffers
      for (let i = 0; i < d; i++) histFeat[base + i] = x[i];
      histY[v.ptr] = y;
      // 3) add the new row
      for (let i = 0; i < d; i++) {
        const xi = x[i];
        bVec[i] = bVec[i] + xi * y;
        for (let j = 0; j < d; j++) {
          const idx = mat(i, j);
          aFlat[idx] = aFlat[idx] + xi * x[j];
        }
      }
      v.ptr = (v.ptr + 1) % trainBars;
      v.seen = v.seen + 1;

      // Solve A beta = b by Gauss-Jordan
      let pred = NaN;
      if (v.seen >= trainBars) {
        const a = aFlat.slice();
        const b = bVec.slice();
        for (let k = 0; k < d; k++) {
          let piv = a[mat(k, k)];
          piv = lt(Math.abs(piv), 1e-9) ? 1e-9 : piv;
          const inv = 1.0 / piv;
          for (let j = 0; j < d; j++) {
            const idx = mat(k, j);
            a[idx] = a[idx] * inv;
          }
          b[k] = b[k] * inv;
          for (let i = 0; i < d; i++) {
            if (i !== k) {
              const factor = a[mat(i, k)];
              if (gt(Math.abs(factor), 1e-12)) {
                for (let j = 0; j < d; j++) {
                  const idx = mat(i, j);
                  a[idx] = a[idx] - factor * a[mat(k, j)];
                }
                b[i] = b[i] - factor * b[k];
              }
            }
          }
        }
        let dot = 0.0;
        for (let i = 0; i < d; i++) dot += b[i] * x[i];
        pred = dot;
      }

      const res = isNaN(pred) ? NaN : y - pred;
      let entropy = 0.0;
      for (let k = 0; k <= nStates - 1; k++) {
        const pk = p[k];
        entropy -= pk * Math.log(pk + 1e-12);
      }
      // A plain division: log(1) = 0 with one state gives +-infinity, as in Pine
      const wFac = 1.0 + entropy / Math.log(nStates);

      const band = s.sd.step(res, trainBars) * wFac;
      const upper = pred + stdMult * band;
      const lower = pred - stdMult * band;
      const buy = s.buyX.step(lower, y);
      const sell = s.sellX.step(upper, y);

      const time = bars[bi].time;
      if (buy) s.markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: color.green, size: 'tiny' });
      if (sell) s.markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'tiny' });
      s.fair[bi] = { time, value: fin(pred), color: color.orange };
      s.upper[bi] = { time, value: fin(upper), color: UPPER_COL };
      s.lower[bi] = { time, value: fin(lower), color: LOWER_COL };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.fair.slice(), plot1: s.upper.slice(), plot2: s.lower.slice() },
        fills: [{ plot1: 'plot1', plot2: 'plot2', options: { color: FILL_COL } }],
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<LgmmMultivariatePolyLatentStatesInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<LgmmMultivariatePolyLatentStatesInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const LgmmMultivariatePolyLatentStates = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
