/**
 * Composite Indicator (CCI + ATR)
 *
 * Buy when the CCI of hlc3 crosses over -threshold while the ATR is above its SMA times the buy multiplier; sell
 * when the CCI crosses under +threshold while the ATR is above its SMA times the sell multiplier. On a signal bar a
 * stop loss point is drawn: low - ATR * stop multiplier (buy) or high + ATR * stop multiplier (sell).
 *
 * Reference: "Composite Indicator (CCI + ATR)" by CharLi0t
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Charlie_Cai
 */

import { taStep, taCore, compare, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface CompositeIndicatorInputs {
  /** CCI length */
  cciLength: number;
  /** CCI threshold (buy: cross over -threshold, sell: cross under +threshold) */
  cciThreshold: number;
  /** ATR length (also the length of the ATR SMA) */
  atrLength: number;
  /** ATR multiplier of the buy filter */
  atrBuyMultiplier: number;
  /** ATR multiplier of the sell filter */
  atrSellMultiplier: number;
  /** ATR multiplier of the stop loss */
  atrMultiplier: number;
}

export const defaultInputs: CompositeIndicatorInputs = {
  cciLength: 20,
  cciThreshold: 100,
  atrLength: 14,
  atrBuyMultiplier: 1.0,
  atrSellMultiplier: 0.95,
  atrMultiplier: 1.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'cciLength', type: 'int', title: 'CCI Length', defval: 20 },
  { id: 'cciThreshold', type: 'int', title: 'CCI Threshold', defval: 100 },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14 },
  { id: 'atrBuyMultiplier', type: 'float', title: 'ATR Multiplier for Buy Signal', defval: 1.0 },
  { id: 'atrSellMultiplier', type: 'float', title: 'ATR Multiplier for Sell Signal', defval: 0.95 },
  { id: 'atrMultiplier', type: 'float', title: 'ATR Multiplier for Stop Loss', defval: 1.5 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Long Stop Loss', color: color.green, lineWidth: 1 },
  { id: 'plot1', title: 'Short Stop Loss', color: color.red, lineWidth: 1 },
];

export const metadata = {
  title: 'Composite Indicator (CCI + ATR)',
  shortTitle: 'Composite Indicator (CCI + ATR)',
  overlay: true,
};

/** Pine float comparison: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;

/**
 * `ta.cci(source, length)` one bar at a time with a {@link WindowSma} mean (the doubles of taStep.cci, which steps two
 * slower window sums): (source - sma) / (0.015 * dev); a zero dev keeps the previous value (0 at the start).
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

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface CompositeRun extends BarRunState<Record<string, never>> {
  cciStep: CciStep;
  atrStep: ReturnType<typeof taStep.atr>;
  atrSmaStep: WindowSma;
  cci: number[];
  markers: MarkerData[];
  longStop: Point[];
  shortStop: Point[];
}

function study(inputs: Partial<CompositeIndicatorInputs>): BarStudy<CompositeRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const lower = -cfg.cciThreshold;
  const upper = cfg.cciThreshold;
  return {
    init() {
      const cciStep = new CciStep(cfg.cciLength);
      const atrStep = taStep.atr(cfg.atrLength);
      const atrSmaStep = new WindowSma(cfg.atrLength);
      const s: CompositeRun = {
        cciStep, atrStep, atrSmaStep, cci: [], markers: [], longStop: [], shortStop: [],
        steps: [cciStep, atrStep, atrSmaStep], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.cci, s.longStop, s.shortStop];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // cciSource = (high + low + close) / 3
      const cci = s.cciStep.step((b.high + b.low + b.close) / 3);
      s.cci[i] = cci;
      const atr = s.atrStep.step(b.high, b.low, b.close);
      const atrSma = s.atrSmaStep.step(atr);
      // ta.crossover / ta.crossunder compare exactly (na compares false)
      const crossUp = i > 0 && cci > lower && s.cci[i - 1] <= lower;
      const crossDown = i > 0 && cci < upper && s.cci[i - 1] >= upper;
      const buySignal = crossUp && gt(atr, cfg.atrBuyMultiplier * atrSma);
      const sellSignal = crossDown && gt(atr, cfg.atrSellMultiplier * atrSma);
      if (buySignal) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'B',
          textColor: color.white });
      }
      if (sellSignal) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'S',
          textColor: color.white });
      }
      // plot(buySignal ? low - atr * atr_multiplier : na), plot(sellSignal ? high + atr * atr_multiplier : na)
      s.longStop[i] = { time: b.time, value: buySignal ? b.low - atr * cfg.atrMultiplier : NaN };
      s.shortStop[i] = { time: b.time, value: sellSignal ? b.high + atr * cfg.atrMultiplier : NaN };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.longStop.slice(), plot1: s.shortStop.slice() },
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CompositeIndicatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<CompositeIndicatorInputs> = {},
): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const CompositeIndicator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
