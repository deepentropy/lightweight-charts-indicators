/**
 * Polynomial Trend Exhaustion & Divergence
 *
 * The OHLC prices are first smoothed (none, a blend of the price and its linear regression, or a Kalman filter).
 * A cubic least-squares polynomial on the last `polyLength` values of the smoothed source gives the trend slope at
 * the newest bar (or the bar to bar change of a Kalman filter of the source). Exhaustion: the slope is positive and
 * falling (bull) or negative and rising (bear) for a number of bars; at most `exhaustionMaxRepeat` signals in a row,
 * then a cooldown. Divergence: a cubic polynomial on the last `divPolyLength` values is extrapolated
 * `divExtrapolate` bars ahead; when price fell over the lookback while the forecast is above the close (bullish), or
 * the reverse (bearish), by at least some ATRs and for some bars in a row, a DIV label is drawn (with a cooldown).
 * Exhaustion signals are crosses at one signal offset (ATR) from the smoothed high / low, divergence labels at two.
 * The markers carry the ids of the original's plotshape outputs (shape0..shape3). Alerts (alertcondition, `alerts`
 * of the result): 'Bull Exhaustion', 'Bear Exhaustion', 'Bullish Divergence', 'Bearish Divergence', true on the bars
 * of each signal.
 *
 * Reference: "Polynomial Trend Exhaustion & Divergence" by B3AR_Trades
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface PolynomialTrendExhaustionDivergenceInputs {
  smoothingType: 'None' | 'LinReg Blend' | 'Kalman';
  lrLength: number;
  /** Weight of the linear regression in the blend (%) */
  blendPct: number;
  kalmanQ: number;
  kalmanR: number;
  trendMethod: 'Polynomial' | 'Kalman';
  trendSource: SourceType;
  polyLength: number;
  trendKalmanQ: number;
  trendKalmanR: number;
  showExhaustion: boolean;
  exhaustionBars: number;
  exhaustionMaxRepeat: number;
  exhaustionCooldown: number;
  showDivergence: boolean;
  divPolyLength: number;
  divExtrapolate: number;
  divLookback: number;
  divThresholdATR: number;
  priceMovementATR: number;
  divCooldown: number;
  divConsecBars: number;
  bullExhaustionColor: string;
  bearExhaustionColor: string;
  bearishDivColor: string;
  bullishDivColor: string;
  signalOffset: number;
}

export const defaultInputs: PolynomialTrendExhaustionDivergenceInputs = {
  smoothingType: 'LinReg Blend',
  lrLength: 5,
  blendPct: 50.0,
  kalmanQ: 0.01,
  kalmanR: 0.1,
  trendMethod: 'Polynomial',
  trendSource: 'close',
  polyLength: 20,
  trendKalmanQ: 0.01,
  trendKalmanR: 0.1,
  showExhaustion: true,
  exhaustionBars: 2,
  exhaustionMaxRepeat: 3,
  exhaustionCooldown: 3,
  showDivergence: true,
  divPolyLength: 25,
  divExtrapolate: 10,
  divLookback: 10,
  divThresholdATR: 0.5,
  priceMovementATR: 0.4,
  divCooldown: 4,
  divConsecBars: 5,
  bullExhaustionColor: '#FFFF00',
  bearExhaustionColor: '#FFFF00',
  bearishDivColor: '#FF5252',
  bullishDivColor: '#4CAF50',
  signalOffset: 0.5,
};

const G_SMOOTH = 'Source Smoothing';
const G_TREND = 'Trend Method';
const G_POLY = 'Polynomial Regression';
const G_TREND_KALMAN = 'Trend Kalman Settings';
const G_EXH = 'Exhaustion Detection';
const G_DIV = 'Divergence Detection (Polynomial Forecast)';
const G_DIV_FILTER = 'Divergence Filters';
const G_APP = 'Appearance';

export const inputConfig: InputConfig[] = [
  { id: 'smoothingType', type: 'string', title: 'Smoothing Method', defval: 'LinReg Blend',
    options: ['None', 'LinReg Blend', 'Kalman'], group: G_SMOOTH },
  { id: 'lrLength', type: 'int', title: 'LinReg Length', defval: 5, min: 2, max: 20, group: G_SMOOTH },
  { id: 'blendPct', type: 'float', title: 'LinReg Blend %', defval: 50.0, min: 0, max: 100, step: 5, group: G_SMOOTH },
  { id: 'kalmanQ', type: 'float', title: 'Kalman Process Noise (Q)', defval: 0.01, min: 0.001, max: 1.0, step: 0.001,
    group: G_SMOOTH, tooltip: 'Higher = more responsive' },
  { id: 'kalmanR', type: 'float', title: 'Kalman Measurement Noise (R)', defval: 0.1, min: 0.001, max: 1.0, step: 0.01,
    group: G_SMOOTH, tooltip: 'Higher = more smoothing' },
  { id: 'trendMethod', type: 'string', title: 'Base Trend Method', defval: 'Polynomial',
    options: ['Polynomial', 'Kalman'], group: G_TREND },
  { id: 'trendSource', type: 'source', title: 'Source', defval: 'close', group: G_TREND },
  { id: 'polyLength', type: 'int', title: 'Length', defval: 20, min: 10, group: G_POLY },
  { id: 'trendKalmanQ', type: 'float', title: 'Kalman Process Noise (Q)', defval: 0.01, min: 0.001, max: 1.0,
    step: 0.001, group: G_TREND_KALMAN },
  { id: 'trendKalmanR', type: 'float', title: 'Kalman Measurement Noise (R)', defval: 0.1, min: 0.001, max: 1.0,
    step: 0.01, group: G_TREND_KALMAN },
  { id: 'showExhaustion', type: 'bool', title: 'Show Exhaustion Signals', defval: true, group: G_EXH },
  { id: 'exhaustionBars', type: 'int', title: 'Consecutive Bars for Exhaustion', defval: 2, min: 1, max: 5,
    group: G_EXH },
  { id: 'exhaustionMaxRepeat', type: 'int', title: 'Max Repeat Signals', defval: 3, min: 1, max: 10, group: G_EXH,
    tooltip: 'Maximum signals before cooldown' },
  { id: 'exhaustionCooldown', type: 'int', title: 'Cooldown After Max (bars)', defval: 3, min: 1, max: 50,
    group: G_EXH, tooltip: 'Bars to wait after hitting max signals' },
  { id: 'showDivergence', type: 'bool', title: 'Show Divergence Labels', defval: true, group: G_DIV },
  { id: 'divPolyLength', type: 'int', title: 'Forecast Period', defval: 25, min: 10, group: G_DIV },
  { id: 'divExtrapolate', type: 'int', title: 'Extrapolate Bars', defval: 10, min: 1, max: 50, group: G_DIV },
  { id: 'divLookback', type: 'int', title: 'Price Lookback', defval: 10, min: 3, max: 50, group: G_DIV,
    tooltip: 'Bars to check price direction' },
  { id: 'divThresholdATR', type: 'float', title: 'Min Divergence (ATR)', defval: 0.5, min: 0, max: 5, step: 0.1,
    group: G_DIV_FILTER, tooltip: 'Forecast must be at least this many ATRs away from price' },
  { id: 'priceMovementATR', type: 'float', title: 'Min Price Movement (ATR)', defval: 0.4, min: 0, max: 5, step: 0.1,
    group: G_DIV_FILTER, tooltip: 'Price must have moved at least this many ATRs over lookback' },
  { id: 'divCooldown', type: 'int', title: 'Cooldown (bars)', defval: 4, min: 0, max: 50, group: G_DIV_FILTER,
    tooltip: 'Minimum bars between divergence signals' },
  { id: 'divConsecBars', type: 'int', title: 'Consecutive Bars Required', defval: 5, min: 1, max: 5,
    group: G_DIV_FILTER, tooltip: 'Divergence must be true for X bars before triggering' },
  { id: 'bullExhaustionColor', type: 'color', title: 'Bull Exhaustion Color', defval: '#FFFF00', group: G_APP },
  { id: 'bearExhaustionColor', type: 'color', title: 'Bear Exhaustion Color', defval: '#FFFF00', group: G_APP },
  { id: 'bearishDivColor', type: 'color', title: 'Bearish Divergence Color', defval: '#FF5252', group: G_APP },
  { id: 'bullishDivColor', type: 'color', title: 'Bullish Divergence Color', defval: '#4CAF50', group: G_APP },
  { id: 'signalOffset', type: 'float', title: 'Signal Offset (ATR mult)', defval: 0.5, min: 0.1, max: 2.0, step: 0.1,
    group: G_APP },
];

// No plot(): the outputs are 4 plotshape markers at absolute prices
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Polynomial Trend Exhaustion & Divergence',
  shortTitle: 'Exh+Div',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;
const nz = (x: number) => (isNaN(x) ? 0 : x);
/** Pine math.max / math.min: na when an argument is na */
const max = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.max(a, b));
const min = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.min(a, b));

/** Pine Kalman filter of the script: one state per call site (committed with the bar) */
class KalmanStep implements Committable {
  private estimate = NaN;
  private errorEstimate = 1.0;
  private nextEstimate = NaN;
  private nextError = 1.0;
  private stepped = false;

  constructor(private readonly processNoise: number, private readonly measurementNoise: number) {}

  step(src: number): number {
    this.stepped = true;
    let estimate = this.estimate;
    if (isNaN(estimate)) estimate = src;
    const prediction = estimate;
    const errorPrediction = this.errorEstimate + this.processNoise;
    const kalmanGain = errorPrediction / (errorPrediction + this.measurementNoise);
    estimate = prediction + kalmanGain * (src - prediction);
    this.nextEstimate = estimate;
    this.nextError = (1 - kalmanGain) * errorPrediction;
    return estimate;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.estimate = this.nextEstimate;
    this.errorEstimate = this.nextError;
  }
}

/**
 * Cubic least-squares fit of src[i - len + 1 .. i] (x = 0 oldest .. len - 1 newest) by the script's Gaussian
 * elimination with partial pivoting (Pine `>` with 1e-10 in the pivot search and the pivot test) and back
 * substitution. Returns [b0, b1, b2, b3]; na when a value of the window is na or before bar len - 1.
 */
function cubicFit(src: number[], i: number, len: number): [number, number, number, number] {
  let sumY = 0.0, sumX = 0.0, sumX2 = 0.0, sumX3 = 0.0, sumX4 = 0.0, sumX5 = 0.0, sumX6 = 0.0;
  let sumXY = 0.0, sumX2Y = 0.0, sumX3Y = 0.0;
  for (let k = 0; k <= len - 1; k++) {
    const x = k;
    const j = i - (len - 1 - k);
    const y = j >= 0 ? src[j] : NaN;
    const x2 = x * x;
    const x3 = x2 * x;
    sumY += y;
    sumX += x;
    sumX2 += x2;
    sumX3 += x3;
    sumX4 += x2 * x2;
    sumX5 += x2 * x3;
    sumX6 += x3 * x3;
    sumXY += x * y;
    sumX2Y += x2 * y;
    sumX3Y += x3 * y;
  }
  const n = len;
  const A = [
    [n, sumX, sumX2, sumX3, sumY],
    [sumX, sumX2, sumX3, sumX4, sumXY],
    [sumX2, sumX3, sumX4, sumX5, sumX2Y],
    [sumX3, sumX4, sumX5, sumX6, sumX3Y],
  ];
  for (let col = 0; col <= 2; col++) {
    let maxRow = col;
    let maxVal = Math.abs(A[col][col]);
    for (let row = col + 1; row <= 3; row++) {
      if (gt(Math.abs(A[row][col]), maxVal)) {
        maxVal = Math.abs(A[row][col]);
        maxRow = row;
      }
    }
    if (maxRow !== col) {
      for (let k = 0; k <= 4; k++) {
        const temp = A[col][k];
        A[col][k] = A[maxRow][k];
        A[maxRow][k] = temp;
      }
    }
    const pivot = A[col][col];
    if (gt(Math.abs(pivot), 1e-10)) {
      for (let row = col + 1; row <= 3; row++) {
        const factor = A[row][col] / pivot;
        for (let k = col; k <= 4; k++) A[row][k] = A[row][k] - factor * A[col][k];
      }
    }
  }
  const b3 = A[3][4] / A[3][3];
  const b2 = (A[2][4] - A[2][3] * b3) / A[2][2];
  const b1 = (A[1][4] - A[1][3] * b3 - A[1][2] * b2) / A[1][1];
  const b0 = (A[0][4] - A[0][3] * b3 - A[0][2] * b2 - A[0][1] * b1) / A[0][0];
  return [b0, b1, b2, b3];
}

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface PolyVars {
  prevSlope: number;
  bullExhaustionCount: number;
  bearExhaustionCount: number;
  bullExhRepeatCount: number;
  bearExhRepeatCount: number;
  bullExhCooldownBars: number;
  bearExhCooldownBars: number;
  bullExhInCooldown: boolean;
  bearExhInCooldown: boolean;
  bullDivCount: number;
  bearDivCount: number;
  barsSinceBullDiv: number;
  barsSinceBearDiv: number;
}

interface PolyRun extends BarRunState<PolyVars> {
  lrOpen: ReturnType<typeof taStep.linreg>;
  lrHigh: ReturnType<typeof taStep.linreg>;
  lrLow: ReturnType<typeof taStep.linreg>;
  lrClose: ReturnType<typeof taStep.linreg>;
  atr: ReturnType<typeof taStep.atr>;
  kOpen: KalmanStep;
  kHigh: KalmanStep;
  kLow: KalmanStep;
  kClose: KalmanStep;
  kTrend: KalmanStep;
  resolvedSource: number[];
  trendKalman: number[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<PolynomialTrendExhaustionDivergenceInputs>): BarStudy<PolyRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const blend = cfg.blendPct / 100.0;
  return {
    init() {
      const lrOpen = taStep.linreg(cfg.lrLength, 0);
      const lrHigh = taStep.linreg(cfg.lrLength, 0);
      const lrLow = taStep.linreg(cfg.lrLength, 0);
      const lrClose = taStep.linreg(cfg.lrLength, 0);
      const atr = taStep.atr(14);
      const kOpen = new KalmanStep(cfg.kalmanQ, cfg.kalmanR);
      const kHigh = new KalmanStep(cfg.kalmanQ, cfg.kalmanR);
      const kLow = new KalmanStep(cfg.kalmanQ, cfg.kalmanR);
      const kClose = new KalmanStep(cfg.kalmanQ, cfg.kalmanR);
      const kTrend = new KalmanStep(cfg.trendKalmanQ, cfg.trendKalmanR);
      const s: PolyRun = {
        lrOpen, lrHigh, lrLow, lrClose, atr, kOpen, kHigh, kLow, kClose, kTrend, resolvedSource: [], trendKalman: [],
        markers: [], flags: [[], [], [], []], times: [[], [], [], []],
        steps: [lrOpen, lrHigh, lrLow, lrClose, atr, kOpen, kHigh, kLow, kClose, kTrend],
        vars: {
          prevSlope: NaN, bullExhaustionCount: 0, bearExhaustionCount: 0, bullExhRepeatCount: 0, bearExhRepeatCount: 0,
          bullExhCooldownBars: 0, bearExhCooldownBars: 0, bullExhInCooldown: false, bearExhInCooldown: false,
          bullDivCount: 0, bearDivCount: 0, barsSinceBullDiv: 999, barsSinceBearDiv: 999,
        },
        lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.resolvedSource, s.trendKalman, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const lrOpen = s.lrOpen.step(b.open);
      const lrHigh = s.lrHigh.step(b.high);
      const lrLow = s.lrLow.step(b.low);
      const lrClose = s.lrClose.step(b.close);
      const atr = s.atr.step(b.high, b.low, b.close);
      const kalmanOpen = s.kOpen.step(b.open);
      const kalmanHigh = s.kHigh.step(b.high);
      const kalmanLow = s.kLow.step(b.low);
      const kalmanClose = s.kClose.step(b.close);
      let sOpen: number, sHigh: number, sLow: number, sClose: number;
      if (cfg.smoothingType === 'LinReg Blend') {
        sOpen = b.open * (1 - blend) + lrOpen * blend;
        sHigh = b.high * (1 - blend) + lrHigh * blend;
        sLow = b.low * (1 - blend) + lrLow * blend;
        sClose = b.close * (1 - blend) + lrClose * blend;
      } else if (cfg.smoothingType === 'Kalman') {
        sOpen = kalmanOpen;
        sHigh = kalmanHigh;
        sLow = kalmanLow;
        sClose = kalmanClose;
      } else {
        sOpen = b.open;
        sHigh = b.high;
        sLow = b.low;
        sClose = b.close;
      }
      // Ensure high / low integrity
      sHigh = max(sHigh, max(sOpen, sClose));
      sLow = min(sLow, min(sOpen, sClose));
      const smoothHigh = sHigh;
      const smoothLow = sLow;

      // switch trendSource: the cases compare the source VALUE with open, high, low, close, hl2, hlc3, ohlc4, hlcc4 in
      // this order (Pine ==), so e.g. with the close source a bar whose close equals its open takes the smoothed open
      const hl2 = (b.high + b.low) / 2;
      const hlc3 = (b.high + b.low + b.close) / 3;
      const ohlc4 = (b.open + b.high + b.low + b.close) / 4;
      const hlcc4 = (b.high + b.low + b.close + b.close) / 4;
      let src: number;
      switch (cfg.trendSource) {
        case 'open': src = b.open; break;
        case 'high': src = b.high; break;
        case 'low': src = b.low; break;
        case 'close': src = b.close; break;
        case 'hl2': src = hl2; break;
        case 'hlc3': src = hlc3; break;
        case 'ohlc4': src = ohlc4; break;
        case 'hlcc4': src = hlcc4; break;
        case 'volume': src = b.volume ?? NaN; break;
        default: src = b.close;
      }
      let rs: number;
      if (eq(src, b.open)) rs = sOpen;
      else if (eq(src, b.high)) rs = sHigh;
      else if (eq(src, b.low)) rs = sLow;
      else if (eq(src, b.close)) rs = sClose;
      else if (eq(src, hl2)) rs = (sHigh + sLow) / 2;
      else if (eq(src, hlc3)) rs = (sHigh + sLow + sClose) / 3;
      else if (eq(src, ohlc4)) rs = (sOpen + sHigh + sLow + sClose) / 4;
      else if (eq(src, hlcc4)) rs = (sHigh + sLow + sClose + sClose) / 4;
      else rs = sClose;
      s.resolvedSource[i] = rs;
      const trendKalman = s.kTrend.step(rs);
      s.trendKalman[i] = trendKalman;

      // Polynomial slope at the newest bar (x = len - 1)
      const [, p1, p2, p3] = cubicFit(s.resolvedSource, i, cfg.polyLength);
      const xc = cfg.polyLength - 1;
      const polySlope = p1 + 2 * p2 * xc + 3 * p3 * xc * xc;
      const trendKalmanSlope = trendKalman - nz(i > 0 ? s.trendKalman[i - 1] : NaN);
      const activeSlope = cfg.trendMethod === 'Kalman' ? trendKalmanSlope : polySlope;

      // Slope momentum and exhaustion
      const slopeMomentum = activeSlope - nz(v.prevSlope);
      v.prevSlope = activeSlope;
      const rawBullExhaustion = gt(activeSlope, 0) && lt(slopeMomentum, 0);
      const rawBearExhaustion = lt(activeSlope, 0) && gt(slopeMomentum, 0);
      v.bullExhaustionCount = rawBullExhaustion ? v.bullExhaustionCount + 1 : 0;
      v.bearExhaustionCount = rawBearExhaustion ? v.bearExhaustionCount + 1 : 0;
      const bullExhaustionBase = v.bullExhaustionCount >= cfg.exhaustionBars;
      const bearExhaustionBase = v.bearExhaustionCount >= cfg.exhaustionBars;

      if (v.bullExhInCooldown) {
        v.bullExhCooldownBars -= 1;
        if (v.bullExhCooldownBars <= 0) {
          v.bullExhInCooldown = false;
          v.bullExhRepeatCount = 0;
        }
      }
      if (v.bearExhInCooldown) {
        v.bearExhCooldownBars -= 1;
        if (v.bearExhCooldownBars <= 0) {
          v.bearExhInCooldown = false;
          v.bearExhRepeatCount = 0;
        }
      }

      let bullExhaustion = false;
      let bearExhaustion = false;
      if (cfg.showExhaustion && bullExhaustionBase && !v.bullExhInCooldown) {
        if (v.bullExhRepeatCount < cfg.exhaustionMaxRepeat) {
          bullExhaustion = true;
          v.bullExhRepeatCount += 1;
          if (v.bullExhRepeatCount >= cfg.exhaustionMaxRepeat) {
            v.bullExhInCooldown = true;
            v.bullExhCooldownBars = cfg.exhaustionCooldown;
          }
        }
      }
      if (cfg.showExhaustion && bearExhaustionBase && !v.bearExhInCooldown) {
        if (v.bearExhRepeatCount < cfg.exhaustionMaxRepeat) {
          bearExhaustion = true;
          v.bearExhRepeatCount += 1;
          if (v.bearExhRepeatCount >= cfg.exhaustionMaxRepeat) {
            v.bearExhInCooldown = true;
            v.bearExhCooldownBars = cfg.exhaustionCooldown;
          }
        }
      }
      if (!rawBullExhaustion && !v.bullExhInCooldown) v.bullExhRepeatCount = 0;
      if (!rawBearExhaustion && !v.bearExhInCooldown) v.bearExhRepeatCount = 0;

      // Cubic forecast extrapolated divExtrapolate bars ahead
      const [f0, f1, f2, f3] = cubicFit(s.resolvedSource, i, cfg.divPolyLength);
      const xe = cfg.divPolyLength - 1 + cfg.divExtrapolate;
      const forecastValue = f0 + f1 * xe + f2 * xe * xe + f3 * xe * xe * xe;

      const priceChange = b.close - (i >= cfg.divLookback ? bars[i - cfg.divLookback].close : NaN);
      const priceFalling = lt(priceChange, 0);
      const priceRising = gt(priceChange, 0);
      const divAmount = Math.abs(forecastValue - b.close);
      const priceMovement = Math.abs(priceChange);
      const priceMovedEnough = ge(priceMovement, cfg.priceMovementATR * atr);
      const divLargeEnough = ge(divAmount, cfg.divThresholdATR * atr);
      const rawBullishDiv = priceFalling && gt(forecastValue, b.close);
      const rawBearishDiv = priceRising && lt(forecastValue, b.close);

      v.bullDivCount = rawBullishDiv && priceMovedEnough && divLargeEnough ? v.bullDivCount + 1 : 0;
      v.bearDivCount = rawBearishDiv && priceMovedEnough && divLargeEnough ? v.bearDivCount + 1 : 0;

      v.barsSinceBullDiv += 1;
      v.barsSinceBearDiv += 1;
      const bullishDivRaw = cfg.showDivergence && v.bullDivCount >= cfg.divConsecBars && v.barsSinceBullDiv >= cfg.divCooldown;
      const bearishDivRaw = cfg.showDivergence && v.bearDivCount >= cfg.divConsecBars && v.barsSinceBearDiv >= cfg.divCooldown;
      if (bullishDivRaw) v.barsSinceBullDiv = 0;
      if (bearishDivRaw) v.barsSinceBearDiv = 0;
      const bullishDiv = bullishDivRaw && v.barsSinceBullDiv === 0;
      const bearishDiv = bearishDivRaw && v.barsSinceBearDiv === 0;
      s.flags[0][i] = bullExhaustion;
      s.flags[1][i] = bearExhaustion;
      s.flags[2][i] = bullishDiv;
      s.flags[3][i] = bearishDiv;
      if (bullExhaustion) s.times[0].push(b.time as number);
      if (bearExhaustion) s.times[1].push(b.time as number);
      if (bullishDiv) s.times[2].push(b.time as number);
      if (bearishDiv) s.times[3].push(b.time as number);

      // plotshape(..., location.absolute): no shape when the price is na
      const markers = s.markers;
      const p0 = smoothHigh + atr * cfg.signalOffset;
      if (bullExhaustion && Number.isFinite(p0)) {
        markers.push({ time: b.time, price: p0, position: 'atPriceMiddle', shape: 'xcross', color: cfg.bullExhaustionColor, size: 'tiny', id: 'shape0' });
      }
      const pr1 = smoothLow - atr * cfg.signalOffset;
      if (bearExhaustion && Number.isFinite(pr1)) {
        markers.push({ time: b.time, price: pr1, position: 'atPriceMiddle', shape: 'xcross', color: cfg.bearExhaustionColor, size: 'tiny', id: 'shape1' });
      }
      const pr2 = smoothLow - atr * cfg.signalOffset * 2;
      if (bullishDiv && Number.isFinite(pr2)) {
        markers.push({
          time: b.time, price: pr2, position: 'atPriceBottom', shape: 'labelUp', color: cfg.bullishDivColor, size: 'tiny', text: 'DIV',
          textColor: '#FFFFFF', id: 'shape2',
        });
      }
      const pr3 = smoothHigh + atr * cfg.signalOffset * 2;
      if (bearishDiv && Number.isFinite(pr3)) {
        markers.push({
          time: b.time, price: pr3, position: 'atPriceTop', shape: 'labelDown', color: cfg.bearishDivColor, size: 'tiny', text: 'DIV',
          textColor: '#FFFFFF', id: 'shape3',
        });
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PolynomialTrendExhaustionDivergenceInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<PolynomialTrendExhaustionDivergenceInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bull Exhaustion', message: 'Exhaustion+Div → Bull Exhaustion Warning' },
  { id: 'alert1', title: 'Bear Exhaustion', message: 'Exhaustion+Div → Bear Exhaustion Warning' },
  { id: 'alert2', title: 'Bullish Divergence', message: 'Exhaustion+Div → Bullish Divergence' },
  { id: 'alert3', title: 'Bearish Divergence', message: 'Exhaustion+Div → Bearish Divergence' },
];

export const PolynomialTrendExhaustionDivergence = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
