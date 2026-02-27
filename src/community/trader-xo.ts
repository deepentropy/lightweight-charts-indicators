/**
 * Trader XO Macro Trend Scanner
 *
 * EMA crossover trend detection combined with Stochastic RSI oscillator.
 * Fast/Slow EMA crossover determines bull/bear regime.
 * Stoch RSI K/D crossovers, filtered by upper/middle/lower bands,
 * generate buy/sell signals.
 *
 * Reference: TradingView "[@btc_charlie] Trader XO Macro Trend Scanner"
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData, BgColorData } from '../types';

export interface TraderXOInputs {
  fastEMA: number;
  slowEMA: number;
  smoothK: number;
  smoothD: number;
  rsiLength: number;
  stochLength: number;
  upperBand: number;
  middleBand: number;
  lowerBand: number;
}

export const defaultInputs: TraderXOInputs = {
  fastEMA: 12,
  slowEMA: 25,
  smoothK: 3,
  smoothD: 3,
  rsiLength: 14,
  stochLength: 14,
  upperBand: 80,
  middleBand: 50,
  lowerBand: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastEMA', type: 'int', title: 'Fast EMA', defval: 12, min: 1 },
  { id: 'slowEMA', type: 'int', title: 'Slow EMA', defval: 25, min: 1 },
  { id: 'smoothK', type: 'int', title: 'K Smoothing', defval: 3, min: 1 },
  { id: 'smoothD', type: 'int', title: 'D Smoothing', defval: 3, min: 1 },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'stochLength', type: 'int', title: 'Stoch Length', defval: 14, min: 1 },
  { id: 'upperBand', type: 'int', title: 'Upper Band', defval: 80, min: 1 },
  { id: 'middleBand', type: 'int', title: 'Middle Band', defval: 50, min: 1 },
  { id: 'lowerBand', type: 'int', title: 'Lower Band', defval: 20, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'K', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'D', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'Trader XO Macro Trend Scanner',
  shortTitle: 'TraderXO',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<TraderXOInputs> = {}): IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[]; bgColors: BgColorData[] } {
  const { fastEMA, slowEMA, smoothK, smoothD, rsiLength, stochLength, upperBand, middleBand, lowerBand } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeSeries = new Series(bars, (b) => b.close);

  // EMA crossover for trend direction
  const fastEMAArr = ta.ema(closeSeries, fastEMA).toArray();
  const slowEMAArr = ta.ema(closeSeries, slowEMA).toArray();

  // Stoch RSI: RSI -> Stochastic(RSI, RSI, RSI, stochLength) -> SMA(K) -> SMA(D)
  const rsi = ta.rsi(closeSeries, rsiLength);
  const rsiArr = rsi.toArray();

  // Stochastic of RSI: (rsi - lowest(rsi, stochLen)) / (highest(rsi, stochLen) - lowest(rsi, stochLen)) * 100
  const rsiHigh = ta.highest(rsi, stochLength).toArray();
  const rsiLow = ta.lowest(rsi, stochLength).toArray();

  const stochRSI: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const r = rsiArr[i];
    const h = rsiHigh[i];
    const l = rsiLow[i];
    if (r == null || isNaN(r) || h == null || isNaN(h) || l == null || isNaN(l) || h === l) {
      stochRSI[i] = NaN;
    } else {
      stochRSI[i] = ((r - l) / (h - l)) * 100;
    }
  }

  const stochSeries = Series.fromArray(bars, stochRSI);
  const kArr = ta.sma(stochSeries, smoothK).toArray();
  const dArr = ta.sma(Series.fromArray(bars, kArr), smoothD).toArray();

  const warmup = rsiLength + stochLength + smoothK + smoothD;

  // EMA crossover state: buy = fastEMA > slowEMA, sell = fastEMA < slowEMA
  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];
  const bgColors: BgColorData[] = [];

  let countBuy = 0;
  let countSell = 0;

  for (let i = 1; i < n; i++) {
    const fEMA = fastEMAArr[i] ?? 0;
    const sEMA = slowEMAArr[i] ?? 0;
    const fEMAPrev = fastEMAArr[i - 1] ?? 0;
    const sEMAPrev = slowEMAArr[i - 1] ?? 0;

    const buy = fEMA > sEMA;
    const sell = fEMA < sEMA;
    const prevBuy = fEMAPrev > sEMAPrev;

    if (buy) { countBuy += 1; countSell = 0; }
    if (sell) { countSell += 1; countBuy = 0; }

    const buysignal = countBuy < 2 && countBuy > 0 && countSell < 1 && buy && !prevBuy;
    const sellsignal = countSell > 0 && countSell < 2 && countBuy < 1 && sell && prevBuy;
    const bull = countBuy > 1;
    const bear = countSell > 1;

    // Bar colors: Pine barcolor for buy/sell signal and sustained bull/bear
    if (buysignal || bull) {
      barColors.push({ time: bars[i].time, color: '#26A69A' });
    } else if (sellsignal || bear) {
      barColors.push({ time: bars[i].time, color: '#EF5350' });
    }

    // Stoch RSI crossover signals
    if (i >= warmup) {
      const kVal = kArr[i];
      const dVal = dArr[i];
      const kPrev = kArr[i - 1];
      const dPrev = dArr[i - 1];
      if (kVal != null && !isNaN(kVal) && dVal != null && !isNaN(dVal) &&
          kPrev != null && !isNaN(kPrev) && dPrev != null && !isNaN(dPrev)) {

        const crossUp = kPrev <= dPrev && kVal > dVal;
        const crossDown = kPrev >= dPrev && kVal < dVal;

        // Background colors for crossover alerts (Pine: bgcolor for crossover at middle band level)
        if (crossUp && (kVal < middleBand || dVal < middleBand)) {
          markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#4CAF50', text: 'Bull' });
          bgColors.push({ time: bars[i].time, color: 'rgba(76,175,80,0.15)' });
        } else if (crossDown && (kVal > middleBand || dVal > middleBand)) {
          markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#FF0000', text: 'Bear' });
          bgColors.push({ time: bars[i].time, color: 'rgba(255,0,0,0.15)' });
        }
      }
    }
  }

  const plot0 = kArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null || isNaN(v)) ? NaN : v,
  }));

  const plot1 = dArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null || isNaN(v)) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    hlines: [
      { value: upperBand, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Overbought' } },
      { value: middleBand, options: { color: '#787B86', linestyle: 'dotted' as const, title: 'Midline' } },
      { value: lowerBand, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Oversold' } },
    ],
    markers,
    barColors,
    bgColors,
  };
}

export const TraderXO = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
