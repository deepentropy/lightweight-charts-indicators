/**
 * Envelope RSI - Buy Sell Signals
 *
 * Price envelope overlay: basis = EMA or SMA of hl2, upper = basis*(1+pct), lower = basis*(1-pct).
 * Buy/Sell signals based on price crossing envelope bands + RSI filter.
 * TP/SL bands appear for 2 bars after each signal as green (TP) and red (SL) fills.
 * Alerts (alertcondition, `alerts` of the result): 'Envelope RSI Buy signal!' and 'Envelope RSI Sell signal!', true
 * on the bars of the Buy / Sell labels.
 *
 * Reference: "ENVELOPE - RSI - Buy Sell Signals" by Saleh_Toodarvari
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface EnvelopeRSIInputs {
  envelopeLen: number;
  envelopePct: number;
  exponential: boolean;
  rsiLen: number;
  overboughtRSI: number;
  oversoldRSI: number;
  tpPercent: number;
  slPercent: number;
}

export const defaultInputs: EnvelopeRSIInputs = {
  envelopeLen: 8,
  envelopePct: 0.22,
  exponential: false,
  rsiLen: 8,
  overboughtRSI: 80,
  oversoldRSI: 25,
  tpPercent: 0.15,
  slPercent: 0.15,
};

export const inputConfig: InputConfig[] = [
  { id: 'envelopeLen', type: 'int', title: 'Envelope Length', defval: 8, min: 1 },
  { id: 'envelopePct', type: 'float', title: 'Envelope Percent', defval: 0.22, min: 0.01, step: 0.01 },
  { id: 'exponential', type: 'bool', title: 'Exponential', defval: false },
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 8, min: 1 },
  { id: 'overboughtRSI', type: 'float', title: 'RSI Overbought', defval: 80, min: 50, max: 100 },
  { id: 'oversoldRSI', type: 'float', title: 'RSI Oversold', defval: 25, min: 0, max: 50 },
  { id: 'tpPercent', type: 'float', title: 'TP %', defval: 0.15, min: 0.01, step: 0.01 },
  { id: 'slPercent', type: 'float', title: 'SL %', defval: 0.15, min: 0.01, step: 0.01 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'basis', title: 'Basis', color: '#ED7300', lineWidth: 1 },
  { id: 'upper', title: 'Upper', color: '#FF2424', lineWidth: 1 },
  { id: 'lower', title: 'Lower', color: '#24FF24', lineWidth: 1 },
  { id: 'sellSig', title: 'Sell Signal', color: 'transparent', lineWidth: 0 },
  { id: 'buySig', title: 'Buy Signal', color: 'transparent', lineWidth: 0 },
  { id: 'tpSig', title: 'TP', color: 'transparent', lineWidth: 0 },
  { id: 'slSig', title: 'SL', color: 'transparent', lineWidth: 0 },
];

export const metadata = {
  title: 'Envelope RSI',
  shortTitle: 'EnvRSI',
  overlay: true,
};

/** Pine ta.cross(a, b) = crossover OR crossunder (either direction) */
function cross(prevA: number, curA: number, prevB: number, curB: number): boolean {
  return (prevA <= prevB && curA > curB) || (prevA >= prevB && curA < curB);
}

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number };

interface EnvRun extends BarRunState<Record<string, never>> {
  basis: { step(v: number): number; commit(): void };
  rsi: ReturnType<typeof taStep.rsi>;
  upperArr: number[];
  lowerArr: number[];
  crossBuyArr: boolean[];
  crossSellArr: boolean[];
  basisPlot: Point[];
  upperPlot: Point[];
  lowerPlot: Point[];
  sellSigPlot: Point[];
  buySigPlot: Point[];
  tpSigPlot: Point[];
  slSigPlot: Point[];
  sellSigFillColors: string[];
  buySigFillColors: string[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

// Fill colors for TP/SL: visible for 2 bars after any cross_buy or cross_sell
// Pine: tpColor = if(cross_sell[1] or cross_sell[2] or cross_buy[1] or cross_buy[2]) color.new(#1DBC60, 30) else transparent
// slColor = same condition but color.new(#F74A58, 30)
const tpFillColor = 'rgba(29, 188, 96, 0.70)';
const slFillColor = 'rgba(247, 74, 88, 0.70)';
const transparentColor = 'rgba(0, 0, 0, 0)';

function study(inputs: Partial<EnvelopeRSIInputs>): BarStudy<EnvRun, Result> {
  const { envelopeLen, envelopePct, exponential, rsiLen, overboughtRSI, oversoldRSI, tpPercent, slPercent } = { ...defaultInputs, ...inputs };
  const k = envelopePct / 100.0;
  const warmup = envelopeLen;
  return {
    init() {
      // Envelope source = hl2
      const basis = exponential ? taStep.ema(envelopeLen) : new WindowSma(envelopeLen);
      // RSI on hl2 (Pine default rsiSourceInput = hl2)
      // Pine computes RSI manually: up = rma(max(change, 0), len), down = rma(-min(change, 0), len)
      // rsi = down==0 ? 100 : up==0 ? 0 : 100 - 100/(1+up/down)
      const rsi = taStep.rsi(rsiLen);
      const s: EnvRun = {
        basis, rsi, upperArr: [], lowerArr: [], crossBuyArr: [], crossSellArr: [], basisPlot: [], upperPlot: [],
        lowerPlot: [], sellSigPlot: [], buySigPlot: [], tpSigPlot: [], slSigPlot: [], sellSigFillColors: [],
        buySigFillColors: [], markers: [], flags: [[], []], times: [[], []],
        steps: [basis, rsi], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [
        s.upperArr, s.lowerArr, s.crossBuyArr, s.crossSellArr, s.basisPlot, s.upperPlot, s.lowerPlot, s.sellSigPlot,
        s.buySigPlot, s.tpSigPlot, s.slSigPlot, s.sellSigFillColors, s.buySigFillColors, ...s.flags,
      ];
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i]!;
      const time = bar.time;
      const hl2 = (bar.high + bar.low) / 2;
      const b = s.basis.step(hl2);
      const rsiVal = s.rsi.step(hl2);
      let curUpper = NaN;
      let curLower = NaN;
      if (b != null) {
        curUpper = b * (1 + k);
        curLower = b * (1 - k);
      }
      s.upperArr[i] = curUpper;
      s.lowerArr[i] = curLower;

      // Per-bar signal detection
      let crossBuy = false;
      let crossSell = false;
      let condBuy = false;
      let condSell = false;
      if (i >= 1) {
        const prev = bars[i - 1]!;
        const curClose = bar.close;
        const prevClose = prev.close;
        const prevUpper = s.upperArr[i - 1]!;
        const prevLower = s.lowerArr[i - 1]!;
        // cross_buy = ta.crossover(close, lower)
        crossBuy = prevClose <= prevLower && curClose > curLower;
        // cross_sell = ta.crossunder(close, upper)
        crossSell = prevClose >= prevUpper && curClose < curUpper;

        if (rsiVal != null) {
          const lo = bar.low, prevLo = prev.low;
          const hi = bar.high, prevHi = prev.high;
          const op = bar.open, prevOp = prev.open;
          // condition_buy: rsi < oversold AND ta.cross(any OHLC, lower)
          if (rsiVal < oversoldRSI) {
            condBuy =
              cross(prevLo, lo, prevLower, curLower) ||
              cross(prevClose, curClose, prevLower, curLower) ||
              cross(prevHi, hi, prevLower, curLower) ||
              cross(prevOp, op, prevLower, curLower);
          }
          // condition_sell: rsi > overbought AND ta.cross(any OHLC, upper)
          if (rsiVal > overboughtRSI) {
            condSell =
              cross(prevLo, lo, prevUpper, curUpper) ||
              cross(prevClose, curClose, prevUpper, curUpper) ||
              cross(prevHi, hi, prevUpper, curUpper) ||
              cross(prevOp, op, prevUpper, curUpper);
          }
        }
      }
      s.crossBuyArr[i] = crossBuy;
      s.crossSellArr[i] = crossSell;

      s.basisPlot[i] = { time, value: (b == null || i < warmup) ? NaN : b };
      s.upperPlot[i] = { time, value: (i < warmup || isNaN(curUpper)) ? NaN : curUpper };
      s.lowerPlot[i] = { time, value: (i < warmup || isNaN(curLower)) ? NaN : curLower };

      // sell_sig = cross_sell ? high : na
      // buy_sig = cross_buy ? ohlc4 : na
      // tp, sl computed only when condition_buy or condition_sell
      const ohlc4 = (bar.open + bar.high + bar.low + bar.close) / 4;
      s.sellSigPlot[i] = { time, value: crossSell ? bar.high : NaN };
      s.buySigPlot[i] = { time, value: crossBuy ? ohlc4 : NaN };
      let tp = NaN;
      let sl = NaN;
      if (condSell) {
        tp = ohlc4 - ohlc4 * (tpPercent / 100);
        sl = ohlc4 + ohlc4 * (slPercent / 100);
      } else if (condBuy) {
        tp = ohlc4 + ohlc4 * (tpPercent / 100);
        sl = ohlc4 - ohlc4 * (slPercent / 100);
      }
      s.tpSigPlot[i] = { time, value: tp };
      s.slSigPlot[i] = { time, value: sl };

      // Markers: plotshape(cross_sell ? condition_sell : na, ...) means show only when BOTH cross_sell AND condition_sell
      if (i >= warmup) {
        if (crossSell && condSell) {
          s.markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: '#FF0000', text: 'Sell' });
        }
        if (crossBuy && condBuy) {
          s.markers.push({ time, position: 'belowBar', shape: 'labelUp', color: '#00FF00', text: 'Buy' });
        }
      }

      const recentSignal =
        (i >= 1 && s.crossSellArr[i - 1]) || (i >= 2 && s.crossSellArr[i - 2]) ||
        (i >= 1 && s.crossBuyArr[i - 1]) || (i >= 2 && s.crossBuyArr[i - 2]);
      s.sellSigFillColors[i] = recentSignal ? tpFillColor : transparentColor;
      s.buySigFillColors[i] = recentSignal ? slFillColor : transparentColor;

      // alertConditionBuy = cross_buy and condition_buy; alertConditionSell = cross_sell and condition_sell
      const flags = [crossBuy && condBuy, crossSell && condSell];
      for (let j = 0; j < 2; j++) {
        s.flags[j]![i] = flags[j]!;
        if (flags[j]) s.times[j]!.push(time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          'basis': s.basisPlot.slice(),
          'upper': s.upperPlot.slice(),
          'lower': s.lowerPlot.slice(),
          'sellSig': s.sellSigPlot.slice(),
          'buySig': s.buySigPlot.slice(),
          'tpSig': s.tpSigPlot.slice(),
          'slSig': s.slSigPlot.slice(),
        },
        fills: [
          // fill(u, l) - envelope background
          { plot1: 'upper', plot2: 'lower', options: { color: 'rgba(33, 150, 243, 0.05)' } },
          // fill(sell_sig, tp_sig, tpColor) and fill(buy_sig, tp_sig, tpColor)
          { plot1: 'sellSig', plot2: 'tpSig', options: { color: tpFillColor }, colors: s.sellSigFillColors.slice() },
          { plot1: 'buySig', plot2: 'tpSig', options: { color: tpFillColor }, colors: s.buySigFillColors.slice() },
          // fill(buy_sig, sl_sig, slColor) and fill(sell_sig, sl_sig, slColor)
          { plot1: 'buySig', plot2: 'slSig', options: { color: slFillColor }, colors: s.buySigFillColors.slice() },
          { plot1: 'sellSig', plot2: 'slSig', options: { color: slFillColor }, colors: s.sellSigFillColors.slice() },
        ],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EnvelopeRSIInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<EnvelopeRSIInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Envelope RSI Buy signal!', message: 'Buy signal' },
  { id: 'alert1', title: 'Envelope RSI Sell signal!', message: 'Sell signal' },
];

export const EnvelopeRSI = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
