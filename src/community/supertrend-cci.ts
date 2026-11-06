/**
 * BEST Supertrend CCI
 *
 * Supertrend indicator that uses CCI as the direction filter instead of
 * the standard close-vs-supertrend comparison.
 *   Up   = hl2 - factor * ATR(pd)
 *   Down = hl2 + factor * ATR(pd)
 *   TrendUp ratchets up when CCI[1] > midLine, else resets.
 *   TrendDown ratchets down when CCI[1] < midLine, else resets.
 *   Trend = CCI > midLine ? 1 : CCI < midLine ? -1 : prev
 *   Line = Trend==1 ? TrendUp : TrendDown
 * Colored green when close >= line, red otherwise.
 *
 * Reference: "BEST Supertrend CCI" by Daveatt
 */

import { taCore, taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type Committable, type BarStudy, type IndicatorRun } from '../live-run';

export interface SupertrendCCIInputs {
  source: SourceType;
  cciPeriod: number;
  midLine: number;
  factor: number;
  pd: number;
}

export const defaultInputs: SupertrendCCIInputs = {
  source: 'close',
  cciPeriod: 28,
  midLine: 0,
  factor: 3,
  pd: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'cciPeriod', type: 'int', title: 'CCI Period', defval: 28, min: 1 },
  { id: 'midLine', type: 'int', title: 'CCI Mid Line Pivot', defval: 0 },
  { id: 'factor', type: 'float', title: '[ST] Factor', defval: 3, min: 1, max: 100, step: 0.1 },
  { id: 'pd', type: 'int', title: '[ST] PD (ATR Period)', defval: 3, min: 1, max: 100 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SuperTrend CCI', color: '#26A69A', lineWidth: 4 },
];

export const metadata = {
  title: 'BEST Supertrend CCI',
  shortTitle: 'ST-CCI',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };

/**
 * `ta.cci(source, length)` one bar at a time with a {@link WindowSma} mean (the doubles of taStep.cci, faster): the
 * mean of |source - sma| over the last `length` bars, (source - sma) / (0.015 * dev), a zero dev keeps the previous
 * value (0 at the start).
 */
class CciStep implements Committable {
  private readonly mean: WindowSma;
  private readonly len: number;
  private values: number[] = [];
  private last = 0;
  private next = 0;
  private pending = NaN;
  private stepped = false;

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
    const len = this.len;
    const n = this.values.length;
    if (n < len - 1 || Number.isNaN(mean)) return NaN;
    let sum = 0;
    for (let k = 0; k < len; k++) sum += Math.abs((k === 0 ? value : this.values[n - k]!) - mean);
    const d = sum / len;
    if (Number.isNaN(d)) return NaN;
    if (!(Math.abs(d) <= 1e-10)) this.next = (value - mean) / (0.015 * d);
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

interface StCciRun extends BarRunState<Record<string, never>> {
  cci: CciStep;
  atr: ReturnType<typeof taStep.atr>;
  cciArr: number[];
  trendUp: number[];
  trendDown: number[];
  trend: number[];
  plot0: Point[];
}

function study(inputs: Partial<SupertrendCCIInputs>): BarStudy<StCciRun, IndicatorResult> {
  const { source, cciPeriod, midLine, factor, pd } = { ...defaultInputs, ...inputs };
  const value = barSource(source);
  const warmup = Math.max(cciPeriod, pd);
  return {
    fullRunReason: () => (isBarSource(source) ? null : 'source of another study'),
    init() {
      const cci = new CciStep(cciPeriod);
      const atr = taStep.atr(pd);
      const s: StCciRun = {
        cci, atr, cciArr: [], trendUp: [], trendDown: [], trend: [], plot0: [],
        steps: [cci, atr], vars: {}, lists: [], series: [],
      };
      s.series = [s.cciArr, s.trendUp, s.trendDown, s.trend, s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // CCI
      const cciCur = s.cci.step(value(b));
      s.cciArr[i] = cciCur;
      // ATR
      const atrVal = s.atr.step(b.high, b.low, b.close);
      const { trendUp, trendDown, trend } = s;
      let tsl: number;
      if (isNaN(atrVal)) {
        trendUp[i] = NaN;
        trendDown[i] = NaN;
        trend[i] = i > 0 ? trend[i - 1] : 1;
        tsl = NaN;
      } else {
        // hl2
        const hl2 = (b.high + b.low) / 2;
        const up = hl2 - factor * atrVal;
        const dn = hl2 + factor * atrVal;

        // CCI[1] for ratchet logic
        const cciPrev = i > 0 ? s.cciArr[i - 1] : NaN;

        // TrendUp ratchets up when CCI[1] > midLine
        if (i === 0 || isNaN(trendUp[i - 1])) {
          trendUp[i] = up;
        } else {
          trendUp[i] = (!isNaN(cciPrev) && cciPrev > midLine)
            ? Math.max(up, trendUp[i - 1])
            : up;
        }

        // TrendDown ratchets down when CCI[1] < midLine
        if (i === 0 || isNaN(trendDown[i - 1])) {
          trendDown[i] = dn;
        } else {
          trendDown[i] = (!isNaN(cciPrev) && cciPrev < midLine)
            ? Math.min(dn, trendDown[i - 1])
            : dn;
        }

        // Trend direction from current CCI
        if (!isNaN(cciCur) && cciCur > midLine) {
          trend[i] = 1;
        } else if (!isNaN(cciCur) && cciCur < midLine) {
          trend[i] = -1;
        } else {
          trend[i] = i > 0 ? trend[i - 1] : 1;
        }

        tsl = trend[i] === 1 ? trendUp[i] : trendDown[i];
      }

      if (i < warmup || isNaN(tsl)) s.plot0[i] = { time: b.time, value: NaN };
      else s.plot0[i] = { time: b.time, value: tsl, color: b.close >= tsl ? '#26A69A' : '#EF5350' };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice() },
        hlines: [
          { value: midLine, options: { color: '#787B86', linestyle: 'solid' as const, title: 'CCI Mid Line' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SupertrendCCIInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SupertrendCCIInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const SupertrendCCI = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
