/**
 * Adaptive Ehlers Filtered Percentile
 *
 * A volatility-adaptive EMA: its length goes from the maximum period (standard deviation of the price changes at or
 * below 0.25 x its average) to the minimum period (at or above 1.75 x its average). An Ehlers nonlinear filter
 * smooths it: the weighted mean of the last `ehlersLength` values, each weighted by its distance to the value
 * `ehlersMomentum` bars before (SMA when all weights are 0). The bands are the filter +/- the percentile (nearest
 * rank) of the distance between the source and the filter, times a multiplier. A close above the upper band starts a
 * bullish regime, a close below the lower band a bearish regime; LONG / SHORT signals mark the regime changes, and the
 * filter, the fill and the bars take the regime colour.
 * Alerts (alertcondition, `alerts` of the result): 'Long Signal' and 'Short Signal', on the bars of the signals.
 *
 * Reference: "Adaptive Ehlers Filtered Percentile" by SchizoQuant
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © SchizoQuant
 */

import { ta, taStep, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AdaptiveEhlersFilteredPercentileInputs {
  /** Source of the adaptive MA */
  maSrc: SourceType;
  /** Minimum MA period (high volatility) */
  maMin: number;
  /** Maximum MA period (low volatility) */
  maMax: number;
  /** Volatility period */
  volLen: number;
  /** Ehlers filter length */
  ehlersLength: number;
  /** Ehlers momentum length */
  ehlersMomentum: number;
  /** Percentile length */
  percentileLen: number;
  /** Percentile level */
  percentileLevel: number;
  upperMult: number;
  lowerMult: number;
  showMA: boolean;
  showBands: boolean;
  showFill: boolean;
  showSignals: boolean;
  colorBars: boolean;
  longColor: string;
  shortColor: string;
}

export const defaultInputs: AdaptiveEhlersFilteredPercentileInputs = {
  maSrc: 'close',
  maMin: 3,
  maMax: 30,
  volLen: 9,
  ehlersLength: 9,
  ehlersMomentum: 15,
  percentileLen: 50,
  percentileLevel: 75.0,
  upperMult: 0.7,
  lowerMult: 0.7,
  showMA: true,
  showBands: true,
  showFill: true,
  showSignals: true,
  colorBars: true,
  longColor: 'rgb(57, 255, 20)',
  shortColor: 'rgb(138, 43, 226)',
};

export const inputConfig: InputConfig[] = [
  { id: 'maSrc', type: 'source', title: 'Source', defval: 'close' },
  { id: 'maMin', type: 'int', title: 'Minimum MA Period', defval: 3, min: 1 },
  { id: 'maMax', type: 'int', title: 'Maximum MA Period', defval: 30, min: 2 },
  { id: 'volLen', type: 'int', title: 'Volatility Period', defval: 9, min: 2 },
  { id: 'ehlersLength', type: 'int', title: 'Filter Length', defval: 9, min: 2 },
  { id: 'ehlersMomentum', type: 'int', title: 'Momentum Length', defval: 15, min: 1 },
  { id: 'percentileLen', type: 'int', title: 'Percentile Length', defval: 50, min: 2 },
  { id: 'percentileLevel', type: 'float', title: 'Percentile Level', defval: 75.0, min: 1.0, max: 99.0, step: 1.0 },
  { id: 'upperMult', type: 'float', title: 'Upper Band Multiplier', defval: 0.7, min: 0.1, step: 0.1 },
  { id: 'lowerMult', type: 'float', title: 'Lower Band Multiplier', defval: 0.7, min: 0.1, step: 0.1 },
  { id: 'showMA', type: 'bool', title: 'Show Adaptive Filter', defval: true },
  { id: 'showBands', type: 'bool', title: 'Show Percentile Bands', defval: true },
  { id: 'showFill', type: 'bool', title: 'Show Band Fill', defval: true },
  { id: 'showSignals', type: 'bool', title: 'Show Signals', defval: true },
  { id: 'colorBars', type: 'bool', title: 'Color Bars', defval: true },
  { id: 'longColor', type: 'color', title: 'Bullish Color', defval: 'rgb(57, 255, 20)' },
  { id: 'shortColor', type: 'color', title: 'Bearish Color', defval: 'rgb(138, 43, 226)' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Adaptive Ehlers Filter', color: 'rgb(138, 43, 226)', lineWidth: 2 },
  { id: 'plot1', title: 'Upper Percentile Band', color: String(color.new('rgb(57, 255, 20)', 35)), lineWidth: 1 },
  { id: 'plot2', title: 'Lower Percentile Band', color: String(color.new('rgb(138, 43, 226)', 35)), lineWidth: 1 },
];

export const metadata = {
  title: 'Adaptive Ehlers Filtered Percentile',
  shortTitle: 'Adaptive Ehlers Filtered Percentile',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] };

/**
 * `ta.percentile_nearest_rank(source, length, percentage)` one bar at a time, with the operations of the oakscriptjs
 * array function (a sorted window where a value goes before the first value >= it, the value of `length` bars back
 * removed): a new step on the same bar undoes the previous one first.
 */
class PercentileNearestRankStep {
  private readonly values: number[] = [];
  private readonly bars: number[] = [];
  private readonly rank: number;
  /** The uncommitted step: insert index, removed index (-1: none) and the removed value / bar */
  private applied = false;
  private inserted = 0;
  private removed = -1;
  private removedValue = NaN;
  private removedBar = 0;

  constructor(private readonly length: number, percentage: number) {
    checkPositiveLength(length);
    this.rank = Math.min(length, Math.max(1, Math.ceil((percentage / 100) * length)));
  }

  step(i: number, v: number): number {
    const { values, bars } = this;
    if (this.applied) {
      if (this.removed >= 0) {
        values.splice(this.removed, 0, this.removedValue);
        bars.splice(this.removed, 0, this.removedBar);
      }
      values.splice(this.inserted, 1);
      bars.splice(this.inserted, 1);
    }
    let k = 0;
    while (k < values.length && !(values[k]! >= v)) k++;
    values.splice(k, 0, v);
    bars.splice(k, 0, i);
    this.inserted = k;
    this.removed = -1;
    if (i >= this.length) {
      const old = bars.indexOf(i - this.length);
      this.removed = old;
      this.removedValue = values[old]!;
      this.removedBar = bars[old]!;
      values.splice(old, 1);
      bars.splice(old, 1);
    }
    this.applied = true;
    return i < this.length - 1 ? NaN : values[this.rank - 1]!;
  }

  commit(): void {
    this.applied = false;
  }
}

/** The length check of the oakscriptjs function (a length below 1 throws) */
function checkPositiveLength(length: number): void {
  if (!(length > 0)) ta.percentile_nearest_rank(Series.fromArray([], []), length, 50);
}

interface AefpRun extends BarRunState<{ SQ: number }> {
  dev: ReturnType<typeof taStep.stdev>;
  avg: ReturnType<typeof taStep.sma>;
  fallback: ReturnType<typeof taStep.sma>;
  pct: PercentileNearestRankStep;
  src: number[];
  adaptiveMA: number[];
  sq: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  fillColors: string[];
  markers: MarkerData[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<AdaptiveEhlersFilteredPercentileInputs>): BarStudy<AefpRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.maSrc);
  const upperCol = String(color.new(cfg.longColor, 35));
  const lowerCol = String(color.new(cfg.shortColor, 35));
  return {
    fullRunReason: () => (isBarSource(cfg.maSrc) ? null : 'source of another study'),
    init() {
      const dev = taStep.stdev();
      const avg = taStep.sma();
      const fallback = taStep.sma();
      const pct = new PercentileNearestRankStep(cfg.percentileLen, cfg.percentileLevel);
      const s: AefpRun = {
        dev, avg, fallback, pct, src: [], adaptiveMA: [], sq: [], plot0: [], plot1: [], plot2: [], fillColors: [],
        markers: [], barColors: [], flags: [[], []], times: [[], []],
        steps: [dev, avg, fallback, pct], vars: { SQ: 0 }, lists: [], series: [],
      };
      s.lists = [s.markers, s.barColors, ...s.times];
      s.series = [s.src, s.adaptiveMA, s.sq, s.plot0, s.plot1, s.plot2, s.fillColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const src = value(b);
      s.src[i] = src;

      // Volatility-adaptive length
      const deltaP = i > 0 ? src - s.src[i - 1] : NaN;
      const sd = s.dev.step(deltaP, cfg.volLen);
      const sAverage = s.avg.step(sd, cfg.volLen);
      const sMin = sAverage * 0.25;
      const sMax = sAverage * 1.75;
      const volRange = sMax - sMin;
      const adaptiveLength = gt(volRange, 0.0)
        ? (le(sd, sMin) ? cfg.maMax : ge(sd, sMax) ? cfg.maMin
          : cfg.maMax - ((cfg.maMax - cfg.maMin) * (sd - sMin)) / volRange)
        : cfg.maMax;
      const alpha = 2.0 / (adaptiveLength + 1.0);
      const prev = i > 0 ? s.adaptiveMA[i - 1] : NaN;
      // adaptiveMA := na(adaptiveMA[1]) ? maSrc : adaptiveMA[1] + alpha * (maSrc - adaptiveMA[1])
      const adaptiveMA = isNaN(prev) ? src : prev + alpha * (src - prev);
      s.adaptiveMA[i] = adaptiveMA;

      // Ehlers nonlinear filter
      const ehlersFallback = s.fallback.step(adaptiveMA, cfg.ehlersLength);
      const am = s.adaptiveMA;
      const at = (j: number) => (j >= 0 ? am[j] : NaN);
      let num = 0.0;
      let coefSum = 0.0;
      for (let k = 0; k <= cfg.ehlersLength - 1; k++) {
        const cur = at(i - k);
        const ref = at(i - k - cfg.ehlersMomentum);
        if (!isNaN(cur) && !isNaN(ref)) {
          const coefficient = Math.abs(cur - ref);
          num += coefficient * cur;
          coefSum += coefficient;
        }
      }
      const trendMA = gt(coefSum, 0.0) ? num / coefSum : ehlersFallback;

      // Percentile bands
      const deviation = Math.abs(src - trendMA);
      const percentileDistance = s.pct.step(i, deviation);
      const upperBand = trendMA + percentileDistance * cfg.upperMult;
      const lowerBand = trendMA - percentileDistance * cfg.lowerMult;

      // Regime (var int SQ = 0)
      if (gt(src, upperBand)) s.vars.SQ = 1;
      else if (lt(src, lowerBand)) s.vars.SQ = -1;
      const sq = s.vars.SQ;
      s.sq[i] = sq;
      const col = sq === 1 ? cfg.longColor : cfg.shortColor;

      s.plot0[i] = { time: t, value: cfg.showMA ? trendMA : NaN, color: col };
      s.plot1[i] = { time: t, value: cfg.showBands ? upperBand : NaN, color: upperCol };
      s.plot2[i] = { time: t, value: cfg.showBands ? lowerBand : NaN, color: lowerCol };
      // fill(upperPlot, lowerPlot, color = showFill ? color.new(col, 92) : na)
      s.fillColors[i] = cfg.showFill ? String(color.new(col, 92)) : 'transparent';

      // longSignal = SQ == 1 and SQ[1] != 1 (SQ[1] na on the first bar: != is false)
      const longSignal = sq === 1 && i > 0 && s.sq[i - 1] !== 1;
      const shortSignal = sq === -1 && i > 0 && s.sq[i - 1] !== -1;
      s.flags[0][i] = longSignal;
      s.flags[1][i] = shortSignal;
      if (longSignal) s.times[0].push(t as number);
      if (shortSignal) s.times[1].push(t as number);
      if (cfg.showSignals && longSignal) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: cfg.longColor, size: 'small',
          text: 'LONG', textColor: color.white });
      }
      if (cfg.showSignals && shortSignal) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: cfg.shortColor, size: 'small',
          text: 'SHORT', textColor: color.white });
      }
      if (cfg.colorBars) s.barColors.push({ time: t, color: col });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        fills: [{
          plot1: 'plot1', plot2: 'plot2', options: { title: 'Percentile Band Fill' }, colors: s.fillColors.slice(),
        }],
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        // alertcondition(longSignal, ...) / alertcondition(shortSignal, ...)
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AdaptiveEhlersFilteredPercentileInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AdaptiveEhlersFilteredPercentileInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}
/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Long Signal', message: 'Adaptive Ehlers Filtered Percentile Long Signal on {{ticker}}' },
  { id: 'alert1', title: 'Short Signal', message: 'Adaptive Ehlers Filtered Percentile Short Signal on {{ticker}}' },
];

export const AdaptiveEhlersFilteredPercentile = {
  calculate,
  createRun,

  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
