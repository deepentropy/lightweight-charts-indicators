/**
 * Deviation Symmetry Breaker
 *
 * The centre line is a double median of the source (a median over the first length, then a median of it over the
 * second length). The bands are centre + stdev(centre, deviation length) * upper multiplier and centre - stdev *
 * lower multiplier. A cross of the source above the upper band sets the trend up, a cross below the lower band sets
 * it down. The candles are drawn in the indicator pane and on the price pane, blue in an up trend and red in a down
 * trend (no colour before the first signal).
 *
 * Reference: "Deviation Symmetry Breaker ~ C H I P A" by C_H_I_P_A
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowStdev, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface DeviationSymmetryBreakerInputs {
  src: SourceType;
  /** First Median Length */
  length: number;
  /** Second Median Length (Smoother) */
  secondMedianLen: number;
  /** Deviation Band Length */
  deviationLen: number;
  upperBandMult: number;
  lowerBandMult: number;
}

export const defaultInputs: DeviationSymmetryBreakerInputs = {
  src: 'close',
  length: 33,
  secondMedianLen: 34,
  deviationLen: 25,
  upperBandMult: 1.72,
  lowerBandMult: -1.12,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'length', type: 'int', title: 'First Median Length', defval: 33, min: 1 },
  { id: 'secondMedianLen', type: 'int', title: 'Second Median Length (Smoother)', defval: 34, min: 1 },
  { id: 'deviationLen', type: 'int', title: 'Deviation Band Length', defval: 25, min: 1 },
  { id: 'upperBandMult', type: 'float', title: 'Upper Band Multiplier', defval: 1.72, step: 0.01 },
  { id: 'lowerBandMult', type: 'float', title: 'Lower Band Multiplier', defval: -1.12, step: 0.01 },
];

const BAND_COL = String(color.rgb(180, 180, 255));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Band', color: BAND_COL, lineWidth: 1 },
  { id: 'plot1', title: 'Lower Band', color: BAND_COL, lineWidth: 1 },
];

export const metadata = {
  title: 'Deviation Symmetry Breaker ~ C H I P A',
  shortTitle: 'Deviation Symmetry Breaker ~ C H I P A',
  overlay: false,
};

/**
 * `ta.median(source, length)` one bar at a time: the sorted window of the oakscriptjs array function changed in place
 * (the same insertions and removals, so the same doubles); a step again on the same bar first undoes the pending one.
 */
class MedianWindow implements Committable {
  private readonly sorted: number[] = [];
  /** Kept (non-na) values committed, from position `base` on */
  private kept: number[] = [];
  private base = 0;
  private count = 0;
  private pending = false;
  private insIdx = -1;
  private remIdx = -1;
  private remVal = NaN;
  private pendVal = NaN;
  private readonly len: number;
  private readonly mid: number;

  constructor(length: number) {
    this.len = Math.floor(length);
    this.mid = Math.floor(this.len / 2);
  }

  /** First position whose value is >= v (`after`: > v) */
  private bound(v: number, after: boolean): number {
    const sorted = this.sorted;
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (after ? sorted[m]! <= v : sorted[m]! < v) lo = m + 1;
      else hi = m;
    }
    return lo;
  }

  private undo(): void {
    if (this.remIdx >= 0) this.sorted.splice(this.remIdx, 0, this.remVal);
    if (this.insIdx >= 0) this.sorted.splice(this.insIdx, 1);
    this.insIdx = -1;
    this.remIdx = -1;
  }

  step(value: number): number {
    if (this.pending) this.undo();
    this.pending = true;
    this.insIdx = -1;
    this.remIdx = -1;
    const len = this.len;
    const sorted = this.sorted;
    let count = this.count;
    if (!(len >= 1)) return NaN;
    if (Number.isFinite(value)) {
      count++;
      // before the equal values: the newest first
      const at = this.bound(value, false);
      sorted.splice(at, 0, value);
      this.insIdx = at;
      // the value leaving the window is the oldest, so the last of its equal values
      if (count > len) {
        const k = count - 1 - len;
        const leaving = k === this.count ? value : this.kept[k - this.base]!;
        const r = this.bound(leaving, true) - 1;
        this.remVal = sorted[r]!;
        sorted.splice(r, 1);
        this.remIdx = r;
      }
      this.pendVal = value;
    }
    if (count < len) return NaN;
    const mid = this.mid;
    return len % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
  }

  commit(): void {
    if (!this.pending) return;
    this.pending = false;
    if (this.insIdx < 0) return;
    this.insIdx = -1;
    this.remIdx = -1;
    this.kept.push(this.pendVal);
    this.count++;
    if (this.kept.length > this.len * 2 + 1024) {
      const drop = this.kept.length - this.len;
      this.kept = this.kept.slice(drop);
      this.base += drop;
    }
  }
}

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> };

interface DsbRun extends BarRunState<{ trend: number }> {
  firstMedian: MedianWindow;
  centerline: MedianWindow;
  dev: WindowStdev;
  longX: ReturnType<typeof taStep.crossover>;
  shortX: ReturnType<typeof taStep.crossunder>;
  plot0: { time: number; value: number }[];
  plot1: { time: number; value: number }[];
  pane: PlotCandleData[];
  overlay: PlotCandleData[];
}

function study(inputs: Partial<DeviationSymmetryBreakerInputs>): BarStudy<DsbRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const up = String(color.rgb(0, 180, 255));
  const down = String(color.rgb(255, 80, 60));
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      // the length checks of ta.median (an error for a length <= 0)
      if (!(cfg.length > 0)) taStep.median(cfg.length);
      if (!(cfg.secondMedianLen > 0)) taStep.median(cfg.secondMedianLen);
      const s: DsbRun = {
        firstMedian: new MedianWindow(cfg.length), centerline: new MedianWindow(cfg.secondMedianLen),
        dev: new WindowStdev(cfg.deviationLen), longX: taStep.crossover(), shortX: taStep.crossunder(),
        plot0: [], plot1: [], pane: [], overlay: [],
        // var trend = 0
        steps: [], vars: { trend: 0 }, lists: [], series: [],
      };
      s.steps = [s.firstMedian, s.centerline, s.dev, s.longX, s.shortX];
      s.series = [s.plot0, s.plot1, s.pane, s.overlay];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const src = value(b);
      const centerline = s.centerline.step(s.firstMedian.step(src));
      const symmetryDev = s.dev.step(centerline);
      const upper = centerline + symmetryDev * cfg.upperBandMult;
      const lower = centerline - symmetryDev * cfg.lowerBandMult;
      // ta.crossover(src, upper_band) / ta.crossunder(src, lower_band): exact comparisons
      const longSignal = s.longX.step(src, upper);
      const shortSignal = s.shortX.step(src, lower);
      if (longSignal) s.vars.trend = 1;
      if (shortSignal) s.vars.trend = -1;
      const trend = s.vars.trend;
      s.plot0[i] = { time: b.time as number, value: upper };
      s.plot1[i] = { time: b.time as number, value: lower };
      // coloring = trend == 1 ? rgb(0, 180, 255) : trend == -1 ? rgb(255, 80, 60) : na
      const c = trend === 1 ? up : trend === -1 ? down : 'transparent';
      const candle = { time: b.time as number, open: b.open, high: b.high, low: b.low, close: b.close, color: c, wickColor: c, borderColor: c };
      s.pane[i] = candle;
      // the second plotcandle has force_overlay = true
      s.overlay[i] = { ...candle, forceOverlay: true };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        markers: [],
        plotCandles: { barColoring: s.pane.slice(), barColoringOverlay: s.overlay.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DeviationSymmetryBreakerInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DeviationSymmetryBreakerInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const DeviationSymmetryBreaker = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
