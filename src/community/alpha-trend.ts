/**
 * AlphaTrend
 *
 * ATR-based adaptive trend indicator.
 * Uses RSI (or MFI if volume available) to determine trend direction,
 * then builds trailing stop levels that only ratchet in trend direction. As the original, the previous value is
 * nz(AlphaTrend[1]): 0 on the first bar with an ATR, so the line can start at 0. BUY / SELL labels at
 * AlphaTrend[2] * 0.9999 / * 1.0001 on the potential buy / sell signals ('Show Signals?').
 * Alerts (alertcondition, `alerts` of the result): the original's ten conditions — potential / confirmed buy and
 * sell (AlphaTrend crossing its value 2 bars back, filtered by the bars since the opposite signal), price / candle
 * crosses of the AlphaTrend line, and the same crosses one bar later (after bar close).
 *
 * Reference: "AlphaTrend" by KivancOzbilgic
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AlphaTrendInputs {
  coeff: number;
  period: number;
  useRSI: boolean;
  showSignals: boolean;
}

export const defaultInputs: AlphaTrendInputs = {
  coeff: 1,
  period: 14,
  useRSI: false,
  showSignals: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'coeff', type: 'float', title: 'Multiplier', defval: 1, min: 0.1, step: 0.1 },
  { id: 'period', type: 'int', title: 'Common Period', defval: 14, min: 1 },
  { id: 'showSignals', type: 'bool', title: 'Show Signals?', defval: true },
  { id: 'useRSI', type: 'bool', title: 'Use RSI instead of MFI', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'AlphaTrend', color: '#0022FC', lineWidth: 3 },
  { id: 'plot1', title: 'AlphaTrend[2]', color: '#FC0400', lineWidth: 3 },
];

export const metadata = {
  title: 'AlphaTrend',
  shortTitle: 'AT',
  overlay: true,
};

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface AlphaVars {
  /** Bars of the last buySignalk / sellSignalk (-1: none yet) */
  lastBuy: number;
  lastSell: number;
}

interface AlphaRun extends BarRunState<AlphaVars> {
  tr: ReturnType<typeof taStep.tr>;
  atr: WindowSma;
  filter: { step(b: Bar): number; commit(): void };
  AT: number[];
  buy: boolean[];
  sell: boolean[];
  O1: number[];
  O2: number[];
  priceCross: boolean[];
  candleOver: boolean[];
  candleUnder: boolean[];
  plot0: Point[];
  plot1: Point[];
  fillColors: string[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<AlphaTrendInputs>): BarStudy<AlphaRun, Result> {
  const { coeff, period, useRSI, showSignals } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const tr = taStep.tr();
      const atr = new WindowSma(period);
      let filter: AlphaRun['filter'];
      if (useRSI) {
        const m = taStep.rsi(period);
        filter = { step: (b) => m.step(b.close), commit: () => m.commit() };
      } else {
        const m = taStep.mfi(period);
        filter = { step: (b) => m.step((b.high + b.low + b.close) / 3, b.volume!), commit: () => m.commit() };
      }
      const s: AlphaRun = {
        tr, atr, filter, AT: [], buy: [], sell: [], O1: [], O2: [], priceCross: [], candleOver: [], candleUnder: [],
        plot0: [], plot1: [], fillColors: [], markers: [],
        flags: Array.from({ length: 10 }, () => []), times: Array.from({ length: 10 }, () => []),
        steps: [tr, atr, filter],
        vars: { lastBuy: -1, lastSell: -1 },
        lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [
        s.AT, s.buy, s.sell, s.O1, s.O2, s.priceCross, s.candleOver, s.candleUnder, s.plot0, s.plot1, s.fillColors,
        ...s.flags,
      ];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const time = b.time as number;
      const AT = s.AT;
      // ATR = SMA of TR (PineScript uses ta.sma(ta.tr, AP) here)
      const atr = s.atr.step(s.tr.step(b.high, b.low, b.close));
      // Momentum filter: ta.rsi(close, AP), or ta.mfi(hlc3, AP)
      const filter = s.filter.step(b);

      // Alerts on the original's AlphaTrend series: AlphaTrend := (filter >= 50) ? (upT < nz(AlphaTrend[1]) ?
      // nz(AlphaTrend[1]) : upT) : (downT > nz(AlphaTrend[1]) ? nz(AlphaTrend[1]) : downT), na while the ATR is na
      const upT = b.low - atr * coeff;
      const downT = b.high + atr * coeff;
      const prev = i > 0 && !Number.isNaN(AT[i - 1]) ? AT[i - 1] : 0;
      const at = filter >= 50 ? (upT < prev ? prev : upT) : (downT > prev ? prev : downT);
      AT[i] = at;
      const at2 = i >= 2 ? AT[i - 2] : NaN;
      const pAt = i > 0 ? AT[i - 1] : NaN;
      const pAt2 = i >= 3 ? AT[i - 3] : NaN;
      // buySignalk = ta.crossover(AlphaTrend, AlphaTrend[2]), sellSignalk = ta.crossunder(AlphaTrend, AlphaTrend[2])
      const buy = at > at2 && pAt <= pAt2;
      const sell = at < at2 && pAt >= pAt2;
      s.buy[i] = buy;
      s.sell[i] = sell;
      // K1 = ta.barssince(buySignalk), K2 = ta.barssince(sellSignalk), O1 = ta.barssince(buySignalk[1]),
      // O2 = ta.barssince(sellSignalk[1]): na before the first time
      const K1 = buy ? 0 : v.lastBuy < 0 ? NaN : i - v.lastBuy;
      const K2 = sell ? 0 : v.lastSell < 0 ? NaN : i - v.lastSell;
      const O1 = v.lastBuy < 0 ? NaN : i - v.lastBuy - 1;
      const O2 = v.lastSell < 0 ? NaN : i - v.lastSell - 1;
      s.O1[i] = O1;
      s.O2[i] = O2;
      if (buy) v.lastBuy = i;
      if (sell) v.lastSell = i;
      const buy1 = i > 0 && s.buy[i - 1];
      const sell1 = i > 0 && s.sell[i - 1];
      const O1p = i > 0 ? s.O1[i - 1] : NaN;
      const O2p = i > 0 ? s.O2[i - 1] : NaN;
      // ta.cross(close, AlphaTrend), ta.crossover(low, AlphaTrend), ta.crossunder(high, AlphaTrend)
      const p = i > 0 ? bars[i - 1] : null;
      const pc = p ? p.close : NaN;
      const pl = p ? p.low : NaN;
      const ph = p ? p.high : NaN;
      const priceCross = (b.close > at && pc <= pAt) || (b.close < at && pc >= pAt);
      const candleOver = b.low > at && pl <= pAt;
      const candleUnder = b.high < at && ph >= pAt;
      s.priceCross[i] = priceCross;
      s.candleOver[i] = candleOver;
      s.candleUnder[i] = candleUnder;
      const f = s.flags;
      // buySignalk and O1 > K2 / sellSignalk and O2 > K1
      f[0][i] = buy && O1 > K2;
      f[1][i] = sell && O2 > K1;
      // buySignalk[1] and O1[1] > K2 / sellSignalk[1] and O2[1] > K1
      f[2][i] = buy1 && O1p > K2;
      f[3][i] = sell1 && O2p > K1;
      f[4][i] = priceCross;
      f[5][i] = candleOver;
      f[6][i] = candleUnder;
      // the same on close[1] / low[1] / high[1] against AlphaTrend[1]: the crosses of the bar before
      f[7][i] = i > 0 && s.priceCross[i - 1];
      f[8][i] = i > 0 && s.candleOver[i - 1];
      f[9][i] = i > 0 && s.candleUnder[i - 1];
      for (let k = 0; k < 10; k++) if (f[k][i]) s.times[k].push(time);

      // k1 = plot(AlphaTrend), k2 = plot(AlphaTrend[2]): from the first ATR value; nz(AlphaTrend[1]) = 0 there, so the
      // line starts at 0 while the filter is below 50
      s.plot0[i] = { time: b.time, value: at };
      s.plot1[i] = { time: b.time, value: at2 };
      s.fillColors[i] = Number.isNaN(at) || Number.isNaN(at2)
        ? 'transparent'
        : at > at2 ? 'rgba(38,166,154,0.25)' : 'rgba(239,83,80,0.25)';

      // plotshape(buySignalk and showsignalsk and O1 > K2 ? AlphaTrend[2] * 0.9999 : na, 'BUY', location.absolute,
      //   shape.labelup, size.tiny, color #0022FC, textcolor white); SELL: AlphaTrend[2] * 1.0001, color.maroon
      if (showSignals) {
        if (f[0][i] && !Number.isNaN(at2)) {
          s.markers.push({ id: 'shape0', time, position: 'atPriceBottom', price: at2 * 0.9999,
            shape: 'labelUp', color: '#0022FC', text: 'BUY', textColor: '#FFFFFF', size: 'tiny' });
        }
        if (f[1][i] && !Number.isNaN(at2)) {
          s.markers.push({ id: 'shape1', time, position: 'atPriceTop', price: at2 * 1.0001,
            shape: 'labelDown', color: '#880E4F', text: 'SELL', textColor: '#FFFFFF', size: 'tiny' });
        }
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice() },
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: '#2962FF' }, colors: s.fillColors.slice() }],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AlphaTrendInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AlphaTrendInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Potential BUY Alarm', message: 'BUY SIGNAL!' },
  { id: 'alert1', title: 'Potential SELL Alarm', message: 'SELL SIGNAL!' },
  { id: 'alert2', title: 'Confirmed BUY Alarm', message: 'BUY SIGNAL APPROVED!' },
  { id: 'alert3', title: 'Confirmed SELL Alarm', message: 'SELL SIGNAL APPROVED!' },
  { id: 'alert4', title: 'Price Cross Alert', message: 'Price - AlphaTrend Crossing!' },
  { id: 'alert5', title: 'Candle CrossOver Alarm', message: 'LAST BAR is ABOVE ALPHATREND' },
  { id: 'alert6', title: 'Candle CrossUnder Alarm', message: 'LAST BAR is BELOW ALPHATREND!' },
  { id: 'alert7', title: 'Price Cross Alert After Bar Close', message: 'Price - AlphaTrend Crossing!' },
  { id: 'alert8', title: 'Candle CrossOver Alarm After Bar Close', message: 'LAST BAR is ABOVE ALPHATREND!' },
  { id: 'alert9', title: 'Candle CrossUnder Alarm After Bar Close', message: 'LAST BAR is BELOW ALPHATREND!' },
];

export const AlphaTrend = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
