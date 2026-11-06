/**
 * Median Indicator
 *
 * The median (50th percentile, nearest rank) of the source over `length` bars, with bands at
 * median +- ATR multiplier * ATR and an EMA of the median. The area between the median and its EMA is green
 * when the median is above the EMA, fuchsia otherwise.
 *
 * Based on the standard "Median" indicator.
 */

import { taCore, taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface MedianInputs {
  /** Median source */
  source: SourceType;
  /** Median calculation length */
  length: number;
  /** ATR length */
  atrLength: number;
  /** ATR multiplier for bands */
  atrMult: number;
}

export const defaultInputs: MedianInputs = {
  source: 'hl2',
  length: 3,
  atrLength: 14,
  atrMult: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Median Source', defval: 'hl2' },
  { id: 'length', type: 'int', title: 'Median Length', defval: 3 },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14 },
  { id: 'atrMult', type: 'int', title: 'ATR Multiplier', defval: 2 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Median', color: '#F23645', lineWidth: 3 },
  { id: 'plot1', title: 'Upper Band', color: '#00E676', lineWidth: 1 },
  { id: 'plot2', title: 'Lower Band', color: '#E040FB', lineWidth: 1 },
  { id: 'plot3', title: 'Median EMA', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Median',
  shortTitle: 'Median',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

/**
 * `ta.percentile_nearest_rank(source, length, percentage)` one bar at a time: the sorted window of the oakscriptjs
 * array function (na values kept, inserted before the first value >= the new one, the value of bar i - length
 * removed), its value at the rank (the same doubles; no taStep machine).
 */
class NearestRankStep implements Committable {
  private values: number[] = [];
  private barIds: number[] = [];
  private pendingBar = -1;
  private pendingValue = NaN;
  private readonly rank: number;

  constructor(private readonly length: number, percentage: number) {
    this.rank = Math.min(length, Math.max(1, Math.ceil((percentage / 100) * length)));
  }

  step(bar: number, v: number): number {
    this.pendingBar = bar;
    this.pendingValue = v;
    if (bar < this.length - 1) return NaN;
    const c = this.values;
    let k = 0;
    while (k < c.length && !(c[k]! >= v)) k++;
    // the window after the insertion at k (inserted[x]) without its element at position `gone`
    const inserted = (x: number) => (x < k ? c[x]! : x === k ? v : c[x - 1]!);
    let gone = c.length + 1;
    if (bar >= this.length) {
      const old = this.barIds.indexOf(bar - this.length);
      gone = old < k ? old : old + 1;
    }
    const j = this.rank - 1;
    return j < gone ? inserted(j) : inserted(j + 1);
  }

  commit(): void {
    if (this.pendingBar < 0) return;
    const bar = this.pendingBar;
    const v = this.pendingValue;
    this.pendingBar = -1;
    const values = this.values;
    let k = 0;
    while (k < values.length && !(values[k]! >= v)) k++;
    values.splice(k, 0, v);
    this.barIds.splice(k, 0, bar);
    if (bar >= this.length) {
      const old = this.barIds.indexOf(bar - this.length);
      values.splice(old, 1);
      this.barIds.splice(old, 1);
    }
  }
}

type Point = { time: number; value: number };

interface MedianRun extends BarRunState<Record<string, never>> {
  rank: NearestRankStep;
  atr: ReturnType<typeof taStep.atr>;
  ema: ReturnType<typeof taStep.ema>;
  medianData: Point[];
  upperData: Point[];
  lowerData: Point[];
  emaData: Point[];
  fillColors: string[];
}

function study(inputs: Partial<MedianInputs>): BarStudy<MedianRun, IndicatorResult> {
  const { source, length, atrLength, atrMult } = { ...defaultInputs, ...inputs };
  const value = barSource(source);
  return {
    fullRunReason: () => (isBarSource(source) ? null : 'source of another study'),
    init() {
      // the length checks of the old calculation order
      taCore.percentile_nearest_rank([], length, 50);
      const rank = new NearestRankStep(length, 50);
      const atr = taStep.atr(atrLength);
      const ema = taStep.ema(length);
      const s: MedianRun = {
        rank, atr, ema, medianData: [], upperData: [], lowerData: [], emaData: [], fillColors: [],
        steps: [rank, atr, ema], vars: {}, lists: [], series: [],
      };
      s.series = [s.medianData, s.upperData, s.lowerData, s.emaData, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const time = b.time as number;
      // median = ta.percentile_nearest_rank(source, length, 50)
      const median = s.rank.step(i, value(b));
      // atr_ = atr_mult * ta.atr(atr_length)
      const atr = atrMult * s.atr.step(b.high, b.low, b.close);
      // median_ema = ta.ema(median, length)
      const medianEma = s.ema.step(median);
      s.medianData[i] = { time, value: median };
      s.upperData[i] = { time, value: median + atr };
      s.lowerData[i] = { time, value: median - atr };
      s.emaData[i] = { time, value: medianEma };
      // fill colour: median > median_ema ? color.new(color.lime, 10) : color.new(color.fuchsia, 10)
      s.fillColors[i] = gt(median, medianEma) ? '#00E676E6' : '#E040FBE6';
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          plot0: s.medianData.slice(),
          plot1: s.upperData.slice(),
          plot2: s.lowerData.slice(),
          plot3: s.emaData.slice(),
        },
        fills: [{ plot1: 'plot0', plot2: 'plot3', options: { title: 'Fill color' }, colors: s.fillColors.slice() }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MedianInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MedianInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const Median = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
