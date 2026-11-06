/**
 * Bollinger Bands Stochastic RSI Extreme Signal
 *
 * Overlay=true: Bollinger Bands on price (basis/upper/lower with fill),
 * plus bull/bear triangle markers based on StochRSI extreme conditions.
 *
 * Bull: close[1] < lower[1] and close > lower and K[1] < lowerlimit and D[1] < lowerlimit
 * Bear: close[1] > upper[1] and close < upper and K[1] > upperlimit and D[1] > upperlimit
 * Alerts (alertcondition, `alerts` of the result): 'Any Signal' (bear or bull), 'Bearish Signal', 'Bullish Signal'.
 *
 * Reference: "Bollinger Bands Stochastic RSI Extreme Signal"
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import {
  barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowExtreme, WindowSma, WindowStdev,
  type BarRunState, type BarStudy, type IndicatorRun,
} from '../live-run';

export interface BBStochRSIInputs {
  src: SourceType;
  bbLength: number;
  bbMult: number;
  kSmooth: number;
  dSmooth: number;
  rsiLen: number;
  stochLen: number;
  upperLimit: number;
  lowerLimit: number;
}

export const defaultInputs: BBStochRSIInputs = {
  src: 'close',
  bbLength: 20,
  bbMult: 2.0,
  kSmooth: 3,
  dSmooth: 3,
  rsiLen: 14,
  stochLen: 14,
  upperLimit: 90,
  lowerLimit: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'bbLength', type: 'int', title: 'Bollinger Band Length', defval: 20, min: 1 },
  { id: 'bbMult', type: 'float', title: 'StdDev', defval: 2.0, min: 0.001, step: 0.1 },
  { id: 'kSmooth', type: 'int', title: 'K', defval: 3, min: 1 },
  { id: 'dSmooth', type: 'int', title: 'D', defval: 3, min: 1 },
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'stochLen', type: 'int', title: 'Stochastic Length', defval: 14, min: 1 },
  { id: 'upperLimit', type: 'int', title: 'Upper Limit', defval: 90, min: 1 },
  { id: 'lowerLimit', type: 'int', title: 'Lower Limit', defval: 10, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'BB Basis', color: '#872323', lineWidth: 1 },
  { id: 'plot1', title: 'BB Upper', color: '#009688', lineWidth: 1 },
  { id: 'plot2', title: 'BB Lower', color: '#009688', lineWidth: 1 },
];

export const metadata = {
  title: 'BB Stochastic RSI Extreme Signal',
  shortTitle: 'BBSR Extreme',
  overlay: true,
};

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface BBStochRSIRun extends BarRunState<Record<string, never>> {
  basis: WindowSma;
  dev: WindowStdev;
  rsi: ReturnType<typeof taStep.rsi>;
  rsiHigh: WindowExtreme;
  rsiLow: WindowExtreme;
  kSma: WindowSma;
  dSma: WindowSma;
  upper: number[];
  lower: number[];
  k: number[];
  d: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
}

function study(inputs: Partial<BBStochRSIInputs>): BarStudy<BBStochRSIRun, Result> {
  const { src, bbLength, bbMult, kSmooth, dSmooth, rsiLen, stochLen, upperLimit, lowerLimit } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const warmup = bbLength;
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const s: BBStochRSIRun = {
        basis: new WindowSma(bbLength), dev: new WindowStdev(bbLength), rsi: taStep.rsi(rsiLen),
        rsiHigh: new WindowExtreme(false, stochLen), rsiLow: new WindowExtreme(true, stochLen),
        kSma: new WindowSma(kSmooth), dSma: new WindowSma(dSmooth),
        upper: [], lower: [], k: [], d: [], plot0: [], plot1: [], plot2: [], flags: [[], [], []], times: [[], [], []],
        markers: [], steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.basis, s.dev, s.rsi, s.rsiHigh, s.rsiLow, s.kSma, s.dSma];
      s.lists = [s.markers, ...s.times];
      s.series = [s.upper, s.lower, s.k, s.d, s.plot0, s.plot1, s.plot2, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const v = value(b);
      // Bollinger Bands on price
      const basis = s.basis.step(v);
      const dev = s.dev.step(v) * bbMult;
      const upper = basis + dev;
      const lower = basis - dev;
      s.upper[i] = upper;
      s.lower[i] = lower;

      // Stochastic RSI: stoch(rsi1, rsi1, rsi1, lengthStoch)
      const r = s.rsi.step(v);
      const h = s.rsiHigh.step(r);
      const l = s.rsiLow.step(r);
      const stochRSI = r == null || h == null || l == null || h === l ? NaN : (r - l) / (h - l) * 100;
      const k = s.kSma.step(stochRSI);
      const d = s.dSma.step(k);
      s.k[i] = k;
      s.d[i] = d;

      // Plot BB on price
      s.plot0[i] = { time, value: i < warmup || basis == null ? NaN : basis };
      s.plot1[i] = { time, value: i < warmup || upper == null ? NaN : upper };
      s.plot2[i] = { time, value: i < warmup || lower == null ? NaN : lower };

      // Bull/Bear markers from StochRSI extreme conditions
      // (from the second bar: an na value makes the conditions false, as in the original)
      let bear = false;
      let bull = false;
      if (i >= 1) {
        const closeCur = b.close;
        const closePrev = bars[i - 1].close;
        const upperPrev = s.upper[i - 1];
        const lowerPrev = s.lower[i - 1];
        const kPrev = s.k[i - 1];
        const dPrev = s.d[i - 1];
        if (!(upperPrev == null || lowerPrev == null || kPrev == null || dPrev == null || isNaN(kPrev) || isNaN(dPrev))) {
          // Bear: close[1] > upper[1] and close < upper and k[1] > upperlimit and d[1] > upperlimit
          bear = closePrev > upperPrev && closeCur < upper && kPrev > upperLimit && dPrev > upperLimit;
          // Bull: close[1] < lower[1] and close > lower and k[1] < lowerlimit and d[1] < lowerlimit
          bull = closePrev < lowerPrev && closeCur > lower && kPrev < lowerLimit && dPrev < lowerLimit;
          if (bear) s.markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: '#FF5252' });
          if (bull) s.markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: '#4CAF50' });
        }
      }
      // alertcondition(Bear or Bull) / alertcondition(Bear) / alertcondition(Bull)
      [bear || bull, bear, bull].forEach((f, j) => {
        s.flags[j][i] = f;
        if (f) s.times[j].push(time as number);
      });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'plot2': s.plot2.slice() },
        fills: [
          { plot1: 'plot1', plot2: 'plot2', options: { color: 'rgba(25,135,135,0.05)' } },
        ],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BBStochRSIInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<BBStochRSIInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Any Signal', message: '{{exchange}}:{{ticker}} {{interval}} BB Stochastic Extreme!' },
  { id: 'alert1', title: 'Bearish Signal', message: '{{exchange}}:{{ticker}} {{interval}} Bearish BB Stochastic Extreme!' },
  { id: 'alert2', title: 'Bullish Signal', message: '{{exchange}}:{{ticker}} {{interval}} Bullish BB Stochastic Extreme!' },
];

export const BBStochRSI = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
