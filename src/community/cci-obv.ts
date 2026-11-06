/**
 * CCI coded OBV
 *
 * Pine: overlay=false, 2 plots:
 *   1) OBV line colored by CCI: green when CCI(close, length) >= threshold, red otherwise
 *   2) EMA(OBV, emaLength) in orange
 *
 * The OBV is cum(change(src) > 0 ? volume : change(src) < 0 ? -volume : 0)
 * The CCI is computed on close (standard CCI), NOT on OBV.
 * Color coding: OBV line is green when CCI >= threshold, red otherwise.
 *
 * Reference: "CCI coded OBV" by LazyBear
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type Committable, type BarStudy, type IndicatorRun } from '../live-run';

export interface CCIOBVInputs {
  cciLength: number;
  threshold: number;
  emaLength: number;
}

export const defaultInputs: CCIOBVInputs = {
  cciLength: 20,
  threshold: 0,
  emaLength: 13,
};

export const inputConfig: InputConfig[] = [
  { id: 'cciLength', type: 'int', title: 'CCI Length', defval: 20, min: 1 },
  { id: 'threshold', type: 'int', title: 'CCI threshold for OBV coding', defval: 0 },
  { id: 'emaLength', type: 'int', title: 'EMA length', defval: 13, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'obv', title: 'OBV_CCI coded', color: '#26A69A', lineWidth: 2 },
  { id: 'obvEma', title: 'EMA of OBV', color: '#FF9800', lineWidth: 2 },
];

export const metadata = {
  title: 'CCI coded OBV',
  shortTitle: 'CCIOBV',
  overlay: false,
};

/**
 * `ta.cci(source, length)` with a constant length, one bar at a time: (source - sma) / (0.015 * dev), a zero dev keeps
 * the previous value (0 at the start); the operations of taStep.cci (the same doubles) on a {@link WindowSma}.
 */
class CciWindow implements Committable {
  private readonly mean: WindowSma;
  private readonly len: number;
  /** Values of the committed bars (na included) */
  private history: number[] = [];
  private pending = NaN;
  private stepped = false;
  private last = 0;
  private next = 0;

  constructor(length: number) {
    // the length checks of ta.cci (the same runtime errors)
    taStep.cci(length);
    this.mean = new WindowSma(length);
    this.len = Math.floor(length);
  }

  step(value: number): number {
    this.stepped = true;
    this.pending = value;
    this.next = this.last;
    const mean = this.mean.step(value);
    const h = this.history;
    // ta.dev: the mean of |source - sma| over the last `length` bars
    if (h.length < this.len - 1 || Number.isNaN(mean)) return NaN;
    let sum = 0;
    for (let k = 0; k < this.len; k++) sum += Math.abs((k === 0 ? value : h[h.length - k]!) - mean);
    const d = sum / this.len;
    if (Number.isNaN(d)) return NaN;
    if (!(Math.abs(d) <= 1e-10)) this.next = (value - mean) / (0.015 * d);
    return this.next;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.last = this.next;
    this.mean.commit();
    this.history.push(this.pending);
    if (this.history.length > this.len * 2 + 1024) this.history = this.history.slice(-this.len);
  }
}

interface CciObvRun extends BarRunState<{ obv: number }> {
  cci: CciWindow;
  ema: ReturnType<typeof taStep.ema>;
  obvPlot: { time: number; value: number; color: string }[];
  emaPlot: { time: number; value: number }[];
}

const GREEN = '#26A69A';
const RED = '#EF5350';

function study(inputs: Partial<CCIOBVInputs>): BarStudy<CciObvRun, IndicatorResult> {
  const { cciLength, threshold, emaLength } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const cci = new CciWindow(cciLength);
      const ema = taStep.ema(emaLength);
      const s: CciObvRun = { cci, ema, obvPlot: [], emaPlot: [], steps: [cci, ema], vars: { obv: 0 }, lists: [], series: [] };
      s.series = [s.obvPlot, s.emaPlot];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // Compute OBV: cum(change(src) > 0 ? volume : change(src) < 0 ? -volume : 0)
      if (i > 0) {
        const chg = b.close - bars[i - 1].close;
        const vol = b.volume ?? 0;
        if (chg > 0) {
          s.vars.obv = s.vars.obv + vol;
        } else if (chg < 0) {
          s.vars.obv = s.vars.obv - vol;
        }
      }
      const v = s.vars.obv;
      // Compute CCI on close (standard)
      const cci = s.cci.step(b.close);
      // EMA of OBV
      const emaOBV = s.ema.step(v);
      // Pine: color=c>=threshold?green:red  (na >= threshold is false → red during warmup)
      s.obvPlot[i] = { time: b.time, value: v, color: !isNaN(cci) && cci >= threshold ? GREEN : RED };
      s.emaPlot[i] = { time: b.time, value: emaOBV ?? NaN };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { obv: s.obvPlot.slice(), obvEma: s.emaPlot.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CCIOBVInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CCIOBVInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const CCIOBV = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
