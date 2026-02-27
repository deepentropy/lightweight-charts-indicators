/**
 * Trader XO Macro Trend Scanner
 *
 * Overlay indicator (overlay=true) with:
 * - Consolidated EMA (shown when bothEMAs=false), colored green/red/#FF530D based on fast vs slow EMA
 * - Fast EMA (shown when bothEMAs=true), colored green/red/#FF530D based on trend
 * - Slow EMA (shown when bothEMAs=true), colored green/red/#FF530D based on trend
 * - Bull/Bear triangle markers on EMA crossover
 * - barcolor: green for bull/buysignal bars, red for bear/sellsignal bars
 * - bgcolor for Stoch RSI crossover alerts (mid-level, OB/OS-level, K>upper, K<lower)
 * - Moving average filter (EMA/WMA/SMA/None) gating Stoch RSI crossover checks
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
  crossoverBgMid: boolean;
  crossoverBgOBOS: boolean;
  crossoverBgGreater: boolean;
  crossoverBgLess: boolean;
  maType: string;
  maLength: number;
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
  crossoverBgMid: false,
  crossoverBgOBOS: false,
  crossoverBgGreater: false,
  crossoverBgLess: false,
  maType: 'EMA',
  maLength: 200,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastEMA', type: 'int', title: 'Fast EMA', defval: 12, min: 1 },
  { id: 'slowEMA', type: 'int', title: 'Slow EMA', defval: 25, min: 1 },
  { id: 'defEMA', type: 'int', title: 'Consolidated EMA', defval: 25, min: 1 },
  { id: 'bothEMAs', type: 'bool', title: 'Show Both EMAs', defval: true },
  { id: 'smoothK', type: 'int', title: 'K', defval: 3, min: 1 },
  { id: 'smoothD', type: 'int', title: 'D', defval: 3, min: 1 },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'stochLength', type: 'int', title: 'Stochastic Length', defval: 14, min: 1 },
  { id: 'upperBand', type: 'int', title: 'Upper Band', defval: 80, min: 1 },
  { id: 'middleBand', type: 'int', title: 'Middle Band', defval: 50, min: 1 },
  { id: 'lowerBand', type: 'int', title: 'Lower Band', defval: 20, min: 1 },
  { id: 'crossoverBgMid', type: 'bool', title: 'Crossover Alert BG (Middle Level)', defval: false },
  { id: 'crossoverBgOBOS', type: 'bool', title: 'Crossover Alert BG (OB/OS Level)', defval: false },
  { id: 'crossoverBgGreater', type: 'bool', title: 'Crossover Alert >input', defval: false },
  { id: 'crossoverBgLess', type: 'bool', title: 'Crossover Alert <input', defval: false },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'EMA', options: ['EMA', 'WMA', 'SMA', 'None'] },
  { id: 'maLength', type: 'int', title: 'MA Length', defval: 200, min: 1 },
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
  const {
    fastEMA, slowEMA, defEMA, bothEMAs,
    smoothK, smoothD, rsiLength, stochLength,
    upperBand, middleBand, lowerBand,
    crossoverBgMid, crossoverBgOBOS, crossoverBgGreater, crossoverBgLess,
    maType, maLength,
  } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeSeries = new Series(bars, (b) => b.close);

  // EMA calculations
  const fastEMAArr = ta.ema(closeSeries, fastEMA).toArray();
  const slowEMAArr = ta.ema(closeSeries, slowEMA).toArray();
  const biasEMAArr = ta.ema(closeSeries, defEMA).toArray();

  // Moving average filter for Stoch RSI crossover checks
  let maArr: number[] | null = null;
  if (maType !== 'None') {
    if (maType === 'EMA') {
      maArr = ta.ema(closeSeries, maLength).toArray();
    } else if (maType === 'WMA') {
      maArr = ta.wma(closeSeries, maLength).toArray();
    } else if (maType === 'SMA') {
      maArr = ta.sma(closeSeries, maLength).toArray();
    }
  }

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

    // Pine: emaColor = v_fastEMA > v_slowEMA ? color.green : v_fastEMA < v_slowEMA ? color.red : #FF530D
    let emaColor = '#FF530D';
    if (!isNaN(fEMA) && !isNaN(sEMA)) {
      if (fEMA > sEMA) emaColor = '#26A69A';
      else if (fEMA < sEMA) emaColor = '#EF5350';
    }

    // Pine: plot(i_bothEMAs ? na : v_biasEMA, color=emaColor, linewidth=3, title='Consolidated EMA')
    consolidatedEMAPlot.push({
      time: bars[i].time,
      value: (!bothEMAs && i >= warmup) ? bEMA : NaN,
      color: emaColor,
    });

    // Pine: plot(i_bothEMAs ? v_fastEMA : na, title='Fast EMA', color=emaColor)
    fastEMAPlot.push({
      time: bars[i].time,
      value: (bothEMAs && i >= warmup) ? fEMA : NaN,
      color: emaColor,
    });

    // Pine: plot(i_bothEMAs ? v_slowEMA : na, title='Slow EMA', color=emaColor)
    slowEMAPlot.push({
      time: bars[i].time,
      value: (bothEMAs && i >= warmup) ? sEMA : NaN,
      color: emaColor,
    });

    // EMA crossover state tracking (need previous bar)
    const buy = fEMA > sEMA;
    const sell = fEMA < sEMA;

    if (buy) { countBuy += 1; }
    if (buy) { countSell = 0; }
    if (sell) { countSell += 1; }
    if (sell) { countBuy = 0; }

    if (i >= 1) {
      const fEMAPrev = fastEMAArr[i - 1] ?? NaN;
      const sEMAPrev = slowEMAArr[i - 1] ?? NaN;
      const prevBuy = !isNaN(fEMAPrev) && !isNaN(sEMAPrev) && fEMAPrev > sEMAPrev;
      const prevSell = !isNaN(fEMAPrev) && !isNaN(sEMAPrev) && fEMAPrev < sEMAPrev;

      // Pine: buysignal = countBuy < 2 and countBuy > 0 and countSell < 1 and buy and not buy[1]
      const buysignal = countBuy < 2 && countBuy > 0 && countSell < 1 && buy && !prevBuy;
      // Pine: sellsignal = countSell > 0 and countSell < 2 and countBuy < 1 and sell and not sell[1]
      const sellsignal = countSell > 0 && countSell < 2 && countBuy < 1 && sell && !prevSell;

      const bull = countBuy > 1;
      const bear = countSell > 1;

      // Pine barcolor: buysignal green, sellsignal red, then bull green, bear red
      // In Pine, later barcolor calls override earlier ones. Since buysignal and bull
      // are mutually exclusive (buysignal needs countBuy==1, bull needs countBuy>=2),
      // we can just check all conditions.
      if (buysignal || bull) {
        barColors.push({ time: bars[i].time, color: '#26A69A' });
      } else if (sellsignal || bear) {
        barColors.push({ time: bars[i].time, color: '#EF5350' });
      }

      // Pine: plotshape Bull triangle below bar
      if (buysignal) {
        markers.push({
          time: bars[i].time,
          position: 'belowBar',
          shape: 'triangleUp',
          color: '#26A69A',
          text: 'Bull',
        });
      }
      // Pine: plotshape Bear triangle above bar
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

          // Pine: crossupCHECK = maTypeChoice == 'None' or open > maValue and maTypeChoice != 'None'
          // Pine: crossdownCHECK = maTypeChoice == 'None' or open < maValue and maTypeChoice != 'None'
          const maVal = maArr ? (maArr[i] ?? NaN) : NaN;
          const crossupCHECK = maType === 'None' || (!isNaN(maVal) && bars[i].open > maVal);
          const crossdownCHECK = maType === 'None' || (!isNaN(maVal) && bars[i].open < maVal);

          const crossupalert = crossupCHECK && crossUp && (kVal < middleBand || dVal < middleBand);
          const crossdownalert = crossdownCHECK && crossDown && (kVal > middleBand || dVal > middleBand);
          const crossupOSalert = crossupCHECK && crossUp && (kVal < lowerBand || dVal < lowerBand);
          const crossdownOBalert = crossdownCHECK && crossDown && (kVal > upperBand || dVal > upperBand);

          const aboveBandalert = kPrev >= upperBand && kVal < upperBand; // ta.crossunder(k, bandno0)
          const belowBandalert = kPrev <= lowerBand && kVal > lowerBand; // ta.crossover(k, bandno1)

          // Pine bgcolor line 121: mid-level crossover (guarded by crossoverAlertBgColourMidOnOff)
          if (crossoverBgMid) {
            if (crossupalert) {
              bgColors.push({ time: bars[i].time, color: 'rgba(76,175,80,0.30)' });
            } else if (crossdownalert) {
              bgColors.push({ time: bars[i].time, color: 'rgba(255,0,0,0.30)' });
            }
          }

          // Pine bgcolor line 122: OB/OS-level crossover (guarded by crossoverAlertBgColourOBOSOnOff)
          if (crossoverBgOBOS) {
            if (crossupOSalert) {
              bgColors.push({ time: bars[i].time, color: 'rgba(251,192,45,0.30)' });
            } else if (crossdownOBalert) {
              bgColors.push({ time: bars[i].time, color: 'rgba(0,0,0,0.30)' });
            }
          }

          // Pine bgcolor line 123: K > Upper level (guarded by crossoverAlertBgColourGreaterThanOnOff)
          // bgcolor(color=aboveBandalert and ... ? #ff0014 : crossdownalert and crossoverAlertBgColourMidOnOff ? #FF0000 : na, ...)
          if (crossoverBgGreater) {
            if (aboveBandalert) {
              bgColors.push({ time: bars[i].time, color: 'rgba(255,0,20,0.30)' });
            } else if (crossdownalert && crossoverBgMid) {
              bgColors.push({ time: bars[i].time, color: 'rgba(255,0,0,0.30)' });
            }
          }

          // Pine bgcolor line 124: K < Lower level (guarded by crossoverAlertBgColourLessThanOnOff)
          // bgcolor(color=belowBandalert and ... ? #4CAF50 : crossdownalert and crossoverAlertBgColourMidOnOff ? #FF0000 : na, ...)
          if (crossoverBgLess) {
            if (belowBandalert) {
              bgColors.push({ time: bars[i].time, color: 'rgba(76,175,80,0.30)' });
            } else if (crossdownalert && crossoverBgMid) {
              bgColors.push({ time: bars[i].time, color: 'rgba(255,0,0,0.30)' });
            }
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
