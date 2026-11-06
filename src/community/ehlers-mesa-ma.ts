/**
 * Ehlers MESA Adaptive Moving Average
 *
 * John Ehlers' MESA Adaptive Moving Average using Hilbert Transform
 * cycle measurement to derive an adaptive alpha for MAMA/FAMA, with the original's formulas: the source smoothed
 * (4, 3, 2, 1) / 10, detrender / quadrature / in-phase terms on the previous period, the period from
 * 360 / atan(im / re) (atan in radians) limited to 1.5x / 0.67x of the previous raw period and to 6..50, then smoothed
 * 0.2 / 0.8 with the previous limited period; phase = atan(q1 / i1), alpha = fast limit / max(1, phase change)
 * within the slow / fast limits; MAMA and FAMA start from 0 (nz of their first value), as the original.
 *
 * Outputs as the original's: the MAMA / FAMA crossover arrows (`arrows`, plotarrow "Crossover Markers": +1 when MAMA
 * crosses above FAMA, -1 when it crosses below) with 'Mark crossover points', the hidden "DummyL" plot
 * (max(MAMA, FAMA), circles) with 'Fill MAMA/FAMA Region' and the region fills "NegativeFill" (red, DummyL to MAMA)
 * and "PositiveFill" (green, DummyL to FAMA), and the bar colours (lime / red) with 'Enable Bar colors'. All three
 * are off by default.
 *
 * Reference: "Ehlers MESA Adaptive Moving Average" by LazyBear
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType, type ArrowData } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface EhlersMESAMAInputs {
  src: SourceType;
  fastLimit: number;
  slowLimit: number;
  /** Mark crossover points */
  markCrossovers: boolean;
  /** Fill MAMA/FAMA Region */
  fillRegion: boolean;
  /** Enable Bar colors */
  barColorsOn: boolean;
}

export const defaultInputs: EhlersMESAMAInputs = {
  src: 'hl2',
  fastLimit: 0.5,
  slowLimit: 0.05,
  markCrossovers: false,
  fillRegion: false,
  barColorsOn: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'hl2' },
  { id: 'fastLimit', type: 'float', title: 'Fast Limit', defval: 0.5, min: 0.01, max: 1.0, step: 0.01 },
  { id: 'slowLimit', type: 'float', title: 'Slow Limit', defval: 0.05, min: 0.01, max: 1.0, step: 0.01 },
  { id: 'markCrossovers', type: 'bool', title: 'Mark crossover points', defval: false },
  { id: 'fillRegion', type: 'bool', title: 'Fill MAMA/FAMA Region', defval: false },
  { id: 'barColorsOn', type: 'bool', title: 'Enable Bar colors', defval: false },
];

export const plotConfig: PlotConfig[] = [
  // duml = plot(fr ? (mama > fama ? mama : fama) : na, style=circles, color=gray, linewidth=0, title="DummyL")
  { id: 'duml', title: 'DummyL', color: '#808080', lineWidth: 0, style: 'circles' },
  { id: 'plot0', title: 'MAMA', color: '#FF0000', lineWidth: 2 },
  { id: 'plot1', title: 'FAMA', color: '#008000', lineWidth: 2 },
];

export const metadata = {
  title: 'Ehlers MESA Adaptive Moving Average',
  shortTitle: 'MESA',
  overlay: true,
};

/** nz() of Pine (na and +-infinity give 0) */
const nz = (v: number) => (Number.isFinite(v) ? v : 0);
/** Value `k` bars back (na before the first bar) */
const back = (arr: number[], i: number, k: number) => (i - k >= 0 ? arr[i - k] : NaN);
/** a != b of Pine: false with an na operand */
const ne = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && a !== b;

type Point = { time: number; value: number };
type Result = IndicatorResult & { arrows: ArrowData[]; barColors: BarColorData[] };

interface MesaRun extends BarRunState<Record<string, never>> {
  cross: ReturnType<typeof taStep.cross>;
  s: number[];
  sp: number[];
  dt: number[];
  q1: number[];
  i1: number[];
  i2: number[];
  q2: number[];
  re: number[];
  im: number[];
  p1: number[];
  p3: number[];
  p: number[];
  phase: number[];
  mama: number[];
  fama: number[];
  mamaPlot: Point[];
  famaPlot: Point[];
  dumlPlot: Point[];
  arrows: ArrowData[];
  barColors: BarColorData[];
}

function study(inputs: Partial<EhlersMESAMAInputs>): BarStudy<MesaRun, Result> {
  const { fastLimit: fl, slowLimit: sl, src, markCrossovers, fillRegion, barColorsOn } = { ...defaultInputs, ...inputs };
  const source = barSource(src);
  const value = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const st: MesaRun = {
        cross: taStep.cross(), s: [], sp: [], dt: [], q1: [], i1: [], i2: [], q2: [], re: [], im: [], p1: [], p3: [],
        p: [], phase: [], mama: [], fama: [], mamaPlot: [], famaPlot: [], dumlPlot: [], arrows: [], barColors: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      st.steps = markCrossovers ? [st.cross] : [];
      st.lists = [st.arrows, st.barColors];
      st.series = [
        st.s, st.sp, st.dt, st.q1, st.i1, st.i2, st.q2, st.re, st.im, st.p1, st.p3, st.p, st.phase, st.mama, st.fama,
        st.mamaPlot, st.famaPlot, st.dumlPlot,
      ];
      return st;
    },
    bar(st, i, bars) {
      const { s, sp, dt, q1, i1, i2, q2, re, im, p1, p3, p, phase, mama, fama } = st;
      const b = bars[i];
      s[i] = source(b);
      /** (.0962*x + .5769*nz(x[2]) - .5769*nz(x[4]) - .0962*nz(x[6])) * (.075*nz(p[1]) + .54) */
      const hilbert = (x: number[], i: number) =>
        (0.0962 * x[i] + 0.5769 * nz(back(x, i, 2)) - 0.5769 * nz(back(x, i, 4)) - 0.0962 * nz(back(x, i, 6)))
        * (0.075 * nz(back(p, i, 1)) + 0.54);

      // sp = (4*src + 3*src[1] + 2*src[2] + src[3]) / 10.0 (na on the first 3 bars)
      sp[i] = (4 * s[i] + 3 * back(s, i, 1) + 2 * back(s, i, 2) + back(s, i, 3)) / 10;
      dt[i] = hilbert(sp, i);
      q1[i] = hilbert(dt, i);
      i1[i] = nz(back(dt, i, 3));
      const jI = hilbert(i1, i);
      const jq = hilbert(q1, i);
      const i2_ = i1[i] - jq;
      const q2_ = q1[i] + jI;
      i2[i] = 0.2 * i2_ + 0.8 * nz(back(i2, i, 1));
      q2[i] = 0.2 * q2_ + 0.8 * nz(back(q2, i, 1));
      const re_ = i2[i] * nz(back(i2, i, 1)) + q2[i] * nz(back(q2, i, 1));
      const im_ = i2[i] * nz(back(q2, i, 1)) - q2[i] * nz(back(i2, i, 1));
      re[i] = 0.2 * re_ + 0.8 * nz(back(re, i, 1));
      im[i] = 0.2 * im_ + 0.8 * nz(back(im, i, 1));
      // p1 = iff(im!=0 and re!=0, 360/atan(im/re), nz(p[1]))
      p1[i] = ne(im[i], 0) && ne(re[i], 0) ? 360 / Math.atan(im[i] / re[i]) : nz(back(p, i, 1));
      // p2 = iff(p1 > 1.5*nz(p1[1]), 1.5*nz(p1[1]), iff(p1 < 0.67*nz(p1[1]), 0.67*nz(p1[1]), p1))
      const prevP1 = nz(back(p1, i, 1));
      const p2 = p1[i] > 1.5 * prevP1 ? 1.5 * prevP1 : p1[i] < 0.67 * prevP1 ? 0.67 * prevP1 : p1[i];
      // p3 = iff(p2<6, 6, iff(p2 > 50, 50, p2))
      p3[i] = p2 < 6 ? 6 : p2 > 50 ? 50 : p2;
      // p = .2*p3 + .8*nz(p3[1])
      p[i] = 0.2 * p3[i] + 0.8 * nz(back(p3, i, 1));
      // phase = atan(q1 / i1): a plain division (x / 0 is +-infinity, 0 / 0 na)
      phase[i] = Math.atan(q1[i] / i1[i]);
      // dphase = iff(dphase_ < 1, 1, dphase_), dphase_ = nz(phase[1]) - phase (na stays na)
      const dphase_ = nz(back(phase, i, 1)) - phase[i];
      const dphase = dphase_ < 1 ? 1 : dphase_;
      // alpha = iff(alpha_ < sl, sl, iff(alpha_ > fl, fl, alpha_)), alpha_ = fl / dphase
      const alpha_ = fl / dphase;
      const alpha = alpha_ < sl ? sl : alpha_ > fl ? fl : alpha_;
      mama[i] = alpha * s[i] + (1 - alpha) * nz(back(mama, i, 1));
      fama[i] = 0.5 * alpha * mama[i] + (1 - 0.5 * alpha) * nz(back(fama, i, 1));

      const time = b.time;
      const m = mama[i];
      const f = fama[i];
      st.mamaPlot[i] = { time, value: value(m) };
      st.famaPlot[i] = { time, value: value(f) };
      st.dumlPlot[i] = { time, value: fillRegion ? value(m > f ? m : f) : NaN };

      // plotarrow(pa ? (cross(mama, fama) ? mama < fama ? -1 : 1 : na) : na, title="Crossover Markers")
      if (markCrossovers && st.cross.step(m, f)) {
        const v = m < f ? -1 : 1;
        st.arrows.push({ time, id: 'arrow0', value: v, color: v > 0 ? '#00FF00' : '#FF0000' });
      }
      // barcolor(ebc ? bc : na), bc = mama > fama ? lime : red (na compares false: red)
      if (barColorsOn) st.barColors.push({ time, color: m > f ? '#00FF00' : '#FF0000', id: 'barcolor0' });
    },
    result(st) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { duml: st.dumlPlot.slice(), plot0: st.mamaPlot.slice(), plot1: st.famaPlot.slice() },
        // fill(duml, mamal, red, transp=70, title="NegativeFill") / fill(duml, famal, green, transp=70, title="PositiveFill")
        fills: [
          { plot1: 'duml', plot2: 'plot0', options: { title: 'NegativeFill', color: 'rgba(255, 0, 0, 0.3)' } },
          { plot1: 'duml', plot2: 'plot1', options: { title: 'PositiveFill', color: 'rgba(0, 128, 0, 0.3)' } },
        ],
        arrows: st.arrows.slice(),
        barColors: st.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EhlersMESAMAInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<EhlersMESAMAInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const EhlersMESAMA = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
