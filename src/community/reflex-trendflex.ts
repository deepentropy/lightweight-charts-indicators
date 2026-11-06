/**
 * Reflex & Trendflex
 *
 * Ehlers' Reflex (cycle component) and Trendflex (trend component) oscillators on the SuperSmoother (two-pole
 * Butterworth low-pass filter) of the source. Trendflex is the mean of (smoothed - smoothed[i]) for i = 1..period;
 * Reflex is the mean deviation of the past smoothed values from the line between smoothed[period] and smoothed.
 * Both are normalized by an exponentially weighted RMS (0.04 / 0.96). An optional dynamic threshold (+/-) on one
 * oscillator: multiplier * 0.6745 * stdev (MAD mode), multiplier * stdev, or the percentile (nearest rank) of the
 * absolute oscillator over the threshold period.
 * Alerts (alertcondition, `alerts` of the result): the threshold oscillator crosses over +threshold / under
 * -threshold (with the threshold shown), Reflex and Trendflex cross over / under zero.
 *
 * Reference: "Reflex & Trendflex" by e2e4
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: @author=@e2e4
 */

import { taCore, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowStdev, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export type ReflexTrendflexThresholdMode = 'MAD' | 'Standard Deviation' | 'Percentile Rank';

export interface ReflexTrendflexInputs {
  /** Price series to decompose into cycle and trend components */
  source: SourceType;
  /** SuperSmoother period of Reflex */
  reflexPeriod: number;
  /** SuperSmoother period of Trendflex */
  trendflexPeriod: number;
  showReflex: boolean;
  colorReflex: string;
  showTrendflex: boolean;
  colorTrendflex: string;
  showZeroLine: boolean;
  colorZeroLine: string;
  /** Dynamic threshold bands */
  showThreshold: boolean;
  colorThresholdTop: string;
  colorThresholdBottom: string;
  thresholdMode: ReflexTrendflexThresholdMode;
  /** Oscillator of the threshold */
  thresholdSource: 'Reflex' | 'Trendflex';
  thresholdPeriod: number;
  /** Scaling factor (k) of the MAD / Standard Deviation modes */
  thresholdMultiplier: number;
  /** Percentile (%) of the Percentile Rank mode */
  thresholdPercentile: number;
}

export const defaultInputs: ReflexTrendflexInputs = {
  source: 'close',
  reflexPeriod: 20,
  trendflexPeriod: 20,
  showReflex: true,
  colorReflex: '#4A90E2',
  showTrendflex: true,
  colorTrendflex: '#E24A4A',
  showZeroLine: true,
  colorZeroLine: '#4DB8FF',
  showThreshold: true,
  colorThresholdTop: '#FFB340',
  colorThresholdBottom: '#A6FF4D',
  thresholdMode: 'MAD',
  thresholdSource: 'Reflex',
  thresholdPeriod: 50,
  thresholdMultiplier: 1.5,
  thresholdPercentile: 90.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'reflexPeriod', type: 'int', title: 'Reflex Period', defval: 20, min: 5, max: 50, step: 1 },
  { id: 'trendflexPeriod', type: 'int', title: 'Trendflex Period', defval: 20, min: 5, max: 50, step: 1 },
  { id: 'showReflex', type: 'bool', title: 'Reflex (Cycle Component)', defval: true },
  { id: 'colorReflex', type: 'color', title: 'Reflex Color', defval: '#4A90E2' },
  { id: 'showTrendflex', type: 'bool', title: 'Trendflex (Trend Component)', defval: true },
  { id: 'colorTrendflex', type: 'color', title: 'Trendflex Color', defval: '#E24A4A' },
  { id: 'showZeroLine', type: 'bool', title: 'Zero Line', defval: true },
  { id: 'colorZeroLine', type: 'color', title: 'Zero Line Color', defval: '#4DB8FF' },
  { id: 'showThreshold', type: 'bool', title: 'Dynamic Threshold', defval: true },
  { id: 'colorThresholdTop', type: 'color', title: 'Threshold + Color', defval: '#FFB340' },
  { id: 'colorThresholdBottom', type: 'color', title: 'Threshold - Color', defval: '#A6FF4D' },
  { id: 'thresholdMode', type: 'string', title: 'Threshold mode', defval: 'MAD', options: ['MAD', 'Standard Deviation', 'Percentile Rank'] },
  { id: 'thresholdSource', type: 'string', title: 'Apply to', defval: 'Reflex', options: ['Reflex', 'Trendflex'] },
  { id: 'thresholdPeriod', type: 'int', title: 'Period', defval: 50, min: 2, max: 200, step: 1 },
  { id: 'thresholdMultiplier', type: 'float', title: 'Multiplier (k)', defval: 1.5, min: 0.0, max: 5.0, step: 0.1 },
  { id: 'thresholdPercentile', type: 'float', title: 'Percentile (%)', defval: 90.0, min: 0.0, max: 100.0, step: 0.5 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Reflex', color: '#4A90E2', lineWidth: 2 },
  { id: 'plot1', title: 'Trendflex', color: '#E24A4A', lineWidth: 2 },
  { id: 'plot2', title: 'Threshold +', color: '#FFB340', lineWidth: 1 },
  { id: 'plot3', title: 'Threshold -', color: '#A6FF4D', lineWidth: 1 },
];

export const metadata = {
  title: 'Reflex & Trendflex',
  shortTitle: 'xFlex',
  overlay: false,
};

const SQRT2_PI = Math.sqrt(2.0) * Math.PI;
const MAD_SCALE = 0.6745;
const nz = (v: number) => (isNaN(v) ? 0 : v);
/** Pine x / y: na when y is 0 */
const div = (x: number, y: number) => (y === 0 ? NaN : x / y);

/**
 * `ta.percentile_nearest_rank(source, length, percentage)` one bar at a time: the sorted window of the oakscriptjs
 * array function (na values kept, inserted before the first value >= the new one; the value of `length` bars back
 * removed), read without changing it on a step and changed on the commit (the same doubles).
 */
class PercentileNearestRankStep implements Committable {
  private readonly values: number[] = [];
  private readonly bars: number[] = [];
  private readonly rank: number;
  private readonly len: number;
  private count = 0;
  private pending = NaN;
  private stepped = false;

  constructor(length: number, percentage: number) {
    // the library's runtime error for an invalid length
    if (Math.trunc(length) <= 0) taCore.percentile_nearest_rank([], length, percentage);
    this.len = length;
    this.rank = Math.min(length, Math.max(1, Math.ceil((percentage / 100) * length)));
  }

  /** Position of the new value `v` in the sorted window */
  private insertAt(v: number): number {
    let k = 0;
    while (k < this.values.length && !(this.values[k]! >= v)) k++;
    return k;
  }

  step(v: number): number {
    this.stepped = true;
    this.pending = v;
    const i = this.count;
    if (i < this.len - 1) return NaN;
    const k = this.insertAt(v);
    // the window with v inserted at k, then the value of bar i - length removed
    let removed = -1;
    if (i >= this.len) {
      // splice(indexOf(...), 1) on the window with v inserted (-1 when not found: the last value)
      const old = this.bars.indexOf(i - this.len);
      removed = old < 0 ? this.values.length : old < k ? old : old + 1;
    }
    let j = this.rank - 1;
    if (removed >= 0 && j >= removed) j++;
    return j < k ? this.values[j]! : j === k ? v : this.values[j - 1]!;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    const v = this.pending;
    const i = this.count++;
    const k = this.insertAt(v);
    this.values.splice(k, 0, v);
    this.bars.splice(k, 0, i);
    if (i >= this.len) {
      const old = this.bars.indexOf(i - this.len);
      this.values.splice(old, 1);
      this.bars.splice(old, 1);
    }
  }
}

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { alerts: AlertConditionState[] };

interface FlexVars {
  /** rms := 0.04 * v * v + 0.96 * nz(rms[1]) of each oscillator */
  reflexRms: number;
  trendRms: number;
  /** sumSmoothed of each oscillator (var, starts at 0) */
  reflexSum: number;
  trendSum: number;
}

interface FlexRun extends BarRunState<FlexVars> {
  dev: WindowStdev | null;
  pct: PercentileNearestRankStep | null;
  src: number[];
  reflexSm: number[];
  trendSm: number[];
  reflexArr: number[];
  trendArr: number[];
  thr: number[];
  plots: Point[][];
  flags: boolean[][];
  times: number[][];
}

/** Ehlers' SuperSmoother: two-pole Butterworth low-pass filter (nz() on the inputs and the past outputs) */
function smootherCoefs(period: number): [number, number, number] {
  const decay = Math.exp(-SQRT2_PI / (0.5 * period));
  const freq = Math.cos(SQRT2_PI / (0.5 * period));
  const f1 = 2.0 * decay * freq;
  const f2 = -decay * decay;
  const ci = (1.0 - f1 - f2) / 2.0;
  return [f1, f2, ci];
}

function study(inputs: Partial<ReflexTrendflexInputs>): BarStudy<FlexRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.source);
  const rp = cfg.reflexPeriod;
  const tp = cfg.trendflexPeriod;
  const [rf1, rf2, rci] = smootherCoefs(rp);
  const [tf1, tf2, tci] = smootherCoefs(tp);
  const sumIndices = (rp * (rp + 1)) / 2.0;
  /** SuperSmoother of bar i */
  const smooth = (src: number[], out: number[], i: number, f1: number, f2: number, ci: number): number => {
    const s1 = i > 0 ? src[i - 1]! : NaN;
    const o1 = i > 0 ? out[i - 1]! : NaN;
    const o2 = i > 1 ? out[i - 2]! : NaN;
    return ci * (nz(src[i]!) + nz(s1)) + f1 * nz(o1) + f2 * nz(o2);
  };
  return {
    fullRunReason: () => (isBarSource(cfg.source) ? null : 'source of another study'),
    init() {
      const dev = cfg.showThreshold && cfg.thresholdMode !== 'Percentile Rank' ? new WindowStdev(cfg.thresholdPeriod) : null;
      const pct = cfg.showThreshold && cfg.thresholdMode === 'Percentile Rank'
        ? new PercentileNearestRankStep(cfg.thresholdPeriod, cfg.thresholdPercentile) : null;
      const s: FlexRun = {
        dev, pct, src: [], reflexSm: [], trendSm: [], reflexArr: [], trendArr: [], thr: [],
        plots: [[], [], [], []], flags: [[], [], [], [], [], []], times: [[], [], [], [], [], []],
        steps: [...(dev ? [dev] : []), ...(pct ? [pct] : [])],
        vars: { reflexRms: NaN, trendRms: NaN, reflexSum: 0, trendSum: 0 }, lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [s.src, s.reflexSm, s.trendSm, s.reflexArr, s.trendArr, s.thr, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const v = s.vars;
      s.src[i] = value(b);

      let reflexValue = NaN;
      if (cfg.showReflex) {
        const sm = s.reflexSm;
        sm[i] = smooth(s.src, sm, i, rf1, rf2, rci);
        // sumSmoothed := sumSmoothed + nz(smoothed[1]) - nz(smoothed[period + 1])
        v.reflexSum = v.reflexSum + nz(i >= 1 ? sm[i - 1]! : NaN) - nz(i >= rp + 1 ? sm[i - rp - 1]! : NaN);
        const slope = i >= rp ? (sm[i - rp]! - sm[i]!) / rp : NaN;
        const avgDev = (rp * sm[i]! + slope * sumIndices - v.reflexSum) / rp;
        // RMS normalization: rms := 0.04 * v * v + 0.96 * nz(rms[1]); v / sqrt(rms)
        v.reflexRms = 0.04 * avgDev * avgDev + 0.96 * nz(v.reflexRms);
        reflexValue = div(avgDev, Math.sqrt(v.reflexRms));
      }
      let trendflexValue = NaN;
      if (cfg.showTrendflex) {
        const sm = s.trendSm;
        sm[i] = smooth(s.src, sm, i, tf1, tf2, tci);
        v.trendSum = v.trendSum + nz(i >= 1 ? sm[i - 1]! : NaN) - nz(i >= tp + 1 ? sm[i - tp - 1]! : NaN);
        const x = (tp * sm[i]! - v.trendSum) / tp;
        v.trendRms = 0.04 * x * x + 0.96 * nz(v.trendRms);
        trendflexValue = div(x, Math.sqrt(v.trendRms));
      }
      s.reflexArr[i] = reflexValue;
      s.trendArr[i] = trendflexValue;
      const osc = cfg.thresholdSource === 'Reflex' ? s.reflexArr : s.trendArr;

      let thresholdValue = NaN;
      if (s.dev) {
        // multiplier * MAD_SCALE * ta.stdev(source, period)
        const sd = s.dev.step(osc[i]!);
        thresholdValue = cfg.thresholdMode === 'MAD' ? cfg.thresholdMultiplier * (MAD_SCALE * sd) : cfg.thresholdMultiplier * sd;
      } else if (s.pct) {
        thresholdValue = s.pct.step(Math.abs(osc[i]!));
      }
      s.thr[i] = thresholdValue;

      s.plots[0]![i] = { time: t, value: reflexValue, color: cfg.colorReflex };
      s.plots[1]![i] = { time: t, value: trendflexValue, color: cfg.colorTrendflex };
      s.plots[2]![i] = { time: t, value: thresholdValue, color: cfg.colorThresholdTop };
      s.plots[3]![i] = { time: t, value: -thresholdValue, color: cfg.colorThresholdBottom };

      // crossedAboveThreshold = showThreshold and ta.crossover(thresholdOsc, thresholdValue)
      // crossedBelowThreshold = showThreshold and ta.crossunder(thresholdOsc, -thresholdValue)
      const p = i > 0;
      const o = osc[i]!, po = p ? osc[i - 1]! : NaN;
      const th = thresholdValue, pth = p ? s.thr[i - 1]! : NaN;
      const r = reflexValue, pr = p ? s.reflexArr[i - 1]! : NaN;
      const tf = trendflexValue, ptf = p ? s.trendArr[i - 1]! : NaN;
      const f = [
        cfg.showThreshold && o > th && po <= pth,
        cfg.showThreshold && o < -th && po >= -pth,
        r > 0 && pr <= 0, r < 0 && pr >= 0,
        tf > 0 && ptf <= 0, tf < 0 && ptf >= 0,
      ];
      for (let k = 0; k < 6; k++) {
        s.flags[k]![i] = f[k]!;
        if (f[k]) s.times[k]!.push(t as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0]!.slice(), plot1: s.plots[1]!.slice(), plot2: s.plots[2]!.slice(), plot3: s.plots[3]!.slice() },
        // hline(showZeroLine ? 0 : na, 'Zero', colorZeroLine, display = showZeroLine ? display.all : display.none)
        hlines: cfg.showZeroLine
          ? [{ value: 0, options: { title: 'Zero', color: cfg.colorZeroLine, linestyle: 'dashed', linewidth: 1 } }]
          : [],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ReflexTrendflexInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ReflexTrendflexInputs> = {}): IndicatorResult & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Reflex & Trendflex: Above +Threshold', message: 'xFlex: oscillator crossed above +threshold' },
  { id: 'alert1', title: 'Reflex & Trendflex: Below -Threshold', message: 'xFlex: oscillator crossed below -threshold' },
  { id: 'alert2', title: 'Reflex & Trendflex: Reflex Above Zero', message: 'xFlex: Reflex crossed above zero' },
  { id: 'alert3', title: 'Reflex & Trendflex: Reflex Below Zero', message: 'xFlex: Reflex crossed below zero' },
  { id: 'alert4', title: 'Reflex & Trendflex: Trendflex Above Zero', message: 'xFlex: Trendflex crossed above zero' },
  { id: 'alert5', title: 'Reflex & Trendflex: Trendflex Below Zero', message: 'xFlex: Trendflex crossed below zero' },
];

export const ReflexTrendflex = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
