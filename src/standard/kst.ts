/**
 * Know Sure Thing (KST) Indicator
 *
 * Momentum oscillator based on rate of change for four different timeframes,
 * smoothed by SMAs. Signal line is SMA of KST.
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface KSTInputs {
  roclen1: number;
  roclen2: number;
  roclen3: number;
  roclen4: number;
  smalen1: number;
  smalen2: number;
  smalen3: number;
  smalen4: number;
  siglen: number;
}

export const defaultInputs: KSTInputs = {
  roclen1: 10,
  roclen2: 15,
  roclen3: 20,
  roclen4: 30,
  smalen1: 10,
  smalen2: 10,
  smalen3: 10,
  smalen4: 15,
  siglen: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'roclen1', type: 'int', title: 'ROC Length #1', defval: 10, min: 1 },
  { id: 'roclen2', type: 'int', title: 'ROC Length #2', defval: 15, min: 1 },
  { id: 'roclen3', type: 'int', title: 'ROC Length #3', defval: 20, min: 1 },
  { id: 'roclen4', type: 'int', title: 'ROC Length #4', defval: 30, min: 1 },
  { id: 'smalen1', type: 'int', title: 'SMA Length #1', defval: 10, min: 1 },
  { id: 'smalen2', type: 'int', title: 'SMA Length #2', defval: 10, min: 1 },
  { id: 'smalen3', type: 'int', title: 'SMA Length #3', defval: 10, min: 1 },
  { id: 'smalen4', type: 'int', title: 'SMA Length #4', defval: 15, min: 1 },
  { id: 'siglen', type: 'int', title: 'Signal Line Length', defval: 9, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'KST', color: '#009688', lineWidth: 1 },
  { id: 'plot1', title: 'Signal', color: '#F44336', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, color: '#787B86', linestyle: 'solid', title: 'Zero' },
];

export const metadata = {
  title: 'Know Sure Thing',
  shortTitle: 'KST',
  overlay: false,
};

type Point = { time: number; value: number };

interface KstRun extends BarRunState<Record<string, never>> {
  smas: WindowSma[];
  sig: WindowSma;
  kstData: Point[];
  sigData: Point[];
}

/** ta.roc(close, len) on bar i = 100 * (close - close[len]) / close[len] */
function roc(bars: Bar[], i: number, len: number): number {
  if (i < len) return NaN;
  const v = bars[i].close;
  const old = bars[i - len].close;
  if (Number.isNaN(old) || Number.isNaN(v)) return NaN;
  return (100 * (v - old)) / old;
}

function study(inputs: Partial<KSTInputs>): BarStudy<KstRun, IndicatorResult> {
  const { roclen1, roclen2, roclen3, roclen4, smalen1, smalen2, smalen3, smalen4, siglen } = { ...defaultInputs, ...inputs };
  // the length checks of ta.roc
  for (const len of [roclen1, roclen2, roclen3, roclen4]) taStep.roc(len);
  return {
    init() {
      // smaroc(roclen, smalen) => ta.sma(ta.roc(close, roclen), smalen)
      const smas = [smalen1, smalen2, smalen3, smalen4].map((l) => new WindowSma(l));
      const sig = new WindowSma(siglen);
      const s: KstRun = { smas, sig, kstData: [], sigData: [], steps: [...smas, sig], vars: {}, lists: [], series: [] };
      s.series = [s.kstData, s.sigData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v1 = s.smas[0].step(roc(bars, i, roclen1));
      const v2 = s.smas[1].step(roc(bars, i, roclen2));
      const v3 = s.smas[2].step(roc(bars, i, roclen3));
      const v4 = s.smas[3].step(roc(bars, i, roclen4));
      // KST = smaroc1 + 2*smaroc2 + 3*smaroc3 + 4*smaroc4
      const kst = v1 + 2 * v2 + 3 * v3 + 4 * v4;
      const signal = s.sig.step(kst);
      s.kstData[i] = { time: b.time, value: isNaN(kst) ? NaN : kst };
      s.sigData[i] = { time: b.time, value: signal };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.kstData.slice(), 'plot1': s.sigData.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<KSTInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<KSTInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const KnowSureThing = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig };
