/**
 * Median MACD
 *
 * A MACD of the rolling median of the close: median = percentile_nearest_rank(close, period, 50),
 * MACD = ema(median, fast) - ema(median, slow), signal = ema(MACD, MACD length). The columns are MACD - signal,
 * light blue above zero and rising, teal above zero and falling, purple below zero and falling, dark purple below
 * zero and rising (the colour is kept when the delta does not change).
 *
 * Reference: "Median MACD - Mattes" by Mattes00
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Mattes00
 */

import { taCore, taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun, type Committable } from '../live-run';

export interface MedianMacdMattesInputs {
  fastLength: number;
  slowlength: number;
  /** EMA length of the signal line */
  MACDLength: number;
  /** Median period */
  MedLookBack: number;
}

export const defaultInputs: MedianMacdMattesInputs = {
  fastLength: 6,
  slowlength: 36,
  MACDLength: 21,
  MedLookBack: 11,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 6, min: 1, step: 1, group: 'Median MACD' },
  { id: 'slowlength', type: 'int', title: 'Slow Length', defval: 36, min: 1, step: 1, group: 'Median MACD' },
  { id: 'MACDLength', type: 'int', title: 'MACD Length', defval: 21, min: 1, step: 1, group: 'Median MACD' },
  { id: 'MedLookBack', type: 'int', title: 'Median Period', defval: 11, min: 1, step: 1, group: 'Median MACD' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Delta', color: '#4caf50', lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'Median MACD - Mattes',
  shortTitle: 'Median MACD',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/**
 * `ta.percentile_nearest_rank(source, length, percentage)` one bar at a time: the sorted window of the oakscriptjs
 * array function (each value inserted before the first value >= it, then the value of the bar leaving the window
 * removed; na values stay in the window), the value at rank `ceil(percentage / 100 * length)`; the same doubles.
 */
class PercentileNearestRankStep implements Committable {
  /** Sorted window of the confirmed bars and the bar of each value */
  private values: number[] = [];
  private bars: number[] = [];
  private count = 0;
  private pending = NaN;
  private stepped = false;
  private readonly rank: number;

  constructor(private readonly length: number, percentage: number) {
    // the length check of ta.percentile_nearest_rank (the same runtime error)
    taCore.percentile_nearest_rank([], length, percentage);
    this.rank = Math.min(length, Math.max(1, Math.ceil((percentage / 100) * length)));
  }

  /** Insertion position of `v` in the committed window */
  private place(v: number): number {
    const values = this.values;
    let k = 0;
    while (k < values.length && !(values[k]! >= v)) k++;
    return k;
  }

  step(v: number): number {
    this.stepped = true;
    this.pending = v;
    const i = this.count;
    if (i < this.length - 1) return NaN;
    const k = this.place(v);
    // the window after the insertion at k: values[0..k-1], v, values[k..]; then the bar i - length removed
    let removed = -1;
    if (i >= this.length) {
      const old = this.bars.indexOf(i - this.length);
      removed = old < 0 ? -1 : old >= k ? old + 1 : old;
    }
    let j = this.rank - 1;
    if (removed >= 0 && j >= removed) j++;
    const value = j < k ? this.values[j] : j === k ? v : this.values[j - 1];
    return value!;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    const i = this.count++;
    const v = this.pending;
    const k = this.place(v);
    this.values.splice(k, 0, v);
    this.bars.splice(k, 0, i);
    if (i >= this.length) {
      const old = this.bars.indexOf(i - this.length);
      this.values.splice(old, 1);
      this.bars.splice(old, 1);
    }
  }
}

type Point = { time: number; value: number; color: string };
type Ema = ReturnType<typeof taStep.ema>;

interface MmVars {
  /** var color col */
  col: string;
}

interface MmRun extends BarRunState<MmVars> {
  median: PercentileNearestRankStep;
  fast: Ema;
  slow: Ema;
  signal: Ema;
  delta: number[];
  plot0: Point[];
}

function study(inputs: Partial<MedianMacdMattesInputs>): BarStudy<MmRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const median = new PercentileNearestRankStep(cfg.MedLookBack, 50);
      const fast = taStep.ema(cfg.fastLength);
      const slow = taStep.ema(cfg.slowlength);
      const signal = taStep.ema(cfg.MACDLength);
      const s: MmRun = {
        median, fast, slow, signal, delta: [], plot0: [],
        steps: [median, fast, slow, signal], vars: { col: '#4caf50' }, lists: [], series: [],
      };
      s.series = [s.delta, s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const median = s.median.step(b.close);
      const macd = s.fast.step(median) - s.slow.step(median);
      const aMacd = s.signal.step(macd);
      const delta = macd - aMacd;
      s.delta[i] = delta;
      // var color col = #4caf50, changed by the four conditions in order
      const prev = i > 0 ? s.delta[i - 1]! : NaN;
      const posroc = gt(delta, prev);
      const negroc = lt(delta, prev);
      let col = s.vars.col;
      if (gt(delta, 0) && posroc) col = '#57a9ed';
      if (gt(delta, 0) && negroc) col = '#0a8090';
      if (lt(delta, 0) && negroc) col = '#a354b1';
      if (lt(delta, 0) && posroc) col = '#67356f';
      s.vars.col = col;
      s.plot0[i] = { time: b.time as number, value: delta, color: col };
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
export function createRun(inputs: Partial<MedianMacdMattesInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MedianMacdMattesInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const MedianMacdMattes = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
