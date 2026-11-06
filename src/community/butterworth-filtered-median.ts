/**
 * Smoothed Low-Pass Butterworth Filtered Median
 *
 * The rolling median of the close (percentile_nearest_rank 50 over `len` bars) is smoothed with a one-pole low-pass
 * filter: a = exp(-2 * pi * cutoff), filtered = a * filtered[1] + (1 - a) * median (the median itself while the
 * previous filtered value is na). The line is an EMA of the filtered median, cyan when it is below the close and the
 * previous close, magenta otherwise.
 *
 * Reference: "Smoothed Low-Pass Butterworth Filtered Median [AlphaAlgos]" by AlphaNatt
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taCore, taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ButterworthFilteredMedianInputs {
  /** Median length */
  len: number;
  /** Cutoff frequency of the low-pass filter */
  cutoffFreq: number;
  /** EMA length */
  emalen: number;
}

export const defaultInputs: ButterworthFilteredMedianInputs = {
  len: 50,
  cutoffFreq: 0.1,
  emalen: 7,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Median Length', defval: 50, min: 1 },
  { id: 'cutoffFreq', type: 'float', title: 'Cutoff Frequency', defval: 0.1, min: 0.01, max: 1.0, step: 0.01 },
  { id: 'emalen', type: 'int', title: 'EMA Length', defval: 7 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Filtered Median (Butterworth)', color: '#00F1FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Smoothed Low-Pass Butterworth Filtered Median [AlphaAlgos]',
  shortTitle: 'Smoothed Low-Pass Butterworth Filtered Median [AlphaAlgos]',
  overlay: true,
};

/** Pine float comparisons: a < b only when b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;

/**
 * `ta.percentile_nearest_rank(source, length, percentage)` one bar at a time: the sorted window of the oakscriptjs
 * array function (insertion before the first value not below the new one, na values kept, the value `length` bars
 * back removed), the value at rank `ceil(percentage / 100 * length)` (the same doubles).
 */
class PercentileNearestRankStep {
  private values: number[] = [];
  private bars: number[] = [];
  private pendingBar = -1;
  private pendingValue = NaN;
  private pendingK = 0;
  private readonly rank: number;

  constructor(private readonly length: number, percentage: number) {
    // the length check of ta.percentile_nearest_rank (the same runtime error)
    taCore.percentile_nearest_rank([], length, percentage);
    this.rank = Math.min(length, Math.max(1, Math.ceil((percentage / 100) * length)));
  }

  step(i: number, v: number): number {
    const values = this.values;
    let k = 0;
    while (k < values.length && !(values[k] >= v)) k++;
    this.pendingBar = i;
    this.pendingValue = v;
    this.pendingK = k;
    if (i < this.length - 1) return NaN;
    // the window with v inserted at k (and the value of bar i - length removed)
    let old = -1;
    if (i >= this.length) {
      const p = this.bars.indexOf(i - this.length);
      old = p < k ? p : p + 1;
    }
    const at = (j: number) => (j < k ? values[j] : j === k ? v : values[j - 1]);
    const r = this.rank - 1;
    return old >= 0 && r >= old ? at(r + 1) : at(r);
  }

  commit(): void {
    if (this.pendingBar < 0) return;
    const i = this.pendingBar;
    this.pendingBar = -1;
    this.values.splice(this.pendingK, 0, this.pendingValue);
    this.bars.splice(this.pendingK, 0, i);
    if (i >= this.length) {
      const old = this.bars.indexOf(i - this.length);
      this.values.splice(old, 1);
      this.bars.splice(old, 1);
    }
  }
}

type Point = { time: number; value: number; color: string };

interface ButterworthVars {
  /** filteredMedian[1] */
  prev: number;
}

interface ButterworthRun extends BarRunState<ButterworthVars> {
  percentile: PercentileNearestRankStep;
  ema: ReturnType<typeof taStep.ema>;
  plot0: Point[];
}

function study(inputs: Partial<ButterworthFilteredMedianInputs>): BarStudy<ButterworthRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  // a = math.exp(-2 * math.pi * cutoffFreq * deltaT), deltaT = 1
  const a = Math.exp(-2 * Math.PI * cfg.cutoffFreq * 1);
  const b = 1 - a;
  return {
    init() {
      const percentile = new PercentileNearestRankStep(cfg.len, 50);
      const ema = taStep.ema(cfg.emalen);
      const s: ButterworthRun = { percentile, ema, plot0: [], steps: [percentile, ema], vars: { prev: NaN }, lists: [], series: [] };
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i];
      const close = bar.close;
      const percentile = s.percentile.step(i, close);
      // filteredMedian := na(filteredMedian[1]) ? percentile : a * filteredMedian[1] + b * percentile
      const prev = s.vars.prev;
      const filtered = isNaN(prev) ? percentile : a * prev + b * percentile;
      s.vars.prev = filtered;
      const ema = s.ema.step(filtered);
      // (ema < close) and (ema < close[1]) ? #00F1FF : #FF019A
      const up = lt(ema, close) && i > 0 && lt(ema, bars[i - 1].close);
      s.plot0[i] = { time: bar.time, value: ema, color: up ? '#00F1FF' : '#FF019A' };
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
export function createRun(inputs: Partial<ButterworthFilteredMedianInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ButterworthFilteredMedianInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const ButterworthFilteredMedian = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
