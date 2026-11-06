/**
 * Kaufman's Adaptive Moving Average (KAMA)
 *
 * An exponential average whose smoothing factor follows Kaufman's Efficiency Ratio (ER) of the source:
 *
 *   ER    = sum(|change(src)|, erLength) == 0 ? 0 : |src - src[erLength]| / sum(|change(src)|, erLength)
 *   alpha = (ER * (2 / (fast + 1) - 2 / (slow + 1)) + 2 / (slow + 1))^2
 *   KAMA  = alpha * src + (1 - alpha) * previous KAMA  (starts from the source on the first bar with an ER)
 *
 * Based on the standard Kaufman's Adaptive Moving Average indicator. The functions kama, er and ewma of the standard
 * "ta" library are ported in this file.
 */

import { taStep, math, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSum, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface KaufmansAdaptiveMovingAverageInputs {
  /** Source: a price of the bar or the volume */
  src: SourceType | 'volume';
  /** Length of the Efficiency Ratio */
  erLength: number;
  /** Length of the fastest smoothing */
  fastLength: number;
  /** Length of the slowest smoothing */
  slowLength: number;
}

export const defaultInputs: KaufmansAdaptiveMovingAverageInputs = {
  src: 'close',
  erLength: 10,
  fastLength: 2,
  slowLength: 30,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'erLength', type: 'int', title: 'ER length', defval: 10, min: 1 },
  { id: 'fastLength', type: 'int', title: 'Fast length', defval: 2, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow length', defval: 30, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'KAMA', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: "Kaufman's Adaptive Moving Average",
  shortTitle: 'KAMA',
  overlay: true,
};

type Point = { time: number; value: number };

interface KamaRun extends BarRunState<{ prev: number }> {
  change: ReturnType<typeof taStep.change>;
  change1: ReturnType<typeof taStep.change>;
  sum: WindowSum;
  plot0: Point[];
}

function study(inputs: Partial<KaufmansAdaptiveMovingAverageInputs>): BarStudy<KamaRun, IndicatorResult> {
  const { src, erLength, fastLength, slowLength } = { ...defaultInputs, ...inputs };
  // input.source also offers the volume
  const value = barSource(src);
  // kama() of the "ta" library
  const alphaFast = 2.0 / (fastLength + 1.0);
  const alphaSlow = 2.0 / (slowLength + 1.0);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const change = taStep.change(erLength);
      const change1 = taStep.change(1);
      // the length check of math.sum (the same runtime error)
      math.sum([], erLength);
      const sum = new WindowSum(erLength);
      const s: KamaRun = { change, change1, sum, plot0: [], steps: [change, change1, sum], vars: { prev: NaN }, lists: [], series: [] };
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const x = value(b);
      // er() of the "ta" library: Kaufman's Efficiency Ratio
      const absChange = Math.abs(s.change.step(x));
      const sumChanges = s.sum.step(Math.abs(s.change1.step(x)));
      // sumChanges == 0.0: Pine equality within 1e-10 (na compares false)
      const e = Math.abs(sumChanges) <= 1e-10 ? 0.0 : absChange / sumChanges;
      const a = math.pow(e * (alphaFast - alphaSlow) + alphaSlow, 2) as number;
      // ewma() of the "ta" library: result := alpha * source + (1 - alpha) * nz(result[1], source).
      // nz() treats +-infinity as na; an na alpha or source gives na on the bar.
      if (a < 0) throw new Error('Invalid smoothing factor. The value must not be negative.');
      const prev = s.vars.prev;
      const r = a * x + (1.0 - a) * (Number.isFinite(prev) ? prev : x);
      s.vars.prev = r;
      s.plot0[i] = { time: b.time, value: Number.isFinite(r) ? r : NaN };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<KaufmansAdaptiveMovingAverageInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<KaufmansAdaptiveMovingAverageInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const KaufmansAdaptiveMovingAverage = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
