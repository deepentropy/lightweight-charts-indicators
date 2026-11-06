/**
 * H-Infinity Volatility Filter
 *
 * An H-infinity style filter of the source. Each of the `order` states starts at the first source value with an
 * error of 1. On every bar: error += noise; gain = error / (error + disturbance); state += gain * (source - state);
 * error = (1 - gain) * error. The line is the first state. The trend is 1 when the line rises, -1 when it falls and
 * keeps its value when the line is flat; the line and the candles take the bullish / bearish colour of the trend.
 * Alerts (alertcondition, `alerts` of the result): the trend crossing over / under 0 (turning bullish / bearish).
 *
 * Reference: "H-Infinity Volatility Filter [QuantAlgo]" by QuantAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © QuantAlgo
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface HInfinityVolatilityFilterInputs {
  /** Price source of the filter */
  inputSource: SourceType;
  /** Worst-case noise parameter */
  inputNoise: number;
  /** Disturbance parameter */
  inputDisturbance: number;
  /** Number of filter states */
  inputOrder: number;
  upColor: string;
  downColor: string;
  colorCandlesByTrend: boolean;
}

export const defaultInputs: HInfinityVolatilityFilterInputs = {
  inputSource: 'close',
  inputNoise: 0.02,
  inputDisturbance: 3.0,
  inputOrder: 5,
  upColor: '#00ffaa',
  downColor: '#ff0000',
  colorCandlesByTrend: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'inputSource', type: 'source', title: 'Source', defval: 'close' },
  { id: 'inputNoise', type: 'float', title: 'Worst-Case Noise', defval: 0.02, step: 0.01 },
  { id: 'inputDisturbance', type: 'float', title: 'Disturbance', defval: 3.0 },
  { id: 'inputOrder', type: 'int', title: 'Order', defval: 5, min: 1 },
  { id: 'upColor', type: 'color', title: 'Bullish Color', defval: '#00ffaa' },
  { id: 'downColor', type: 'color', title: 'Bearish Color', defval: '#ff0000' },
  { id: 'colorCandlesByTrend', type: 'bool', title: 'Color Candles by Trend?', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'H∞ Filter', color: '#00ffaa', lineWidth: 3 },
];

export const metadata = {
  title: 'H-Infinity Volatility Filter [QuantAlgo]',
  shortTitle: 'H∞ Volatility Filter [QuantAlgo]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface HInfVars {
  /** var float[] state = array.new_float(inputOrder, na); var float[] error = array.new_float(inputOrder, 100.0)
   *  (changed in place, copied by copyVars) */
  state: number[];
  error: number[];
  /** var int trend = na (in detectTrend) */
  trendVar: number;
  /** var color barColor = na */
  barColor: string | null;
}

interface HInfRun extends BarRunState<HInfVars> {
  filtered: number[];
  trend: number[];
  plot0: Point[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<HInfinityVolatilityFilterInputs>): BarStudy<HInfRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const order = cfg.inputOrder;
  const value = barSource(cfg.inputSource);
  return {
    fullRunReason: () => (isBarSource(cfg.inputSource) ? null : 'source of another study'),
    init() {
      const s: HInfRun = {
        filtered: [], trend: [], plot0: [], barColors: [], flags: [[], []], times: [[], []],
        steps: [],
        vars: { state: new Array(order).fill(NaN), error: new Array(order).fill(100.0), trendVar: NaN, barColor: null },
        lists: [], series: [],
      };
      s.lists = [s.barColors, ...s.times];
      s.series = [s.filtered, s.trend, s.plot0, ...s.flags];
      return s;
    },
    copyVars: (v) => ({ ...v, state: v.state.slice(), error: v.error.slice() }),
    bar(s, i, bars) {
      const v = s.vars;
      const state = v.state;
      const error = v.error;
      const price = value(bars[i]);
      // initializeState(price): when state[0] is na, every state = price and every error = 1.0
      if (isNaN(state[0])) {
        for (let k = 0; k < order; k++) {
          state[k] = price;
          error[k] = 1.0;
        }
      }
      // applyHInfinity(price): newState = state.copy(), newError = error + noise (each element reads only its own)
      for (let k = 0; k < order; k++) {
        const newState = state[k];
        const newError = error[k] + cfg.inputNoise;
        const gain = newError / (newError + cfg.inputDisturbance);
        state[k] = newState + gain * (price - newState);
        error[k] = (1 - gain) * newError;
      }
      const filtered = state[0];
      s.filtered[i] = filtered;

      // detectTrend(filteredPrice)
      const prev = i > 0 ? s.filtered[i - 1] : NaN;
      if (gt(filtered, prev)) v.trendVar = 1;
      else if (lt(filtered, prev)) v.trendVar = -1;
      const trend = v.trendVar;
      s.trend[i] = trend;

      if (trend === 1) v.barColor = cfg.upColor;
      else if (trend === -1) v.barColor = cfg.downColor;

      // plot(filteredPrice, color = trend == 1 ? upColor : downColor, linewidth = 3)
      s.plot0[i] = { time: bars[i].time, value: filtered, color: trend === 1 ? cfg.upColor : cfg.downColor };
      // barcolor(colorCandlesByTrend ? barColor : na)
      if (cfg.colorCandlesByTrend && v.barColor !== null) s.barColors.push({ time: bars[i].time, color: v.barColor });

      // alertcondition(ta.crossover(trend, 0)) / alertcondition(ta.crossunder(trend, 0))
      const pt = i > 0 ? s.trend[i - 1] : NaN;
      const up = trend > 0 && pt <= 0;
      const down = trend < 0 && pt >= 0;
      s.flags[0][i] = up;
      s.flags[1][i] = down;
      if (up) s.times[0].push(bars[i].time as number);
      if (down) s.times[1].push(bars[i].time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<HInfinityVolatilityFilterInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<HInfinityVolatilityFilterInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Trend', message: 'H∞ Filter: Bullish Trend Detected' },
  { id: 'alert1', title: 'Bearish Trend', message: 'H∞ Filter: Bearish Trend Detected' },
];

export const HInfinityVolatilityFilter = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
