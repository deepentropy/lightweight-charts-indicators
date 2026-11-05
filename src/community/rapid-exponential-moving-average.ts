/**
 * [Pandora][Swarm] Rapid Exponential Moving Average
 *
 * A swarm of 59 filters of the source, periods 1 to 59, all with the selected filter. The Rapid Exponential Moving
 * Average (rema) is an EMA-like filter: omega = 2 pi / (sqrt(0.5)^period * sqrt(17.8) + 1 + period),
 * k = (sin(omega) + cos(omega) - 1) / cos(omega), filter = k * src + (1 - k) * filter[1]. Other choices: rema applied
 * 2, 3 or 4 times, a 2-pole SuperSmoother (jess), a Hann window FIR filter, and ta.alma / wma / ema / hma / sma / rma.
 * The option 'ta.vwma' gives ta.rma, as in the original script (its switch case is 'ta.vwma()').
 *
 * Reference: "[Pandora][Swarm] Rapid Exponential Moving Average" by ImmortalFreedom
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © ImmortalFreedom
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RapidExponentialMovingAverageInputs {
  /** Source series */
  source: SourceType;
  /** Filter of the swarm */
  filter: string;
}

const FILTERS = ['jess()', 'rema()', 'drema()', 'trema()', 'qrema()', 'ta.alma()', 'ta.wma()', 'ta.ema()', 'ta.hma()',
  'hann()', 'ta.sma()', 'ta.vwma', 'ta.rma()'];

export const defaultInputs: RapidExponentialMovingAverageInputs = {
  source: 'close',
  filter: 'rema()',
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source Series', defval: 'close' },
  { id: 'filter', type: 'string', title: 'Filters+', defval: 'rema()', options: FILTERS },
];

const PERIODS = Array.from({ length: 59 }, (_v, k) => k + 1); // 1 .. 59
const plotColor = (p: number) => (p === 1 ? '#EDDDDD' : p % 10 === 0 ? '#CC33FF99' : '#CC33FF');

// display = display.all - display.status_line - display.price_scale on every plot (drawn in the pane)
export const plotConfig: PlotConfig[] = PERIODS.map((p, k): PlotConfig => (
  { id: `plot${k}`, title: String(p).padStart(2, '0'), color: plotColor(p), lineWidth: 1 }));

export const metadata = {
  title: '[Pandora][Swarm] Rapid Exponential Moving Average',
  shortTitle: 'REMA',
  overlay: true,
};

const nz = (x: number, y: number) => (isNaN(x) ? y : x);
/** Pine a < b: b - a > 1e-10 */
const lt = (a: number, b: number) => b - a > 1e-10;

const SQRT17_8 = Math.sqrt(17.8);
const SQRT0_5 = Math.sqrt(0.5);
const PIx2 = Math.PI * 2.0;

type Point = { time: number; value: number; color: string };
type Machine = { step(v: number, volume: number): number; commit(): void };

/** The rema() coefficients of a period (null below 2: the source itself) */
function remaCoefs(period: number): [number, number] | null {
  if (lt(period, 2.0)) return null;
  const omega = PIx2 / (Math.pow(SQRT0_5, period) * SQRT17_8 + 1.0 + period);
  const alpha = Math.cos(omega);
  const coef0 = (Math.sin(omega) + alpha - 1.0) / alpha;
  return [coef0, 1.0 - coef0];
}

/** ta.alma(src, period, 0.85, 6) weights (the operations of the oakscriptjs function) */
function almaWeights(length: number, offset: number, sigma: number): number[] {
  const m = offset * (length - 1);
  const s = length / sigma;
  const weights: number[] = [];
  let weightSum = 0;
  for (let i = 0; i < length; i++) {
    const weight = Math.exp(-1 * Math.pow(i - m, 2) / (2 * Math.pow(s, 2)));
    weights.push(weight);
    weightSum += weight;
  }
  for (let i = 0; i < length; i++) weights[i]! /= weightSum;
  return weights;
}

/**
 * ta.sma(source, length) with a constant length, one bar at a time: the correctly rounded sum of the last `length`
 * non-na values (the exact partial sums of the oakscriptjs running sum: the value that leaves, then the one that
 * enters) divided by the length; a bar with an na value keeps the previous result.
 */
class SmaStep implements Machine {
  private readonly values: number[] = [];
  private kept = new Float64Array(64);
  private keptCount = 0;
  private next = new Float64Array(64);
  private nextCount = 0;
  private last = NaN;
  private stepSum = NaN;
  private stepValue = NaN;
  private readonly len: number;

  constructor(length: number) {
    // the length check of ta.sma
    taStep.sma().step(0, length);
    this.len = Math.floor(length);
  }

  private add(x: number): void {
    let p = this.next;
    const n = this.nextCount;
    let i = 0;
    for (let j = 0; j < n; j++) {
      let y = p[j]!;
      if (Math.abs(x) < Math.abs(y)) {
        const t = x;
        x = y;
        y = t;
      }
      const hi = x + y;
      const lo = y - (hi - x);
      if (lo !== 0) p[i++] = lo;
      x = hi;
    }
    if (i === p.length) {
      const grown = new Float64Array(p.length * 2);
      grown.set(p);
      this.next = p = grown;
    }
    p[i] = x;
    this.nextCount = i + 1;
  }

  private round(): number {
    const p = this.next;
    let n = this.nextCount;
    if (n === 0) return 0;
    let hi = p[--n]!;
    while (n > 0) {
      const x = hi;
      const y = p[--n]!;
      hi = x + y;
      const lo = y - (hi - x);
      if (lo !== 0) {
        // half-way case: the rest has the same sign, so round away from the tie
        if (n > 0 && ((lo < 0 && p[n - 1]! < 0) || (lo > 0 && p[n - 1]! > 0))) {
          const y2 = lo * 2;
          const x2 = hi + y2;
          if (y2 === x2 - hi) hi = x2;
        }
        break;
      }
    }
    return hi;
  }

  step(v: number): number {
    const len = this.len;
    if (!(len >= 1)) return NaN;
    if (!Number.isFinite(v)) {
      this.stepValue = NaN;
      return this.last / len;
    }
    if (this.next.length < this.kept.length) this.next = new Float64Array(this.kept.length);
    this.next.set(this.kept.subarray(0, this.keptCount));
    this.nextCount = this.keptCount;
    const count = this.values.length;
    if (count >= len) this.add(-this.values[count - len]!);
    this.add(v);
    this.stepValue = v;
    this.stepSum = count + 1 >= len ? this.round() : NaN;
    return this.stepSum / len;
  }

  commit(): void {
    if (Number.isNaN(this.stepValue)) return;
    const k = this.kept;
    this.kept = this.next;
    this.keptCount = this.nextCount;
    this.next = k;
    this.values.push(this.stepValue);
    this.last = this.stepSum;
    this.stepValue = NaN;
  }
}

interface RemaVars {
  /** rema() chains: the previous output of chain level j of period k at [k * 4 + j]; jess(): f1 at [k * 4], f2 at [k * 4 + 1] */
  prev: number[];
}

interface RemaRun extends BarRunState<RemaVars> {
  machines: Machine[];
  src: number[];
  /** The value of each period on the bar */
  outs: number[];
  plots: Point[][];
}

function study(inputs: Partial<RapidExponentialMovingAverageInputs>): BarStudy<RemaRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.source);
  const filter = cfg.filter;
  const depth = filter === 'rema()' ? 1 : filter === 'drema()' ? 2 : filter === 'trema()' ? 3 : filter === 'qrema()' ? 4 : 0;
  const coefs = PERIODS.map(remaCoefs);
  const colors = PERIODS.map(plotColor);
  const jessCoefs = PERIODS.map((period) => {
    const omega = (Math.sqrt(2.0) * Math.PI) / period;
    const alpha = Math.exp(-omega);
    const coef2 = Math.pow(alpha, 2);
    const coef1 = Math.cos(omega) * 2.0 * alpha;
    return [1.0 - coef1 + coef2, coef1, coef2];
  });
  // hann(): the coefficients of each period (j = 0 .. period - 1) and their sums from j = top down to 0, in the order
  // of the loop of the script
  const hannCoefs = PERIODS.map((period) => {
    const omega = Math.PI / (1 + period);
    return Array.from({ length: period }, (_v, j) => Math.pow(Math.sin(omega * (1 + j)), 2));
  });
  const hannSums = hannCoefs.map((c) => c.map((_v, top) => {
    let d = 0.0;
    for (let j = top; j >= 0; j--) d += c[j];
    return d;
  }));
  let weights: number[][] = [];
  const machineOf = (p: number): Machine | null => {
    switch (filter) {
      case 'ta.wma()': { const m = taStep.wma(); return { step: (v) => m.step(v, p), commit: () => m.commit() }; }
      case 'ta.ema()': { const m = taStep.ema(p); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'ta.sma()': return new SmaStep(p);
      case 'ta.hma()': {
        if (!(p > 1)) return { step: (v) => v, commit: () => undefined };
        const m = taStep.hma(p);
        return { step: (v) => m.step(v), commit: () => m.commit() };
      }
      case 'ta.vwma()': { const m = taStep.vwma(p); return { step: (v, vol) => m.step(v, vol), commit: () => m.commit() }; }
      case 'jess()': case 'rema()': case 'drema()': case 'trema()': case 'qrema()': case 'ta.alma()': case 'hann()':
        return null;
      default: { const m = taStep.rma(p); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    }
  };
  return {
    fullRunReason: () => (isBarSource(cfg.source) ? null : 'source of another study'),
    init() {
      const machines = PERIODS.map(machineOf).filter((m): m is Machine => m !== null);
      if (filter === 'ta.alma()') weights = PERIODS.map((p) => almaWeights(p, 0.85, 6.0));
      const s: RemaRun = {
        machines, src: [], outs: new Array(PERIODS.length).fill(NaN), plots: PERIODS.map(() => []),
        steps: machines, vars: { prev: new Array(PERIODS.length * 4).fill(NaN) }, lists: [], series: [],
      };
      s.series = [s.src, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const src = s.src;
      const x = value(b);
      src[i] = x;
      // changed in place: copyVars copies it at the end of the last confirmed bar
      const prev = s.vars.prev;
      const outs = s.outs;
      if (depth > 0) {
        // rema(Series, Period): filter = coef0 * src + coef1 * nz(filter[1], src), chained depth times
        for (let k = 0; k < PERIODS.length; k++) {
          const c = coefs[k];
          let out = x;
          if (c) {
            for (let j = 0; j < depth; j++) {
              const o = c[0] * out + c[1] * nz(prev[k * 4 + j], out);
              prev[k * 4 + j] = o;
              out = o;
            }
          }
          outs[k] = out;
        }
      } else if (filter === 'jess()') {
        // jess(Series, Period): 2-pole SuperSmoother of the 2-bar average
        const s1 = i > 0 ? src[i - 1] : NaN;
        for (let k = 0; k < PERIODS.length; k++) {
          if (lt(PERIODS[k], 2.0)) {
            outs[k] = x;
            continue;
          }
          const c = jessCoefs[k];
          const sma2 = (x + nz(s1, x)) / 2;
          const f1 = prev[k * 4];
          const f2 = prev[k * 4 + 1];
          const out = c[0] * sma2 + c[1] * nz(f1, x) - c[2] * nz(f2, nz(f1, x));
          prev[k * 4 + 1] = f1;
          prev[k * 4] = out;
          outs[k] = out;
        }
      } else if (filter === 'ta.alma()') {
        for (let k = 0; k < PERIODS.length; k++) {
          const p = PERIODS[k];
          if (i < p - 1) {
            outs[k] = NaN;
            continue;
          }
          const w = weights[k];
          let out = 0;
          for (let j = 0; j < p; j++) out += src[i - p + 1 + j]! * w[j]!;
          outs[k] = out;
        }
      } else if (filter === 'hann()') {
        // hann(Series, Period): Hann window FIR filter
        for (let k = 0; k < PERIODS.length; k++) {
          const c = hannCoefs[k];
          let e = 0.0;
          // for int i = math.min(bar_index, Period - 1) to 0 (counts down)
          const top = Math.min(i, PERIODS[k] - 1);
          for (let j = top; j >= 0; j--) e += c[j] * src[i - j];
          outs[k] = e / hannSums[k][top];
        }
      } else {
        const volume = b.volume ?? NaN;
        for (let k = 0; k < PERIODS.length; k++) outs[k] = s.machines[k].step(x, volume);
      }
      for (let k = 0; k < PERIODS.length; k++) {
        const out = outs[k];
        s.plots[k][i] = { time, value: Number.isFinite(out) ? out : NaN, color: colors[k] };
      }
    },
    copyVars: (v) => ({ prev: v.prev.slice() }),
    result(s) {
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((pl, k) => { plots[`plot${k}`] = pl.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RapidExponentialMovingAverageInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RapidExponentialMovingAverageInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const RapidExponentialMovingAverage = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  createRun,
};
