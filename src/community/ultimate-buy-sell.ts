/**
 * The Ultimate Buy and Sell Indicator
 *
 * Multi-component buy/sell system combining RSI with Bollinger Bands,
 * Price Bollinger Bands, watch signals, and MA-based candle coloring.
 * RSI crosses BB bands to set "watch" flags; buy/sell when RSI crosses
 * basis while watch flag is active within a configurable lookback window.
 *
 * Reference: TradingView "Ultimate Buy and Sell Indicator"
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';

export interface UltimateBuySellInputs {
  rsiLength: number;
  rsiMaType: string;
  rsiBbMaType: string;
  rsiBbLength: number;
  rsiMultiplier: number;
  priceBbLength: number;
  priceMaType: string;
  priceInnerMult: number;
  priceOuterMult: number;
  watchLookback: number;
  fastMaType: string;
  fastMaLength: number;
  slowMaType: string;
  slowMaLength: number;
}

export const defaultInputs: UltimateBuySellInputs = {
  rsiLength: 32,
  rsiMaType: 'RMA',
  rsiBbMaType: 'SMA',
  rsiBbLength: 32,
  rsiMultiplier: 2.0,
  priceBbLength: 20,
  priceMaType: 'SMA',
  priceInnerMult: 2.1,
  priceOuterMult: 2.4,
  watchLookback: 35,
  fastMaType: 'WMA',
  fastMaLength: 10,
  slowMaType: 'WMA',
  slowMaLength: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 32, min: 1 },
  { id: 'rsiMaType', type: 'string', title: 'RSI Calculation MA', defval: 'RMA', options: ['SMA', 'EMA', 'WMA', 'RMA'] },
  { id: 'rsiBbMaType', type: 'string', title: 'RSI BB MA Type', defval: 'SMA', options: ['SMA', 'EMA', 'WMA', 'RMA'] },
  { id: 'rsiBbLength', type: 'int', title: 'RSI BB Length', defval: 32, min: 1 },
  { id: 'rsiMultiplier', type: 'float', title: 'RSI BB StdDev', defval: 2.0, min: 1, max: 3, step: 0.1 },
  { id: 'priceBbLength', type: 'int', title: 'Price BB Length', defval: 20, min: 2 },
  { id: 'priceMaType', type: 'string', title: 'Price BB MA Type', defval: 'SMA', options: ['SMA', 'EMA', 'WMA', 'RMA'] },
  { id: 'priceInnerMult', type: 'float', title: 'Price Inner BB Mult', defval: 2.1, min: 1, max: 4, step: 0.1 },
  { id: 'priceOuterMult', type: 'float', title: 'Price Outer BB Mult', defval: 2.4, min: 2, max: 6, step: 0.1 },
  { id: 'watchLookback', type: 'int', title: 'Watch Signal Lookback', defval: 35, min: 5, step: 5 },
  { id: 'fastMaType', type: 'string', title: 'Fast MA Type', defval: 'WMA', options: ['SMA', 'EMA', 'WMA', 'RMA'] },
  { id: 'fastMaLength', type: 'int', title: 'Fast MA Length', defval: 10, min: 1 },
  { id: 'slowMaType', type: 'string', title: 'Slow MA Type', defval: 'WMA', options: ['SMA', 'EMA', 'WMA', 'RMA'] },
  { id: 'slowMaLength', type: 'int', title: 'Slow MA Length', defval: 20, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'priceBasis', title: 'Price BB Basis', color: '#FF8C00', lineWidth: 1 },
  { id: 'upperInner', title: 'Upper Inner BB', color: 'transparent', lineWidth: 1 },
  { id: 'lowerInner', title: 'Lower Inner BB', color: 'transparent', lineWidth: 1 },
  { id: 'upperOuter', title: 'Upper Outer BB', color: 'transparent', lineWidth: 1 },
  { id: 'lowerOuter', title: 'Lower Outer BB', color: 'transparent', lineWidth: 1 },
];

export const metadata = {
  title: 'Ultimate Buy & Sell',
  shortTitle: 'UltimateBS',
  overlay: true,
};

function computeMA(bars: Bar[], src: number[], len: number, type: string): number[] {
  const srcSeries = new Series(bars, (_, i) => src[i]);
  switch (type) {
    case 'EMA': return ta.ema(srcSeries, len).toArray().map(v => v ?? NaN);
    case 'WMA': return ta.wma(srcSeries, len).toArray().map(v => v ?? NaN);
    case 'RMA': return ta.rma(srcSeries, len).toArray().map(v => v ?? NaN);
    default: return ta.sma(srcSeries, len).toArray().map(v => v ?? NaN);
  }
}

export function calculate(bars: Bar[], inputs: Partial<UltimateBuySellInputs> = {}): IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const closeArr = bars.map(b => b.close);

  // 1. Compute RSI manually with configurable MA type
  const change: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    change[i] = closeArr[i] - closeArr[i - 1];
  }
  const gains = change.map(c => Math.max(c, 0));
  const losses = change.map(c => -Math.min(c, 0));

  const avgGain = computeMA(bars, gains, cfg.rsiLength, cfg.rsiMaType);
  const avgLoss = computeMA(bars, losses, cfg.rsiLength, cfg.rsiMaType);

  const rsi: number[] = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    const up = avgGain[i];
    const down = avgLoss[i];
    if (isNaN(up) || isNaN(down)) continue;
    if (down === 0) rsi[i] = 100;
    else if (up === 0) rsi[i] = 0;
    else rsi[i] = 100 - 100 / (1 + up / down);
  }

  // 2. RSI Bollinger Bands
  const rsiBasis = computeMA(bars, rsi, cfg.rsiBbLength, cfg.rsiBbMaType);
  const rsiSeries = new Series(bars, (_, i) => rsi[i]);
  const rsiDevArr = ta.stdev(rsiSeries, cfg.rsiBbLength).toArray().map(v => v ?? 0);
  const rsiUpper: number[] = rsiBasis.map((b, i) => b + cfg.rsiMultiplier * rsiDevArr[i]);
  const rsiLower: number[] = rsiBasis.map((b, i) => b - cfg.rsiMultiplier * rsiDevArr[i]);

  // 3. Price Bollinger Bands
  const closeSeries = new Series(bars, b => b.close);
  const priceBasis = computeMA(bars, closeArr, cfg.priceBbLength, cfg.priceMaType);
  const priceDevArr = ta.stdev(closeSeries, cfg.priceBbLength).toArray().map(v => v ?? 0);
  const upperInner: number[] = priceBasis.map((b, i) => b + cfg.priceInnerMult * priceDevArr[i]);
  const lowerInner: number[] = priceBasis.map((b, i) => b - cfg.priceInnerMult * priceDevArr[i]);
  const upperOuter: number[] = priceBasis.map((b, i) => b + cfg.priceOuterMult * priceDevArr[i]);
  const lowerOuter: number[] = priceBasis.map((b, i) => b - cfg.priceOuterMult * priceDevArr[i]);

  // 4. Watch signals and buy/sell logic
  const warmup = Math.max(cfg.rsiLength, cfg.rsiBbLength, cfg.priceBbLength) + 5;

  // Track watch signals as ring buffers
  const buyWatchArr: boolean[] = new Array(n).fill(false);
  const sellWatchArr: boolean[] = new Array(n).fill(false);

  for (let i = 1; i < n; i++) {
    if (i < warmup) continue;

    // RSI watch signals: RSI crosses over lower RSI BB = buy watch, RSI crosses under upper RSI BB = sell watch
    // Also RSI crossing under 30 = buy watch, RSI crossing over 70 = sell watch
    const rsiCrossOverLower = rsi[i - 1] <= rsiLower[i - 1] && rsi[i] > rsiLower[i];
    const rsiCrossUnderUpper = rsi[i - 1] >= rsiUpper[i - 1] && rsi[i] < rsiUpper[i];
    const rsiCrossUnder30 = rsi[i - 1] >= 30 && rsi[i] < 30;
    const rsiCrossOver70 = rsi[i - 1] <= 70 && rsi[i] > 70;

    buyWatchArr[i] = rsiCrossOverLower || rsiCrossUnder30;
    sellWatchArr[i] = rsiCrossUnderUpper || rsiCrossOver70;
  }

  // Check if watch signal exists within lookback window
  function watchMet(watchArr: boolean[], idx: number): boolean {
    const start = Math.max(0, idx - cfg.watchLookback + 1);
    for (let j = start; j <= idx; j++) {
      if (watchArr[j]) return true;
    }
    return false;
  }

  // Generate buy/sell signals
  const markers: MarkerData[] = [];
  let bought = false;
  let sold = false;

  for (let i = 1; i < n; i++) {
    if (i < warmup) continue;

    // RSI crossing RSI basis = primary signal events
    const rsiCrossOverBasis = rsi[i - 1] <= rsiBasis[i - 1] && rsi[i] > rsiBasis[i];
    const rsiCrossUnderBasis = rsi[i - 1] >= rsiBasis[i - 1] && rsi[i] < rsiBasis[i];

    // RSI value crosses
    const rsiCrossOver25 = rsi[i - 1] <= 25 && rsi[i] > 25;
    const rsiCrossUnder75 = rsi[i - 1] >= 75 && rsi[i] < 75;

    const buySignal = rsiCrossOverBasis || rsiCrossOver25;
    const sellSignal = rsiCrossUnderBasis || rsiCrossUnder75;

    const buyWatchMet = watchMet(buyWatchArr, i);
    const sellWatchMet = watchMet(sellWatchArr, i);

    if (buySignal && buyWatchMet) {
      bought = true;
      sold = false;
      markers.push({
        time: bars[i].time,
        position: 'belowBar',
        shape: 'triangleUp',
        color: '#FF8C00',
        text: 'Buy',
      });
    } else if (sellSignal && sellWatchMet) {
      sold = true;
      bought = false;
      markers.push({
        time: bars[i].time,
        position: 'aboveBar',
        shape: 'triangleDown',
        color: '#FF00FF',
        text: 'Sell',
      });
    }
  }

  // 5. MA-based candle coloring
  const fastMA = computeMA(bars, closeArr, cfg.fastMaLength, cfg.fastMaType);
  const slowMA = computeMA(bars, closeArr, cfg.slowMaLength, cfg.slowMaType);

  const barColors: BarColorData[] = [];
  for (let i = 0; i < n; i++) {
    if (i < warmup || isNaN(fastMA[i]) || isNaN(slowMA[i])) continue;
    const aboveBoth = closeArr[i] >= fastMA[i] && closeArr[i] >= slowMA[i];
    const belowBoth = closeArr[i] < fastMA[i] && closeArr[i] < slowMA[i];
    let color: string;
    if (aboveBoth) color = '#00FF00';
    else if (belowBoth) color = '#FF0000';
    else color = '#FFFF00';
    barColors.push({ time: bars[i].time, color });
  }

  // 6. Build band fill colors (upper = green/red based on price vs 50-SMA, lower = green/red based on trend)
  const upperFillColors: string[] = new Array(n).fill('transparent');
  const lowerFillColors: string[] = new Array(n).fill('transparent');

  // Use price vs slow MA for upper band color
  for (let i = 0; i < n; i++) {
    if (i < warmup) continue;
    const bullish = closeArr[i] >= slowMA[i];
    upperFillColors[i] = bullish ? 'rgba(0,128,0,0.30)' : 'rgba(255,0,0,0.30)';
    lowerFillColors[i] = bullish ? 'rgba(0,128,0,0.30)' : 'rgba(255,0,0,0.30)';
  }

  // Build plots
  const plotPriceBasis = priceBasis.map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : v }));
  const plotUpperInner = upperInner.map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : v }));
  const plotLowerInner = lowerInner.map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : v }));
  const plotUpperOuter = upperOuter.map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : v }));
  const plotLowerOuter = lowerOuter.map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : v }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      priceBasis: plotPriceBasis,
      upperInner: plotUpperInner,
      lowerInner: plotLowerInner,
      upperOuter: plotUpperOuter,
      lowerOuter: plotLowerOuter,
    },
    fills: [
      { plot1: 'upperInner', plot2: 'upperOuter', options: { color: 'rgba(0,128,0,0.30)' }, colors: upperFillColors },
      { plot1: 'lowerOuter', plot2: 'lowerInner', options: { color: 'rgba(0,128,0,0.30)' }, colors: lowerFillColors },
    ],
    markers,
    barColors,
  };
}

export const UltimateBuySell = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
