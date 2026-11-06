/**
 * Elastic Volume Weighted Moving Average [LazyBear]
 *
 * EVWMA of the close: each bar moves the average by its volume share of the "floating shares" (the volume of the
 * last `length` bars, or the cumulative volume): evwma = evwma[1] * (shares - volume) / shares
 * + volume * close / shares. With `Draw Envelope` the same average of the high (red) and of the low (green) is drawn
 * around it.
 *
 * Reference: "Elastic Volume Weighted Moving Average [LazyBear]" by LazyBear
 */

import { taStep, math, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSum, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface EVWMAEnvelopeInputs {
  /** length */
  length: number;
  /** Use Cumulative Volume */
  useCV: boolean;
  /** Draw Envelope */
  renderBands: boolean;
}

export const defaultInputs: EVWMAEnvelopeInputs = {
  length: 20,
  useCV: false,
  renderBands: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 20 },
  { id: 'useCV', type: 'bool', title: 'Use Cumulative Volume', defval: false },
  { id: 'renderBands', type: 'bool', title: 'Draw Envelope', defval: false },
];

/** Pine version 1 colours: maroon, red, green */
const MAROON = '#800000';
const RED = '#FF0000';
const GREEN = '#008000';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'evwma', color: MAROON, lineWidth: 2 },
  { id: 'plot1', title: 'evwma+', color: RED, lineWidth: 2 },
  { id: 'plot2', title: 'evwma-', color: GREEN, lineWidth: 2 },
];

export const metadata = {
  title: 'Elastic Volume Weighted Moving Average [LazyBear]',
  shortTitle: 'EVWMA_LB',
  overlay: true,
};

/** nz(): na (also an infinite value of a division by 0) -> 0 */
const nz = (v: number) => (Number.isFinite(v) ? v : 0);

type Point = { time: any; value: number };

/** calc_evwma: data = nz(data[1]) * (shares - volume) / shares + volume * price / shares */
const evwma = (prev: number, price: number, nbfs: number, v: number) => (nz(prev) * (nbfs - v)) / nbfs + (v * price) / nbfs;

interface EvwmaVars {
  /** calc_evwma(price, length, nb_floating_shares): each call keeps its own `data` history */
  prevM: number;
  prevU: number;
  prevL: number;
}

interface EvwmaRun extends BarRunState<EvwmaVars> {
  shares: { step(v: number): number; commit(): void };
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
}

function study(inputs: Partial<EVWMAEnvelopeInputs>): BarStudy<EvwmaRun, IndicatorResult> {
  const { length, useCV, renderBands } = { ...defaultInputs, ...inputs };
  return {
    init() {
      // nbfs = useCV ? cum(volume) : sum(volume, length)
      // the length check of math.sum (the same runtime error)
      if (!useCV) math.sum([], length);
      const shares = useCV ? taStep.cum() : new WindowSum(length);
      const s: EvwmaRun = {
        shares, plot0: [], plot1: [], plot2: [], steps: [shares], lists: [], series: [],
        vars: { prevM: NaN, prevU: NaN, prevL: NaN },
      };
      s.series = [s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = b.volume ?? NaN;
      const nbfs = s.shares.step(v) ?? NaN;
      const vs = s.vars;
      const m = evwma(vs.prevM, b.close, nbfs, v);
      vs.prevM = m;
      s.plot0[i] = { time: b.time, value: Number.isFinite(m) ? m : NaN };
      if (renderBands) {
        const upper = evwma(vs.prevU, b.high, nbfs, v);
        const lower = evwma(vs.prevL, b.low, nbfs, v);
        vs.prevU = upper;
        vs.prevL = lower;
        s.plot1[i] = { time: b.time, value: Number.isFinite(upper) ? upper : NaN };
        s.plot2[i] = { time: b.time, value: Number.isFinite(lower) ? lower : NaN };
      } else {
        s.plot1[i] = { time: b.time, value: NaN };
        s.plot2[i] = { time: b.time, value: NaN };
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EVWMAEnvelopeInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<EVWMAEnvelopeInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const EVWMAEnvelope = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
