/**
 * Parabolic SAR + EMA 200 + MACD Signals
 *
 * Combined indicator using SAR, EMA200, and MACD histogram for buy/sell signals.
 * The Buy / Sell labels and the alerts (alertcondition, `alerts` of the result) follow the original's rule: buy = SAR
 * below the low, the MACD histogram (EMA 12 - EMA 26 minus its EMA 9) crossing above 0 and ohlc4 not below the
 * EMA 200; sell = SAR above the high, the histogram crossing below 0 and ohlc4 below the EMA 200.
 *
 * Reference: "Parabolic SAR + EMA 200 + MACD Signals" (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SAREMAMACDInputs {
  sarStart: number;
  sarInc: number;
  sarMax: number;
  emaLen: number;
}

export const defaultInputs: SAREMAMACDInputs = {
  sarStart: 0.02,
  sarInc: 0.02,
  sarMax: 0.2,
  emaLen: 200,
};

export const inputConfig: InputConfig[] = [
  { id: 'sarStart', type: 'float', title: 'SAR Start', defval: 0.02, min: 0.001, step: 0.01 },
  { id: 'sarInc', type: 'float', title: 'SAR Increment', defval: 0.02, min: 0.001, step: 0.01 },
  { id: 'sarMax', type: 'float', title: 'SAR Max', defval: 0.2, min: 0.01, step: 0.01 },
  { id: 'emaLen', type: 'int', title: 'EMA Length', defval: 200, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SAR', color: '#2962FF', lineWidth: 1, style: 'circles' },
  { id: 'plot1', title: 'EMA 200', color: '#787B86', lineWidth: 2 },
];

export const metadata = {
  title: 'SAR + EMA + MACD Signals',
  shortTitle: 'SEM',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface SemVars {
  // Manual SAR computation
  af: number;
  ep: number;
  // ta.sar(start, inc, max): the state of the oakscriptjs function
  sarValue: number;
  extremePoint: number;
  acceleration: number;
  isUpTrend: boolean;
  isFirstTrendBar: boolean;
  /** The MACD histogram of the bar before */
  prevDelta: number;
}

interface SemRun extends BarRunState<SemVars> {
  ema200: ReturnType<typeof taStep.ema>;
  macdFastEma: ReturnType<typeof taStep.ema>;
  macdSlowEma: ReturnType<typeof taStep.ema>;
  macdSignal: ReturnType<typeof taStep.ema>;
  sarArr: number[];
  /** 1 = bullish (SAR below), -1 = bearish (SAR above) */
  sarDirArr: number[];
  plot0: Point[];
  plot1: Point[];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
}

function study(inputs: Partial<SAREMAMACDInputs>): BarStudy<SemRun, Result> {
  const { sarStart, sarInc, sarMax, emaLen } = { ...defaultInputs, ...inputs };
  const warmup = emaLen;
  return {
    init(bars) {
      const ema200 = taStep.ema(emaLen);
      // MACD histogram
      const macdFastEma = taStep.ema(12);
      const macdSlowEma = taStep.ema(26);
      const macdSignal = taStep.ema(9);
      const s: SemRun = {
        ema200, macdFastEma, macdSlowEma, macdSignal, sarArr: [], sarDirArr: [], plot0: [], plot1: [],
        flags: [[], []], times: [[], []], markers: [],
        steps: [ema200, macdFastEma, macdSlowEma, macdSignal],
        // let ep = bars[0].high (no bar: the same runtime error)
        vars: {
          af: sarStart, ep: bars[0].high, sarValue: NaN, extremePoint: NaN, acceleration: sarStart, isUpTrend: false,
          isFirstTrendBar: false, prevDelta: NaN,
        },
        lists: [], series: [],
      };
      s.lists = [...s.times, s.markers];
      s.series = [s.sarArr, s.sarDirArr, s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const time = b.time;
      const close = b.close;
      const ema200 = s.ema200.step(close);

      // Manual SAR computation
      if (i === 0) {
        s.sarArr[0] = b.low;
        s.sarDirArr[0] = 1;
      } else {
        const prevDir = s.sarDirArr[i - 1];
        let sar = s.sarArr[i - 1] + v.af * (v.ep - s.sarArr[i - 1]);

        if (prevDir === 1) {
          sar = Math.min(sar, bars[i - 1].low);
          if (i >= 2) sar = Math.min(sar, bars[i - 2].low);
          if (b.low < sar) {
            s.sarDirArr[i] = -1;
            sar = v.ep;
            v.ep = b.low;
            v.af = sarStart;
          } else {
            s.sarDirArr[i] = 1;
            if (b.high > v.ep) {
              v.ep = b.high;
              v.af = Math.min(v.af + sarInc, sarMax);
            }
          }
        } else {
          sar = Math.max(sar, bars[i - 1].high);
          if (i >= 2) sar = Math.max(sar, bars[i - 2].high);
          if (b.high > sar) {
            s.sarDirArr[i] = 1;
            sar = v.ep;
            v.ep = b.high;
            v.af = sarStart;
          } else {
            s.sarDirArr[i] = -1;
            if (b.low < v.ep) {
              v.ep = b.low;
              v.af = Math.min(v.af + sarInc, sarMax);
            }
          }
        }
        s.sarArr[i] = sar;
      }

      // MACD histogram
      const macdLine = s.macdFastEma.step(close) - s.macdSlowEma.step(close);
      const macdSignal = s.macdSignal.step(macdLine);
      const delta = macdLine - macdSignal;

      s.plot0[i] = { time, value: i < 1 ? NaN : s.sarArr[i], color: s.sarDirArr[i] === 1 ? '#26A69A' : '#EF5350' };
      s.plot1[i] = { time, value: (ema200 == null || i < warmup) ? NaN : ema200 };

      // ta.sar(start, inc, max) (the oakscriptjs function, bar by bar)
      let pineSar: number;
      if (i === 0) {
        pineSar = NaN;
      } else {
        const high = b.high;
        const low = b.low;
        if (i === 1) {
          const p = bars[0];
          if (close > p.close) {
            v.isUpTrend = true;
            v.extremePoint = high;
            v.sarValue = p.low;
          } else {
            v.isUpTrend = false;
            v.extremePoint = low;
            v.sarValue = p.high;
          }
          v.isFirstTrendBar = true;
          v.acceleration = sarStart;
        }
        v.sarValue = v.sarValue + v.acceleration * (v.extremePoint - v.sarValue);
        if (v.isUpTrend) {
          if (v.sarValue > low) {
            v.isFirstTrendBar = true;
            v.isUpTrend = false;
            v.sarValue = Math.max(high, v.extremePoint);
            v.extremePoint = low;
            v.acceleration = sarStart;
          }
        } else if (v.sarValue < high) {
          v.isFirstTrendBar = true;
          v.isUpTrend = true;
          v.sarValue = Math.min(low, v.extremePoint);
          v.extremePoint = high;
          v.acceleration = sarStart;
        }
        if (!v.isFirstTrendBar) {
          if (v.isUpTrend) {
            if (high > v.extremePoint) {
              v.extremePoint = high;
              v.acceleration = Math.min(v.acceleration + sarInc, sarMax);
            }
          } else if (low < v.extremePoint) {
            v.extremePoint = low;
            v.acceleration = Math.min(v.acceleration + sarInc, sarMax);
          }
        }
        if (v.isUpTrend) {
          v.sarValue = Math.min(v.sarValue, bars[i - 1].low);
          if (i > 1) v.sarValue = Math.min(v.sarValue, bars[i - 2].low);
        } else {
          v.sarValue = Math.max(v.sarValue, bars[i - 1].high);
          if (i > 1) v.sarValue = Math.max(v.sarValue, bars[i - 2].high);
        }
        pineSar = v.sarValue;
        v.isFirstTrendBar = false;
      }

      // The original's alert rule: SAR = ta.sar(start, inc, max); main_trend = ohlc4 < EMA_200 ? "Bearish" : "Bullish"
      // (na EMA = Bullish); buy_signal = SAR < low and ta.crossover(delta, 0) and Bullish; sell_signal = SAR > high and
      // ta.crossunder(delta, 0) and Bearish
      const prevDelta = v.prevDelta;
      v.prevDelta = delta;
      const deltaUp = delta > 0 && prevDelta <= 0;
      const deltaDown = delta < 0 && prevDelta >= 0;
      const bearish = lt((b.open + b.high + b.low + close) / 4, ema200 ?? NaN);
      const buy = lt(pineSar ?? NaN, b.low) && deltaUp && !bearish;
      const sell = gt(pineSar ?? NaN, b.high) && deltaDown && bearish;
      s.flags[0][i] = buy;
      s.flags[1][i] = sell;
      if (buy) s.times[0].push(time as number);
      if (sell) s.times[1].push(time as number);

      // plotshape(buy_signal, "Buy Label", text="Buy", location.belowbar, shape.labelup, size.tiny, color.green,
      //   textcolor=color.white) / plotshape(sell_signal, "Sell Label", text="Sell", location.abovebar, shape.labeldown,
      //   size.tiny, color.red, textcolor=color.white): the same signals as the alerts
      if (buy) {
        s.markers.push({ time, position: 'belowBar', shape: 'labelUp', color: '#4CAF50', text: 'Buy',
          textColor: '#FFFFFF', size: 'tiny', id: 'shape0' });
      }
      if (sell) {
        s.markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: '#FF5252', text: 'Sell',
          textColor: '#FFFFFF', size: 'tiny', id: 'shape1' });
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice() },
        markers: s.markers.slice(),
        // alertcondition(buy_signal, 'SAR EMA200 MACD Buy signal!') / alertcondition(sell_signal, '... Sell signal!')
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SAREMAMACDInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SAREMAMACDInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'SAR EMA200 MACD Buy signal!', message: 'Buy signal' },
  { id: 'alert1', title: 'SAR EMA200 MACD Sell signal!', message: 'Sell signal' },
];

export const SAREMAMACDSignals = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
