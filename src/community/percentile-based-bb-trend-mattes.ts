/**
 * Percentile-Based BB% Trend - Mattes
 *
 * A %B oscillator on percentile bands: the basis is the mean of the 25th and 75th percentiles (linear
 * interpolation) of the source over `length` bars; the bands are basis +/- mult * MAD, with
 * MAD = median(|source - median(source, length)|, length). %B = (source - lower) / (upper - lower) is smoothed by an
 * EMA and drawn as columns: light blue when above 0 and rising, blue when above 0 and falling, purple when below 0
 * and falling, dark purple when below 0 and rising (the colour is kept when the value does not change). The price
 * candles are redrawn blue when the trend is above 0, purple otherwise.
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Trend Shift' / 'Bearish Trend Shift' when the trend
 * crosses over / under 0.
 *
 * Reference: "Percentile-Based BB% Trend - Mattes" by Mattes00
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import {
  barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type Committable, type IndicatorRun,
} from '../live-run';

export interface PercentileBasedBbTrendMattesInputs {
  /** Lookback length of the percentiles and medians */
  length: number;
  /** MAD multiplier */
  mult: number;
  source: SourceType;
  /** EMA smoothing length of the trend line */
  smoothLength: number;
}

export const defaultInputs: PercentileBasedBbTrendMattesInputs = {
  length: 36,
  mult: 0.15,
  source: 'close',
  smoothLength: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Lookback Length', defval: 36, min: 1 },
  { id: 'mult', type: 'float', title: 'MAD Multiplier', defval: 0.15, min: 0.05, step: 0.05 },
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'smoothLength', type: 'int', title: 'EMA Smoothing Length for Trend Line', defval: 9, min: 1 },
];

const BULL = String(color.rgb(45, 162, 252));
const BEAR = String(color.rgb(113, 59, 249));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'pb_trend', color: '#4caf50', lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'Percentile-Based BB% Trend - Mattes',
  shortTitle: 'PBB% Trend',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
/** Division: Pine x / 0 is +-Infinity, but pb_percent only feeds ta.ema, which skips an infinite value as na */
const div = (x: number, y: number) => (y === 0 ? NaN : x / y);

/**
 * The sorted window of `ta.percentile_linear_interpolation(source, length, percentage)` one bar at a time, with the
 * rules of the oakscriptjs function (same doubles): the new value goes before the first value >= it (na last), then
 * the value of the bar leaving the window is removed. A step reads the committed window without changing it;
 * `at(j)` is value j of the window of the stepped bar.
 */
class SortedWindow implements Committable {
  private readonly values: number[] = [];
  private readonly bars: number[] = [];
  private i = -1;
  private v = NaN;
  private k = 0;
  private removedW = -1;
  private stepped = false;

  constructor(private readonly length: number) {}

  step(i: number, v: number): void {
    const values = this.values;
    let k = 0;
    while (k < values.length && !(values[k]! >= v)) k++;
    this.i = i;
    this.v = v;
    this.k = k;
    const removed = i >= this.length ? this.bars.indexOf(i - this.length) : -1;
    this.removedW = removed < 0 ? -1 : removed < k ? removed : removed + 1;
    this.stepped = true;
  }

  at(j: number): number {
    const w = this.removedW >= 0 && j >= this.removedW ? j + 1 : j;
    return w < this.k ? this.values[w]! : w === this.k ? this.v : this.values[w - 1]!;
  }

  /** percentile_linear_interpolation of the window of the stepped bar (na for the first `length - 1` bars) */
  percentile(percentage: number): number {
    const length = this.length;
    if (this.i < length - 1) return NaN;
    const pos = (percentage / 100) * length - 0.5;
    if (pos <= 0) return this.at(0);
    if (pos >= length - 1) return this.at(length - 1);
    const lo = Math.floor(pos);
    return this.at(lo) + (pos - lo) * (this.at(lo + 1) - this.at(lo));
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.values.splice(this.k, 0, this.v);
    this.bars.splice(this.k, 0, this.i);
    if (this.i >= this.length) {
      const old = this.bars.indexOf(this.i - this.length);
      this.values.splice(old, 1);
      this.bars.splice(old, 1);
    }
  }
}

type Result = IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> } & { alerts: AlertConditionState[] };

interface PbbVars {
  /** var color col = #4caf50 */
  col: string;
}

interface PbbRun extends BarRunState<PbbVars> {
  window: SortedWindow;
  med: ReturnType<typeof taStep.median>;
  mad: ReturnType<typeof taStep.median>;
  ema: ReturnType<typeof taStep.ema>;
  pbTrend: number[];
  plot0: { time: number; value: number; color: string }[];
  candles: PlotCandleData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<PercentileBasedBbTrendMattesInputs>): BarStudy<PbbRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.source);
  return {
    fullRunReason: () => (isBarSource(cfg.source) ? null : 'source of another study'),
    init() {
      const s: PbbRun = {
        // p25 / p75: ta.percentile_linear_interpolation(source, length, 25 / 75), the same sorted window
        window: new SortedWindow(cfg.length),
        med: taStep.median(cfg.length),
        mad: taStep.median(cfg.length),
        ema: taStep.ema(cfg.smoothLength),
        pbTrend: [], plot0: [], candles: [], flags: [[], []], times: [[], []],
        steps: [], vars: { col: '#4caf50' }, lists: [], series: [],
      };
      s.steps = [s.window, s.med, s.mad, s.ema];
      s.lists = s.times;
      s.series = [s.pbTrend, s.plot0, s.candles, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const src = value(b);
      s.window.step(i, src);
      const p25 = s.window.percentile(25);
      const p75 = s.window.percentile(75);
      const med = s.med.step(src);
      // mad = ta.median(math.abs(source - ta.median(source, length)), length)
      const mad = s.mad.step(Math.abs(src - med));
      const basis = (p25 + p75) / 2;
      const dev = cfg.mult * mad;
      const upper = basis + dev;
      const lower = basis - dev;
      const pb = div(src - lower, upper - lower);
      const v = s.ema.step(pb);
      s.pbTrend[i] = v;

      const prev = i > 0 ? s.pbTrend[i - 1]! : NaN;
      const positiveChange = gt(v, prev);
      const negativeChange = lt(v, prev);
      let col = s.vars.col;
      if (gt(v, 0) && positiveChange) col = BULL;
      if (gt(v, 0) && negativeChange) col = '#1095fa';
      if (lt(v, 0) && negativeChange) col = BEAR;
      if (lt(v, 0) && positiveChange) col = '#5418eb';
      s.vars.col = col;
      s.plot0[i] = { time: b.time, value: v, color: col };
      // plotcandle(open, high, low, close, 'BarColor', syscol, syscol, syscol, force_overlay = true)
      const syscol = gt(v, 0) ? BULL : BEAR;
      s.candles[i] = { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close,
        color: syscol, wickColor: syscol, borderColor: syscol, forceOverlay: true };
      // alertcondition(ta.crossover(pb_trend, 0)) / alertcondition(ta.crossunder(pb_trend, 0))
      const up = v > 0 && prev <= 0;
      const down = v < 0 && prev >= 0;
      s.flags[0]![i] = up;
      s.flags[1]![i] = down;
      if (up) s.times[0]!.push(b.time as number);
      if (down) s.times[1]!.push(b.time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        hlines: [
          { value: 0, options: { title: 'Midline', color: String(color.new(color.white, 60)), linestyle: 'dotted' } },
        ],
        plotCandles: { BarColor: s.candles.slice() },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PercentileBasedBbTrendMattesInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PercentileBasedBbTrendMattesInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Trend Shift', message: 'PBB% Trend crossing above midline' },
  { id: 'alert1', title: 'Bearish Trend Shift', message: 'PBB% Trend crossing below midline' },
];

export const PercentileBasedBbTrendMattes = {
  alertConditions,
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
