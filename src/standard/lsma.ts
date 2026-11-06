/**
 * Least Squares Moving Average (LSMA) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Uses linear regression to fit a line through recent prices.
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface LSMAInputs {
  length: number;
  offset: number;
  src: SourceType;
}

export const defaultInputs: LSMAInputs = {
  length: 25,
  offset: 0,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 25 },
  { id: 'offset', type: 'int', title: 'Offset', defval: 0 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'LSMA', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'Least Squares Moving Average',
  shortTitle: 'LSMA',
  overlay: true,
};

type Point = { time: number; value: number };

/**
 * `ta.linreg(source, length, offset)` one bar at a time with the sums of the oakscriptjs array function (the same
 * doubles as taStep.linreg, without its closure per bar)
 */
class LinregWindow implements Committable {
  private values: number[] = [];
  private pending = NaN;
  private stepped = false;
  private readonly len: number;

  constructor(length: number, private readonly offset: number) {
    // the length check of ta.linreg (the same runtime error)
    taStep.linreg(length, offset);
    this.len = Math.floor(length);
  }

  step(value: number): number {
    this.stepped = true;
    this.pending = value;
    const len = this.len;
    const vals = this.values;
    const n = vals.length;
    if (n < len - 1) return NaN;
    const first = n - len + 1;
    if (isNaN(value)) return NaN;
    for (let j = 0; j < len - 1; j++) if (isNaN(vals[first + j]!)) return NaN;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    for (let j = 0; j < len; j++) {
      const x = j + 1;
      const y = j === len - 1 ? value : vals[first + j]!;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }
    const slope = (len * sumXY - sumX * sumY) / (len * sumX2 - sumX * sumX);
    const intercept = sumY / len - (slope * sumX) / len + slope;
    return intercept + slope * (len - 1 - this.offset);
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.values.push(this.pending);
    if (this.values.length > this.len * 2 + 1024) this.values = this.values.slice(-this.len);
  }
}

interface LsmaRun extends BarRunState<Record<string, never>> {
  lsma: LinregWindow;
  plotData: Point[];
}

function study(inputs: Partial<LSMAInputs>): BarStudy<LsmaRun, IndicatorResult> {
  const { length, src, offset } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      // LSMA is linear regression with offset 0 (endpoint of the regression line)
      const lsma = new LinregWindow(length, offset);
      const s: LsmaRun = { lsma, plotData: [], steps: [lsma], vars: {}, lists: [], series: [] };
      s.series = [s.plotData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      s.plotData[i] = { time: b.time as number, value: s.lsma.step(value(b)) };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plotData.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<LSMAInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<LSMAInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const LSMA = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
