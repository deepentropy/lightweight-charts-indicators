/**
 * ZLSMA - Zero Lag Least Squares Moving Average
 *
 * Double linear regression to cancel LSMA lag.
 * zlsma = lsma + (lsma - linreg(lsma))
 *
 * Reference: "ZLSMA - Zero Lag LSMA" by veryfid
 */

import { taCore, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface ZLSMAInputs {
  length: number;
  offset: number;
  src: SourceType;
}

export const defaultInputs: ZLSMAInputs = {
  length: 32,
  offset: 0,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 32, min: 1 },
  { id: 'offset', type: 'int', title: 'Offset', defval: 0, min: -500, max: 500 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ZLSMA', color: '#FFEB3B', lineWidth: 3 },
];

export const metadata = {
  title: 'Zero Lag LSMA',
  shortTitle: 'ZLSMA',
  overlay: true,
};

type Point = { time: number; value: number };

/**
 * `ta.linreg(source, length, offset)` one bar at a time: the loop of the oakscriptjs function (the same doubles) on the
 * committed values, without the per-bar closure of taStep.linreg (much faster here).
 */
class LinregRing implements Committable {
  private readonly len: number;
  /** The committed values (grown by doubling) */
  private hist = new Float64Array(64);
  private count = 0;
  private pending = NaN;
  private stepped = false;

  constructor(length: number, private readonly offset: number) {
    // the length check of ta.linreg (the same runtime error)
    taCore.linreg([], length, offset);
    this.len = Math.floor(length);
  }

  step(value: number): number {
    this.stepped = true;
    this.pending = value;
    const len = this.len;
    if (this.count < len - 1) return NaN;
    const h = this.hist;
    // the oldest value of the window: committed value number count - (len - 1)
    const first = this.count - (len - 1);
    const last = this.count;
    for (let k = first; k < last; k++) if (isNaN(h[k]!)) return NaN;
    if (isNaN(value)) return NaN;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    for (let j = 0; j < len - 1; j++) {
      const x = j + 1;
      const y = h[first + j]!;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }
    sumX += len;
    sumY += value;
    sumXY += len * value;
    sumX2 += len * len;
    const slope = (len * sumXY - sumX * sumY) / (len * sumX2 - sumX * sumX);
    const intercept = sumY / len - (slope * sumX) / len + slope;
    return intercept + slope * (len - 1 - this.offset);
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    if (this.count === this.hist.length) {
      const grown = new Float64Array(this.count * 2);
      grown.set(this.hist);
      this.hist = grown;
    }
    this.hist[this.count++] = this.pending;
  }
}

interface ZlsmaRun extends BarRunState<Record<string, never>> {
  lsma: LinregRing;
  lsma2: LinregRing;
  data: Point[];
}

function study(inputs: Partial<ZLSMAInputs>): BarStudy<ZlsmaRun, IndicatorResult> {
  const { length, offset, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const lsma = new LinregRing(length, offset);
      const lsma2 = new LinregRing(length, offset);
      const s: ZlsmaRun = { lsma, lsma2, data: [], steps: [lsma, lsma2], vars: {}, lists: [], series: [] };
      s.series = [s.data];
      return s;
    },
    bar(s, i, bars) {
      // lsma = linreg(src, length, offset); lsma2 = linreg(lsma, length, offset); zlsma = lsma + (lsma - lsma2)
      const lsma = s.lsma.step(value(bars[i]));
      const lsma2 = s.lsma2.step(lsma);
      const eq = lsma - lsma2;
      s.data[i] = { time: bars[i].time, value: lsma + eq };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.data.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ZLSMAInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ZLSMAInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const ZLSMA = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
