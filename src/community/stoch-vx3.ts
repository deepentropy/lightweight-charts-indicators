/**
 * Stoch VX3
 *
 * As the original: K = SMA(stoch(close, high, low, length), smoothK) (blue), D = SMA(K, smoothD) (red), the
 * percentile rank over 'PRO-Top bars of a Laguerre PPO of hl2 (gammas "LONG" 0.3 and "SHORT" 0.5:
 * (fast - slow) / slow * 100) as a gray line, and black circles at D on the bars where D crosses K. Background black
 * while K is not above or equal to D (also before both exist), teal otherwise (transparency 80). Levels 80 / 20 red,
 * width 2, in the default dashed style.
 *
 * Reference: "Stoch VX3"
 */

import { taStep, compare, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun, WindowSma } from '../live-run';

export interface StochVX3Inputs {
  len: number;
  smoothK: number;
  smoothD: number;
  pctile: number;
  wrnpctile: number;
  /** Laguerre gamma of the fast line (title "LONG") */
  shortGamma: number;
  /** Laguerre gamma of the slow line (title "SHORT") */
  longGamma: number;
  lkbT: number;
  lkbB: number;
}

export const defaultInputs: StochVX3Inputs = {
  len: 13,
  smoothK: 5,
  smoothD: 5,
  pctile: 90,
  wrnpctile: 70,
  shortGamma: 0.3,
  longGamma: 0.5,
  lkbT: 144,
  lkbB: 144,
};

// Untitled inputs keep their variable names as titles
export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'length', defval: 13, min: 1 },
  { id: 'smoothK', type: 'int', title: 'smoothK', defval: 5, min: 1 },
  { id: 'smoothD', type: 'int', title: 'smoothD', defval: 5, min: 1 },
  { id: 'pctile', type: 'int', title: '%', defval: 90 },
  { id: 'wrnpctile', type: 'int', title: ' %', defval: 70 },
  { id: 'shortGamma', type: 'float', title: 'LONG', defval: 0.3 },
  { id: 'longGamma', type: 'float', title: 'SHORT', defval: 0.5 },
  { id: 'lkbT', type: 'int', title: "'PRO-Top", defval: 144 },
  { id: 'lkbB', type: 'int', title: "'PRO-Bottom", defval: 144 },
];

/** Pine version 1 colours */
const BLUE = '#0000FF';
const RED = '#FF0000';
const GRAY = '#808080';
const BLACK = '#000000';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Plot', color: BLUE, lineWidth: 1 },
  { id: 'plot1', title: 'Plot', color: RED, lineWidth: 2 },
  { id: 'plot2', title: 'Percentile Rank Columns', color: GRAY, lineWidth: 1 },
  { id: 'plot3', title: 'Plot', color: BLACK, lineWidth: 4, style: 'circles' },
];

export const metadata = {
  title: 'Stoch VX3',
  shortTitle: 'StochVX3',
  overlay: false,
};

/** ta.percentrank(source, length) of bar i from the values of every bar (the array rules of oakscriptjs) */
function percentrankAt(source: number[], i: number, length: number): number {
  if (i < length) return NaN;
  const currentValue = source[i];
  // le() is false for an na value in the window, and for all of them when the current value is na (0)
  let countLessOrEqual = 0;
  for (let j = 1; j <= length; j++) if (compare.le(source[i - j], currentValue)) countLessOrEqual++;
  return (countLessOrEqual * 100) / length;
}

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { bgColors: BgColorData[] };

/** lag(g, p) of the original: the Laguerre filter state L0..L3 (na before the first bar) */
type LaguerreState = [number, number, number, number];

interface StochVx3Vars {
  lmas: LaguerreState;
  lmal: LaguerreState;
  prevK: number;
  prevD: number;
}

interface StochVx3Run extends BarRunState<StochVx3Vars> {
  stoch: ReturnType<typeof taStep.stoch>;
  smaK: WindowSma;
  smaD: WindowSma;
  ppo: number[];
  plots: Point[][];
  bgColors: BgColorData[];
}

const nzF = (v: number) => (Number.isFinite(v) ? v : 0);

/** One bar of the Laguerre filter (L0 + 2 L1 + 2 L2 + L3) / 6; the state is changed in place */
function laguerreStep(g: number, l: LaguerreState, v: number): number {
  const n0 = (1 - g) * v + g * nzF(l[0]);
  const n1 = -g * n0 + nzF(l[0]) + g * nzF(l[1]);
  const n2 = -g * n1 + nzF(l[1]) + g * nzF(l[2]);
  const n3 = -g * n2 + nzF(l[2]) + g * nzF(l[3]);
  l[0] = n0; l[1] = n1; l[2] = n2; l[3] = n3;
  return (n0 + 2 * n1 + 2 * n2 + n3) / 6;
}

function study(inputs: Partial<StochVX3Inputs>): BarStudy<StochVx3Run, Result> {
  const { len, smoothK, smoothD, shortGamma, longGamma, lkbT } = { ...defaultInputs, ...inputs };
  const num = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      const s: StochVx3Run = {
        stoch: taStep.stoch(len), smaK: new WindowSma(smoothK), smaD: new WindowSma(smoothD), ppo: [],
        plots: [[], [], [], []], bgColors: [],
        steps: [],
        vars: { lmas: [NaN, NaN, NaN, NaN], lmal: [NaN, NaN, NaN, NaN], prevK: NaN, prevD: NaN },
        lists: [], series: [],
      };
      s.steps = [s.stoch, s.smaK, s.smaD];
      s.series = [s.ppo, ...s.plots, s.bgColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const time = b.time;
      const k = s.smaK.step(s.stoch.step(b.close, b.high, b.low));
      const d = s.smaD.step(k);

      const hl2 = (b.high + b.low) / 2;
      const lmas = laguerreStep(shortGamma, v.lmas, hl2);
      const lmal = laguerreStep(longGamma, v.lmal, hl2);
      const ppoT = (lmas - lmal) / lmal * 100;
      s.ppo[i] = ppoT;
      const pctRankT = percentrankAt(s.ppo, i, lkbT);

      s.plots[0][i] = { time, value: num(k) };
      s.plots[1][i] = { time, value: num(d) };
      s.plots[2][i] = { time, value: num(pctRankT), color: GRAY };
      // plot(cross(d, k) ? d : na, color=black, style=circles, linewidth=4)
      const d1 = v.prevD, k1 = v.prevK;
      v.prevD = d;
      v.prevK = k;
      const cross = (d > k && d1 <= k1) || (d < k && d1 >= k1);
      s.plots[3][i] = { time, value: cross ? d : NaN, color: BLACK };

      // OutputSignal = k >= d ? 0 : 1 (na compares false: 1); bgcolor(OutputSignal > 0 ? #000000 : #128E89, transp=80)
      const black = !(k >= d);
      s.bgColors[i] = { id: 'bgcolor0', time, color: black ? 'rgba(0, 0, 0, 0.20)' : 'rgba(18, 142, 137, 0.20)' };
    },
    copyVars: (v) => ({ ...v, lmas: [...v.lmas], lmal: [...v.lmal] }),
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plots[0].slice(), 'plot1': s.plots[1].slice(), 'plot2': s.plots[2].slice(), 'plot3': s.plots[3].slice() },
        // hline(80 / 20, color=red, linewidth=2): Pine v1 red, Pine default line style (dashed)
        hlines: [
          { value: 80, options: { color: RED, linestyle: 'dashed' as const, linewidth: 2, title: 'Overbought' } },
          { value: 20, options: { color: RED, linestyle: 'dashed' as const, linewidth: 2, title: 'Oversold' } },
        ],
        // fill between ob/os hlines (Pine: fill(h0, h1, color=purple, transp=100) - fully transparent, decorative)
        fills: [
          { plot1: 'overbought', plot2: 'oversold', options: { color: 'rgba(156, 39, 176, 0.0)' } },
        ],
        bgColors: s.bgColors.slice(),
      } as Result;
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<StochVX3Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<StochVX3Inputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const StochVX3 = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
