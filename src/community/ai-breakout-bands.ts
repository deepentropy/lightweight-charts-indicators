/**
 * AI Breakout Bands
 *
 * A two-state (position, velocity) Kalman filter of the close, smoothed by a k-neighbour average of its previous
 * `klen` values weighted by 1 / (|current - past| + 1e-6). Bands: the smoothed line +/- multiplier * mean absolute
 * error of the close around it (SMA over the band lookback), filled to the line. The line colour is the positive
 * colour when the close is above the upper band, the negative colour when it is below the lower band, otherwise the
 * sign of the slope of the smoothed line (linear regression at offset 0 minus offset 1).
 *
 * Reference: "AI Breakout Bands (Zeiierman)" by Zeiierman
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface AIBreakoutBandsInputs {
  /** Process noise of the position state */
  processNoisePos: number;
  /** Process noise of the velocity state */
  processNoiseVel: number;
  /** Measurement noise (R) */
  measurementNoise: number;
  /** Number of past Kalman estimates of the k-neighbour smoothing */
  klen: number;
  /** Linear regression length of the slope */
  slopeWindow: number;
  /** SMA length of the mean absolute error (band width) */
  bandLookback: number;
  /** Multiplier of the mean absolute error */
  bandMultiplier: number;
  /** Bullish colour (upper band) */
  colPos: string;
  /** Bearish colour (lower band) */
  colNeg: string;
}

export const defaultInputs: AIBreakoutBandsInputs = {
  processNoisePos: 0.02,
  processNoiseVel: 0.001,
  measurementNoise: 200,
  klen: 10,
  slopeWindow: 20,
  bandLookback: 100,
  bandMultiplier: 2.1,
  colPos: '#00bcd4',
  colNeg: '#2962ff',
};

export const inputConfig: InputConfig[] = [
  { id: 'processNoisePos', type: 'float', title: 'Process Noise (Position)', defval: 0.02, min: 0.0001, step: 0.1 },
  { id: 'processNoiseVel', type: 'float', title: 'Process Noise (Velocity)', defval: 0.001, min: 0.00001, step: 0.01 },
  { id: 'measurementNoise', type: 'float', title: 'Measurement Noise (R)', defval: 200, min: 1 },
  { id: 'klen', type: 'int', title: 'K-Neighbor Length', defval: 10, min: 1 },
  { id: 'slopeWindow', type: 'int', title: 'Slope Calculation Window', defval: 20, min: 1 },
  { id: 'bandLookback', type: 'int', title: 'Band Lookback (MAE)', defval: 100, min: 1 },
  { id: 'bandMultiplier', type: 'float', title: 'Band Multiplier', defval: 2.1, step: 0.1 },
  { id: 'colPos', type: 'color', title: 'Positive Color', defval: '#00bcd4' },
  { id: 'colNeg', type: 'color', title: 'Negative Color', defval: '#2962ff' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Smoothed Kalman Base', color: '#2962ff00', lineWidth: 1 },
  { id: 'plot1', title: 'Smoothed Kalman Trend', color: '#00bcd4', lineWidth: 2 },
  { id: 'plot2', title: 'Upper Band', color: '#00bcd4', lineWidth: 1 },
  { id: 'plot3', title: 'Lower Band', color: '#2962ff', lineWidth: 1 },
];

export const metadata = {
  title: 'AI Breakout Bands',
  shortTitle: 'AI Breakout Bands',
  overlay: true,
};

/** Pine float comparison: a > b only when a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };
type Point = { time: number; value: number; color?: string };

interface KalmanVars {
  /** Kalman state (var) */
  x_p: number;
  x_v: number;
  p00: number;
  p01: number;
  p10: number;
  p11: number;
}

interface BandsRun extends BarRunState<KalmanVars> {
  slope: LinregSlope;
  mae: WindowSma;
  xp: number[];
  plots: Point[][];
}

/**
 * `ta.linreg(source, length, 0) - ta.linreg(source, length, 1)` one bar at a time: the sums of LinregStep (oakscriptjs
 * taStep.linreg, the same doubles) computed once for both offsets.
 */
class LinregSlope implements Committable {
  private values: number[] = [];
  private pending = NaN;
  private stepped = false;
  private readonly len: number;

  constructor(length: number) {
    // the length check of ta.linreg (the same runtime error), once per call of the original
    taStep.linreg(length, 0);
    taStep.linreg(length, 1);
    this.len = Math.floor(length);
  }

  step(value: number): number {
    this.stepped = true;
    this.pending = value;
    const len = this.len;
    const h = this.values;
    const n = h.length;
    if (n < len - 1) return NaN;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    for (let j = 0; j < len; j++) {
      const y = j === len - 1 ? value : h[n - (len - 1 - j)]!;
      if (isNaN(y)) return NaN;
      const x = j + 1;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }
    const slope = (len * sumXY - sumX * sumY) / (len * sumX2 - sumX * sumX);
    const intercept = sumY / len - (slope * sumX) / len + slope;
    return intercept + slope * (len - 1 - 0) - (intercept + slope * (len - 1 - 1));
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.values.push(this.pending);
    if (this.values.length > this.len * 2 + 1024) this.values = this.values.slice(-this.len);
  }
}

function study(inputs: Partial<AIBreakoutBandsInputs>): BarStudy<BandsRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { processNoisePos, processNoiseVel, measurementNoise, klen, slopeWindow, bandLookback, bandMultiplier, colPos, colNeg } = cfg;
  const upCol = String(color.new(colPos, 75));
  const dnCol = String(color.new(colNeg, 75));
  const upFill = String(color.new(colPos, 90));
  const dnFill = String(color.new(colNeg, 90));
  const baseCol = String(color.new(color.blue, 100));
  return {
    init() {
      const slope = new LinregSlope(slopeWindow);
      const mae = new WindowSma(bandLookback);
      const s: BandsRun = {
        slope, mae, xp: [], plots: Array.from({ length: 4 }, () => []), steps: [slope, mae],
        vars: { x_p: NaN, x_v: NaN, p00: NaN, p01: NaN, p10: NaN, p11: NaN }, lists: [], series: [],
      };
      s.series = [s.xp, ...s.plots];
      return s;
    },
    bar(st, i, bars) {
      const v = st.vars;
      const close = bars[i].close;
      const time = bars[i].time;
      // Kalman state (var), set to [close, 0] and the identity covariance on the first bar
      if (i === 0) {
        v.x_p = close;
        v.x_v = 0.0;
        v.p00 = 1.0;
        v.p01 = 0.0;
        v.p10 = 0.0;
        v.p11 = 1.0;
      }
      // f_kalman(close, x_p, x_v, p00, p01, p10, p11)
      const z = close;
      const predP = v.x_p + v.x_v;
      const predV = v.x_v;
      const a00 = v.p00 + v.p10;
      const a01 = v.p01 + v.p11;
      const a10 = v.p10;
      const a11 = v.p11;
      const q00 = a00 + a01 + processNoisePos;
      const q01 = a01;
      const q10 = a10 + a11;
      const q11 = a11 + processNoiseVel;
      const y = z - predP;
      const s = q00 + measurementNoise;
      const k0 = q00 / s;
      const k1 = q10 / s;
      v.x_p = predP + k0 * y;
      v.x_v = predV + k1 * y;
      v.p00 = (1 - k0) * q00;
      v.p01 = (1 - k0) * q01;
      v.p10 = -k1 * q00 + q10;
      v.p11 = -k1 * q01 + q11;
      const xp = st.xp;
      xp[i] = v.x_p;

      // f_knn_smooth(x_p, klen): src[i] is na before the first bar, and sumW += na makes sumW na (result: curr)
      const curr = xp[i];
      let sumW = 0.0;
      let sumX = 0.0;
      for (let k = 1; k <= klen; k++) {
        const xi = i - k >= 0 ? xp[i - k] : NaN;
        const dist = Math.abs(curr - xi) + 1e-6;
        const w = 1.0 / dist;
        sumW += w;
        sumX += xi * w;
      }
      const smooth = gt(sumW, 0) ? sumX / sumW : curr;

      // slope = ta.linreg(smoothKalman, slope_window, 0) - ta.linreg(smoothKalman, slope_window, 1)
      const slope = st.slope.step(smooth);
      // mae = ta.sma(math.abs(close - smoothKalman), bandLookback)
      const mae = st.mae.step(Math.abs(close - smooth));
      const upper = smooth + bandMultiplier * mae;
      const lower = smooth - bandMultiplier * mae;

      // mainCol = close > upperBand ? colPos : close < lowerBand ? colNeg : (slope > 0 ? colPos : colNeg)
      const mainCol = gt(close, upper) ? colPos : gt(lower, close) ? colNeg : gt(slope, 0) ? colPos : colNeg;

      const p = st.plots;
      // p_base = plot(smoothKalman, color = color.new(color.blue, 100))
      p[0][i] = { time, value: smooth, color: baseCol };
      // plot(smoothKalman, color = mainCol, linewidth = 2)
      p[1][i] = { time, value: smooth, color: mainCol };
      // p_up = plot(upperBand, color = color.new(colPos, 75)); p_down = plot(lowerBand, color = color.new(colNeg, 75))
      p[2][i] = { time, value: upper, color: upCol };
      p[3][i] = { time, value: lower, color: dnCol };
    },
    result(st, bars) {
      const n = bars.length;
      const p = st.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice() },
        // fill(p_base, p_up, color.new(colPos, 90)); fill(p_base, p_down, color.new(colNeg, 90))
        fills: [
          { plot1: 'plot0', plot2: 'plot2', colors: new Array<string>(n).fill(upFill) },
          { plot1: 'plot0', plot2: 'plot3', colors: new Array<string>(n).fill(dnFill) },
        ],
        markers: [],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AIBreakoutBandsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AIBreakoutBandsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const AIBreakoutBands = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
