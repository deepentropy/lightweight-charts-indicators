/**
 * TrendSync Buy and Sell
 *
 * Trend from the close against a 200 SMA. A bar is a candidate when its range (high - low) is above ATR * multiplier.
 * Above the SMA: a buy needs a low above the lowest low of the 3 previous bars and RSI above the threshold, a sell
 * needs a high above the highest high of the 3 previous bars and RSI below 100 - threshold. Below the SMA: a buy
 * needs a low below the lowest low of the 3 previous bars and RSI above the threshold, a sell a high below the highest
 * high of the 3 previous bars and RSI below 100 - threshold. Only the first bar of each condition gives a BUY / SELL
 * label. The SMA is drawn as the trend line.
 * Alerts (alertcondition, `alerts` of the result): 'Unified Buy/Sell Alert', true on the bars of a BUY or SELL label.
 *
 * Reference: "TRENDSYNC BUY/SELL BY SIMPLY_DANTE-FX" by Simply_Dante-fx
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TrendsyncBuySellInputs {
  smaLength: number;
  atrLength: number;
  /** Range Filter Multiplier (of the ATR) */
  rangeThreshold: number;
  rsiLength: number;
  /** RSI Threshold for Buy/Sell */
  rsiThreshold: number;
}

export const defaultInputs: TrendsyncBuySellInputs = {
  smaLength: 200,
  atrLength: 14,
  rangeThreshold: 1.2,
  rsiLength: 14,
  rsiThreshold: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'smaLength', type: 'int', title: 'SMA Length', defval: 200 },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14 },
  { id: 'rangeThreshold', type: 'float', title: 'Range Filter Multiplier', defval: 1.2 },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14 },
  { id: 'rsiThreshold', type: 'int', title: 'RSI Threshold for Buy/Sell', defval: 50 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SMA', color: color.purple, lineWidth: 2 },
];

export const metadata = {
  title: 'TRENDSYNC BUY AND SELL ',
  shortTitle: 'TRENDSYNC BUY AND SELL ',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface TsVars {
  prevBuy: boolean;
  prevSell: boolean;
  prevBuyDown: boolean;
  prevSellDown: boolean;
}

interface TsRun extends BarRunState<TsVars> {
  sma: WindowSma;
  atr: ReturnType<typeof taStep.atr>;
  rsi: ReturnType<typeof taStep.rsi>;
  prevHigh: WindowExtreme;
  prevLow: WindowExtreme;
  plot0: { time: number; value: number; color: string }[];
  markers: MarkerData[];
  unified: boolean[];
  times: number[];
}

function study(inputs: Partial<TrendsyncBuySellInputs>): BarStudy<TsRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const sma = new WindowSma(cfg.smaLength);
      const atr = taStep.atr(cfg.atrLength);
      const rsi = taStep.rsi(cfg.rsiLength);
      // ta.highest(high[1], 3) / ta.lowest(low[1], 3)
      const prevHigh = new WindowExtreme(false, 3);
      const prevLow = new WindowExtreme(true, 3);
      const s: TsRun = {
        sma, atr, rsi, prevHigh, prevLow, plot0: [], markers: [], unified: [], times: [],
        steps: [sma, atr, rsi, prevHigh, prevLow],
        vars: { prevBuy: false, prevSell: false, prevBuyDown: false, prevSellDown: false },
        lists: [], series: [],
      };
      s.series = [s.plot0, s.unified];
      s.lists = [s.markers, s.times];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const sma = s.sma.step(b.close);
      const atr = s.atr.step(b.high, b.low, b.close);
      const rsi = s.rsi.step(b.close);
      const prevHigh = s.prevHigh.step(i > 0 ? bars[i - 1].high : NaN);
      const prevLow = s.prevLow.step(i > 0 ? bars[i - 1].low : NaN);

      const higherHigh = gt(b.high, prevHigh);
      const higherLow = gt(b.low, prevLow);
      const lowerHigh = gt(prevHigh, b.high);
      const lowerLow = gt(prevLow, b.low);
      const uptrend = gt(b.close, sma);
      const downtrend = gt(sma, b.close);
      const rangeFilter = gt(b.high - b.low, atr * cfg.rangeThreshold);
      const momentumFilterUp = gt(rsi, cfg.rsiThreshold);
      const momentumFilterDown = gt(100 - cfg.rsiThreshold, rsi);

      const buySignal = uptrend && higherLow && rangeFilter && momentumFilterUp;
      const sellSignal = uptrend && higherHigh && rangeFilter && momentumFilterDown;
      const buySignalDown = downtrend && lowerLow && rangeFilter && momentumFilterUp;
      const sellSignalDown = downtrend && lowerHigh && rangeFilter && momentumFilterDown;

      // x and not x[1] (x[1] is false on the first bar)
      const finalBuy = (buySignal && !v.prevBuy) || (buySignalDown && !v.prevBuyDown);
      const finalSell = (sellSignal && !v.prevSell) || (sellSignalDown && !v.prevSellDown);
      // unifiedSignal = finalBuySignal or finalSellSignal
      const unified = finalBuy || finalSell;
      s.unified[i] = unified;
      if (unified) s.times.push(b.time as number);
      v.prevBuy = buySignal;
      v.prevSell = sellSignal;
      v.prevBuyDown = buySignalDown;
      v.prevSellDown = sellSignalDown;

      // plotshape(..., location.belowbar / abovebar, shape.labelup / labeldown, text = "BUY" / "SELL"); the Pine
      // default text colour is blue
      if (finalBuy) {
        s.markers.push({ time: b.time as number, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'BUY', textColor: color.blue });
      }
      if (finalSell) {
        s.markers.push({ time: b.time as number, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL', textColor: color.blue });
      }
      s.plot0[i] = { time: b.time as number, value: sma, color: color.purple };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, [s.times], [n > 0 && s.unified[n - 1]]),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TrendsyncBuySellInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TrendsyncBuySellInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Unified Buy/Sell Alert', message: 'Unified Signal Triggered (Buy/Sell)' },
];

export const TrendsyncBuySell = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
