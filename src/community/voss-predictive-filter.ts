/**
 * Voss Predictive Filter
 *
 * Ehlers' Voss predictor. A two-pole bandpass filter (center period `period`, relative bandwidth `bandwidth`) runs on
 * the 2-bar momentum of the source. The Voss output is a negative group delay stage on the bandpass output:
 * voss = (3 + order) / 2 * filt - weighted sum of the past voss values, order = 3 * predictMultiplier (kept with a
 * running sum and a ring buffer of `order` values). Optional threshold bands +/- k * MAD (0.6745 * stdev), +/- k * stdev
 * or the percentile (nearest rank) of |voss| over `thresholdPeriod` bars.
 *
 * Alerts (alertcondition, `alerts` of the result): Voss crossing over the + threshold and under the - threshold (with
 * the threshold shown), and crossing over / under zero.
 *
 * Reference: "Voss Predictive Filter" by e2e4
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowStdev, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export type VossThresholdMode = 'MAD' | 'Standard Deviation' | 'Percentile Rank';

export interface VossPredictiveFilterInputs {
  /** Price series to filter */
  source: SourceType;
  /** Bandpass center period */
  period: number;
  /** Prediction multiplier: NGD order = 3 * multiplier */
  predictMultiplier: number;
  /** Relative bandwidth of the bandpass filter */
  bandwidth: number;
  showVoss: boolean;
  colorVoss: string;
  showFilter: boolean;
  colorFilter: string;
  showZeroLine: boolean;
  colorZeroLine: string;
  showThreshold: boolean;
  colorThresholdTop: string;
  colorThresholdBottom: string;
  thresholdMode: VossThresholdMode;
  thresholdPeriod: number;
  /** Multiplier k of the MAD / Standard Deviation modes */
  thresholdMultiplier: number;
  /** Percentile of |voss| (Percentile Rank mode) */
  thresholdPercentile: number;
}

export const defaultInputs: VossPredictiveFilterInputs = {
  source: 'close',
  period: 20,
  predictMultiplier: 3,
  bandwidth: 0.25,
  showVoss: true,
  colorVoss: '#3A6DFF',
  showFilter: true,
  colorFilter: '#FF5933',
  showZeroLine: true,
  colorZeroLine: '#4DB8FF',
  showThreshold: true,
  colorThresholdTop: '#FFB340',
  colorThresholdBottom: '#A6FF4D',
  thresholdMode: 'MAD',
  thresholdPeriod: 50,
  thresholdMultiplier: 1.5,
  thresholdPercentile: 90.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'period', type: 'int', title: 'Bandpass Period', defval: 20, min: 1, max: 100, step: 1 },
  { id: 'predictMultiplier', type: 'int', title: 'Prediction Multiplier', defval: 3, min: 2, max: 10, step: 1 },
  { id: 'bandwidth', type: 'float', title: 'Bandwidth', defval: 0.25, min: 0.01, max: 0.45, step: 0.01 },
  { id: 'showVoss', type: 'bool', title: 'Voss Output', defval: true },
  { id: 'colorVoss', type: 'color', title: 'Voss Output Color', defval: '#3A6DFF' },
  { id: 'showFilter', type: 'bool', title: 'Bandpass Filter', defval: true },
  { id: 'colorFilter', type: 'color', title: 'Bandpass Filter Color', defval: '#FF5933' },
  { id: 'showZeroLine', type: 'bool', title: 'Zero Line', defval: true },
  { id: 'colorZeroLine', type: 'color', title: 'Zero Line Color', defval: '#4DB8FF' },
  { id: 'showThreshold', type: 'bool', title: 'Dynamic Threshold', defval: true },
  { id: 'colorThresholdTop', type: 'color', title: 'Threshold + Color', defval: '#FFB340' },
  { id: 'colorThresholdBottom', type: 'color', title: 'Threshold - Color', defval: '#A6FF4D' },
  { id: 'thresholdMode', type: 'string', title: 'Threshold mode', defval: 'MAD', options: ['MAD', 'Standard Deviation', 'Percentile Rank'] },
  { id: 'thresholdPeriod', type: 'int', title: 'Period', defval: 50, min: 2, max: 200, step: 1 },
  { id: 'thresholdMultiplier', type: 'float', title: 'Multiplier (k)', defval: 1.5, min: 0.0, max: 5.0, step: 0.1 },
  { id: 'thresholdPercentile', type: 'float', title: 'Percentile (%)', defval: 90.0, min: 0.0, max: 100.0, step: 0.5 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Voss', color: '#3A6DFF', lineWidth: 2 },
  { id: 'plot1', title: 'Filter', color: '#FF5933', lineWidth: 1 },
  { id: 'plot2', title: 'Threshold +', color: '#FFB340', lineWidth: 1 },
  { id: 'plot3', title: 'Threshold -', color: '#A6FF4D', lineWidth: 1 },
];

export const metadata = {
  title: 'Voss Predictive Filter',
  shortTitle: 'VPF',
  overlay: false,
};

const MAD_SCALE = 0.6745;

/**
 * `ta.percentile_nearest_rank(source, length, percentage)` one bar at a time: the sorted window of the oakscriptjs
 * array function (na values kept where its insertion puts them, the value of `length` bars back removed by bar), the
 * same doubles. A step reads the window the bar's value would give without changing it; commit changes it.
 */
class PercentileNearestRankStep implements Committable {
  private values: number[] = [];
  private bars: number[] = [];
  private count = 0;
  private pending = NaN;
  private stepped = false;
  private readonly len: number;
  private readonly rank: number;

  constructor(length: number, percentage: number) {
    this.len = length;
    this.rank = Math.min(length, Math.max(1, Math.ceil((percentage / 100) * length)));
  }

  /** Position of `v` in the sorted window (after the values it is not greater than or equal to) */
  private insertAt(v: number): number {
    const values = this.values;
    let k = 0;
    while (k < values.length && !(values[k]! >= v)) k++;
    return k;
  }

  step(v: number): number {
    this.stepped = true;
    this.pending = v;
    const i = this.count;
    if (i < this.len - 1) return NaN;
    const k = this.insertAt(v);
    // the window with v inserted at k, without the value of bar i - length (at `old` once v is inserted)
    let old = -1;
    if (i >= this.len) {
      const at = this.bars.indexOf(i - this.len);
      old = at < k ? at : at + 1;
    }
    const r = this.rank - 1;
    const idx = old >= 0 && r >= old ? r + 1 : r;
    return idx === k ? v : idx < k ? this.values[idx]! : this.values[idx - 1]!;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    const i = this.count++;
    const v = this.pending;
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

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { alerts: AlertConditionState[] };

interface VossVars {
  /** NGD state: ring buffer (changed in place), ring index, rolling and residual sums */
  buffer: number[];
  ringIndex: number;
  rollingSum: number;
  residualSum: number;
  /** voss[1], thresholdVal[1] of the crosses */
  prevVoss: number;
  prevThreshold: number;
}

interface VossRun extends BarRunState<VossVars> {
  src: number[];
  filt: number[];
  dev: WindowStdev | null;
  rank: PercentileNearestRankStep | null;
  plots: Point[][];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<VossPredictiveFilterInputs>): BarStudy<VossRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const source = barSource(cfg.source);
  const nz = (v: number) => (isNaN(v) ? 0 : v);

  // Filter parameters (var: computed on the first bar)
  const order = 3 * cfg.predictMultiplier;
  const scale = (3 + order) / 2.0;
  const angularFreq = (2.0 * Math.PI) / cfg.period;
  const freqCos = Math.cos(angularFreq);
  const invBCos = 1.0 / Math.cos(angularFreq * cfg.bandwidth);
  const damping = invBCos - Math.sqrt(invBCos * invBCos - 1.0);
  const isPR = cfg.thresholdMode !== 'MAD' && cfg.thresholdMode !== 'Standard Deviation';
  return {
    fullRunReason: () => (isBarSource(cfg.source) ? null : 'source of another study'),
    init() {
      // Threshold (computed on every bar when showThreshold is on)
      const dev = cfg.showThreshold && !isPR ? new WindowStdev(cfg.thresholdPeriod) : null;
      const rank = cfg.showThreshold && isPR ? new PercentileNearestRankStep(cfg.thresholdPeriod, cfg.thresholdPercentile) : null;
      const s: VossRun = {
        src: [], filt: [], dev, rank, plots: [[], [], [], []], flags: [[], [], [], []], times: [[], [], [], []],
        steps: [...(dev ? [dev] : []), ...(rank ? [rank] : [])],
        vars: {
          buffer: new Array(order).fill(0.0), ringIndex: 0, rollingSum: 0.0, residualSum: 0.0,
          prevVoss: NaN, prevThreshold: NaN,
        },
        lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [s.src, s.filt, ...s.plots, ...s.flags];
      return s;
    },
    copyVars: (v) => ({ ...v, buffer: v.buffer.slice() }),
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const time = b.time;
      const src = source(b);
      s.src[i] = src;
      // sourceDelta = nz(source) - nz(source[2])
      const delta = nz(src) - nz(i >= 2 ? s.src[i - 2] : NaN);
      const f1 = i >= 1 ? nz(s.filt[i - 1]) : 0;
      const f2 = i >= 2 ? nz(s.filt[i - 2]) : 0;
      const filt = 0.5 * (1 - damping) * delta + freqCos * (1 + damping) * f1 - damping * f2;
      s.filt[i] = filt;
      const voss = scale * filt - v.residualSum;
      v.residualSum += voss - v.rollingSum / order;
      v.rollingSum += voss - v.buffer[v.ringIndex];
      v.buffer[v.ringIndex] = voss;
      v.ringIndex = (v.ringIndex + 1) % order;

      let threshold = NaN;
      if (cfg.showThreshold) {
        if (cfg.thresholdMode === 'MAD') threshold = cfg.thresholdMultiplier * (MAD_SCALE * s.dev!.step(voss));
        else if (cfg.thresholdMode === 'Standard Deviation') threshold = cfg.thresholdMultiplier * s.dev!.step(voss);
        else threshold = s.rank!.step(Math.abs(voss));
      }

      s.plots[0][i] = { time, value: cfg.showVoss ? voss : NaN, color: cfg.colorVoss };
      s.plots[1][i] = { time, value: cfg.showFilter ? filt : NaN, color: cfg.colorFilter };
      s.plots[2][i] = { time, value: cfg.showThreshold ? threshold : NaN, color: cfg.colorThresholdTop };
      s.plots[3][i] = { time, value: cfg.showThreshold ? -threshold : NaN, color: cfg.colorThresholdBottom };

      // crossedAboveThreshold = showThreshold and ta.crossover(voss, thresholdVal) (na threshold when it is off)
      const pv = i > 0 ? v.prevVoss : NaN;
      const pt = i > 0 ? v.prevThreshold : NaN;
      const f = [
        cfg.showThreshold && voss > threshold && pv <= pt,
        cfg.showThreshold && voss < -threshold && pv >= -pt,
        voss > 0 && pv <= 0,
        voss < 0 && pv >= 0,
      ];
      v.prevVoss = voss;
      v.prevThreshold = threshold;
      for (let k = 0; k < 4; k++) {
        s.flags[k][i] = f[k];
        if (f[k]) s.times[k].push(time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      const [plot0, plot1, plot2, plot3] = s.plots.map((p) => p.slice());
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0, plot1, plot2, plot3 },
        // hline(showZeroLine ? 0 : na, 'Zero', colorZeroLine): Pine default hline style (dashed)
        hlines: cfg.showZeroLine
          ? [{ value: 0, options: { title: 'Zero', color: cfg.colorZeroLine, linestyle: 'dashed' } }]
          : [],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VossPredictiveFilterInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VossPredictiveFilterInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Voss Predictive Filter: Above +Threshold', message: 'VPF: voss crossed above +threshold' },
  { id: 'alert1', title: 'Voss Predictive Filter: Below -Threshold', message: 'VPF: voss crossed below -threshold' },
  { id: 'alert2', title: 'Voss Predictive Filter: Above Zero', message: 'VPF: voss crossed above zero' },
  { id: 'alert3', title: 'Voss Predictive Filter: Below Zero', message: 'VPF: voss crossed below zero' },
];

export const VossPredictiveFilter = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
