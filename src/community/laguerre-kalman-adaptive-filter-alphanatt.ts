/**
 * Laguerre-Kalman Adaptive Filter
 *
 * A 4-element Laguerre filter of the close (gamma) is smoothed by a one-dimensional Kalman-like estimate (process and
 * measurement noise from `Kalman Noise Reduction`). A second Laguerre filter uses an adaptive gamma:
 * gamma * (1 + 10 * stdev(close, adaptivePeriod) / close), clamped to 0.1..0.99. The line is the EMA(3) of the mean
 * of the Kalman estimate and the adaptive filter. It is cyan when it rises by more than the threshold and the close
 * is above it on this bar and the bar before, else magenta.
 * Alerts (alertcondition, `alerts` of the result): the close crossing over / under the line.
 *
 * Reference: "Laguerre-Kalman Adaptive Filter | AlphaNatt" by AlphaNatt
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface LaguerreKalmanAdaptiveFilterAlphanattInputs {
  /** Laguerre gamma */
  gamma: number;
  /** Stdev length of the volatility that adapts the gamma */
  adaptivePeriod: number;
  /** Kalman noise level */
  noiseLevel: number;
  /** Minimum rise of the line for an up trend */
  threshold: number;
}

export const defaultInputs: LaguerreKalmanAdaptiveFilterAlphanattInputs = {
  gamma: 0.5,
  adaptivePeriod: 20,
  noiseLevel: 0.5,
  threshold: 0.001,
};

export const inputConfig: InputConfig[] = [
  { id: 'gamma', type: 'float', title: 'Laguerre Gamma', defval: 0.5, min: 0.1, max: 0.99, step: 0.01 },
  { id: 'adaptivePeriod', type: 'int', title: 'Adaptive Period', defval: 20, min: 5, max: 100 },
  { id: 'noiseLevel', type: 'float', title: 'Kalman Noise Reduction', defval: 0.5, min: 0.1, max: 2.0, step: 0.1 },
  { id: 'threshold', type: 'float', title: 'Trend Threshold', defval: 0.001, min: 0.0001, max: 0.01, step: 0.0001 },
];

const UP_COL = '#00F1FF';
const DOWN_COL = '#FF019A';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Laguerre-Kalman Filter', color: DOWN_COL, lineWidth: 2 },
];

export const metadata = {
  title: 'Laguerre-Kalman Adaptive Filter | AlphaNatt',
  shortTitle: 'LKAF AlphaNatt',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;
const nz = (v: number) => (isNaN(v) ? 0 : v);

type Result = IndicatorResult & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color: string };

interface LkafVars {
  /** Laguerre elements of the previous bar (series history, read with nz()) */
  l0: number; l1: number; l2: number; l3: number;
  a0: number; a1: number; a2: number; a3: number;
  /** var float estimate = na */
  estimate: number;
  /** var float errorCovariance = 1.0 */
  errorCovariance: number;
}

interface LkafRun extends BarRunState<LkafVars> {
  dev: WindowStdev;
  ema: ReturnType<typeof taStep.ema>;
  smoothed: number[];
  plot0: Point[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<LaguerreKalmanAdaptiveFilterAlphanattInputs>): BarStudy<LkafRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { gamma, adaptivePeriod, noiseLevel, threshold } = cfg;
  return {
    init() {
      const dev = new WindowStdev(adaptivePeriod);
      const ema = taStep.ema(3);
      const s: LkafRun = {
        dev, ema, smoothed: [], plot0: [], flags: [[], []], times: [[], []],
        steps: [dev, ema],
        vars: { l0: NaN, l1: NaN, l2: NaN, l3: NaN, a0: NaN, a1: NaN, a2: NaN, a3: NaN, estimate: NaN, errorCovariance: 1.0 },
        lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [s.smoothed, s.plot0, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const c = b.close;
      const stdev = s.dev.step(c);
      const L0 = (1 - gamma) * c + gamma * nz(v.l0);
      const L1 = -gamma * L0 + nz(v.l0) + gamma * nz(v.l1);
      const L2 = -gamma * L1 + nz(v.l1) + gamma * nz(v.l2);
      const L3 = -gamma * L2 + nz(v.l2) + gamma * nz(v.l3);
      v.l0 = L0; v.l1 = L1; v.l2 = L2; v.l3 = L3;
      const laguerreFilter = (L0 + 2 * L1 + 2 * L2 + L3) / 6;

      if (isNaN(v.estimate)) v.estimate = laguerreFilter;
      const predictedEstimate = v.estimate;
      const predictedError = v.errorCovariance + noiseLevel * noiseLevel;
      const kalmanGain = predictedError / (predictedError + noiseLevel);
      v.estimate = predictedEstimate + kalmanGain * (laguerreFilter - predictedEstimate);
      v.errorCovariance = (1 - kalmanGain) * predictedError;

      // volatility = ta.stdev(close, adaptivePeriod) / close; math.min / math.max give na with an na argument
      const volatility = stdev / c;
      const adaptiveGamma = Math.min(0.99, Math.max(0.1, gamma * (1 + volatility * 10)));
      const A0 = (1 - adaptiveGamma) * c + adaptiveGamma * nz(v.a0);
      const A1 = -adaptiveGamma * A0 + nz(v.a0) + adaptiveGamma * nz(v.a1);
      const A2 = -adaptiveGamma * A1 + nz(v.a1) + adaptiveGamma * nz(v.a2);
      const A3 = -adaptiveGamma * A2 + nz(v.a2) + adaptiveGamma * nz(v.a3);
      v.a0 = A0; v.a1 = A1; v.a2 = A2; v.a3 = A3;
      const adaptiveFilter = (A0 + 2 * A1 + 2 * A2 + A3) / 6;

      const smoothed = s.ema.step((v.estimate + adaptiveFilter) / 2);
      s.smoothed[i] = smoothed;
      const prev = i > 0 ? s.smoothed[i - 1] : NaN;
      const prevClose = i > 0 ? bars[i - 1].close : NaN;
      const filterTrend = gt(smoothed, prev + threshold);
      const priceTrend = gt(c, smoothed) && i > 0 && gt(prevClose, prev);
      s.plot0[i] = { time: b.time, value: smoothed, color: filterTrend && priceTrend ? UP_COL : DOWN_COL };
      // alertcondition(ta.crossover(close, smoothed), ...) / alertcondition(ta.crossunder(close, smoothed), ...)
      const flags = [c > smoothed && prevClose <= prev, c < smoothed && prevClose >= prev];
      for (let k = 0; k < 2; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(b.time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<LaguerreKalmanAdaptiveFilterAlphanattInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<LaguerreKalmanAdaptiveFilterAlphanattInputs> = {},
): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions (each declared twice by the original, listed once) */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Filter Cross Up', message: 'Price crossed above Laguerre-Kalman Filter' },
  { id: 'alert1', title: 'Filter Cross Down', message: 'Price crossed below Laguerre-Kalman Filter' },
];

export const LaguerreKalmanAdaptiveFilterAlphanatt = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
