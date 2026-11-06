/**
 * MAMA - FAMA (Ehlers) [KN]
 *
 * Ehlers MESA Adaptive Moving Average. A 4-bar weighted smooth of the source goes through a Hilbert transform
 * (coefficients 0.0962 / 0.5769, scaled by 0.075 * period[1] + 0.54) to get the in-phase (I1) and quadrature (Q1)
 * parts; a homodyne discriminator gives the cycle period (clamped to 0.67..1.5 times the previous period and to
 * 6..50 bars). The phase is atan(Q1 / I1); alpha = fastLimit / max(phase[1] - phase, 1), clamped to
 * slowLimit..fastLimit. MAMA = alpha * src + (1 - alpha) * MAMA[1]; FAMA = 0.5 * alpha * MAMA + (1 - 0.5 * alpha) *
 * FAMA[1]. Both lines are blue when MAMA is above FAMA, orange when below, gray when equal; triangles mark the
 * crosses.
 *
 * Reference: "MAMA - FAMA (Ehlers) [KN]" by KatherinaNote
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MamaFamaInputs {
  /** Fast limit of alpha */
  fastLimit: number;
  /** Slow limit of alpha */
  slowLimit: number;
  /** Source */
  src: SourceType;
}

export const defaultInputs: MamaFamaInputs = {
  fastLimit: 0.5,
  slowLimit: 0.05,
  src: 'hl2',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLimit', type: 'float', title: 'Fast Limit', defval: 0.5, min: 0.01, max: 1.0 },
  { id: 'slowLimit', type: 'float', title: 'Slow Limit', defval: 0.05, min: 0.01, max: 0.5 },
  { id: 'src', type: 'source', title: 'Source', defval: 'hl2' },
];

const BLUE = String(color.rgb(30, 144, 255));
const ORANGE = String(color.rgb(244, 164, 96));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MAMA', color: BLUE, lineWidth: 2 },
  { id: 'plot1', title: 'FAMA', color: BLUE, lineWidth: 2 },
];

export const metadata = {
  title: 'MAMA - FAMA (Ehlers) [KN]',
  shortTitle: 'MAMA - FAMA (Ehlers) [KN]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; a != b only when |a - b| > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ne = (a: number, b: number) => Math.abs(a - b) > EPS;
const nz = (x: number, r = 0) => (Number.isFinite(x) ? x : r);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };
type Point = { time: number; value: number; color?: string };

interface MamaVars {
  /** var arrays of 7 history values (index 0 = current bar), initialised to 0.0 (changed in place, copied) */
  smoothHist: number[];
  detrendHist: number[];
  I1Hist: number[];
  Q1Hist: number[];
  /** var floats: the value of the previous bar is the history value [1] (na before bar 0) */
  period: number;
  periodPrev: number;
  periodPrev2: number;
  smoothPeriodPrev: number;
  phase: number;
  phasePrev: number;
  I2Prev: number;
  Q2Prev: number;
  RePrev: number;
  ImPrev: number;
  mamaPrev: number;
  famaPrev: number;
}

interface MamaRun extends BarRunState<MamaVars> {
  srcArr: number[];
  mama: number[];
  fama: number[];
  detrH: number[];
  plots: Point[][];
  markers: MarkerData[];
}

function study(inputs: Partial<MamaFamaInputs>): BarStudy<MamaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { fastLimit, slowLimit } = cfg;
  const source = barSource(cfg.src);
  const shift = (arr: number[], v: number) => {
    for (let k = 6; k >= 1; k--) arr[k] = arr[k - 1];
    arr[0] = v;
  };
  // htCoef(idx, hist): (0.0962 * h0 + 0.5769 * h2 - 0.5769 * h4 - 0.0962 * h6) * (0.075 * nz(period[1]) + 0.54).
  // Pine rule: `period[1]` read inside a user function, before the global `period` is assigned on the bar, gives
  // the value of two bars ago (the global history of the current bar is not open yet).
  const htCoef = (h: number[], periodPrev2: number) =>
    (0.0962 * h[0] + 0.5769 * h[2] - 0.5769 * h[4] - 0.0962 * h[6]) * (0.075 * nz(periodPrev2) + 0.54);
  // mamaColor = mama > fama ? blue : mama < fama ? orange : color.gray
  const colorOf = (m: number, f: number) => (gt(m, f) ? BLUE : gt(f, m) ? ORANGE : color.gray);
  const val = (x: number) => (Number.isFinite(x) ? x : NaN);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: MamaRun = {
        srcArr: [], mama: [], fama: [], detrH: [], plots: [[], []], markers: [], steps: [],
        vars: {
          smoothHist: new Array(7).fill(0), detrendHist: new Array(7).fill(0), I1Hist: new Array(7).fill(0),
          Q1Hist: new Array(7).fill(0), period: 0.0, periodPrev: NaN, periodPrev2: NaN, smoothPeriodPrev: NaN,
          phase: 0.0, phasePrev: NaN, I2Prev: NaN, Q2Prev: NaN, RePrev: NaN, ImPrev: NaN, mamaPrev: NaN, famaPrev: NaN,
        },
        lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.srcArr, s.mama, s.fama, s.detrH, ...s.plots];
      return s;
    },
    copyVars: (v) => ({
      ...v, smoothHist: v.smoothHist.slice(), detrendHist: v.detrendHist.slice(), I1Hist: v.I1Hist.slice(),
      Q1Hist: v.Q1Hist.slice(),
    }),
    bar(st, i, bars) {
      const v = st.vars;
      const srcArr = st.srcArr;
      const src: number = source(bars[i]) ?? NaN;
      srcArr[i] = src;

      const smooth = (4.0 * src + 3.0 * nz(i >= 1 ? srcArr[i - 1] : NaN) + 2.0 * nz(i >= 2 ? srcArr[i - 2] : NaN) +
        nz(i >= 3 ? srcArr[i - 3] : NaN)) / 10.0;
      shift(v.smoothHist, smooth);

      const cof1 = htCoef(v.smoothHist, v.periodPrev2);
      const detrender = i > 5 ? cof1 : smooth;
      st.detrH[i] = detrender;
      shift(v.detrendHist, detrender);

      const cof2 = htCoef(v.detrendHist, v.periodPrev2);
      const Q1 = i > 5 ? cof2 : detrender;
      // I1 := nz(detrender[3], detrender)
      const I1 = nz(i - 3 >= 0 ? st.detrH[i - 3] : NaN, detrender);
      shift(v.I1Hist, I1);
      shift(v.Q1Hist, Q1);

      const cof3 = htCoef(v.I1Hist, v.periodPrev2);
      const cof4 = htCoef(v.Q1Hist, v.periodPrev2);
      const JI = i > 5 ? cof3 : I1;
      const JQ = i > 5 ? cof4 : Q1;

      const I2 = 0.2 * (I1 - JQ) + 0.8 * nz(v.I2Prev);
      const Q2 = 0.2 * (Q1 + JI) + 0.8 * nz(v.Q2Prev);

      const Re = 0.2 * (I2 * nz(v.I2Prev) + Q2 * nz(v.Q2Prev)) + 0.8 * nz(v.RePrev);
      const Im = 0.2 * (I2 * nz(v.Q2Prev) - Q2 * nz(v.I2Prev)) + 0.8 * nz(v.ImPrev);

      let period = v.period;
      if (ne(Re, 0) && ne(Im, 0)) {
        period = 360.0 / (Math.atan(Im / Re) * (180.0 / Math.PI));
      }
      period = Math.min(period, 1.5 * nz(v.periodPrev, period));
      period = Math.max(period, 0.67 * nz(v.periodPrev, period));
      period = Math.max(Math.min(period, 50), 6);
      v.period = period;
      const smoothPeriod = 0.2 * period + 0.8 * nz(v.smoothPeriodPrev, period);

      if (ne(I1, 0)) {
        v.phase = Math.atan(Q1 / I1) * (180.0 / Math.PI);
      }
      const phase = v.phase;

      const deltaPhase = Math.max(nz(v.phasePrev) - phase, 1.0);
      const alpha = Math.max(Math.min(fastLimit / deltaPhase, fastLimit), slowLimit);

      const m = alpha * src + (1.0 - alpha) * nz(v.mamaPrev, src);
      const f = 0.5 * alpha * m + (1.0 - 0.5 * alpha) * nz(v.famaPrev, src);
      st.mama[i] = m;
      st.fama[i] = f;

      v.periodPrev2 = v.periodPrev;
      v.periodPrev = period;
      v.smoothPeriodPrev = smoothPeriod;
      v.phasePrev = phase;
      v.I2Prev = I2;
      v.Q2Prev = Q2;
      v.RePrev = Re;
      v.ImPrev = Im;
      v.mamaPrev = m;
      v.famaPrev = f;

      if (i >= 1) {
        const pm = st.mama[i - 1];
        const pf = st.fama[i - 1];
        // ta.crossover / ta.crossunder: exact comparisons (no 1e-10 tolerance)
        if (m > f && pm <= pf) {
          st.markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: BLUE, size: 'small' });
        }
        if (m < f && pm >= pf) {
          st.markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: ORANGE, size: 'small' });
        }
      }
      const c = colorOf(m, f);
      st.plots[0][i] = { time: bars[i].time, value: val(m), color: c };
      st.plots[1][i] = { time: bars[i].time, value: val(f), color: c };
    },
    result(st) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: st.plots[0].slice(), plot1: st.plots[1].slice() },
        markers: st.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MamaFamaInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MamaFamaInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const MamaFama = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
