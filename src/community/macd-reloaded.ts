/**
 * MACD ReLoaded
 *
 * MACD with 11 selectable moving average types for fast, slow, and trigger lines.
 * Supports SMA, EMA, WMA, DEMA, TMA, VAR, WWMA, ZLEMA, TSF, HULL, and TILL (Tillson T3).
 *
 * 4-color histogram (the original's colours): lime / #B2DFDB above zero, #FFCDD2 / #EF5350 below zero, the first
 * when the histogram rises.
 *
 * Reference: "MACD ReLoaded" by KivancOzbilgic
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export type MaType = 'SMA' | 'EMA' | 'WMA' | 'DEMA' | 'TMA' | 'VAR' | 'WWMA' | 'ZLEMA' | 'TSF' | 'HULL' | 'TILL';

export interface MacdReloadedInputs {
  fastLength: number;
  slowLength: number;
  triggerLength: number;
  maType: MaType;
  t3Volume: number;
  showHistogram: boolean;
}

export const defaultInputs: MacdReloadedInputs = {
  fastLength: 12,
  slowLength: 26,
  triggerLength: 9,
  maType: 'VAR',
  t3Volume: 0.7,
  showHistogram: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Short Moving Average Length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Long Moving Average Length', defval: 26, min: 1 },
  { id: 'triggerLength', type: 'int', title: 'Trigger Length', defval: 9, min: 1 },
  { id: 'maType', type: 'string', title: 'Moving Average Type', defval: 'VAR', options: ['SMA', 'EMA', 'WMA', 'DEMA', 'TMA', 'VAR', 'WWMA', 'ZLEMA', 'TSF', 'HULL', 'TILL'] },
  { id: 't3Volume', type: 'float', title: 'TILLSON T3 Volume Factor', defval: 0.7, min: 0, max: 1, step: 0.1 },
  { id: 'showHistogram', type: 'bool', title: 'Show MACD Histogram', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'histogram', title: 'Histogram', color: '#00E676', lineWidth: 4, style: 'columns' },
  { id: 'macd', title: 'MACDRe', color: '#426BE6', lineWidth: 2 },
  { id: 'trigger', title: 'TRIGGER', color: '#E60000', lineWidth: 2 },
];

export const metadata = {
  title: 'MACD ReLoaded',
  shortTitle: 'MACDRe',
  overlay: false,
};

/** One moving average of the study stepped bar by bar */
type Ma = Committable & { step(v: number): number };

/**
 * VAR (VIDYA with the CMO of 9 bars), bar by bar: vud1 / vdd1 = the up / down change of the source (0 on the first
 * bar), summed over the last 9 bars (fewer at the start, oldest first); result = k * src + (1 - k) * result[1] with
 * k = alpha * |CMO|, the source on the first bar.
 */
class VarStep implements Committable {
  private readonly ud = new Float64Array(9);
  private readonly dd = new Float64Array(9);
  private count = 0;
  private prevSrc = NaN;
  private prevResult = NaN;
  private nextUd = 0;
  private nextDd = 0;
  private nextSrc = NaN;
  private nextResult = NaN;
  private stepped = false;

  constructor(private readonly valpha: number) {}

  step(src: number): number {
    this.stepped = true;
    const i = this.count;
    const vud1 = i === 0 ? 0 : src > this.prevSrc ? src - this.prevSrc : 0;
    const vdd1 = i === 0 ? 0 : src < this.prevSrc ? this.prevSrc - src : 0;
    this.nextUd = vud1;
    this.nextDd = vdd1;
    this.nextSrc = src;
    let result: number;
    if (i === 0) {
      result = src;
    } else {
      // Rolling sum(9)
      let su = 0, sd = 0;
      for (let j = Math.max(0, i - 8); j < i; j++) {
        su += this.ud[j % 9];
        sd += this.dd[j % 9];
      }
      su += vud1;
      sd += vdd1;
      const denom = su + sd;
      const vCMO = denom !== 0 ? (su - sd) / denom : 0;
      const k = this.valpha * Math.abs(vCMO);
      result = k * src + (1 - k) * this.prevResult;
    }
    this.nextResult = result;
    return result;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.ud[this.count % 9] = this.nextUd;
    this.dd[this.count % 9] = this.nextDd;
    this.count++;
    this.prevSrc = this.nextSrc;
    this.prevResult = this.nextResult;
  }
}

/** WWMA (Welles Wilder MA, alpha = 1 / length), bar by bar: the source on the first bar */
class WwmaStep implements Committable {
  private prev = NaN;
  private next = NaN;
  private started = false;
  private stepped = false;

  constructor(private readonly alpha: number) {}

  step(src: number): number {
    this.stepped = true;
    this.next = this.started ? this.alpha * src + (1 - this.alpha) * this.prev : src;
    return this.next;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.started = true;
    this.prev = this.next;
  }
}

/** The ZLEMA source, bar by bar: src + (src - src[zxLag]) (src of the first bar before bar zxLag) */
class ZlemaSource implements Committable {
  private readonly history: number[] = [];
  private next = NaN;
  private stepped = false;

  constructor(private readonly zxLag: number) {}

  step(src: number): number {
    this.stepped = true;
    this.next = src;
    const i = this.history.length;
    const lagged = i >= this.zxLag ? (this.zxLag === 0 ? src : this.history[i - this.zxLag]) : (i === 0 ? src : this.history[0]);
    return src + (src - lagged);
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.history.push(this.next);
  }
}

/** A step of one MA type on a source (the steps the old array version called, in the same order) */
function maStep(length: number, maType: MaType, t3a: number): Ma {
  const of = (steps: Committable[], step: (v: number) => number): Ma => ({
    step,
    commit: () => { for (const m of steps) m.commit(); },
  });
  switch (maType) {
    case 'SMA':
      return new WindowSma(length);
    case 'WMA': {
      const w = taStep.wma();
      return of([w], (v) => w.step(v, length));
    }
    case 'DEMA': {
      const e1 = taStep.ema(length);
      const e2 = taStep.ema(length);
      return of([e1, e2], (v) => {
        const a = e1.step(v);
        return 2 * a - e2.step(a);
      });
    }
    case 'TMA': {
      // TRIMA = SMA(SMA(src, ceil(len/2)), floor(len/2)+1)
      const s1 = new WindowSma(Math.ceil(length / 2));
      const s2 = new WindowSma(Math.floor(length / 2) + 1);
      return of([s1, s2], (v) => s2.step(s1.step(v)));
    }
    case 'VAR':
      // Variable Index Dynamic Average (VIDYA) using CMO
      return new VarStep(2 / (length + 1));
    case 'WWMA':
      // Welles Wilder MA (= RMA with alpha=1/length)
      return new WwmaStep(1 / length);
    case 'ZLEMA': {
      // Zero-Lag EMA
      const zxLag = length % 2 === 0 ? length / 2 : (length - 1) / 2;
      const zx = new ZlemaSource(zxLag);
      const e = taStep.ema(length);
      return of([zx, e], (v) => e.step(zx.step(v)));
    }
    case 'TSF': {
      // Time Series Forecast: linreg(src, len, 0) + (linreg(src, len, 0) - linreg(src, len, 1))
      const l0 = taStep.linreg(length, 0);
      const l1 = taStep.linreg(length, 1);
      return of([l0, l1], (v) => {
        const a = l0.step(v);
        return a + (a - l1.step(v));
      });
    }
    case 'HULL': {
      // HMA = WMA(2*WMA(src, len/2) - WMA(src, len), round(sqrt(len)))
      const halfLen = Math.max(Math.round(length / 2), 1);
      const sqrtLen = Math.max(Math.round(Math.sqrt(length)), 1);
      const w1 = taStep.wma();
      const w2 = taStep.wma();
      const w3 = taStep.wma();
      return of([w1, w2, w3], (v) => w3.step(2 * w1.step(v, halfLen) - w2.step(v, length), sqrtLen));
    }
    case 'TILL': {
      // Tillson T3: chain of 6 EMAs with cubic coefficients
      const e = [1, 2, 3, 4, 5, 6].map(() => taStep.ema(length));
      const a = t3a;
      const c1 = -a * a * a;
      const c2 = 3 * a * a + 3 * a * a * a;
      const c3 = -6 * a * a - 3 * a - 3 * a * a * a;
      const c4 = 1 + 3 * a + a * a * a + 3 * a * a;
      return of(e, (v) => {
        const e1 = e[0].step(v);
        const e2 = e[1].step(e1);
        const e3 = e[2].step(e2);
        const e4 = e[3].step(e3);
        const e5 = e[4].step(e4);
        const e6 = e[5].step(e5);
        return c1 * e6 + c2 * e5 + c3 * e4 + c4 * e3;
      });
    }
    default:
      // EMA
      return taStep.ema(length);
  }
}

type Point = { time: number | string; value: number; color?: string };

interface MacdReRun extends BarRunState<Record<string, never>> {
  fast: Ma;
  slow: Ma;
  trigger: Ma;
  hist: number[];
  histPlot: Point[];
  macdPlot: Point[];
  triggerPlot: Point[];
}

function study(inputs: Partial<MacdReloadedInputs>): BarStudy<MacdReRun, IndicatorResult> {
  const { fastLength, slowLength, triggerLength, maType, t3Volume, showHistogram } = { ...defaultInputs, ...inputs };
  // Warmup: use slowLength as the minimum warmup
  const warmup = slowLength;
  return {
    init() {
      // Fast MA (MA12) and Slow MA (MA26) on close, trigger/signal line = MA of the MACD line with triggerLength
      const fast = maStep(fastLength, maType, t3Volume);
      const slow = maStep(slowLength, maType, t3Volume);
      const trigger = maStep(triggerLength, maType, t3Volume);
      const s: MacdReRun = {
        fast, slow, trigger, hist: [], histPlot: [], macdPlot: [], triggerPlot: [],
        steps: [fast, slow, trigger], vars: {}, lists: [], series: [],
      };
      s.series = [s.hist, s.histPlot, s.macdPlot, s.triggerPlot];
      return s;
    },
    bar(s, i, bars) {
      const t = bars[i].time;
      const close = bars[i].close;
      // MACD line = MA12 - MA26
      const m = s.fast.step(close) - s.slow.step(close);
      const tr = s.trigger.step(m);
      // Histogram = MACD - Trigger
      const h = m - tr;
      s.hist[i] = h;
      if (i < warmup) {
        s.histPlot[i] = { time: t, value: NaN };
        s.macdPlot[i] = { time: t, value: NaN };
        s.triggerPlot[i] = { time: t, value: NaN };
      } else {
        // Pine: hist>=0 ? (hist[1]<hist ? color.lime : #B2DFDB) : (hist[1]<hist ? #FFCDD2 : #EF5350); na compares false
        const prevHist = i > 0 ? s.hist[i - 1] : NaN;
        const rising = prevHist < h;
        const color = h >= 0 ? (rising ? '#00E676' : '#B2DFDB') : (rising ? '#FFCDD2' : '#EF5350');
        s.histPlot[i] = { time: t, value: showHistogram ? h : NaN, color };
        s.macdPlot[i] = { time: t, value: isNaN(m) ? NaN : m };
        s.triggerPlot[i] = { time: t, value: isNaN(tr) ? NaN : tr };
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        // the original draws no horizontal line (no hline)
        plots: { 'histogram': s.histPlot.slice(), 'macd': s.macdPlot.slice(), 'trigger': s.triggerPlot.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MacdReloadedInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MacdReloadedInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const MacdReloaded = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
