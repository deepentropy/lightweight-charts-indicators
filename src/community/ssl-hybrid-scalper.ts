/**
 * SSL Hybrid Scalper (Gold Scalping Strategy v6)
 *
 * Fast, slow and trend EMAs of the close. A buy label marks a crossover of the fast EMA over the slow EMA while the
 * RSI is below the overbought level and the close is above the trend EMA; a sell label marks a crossunder while the
 * RSI is above the oversold level and the close is below the trend EMA.
 * Alerts (alertcondition, `alerts` of the result): 'Buy Alert' and 'Sell Alert', true on the bars of each signal.
 *
 * Reference: "SSL Hybrid Scalper" by nabeel8369
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SslHybridScalperInputs {
  /** Fast EMA length */
  fastLength: number;
  /** Slow EMA length */
  slowLength: number;
  /** RSI length */
  rsiLength: number;
  /** RSI overbought level (buy signals need the RSI below it) */
  rsiOverbought: number;
  /** RSI oversold level (sell signals need the RSI above it) */
  rsiOversold: number;
  /** Trend filter EMA length */
  trendFilterLength: number;
}

export const defaultInputs: SslHybridScalperInputs = {
  fastLength: 8,
  slowLength: 21,
  rsiLength: 14,
  rsiOverbought: 70,
  rsiOversold: 30,
  trendFilterLength: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast EMA Length', defval: 8 },
  { id: 'slowLength', type: 'int', title: 'Slow EMA Length', defval: 21 },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14 },
  { id: 'rsiOverbought', type: 'int', title: 'RSI Overbought Level', defval: 70 },
  { id: 'rsiOversold', type: 'int', title: 'RSI Oversold Level', defval: 30 },
  { id: 'trendFilterLength', type: 'int', title: 'Trend Filter EMA Length', defval: 50 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast EMA', color: color.orange, lineWidth: 1 },
  { id: 'plot1', title: 'Slow EMA', color: color.blue, lineWidth: 1 },
  { id: 'plot2', title: 'Trend EMA', color: color.silver, lineWidth: 2 },
];

export const metadata = {
  title: 'Gold Scalping Strategy v6',
  shortTitle: 'Gold Scalping Strategy v6',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color: string };

interface SslVars {
  /** The last fast / slow EMAs where both were not na */
  prevF: number;
  prevS: number;
}

interface SslRun extends BarRunState<SslVars> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  trend: ReturnType<typeof taStep.ema>;
  rsi: ReturnType<typeof taStep.rsi>;
  fastData: Point[];
  slowData: Point[];
  trendData: Point[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<SslHybridScalperInputs>): BarStudy<SslRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const fast = taStep.ema(cfg.fastLength);
      const slow = taStep.ema(cfg.slowLength);
      const trend = taStep.ema(cfg.trendFilterLength);
      const rsi = taStep.rsi(cfg.rsiLength);
      const s: SslRun = {
        fast, slow, trend, rsi, fastData: [], slowData: [], trendData: [], markers: [], flags: [[], []], times: [[], []],
        steps: [fast, slow, trend, rsi], vars: { prevF: NaN, prevS: NaN }, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.fastData, s.slowData, s.trendData, ...s.flags];
      return s;
    },
    bar(st, i, bars) {
      const b = bars[i]!;
      const c = b.close;
      const f = st.fast.step(c);
      const s = st.slow.step(c);
      const trendEMA = st.trend.step(c);
      const rsi = st.rsi.step(c);
      const v = st.vars;
      // ta.crossover / ta.crossunder compare with the last bar where both values were not na (exact comparisons:
      // no 1e-10 tolerance, unlike the operators)
      const both = !isNaN(f) && !isNaN(s);
      const crossUp = both && f > s && v.prevF <= v.prevS;
      const crossDown = both && f < s && v.prevF >= v.prevS;
      if (both) {
        v.prevF = f;
        v.prevS = s;
      }
      const trendUp = gt(c, trendEMA);
      const trendDown = lt(c, trendEMA);
      const buySignal = crossUp && lt(rsi, cfg.rsiOverbought) && trendUp;
      const sellSignal = crossDown && gt(rsi, cfg.rsiOversold) && trendDown;
      const t = b.time as number;
      if (buySignal) st.markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: color.green, size: 'small' });
      if (sellSignal) st.markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: color.red, size: 'small' });
      [buySignal, sellSignal].forEach((flag, k) => {
        st.flags[k]![i] = flag;
        if (flag) st.times[k]!.push(t);
      });
      st.fastData[i] = { time: t, value: f, color: color.orange };
      st.slowData[i] = { time: t, value: s, color: color.blue };
      st.trendData[i] = { time: t, value: trendEMA, color: color.silver };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.fastData.slice(), plot1: s.slowData.slice(), plot2: s.trendData.slice() },
        markers: s.markers.slice(),
        // alertcondition(buySignal, "Buy Alert") / alertcondition(sellSignal, "Sell Alert")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SslHybridScalperInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SslHybridScalperInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Alert', message: 'Bullish signal detected' },
  { id: 'alert1', title: 'Sell Alert', message: 'Bearish signal detected' },
];

export const SslHybridScalper = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
