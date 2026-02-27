/**
 * Envelope RSI - Buy Sell Signals
 *
 * Price envelope overlay: basis = EMA or SMA of hl2, upper = basis*(1+pct), lower = basis*(1-pct).
 * Buy/Sell signals based on price crossing envelope bands + RSI filter.
 * TP/SL bands appear for 2 bars after each signal as green (TP) and red (SL) fills.
 *
 * Reference: TradingView "ENVELOPE - RSI - Buy Sell Signals" by Saleh_Toodarvari
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

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

export function calculate(bars: Bar[], inputs: Partial<EnvelopeRSIInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { envelopeLen, envelopePct, exponential, rsiLen, overboughtRSI, oversoldRSI, tpPercent, slPercent } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // Envelope source = hl2
  const hl2 = new Series(bars, (b) => (b.high + b.low) / 2);
  const basisSeries = exponential ? ta.ema(hl2, envelopeLen) : ta.sma(hl2, envelopeLen);
  const basisArr = basisSeries.toArray();

  const k = envelopePct / 100.0;
  const warmup = envelopeLen;

  // RSI on hl2 (Pine default rsiSourceInput = hl2)
  // Pine computes RSI manually: up = rma(max(change, 0), len), down = rma(-min(change, 0), len)
  // rsi = down==0 ? 100 : up==0 ? 0 : 100 - 100/(1+up/down)
  const rsiSeries = ta.rsi(hl2, rsiLen);
  const rsiArr = rsiSeries.toArray();

  // Precompute upper/lower arrays
  const upperArr = new Array<number>(n);
  const lowerArr = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const b = basisArr[i];
    if (b != null) {
      upperArr[i] = b * (1 + k);
      lowerArr[i] = b * (1 - k);
    } else {
      upperArr[i] = NaN;
      lowerArr[i] = NaN;
    }
  }

  // Per-bar signal detection
  const crossBuyArr = new Array<boolean>(n).fill(false);
  const crossSellArr = new Array<boolean>(n).fill(false);
  const condBuyArr = new Array<boolean>(n).fill(false);
  const condSellArr = new Array<boolean>(n).fill(false);

  for (let i = 1; i < n; i++) {
    if (basisArr[i] == null || basisArr[i - 1] == null) continue;

    const curClose = bars[i].close;
    const prevClose = bars[i - 1].close;
    const curUpper = upperArr[i];
    const prevUpper = upperArr[i - 1];
    const curLower = lowerArr[i];
    const prevLower = lowerArr[i - 1];

    // cross_buy = ta.crossover(close, lower)
    crossBuyArr[i] = prevClose <= prevLower && curClose > curLower;
    // cross_sell = ta.crossunder(close, upper)
    crossSellArr[i] = prevClose >= prevUpper && curClose < curUpper;

    const rsiVal = rsiArr[i];
    if (rsiVal == null) continue;

    // condition_buy: rsi < oversold AND ta.cross(any OHLC, lower)
    if (rsiVal < oversoldRSI) {
      const lo = bars[i].low, prevLo = bars[i - 1].low;
      const hi = bars[i].high, prevHi = bars[i - 1].high;
      const op = bars[i].open, prevOp = bars[i - 1].open;
      const anyCrossLower =
        cross(prevLo, lo, prevLower, curLower) ||
        cross(prevClose, curClose, prevLower, curLower) ||
        cross(prevHi, hi, prevLower, curLower) ||
        cross(prevOp, op, prevLower, curLower);
      condBuyArr[i] = anyCrossLower;
    }

    // condition_sell: rsi > overbought AND ta.cross(any OHLC, upper)
    if (rsiVal > overboughtRSI) {
      const lo = bars[i].low, prevLo = bars[i - 1].low;
      const hi = bars[i].high, prevHi = bars[i - 1].high;
      const op = bars[i].open, prevOp = bars[i - 1].open;
      const anyCrossUpper =
        cross(prevLo, lo, prevUpper, curUpper) ||
        cross(prevClose, curClose, prevUpper, curUpper) ||
        cross(prevHi, hi, prevUpper, curUpper) ||
        cross(prevOp, op, prevUpper, curUpper);
      condSellArr[i] = anyCrossUpper;
    }
  }

  // Build plot arrays
  const basisPlot = basisArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v,
  }));
  const upperPlot = upperArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || isNaN(v)) ? NaN : v,
  }));
  const lowerPlot = lowerArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || isNaN(v)) ? NaN : v,
  }));

  // sell_sig = cross_sell ? high : na
  // buy_sig = cross_buy ? ohlc4 : na
  // tp, sl computed only when condition_buy or condition_sell
  const sellSigPlot: { time: number; value: number }[] = [];
  const buySigPlot: { time: number; value: number }[] = [];
  const tpSigPlot: { time: number; value: number }[] = [];
  const slSigPlot: { time: number; value: number }[] = [];

  const markers: MarkerData[] = [];

  for (let i = 0; i < n; i++) {
    const time = bars[i].time;
    const ohlc4 = (bars[i].open + bars[i].high + bars[i].low + bars[i].close) / 4;

    // sell_sig plot: cross_sell ? high : NaN
    sellSigPlot.push({ time, value: crossSellArr[i] ? bars[i].high : NaN });
    // buy_sig plot: cross_buy ? ohlc4 : NaN
    buySigPlot.push({ time, value: crossBuyArr[i] ? ohlc4 : NaN });

    // tp/sl: only when condition fires
    let tp = NaN;
    let sl = NaN;
    if (condSellArr[i]) {
      tp = ohlc4 - ohlc4 * (tpPercent / 100);
      sl = ohlc4 + ohlc4 * (slPercent / 100);
    } else if (condBuyArr[i]) {
      tp = ohlc4 + ohlc4 * (tpPercent / 100);
      sl = ohlc4 - ohlc4 * (slPercent / 100);
    }
    tpSigPlot.push({ time, value: tp });
    slSigPlot.push({ time, value: sl });

    // Markers: plotshape(cross_sell ? condition_sell : na, ...) means show only when BOTH cross_sell AND condition_sell
    if (i >= warmup) {
      if (crossSellArr[i] && condSellArr[i]) {
        markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: '#FF0000', text: 'Sell' });
      }
      if (crossBuyArr[i] && condBuyArr[i]) {
        markers.push({ time, position: 'belowBar', shape: 'labelUp', color: '#00FF00', text: 'Buy' });
      }
    }
  }

  // Fill colors for TP/SL: visible for 2 bars after any cross_buy or cross_sell
  // Pine: tpColor = if(cross_sell[1] or cross_sell[2] or cross_buy[1] or cross_buy[2]) color.new(#1DBC60, 30) else transparent
  // slColor = same condition but color.new(#F74A58, 30)
  const tpFillColor = 'rgba(29, 188, 96, 0.70)';
  const slFillColor = 'rgba(247, 74, 88, 0.70)';
  const transparentColor = 'rgba(0, 0, 0, 0)';

  const sellSigFillColors: string[] = [];
  const buySigFillColors: string[] = [];
  for (let i = 0; i < n; i++) {
    const recentSignal =
      (i >= 1 && crossSellArr[i - 1]) || (i >= 2 && crossSellArr[i - 2]) ||
      (i >= 1 && crossBuyArr[i - 1]) || (i >= 2 && crossBuyArr[i - 2]);
    sellSigFillColors.push(recentSignal ? tpFillColor : transparentColor);
    buySigFillColors.push(recentSignal ? slFillColor : transparentColor);
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'basis': basisPlot,
      'upper': upperPlot,
      'lower': lowerPlot,
      'sellSig': sellSigPlot,
      'buySig': buySigPlot,
      'tpSig': tpSigPlot,
      'slSig': slSigPlot,
    },
    fills: [
      // fill(u, l) - envelope background
      { plot1: 'upper', plot2: 'lower', options: { color: 'rgba(33, 150, 243, 0.05)' } },
      // fill(sell_sig, tp_sig, tpColor) and fill(buy_sig, tp_sig, tpColor)
      { plot1: 'sellSig', plot2: 'tpSig', options: { color: tpFillColor }, colors: sellSigFillColors },
      { plot1: 'buySig', plot2: 'tpSig', options: { color: tpFillColor }, colors: buySigFillColors },
      // fill(buy_sig, sl_sig, slColor) and fill(sell_sig, sl_sig, slColor)
      { plot1: 'buySig', plot2: 'slSig', options: { color: slFillColor }, colors: buySigFillColors },
      { plot1: 'sellSig', plot2: 'slSig', options: { color: slFillColor }, colors: sellSigFillColors },
    ],
    markers,
  };
}

export const EnvelopeRSI = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
