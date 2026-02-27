/**
 * Envelope RSI - Buy Sell Signals
 *
 * Price envelope overlay: basis = EMA or SMA of hl2, upper = basis*(1+pct), lower = basis*(1-pct).
 * Buy/Sell signals based on price crossing envelope bands + RSI filter.
 *
 * Reference: TradingView "ENVELOPE - RSI - Buy Sell Signals" by Saleh_Toodarvari
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface EnvelopeRSIInputs {
  envelopeLen: number;
  envelopePct: number;
  exponential: boolean;
  rsiLen: number;
  overboughtRSI: number;
  oversoldRSI: number;
}

export const defaultInputs: EnvelopeRSIInputs = {
  envelopeLen: 8,
  envelopePct: 0.22,
  exponential: false,
  rsiLen: 8,
  overboughtRSI: 80,
  oversoldRSI: 25,
};

export const inputConfig: InputConfig[] = [
  { id: 'envelopeLen', type: 'int', title: 'Envelope Length', defval: 8, min: 1 },
  { id: 'envelopePct', type: 'float', title: 'Envelope Percent', defval: 0.22, min: 0.01, step: 0.01 },
  { id: 'exponential', type: 'bool', title: 'Exponential', defval: false },
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 8, min: 1 },
  { id: 'overboughtRSI', type: 'float', title: 'RSI Overbought', defval: 80, min: 50, max: 100 },
  { id: 'oversoldRSI', type: 'float', title: 'RSI Oversold', defval: 25, min: 0, max: 50 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'basis', title: 'Basis', color: '#ED7300', lineWidth: 1 },
  { id: 'upper', title: 'Upper', color: '#FF2424', lineWidth: 1 },
  { id: 'lower', title: 'Lower', color: '#24FF24', lineWidth: 1 },
];

export const metadata = {
  title: 'Envelope RSI',
  shortTitle: 'EnvRSI',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<EnvelopeRSIInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { envelopeLen, envelopePct, exponential, rsiLen, overboughtRSI, oversoldRSI } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // Envelope source = hl2
  const hl2 = new Series(bars, (b) => (b.high + b.low) / 2);
  const basisSeries = exponential ? ta.ema(hl2, envelopeLen) : ta.sma(hl2, envelopeLen);
  const basisArr = basisSeries.toArray();

  const k = envelopePct / 100.0;
  const warmup = envelopeLen;

  const basisPlot = basisArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v,
  }));

  const upperPlot = basisArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v * (1 + k),
  }));

  const lowerPlot = basisArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v * (1 - k),
  }));

  // RSI on hl2 source (Pine uses hl2 as rsiSourceInput default)
  const rsiSeries = ta.rsi(hl2, rsiLen);
  const rsiArr = rsiSeries.toArray();

  // cross_buy = crossover(close, lower), cross_sell = crossunder(close, upper)
  // condition_buy = rsi < oversoldRSI AND price crosses lower band
  // condition_sell = rsi > overboughtRSI AND price crosses upper band
  const markers: MarkerData[] = [];

  for (let i = warmup + 1; i < n; i++) {
    const b = basisArr[i];
    const prevB = basisArr[i - 1];
    if (b == null || prevB == null) continue;

    const upper = b * (1 + k);
    const lower = b * (1 - k);
    const prevUpper = prevB * (1 + k);
    const prevLower = prevB * (1 - k);

    const curClose = bars[i].close;
    const prevClose = bars[i - 1].close;
    const rsiVal = rsiArr[i];
    if (rsiVal == null) continue;

    // cross_buy: close crosses above lower
    const crossBuy = prevClose <= prevLower && curClose > lower;
    // cross_sell: close crosses below upper
    const crossSell = prevClose >= prevUpper && curClose < upper;

    // condition_buy: rsi < oversold AND (any of low/close/high/open crosses lower)
    if (crossBuy) {
      const lo = bars[i].low;
      const hi = bars[i].high;
      const op = bars[i].open;
      const prevLo = bars[i - 1].low;
      const prevHi = bars[i - 1].high;
      const prevOp = bars[i - 1].open;

      const anyCrossLower =
        (prevLo <= prevLower && lo > lower) || (prevLo >= prevLower && lo < lower) ||
        (prevClose <= prevLower && curClose > lower) || (prevClose >= prevLower && curClose < lower) ||
        (prevHi <= prevLower && hi > lower) || (prevHi >= prevLower && hi < lower) ||
        (prevOp <= prevLower && op > lower) || (prevOp >= prevLower && op < lower);

      if (rsiVal < oversoldRSI && anyCrossLower) {
        markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#00FF00', text: 'Buy' });
      }
    }

    // condition_sell: rsi > overbought AND (any of low/close/high/open crosses upper)
    if (crossSell) {
      const lo = bars[i].low;
      const hi = bars[i].high;
      const op = bars[i].open;
      const prevLo = bars[i - 1].low;
      const prevHi = bars[i - 1].high;
      const prevOp = bars[i - 1].open;

      const anyCrossUpper =
        (prevLo <= prevUpper && lo > upper) || (prevLo >= prevUpper && lo < upper) ||
        (prevClose <= prevUpper && curClose > upper) || (prevClose >= prevUpper && curClose < upper) ||
        (prevHi <= prevUpper && hi > upper) || (prevHi >= prevUpper && hi < upper) ||
        (prevOp <= prevUpper && op > upper) || (prevOp >= prevUpper && op < upper);

      if (rsiVal > overboughtRSI && anyCrossUpper) {
        markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#FF0000', text: 'Sell' });
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'basis': basisPlot, 'upper': upperPlot, 'lower': lowerPlot },
    fills: [
      { plot1: 'upper', plot2: 'lower', options: { color: 'rgba(33, 150, 243, 0.05)' } },
    ],
    markers,
  };
}

export const EnvelopeRSI = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
