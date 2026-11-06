/**
 * Schaff Trend Cycle (STC)
 *
 * Double stochastic smoothing of MACD.
 * 1. Compute MACD (fast EMA - slow EMA)
 * 2. Stochastic normalize MACD to 0-100, smooth with factor
 * 3. Stochastic normalize result again, smooth with factor
 * The original is an overlay (drawn on the price chart) and draws its one STC plot only ('Schaff_TC', red,
 * width 1): no markers, bands, fills or middle line.
 * Pine semantics: the stochastics' lowest / highest are na for the first `length - 1` bars and skip the na values of
 * their window (the MACD is na until the slow EMA starts); while they are na f1 / f2 keep their previous value (0 at
 * first), so the STC is 0 until the MACD has its first values.
 *
 * Reference: "Schaff Trend Cycle" by LazyBear
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SchaffTrendCycleInputs {
  length: number;
  fastLength: number;
  slowLength: number;
  factor: number;
  src: SourceType;
}

export const defaultInputs: SchaffTrendCycleInputs = {
  length: 10,
  fastLength: 23,
  slowLength: 50,
  factor: 0.5,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 10, min: 1 },
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 23, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 50, min: 1 },
  { id: 'factor', type: 'float', title: 'Factor', defval: 0.5, min: 0.01, max: 1.0, step: 0.01 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

/** plot(stc(...), color = red, title = "Schaff_TC"): red of Pine versions 1-3 */
const STC_RED = '#FF0000';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Schaff_TC', color: STC_RED, lineWidth: 1 },
];

export const metadata = {
  title: 'Schaff Trend Cycle',
  shortTitle: 'STC',
  /** study(..., overlay=true): the original draws on the price chart */
  overlay: true,
};

/** ta.lowest / ta.highest: na for the first `len - 1` bars, else the extreme of the window's non-na values (na when
 *  they are all na) */
function windowExtreme(a: number[], i: number, len: number, max: boolean): number {
  if (i - len + 1 < 0) return NaN;
  let out = NaN;
  for (let k = i - len + 1; k <= i; k++) {
    const v = a[k];
    if (Number.isNaN(v)) continue;
    if (Number.isNaN(out) || (max ? v > out : v < out)) out = v;
  }
  return out;
}

interface StcRun extends BarRunState<{ f1: number; f2: number }> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  m: number[];
  pf: number[];
  stc: number[];
  plot0: { time: any; value: number }[];
}

function study(inputs: Partial<SchaffTrendCycleInputs>): BarStudy<StcRun, IndicatorResult> {
  const { length, fastLength, slowLength, factor, src } = { ...defaultInputs, ...inputs };
  const source = barSource(src);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const fast = taStep.ema(fastLength);
      const slow = taStep.ema(slowLength);
      const s: StcRun = {
        fast, slow, m: [], pf: [], stc: [], plot0: [],
        steps: [fast, slow], vars: { f1: 0, f2: 0 }, lists: [], series: [],
      };
      s.series = [s.m, s.pf, s.stc, s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const { m, pf, stc } = s;
      const v = source(bars[i]);
      // m = macd(close, fastLength, slowLength) = ema(close, fast) - ema(close, slow)
      m[i] = (s.fast.step(v) ?? NaN) - (s.slow.step(v) ?? NaN);

      // f1 = v2 > 0 ? (m - v1) / v2 * 100 : nz(f1[1]); pf = na(pf[1]) ? f1 : pf[1] + factor * (f1 - pf[1]);
      // f2 / pff the same over pf. A na v2 / v4 keeps the previous f1 / f2 (0 at first).
      const vars = s.vars;
      const v1 = windowExtreme(m, i, length, false);
      const v2 = windowExtreme(m, i, length, true) - v1;
      vars.f1 = v2 > 0 ? ((m[i] - v1) / v2) * 100 : vars.f1;
      pf[i] = i === 0 || Number.isNaN(pf[i - 1]) ? vars.f1 : pf[i - 1] + factor * (vars.f1 - pf[i - 1]);
      const v3 = windowExtreme(pf, i, length, false);
      const v4 = windowExtreme(pf, i, length, true) - v3;
      vars.f2 = v4 > 0 ? ((pf[i] - v3) / v4) * 100 : vars.f2;
      stc[i] = i === 0 || Number.isNaN(stc[i - 1]) ? vars.f2 : stc[i - 1] + factor * (vars.f2 - stc[i - 1]);
      s.plot0[i] = { time: bars[i].time, value: stc[i] };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SchaffTrendCycleInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SchaffTrendCycleInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const SchaffTrendCycle = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
