/**
 * Interpolated Median Volatility LSMA | Otto
 *
 * The middle line is the rolling median (linear-interpolated 50th percentile over the percentile length) of the
 * LSMA (linear regression) of the source; the band half width is the rolling median of the standard deviation of
 * the source times the multiplier. The trend turns up when the close is above the upper band (and not below the
 * lower band) and down when the close is below the lower band. Lines, band fills, candles and bar colours are green
 * in an up trend and purple in a down trend (no colour before the first signal).
 * Alerts (alertcondition, `alerts` of the result): 'IMVL long' when the trend signal crosses over 0, 'IMVL short' when
 * it crosses under 0.
 *
 * Reference: "Interpolated Median Volatility LSMA | Oquant" by oquant
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © otto0
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type FillConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData, PlotCandleData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import {
  barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowStdev,
  type BarRunState, type BarStudy, type Committable, type IndicatorRun,
} from '../live-run';

export interface InterpolatedMedianVolatilityLSMAOttoInputs {
  /** Source */
  src: SourceType;
  /** LSMA length */
  lsmalen: number;
  /** Standard deviation length */
  sdlen: number;
  /** Length of the rolling medians */
  prclen: number;
  /** Band multiplier */
  mult: number;
}

export const defaultInputs: InterpolatedMedianVolatilityLSMAOttoInputs = {
  src: 'close',
  lsmalen: 30,
  sdlen: 20,
  prclen: 30,
  mult: 1.4,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'source', defval: 'close' },
  { id: 'lsmalen', type: 'int', title: 'lsma length', defval: 30 },
  { id: 'sdlen', type: 'int', title: 'sd length', defval: 20 },
  { id: 'prclen', type: 'int', title: 'percentile length', defval: 30 },
  { id: 'mult', type: 'float', title: 'multiplier', defval: 1.4, step: 0.1 },
];

const UP = color.green;
const DOWN = color.purple;

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'plot lsma', color: UP, lineWidth: 2 },
  { id: 'plot1', title: 'plot upperband', color: UP, lineWidth: 1 },
  { id: 'plot2', title: 'plot lowerband', color: UP, lineWidth: 1 },
];

/** fill(upperbandplot, lsmaplot) / fill(lowerbandplot, lsmaplot): color.new(colors, 75), per bar in the result */
export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot1', plot2: 'plot0', color: String(color.new(UP, 75)) },
  { id: 'fill1', plot1: 'plot2', plot2: 'plot0', color: String(color.new(UP, 75)) },
];

export const metadata = {
  title: 'Interpolated Median Volatility LSMA | Oquant',
  shortTitle: 'Interpolated Median Volatility LSMA | Oquant',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/**
 * `ta.percentile_linear_interpolation(source, length, percentage)` one bar at a time, with the sorted window of the
 * library function: the new value inserted before the first value `>=` it (an na goes last), then the value of the
 * bar leaving the window removed; na for the first `length - 1` bars (the same doubles). The step reads the window
 * of the bar without changing it; the commit inserts and removes.
 */
class PercentileLinearStep implements Committable {
  private readonly values: number[] = [];
  private readonly ids: number[] = [];
  private bars = 0;
  private stepped = false;
  private pending = NaN;
  /** Insertion place of the pending value, place of the leaving value in the kept window (-1: none) */
  private at = 0;
  private leaving = -1;

  constructor(private readonly length: number, private readonly percentage: number) {}

  /** Value `p` of the window after the insertion and the removal */
  private get(p: number): number {
    const k = this.at;
    const r = this.leaving < 0 ? -1 : this.leaving < k ? this.leaving : this.leaving + 1;
    const q = r >= 0 && p >= r ? p + 1 : p;
    return q < k ? this.values[q]! : q === k ? this.pending : this.values[q - 1]!;
  }

  step(v: number): number {
    this.stepped = true;
    this.pending = v;
    const i = this.bars;
    const length = this.length;
    const values = this.values;
    let k = 0;
    while (k < values.length && !(values[k]! >= v)) k++;
    this.at = k;
    this.leaving = i >= length ? this.ids.indexOf(i - length) : -1;
    if (i < length - 1) return NaN;
    const pos = (this.percentage / 100) * length - 0.5;
    if (pos <= 0) return this.get(0);
    if (pos >= length - 1) return this.get(length - 1);
    const lo = Math.floor(pos);
    const a = this.get(lo);
    return a + (pos - lo) * (this.get(lo + 1) - a);
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    const i = this.bars++;
    this.values.splice(this.at, 0, this.pending);
    this.ids.splice(this.at, 0, i);
    if (i >= this.length) {
      const old = this.ids.indexOf(i - this.length);
      this.values.splice(old, 1);
      this.ids.splice(old, 1);
    }
  }
}

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { barColors: BarColorData[]; plotCandles: Record<string, PlotCandleData[]> } & { alerts: AlertConditionState[] };

interface ImvlVars {
  signal: number; // var signal = 0
}

interface ImvlRun extends BarRunState<ImvlVars> {
  linreg: ReturnType<typeof taStep.linreg>;
  stdev: WindowStdev;
  lsmaMedian: PercentileLinearStep;
  sdMedian: PercentileLinearStep;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  fillColors: string[];
  candles: PlotCandleData[];
  barColors: BarColorData[];
  signals: number[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<InterpolatedMedianVolatilityLSMAOttoInputs>): BarStudy<ImvlRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: ImvlRun = {
        linreg: taStep.linreg(cfg.lsmalen, 0),
        stdev: new WindowStdev(cfg.sdlen),
        lsmaMedian: new PercentileLinearStep(cfg.prclen, 50),
        sdMedian: new PercentileLinearStep(cfg.prclen, 50),
        plot0: [], plot1: [], plot2: [], fillColors: [], candles: [], barColors: [], signals: [],
        flags: [[], []], times: [[], []],
        steps: [],
        vars: { signal: 0 },
        lists: [], series: [],
      };
      s.steps = [s.linreg, s.stdev, s.lsmaMedian, s.sdMedian];
      s.lists = [s.barColors, ...s.times];
      s.series = [s.plot0, s.plot1, s.plot2, s.fillColors, s.candles, s.signals, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const x = value(b);
      const lsmaraw = s.linreg.step(x);
      const sdraw = s.stdev.step(x);
      const lsma = s.lsmaMedian.step(lsmaraw);
      const sd = s.sdMedian.step(sdraw);
      const upper = lsma + sd * cfg.mult;
      const lower = lsma - sd * cfg.mult;
      const long = gt(b.close, upper);
      const short = lt(b.close, lower);
      if (long && !short) s.vars.signal = 1;
      if (short) s.vars.signal = -1;
      const signal = s.vars.signal;
      s.signals[i] = signal;
      // colors = signal == 1 ? green : signal == -1 ? purple : na
      const c = signal === 1 ? UP : signal === -1 ? DOWN : null;
      const t = b.time;
      const plotColor = c ?? 'transparent';
      // color.new(na, 75) is black with transparency 75
      s.fillColors[i] = String(color.new(c ?? '#000000', 75));
      s.candles[i] = {
        time: b.time, open: b.open, high: b.high, low: b.low, close: b.close,
        color: plotColor, borderColor: plotColor, wickColor: plotColor,
      };
      if (c !== null) s.barColors.push({ time: t, color: c });
      s.plot0[i] = { time: t, value: lsma, color: plotColor };
      s.plot1[i] = { time: t, value: upper, color: plotColor };
      s.plot2[i] = { time: t, value: lower, color: plotColor };
      // alertcondition(ta.crossover(signal, 0), "IMVL long", ...) / alertcondition(ta.crossunder(signal, 0), "IMVL short", ...)
      const prev = i > 0 ? s.signals[i - 1]! : NaN;
      const over = signal > 0 && prev <= 0;
      const under = signal < 0 && prev >= 0;
      s.flags[0]![i] = over;
      s.flags[1]![i] = under;
      if (over) s.times[0]!.push(t as number);
      if (under) s.times[1]!.push(t as number);
    },
    result(s, bars) {
      const n = bars.length;
      const fillColors = s.fillColors.slice();
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        fills: [
          { plot1: 'plot1', plot2: 'plot0', colors: fillColors },
          { plot1: 'plot2', plot2: 'plot0', colors: fillColors },
        ],
        // plotcandle(open, high, low, close, "bar color", colors, colors, colors, force_overlay = true)
        plotCandles: { barColorCandles: s.candles.slice() },
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<InterpolatedMedianVolatilityLSMAOttoInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<InterpolatedMedianVolatilityLSMAOttoInputs> = {},
): IndicatorResult & { barColors: BarColorData[]; plotCandles: Record<string, PlotCandleData[]> } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'IMVL long', message: 'IMVL long {{exchange}}:{{ticker}}' },
  { id: 'alert1', title: 'IMVL short', message: 'IMVL short {{exchange}}:{{ticker}}' },
];

export const InterpolatedMedianVolatilityLSMAOtto = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  fillConfig,
  alertConditions,
};
