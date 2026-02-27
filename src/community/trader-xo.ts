/**
 * Trader XO Macro Trend Scanner
 *
 * Overlay indicator (overlay=true) with:
 * - Consolidated EMA (shown when bothEMAs=false), colored green/red based on fast vs slow EMA
 * - Fast EMA (shown when bothEMAs=true), colored green/red based on trend
 * - Slow EMA (shown when bothEMAs=true), colored green/red based on trend
 * - Bull/Bear triangles on EMA crossover
 * - barcolor: green for bull bars, red for bear bars
 * - bgcolor for Stoch RSI crossover alerts at middle band
 *
 * Reference: TradingView "[@btc_charlie] Trader XO Macro Trend Scanner"
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData, BgColorData } from '../types';

export interface TraderXOInputs {
  fastEMA: number;
  slowEMA: number;
  defEMA: number;
  bothEMAs: boolean;
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
  defEMA: 25,
  bothEMAs: true,
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
  { id: 'defEMA', type: 'int', title: 'Consolidated EMA', defval: 25, min: 1 },
  { id: 'bothEMAs', type: 'bool', title: 'Show Both EMAs', defval: true },
  { id: 'smoothK', type: 'int', title: 'K Smoothing', defval: 3, min: 1 },
  { id: 'smoothD', type: 'int', title: 'D Smoothing', defval: 3, min: 1 },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'stochLength', type: 'int', title: 'Stoch Length', defval: 14, min: 1 },
  { id: 'upperBand', type: 'int', title: 'Upper Band', defval: 80, min: 1 },
  { id: 'middleBand', type: 'int', title: 'Middle Band', defval: 50, min: 1 },
  { id: 'lowerBand', type: 'int', title: 'Lower Band', defval: 20, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'consolidatedEMA', title: 'Consolidated EMA', color: '#26A69A', lineWidth: 3 },
  { id: 'fastEMAPlot', title: 'Fast EMA', color: '#26A69A', lineWidth: 1 },
  { id: 'slowEMAPlot', title: 'Slow EMA', color: '#26A69A', lineWidth: 1 },
];

export const metadata = {
  title: 'Trader XO Macro Trend Scanner',
  shortTitle: 'TraderXO',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<TraderXOInputs> = {}): IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[]; bgColors: BgColorData[] } {
  const { fastEMA, slowEMA, defEMA, bothEMAs, smoothK, smoothD, rsiLength, stochLength, upperBand, middleBand, lowerBand } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeSeries = new Series(bars, (b) => b.close);

  // EMA calculations
  const fastEMAArr = ta.ema(closeSeries, fastEMA).toArray();
  const slowEMAArr = ta.ema(closeSeries, slowEMA).toArray();
  const biasEMAArr = ta.ema(closeSeries, defEMA).toArray();

  // Stoch RSI calculation
  const rsi = ta.rsi(closeSeries, rsiLength);
  const rsiArr = rsi.toArray();
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

  const warmup = Math.max(fastEMA, slowEMA, defEMA);
  const stochWarmup = rsiLength + stochLength + smoothK + smoothD;

  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];
  const bgColors: BgColorData[] = [];

  let countBuy = 0;
  let countSell = 0;

  // EMA plots with per-bar conditional coloring
  const consolidatedEMAPlot: { time: number; value: number; color?: string }[] = [];
  const fastEMAPlot: { time: number; value: number; color?: string }[] = [];
  const slowEMAPlot: { time: number; value: number; color?: string }[] = [];

  for (let i = 0; i < n; i++) {
    const fEMA = fastEMAArr[i] ?? NaN;
    const sEMA = slowEMAArr[i] ?? NaN;
    const bEMA = biasEMAArr[i] ?? NaN;

    // Pine: emaColor = v_fastEMA > v_slowEMA ? green : v_fastEMA < v_slowEMA ? red : #FF530D
    let emaColor = '#FF530D';
    if (!isNaN(fEMA) && !isNaN(sEMA)) {
      if (fEMA > sEMA) emaColor = '#26A69A';
      else if (fEMA < sEMA) emaColor = '#EF5350';
    }

    // Pine: plot(i_bothEMAs ? na : v_biasEMA, ...)
    consolidatedEMAPlot.push({
      time: bars[i].time,
      value: (!bothEMAs && i >= warmup) ? bEMA : NaN,
      color: emaColor,
    });

    // Pine: plot(i_bothEMAs ? v_fastEMA : na, ...)
    fastEMAPlot.push({
      time: bars[i].time,
      value: (bothEMAs && i >= warmup) ? fEMA : NaN,
      color: emaColor,
    });

    // Pine: plot(i_bothEMAs ? v_slowEMA : na, ...)
    slowEMAPlot.push({
      time: bars[i].time,
      value: (bothEMAs && i >= warmup) ? sEMA : NaN,
      color: emaColor,
    });

    // EMA crossover state tracking
    if (i >= 1) {
      const buy = fEMA > sEMA;
      const sell = fEMA < sEMA;
      const fEMAPrev = fastEMAArr[i - 1] ?? 0;
      const sEMAPrev = slowEMAArr[i - 1] ?? 0;
      const prevBuy = fEMAPrev > sEMAPrev;

      if (buy) { countBuy += 1; countSell = 0; }
      if (sell) { countSell += 1; countBuy = 0; }

      const buysignal = countBuy < 2 && countBuy > 0 && countSell < 1 && buy && !prevBuy;
      const sellsignal = countSell > 0 && countSell < 2 && countBuy < 1 && sell && prevBuy;
      const bull = countBuy > 1;
      const bear = countSell > 1;

      // Pine: barcolor
      if (buysignal) {
        barColors.push({ time: bars[i].time, color: '#26A69A' });
      } else if (sellsignal) {
        barColors.push({ time: bars[i].time, color: '#EF5350' });
      } else if (bull) {
        barColors.push({ time: bars[i].time, color: '#26A69A' });
      } else if (bear) {
        barColors.push({ time: bars[i].time, color: '#EF5350' });
      }

      // Pine: plotshape Bull/Bear on first crossover bar
      if (buysignal) {
        markers.push({
          time: bars[i].time,
          position: 'belowBar',
          shape: 'triangleUp',
          color: '#26A69A',
          text: 'Bull',
        });
      }
      if (sellsignal) {
        markers.push({
          time: bars[i].time,
          position: 'aboveBar',
          shape: 'triangleDown',
          color: '#EF5350',
          text: 'Bear',
        });
      }

      // Stoch RSI crossover bgcolor signals
      if (i >= stochWarmup) {
        const kVal = kArr[i];
        const dVal = dArr[i];
        const kPrev = kArr[i - 1];
        const dPrev = dArr[i - 1];
        if (kVal != null && !isNaN(kVal) && dVal != null && !isNaN(dVal) &&
            kPrev != null && !isNaN(kPrev) && dPrev != null && !isNaN(dPrev)) {

          const crossUp = kPrev <= dPrev && kVal > dVal;
          const crossDown = kPrev >= dPrev && kVal < dVal;

          // Pine: bgcolor for crossover at middle band
          if (crossUp && (kVal < middleBand || dVal < middleBand)) {
            bgColors.push({ time: bars[i].time, color: 'rgba(76,175,80,0.30)' });
          } else if (crossDown && (kVal > middleBand || dVal > middleBand)) {
            bgColors.push({ time: bars[i].time, color: 'rgba(255,0,0,0.30)' });
          }
        }
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'consolidatedEMA': consolidatedEMAPlot,
      'fastEMAPlot': fastEMAPlot,
      'slowEMAPlot': slowEMAPlot,
    },
    markers,
    barColors,
    bgColors,
  };
}

export const TraderXO = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
