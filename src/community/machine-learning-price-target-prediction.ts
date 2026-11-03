/**
 * Machine Learning Price Target Prediction Signals [AlgoAlpha]
 *
 * A trend signal (+1 / -1) from one of three methods: SuperTrend direction, HMA rising / falling, or a fast EMA
 * above / below a slow EMA. Each time the signal flips, the move of the previous trend (the largest run-up or
 * drawdown from the close of the flip bar, as a fraction) becomes a training target, with eight features read on
 * the bar where that trend started: RSI of the dump from the 14-bar high, RSI of the pump from the 14-bar low, two
 * volatility-change oscillators scaled over 1,000 bars, a volume oscillator (EMA 7 / EMA 14), the choppiness index,
 * the RSI of the close and the trend direction. The features of the flip bar give the query point.
 *
 * Kernel regression (RBF kernel exp(-(distance / bandwidth)^2) over the Euclidean distance of the features)
 * predicts the size of the new move. The win rate counts the flips where the realised move was larger than the
 * prediction; the recommended reward / risk ratio is 1 / win rate - 1.
 *
 * On each flip (with a prediction, when "Hide NaN Predictions" is on): a take-profit box (close to close +/- move)
 * and a stop-loss box (close to close -/+ move / ratio) start on the bar and grow until the price reaches one of
 * them or the trend flips again. A label-up marker below the stop of a bullish flip, a label-down marker above the
 * stop of a bearish flip (stop -/+ ATR 14). Bars are gray outside a trade, else in the trend colour. A table on the
 * last bar shows the training size, the predicted move, the success rate, the ratio and the trade state.
 *
 * Chart context: `chart.fg_color` (marker and table texts, table frame; #DBDBDB, the dark theme value, without a
 * context) and `chart.bg_color` (table background; #0F0F0F without a context).
 * A chart without volume throws "No volume is provided by the data vendor." (the original's runtime error).
 *
 * Reference: "Machine Learning Price Target Prediction Signals [AlgoAlpha]" by AlgoAlpha
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © AlgoAlpha
 */

import {
  ta, math, callsite, color, str, box, table, Series, resetDrawings, setDrawingBar, drawingOutputs,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type ShapeConfig, type BarColorConfig,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import type { BarColorData, MarkerData } from '../types';
import { foregroundColorOf, backgroundColorOf, type ChartContext } from '../chart-context';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';

type TrendMethod = 'SuperTrend' | 'HMA (Increasing or Decreasing)' | 'EMA Cross (Fast Slow)';

export interface MachineLearningPriceTargetPredictionInputs {
  /** Trend Indicator for Signals */
  trndMethod: TrendMethod;
  /** Hull Moving Average Length */
  MAlen_roc: number;
  /** Fast EMA Length */
  Ema_fast: number;
  /** Slow EMA Length */
  Ema_slow: number;
  /** SuperTrend Factor */
  supertrend_factor: number;
  /** ATR Length */
  atr_length: number;
  /** Kernel Regression Bandwidth */
  bandwidth: number;
  /** Hide NaN Predictions */
  hide_na_sig: boolean;
  /** Bullish Color */
  green: string;
  /** Bearish Color */
  red: string;
}

export const defaultInputs: MachineLearningPriceTargetPredictionInputs = {
  trndMethod: 'EMA Cross (Fast Slow)',
  MAlen_roc: 93,
  Ema_fast: 50,
  Ema_slow: 200,
  supertrend_factor: 3,
  atr_length: 10,
  bandwidth: 5,
  hide_na_sig: true,
  green: '#00ffbb',
  red: '#ff1100',
};

const GT = 'Trend Indicator Settings';

export const inputConfig: InputConfig[] = [
  {
    id: 'trndMethod', type: 'string', title: 'Trend Indicator for Signals', defval: 'EMA Cross (Fast Slow)', group: GT,
    options: ['SuperTrend', 'HMA (Increasing or Decreasing)', 'EMA Cross (Fast Slow)'],
    tooltip: 'Select the method used to determine trend direction',
  },
  { id: 'MAlen_roc', type: 'int', title: 'Hull Moving Average Length', defval: 93, group: GT, tooltip: 'Length of the Hull Moving Average used for trend detection' },
  { id: 'Ema_fast', type: 'int', title: 'Fast EMA Length', defval: 50, group: GT, tooltip: 'Length of the faster Exponential Moving Average' },
  { id: 'Ema_slow', type: 'int', title: 'Slow EMA Length', defval: 200, group: GT, tooltip: 'Length of the slower Exponential Moving Average' },
  { id: 'supertrend_factor', type: 'float', title: 'SuperTrend Factor', defval: 3, group: GT, tooltip: 'Multiplier for the ATR in SuperTrend calculation' },
  { id: 'atr_length', type: 'int', title: 'ATR Length', defval: 10, group: GT, tooltip: 'Length of the Average True Range used in SuperTrend' },
  {
    id: 'bandwidth', type: 'float', title: 'Kernel Regression Bandwidth', defval: 5, min: 2, group: 'Kernel Regression Settings',
    tooltip: "Controls how much weight is given to distant data points in the kernel regression. Higher values create smoother predictions but may potentially result in underfitting while smaller values give more weight to recent data points, potentially leading to overfitting if it's too small.",
  },
  {
    id: 'hide_na_sig', type: 'bool', title: 'Hide NaN Predictions', defval: true,
    tooltip: 'In some instances, the prediction might be NaN due to the input data resulting in very small results inside the internal calculations, which result in NaN predictions. This setting hides signals where there is no value for the predicted move size.',
  },
  { id: 'green', type: 'color', title: 'Bullish Color', defval: '#00ffbb', group: 'Visuals', tooltip: 'Color used for bullish signals and indicators' },
  { id: 'red', type: 'color', title: 'Bearish Color', defval: '#ff1100', group: 'Visuals', tooltip: 'Color used for bearish signals and indicators' },
];

export const plotConfig: PlotConfig[] = [];

export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Bullish Entry Signal', style: 'labelup', location: 'absolute', color: '#00ffbb', text: '▲', size: 'small' },
  { id: 'shape1', kind: 'shape', title: 'Bearish Entry Signal', style: 'labeldown', location: 'absolute', color: '#ff1100', text: '▼', size: 'small' },
];

export const barColorConfig: BarColorConfig[] = [{ id: 'barcolor0', kind: 'barcolor', title: 'Trade Status' }];

export const drawingKinds: StudyDrawingKind[] = ['box', 'table'];

export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Signal', message: 'New bullish trend signal detected' },
  { id: 'alert1', title: 'Bearish Signal', message: 'New bearish trend signal detected' },
  { id: 'alert2', title: 'Take Profit Hit', message: 'Take profit level has been reached' },
  { id: 'alert3', title: 'Stop Loss Hit', message: 'Stop loss level has been reached' },
];

export const metadata = {
  title: 'Machine Learning Price Target Prediction Signals [AlgoAlpha]',
  shortTitle: 'AlgoAlpha - ML Price Targets',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
/** Pine `==` / `!=`: within 1e-10, false with an na side (infinity counts as na) */
const eq = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= EPS;
const ne = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) > EPS;
/** Pine na(): NaN and +-infinity */
const isNa = (x: number) => !Number.isFinite(x);
const GRAY = '#787B86';

export function calculate(
  bars: Bar[],
  inputs: Partial<MachineLearningPriceTargetPredictionInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[]; alerts: AlertConditionState[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const fg = foregroundColorOf(chart);
  const bg = backgroundColorOf(chart);
  const { green, red, bandwidth } = cfg;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (values: number[]) => Series.fromArray(bars, values);
  const close = bars.map((b) => b.close);
  const highS = new Series(bars, (b) => b.high);
  const lowS = new Series(bars, (b) => b.low);
  const closeS = S(close);

  // trend signal
  const direction = A(ta.supertrend(bars, cfg.supertrend_factor, cfg.atr_length)[1]);
  const hull = A(ta.hma(closeS, cfg.MAlen_roc));
  const ema1 = A(ta.ema(closeS, cfg.Ema_fast));
  const ema2 = A(ta.ema(closeS, cfg.Ema_slow));
  const trendSignal = bars.map((_, i) => {
    switch (cfg.trndMethod) {
      case 'SuperTrend': return -direction[i];
      case 'HMA (Increasing or Decreasing)': return gt(hull[i], i > 0 ? hull[i - 1] : NaN) ? 1 : -1;
      case 'EMA Cross (Fast Slow)': return gt(ema1[i], ema2[i]) ? 1 : -1;
      default: return NaN;
    }
  });
  const trendS = S(trendSignal);

  // 1) dump from high, 2) pump from low
  const h14 = A(ta.highest(highS, 14));
  const l14 = A(ta.lowest(lowS, 14));
  const vS1 = A(ta.rsi(S(close.map((c, i) => (h14[i] - c) / h14[i])), 14));
  const vS2 = A(ta.rsi(S(close.map((c, i) => (c - l14[i]) / l14[i])), 14));
  // 3) volatility change, 4) volatility change's change
  const v3 = A(ta.sma(new Series(bars, (b) => b.high - b.low), 40));
  const vs3 = A(ta.ema(S(v3), 20));
  const x3 = v3.map((v, i) => v - vs3[i]);
  const x3lo = A(ta.lowest(S(x3), 1000));
  const x3hi = A(ta.highest(S(x3), 1000));
  const xS3 = x3.map((x, i) => (x - x3lo[i]) / (x3hi[i] - x3lo[i]) * 100);
  const vss4 = A(ta.ema(S(x3), 10));
  const x4 = x3.map((x, i) => x - vss4[i]);
  const x4lo = A(ta.lowest(S(x4), 1000));
  const x4hi = A(ta.highest(S(x4), 1000));
  const xScaled4 = x4.map((x, i) => (x - x4lo[i]) / (x4hi[i] - x4lo[i]) * 100);
  // 5) volume oscillator
  const volS = new Series(bars, (b) => b.volume ?? NaN);
  const short5 = A(ta.ema(volS, 7));
  const long5 = A(ta.ema(volS, 14));
  const osc5 = short5.map((s, i) => 100 * (s - long5[i]) / long5[i]);
  // 6) choppiness index
  const atrSum = A(math.sum(ta.atr(bars, 1), 14));
  const ci6 = atrSum.map((s, i) => 100 * Math.log10(s / (h14[i] - l14[i])) / Math.log10(14));
  // 7) RSI
  const rsi7 = A(ta.rsi(closeS, 14));
  // 8) trend direction
  const scaledTrend = trendSignal.map((t) => (eq(t, 1) ? 1 : eq(t, -1) ? 0 : NaN));

  const crossed = A(ta.cross(trendS, 0)).map((v) => v === 1);
  const crossUp = A(ta.crossover(trendS, 0)).map((v) => v === 1);
  const crossDn = A(ta.crossunder(trendS, 0)).map((v) => v === 1);
  const duration = A(ta.barssince(S(crossed.map((c) => (c ? 1 : 0)))));
  const volatility = A(ta.atr(bars, 14));

  const runupSite = callsite.highest();
  const drawdownSite = callsite.lowest();

  // indicator(max_boxes_count = 500)
  resetDrawings({ box: 500 });

  const target: number[] = [];
  const features: number[][] = [[], [], [], [], [], [], [], []];
  let current: number[] = [];
  const featureSeries = [vS1, vS2, xS3, xScaled4, osc5, ci6, rsi7, scaledTrend];
  const absoluteMove = new Array<number>(n).fill(NaN);
  const predictedMove = new Array<number>(n).fill(NaN);
  let totalPredictions = 0;
  let correctPredictions = 0;
  let tp: ReturnType<typeof box.new>[] = [];
  let sl: ReturnType<typeof box.new>[] = [];
  let inTrade = 0;
  let tpHit = false;
  let slHit = false;
  let cumVol = 0;
  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];
  const flags: boolean[][] = [[], [], [], []];
  const at = (arr: number[], k: number) => (k >= 0 && k < n ? arr[k] : NaN);

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const ts = trendSignal[i];
    const ts1 = at(trendSignal, i - 1);
    cumVol += Number.isFinite(b.volume ?? NaN) ? (b.volume as number) : 0;
    if (i === n - 1 && eq(cumVol, 0)) throw new Error('No volume is provided by the data vendor.');

    // training logic: close[duration] (close[na] is the close of the bar)
    const dur = duration[i];
    const d = Number.isNaN(dur) ? 0 : dur;
    const ref = at(close, i - d);
    const signalMoveUp = (b.high - ref) / ref;
    const signalMoveDown = (b.low - ref) / ref;
    const len = Math.max(1, d);
    const runup = runupSite(signalMoveUp, len);
    const drawdown = drawdownSite(signalMoveDown, len);
    absoluteMove[i] = Math.abs(gt(ts, 0) ? runup : drawdown);

    // look_back = duration[1] + 1 (na: x[na] reads the bar itself)
    const dur1 = at(duration, i - 1);
    const lookBack = Number.isNaN(dur1) ? 0 : dur1 + 1;
    const am1 = at(absoluteMove, i - 1);
    if (crossed[i] && (ne(ts1, 0) || !isNa(ts1))) {
      const past = featureSeries.map((f) => at(f, i - lookBack));
      if (!(isNa(am1) || past.slice(0, 7).some(isNa))) {
        target.unshift(am1);
        past.forEach((v, k) => features[k].unshift(v));
      }
    }
    if (crossed[i]) current = featureSeries.map((f) => f[i]);

    // kernel regression
    let sumWeightedTargets = 0;
    let sumKernels = 0;
    for (let k = 0; k < target.length; k++) {
      let distSq = 0;
      for (let f = 0; f < 8; f++) distSq += Math.pow(features[f][k] - current[f], 2);
      const kernelValue = Math.exp(-Math.pow(Math.sqrt(distSq) / bandwidth, 2));
      sumWeightedTargets += kernelValue * target[k];
      sumKernels += kernelValue;
    }
    const pm = ne(sumKernels, 0) ? sumWeightedTargets / sumKernels : NaN;
    predictedMove[i] = pm;

    const pm1 = at(predictedMove, i - 1);
    if (crossed[i] && !isNa(pm1)) {
      totalPredictions += 1;
      if (gt(am1, pm1)) correctPredictions += 1;
    }
    const winRate = correctPredictions / totalPredictions;
    const recommendedRR = 1 / winRate - 1;
    const tpLevel = gt(ts, 0) ? b.close + b.close * pm : b.close - b.close * pm;
    const slLevel = gt(ts, 0) ? b.close - b.close * pm / recommendedRR : b.close + b.close * pm / recommendedRR;
    const show = cfg.hide_na_sig ? !isNa(pm) : true;

    if (crossed[i] && show) {
      tp = [];
      sl = [];
      tp.unshift(box.new(i, Math.max(b.close, tpLevel), i + 1, Math.min(b.close, tpLevel), String(color.new(green, 100)),
        undefined, undefined, undefined, undefined, String(color.new(green, 80)), undefined, undefined, undefined, undefined,
        undefined, undefined, undefined, true));
      sl.unshift(box.new(i, Math.max(b.close, slLevel), i + 1, Math.min(b.close, slLevel), String(color.new(red, 100)),
        undefined, undefined, undefined, undefined, String(color.new(red, 80)), undefined, undefined, undefined, undefined,
        undefined, undefined, undefined, true));
      inTrade = 1;
    }

    const isNotFirst = eq(ts, ts1);
    if (tp.length > 0) {
      const upper = box.get_top(tp[0]);
      const lower = box.get_bottom(tp[0]);
      if ((gt(ts, 0) && lt(b.high, upper)) || (lt(ts, 0) && gt(b.low, lower)) || !isNotFirst) {
        box.set_right(tp[0], i);
      } else {
        tpHit = true;
        box.set_right(tp[0], i);
        box.set_right(sl[0], i);
        tp.shift();
        sl.shift();
        inTrade = 0;
      }
    }
    if (sl.length > 0) {
      const upper = box.get_top(sl[0]);
      const lower = box.get_bottom(sl[0]);
      if ((gt(ts, 0) && gt(b.low, lower)) || (lt(ts, 0) && lt(b.high, upper)) || !isNotFirst) {
        box.set_right(sl[0], i);
      } else {
        slHit = true;
        box.set_right(sl[0], i);
        tp.shift();
        sl.shift();
        inTrade = 0;
      }
    }

    barColors.push({ id: 'barcolor0', time: b.time, color: inTrade === 0 ? GRAY : gt(ts, 0) ? green : red });

    const bull = crossUp[i] && show ? slLevel - volatility[i] : NaN;
    if (Number.isFinite(bull)) {
      markers.push({ id: 'shape0', time: b.time, position: 'atPriceBottom', price: bull, shape: 'labelUp', color: green,
        text: '▲', textColor: fg, size: 'small' });
    }
    const bear = crossDn[i] && show ? slLevel + volatility[i] : NaN;
    if (Number.isFinite(bear)) {
      markers.push({ id: 'shape1', time: b.time, position: 'atPriceTop', price: bear, shape: 'labelDown', color: red,
        text: '▼', textColor: fg, size: 'small' });
    }

    if (i === n - 1) {
      const t = table.new('top_right', 2, 6, bg, fg, 1, fg, 1);
      const cell = (c: number, r: number, text: string, align: 'left' | 'center', cellBg?: string) =>
        table.cell(t, c, r, text, undefined, undefined, fg, align, undefined, 'tiny', cellBg);
      cell(0, 0, 'Indicator Metrics', 'center');
      cell(1, 0, 'Value', 'center');
      cell(0, 1, 'Training Data Size', 'left');
      cell(1, 1, str.tostring(target.length), 'center');
      cell(0, 2, 'Predicted Move Size', 'left');
      cell(1, 2, str.format('{0,number,#.##}%', pm * 100), 'center');
      cell(0, 3, 'Success Rate (When price moves \nmore or equal to predicted amount)', 'left');
      cell(1, 3, str.format('{0,number,#.##}%', winRate * 100), 'center');
      cell(0, 4, 'Recommended Reward/Risk Ratio', 'left');
      cell(1, 4, str.format('{0,number,#.##}', recommendedRR), 'center');
      cell(0, 5, 'In Trade', 'left');
      cell(1, 5, inTrade !== 0 ? 'Yes' : 'No', 'center',
        inTrade === 0 ? GRAY : gt(ts, 0) ? String(color.new(green, 70)) : String(color.new(red, 70)));
    }

    flags[0].push(crossUp[i]);
    flags[1].push(crossDn[i]);
    flags[2].push(tpHit);
    flags[3].push(slHit);
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    barColors,
    alerts: alertStates(alertConditions, bars, flags),
    ...drawingOutputs(bars),
  };
}

export const MachineLearningPriceTargetPrediction = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, shapeConfig, barColorConfig, drawingKinds, alertConditions,
};
