/**
 * Laguerre RSI
 *
 * Four-element Laguerre filter applied to price, then RSI-like ratio
 * of cumulative ups / (cumulative ups + cumulative downs) across filter stages.
 * gamma controls responsiveness (higher = smoother).
 *
 * Reference: "laguerre RSI v4" by TheLark
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface LaguerreRSIInputs {
  gamma: number;
  smooth: number;
}

export const defaultInputs: LaguerreRSIInputs = {
  gamma: 0.75,
  smooth: 1,
};

export const inputConfig: InputConfig[] = [
  { id: 'gamma', type: 'float', title: 'Gamma', defval: 0.75, min: 0, max: 1, step: 0.01 },
  { id: 'smooth', type: 'int', title: 'Smoothing (1 = off)', defval: 1, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Laguerre RSI', color: '#26A69A', lineWidth: 2 },
];

export const metadata = {
  title: 'Laguerre RSI',
  shortTitle: 'LRSI',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };

interface LaguerreVars {
  L0: number;
  L1: number;
  L2: number;
  L3: number;
}

interface LaguerreRun extends BarRunState<LaguerreVars> {
  ema: ReturnType<typeof taStep.ema> | null;
  finalArr: number[];
  plot0: Point[];
}

function study(inputs: Partial<LaguerreRSIInputs>): BarStudy<LaguerreRun, IndicatorResult> {
  const { gamma, smooth } = { ...defaultInputs, ...inputs };
  const g = gamma;
  const warmup = 4; // Minimal warmup for 4-stage Laguerre filter
  return {
    init() {
      // Optional EMA smoothing
      const ema = smooth > 1 ? taStep.ema(smooth) : null;
      const s: LaguerreRun = {
        ema, finalArr: [], plot0: [], steps: ema ? [ema] : [], vars: { L0: 0, L1: 0, L2: 0, L3: 0 }, lists: [], series: [],
      };
      s.series = [s.finalArr, s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const p = bars[i].close;
      const pL0 = v.L0, pL1 = v.L1, pL2 = v.L2;
      const L0 = (1 - g) * p + g * pL0;
      const L1 = -g * L0 + pL0 + g * pL1;
      const L2 = -g * L1 + pL1 + g * pL2;
      const L3 = -g * L2 + pL2 + g * v.L3;
      v.L0 = L0; v.L1 = L1; v.L2 = L2; v.L3 = L3;

      const cu = (L0 > L1 ? L0 - L1 : 0) + (L1 > L2 ? L1 - L2 : 0) + (L2 > L3 ? L2 - L3 : 0);
      const cd = (L0 < L1 ? L1 - L0 : 0) + (L1 < L2 ? L2 - L1 : 0) + (L2 < L3 ? L3 - L2 : 0);
      const raw = (cu + cd) === 0 ? 0 : cu / (cu + cd);
      const value = s.ema ? s.ema.step(raw) : raw;
      s.finalArr[i] = value;

      const time = bars[i].time;
      if (i < warmup) {
        s.plot0[i] = { time, value: NaN };
        return;
      }
      const prev = i > 0 ? s.finalArr[i - 1]! : value;
      const color = value > prev ? '#26A69A' : value < prev ? '#EF5350' : '#26A69A';
      s.plot0[i] = { time, value, color };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice() },
        hlines: [
          { value: 0.8, options: { color: '#800000', linestyle: 'solid', title: 'Overbought' } },
          { value: 0.2, options: { color: '#800000', linestyle: 'solid', title: 'Oversold' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<LaguerreRSIInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<LaguerreRSIInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const LaguerreRSI = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
