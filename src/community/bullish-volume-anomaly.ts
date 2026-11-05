/**
 * Bullish Volume Anomaly
 *
 * An ATR zigzag (reversal when price moves ATR * multiplier against the last swing high / low) signs the volume:
 * +volume in an up leg, -volume in a down leg. Its cumulative sum and the close are turned into z-scores over 480
 * bars (s and p); c is the 480-bar change of p divided by its 480-bar stdev. Bands around an EMA of the close:
 * ema * (1 +- mean(|open - close| / open over the band length) * band multiplier), drawn one bar late. A triangle
 * below the bar marks s - p > 2, c < 1, s > 0 and a high below the previous lower band.
 * Alert (alertcondition, `alerts` of the result): '{{ticker}}', true on the bars of a triangle.
 *
 * Reference: "Bullish Volume Anomaly" by UnknownUnicorn13336802
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertcondition (title '{{ticker}}', no message) */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: '{{ticker}}', message: 'Alert Fired!' },
];

export interface BullishVolumeAnomalyInputs {
  /** ATR length of the zigzag */
  atrLength: number;
  /** ATR multiplier of the zigzag reversal */
  atrMult: number;
  /** Band multiplier */
  bandMult: number;
  /** Band length (EMA length and window of the open / close range) */
  bandLength: number;
}

export const defaultInputs: BullishVolumeAnomalyInputs = {
  atrLength: 14,
  atrMult: 3.0,
  bandMult: 5.0,
  bandLength: 288,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14, min: 1 },
  { id: 'atrMult', type: 'float', title: 'ATR Multiplier for ZigZag', defval: 3.0 },
  { id: 'bandMult', type: 'float', title: 'Band Multiplier', defval: 5.0 },
  { id: 'bandLength', type: 'int', title: 'Band Length', defval: 288 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'Upper Band', color: color.green, lineWidth: 1 },
  { id: 'plot2', title: 'Lower Band', color: color.red, lineWidth: 1 },
];

export const metadata = {
  title: 'Bullish Volume Anomaly',
  shortTitle: 'Bullish Volume Anomaly',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface BvaVars {
  /** The ATR zigzag: last swing low / high and the trend */
  LL: number;
  HH: number;
  trend: number;
}

interface BvaRun extends BarRunState<BvaVars> {
  atr: ReturnType<typeof taStep.atr>;
  cum: ReturnType<typeof taStep.cum>;
  ssMean: ReturnType<typeof taStep.sma>;
  ssDev: ReturnType<typeof taStep.stdev>;
  cMean: ReturnType<typeof taStep.sma>;
  cDev: ReturnType<typeof taStep.stdev>;
  pDev: ReturnType<typeof taStep.stdev>;
  ema: ReturnType<typeof taStep.ema>;
  p: number[];
  down: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  up: number[];
  flags: boolean[];
  times: number[];
  markers: MarkerData[];
}

function study(inputs: Partial<BullishVolumeAnomalyInputs>): BarStudy<BvaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const W = 480;
  const l = cfg.bandLength;
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      const s: BvaRun = {
        atr: taStep.atr(cfg.atrLength), cum: taStep.cum(), ssMean: taStep.sma(), ssDev: taStep.stdev(), cMean: taStep.sma(),
        cDev: taStep.stdev(), pDev: taStep.stdev(), ema: taStep.ema(l),
        p: [], down: [], up: [], plot0: [], plot1: [], plot2: [], flags: [], times: [], markers: [],
        steps: [], vars: { LL: NaN, HH: NaN, trend: 1 }, lists: [], series: [],
      };
      s.steps = [s.atr, s.cum, s.ssMean, s.ssDev, s.cMean, s.cDev, s.pDev, s.ema];
      s.lists = [s.times, s.markers];
      s.series = [s.p, s.down, s.up, s.plot0, s.plot1, s.plot2, s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const close = b.close;

      // Single ATR zigzag; the volume is signed by the trend after this bar's update
      const atr = s.atr.step(b.high, b.low, close);
      if (i === 0) {
        v.LL = b.low;
        v.HH = b.high;
        v.trend = 1;
      }
      const thr = atr * cfg.atrMult;
      const { LL, HH, trend } = v;
      let nextLL = LL;
      let nextHH = HH;
      let nextTrend = trend;
      if (!isNaN(thr)) {
        if (trend > 0) {
          if (ge(b.high, HH)) nextHH = b.high;
          else if (lt(b.low, HH - thr)) {
            nextTrend = -1;
            nextLL = b.low;
          }
        } else if (le(b.low, LL)) nextLL = b.low;
        else if (gt(b.high, LL + thr)) {
          nextTrend = 1;
          nextHH = b.high;
        }
      }
      v.LL = nextLL;
      v.HH = nextHH;
      v.trend = nextTrend;
      const signedVolume = nextTrend === 1 ? (b.volume ?? NaN) : -(b.volume ?? NaN);

      // Z-scores; plain divisions (x / 0 is +-infinity, 0 / 0 na)
      const ss = s.cum.step(signedVolume);
      const ssMean = s.ssMean.step(ss, W);
      const ssDev = s.ssDev.step(ss, W);
      const sv = (ss - ssMean) / ssDev;
      const cMean = s.cMean.step(close, W);
      const cDev = s.cDev.step(close, W);
      const p = (close - cMean) / cDev;
      s.p[i] = p;
      const pDev = s.pDev.step(p, W);
      const c = (i >= W ? p - s.p[i - W] : NaN) / pDev;

      // close_range(l): sum of |open[i] - close[i]| / open[i] for i = 0 .. l - 1 (open[i] != 0), divided by l
      const ema = s.ema.step(close);
      let mean = 0.0;
      for (let k = 0; k <= l - 1; k++) {
        const o = i - k >= 0 ? bars[i - k].open : NaN;
        if (!isNaN(o) && Math.abs(o) > EPS) mean = mean + Math.abs(o - bars[i - k].close) / o;
      }
      const range = mean / l;
      s.up[i] = ema * (1 + range * cfg.bandMult);
      s.down[i] = ema * (1 - range * cfg.bandMult);

      // alertcondition(s-p>2 and c<1 and s>0 and high<down[1], '{{ticker}}')
      const signal = i >= 1 && gt(sv - p, 2) && lt(c, 1) && gt(sv, 0) && lt(b.high, s.down[i - 1]);
      s.flags[i] = signal;
      if (signal) {
        s.times.push(b.time as number);
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: color.green, size: 'normal' });
      }

      const time = b.time as number;
      s.plot0[i] = { time, value: fin(ema), color: color.blue };
      s.plot1[i] = { time, value: i > 0 ? fin(s.up[i - 1]) : NaN, color: color.green };
      s.plot2[i] = { time, value: i > 0 ? fin(s.down[i - 1]) : NaN, color: color.red };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, [s.times], [n > 0 && s.flags[n - 1]]),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BullishVolumeAnomalyInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<BullishVolumeAnomalyInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const BullishVolumeAnomaly = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
