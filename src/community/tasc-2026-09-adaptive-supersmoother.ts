/**
 * TASC 2026.09 Adaptive SuperSmoother
 *
 * John F. Ehlers' Adaptive SuperSmoother. The SuperSmoother is a second-order IIR filter with critical period P:
 * w = 1.414 * pi / P, q = exp(-w), c1 = 2 q cos(w), c2 = q^2, a0 = (1 - c1 + c2) / 2 and, from bar_index 4,
 * ss = a0 * (src + src[1]) + c1 * ss[1] - c2 * ss[2] (the source before). The adaptive filter takes the bar change of
 * a base SuperSmoother (roc1), scales it by its root mean square over `RMS length` bars (roc = min(|roc1 / rms|, 2)
 * when rms > 0, else 0) and runs a second SuperSmoother with the period max(int(P * (1 - roc / 2)^2), 2). The two
 * filters are drawn on the price pane; the oscillator is the adaptive filter minus the base filter, with a zero line.
 *
 * Reference: "TASC 2026.09 Adaptive SuperSmoother" by PineCodersTASC
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TascAdaptiveSuperSmootherInputs {
  /** Source series */
  source: SourceType;
  /** Base period of the filters */
  period: number;
  /** RMS length of the Adaptive SuperSmoother */
  rmsLength: number;
}

export const defaultInputs: TascAdaptiveSuperSmootherInputs = {
  source: 'close',
  period: 20,
  rmsLength: 81,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'period', type: 'int', title: 'Base period', defval: 20, min: 2 },
  { id: 'rmsLength', type: 'int', title: 'RMS length', defval: 81, min: 2 },
];

export const plotConfig: PlotConfig[] = [
  // Pine force_overlay = true: the two filters are drawn on the price pane
  { id: 'plot0', title: 'SuperSmoother', color: color.red, lineWidth: 1, forceOverlay: true },
  { id: 'plot1', title: 'Adaptive SuperSmoother', color: color.blue, lineWidth: 1, forceOverlay: true },
  { id: 'plot2', title: 'SS Base', color: color.red, lineWidth: 1 },
  { id: 'plot3', title: 'Adaptive SS Oscillator', color: color.blue, lineWidth: 1 },
];

export const metadata = {
  title: 'TASC 2026.09 Adaptive SuperSmoother',
  shortTitle: 'SS - Adaptive',
  overlay: false,
};

/** Pine float comparison: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;

/**
 * superSmoother(source, period) on bar i with the bar's period (one call site: its own history of res, `res`
 * indexed by bar)
 */
function superSmoother(src: number[], res: number[], i: number, p: number): number {
  const w = (1.414 * Math.PI) / p;
  const q = Math.exp(-w);
  const c1 = 2.0 * q * Math.cos(w);
  const c2 = q * q;
  const a0 = (1.0 - c1 + c2) / 2.0;
  let r = src[i];
  // if bar_index >= 4: res := a0 * (source + source[1]) + c1 * res[1] - c2 * res[2]
  if (i >= 4) r = a0 * (src[i] + src[i - 1]) + c1 * res[i - 1] - c2 * res[i - 2];
  res[i] = r;
  return r;
}

type Point = { time: number; value: number; color: string };

interface SsRun extends BarRunState<Record<string, never>> {
  meanSq: WindowSma;
  src: number[];
  ssBase: number[];
  ss: number[];
  ssAdaptive: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
}

function study(inputs: Partial<TascAdaptiveSuperSmootherInputs>): BarStudy<SsRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.source);
  return {
    fullRunReason: () => (isBarSource(cfg.source) ? null : 'source of another study'),
    init() {
      const meanSq = new WindowSma(cfg.rmsLength);
      const s: SsRun = {
        meanSq, src: [], ssBase: [], ss: [], ssAdaptive: [], plot0: [], plot1: [], plot2: [], plot3: [],
        steps: [meanSq], vars: {}, lists: [], series: [],
      };
      s.series = [s.src, s.ssBase, s.ss, s.ssAdaptive, s.plot0, s.plot1, s.plot2, s.plot3];
      return s;
    },
    bar(s, i, bars) {
      s.src[i] = value(bars[i]) ?? NaN;
      // ssBase = superSmoother(srcInput, perInput)
      const base = superSmoother(s.src, s.ssBase, i, cfg.period);

      // adaptiveSuperSmoother(srcInput, perInput, rmsInput)
      const ss = superSmoother(s.src, s.ss, i, cfg.period);
      // roc1 = nz(ss - ss[1])
      const d = i > 0 ? ss - s.ss[i - 1] : NaN;
      const roc1 = isNaN(d) ? 0 : d;
      // rms(roc1, rmsLength) = math.sqrt(ta.sma(roc1 * roc1, rmsLength))
      const rocRMS = Math.sqrt(s.meanSq.step(roc1 * roc1) ?? NaN);
      let roc = 0.0;
      if (gt(rocRMS, 0)) roc = Math.min(Math.abs(roc1 / rocRMS), 2.0);
      const factor = Math.pow(1.0 - 0.5 * roc, 2);
      // int aPeriod = math.max(int(period * factor), 2)
      const aPeriod = Math.max(Math.trunc(cfg.period * factor), 2);
      const adaptive = superSmoother(s.src, s.ssAdaptive, i, aPeriod);

      const time = bars[i].time;
      s.plot0[i] = { time, value: base, color: color.red };
      s.plot1[i] = { time, value: adaptive, color: color.blue };
      s.plot2[i] = { time, value: 0, color: color.red };
      // osc = ssAdaptive - ssBase
      s.plot3[i] = { time, value: adaptive - base, color: color.blue };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TascAdaptiveSuperSmootherInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TascAdaptiveSuperSmootherInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const TascAdaptiveSuperSmoother = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
