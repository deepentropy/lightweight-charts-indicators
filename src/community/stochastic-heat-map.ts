/**
 * Stochastic Heat Map
 *
 * Computes stochastic oscillator at multiple periods (1*incr through 28*incr),
 * smooths each, then averages all into fast/slow signal lines.
 * Heat map coloring based on average stochastic value.
 *
 * Reference: "Stochastic Heat Map" by Violent
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface StochasticHeatMapInputs {
  maType: string;
  increment: number;
  smooth: number;
  smoothSlow: number;
  plotNumber: number;
  paintBars: boolean;
}

export const defaultInputs: StochasticHeatMapInputs = {
  maType: 'EMA',
  increment: 10,
  smooth: 2,
  smoothSlow: 21,
  plotNumber: 28,
  paintBars: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'EMA', options: ['EMA', 'SMA', 'WMA'] },
  { id: 'increment', type: 'int', title: 'Increment', defval: 10, min: 1 },
  { id: 'smooth', type: 'int', title: 'Smooth', defval: 2, min: 1 },
  { id: 'smoothSlow', type: 'int', title: 'Slow Smooth', defval: 21, min: 1 },
  { id: 'plotNumber', type: 'int', title: 'Plot Number', defval: 28, min: 1, max: 28 },
  { id: 'paintBars', type: 'bool', title: 'Paint Bars', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'fast', title: 'Fast', color: '#FFFFFF', lineWidth: 1 },
  { id: 'slow', title: 'Slow', color: '#FF9800', lineWidth: 1 },
  { id: 'avg', title: 'Avg Stochastic', color: '#2196F3', lineWidth: 2, style: 'histogram' },
];

export const metadata = {
  title: 'Stochastic Heat Map',
  shortTitle: 'SHM',
  overlay: false,
};

/** Get heat map color for a stochastic value (0-100). Theme 3: red->orange->yellow->green gradient. */
function heatColor(v: number): string {
  if (v >= 90) return '#cf0000';
  if (v >= 80) return '#f25811';
  if (v >= 70) return '#f29811';
  if (v >= 60) return '#eef211';
  if (v >= 50) return '#3af211';
  if (v >= 40) return '#11e7f2';
  if (v >= 30) return '#0093c9';
  if (v >= 20) return '#1176f2';
  if (v >= 10) return '#0f44f5';
  return '#02269e';
}

/**
 * `ta.highest(source, length)` / `ta.lowest` with a constant length, one bar at a time with a queue of the best values
 * (same doubles as the oakscriptjs taStep machine, which scans the window): the best of the last `length` non-na
 * values, na before bar `length - 1`; +0 wins over -0 for the highest, -0 for the lowest.
 */
class WindowExtreme implements Committable {
  private vals: number[] = [];
  private ids: number[] = [];
  private head = 0;
  /** Non-na values committed */
  private kept = 0;
  private bars = 0;
  /** Preferred zeros in the queue */
  private zeros = 0;
  private pending = NaN;
  private stepped = false;
  private readonly len: number;
  private readonly zero: number;

  constructor(private readonly lowest: boolean, length: number) {
    this.len = Math.trunc(length);
    this.zero = lowest ? -0 : 0;
  }

  private beats(a: number, b: number): boolean {
    return this.lowest ? a < b : a > b;
  }

  step(value: number): number {
    this.stepped = true;
    this.pending = value;
    const own = Number.isFinite(value);
    const total = this.kept + (own ? 1 : 0);
    if (this.bars < this.len - 1 || total === 0) return NaN;
    let h = this.head;
    let z = this.zeros;
    if (h < this.ids.length && this.ids[h]! < total - this.len) {
      if (Object.is(this.vals[h], this.zero)) z--;
      h++;
    }
    const has = h < this.ids.length;
    let best: number;
    if (own) {
      best = has && !this.beats(value, this.vals[h]!) ? this.vals[h]! : value;
      if (Object.is(value, this.zero)) z++;
    } else {
      best = this.vals[h]!;
    }
    return best === 0 && z > 0 ? this.zero : best;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.bars++;
    const v = this.pending;
    if (!Number.isFinite(v)) return;
    while (this.ids.length > this.head && this.beats(v, this.vals[this.vals.length - 1]!)) {
      if (Object.is(this.vals.pop(), this.zero)) this.zeros--;
      this.ids.pop();
    }
    this.vals.push(v);
    this.ids.push(this.kept);
    if (Object.is(v, this.zero)) this.zeros++;
    this.kept++;
    while (this.head < this.ids.length && this.ids[this.head]! < this.kept - this.len) {
      if (Object.is(this.vals[this.head], this.zero)) this.zeros--;
      this.head++;
    }
    if (this.head > 1024 && this.head * 2 > this.ids.length) {
      this.vals.splice(0, this.head);
      this.ids.splice(0, this.head);
      this.head = 0;
    }
  }
}

/** `ta.stoch(close, high, low, length)` one bar at a time (the rules of the taStep machine, queues for the extremes) */
class StochQueue implements Committable {
  private readonly highest: WindowExtreme;
  private readonly lowest: WindowExtreme;
  private previous = NaN;
  private next = NaN;
  private stepped = false;

  constructor(length: number) {
    this.highest = new WindowExtreme(false, length);
    this.lowest = new WindowExtreme(true, length);
  }

  step(source: number, high: number, low: number): number {
    this.stepped = true;
    const lo = this.lowest.step(low);
    const k = (100 * (source - lo)) / (this.highest.step(high) - lo);
    this.next = Number.isNaN(k) ? this.previous : k;
    return this.next;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.previous = this.next;
    this.highest.commit();
    this.lowest.commit();
  }
}

type Ma = { step(v: number): number; commit(): void };

/** One moving average of the selected type stepped bar by bar */
function maStep(length: number, maType: string): Ma {
  switch (maType) {
    case 'SMA': { const m = taStep.sma(); return { step: (v) => m.step(v, length), commit: () => m.commit() }; }
    case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, length), commit: () => m.commit() }; }
    case 'EMA':
    default:
      return taStep.ema(length);
  }
}

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] };

interface ShmRun extends BarRunState<Record<string, never>> {
  stochs: StochQueue[];
  smooths: Ma[];
  slow: Ma;
  fastPlot: Point[];
  slowPlot: Point[];
  avgPlot: Point[];
  barColors: BarColorData[];
}

function study(inputs: Partial<StochasticHeatMapInputs>): BarStudy<ShmRun, Result> {
  const { maType, increment, smooth, smoothSlow, plotNumber, paintBars } = { ...defaultInputs, ...inputs };
  const numLines = Math.min(plotNumber, 28);
  const warmup = numLines * increment;
  return {
    init() {
      // Compute stochastic at each period and smooth it
      const stochs: StochQueue[] = [];
      const smooths: Ma[] = [];
      for (let line = 1; line <= numLines; line++) {
        const period = line * increment;
        stochs.push(new StochQueue(period));
        // Smooth with MA
        smooths.push(maStep(smooth, maType));
      }
      // Slow = MA(fast, smoothSlow)
      const slow = maStep(smoothSlow, maType);
      const s: ShmRun = {
        stochs, smooths, slow, fastPlot: [], slowPlot: [], avgPlot: [], barColors: [],
        steps: [...stochs, ...smooths, slow], vars: {}, lists: [], series: [],
      };
      s.lists = [s.barColors];
      s.series = [s.fastPlot, s.slowPlot, s.avgPlot];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // Compute average stochastic across all lines per bar
      let sum = 0;
      let count = 0;
      for (let line = 0; line < numLines; line++) {
        const v = s.smooths[line].step(s.stochs[line].step(b.close, b.high, b.low));
        if (!isNaN(v)) {
          sum += v;
          count++;
        }
      }
      const avg = count > 0 ? sum / count : NaN;
      // Fast = (avgStoch / 100) * plotNumber
      const fast = isNaN(avg) ? NaN : (avg / 100) * numLines;
      const slow = s.slow.step(fast);
      const t = b.time;
      s.fastPlot[i] = { time: t, value: i < warmup || isNaN(fast) ? NaN : fast };
      s.slowPlot[i] = { time: t, value: i < warmup || isNaN(slow) ? NaN : slow };
      // Average stochastic histogram colored by heat map
      s.avgPlot[i] = { time: t, value: i < warmup || isNaN(avg) ? NaN : avg, color: isNaN(avg) ? '#787B86' : heatColor(avg) };
      // Bar colors when paintBars enabled
      if (paintBars && i >= warmup && !isNaN(avg)) s.barColors.push({ time: t as number, color: heatColor(avg) });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { fast: s.fastPlot.slice(), slow: s.slowPlot.slice(), avg: s.avgPlot.slice() },
        hlines: [
          { value: 50, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Mid' } },
        ],
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<StochasticHeatMapInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<StochasticHeatMapInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const StochasticHeatMap = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
