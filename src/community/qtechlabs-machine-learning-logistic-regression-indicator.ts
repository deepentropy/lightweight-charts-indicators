/**
 * Q# ML Logistic Regression Indicator [Lite]
 *
 * A logistic model with fixed weights on two features of the price source: the log return over `retLookback` bars
 * and log(|price^2 - 1| + 0.5), each min-max normalised over 20 bars (0.5 on a flat window).
 * z = -2 + 2 * normRet + normSynthetic, probability = 1 / (1 + exp(-z)), smoothed by an EMA. The signal is buy above
 * the threshold, sell below 1 - threshold, else hold; BUY / SELL labels mark the bars where the signal changes to
 * buy / sell. The smoothed probability is drawn with lines at 0.5, the threshold and 1 - threshold.
 * Alerts (alertcondition, `alerts` of the result): 'Buy Signal' and 'Sell Signal', true on the bars of the labels.
 *
 * Reference: "Q# ML Logistic Regression Indicator [Lite]" by QTechLabsInfo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Q# Tech Labs 2025
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Signal', message: 'Q# Lite Buy Signal' },
  { id: 'alert1', title: 'Sell Signal', message: 'Q# Lite Sell Signal' },
];

export interface QtechlabsMachineLearningLogisticRegressionIndicatorInputs {
  /** Price source */
  ptype: 'Open' | 'High' | 'Low' | 'Close' | 'HL2' | 'HLC3' | 'OHLC4';
  /** Signal threshold of the smoothed probability */
  threshold: number;
  /** Log return lookback (bars) */
  retLookback: number;
  /** EMA length of the probability */
  smoothLen: number;
}

export const defaultInputs: QtechlabsMachineLearningLogisticRegressionIndicatorInputs = {
  ptype: 'Close',
  threshold: 0.6,
  retLookback: 3,
  smoothLen: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'ptype', type: 'string', title: 'Price Source', defval: 'Close', options: ['Open', 'High', 'Low', 'Close', 'HL2', 'HLC3', 'OHLC4'] },
  { id: 'threshold', type: 'float', title: 'Signal Threshold', defval: 0.6, min: 0.5, max: 0.9 },
  { id: 'retLookback', type: 'int', title: 'Log Return Lookback', defval: 3, min: 1 },
  { id: 'smoothLen', type: 'int', title: 'Probability Smoothing', defval: 3 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Signal Confidence', color: color.blue, lineWidth: 1, display: 'pane' },
];

export const metadata = {
  title: 'Q# ML Logistic Regression Indicator [Lite]',
  shortTitle: 'Q# ML Logistic Regression Indicator [Lite]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface QtechVars {
  /** signal[1] (na before the first bar) */
  prevSignal: number;
}

interface QtechRun extends BarRunState<QtechVars> {
  retHi: WindowExtreme;
  retLo: WindowExtreme;
  synHi: WindowExtreme;
  synLo: WindowExtreme;
  ema: ReturnType<typeof taStep.ema>;
  ds: number[];
  plot0: Point[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<QtechlabsMachineLearningLogisticRegressionIndicatorInputs>): BarStudy<QtechRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const price = (b: Bar): number => {
    switch (cfg.ptype) {
      case 'Open': return b.open;
      case 'High': return b.high;
      case 'Low': return b.low;
      case 'Close': return b.close;
      case 'HL2': return (b.high + b.low) / 2;
      case 'HLC3': return (b.high + b.low + b.close) / 3;
      default: return (b.open + b.high + b.low + b.close) / 4;
    }
  };
  const w0 = -2.0;
  const w1 = 2.0;
  const w2 = 1.0;
  const buyColor = color.green;
  const sellColor = color.red;
  return {
    init() {
      const retHi = new WindowExtreme(false, 20);
      const retLo = new WindowExtreme(true, 20);
      const synHi = new WindowExtreme(false, 20);
      const synLo = new WindowExtreme(true, 20);
      const ema = taStep.ema(cfg.smoothLen);
      const s: QtechRun = {
        retHi, retLo, synHi, synLo, ema, ds: [], plot0: [], markers: [], flags: [[], []], times: [[], []],
        steps: [retHi, retLo, synHi, synLo, ema],
        vars: { prevSignal: NaN },
        lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.ds, s.plot0, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const ds = price(b);
      s.ds[i] = ds;
      // ret = math.log(ds / ds[ret_lookback]); synthetic = math.log(math.abs(math.pow(ds, 2) - 1) + 0.5)
      const ret = i >= cfg.retLookback ? Math.log(ds / s.ds[i - cfg.retLookback]) : NaN;
      const synthetic = Math.log(Math.abs(Math.pow(ds, 2) - 1) + 0.5);

      // normalize(x, len): hi == lo ? 0.5 : (x - lo) / (hi - lo)
      const normalize = (x: number, hiStep: WindowExtreme, loStep: WindowExtreme) => {
        const hi = hiStep.step(x);
        const lo = loStep.step(x);
        return eq(hi, lo) ? 0.5 : (x - lo) / (hi - lo);
      };
      const normRet = normalize(ret, s.retHi, s.retLo);
      const normSynthetic = normalize(synthetic, s.synHi, s.synLo);

      const prob = 1 / (1 + Math.exp(-(w0 + w1 * normRet + w2 * normSynthetic)));
      const sprob = s.ema.step(prob);

      const signal = gt(sprob, cfg.threshold) ? 1 : lt(sprob, 1 - cfg.threshold) ? -1 : 0;
      // signal != signal[1]: false when signal[1] is na (bar 0)
      const changed = !isNaN(v.prevSignal) && signal !== v.prevSignal;
      const buy = signal === 1 && changed;
      const sell = signal === -1 && changed;
      s.flags[0][i] = buy;
      s.flags[1][i] = sell;
      if (buy) s.times[0].push(b.time as number);
      if (sell) s.times[1].push(b.time as number);
      // plotshape(..., text = "BUY"): no textcolor, the Pine default text colour (color.blue)
      if (buy) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: buyColor, text: 'BUY',
          textColor: color.blue });
      }
      if (sell) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: sellColor, text: 'SELL',
          textColor: color.blue });
      }
      v.prevSignal = signal;
      s.plot0[i] = { time: b.time, value: Number.isFinite(sprob) ? sprob : NaN, color: color.blue };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        hlines: [
          { value: 0.5, options: { title: 'Neutral', color: color.gray, linestyle: 'dashed' } },
          { value: cfg.threshold, options: { title: 'Buy Threshold', color: color.green, linestyle: 'dotted' } },
          { value: 1 - cfg.threshold, options: { title: 'Sell Threshold', color: color.red, linestyle: 'dotted' } },
        ],
        markers: s.markers.slice(),
        // alertcondition(buy, "Buy Signal") / alertcondition(sell, "Sell Signal")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<QtechlabsMachineLearningLogisticRegressionIndicatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<QtechlabsMachineLearningLogisticRegressionIndicatorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const QtechlabsMachineLearningLogisticRegressionIndicator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
