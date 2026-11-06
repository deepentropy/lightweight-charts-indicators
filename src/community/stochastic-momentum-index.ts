/**
 * Stochastic Momentum Index (SMI)
 *
 * Refined stochastic oscillator by William Blau.
 * SMI = 100 * EMA(EMA(close - midpoint, s1), s2) / (0.5 * EMA(EMA(HH-LL, s1), s2))
 *
 * Reference: "Stochastic Momentum Index (SMI)"
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface StochasticMomentumIndexInputs {
  length: number;
  smoothLen1: number;
  smoothLen2: number;
  sigLen: number;
}

export const defaultInputs: StochasticMomentumIndexInputs = {
  length: 13,
  smoothLen1: 25,
  smoothLen2: 2,
  sigLen: 13,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Stochastic Length', defval: 13, min: 1 },
  { id: 'smoothLen1', type: 'int', title: '1st Smoothing', defval: 25, min: 1 },
  { id: 'smoothLen2', type: 'int', title: '2nd Smoothing', defval: 2, min: 1 },
  { id: 'sigLen', type: 'int', title: 'Signal Length', defval: 13, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SMI', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#EF5350', lineWidth: 1 },
  { id: 'plot2', title: 'Histogram', color: '#26A69A', lineWidth: 4, style: 'histogram' },
  { id: 'plot3', title: 'OB Level', color: 'transparent', lineWidth: 0 },
  { id: 'plot4', title: 'OB SMI Clamped', color: 'transparent', lineWidth: 0 },
  { id: 'plot5', title: 'OS Level', color: 'transparent', lineWidth: 0 },
  { id: 'plot6', title: 'OS SMI Clamped', color: 'transparent', lineWidth: 0 },
];

export const metadata = {
  title: 'Stochastic Momentum Index',
  shortTitle: 'SMI',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };

interface SmiRun extends BarRunState<Record<string, never>> {
  hh: WindowExtreme;
  ll: WindowExtreme;
  num1: ReturnType<typeof taStep.ema>;
  num2: ReturnType<typeof taStep.ema>;
  den1: ReturnType<typeof taStep.ema>;
  den2: ReturnType<typeof taStep.ema>;
  sig: ReturnType<typeof taStep.ema>;
  plots: Point[][];
}

function study(inputs: Partial<StochasticMomentumIndexInputs>): BarStudy<SmiRun, IndicatorResult> {
  const { length, smoothLen1, smoothLen2, sigLen } = { ...defaultInputs, ...inputs };
  const warmup = length + smoothLen1;
  // OB/OS fill: clamp SMI for fill region above OB (40) and below OS (-40)
  const ob = 40;
  const os = -40;
  return {
    init() {
      const hh = new WindowExtreme(false, length);
      const ll = new WindowExtreme(true, length);
      const num1 = taStep.ema(smoothLen1);
      const num2 = taStep.ema(smoothLen2);
      const den1 = taStep.ema(smoothLen1);
      const den2 = taStep.ema(smoothLen2);
      const sig = taStep.ema(sigLen);
      const s: SmiRun = {
        hh, ll, num1, num2, den1, den2, sig, plots: Array.from({ length: 7 }, () => []),
        steps: [hh, ll, num1, num2, den1, den2, sig], vars: {}, lists: [], series: [],
      };
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const hh = s.hh.step(b.high);
      const ll = s.ll.step(b.low);
      const midpoint = (hh + ll) / 2;
      const relRange = b.close - midpoint;
      const hlRange = hh - ll;

      const n = s.num2.step(s.num1.step(relRange));
      const d = s.den2.step(s.den1.step(hlRange)) * 0.5;
      const smi = (d != null && d !== 0 && n != null) ? 100 * n / d : 0;
      const sig = s.sig.step(smi);

      const w = i < warmup;
      const p = s.plots;
      p[0][i] = { time, value: w ? NaN : smi };
      p[1][i] = { time, value: (w || sig == null) ? NaN : sig };
      const hist = smi - (sig ?? 0);
      p[2][i] = w ? { time, value: NaN } : { time, value: hist, color: hist >= 0 ? '#26A69A' : '#EF5350' };
      p[3][i] = { time, value: w ? NaN : ob };
      p[4][i] = { time, value: w ? NaN : (smi > ob ? smi : ob) };
      p[5][i] = { time, value: w ? NaN : os };
      p[6][i] = { time, value: w ? NaN : (smi < os ? smi : os) };
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          'plot0': p[0].slice(),
          'plot1': p[1].slice(),
          'plot2': p[2].slice(),
          'plot3': p[3].slice(),
          'plot4': p[4].slice(),
          'plot5': p[5].slice(),
          'plot6': p[6].slice(),
        },
        fills: [
          { plot1: 'plot3', plot2: 'plot4', options: { color: 'rgba(255,0,0,0.4)' } },
          { plot1: 'plot5', plot2: 'plot6', options: { color: 'rgba(0,128,0,0.4)' } },
        ],
        hlines: [
          { value: 40, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Overbought' } },
          { value: 0, options: { color: '#787B86', linestyle: 'dotted' as const, title: 'Zero' } },
          { value: -40, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Oversold' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<StochasticMomentumIndexInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<StochasticMomentumIndexInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const StochasticMomentumIndex = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
