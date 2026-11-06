/**
 * Quantum Trend Signal
 *
 * Fast and slow EMAs of the close. A BUY triangle is drawn when the fast EMA crosses over the slow EMA while the RSI
 * is above 55 and the ATR is above its 20-bar SMA times the ATR filter; a SELL triangle when the fast EMA crosses
 * under the slow EMA while the RSI is below 45 with the same volatility filter. The background is green while the
 * fast EMA is above the slow EMA and red while it is below.
 * Alerts (alertcondition, `alerts` of the result): 'Buy Alert' and 'Sell Alert', true on the bars of the triangles.
 *
 * Reference: "Quantum Trend Signal" by ReubenMiles
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © ExpertTraderASK
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { MarkerData, BgColorData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Alert', message: 'Quantum Trend BUY' },
  { id: 'alert1', title: 'Sell Alert', message: 'Quantum Trend SELL' },
];

export interface QuantumTrendSignalInputs {
  fastEMA: number;
  slowEMA: number;
  rsiLen: number;
  atrLen: number;
  /** The ATR must be above its 20-bar SMA times this factor */
  atrFilter: number;
}

export const defaultInputs: QuantumTrendSignalInputs = {
  fastEMA: 21,
  slowEMA: 55,
  rsiLen: 14,
  atrLen: 14,
  atrFilter: 0.8,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastEMA', type: 'int', title: 'Fast EMA', defval: 21 },
  { id: 'slowEMA', type: 'int', title: 'Slow EMA', defval: 55 },
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14 },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 14 },
  { id: 'atrFilter', type: 'float', title: 'ATR Filter', defval: 0.8 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast EMA', color: color.aqua, lineWidth: 2 },
  { id: 'plot1', title: 'Slow EMA', color: color.orange, lineWidth: 2 },
];

export const metadata = {
  title: 'Quantum Trend Signal',
  shortTitle: 'Quantum Trend Signal',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number };

interface QtsVars {
  /** The last values where both EMAs were not na */
  prevF: number;
  prevS: number;
}

interface QtsRun extends BarRunState<QtsVars> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  rsi: ReturnType<typeof taStep.rsi>;
  atr: ReturnType<typeof taStep.atr>;
  atrAvg: WindowSma;
  plot0: Point[];
  plot1: Point[];
  markers: MarkerData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<QuantumTrendSignalInputs>): BarStudy<QtsRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const upCol = String(color.new(color.green, 92));
  const downCol = String(color.new(color.red, 92));
  return {
    init() {
      const s: QtsRun = {
        fast: taStep.ema(cfg.fastEMA), slow: taStep.ema(cfg.slowEMA), rsi: taStep.rsi(cfg.rsiLen),
        atr: taStep.atr(cfg.atrLen), atrAvg: new WindowSma(20), plot0: [], plot1: [], markers: [], bgColors: [],
        flags: [[], []], times: [[], []], steps: [], vars: { prevF: NaN, prevS: NaN }, lists: [], series: [],
      };
      s.steps = [s.fast, s.slow, s.rsi, s.atr, s.atrAvg];
      s.lists = [s.markers, s.bgColors, ...s.times];
      s.series = [s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(st, i, bars) {
      const b = bars[i]!;
      const time = b.time as number;
      const v = st.vars;
      const f = st.fast.step(b.close);
      const s = st.slow.step(b.close);
      const rsi = st.rsi.step(b.close);
      const atr = st.atr.step(b.high, b.low, b.close);
      const atrAvg = st.atrAvg.step(atr);
      // ta.crossover / ta.crossunder: compared with the last bar where both values were not na; a tie there counts.
      // The comparisons are exact (no 1e-10 tolerance).
      const crossUp = f > s && v.prevF <= v.prevS;
      const crossDown = f < s && v.prevF >= v.prevS;
      if (!isNaN(f) && !isNaN(s)) {
        v.prevF = f;
        v.prevS = s;
      }
      const volatilityOK = gt(atr, atrAvg * cfg.atrFilter);
      const buy = crossUp && gt(rsi, 55) && volatilityOK;
      const sell = crossDown && lt(rsi, 45) && volatilityOK;
      // plotshape(buy, "BUY", location.belowbar, color.lime, shape.triangleup, size = size.small, text = "BUY")
      if (buy) {
        st.markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: color.lime, size: 'small',
          text: 'BUY', textColor: color.blue });
      }
      // plotshape(sell, "SELL", location.abovebar, color.red, shape.triangledown, size = size.small, text = "SELL")
      if (sell) {
        st.markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'small',
          text: 'SELL', textColor: color.blue });
      }
      // bgcolor(upTrend ? color.new(color.green, 92) : downTrend ? color.new(color.red, 92) : na)
      if (gt(f, s)) st.bgColors.push({ time: b.time, color: upCol });
      else if (lt(f, s)) st.bgColors.push({ time: b.time, color: downCol });
      st.plot0[i] = { time, value: f };
      st.plot1[i] = { time, value: s };
      // alertcondition(buy, "Buy Alert") / alertcondition(sell, "Sell Alert")
      st.flags[0]![i] = buy;
      st.flags[1]![i] = sell;
      if (buy) st.times[0]!.push(time);
      if (sell) st.times[1]!.push(time);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<QuantumTrendSignalInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<QuantumTrendSignalInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const QuantumTrendSignal = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
