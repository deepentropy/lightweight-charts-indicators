/**
 * Machine Learning Momentum Index (MLMI) [Zeiierman]
 *
 * Two momentum features: rsi_slow = WMA(RSI(close, 20), Trend Length) and rsi_quick = WMA(RSI(close, 5), Trend
 * Length). On each cross of WMA(close, 5) with WMA(close, 20) the features and the close are stored with the result
 * of the move since the previous stored trade (+1 when the close is >= the previous stored close, else -1; the
 * stores start with one point (0, 0) of result 0). The prediction on each bar is the k-nearest-neighbours vote: the
 * sum of the results of the stored points whose distance to the current features is within the k-th smallest
 * distance. Plotted with its WMA (20). A channel from the highest / lowest prediction over 2000 bars gives gradient
 * fills from zero to the channel and overbought / oversold gradient fills of the prediction (edges at the channel
 * minus / plus EMA(20) of the 20-bar standard deviation of the prediction).
 *
 * Alerts (alertcondition, `alerts` of the result): the prediction crossing over / under the overbought edge, the
 * oversold edge, zero and its WMA.
 *
 * Reference: "Machine Learning Momentum Index (MLMI) [Zeiierman]" by Zeiierman
 * Licence: Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0), as the original Pine script
 * (https://creativecommons.org/licenses/by-nc-sa/4.0/).
 * Original notice: © Zeiierman
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type FillData } from 'oakscriptjs';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MlMomentumIndexInputs {
  /** Prediction Data (k): number of neighbours */
  k: number;
  /** Trend Length: WMA length of the two RSIs */
  momentumWindow: number;
}

export const defaultInputs: MlMomentumIndexInputs = {
  k: 200,
  momentumWindow: 20,
};

const T1 = 'This parameter controls the number of neighbors to consider while making a prediction using the k-Nearest Neighbors (k-NN) algorithm. By modifying the value of k, you can change how sensitive the prediction is to local fluctuations in the data. \n\nA smaller value of k will make the prediction more sensitive to local variations and can lead to a more erratic prediction line. \n\nA larger value of k will consider more neighbors, thus making the prediction more stable but potentially less responsive to sudden changes.';
const T2 = 'The parameter controls the length of the trend used in computing the momentum. This length refers to the number of periods over which the momentum is calculated, affecting how quickly the indicator reacts to changes in the underlying price movements. \n\nA shorter trend length (smaller momentumWindow) will make the indicator more responsive to short-term price changes, potentially generating more signals but at the risk of more false alarms. \n\nA longer trend length (larger momentumWindow) will make the indicator smoother and less responsive to short-term noise, but it may lag in reacting to significant price changes.';

export const inputConfig: InputConfig[] = [
  { id: 'k', type: 'int', title: 'Prediction Data (k)', defval: 200, tooltip: T1 },
  { id: 'momentumWindow', type: 'int', title: 'Trend Length', defval: 20, min: 10, max: 200, step: 2, tooltip: T2 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MLMI Prediction', color: '#426eff', lineWidth: 1 },
  { id: 'plot1', title: 'WMA of MLMI Prediction', color: '#31ffc8', lineWidth: 1 },
  // channel_upper / channel_lower / channel_mid: plot(..., color = na, editable = false, display = display.none)
  { id: 'plot2', title: 'Plot', color: 'transparent', lineWidth: 1, editable: false, display: 'none' },
  { id: 'plot3', title: 'Plot', color: 'transparent', lineWidth: 1, editable: false, display: 'none' },
  { id: 'plot4', title: 'Plot', color: 'transparent', lineWidth: 1, editable: false, display: 'none' },
];

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'MLMI Crossover OB', message: 'MLMI Crossover OB' },
  { id: 'alert1', title: 'MLMI Crossunder OB', message: 'MLMI Crossunder OB' },
  { id: 'alert2', title: 'MLMI Crossover OS', message: 'MLMI Crossover OS' },
  { id: 'alert3', title: 'MLMI Crossunder OS', message: 'MLMI Crossunder OS' },
  { id: 'alert4', title: 'MLMI Crossover 50', message: 'MLMI Crossover 50' },
  { id: 'alert5', title: 'MLMI Crossunder 50', message: 'MLMI Crossunder 50' },
  { id: 'alert6', title: 'MLMI Crossover Ma', message: 'MLMI Crossover Ma' },
  { id: 'alert7', title: 'MLMI Crossunder Ma', message: 'MLMI Crossunder Ma' },
];

export const metadata = {
  title: 'Machine Learning Momentum Index (MLMI) [Zeiierman]',
  shortTitle: 'Machine Learning Momentum Index (MLMI)',
  overlay: false,
};

/** Pine float comparisons (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Point = { time: number; value: number };
type Result = IndicatorResult & { alerts: AlertConditionState[] };
type Step2 = { step(a: number, b: number): boolean; commit(): void };

interface MlmiRun extends BarRunState<Record<string, never>> {
  maQuick: ReturnType<typeof taStep.wma>;
  maSlow: ReturnType<typeof taStep.wma>;
  rsi5: ReturnType<typeof taStep.rsi>;
  rsi20: ReturnType<typeof taStep.rsi>;
  wmaQuick: ReturnType<typeof taStep.wma>;
  wmaSlow: ReturnType<typeof taStep.wma>;
  pos: Step2;
  neg: Step2;
  predMa: ReturnType<typeof taStep.wma>;
  highest: ReturnType<typeof taStep.highest>;
  lowest: ReturnType<typeof taStep.lowest>;
  stdev: ReturnType<typeof taStep.stdev>;
  devEma: ReturnType<typeof taStep.ema>;
  crosses: Step2[];
  /** var data = Data.new(...): the stored trades (the first one (0, 0) of result 0) */
  p1s: number[];
  p2s: number[];
  prices: number[];
  results: number[];
  prediction: Point[];
  predictionMa: Point[];
  upper: number[];
  lower: number[];
  upperEdge: number[];
  lowerEdge: number[];
  upperData: Point[];
  lowerData: Point[];
  zeroData: Point[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<MlMomentumIndexInputs>): BarStudy<MlmiRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const k = Math.max(0, Math.trunc(cfg.k));
  return {
    init() {
      const crosses: Step2[] = Array.from({ length: 8 }, (_, j) => (j % 2 === 0 ? taStep.crossover() : taStep.crossunder()));
      const s: MlmiRun = {
        maQuick: taStep.wma(), maSlow: taStep.wma(), rsi5: taStep.rsi(5), rsi20: taStep.rsi(20), wmaQuick: taStep.wma(),
        wmaSlow: taStep.wma(), pos: taStep.crossover(), neg: taStep.crossunder(), predMa: taStep.wma(),
        highest: taStep.highest(), lowest: taStep.lowest(), stdev: taStep.stdev(), devEma: taStep.ema(20), crosses,
        p1s: [0], p2s: [0], prices: [0], results: [0],
        prediction: [], predictionMa: [], upper: [], lower: [], upperEdge: [], lowerEdge: [], upperData: [],
        lowerData: [], zeroData: [], flags: crosses.map(() => []), times: crosses.map(() => []),
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [
        s.maQuick, s.maSlow, s.rsi5, s.rsi20, s.wmaQuick, s.wmaSlow, s.pos, s.neg, s.predMa, s.highest, s.lowest,
        s.stdev, s.devEma, ...crosses,
      ];
      s.lists = [s.p1s, s.p2s, s.prices, s.results, ...s.times];
      s.series = [
        s.prediction, s.predictionMa, s.upper, s.lower, s.upperEdge, s.lowerEdge, s.upperData, s.lowerData,
        s.zeroData, ...s.flags,
      ];
      return s;
    },
    bar(s, i, bars) {
      const { time, close: c } = bars[i];
      // Moving averages & RSI
      const maQuick = s.maQuick.step(c, 5);
      const maSlow = s.maSlow.step(c, 20);
      const rsiQuick = s.wmaQuick.step(s.rsi5.step(c), cfg.momentumWindow);
      const rsiSlow = s.wmaSlow.step(s.rsi20.step(c), cfg.momentumWindow);
      const pos = s.pos.step(maQuick, maSlow);
      const neg = s.neg.step(maQuick, maSlow);
      // if pos or neg: data.storePreviousTrade(rsi_slow, rsi_quick)
      if (pos || neg) {
        const last = s.p1s.length - 1;
        s.results.push(ge(c, s.prices[last]) ? 1 : -1);
        s.p1s.push(rsiSlow);
        s.p2s.push(rsiQuick);
        s.prices.push(c);
      }
      // knnPredict(rsi_slow, rsi_quick, k): distances to all the stored points; maxDist = the greatest of the k smallest
      // (na sorted after the numbers, array.max skips na); the results of the points within maxDist are summed
      const distances = s.p1s.map((v, j) => Math.sqrt(Math.pow(rsiSlow - v, 2) + Math.pow(rsiQuick - s.p2s[j], 2)));
      const sorted = distances.filter((d) => !isNaN(d)).sort((a, b) => a - b);
      const m = Math.min(k, distances.length, sorted.length);
      const maxDist = m > 0 ? sorted[m - 1] : NaN;
      let sum = 0;
      let count = 0;
      for (let j = 0; j < distances.length; j++) {
        if (le(distances[j], maxDist)) {
          sum += s.results[j];
          count++;
        }
      }
      // neighbors.sum(): na for no neighbour
      const prediction = count ? sum : NaN;
      const predictionMa = s.predMa.step(prediction, 20);
      // Gradient fill channel
      const upper = s.highest.step(prediction, 2000);
      const lower = s.lowest.step(prediction, 2000);
      const dev = s.devEma.step(s.stdev.step(prediction, 20));
      s.prediction[i] = { time, value: prediction };
      s.predictionMa[i] = { time, value: predictionMa };
      s.upper[i] = upper;
      s.lower[i] = lower;
      s.upperEdge[i] = upper - dev;
      s.lowerEdge[i] = lower + dev;
      s.upperData[i] = { time, value: upper };
      s.lowerData[i] = { time, value: lower };
      s.zeroData[i] = { time, value: 0 };
      // Alerts
      const against = [s.upperEdge[i], s.upperEdge[i], s.lowerEdge[i], s.lowerEdge[i], 0, 0, predictionMa, predictionMa];
      s.crosses.forEach((x, j) => {
        const f = x.step(prediction, against[j]);
        s.flags[j][i] = f;
        if (f) s.times[j].push(time as number);
      });
    },
    result(s, bars) {
      const n = bars.length;
      const constant = <T>(v: T): T[] => new Array(n).fill(v);
      const lime75 = String(color.new(color.lime, 75));
      const red75 = String(color.new(color.red, 75));
      const upper = s.upper.slice();
      const lower = s.lower.slice();
      const fills: FillData[] = [
        // fill(channel_mid, channel_upper, top_value = upper, bottom_value = 0, bottom_color = na, top_color = lime 75)
        { plot1: 'plot4', plot2: 'plot2', options: { title: 'Channel Gradient Fill' },
          gradient: { topValue: upper, bottomValue: constant(0), topColor: constant(lime75), bottomColor: constant(null) } },
        // fill(channel_mid, channel_lower, top_value = 0, bottom_value = lower, bottom_color = red 75, top_color = na)
        { plot1: 'plot4', plot2: 'plot3', options: { title: 'Channel Gradient Fill' },
          gradient: { topValue: constant(0), bottomValue: lower, topColor: constant(null), bottomColor: constant(red75) } },
        // fill(prediction_, channel_mid, upper, upper_, top_color = lime 0, bottom_color = green 100)
        { plot1: 'plot0', plot2: 'plot4', options: { title: 'Overbought Gradient Fill' },
          gradient: { topValue: upper, bottomValue: s.upperEdge.slice(), topColor: constant(String(color.new(color.lime, 0))),
            bottomColor: constant(String(color.new(color.green, 100))) } },
        // fill(prediction_, channel_mid, lower_, lower, top_color = red 100, bottom_color = red 0)
        { plot1: 'plot0', plot2: 'plot4', options: { title: 'Oversold Gradient Fill' },
          gradient: { topValue: s.lowerEdge.slice(), bottomValue: lower, topColor: constant(String(color.new(color.red, 100))),
            bottomColor: constant(String(color.new(color.red, 0))) } },
      ];
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.prediction.slice(), plot1: s.predictionMa.slice(), plot2: s.upperData.slice(),
          plot3: s.lowerData.slice(), plot4: s.zeroData.slice(),
        },
        // hline(0, title = "Mid Level")
        hlines: [{ value: 0, options: { title: 'Mid Level', color: '#787B86', linestyle: 'dashed', linewidth: 1 } }],
        fills,
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MlMomentumIndexInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MlMomentumIndexInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}


export const MlMomentumIndex = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
