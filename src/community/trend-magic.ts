/**
 * Trend Magic
 *
 * CCI-directed ATR trailing stop.
 * When CCI >= 0: trailing support (bufferUp) ratchets upward.
 * When CCI <= 0: trailing resistance (bufferDn) ratchets downward.
 * On CCI zero-cross, the opposite buffer seeds from the previous value.
 *
 * Reference: "Trend Magic"
 */

import { taStep, taCore, compare, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type Committable, type BarStudy, type IndicatorRun } from '../live-run';

export interface TrendMagicInputs {
  cciPeriod: number;
  atrPeriod: number;
  atrMultiplier: number;
}

export const defaultInputs: TrendMagicInputs = {
  cciPeriod: 20,
  atrPeriod: 5,
  atrMultiplier: 1,
};

export const inputConfig: InputConfig[] = [
  { id: 'cciPeriod', type: 'int', title: 'CCI Period', defval: 20, min: 1 },
  { id: 'atrPeriod', type: 'int', title: 'ATR Period', defval: 5, min: 1 },
  { id: 'atrMultiplier', type: 'float', title: 'ATR Multiplier', defval: 1, min: 0.1, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trend Magic', color: '#26A69A', lineWidth: 3 },
];

export const metadata = {
  title: 'Trend Magic',
  shortTitle: 'TM',
  overlay: true,
};

/**
 * `ta.cci(source, length)` with a constant length, one bar at a time: the mean from {@link WindowSma} and the mean
 * deviation over the kept values (the doubles of taStep.cci, faster).
 */
class CciStep implements Committable {
  private readonly mean: WindowSma;
  private readonly len: number;
  private values: number[] = [];
  private pending = NaN;
  private stepped = false;
  private last = 0;
  private next = 0;

  constructor(length: number) {
    // the length check of ta.cci (the same runtime error)
    taCore.cci([], length);
    this.len = Math.floor(length);
    this.mean = new WindowSma(length);
  }

  step(value: number): number {
    this.stepped = true;
    this.pending = value;
    this.next = this.last;
    const mean = this.mean.step(value);
    const n = this.values.length;
    if (n < this.len - 1 || Number.isNaN(mean)) return NaN;
    // ta.dev: the mean of |source - sma| over the last `length` bars
    let sum = 0;
    for (let k = 0; k < this.len; k++) sum += Math.abs((k === 0 ? value : this.values[n - k]!) - mean);
    const d = sum / this.len;
    if (Number.isNaN(d)) return NaN;
    if (!compare.eq(d, 0)) this.next = (value - mean) / (0.015 * d);
    return this.next;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.last = this.next;
    this.mean.commit();
    this.values.push(this.pending);
    if (this.values.length > this.len * 2 + 1024) this.values = this.values.slice(-this.len);
  }
}

type Point = { time: number; value: number; color?: string };

interface TmRun extends BarRunState<Record<string, never>> {
  cci: CciStep;
  tr: ReturnType<typeof taStep.tr>;
  atr: WindowSma;
  cciArr: number[];
  bufferUp: number[];
  bufferDn: number[];
  plot0: Point[];
}

function study(inputs: Partial<TrendMagicInputs>): BarStudy<TmRun, IndicatorResult> {
  const { cciPeriod, atrPeriod, atrMultiplier } = { ...defaultInputs, ...inputs };
  const warmup = Math.max(cciPeriod, atrPeriod);
  return {
    init() {
      const cci = new CciStep(cciPeriod);
      // PineScript uses sma(tr, period) not ta.atr for Trend Magic
      const tr = taStep.tr();
      const atr = new WindowSma(atrPeriod);
      const s: TmRun = {
        cci, tr, atr, cciArr: [], bufferUp: [], bufferDn: [], plot0: [],
        steps: [cci, tr, atr], vars: {}, lists: [], series: [],
      };
      s.series = [s.cciArr, s.bufferUp, s.bufferDn, s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const cciValue = s.cci.step(b.close);
      s.cciArr[i] = cciValue;
      const atrValue = s.atr.step(s.tr.step(b.high, b.low, b.close));
      const thisCCI = cciValue ?? 0;
      const lastCCI = i > 0 ? (s.cciArr[i - 1] ?? 0) : 0;
      const atr = (atrValue ?? 0) * atrMultiplier;

      let bufferDn = b.high + atr;
      let bufferUp = b.low - atr;

      if (thisCCI >= 0 && lastCCI < 0) {
        bufferUp = i > 0 ? s.bufferDn[i - 1] : bufferDn;
      }
      if (thisCCI <= 0 && lastCCI > 0) {
        bufferDn = i > 0 ? s.bufferUp[i - 1] : bufferUp;
      }

      if (thisCCI >= 0) {
        if (i > 0 && bufferUp < s.bufferUp[i - 1]) {
          bufferUp = s.bufferUp[i - 1];
        }
      } else {
        if (i > 0 && bufferDn > s.bufferDn[i - 1]) {
          bufferDn = s.bufferDn[i - 1];
        }
      }
      s.bufferUp[i] = bufferUp;
      s.bufferDn[i] = bufferDn;

      const tm = thisCCI >= 0 ? bufferUp : bufferDn;
      if (i < warmup) {
        s.plot0[i] = { time: b.time, value: NaN };
      } else {
        const color = (cciValue ?? 0) >= 0 ? '#00FF00' : '#FF0000';
        s.plot0[i] = { time: b.time, value: tm, color };
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TrendMagicInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TrendMagicInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const TrendMagic = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
