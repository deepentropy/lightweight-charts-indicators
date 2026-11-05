/**
 * Trend Following Moving Averages
 *
 * Overlay indicator (overlay=true) with 20 moving average plots at lengths
 * 5, 10, 15, ..., 100. Each MA is conditionally colored with a gradient
 * based on trend strength (green for bullish, red for bearish, transparent for neutral).
 *
 * Trend detection uses a channel rate applied to a period of MA highs/lows,
 * optionally smoothed with linear regression.
 *
 * Reference: "Trend Following Moving Averages" by LonesomeTheBlue
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TrendFollowingMAInputs {
  maType: string;
  period: number;
  channelRate: number;
  useLinReg: boolean;
  linRegPeriod: number;
}

export const defaultInputs: TrendFollowingMAInputs = {
  maType: 'EMA',
  period: 20,
  channelRate: 1,
  useLinReg: true,
  linRegPeriod: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'EMA', options: ['EMA', 'SMA', 'RMA', 'WMA', 'VWMA'] },
  { id: 'period', type: 'int', title: 'Period to Check Trend', defval: 20, min: 5 },
  { id: 'channelRate', type: 'float', title: 'Trend Channel Rate %', defval: 1, min: 0.1, step: 0.1 },
  { id: 'useLinReg', type: 'bool', title: 'Use Linear Regression', defval: true },
  { id: 'linRegPeriod', type: 'int', title: 'Linear Regression Period', defval: 10, min: 2 },
];

const maLengths = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];

export const plotConfig: PlotConfig[] = maLengths.map((len) => ({
  id: `ma${len}`,
  title: `MA ${len}`,
  color: '#888888',
  lineWidth: 1,
}));

export const metadata = {
  title: 'Trend Following Moving Averages',
  shortTitle: 'TFMA',
  overlay: true,
};

function getColor(trend: number): string | undefined {
  if (trend >= 10.0) return '#00FF00ff';
  if (trend >= 9.0) return '#00FF00ef';
  if (trend >= 8.0) return '#00FF00df';
  if (trend >= 7.0) return '#00FF00cf';
  if (trend >= 6.0) return '#00FF00bf';
  if (trend >= 5.0) return '#00FF00af';
  if (trend >= 4.0) return '#00FF009f';
  if (trend >= 3.0) return '#00FF008f';
  if (trend >= 2.0) return '#00FF007f';
  if (trend >= 1.0) return '#00FF006f';
  if (trend <= -10.0) return '#FF0000ff';
  if (trend <= -9.0) return '#FF0000ef';
  if (trend <= -8.0) return '#FF0000df';
  if (trend <= -7.0) return '#FF0000cf';
  if (trend <= -6.0) return '#FF0000bf';
  if (trend <= -5.0) return '#FF0000af';
  if (trend <= -4.0) return '#FF00009f';
  if (trend <= -3.0) return '#FF00008f';
  if (trend <= -2.0) return '#FF00007f';
  if (trend <= -1.0) return '#FF00006f';
  return undefined; // na - transparent/hidden
}

type Point = { time: number; value: number; color?: string };

/**
 * `ta.linreg(source, length, 0)` one bar at a time with the operations of the oakscriptjs machine (same doubles): the
 * committed values in a ring of `length` slots, na while a value of the window is na or before `length` bars.
 */
class LinregStep {
  private readonly ring: Float64Array;
  private count = 0;
  private pending = NaN;
  private stepped = false;

  constructor(private readonly len: number) {
    this.ring = new Float64Array(Math.max(1, len));
  }

  step(value: number): number {
    this.stepped = true;
    this.pending = value;
    const len = this.len;
    const c = this.count;
    if (c < len - 1) return NaN;
    if (isNaN(value)) return NaN;
    const ring = this.ring;
    for (let j = 0; j < len - 1; j++) if (isNaN(ring[(c - (len - 1 - j)) % len])) return NaN;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    for (let j = 0; j < len; j++) {
      const x = j + 1;
      const y = j === len - 1 ? value : ring[(c - (len - 1 - j)) % len];
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }
    const slope = (len * sumXY - sumX * sumY) / (len * sumX2 - sumX * sumX);
    const intercept = sumY / len - (slope * sumX) / len + slope;
    return intercept + slope * (len - 1 - 0);
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.ring[this.count % this.len] = this.pending;
    this.count++;
  }
}

/**
 * `ta.highest(source, length)` / `ta.lowest` with a constant length, one bar at a time, with the results of the
 * oakscriptjs machine (Math.max / Math.min of the last `length` finite values, na before bar `length - 1`): a
 * monotonic queue of the committed finite values (a value is dropped by a later one it does not pass, +0 passes -0
 * for the highest).
 */
class WindowExtreme {
  private qv: number[] = [];
  private qi: number[] = [];
  private head = 0;
  /** Committed finite values */
  private count = 0;
  private bars = 0;
  private pending = NaN;
  private stepped = false;

  constructor(private readonly len: number, private readonly lowest: boolean) {}

  step(value: number): number {
    this.stepped = true;
    this.pending = value;
    const own = Number.isFinite(value);
    const n = this.count + (own ? 1 : 0);
    if (this.bars < this.len - 1 || n === 0) return NaN;
    const lo = n - this.len;
    let h = this.head;
    while (h < this.qi.length && this.qi[h] < lo) h++;
    if (h === this.qi.length) return value;
    const front = this.qv[h];
    if (!own) return front;
    return this.lowest ? Math.min(value, front) : Math.max(value, front);
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.bars++;
    const v = this.pending;
    if (!Number.isFinite(v)) return;
    const { qv, qi } = this;
    while (qv.length > this.head && Object.is(this.lowest ? Math.min(qv[qv.length - 1], v) : Math.max(qv[qv.length - 1], v), v)) {
      qv.pop();
      qi.pop();
    }
    qv.push(v);
    qi.push(this.count);
    this.count++;
    const lo = this.count - this.len;
    while (this.head < qi.length && qi[this.head] < lo) this.head++;
    if (this.head > 1024 && this.head * 2 > qi.length) {
      this.qv = qv.slice(this.head);
      this.qi = qi.slice(this.head);
      this.head = 0;
    }
  }
}

/** One moving average call: step(close, volume) */
interface MaStep { step(v: number, volume: number): number; commit(): void }

/** The machines of one MA length: the MA (of the plot and of getTrend: the same values), its linreg, highest, lowest */
interface MaLine {
  len: number;
  ma: MaStep;
  linreg: LinregStep | null;
  hh: WindowExtreme;
  ll: WindowExtreme;
  plot: Point[];
}

interface TfmaRun extends BarRunState<Record<string, never>> {
  highest280: WindowExtreme;
  lowest280: WindowExtreme;
  lines: MaLine[];
}

function study(inputs: Partial<TrendFollowingMAInputs>): BarStudy<TfmaRun, IndicatorResult> {
  const { maType, period: prd, channelRate, useLinReg, linRegPeriod: linprd } = { ...defaultInputs, ...inputs };
  const rate = channelRate / 100;

  function computeMA(len: number): MaStep {
    switch (maType) {
      case 'EMA': { const m = taStep.ema(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'RMA': { const m = taStep.rma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
      case 'VWMA': { const m = taStep.vwma(len); return { step: (v, vol) => m.step(v, vol), commit: () => m.commit() }; }
      default: { const m = taStep.sma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
    }
  }

  return {
    init() {
      const highest280 = new WindowExtreme(280, false);
      const lowest280 = new WindowExtreme(280, true);
      const lines: MaLine[] = maLengths.map((len) => ({
        len, ma: computeMA(len), linreg: useLinReg ? new LinregStep(Math.floor(linprd)) : null,
        hh: new WindowExtreme(Math.trunc(prd), false), ll: new WindowExtreme(Math.trunc(prd), true), plot: [],
      }));
      const steps: { commit(): void }[] = [highest280, lowest280];
      for (const l of lines) steps.push(l.ma, ...(l.linreg ? [l.linreg] : []), l.hh, l.ll);
      return { highest280, lowest280, lines, steps, vars: {}, lists: [], series: lines.map((l) => l.plot) };
    },
    bar(s, i, bars) {
      const b = bars[i];
      const close = b.close;
      const volume = b.volume ?? 0;
      // Pine: highest(280) defaults to high series, lowest(280) defaults to low series
      const highest280 = s.highest280.step(b.high);
      const lowest280 = s.lowest280.step(b.low);
      const pricerange = (highest280 ?? 0) - (lowest280 ?? 0);
      const chan = pricerange * rate;
      for (const l of s.lines) {
        const maV = l.ma.step(close, volume);
        // getTrend(len): computeMA(len) again (the same values)
        const masrc = maV;
        const ma = l.linreg ? l.linreg.step(masrc) : masrc;
        const hh = l.hh.step(ma) ?? 0;
        const ll = l.ll.step(ma) ?? 0;
        const diff = Math.abs(hh - ll);
        const maVal = ma ?? 0;
        let trend = 0;
        if (diff > chan) {
          if (maVal > ll + chan) trend = 1;
          else if (maVal < hh - chan) trend = -1;
        }
        const trendV = chan !== 0 ? trend * diff / chan : 0;

        const warmup = Math.max(l.len, prd, 280);
        if (i < warmup || maV == null || isNaN(maV)) {
          l.plot[i] = { time: b.time, value: NaN };
          continue;
        }
        const color = getColor(trendV);
        if (color === undefined) {
          // na color means don't plot this bar (transparent)
          l.plot[i] = { time: b.time, value: NaN };
          continue;
        }
        l.plot[i] = { time: b.time, value: maV, color };
      }
    },
    result(s) {
      const plots: Record<string, Point[]> = {};
      for (const l of s.lines) plots[`ma${l.len}`] = l.plot.slice();
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TrendFollowingMAInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TrendFollowingMAInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const TrendFollowingMA = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
