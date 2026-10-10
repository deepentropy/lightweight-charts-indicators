/**
 * Machine Learning: Lorentzian Classification
 *
 * An approximate nearest neighbours classifier with the Lorentzian distance. Two to five features (normalized RSI,
 * WaveTrend, CCI or ADX) are stored for every bar, with a training label: the direction of the source over the
 * next 4 bars. On each bar of the last `maxBarsBack` bars the script walks through the stored bars, keeps the
 * neighbours whose distance sum(log(1 + |feature - stored feature|)) is not below the last kept distance (bars with
 * an index multiple of 4 are skipped) and sums the labels of the last `neighborsCount` neighbours: the prediction.
 * The signal follows the sign of the prediction when the volatility, regime and ADX filters pass. A new signal that
 * agrees with the kernel regression (and the optional EMA / SMA filters) opens a trade (Buy / Sell labels); exits
 * come 4 bars later, or from the kernel when dynamic exits are on. Outputs: the kernel regression estimate
 * (Nadaraya-Watson, rational quadratic kernel), the entry and exit markers, one label per bar with the prediction,
 * bar colours from the prediction, the "Backtest Stream" plot (1 / 2 / -1 / -2, not displayed) and a trade
 * statistics table.
 *
 * The functions of the libraries "MLExtensions" (version 2) and "KernelFunctions" (version 2) by jdehorty that the
 * script uses are written in this file: n_rsi, n_wt, n_cci, n_adx, normalize, rescale, filter_volatility,
 * regime_filter, filter_adx, backtest, init_table, rationalQuadratic and gaussian.
 *
 * The training walk uses bar indexes counted from the first bar given to `calculate`, and the last bar given is
 * the last bar of the chart (Pine last_bar_index).
 *
 * Reference: "Machine Learning: Lorentzian Classification" by jdehorty
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: ©jdehorty
 */

import {
  ta, Series, color, math, str, array, getSourceSeries,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { MarkerData, BarColorData, LabelData, TableData, TableCell } from '../types';

type Feature = 'RSI' | 'WT' | 'CCI' | 'ADX';

export interface LorentzianClassificationInputs {
  /** Source of the input data */
  source: SourceType;
  /** Number of neighbors to consider */
  neighborsCount: number;
  maxBarsBack: number;
  /** Number of features to use for ML predictions */
  featureCount: number;
  /** Compression factor for adjusting the intensity of the color scale */
  colorCompression: number;
  /** Default exits occur exactly 4 bars after an entry signal */
  showExits: boolean;
  /** Dynamic exits adjust the exit threshold with the kernel regression */
  useDynamicExits: boolean;
  showTradeStats: boolean;
  /** Trade statistics from the source price instead of (high + low + open + open) / 4 */
  useWorstCase: boolean;
  /** Search the neighbours from the first bar instead of the last `maxBarsBack` bars */
  includeFullHistory: boolean;
  useVolatilityFilter: boolean;
  useRegimeFilter: boolean;
  useAdxFilter: boolean;
  regimeThreshold: number;
  adxThreshold: number;
  f1String: Feature;
  f1ParamA: number;
  f1ParamB: number;
  f2String: Feature;
  f2ParamA: number;
  f2ParamB: number;
  f3String: Feature;
  f3ParamA: number;
  f3ParamB: number;
  f4String: Feature;
  f4ParamA: number;
  f4ParamB: number;
  f5String: Feature;
  f5ParamA: number;
  f5ParamB: number;
  useEmaFilter: boolean;
  emaPeriod: number;
  useSmaFilter: boolean;
  smaPeriod: number;
  /** Trade with the kernel */
  useKernelFilter: boolean;
  showKernelEstimate: boolean;
  /** Kernel colour and filter from the crossing of two kernels */
  useKernelSmoothing: boolean;
  /** Kernel lookback window */
  h: number;
  /** Kernel relative weighting */
  r: number;
  /** Kernel regression level (start bar) */
  x: number;
  /** Lag of the second kernel for the crossover detection */
  lag: number;
  showBarColors: boolean;
  showBarPredictions: boolean;
  useAtrOffset: boolean;
  barPredictionsOffset: number;
  useConfidenceGradient: boolean;
  barColorScheme: 'Default' | 'Solid';
}

export const defaultInputs: LorentzianClassificationInputs = {
  source: 'close',
  neighborsCount: 8,
  maxBarsBack: 2000,
  featureCount: 5,
  colorCompression: 1,
  showExits: false,
  useDynamicExits: false,
  showTradeStats: true,
  useWorstCase: false,
  includeFullHistory: false,
  useVolatilityFilter: true,
  useRegimeFilter: true,
  useAdxFilter: false,
  regimeThreshold: -0.1,
  adxThreshold: 20,
  f1String: 'RSI',
  f1ParamA: 14,
  f1ParamB: 1,
  f2String: 'WT',
  f2ParamA: 10,
  f2ParamB: 11,
  f3String: 'CCI',
  f3ParamA: 20,
  f3ParamB: 1,
  f4String: 'ADX',
  f4ParamA: 20,
  f4ParamB: 2,
  f5String: 'RSI',
  f5ParamA: 9,
  f5ParamB: 1,
  useEmaFilter: false,
  emaPeriod: 200,
  useSmaFilter: false,
  smaPeriod: 200,
  useKernelFilter: true,
  showKernelEstimate: true,
  useKernelSmoothing: false,
  h: 8,
  r: 8.0,
  x: 25,
  lag: 2,
  showBarColors: true,
  showBarPredictions: true,
  useAtrOffset: true,
  barPredictionsOffset: 0,
  useConfidenceGradient: true,
  barColorScheme: 'Default',
};

const G_GENERAL = 'General Settings';
const G_FEATURES = 'Feature Engineering';
const G_FILTERS = 'Filters';
const G_KERNEL = 'Kernel Settings';
const G_DISPLAY = 'Display Settings';
const FEATURES = ['RSI', 'WT', 'CCI', 'ADX'];

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'close', group: G_GENERAL, tooltip: 'Source of the input data' },
  { id: 'neighborsCount', type: 'int', title: 'Neighbors Count', defval: 8, min: 1, max: 100, step: 1, group: G_GENERAL, tooltip: 'Number of neighbors to consider' },
  { id: 'maxBarsBack', type: 'int', title: 'Max Bars Back', defval: 2000, group: G_GENERAL },
  { id: 'featureCount', type: 'int', title: 'Feature Count', defval: 5, min: 2, max: 5, group: G_FEATURES, tooltip: 'Number of features to use for ML predictions.' },
  { id: 'colorCompression', type: 'int', title: 'Color Compression', defval: 1, min: 1, max: 10, group: G_GENERAL, tooltip: 'Compression factor for adjusting the intensity of the color scale.' },
  { id: 'showExits', type: 'bool', title: 'Show Default Exits', defval: false, group: G_GENERAL, inline: 'exits', tooltip: "Default exits occur exactly 4 bars after an entry signal. This corresponds to the predefined length of a trade during the model's training process." },
  { id: 'useDynamicExits', type: 'bool', title: 'Use Dynamic Exits', defval: false, group: G_GENERAL, inline: 'exits', tooltip: 'Dynamic exits attempt to let profits ride by dynamically adjusting the exit threshold based on kernel regression logic.' },
  { id: 'showTradeStats', type: 'bool', title: 'Show Trade Stats', defval: true, group: G_GENERAL, tooltip: 'Displays the trade stats for a given configuration. Useful for optimizing the settings in the Feature Engineering section. This should NOT replace backtesting and should be used for calibration purposes only. Early Signal Flips represent instances where the model changes signals before 4 bars elapses; high values can indicate choppy (ranging) market conditions.' },
  { id: 'useWorstCase', type: 'bool', title: 'Use Worst Case Estimates', defval: false, group: G_GENERAL, tooltip: 'Whether to use the worst case scenario for backtesting. This option can be useful for creating a conservative estimate that is based on close prices only, thus avoiding the effects of intrabar repainting. This option assumes that the user does not enter when the signal first appears and instead waits for the bar to close as confirmation. On larger timeframes, this can mean entering after a large move has already occurred. Leaving this option disabled is generally better for those that use this indicator as a source of confluence and prefer estimates that demonstrate discretionary mid-bar entries. Leaving this option enabled may be more consistent with traditional backtesting results.' },
  { id: 'includeFullHistory', type: 'bool', title: 'Include Full History', defval: false, group: G_GENERAL, tooltip: "Extends back to the beginning of the chart's history to pick up exotic fractals for training a model. This can be useful for finding rare but significant historical patterns that might not appear in the recent price action. It can provide valuable insights by capturing patterns from different market regimes throughout the chart's history." },
  { id: 'useVolatilityFilter', type: 'bool', title: 'Use Volatility Filter', defval: true, group: G_FILTERS, tooltip: 'Whether to use the volatility filter.' },
  { id: 'useRegimeFilter', type: 'bool', title: 'Use Regime Filter', defval: true, group: G_FILTERS, inline: 'regime' },
  { id: 'useAdxFilter', type: 'bool', title: 'Use ADX Filter', defval: false, group: G_FILTERS, inline: 'adx' },
  { id: 'regimeThreshold', type: 'float', title: 'Threshold', defval: -0.1, min: -10, max: 10, step: 0.1, group: G_FILTERS, inline: 'regime', tooltip: 'Whether to use the trend detection filter. Threshold for detecting Trending/Ranging markets.' },
  { id: 'adxThreshold', type: 'int', title: 'Threshold', defval: 20, min: 0, max: 100, step: 1, group: G_FILTERS, inline: 'adx', tooltip: 'Whether to use the ADX filter. Threshold for detecting Trending/Ranging markets.' },
  { id: 'f1String', type: 'string', title: 'Feature 1', defval: 'RSI', options: FEATURES, group: G_FEATURES, inline: '01', tooltip: 'The first feature to use for ML predictions.' },
  { id: 'f1ParamA', type: 'int', title: 'Parameter A', defval: 14, group: G_FEATURES, inline: '02', tooltip: 'The primary parameter of feature 1.' },
  { id: 'f1ParamB', type: 'int', title: 'Parameter B', defval: 1, group: G_FEATURES, inline: '02', tooltip: 'The secondary parameter of feature 2 (if applicable).' },
  { id: 'f2String', type: 'string', title: 'Feature 2', defval: 'WT', options: FEATURES, group: G_FEATURES, inline: '03', tooltip: 'The second feature to use for ML predictions.' },
  { id: 'f2ParamA', type: 'int', title: 'Parameter A', defval: 10, group: G_FEATURES, inline: '04', tooltip: 'The primary parameter of feature 2.' },
  { id: 'f2ParamB', type: 'int', title: 'Parameter B', defval: 11, group: G_FEATURES, inline: '04', tooltip: 'The secondary parameter of feature 2 (if applicable).' },
  { id: 'f3String', type: 'string', title: 'Feature 3', defval: 'CCI', options: FEATURES, group: G_FEATURES, inline: '05', tooltip: 'The third feature to use for ML predictions.' },
  { id: 'f3ParamA', type: 'int', title: 'Parameter A', defval: 20, group: G_FEATURES, inline: '06', tooltip: 'The primary parameter of feature 3.' },
  { id: 'f3ParamB', type: 'int', title: 'Parameter B', defval: 1, group: G_FEATURES, inline: '06', tooltip: 'The secondary parameter of feature 3 (if applicable).' },
  { id: 'f4String', type: 'string', title: 'Feature 4', defval: 'ADX', options: FEATURES, group: G_FEATURES, inline: '07', tooltip: 'The fourth feature to use for ML predictions.' },
  { id: 'f4ParamA', type: 'int', title: 'Parameter A', defval: 20, group: G_FEATURES, inline: '08', tooltip: 'The primary parameter of feature 4.' },
  { id: 'f4ParamB', type: 'int', title: 'Parameter B', defval: 2, group: G_FEATURES, inline: '08', tooltip: 'The secondary parameter of feature 4 (if applicable).' },
  { id: 'f5String', type: 'string', title: 'Feature 5', defval: 'RSI', options: FEATURES, group: G_FEATURES, inline: '09', tooltip: 'The fifth feature to use for ML predictions.' },
  { id: 'f5ParamA', type: 'int', title: 'Parameter A', defval: 9, group: G_FEATURES, inline: '10', tooltip: 'The primary parameter of feature 5.' },
  { id: 'f5ParamB', type: 'int', title: 'Parameter B', defval: 1, group: G_FEATURES, inline: '10', tooltip: 'The secondary parameter of feature 5 (if applicable).' },
  { id: 'useEmaFilter', type: 'bool', title: 'Use EMA Filter', defval: false, group: G_FILTERS, inline: 'ema' },
  { id: 'emaPeriod', type: 'int', title: 'Period', defval: 200, min: 1, step: 1, group: G_FILTERS, inline: 'ema', tooltip: 'The period of the EMA used for the EMA Filter.' },
  { id: 'useSmaFilter', type: 'bool', title: 'Use SMA Filter', defval: false, group: G_FILTERS, inline: 'sma' },
  { id: 'smaPeriod', type: 'int', title: 'Period', defval: 200, min: 1, step: 1, group: G_FILTERS, inline: 'sma', tooltip: 'The period of the SMA used for the SMA Filter.' },
  { id: 'useKernelFilter', type: 'bool', title: 'Trade with Kernel', defval: true, group: G_KERNEL, inline: 'kernel' },
  { id: 'showKernelEstimate', type: 'bool', title: 'Show Kernel Estimate', defval: true, group: G_KERNEL, inline: 'kernel' },
  { id: 'useKernelSmoothing', type: 'bool', title: 'Enhance Kernel Smoothing', defval: false, group: G_KERNEL, inline: '1', tooltip: 'Uses a crossover based mechanism to smoothen kernel color changes. This often results in less color transitions overall and may result in more ML entry signals being generated.' },
  { id: 'h', type: 'int', title: 'Lookback Window', defval: 8, min: 3, group: G_KERNEL, inline: 'kernel', tooltip: 'The number of bars used for the estimation. This is a sliding value that represents the most recent historical bars. Recommended range: 3-50' },
  { id: 'r', type: 'float', title: 'Relative Weighting', defval: 8.0, step: 0.25, group: G_KERNEL, inline: 'kernel', tooltip: 'Relative weighting of time frames. As this value approaches zero, the longer time frames will exert more influence on the estimation. As this value approaches infinity, the behavior of the Rational Quadratic Kernel will become identical to the Gaussian kernel. Recommended range: 0.25-25' },
  { id: 'x', type: 'int', title: 'Regression Level', defval: 25, group: G_KERNEL, inline: 'kernel', tooltip: 'Bar index on which to start regression. Controls how tightly fit the kernel estimate is to the data. Smaller values are a tighter fit. Larger values are a looser fit. Recommended range: 2-25' },
  { id: 'lag', type: 'int', title: 'Lag', defval: 2, group: G_KERNEL, inline: '1', tooltip: 'Lag for crossover detection. Lower values result in earlier crossovers. Recommended range: 1-2' },
  { id: 'showBarColors', type: 'bool', title: 'Show Bar Colors', defval: true, group: G_DISPLAY, tooltip: 'Whether to show the bar colors.' },
  { id: 'showBarPredictions', type: 'bool', title: 'Show Bar Prediction Values', defval: true, group: G_DISPLAY, tooltip: "Will show the ML model's evaluation of each bar as an integer." },
  { id: 'useAtrOffset', type: 'bool', title: 'Use ATR Offset', defval: true, group: G_DISPLAY, tooltip: 'Will use the ATR offset instead of the bar prediction offset.' },
  { id: 'barPredictionsOffset', type: 'float', title: 'Bar Prediction Offset', defval: 0, min: 0, group: G_DISPLAY, tooltip: 'The offset of the bar predictions as a percentage from the bar high or close.' },
  { id: 'useConfidenceGradient', type: 'bool', title: 'Use Confidence Gradient', defval: true, group: G_DISPLAY, tooltip: "When enabled, the color intensity will reflect the model's confidence level. When disabled, all signals will use the same color intensity." },
  { id: 'barColorScheme', type: 'string', title: 'Bar Color Scheme', defval: 'Default', options: ['Default', 'Solid'], group: G_DISPLAY, tooltip: "Default uses transparency-based color gradients. Solid uses an opaque tint ramp (white blended toward full color) quantized into 10 intensity steps, matching the MQL5 port's rendering for identical bar colors across platforms." },
];

const GREEN = '#009988';
const RED = '#CC3311';
const C_GREEN = String(color.new(GREEN, 20));
const C_RED = String(color.new(RED, 20));
const C_NEUTRAL = String(color.new('#787b86', 25));
const TRANSPARENT = String(color.new('#000000', 100));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Kernel Regression Estimate', color: C_GREEN, lineWidth: 2 },
  { id: 'plot1', title: 'Backtest Stream', color: '#2962FF', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Machine Learning: Lorentzian Classification',
  shortTitle: 'Lorentzian Classification v2.0',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (a == b within 1e-10); na compares false */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
/** Pine nz(): na and +-infinity give 0 */
const nz = (v: number) => (Number.isFinite(v) ? v : 0);
/** Pine bool(number): false for 0 and na */
const toBool = (v: number) => !Number.isNaN(v) && Math.abs(v) > EPS;

const LONG = 1;
const SHORT = -1;
const NEUTRAL = 0;

/** color_green / color_red of the script: ten transparency steps from the size of the prediction */
function gradientColor(base: string, prediction: number, useConfidenceGradient: boolean): string {
  const scaled = Math.min(Math.abs(prediction), 10);
  if (!useConfidenceGradient) return base;
  for (let k = 9; k >= 1; k--) {
    if (ge(scaled, k)) return k === 9 ? base : String(color.new(base, (9 - k) * 10));
  }
  return String(color.new(base, 90));
}

export function calculate(
  bars: Bar[],
  inputs: Partial<LorentzianClassificationInputs> = {},
): Omit<IndicatorResult, 'markers' | 'barColors' | 'labels' | 'tables'> & {
  markers: MarkerData[];
  barColors: BarColorData[];
  labels: LabelData[];
  tables: TableData[];
} {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  const open = bars.map((b) => b.open);
  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);
  const close = bars.map((b) => b.close);
  const hlc3 = bars.map((b) => (b.high + b.low + b.close) / 3);
  const ohlc4 = bars.map((b) => (b.open + b.high + b.low + b.close) / 4);
  const src = A(getSourceSeries(bars, cfg.source));

  // ==== Library MLExtensions ====

  // rescale(src, oldMin, oldMax, newMin, newMax)
  const rescale = (v: number, oldMin: number, oldMax: number, newMin: number, newMax: number) =>
    newMin + ((newMax - newMin) * (v - oldMin)) / Math.max(oldMax - oldMin, 10e-10);

  // normalize(src, min, max): rescales with the lowest and the highest value seen so far (one state per call)
  const normalize = (values: number[], min: number, max: number): number[] => {
    let historicMin = 10e10;
    let historicMax = -10e10;
    return values.map((v) => {
      // math.min(nz(src, _historicMin), _historicMin) / math.max(nz(src, _historicMax), _historicMax)
      historicMin = Math.min(Number.isFinite(v) ? v : historicMin, historicMin);
      historicMax = Math.max(Number.isFinite(v) ? v : historicMax, historicMax);
      return min + ((max - min) * (v - historicMin)) / Math.max(historicMax - historicMin, 10e-10);
    });
  };

  // Wilder sums of the true range and of the directional movements, then rma(dx, length): the ADX of n_adx and
  // filter_adx (nz() gives 0 for the missing previous bar)
  const adxOf = (hi: number[], lo: number[], cl: number[], length: number): number[] => {
    const dx: number[] = new Array(n);
    let trSmooth = 0;
    let plusSmooth = 0;
    let minusSmooth = 0;
    for (let i = 0; i < n; i++) {
      const pc = i > 0 ? nz(cl[i - 1]) : 0;
      const ph = i > 0 ? nz(hi[i - 1]) : 0;
      const pl = i > 0 ? nz(lo[i - 1]) : 0;
      const tr = Math.max(Math.max(hi[i] - lo[i], Math.abs(hi[i] - pc)), Math.abs(lo[i] - pc));
      const up = hi[i] - ph;
      const down = pl - lo[i];
      const dmPlus = gt(up, down) ? Math.max(up, 0) : 0;
      const dmMinus = gt(down, up) ? Math.max(down, 0) : 0;
      trSmooth = nz(trSmooth) - nz(trSmooth) / length + tr;
      plusSmooth = nz(plusSmooth) - nz(plusSmooth) / length + dmPlus;
      minusSmooth = nz(minusSmooth) - nz(minusSmooth) / length + dmMinus;
      const diPositive = (plusSmooth / trSmooth) * 100;
      const diNegative = (minusSmooth / trSmooth) * 100;
      dx[i] = (Math.abs(diPositive - diNegative) / (diPositive + diNegative)) * 100;
    }
    return A(ta.rma(S(dx), length));
  };

  // series_from(feature_string, close, high, low, hlc3, paramA, paramB)
  const seriesFrom = (feature: Feature, paramA: number, paramB: number): number[] => {
    switch (feature) {
      case 'RSI': // n_rsi
        return A(ta.ema(ta.rsi(S(close), paramA), paramB)).map((v) => rescale(v, 0, 100, 0, 1));
      case 'WT': { // n_wt
        const ema1 = A(ta.ema(S(hlc3), paramA));
        const ema2 = A(ta.ema(S(hlc3.map((v, i) => Math.abs(v - ema1[i]))), paramA));
        const ci = hlc3.map((v, i) => (v - ema1[i]) / (0.015 * ema2[i]));
        const wt1 = A(ta.ema(S(ci), paramB));
        const wt2 = A(ta.sma(S(wt1), 4));
        return normalize(wt1.map((v, i) => v - wt2[i]), 0, 1);
      }
      case 'CCI': // n_cci
        return normalize(A(ta.ema(ta.cci(S(close), paramA), paramB)), 0, 1);
      case 'ADX': // n_adx
        return adxOf(high, low, close, paramA).map((v) => rescale(v, 0, 100, 0, 1));
      default:
        return new Array(n).fill(NaN);
    }
  };

  // filter_volatility(1, 10, useVolatilityFilter)
  const recentAtr = A(ta.atr(bars, 1));
  const historicalAtr = A(ta.atr(bars, 10));
  const filterVolatility = (i: number) => (cfg.useVolatilityFilter ? gt(recentAtr[i], historicalAtr[i]) : true);

  // regime_filter(ohlc4, threshold, useRegimeFilter)
  const absCurveSlope: number[] = new Array(n);
  {
    let value1 = NaN;
    let value2 = NaN;
    let klmf = NaN;
    for (let i = 0; i < n; i++) {
      value1 = 0.2 * (ohlc4[i] - (i > 0 ? ohlc4[i - 1] : NaN)) + 0.8 * nz(value1);
      value2 = 0.1 * (high[i] - low[i]) + 0.8 * nz(value2);
      const omega = Math.abs(value1 / value2);
      const alpha = (-math.pow(omega, 2) + Math.sqrt(math.pow(omega, 4) + 16 * math.pow(omega, 2))) / 8;
      const prev = klmf;
      klmf = alpha * ohlc4[i] + (1 - alpha) * nz(prev);
      absCurveSlope[i] = Math.abs(klmf - prev);
    }
  }
  const slopeEma = A(ta.ema(S(absCurveSlope), 200));
  const filterRegime = (i: number) => {
    if (!cfg.useRegimeFilter) return true;
    const exponentialAverage = 1.0 * slopeEma[i];
    return ge((absCurveSlope[i] - exponentialAverage) / exponentialAverage, cfg.regimeThreshold);
  };

  // filter_adx(source, 14, adxThreshold, useAdxFilter)
  const filterAdxValue = adxOf(high, low, src, 14);
  const filterAdx = (i: number) => (cfg.useAdxFilter ? gt(filterAdxValue[i], cfg.adxThreshold) : true);

  // ==== Library KernelFunctions ====

  // rationalQuadratic / gaussian: a weighted mean of src[0 .. 1 + startAtBar]; na until all these bars exist
  const kernel = (weight: (i: number) => number, startAtBar: number): number[] => {
    const last = 1 + startAtBar; // _size + startAtBar, _size = array.size(array.from(_src)) = 1
    if (last < 0) throw new Error('Negative history offset in the kernel loop (Regression Level below -1)');
    const weights: number[] = [];
    for (let i = 0; i <= last; i++) weights.push(weight(i));
    return src.map((_, bar) => {
      let currentWeight = 0;
      let cumulativeWeight = 0;
      for (let i = 0; i <= last; i++) {
        const y = bar - i >= 0 ? src[bar - i] : NaN;
        currentWeight += y * weights[i];
        cumulativeWeight += weights[i];
      }
      return currentWeight / cumulativeWeight;
    });
  };
  const yhat1 = kernel(
    (i) => math.pow(1 + math.pow(i, 2) / (math.pow(cfg.h, 2) * 2 * cfg.r), -cfg.r),
    cfg.x,
  );
  const yhat2 = kernel((i) => math.exp(-math.pow(i, 2) / (2 * math.pow(cfg.h - cfg.lag, 2))), cfg.x);

  // ==== Features and training labels ====

  const f1 = seriesFrom(cfg.f1String, cfg.f1ParamA, cfg.f1ParamB);
  const f2 = seriesFrom(cfg.f2String, cfg.f2ParamA, cfg.f2ParamB);
  const f3 = seriesFrom(cfg.f3String, cfg.f3ParamA, cfg.f3ParamB);
  const f4 = seriesFrom(cfg.f4String, cfg.f4ParamA, cfg.f4ParamB);
  const f5 = seriesFrom(cfg.f5String, cfg.f5ParamA, cfg.f5ParamB);

  // y_train_series = src[4] < src[0] ? short : src[4] > src[0] ? long : neutral
  const yTrain = src.map((v, i) => {
    const back = i >= 4 ? src[i - 4] : NaN;
    return lt(back, v) ? SHORT : gt(back, v) ? LONG : NEUTRAL;
  });

  const lastBarIndex = n - 1;
  const maxBarsBackIndex = lastBarIndex >= cfg.maxBarsBack ? lastBarIndex - cfg.maxBarsBack : 0;
  const featureCount = cfg.featureCount;
  const neighborsCount = cfg.neighborsCount;
  // math.round(settings.neighborsCount * 3 / 4)
  const quartileIndex = math.round((neighborsCount * 3) / 4);

  // get_lorentzian_distance(i, featureCount, featureSeries, featureArrays) on bar `bar`; the arrays hold the
  // bars 0 .. bar. A negative index counts from the end of the array, as Pine array.get
  const distanceAt = (bar: number, i: number): number => {
    const size = bar + 1;
    const j = i < 0 ? size + i : i;
    if (j < 0 || j >= size) throw new Error(`Index ${i} is out of bounds, array size is ${size}`);
    switch (featureCount) {
      case 5:
        return math.log(1 + Math.abs(f1[bar] - f1[j])) + math.log(1 + Math.abs(f2[bar] - f2[j])) +
          math.log(1 + Math.abs(f3[bar] - f3[j])) + math.log(1 + Math.abs(f4[bar] - f4[j])) +
          math.log(1 + Math.abs(f5[bar] - f5[j]));
      case 4:
        return math.log(1 + Math.abs(f1[bar] - f1[j])) + math.log(1 + Math.abs(f2[bar] - f2[j])) +
          math.log(1 + Math.abs(f3[bar] - f3[j])) + math.log(1 + Math.abs(f4[bar] - f4[j]));
      case 3:
        return math.log(1 + Math.abs(f1[bar] - f1[j])) + math.log(1 + Math.abs(f2[bar] - f2[j])) +
          math.log(1 + Math.abs(f3[bar] - f3[j]));
      case 2:
        return math.log(1 + Math.abs(f1[bar] - f1[j])) + math.log(1 + Math.abs(f2[bar] - f2[j]));
      default:
        return NaN;
    }
  };

  // ==== Core ML logic ====

  // var arrays: they keep their content from bar to bar
  const predictions: number[] = [];
  const distances: number[] = [];
  let predictionVar = 0;
  const prediction: number[] = new Array(n);
  const startIndex = cfg.includeFullHistory ? 0 : maxBarsBackIndex;
  for (let bar = 0; bar < n; bar++) {
    let lastDistance = -1.0;
    const size = Math.min(cfg.maxBarsBack - 1, bar); // array.size(y_train_array) - 1 = bar
    const sizeLoop = Math.min(cfg.maxBarsBack - 1, size);
    if (bar >= maxBarsBackIndex) {
      // for i = startIndex to sizeLoop: counts down when startIndex > sizeLoop
      const step = startIndex <= sizeLoop ? 1 : -1;
      for (let i = startIndex; step > 0 ? i <= sizeLoop : i >= sizeLoop; i += step) {
        const d = distanceAt(bar, i);
        if (ge(d, lastDistance) && i % 4 !== 0) {
          lastDistance = d;
          distances.push(d);
          const j = i < 0 ? bar + 1 + i : i;
          predictions.push(math.round(yTrain[j]));
          if (predictions.length > neighborsCount) {
            if (quartileIndex >= distances.length) {
              throw new Error(`Index ${quartileIndex} is out of bounds, array size is ${distances.length}`);
            }
            lastDistance = distances[quartileIndex];
            distances.shift();
            predictions.shift();
          }
        }
      }
      predictionVar = array.sum(predictions);
    }
    prediction[bar] = predictionVar;
  }

  // ==== Prediction filters, signal, kernel ====

  const emaLine = cfg.useEmaFilter ? A(ta.ema(S(close), cfg.emaPeriod)) : null;
  const smaLine = cfg.useSmaFilter ? A(ta.sma(S(close), cfg.smaPeriod)) : null;
  const isEmaUptrend = close.map((c, i) => (emaLine ? gt(c, emaLine[i]) : true));
  const isEmaDowntrend = close.map((c, i) => (emaLine ? lt(c, emaLine[i]) : true));
  const isSmaUptrend = close.map((c, i) => (smaLine ? gt(c, smaLine[i]) : true));
  const isSmaDowntrend = close.map((c, i) => (smaLine ? lt(c, smaLine[i]) : true));

  const crossOver = A(ta.crossover(S(yhat2), S(yhat1)));
  const crossUnder = A(ta.crossunder(S(yhat2), S(yhat1)));

  const signal: number[] = new Array(n);
  const barsHeld: number[] = new Array(n);
  const isNewBuySignal: boolean[] = new Array(n);
  const isNewSellSignal: boolean[] = new Array(n);
  const isEarlySignalFlip: boolean[] = new Array(n);
  const isLastSignalBuy: boolean[] = new Array(n);
  const isLastSignalSell: boolean[] = new Array(n);
  const isBullishRate: boolean[] = new Array(n);
  const isBearishChange: boolean[] = new Array(n);
  const isBullishChange: boolean[] = new Array(n);
  const isBullishSmooth: boolean[] = new Array(n);
  const alertBullish: boolean[] = new Array(n);
  const alertBearish: boolean[] = new Array(n);
  const startLongTrade: boolean[] = new Array(n);
  const startShortTrade: boolean[] = new Array(n);
  let held = 0; // var int barsHeld = 0
  const at = (a: number[], i: number) => (i >= 0 ? a[i] : NaN);
  for (let i = 0; i < n; i++) {
    const filterAll = filterVolatility(i) && filterRegime(i) && filterAdx(i);
    const p = prediction[i];
    signal[i] = gt(p, 0) && filterAll ? LONG : lt(p, 0) && filterAll ? SHORT : nz(at(signal, i - 1));

    // ta.change(signal), ta.change(signal[1]), ta.change(signal[2]), ta.change(signal[3])
    const change = (k: number) => at(signal, i - k) - at(signal, i - k - 1);
    const signalChange = change(0);
    held = toBool(signalChange) ? 0 : held + 1;
    barsHeld[i] = held;
    isEarlySignalFlip[i] = toBool(signalChange) && (toBool(change(1)) || toBool(change(2)) || toBool(change(3)));
    const isBuySignal = eq(signal[i], LONG) && isEmaUptrend[i] && isSmaUptrend[i];
    const isSellSignal = eq(signal[i], SHORT) && isEmaDowntrend[i] && isSmaDowntrend[i];
    // History of a bool before the first bars is false (Pine v6)
    isLastSignalBuy[i] = i >= 4 && eq(signal[i - 4], LONG) && isEmaUptrend[i - 4] && isSmaUptrend[i - 4];
    isLastSignalSell[i] = i >= 4 && eq(signal[i - 4], SHORT) && isEmaDowntrend[i - 4] && isSmaDowntrend[i - 4];
    isNewBuySignal[i] = isBuySignal && toBool(signalChange);
    isNewSellSignal[i] = isSellSignal && toBool(signalChange);

    // Kernel rates of change
    const y0 = yhat1[i];
    const y1 = at(yhat1, i - 1);
    const y2 = at(yhat1, i - 2);
    const wasBearishRate = gt(y2, y1);
    const wasBullishRate = lt(y2, y1);
    const isBearishRate = gt(y1, y0);
    isBullishRate[i] = lt(y1, y0);
    isBearishChange[i] = isBearishRate && wasBullishRate;
    isBullishChange[i] = isBullishRate[i] && wasBearishRate;
    isBullishSmooth[i] = ge(yhat2[i], yhat1[i]);
    const isBearishSmooth = le(yhat2[i], yhat1[i]);
    alertBullish[i] = cfg.useKernelSmoothing ? crossOver[i] === 1 : isBullishChange[i];
    alertBearish[i] = cfg.useKernelSmoothing ? crossUnder[i] === 1 : isBearishChange[i];
    const isBullish = cfg.useKernelFilter ? (cfg.useKernelSmoothing ? isBullishSmooth[i] : isBullishRate[i]) : true;
    const isBearish = cfg.useKernelFilter ? (cfg.useKernelSmoothing ? isBearishSmooth : isBearishRate) : true;

    startLongTrade[i] = isNewBuySignal[i] && isBullish && isEmaUptrend[i] && isSmaUptrend[i];
    startShortTrade[i] = isNewSellSignal[i] && isBearish && isEmaDowntrend[i] && isSmaDowntrend[i];
  }

  // ==== Exits ====

  const since = (cond: boolean[]) => A(ta.barssince(S(cond.map((c) => (c ? 1 : 0)))));
  const barsSinceRedEntry = since(startShortTrade);
  const barsSinceRedExit = since(alertBullish);
  const barsSinceGreenEntry = since(startLongTrade);
  const barsSinceGreenExit = since(alertBearish);
  const isValidShortExit = barsSinceRedExit.map((v, i) => gt(v, barsSinceRedEntry[i]));
  const isValidLongExit = barsSinceGreenExit.map((v, i) => gt(v, barsSinceGreenEntry[i]));
  const isDynamicExitValid = !cfg.useEmaFilter && !cfg.useSmaFilter && !cfg.useKernelSmoothing;
  const endLongTrade: boolean[] = new Array(n);
  const endShortTrade: boolean[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const isHeldFourBars = barsHeld[i] === 4;
    const isHeldLessThanFourBars = 0 < barsHeld[i] && barsHeld[i] < 4;
    const endLongTradeDynamic = isBearishChange[i] && i >= 1 && isValidLongExit[i - 1];
    const endShortTradeDynamic = isBullishChange[i] && i >= 1 && isValidShortExit[i - 1];
    const endLongTradeStrict =
      ((isHeldFourBars && isLastSignalBuy[i]) || (isHeldLessThanFourBars && isNewSellSignal[i] && isLastSignalBuy[i])) &&
      i >= 4 && startLongTrade[i - 4];
    const endShortTradeStrict =
      ((isHeldFourBars && isLastSignalSell[i]) || (isHeldLessThanFourBars && isNewBuySignal[i] && isLastSignalSell[i])) &&
      i >= 4 && startShortTrade[i - 4];
    endLongTrade[i] = cfg.useDynamicExits && isDynamicExitValid ? endLongTradeDynamic : endLongTradeStrict;
    endShortTrade[i] = cfg.useDynamicExits && isDynamicExitValid ? endShortTradeDynamic : endShortTradeStrict;
  }

  // ==== Outputs ====

  const greenOf = (p: number) => gradientColor(GREEN, p, cfg.useConfidenceGradient);
  const redOf = (p: number) => gradientColor(RED, p, cfg.useConfidenceGradient);

  // plot(kernelEstimate, color = plotColor, linewidth = 2)
  const plot0 = bars.map((b, i) => {
    const colorByCross = isBullishSmooth[i] ? C_GREEN : C_RED;
    const colorByRate = isBullishRate[i] ? C_GREEN : C_RED;
    const plotColor = cfg.showKernelEstimate ? (cfg.useKernelSmoothing ? colorByCross : colorByRate) : TRANSPARENT;
    return { time: b.time, value: Number.isFinite(yhat1[i]) ? yhat1[i] : NaN, color: plotColor };
  });

  // plot(backTestStream, "Backtest Stream", display = display.none)
  const plot1 = bars.map((b, i) => ({
    time: b.time,
    value: startLongTrade[i] ? 1 : endLongTrade[i] ? 2 : startShortTrade[i] ? -1 : endShortTrade[i] ? -2 : NaN,
  }));

  // plotshape: a series with a location other than absolute is read as a bool (na and 0 draw no shape)
  const markers: MarkerData[] = [];
  const stopBuyColor = cfg.useConfidenceGradient ? C_GREEN : GREEN;
  const stopSellColor = cfg.useConfidenceGradient ? C_RED : RED;
  for (let i = 0; i < n; i++) {
    const time = bars[i].time;
    const p = prediction[i];
    if (startLongTrade[i] && toBool(low[i])) {
      markers.push({ time, position: 'belowBar', shape: 'labelUp', color: greenOf(p), size: 'small' });
    }
    if (startShortTrade[i] && toBool(high[i])) {
      markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: redOf(-p), size: 'small' });
    }
    if (endLongTrade[i] && cfg.showExits && Number.isFinite(high[i])) {
      markers.push({ time, position: 'atPriceMiddle', price: high[i], shape: 'xcross', color: stopBuyColor, size: 'tiny' });
    }
    if (endShortTrade[i] && cfg.showExits && Number.isFinite(low[i])) {
      markers.push({ time, position: 'atPriceMiddle', price: low[i], shape: 'xcross', color: stopSellColor, size: 'tiny' });
    }
  }

  // Solid bar colour palette: white blended toward the full colour, in 10 steps
  const solidColorIndex = (pred: number) => {
    const compression = Math.max(neighborsCount / cfg.colorCompression, 1.0);
    return Math.trunc(Math.min(math.round((Math.abs(pred) / compression) * 9.0), 9.0));
  };
  const solidBarColor = (pred: number): string => {
    if (gt(pred, 0)) {
      const frac = (solidColorIndex(pred) + 1) / 10.0;
      return String(color.rgb(Math.trunc(255 - frac * 255), Math.trunc(255 - frac * (255 - 153)), Math.trunc(255 - frac * (255 - 136))));
    }
    if (lt(pred, 0)) {
      const frac = (solidColorIndex(pred) + 1) / 10.0;
      return String(color.rgb(Math.trunc(255 - frac * (255 - 204)), Math.trunc(255 - frac * (255 - 51)), Math.trunc(255 - frac * (255 - 17))));
    }
    return '#787B86';
  };

  // label.new(bar_index, y_val, str.tostring(prediction), ..., color.new(color.white, 100), pos_pred, c_label,
  // size.normal, text.align_left) on every bar; max_labels_count = 500: when a creation brings the count above
  // 505 the oldest labels are deleted until 500 remain
  const MAX_LABELS = 500;
  const labelColor = String(color.new(color.white, 100));
  const atrSpaced = cfg.useAtrOffset ? A(ta.atr(bars, 1)) : null;
  let labels: Array<LabelData | null> = [];
  const barColors: BarColorData[] = [];
  for (let i = 0; i < n; i++) {
    const p = prediction[i];
    const up = gt(p, 0);
    const cPred = up ? greenOf(p) : lt(p, 0) ? redOf(-p) : C_NEUTRAL;
    if (cfg.showBarColors) {
      const cBars = cfg.barColorScheme === 'Solid'
        ? solidBarColor(p)
        : String(color.new(cPred, cfg.useConfidenceGradient ? 50 : 30));
      barColors.push({ time: bars[i].time, color: cBars });
    }
    const hl2 = (high[i] + low[i]) / 2;
    const yVal = atrSpaced
      ? (up ? high[i] + atrSpaced[i] : low[i] - atrSpaced[i])
      : (up ? high[i] + (hl2 * cfg.barPredictionsOffset) / 20 : low[i] - (hl2 * cfg.barPredictionsOffset) / 30);
    // A label with an na price is created (it counts) but not drawn
    labels.push(Number.isFinite(yVal)
      ? {
        time: bars[i].time,
        price: yVal,
        text: str.tostring(p),
        color: labelColor,
        style: up ? 'label_down' : 'label_up',
        textColor: cfg.showBarPredictions ? cPred : 'transparent',
        size: 'normal',
        textAlign: 'left',
      }
      : null);
    if (labels.length > MAX_LABELS + 5) labels = labels.slice(labels.length - MAX_LABELS);
  }

  // ==== Trade statistics (library backtest) and table ====

  const tables: TableData[] = [];
  if (cfg.showTradeStats && n > 0) {
    let startLong = NaN; // var float start_long_trade = marketPrice
    let startShort = NaN; // var float start_short_trade = marketPrice
    let wins = 0;
    let losses = 0;
    let earlySignalFlipCount = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let totalTrades = 0;
    let totalEarlySignalFlips = 0;
    for (let i = 0; i < n; i++) {
      const marketPrice = cfg.useWorstCase ? src[i] : (high[i] + low[i] + open[i] + open[i]) / 4;
      if (i === 0) {
        startLong = marketPrice;
        startShort = marketPrice;
      }
      if (i > maxBarsBackIndex) {
        wins = 0;
        losses = 0;
        earlySignalFlipCount = 0;
        if (startLongTrade[i]) {
          startShort = 0;
          earlySignalFlipCount = isEarlySignalFlip[i] ? 1 : 0;
          startLong = marketPrice;
        }
        if (endLongTrade[i]) {
          const delta = marketPrice - startLong;
          wins = gt(delta, 0) ? 1 : 0;
          losses = lt(delta, 0) ? 1 : 0;
        }
        if (startShortTrade[i]) {
          startLong = 0;
          startShort = marketPrice;
        }
        if (endShortTrade[i]) {
          earlySignalFlipCount = isEarlySignalFlip[i] ? 1 : 0;
          const delta = startShort - marketPrice;
          wins = gt(delta, 0) ? 1 : 0;
          losses = lt(delta, 0) ? 1 : 0;
        }
      }
      // ta.cum
      totalEarlySignalFlips += earlySignalFlipCount;
      totalWins += wins;
      totalLosses += losses;
      totalTrades += wins + losses;
    }

    // ml.init_table(), then update_table() of the script on the last bar
    const gray = color.gray;
    const cTransparent = String(color.new(color.black, 100));
    const cell = (column: number, row: number, text: string, bg = true): TableCell => ({
      row, column, text, textHAlign: 'center', textColor: gray, textSize: 'normal',
      ...(bg ? { bgColor: cTransparent } : {}),
    });
    tables.push({
      position: 'top_right',
      columns: 2,
      rows: 7,
      frameColor: cTransparent,
      frameWidth: 1,
      borderWidth: 1,
      borderColor: cTransparent,
      cells: [
        cell(0, 0, '📈 Trade Stats', false),
        cell(0, 1, 'Winrate'),
        cell(1, 1, str.tostring(totalWins / totalTrades, '#.#%')),
        cell(0, 2, 'Trades'),
        cell(1, 2, str.tostring(totalTrades, '#') + ' (' + str.tostring(totalWins, '#') + '|' + str.tostring(totalLosses, '#') + ')'),
        cell(0, 5, 'WL Ratio'),
        cell(1, 5, str.tostring(totalWins / totalLosses, '0.00')),
        cell(0, 6, 'Early Signal Flips'),
        cell(1, 6, str.tostring(totalEarlySignalFlips, '#')),
      ],
    });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1 },
    markers,
    barColors,
    labels: labels.filter((l): l is LabelData => l !== null),
    tables,
  };
}

export const LorentzianClassification = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
