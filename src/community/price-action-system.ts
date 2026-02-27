/**
 * Price Action Trading System v0.3
 *
 * Price action patterns with MA filter. Detects hammer, engulfing patterns.
 * In uptrend (close > SMA): bullish engulfing or hammer = buy.
 * In downtrend: bearish engulfing or shooting star = sell.
 *
 * Reference: TradingView "Price Action Trading System v0.3" (community)
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData, BgColorData } from '../types';

export interface PriceActionSystemInputs {
  maLen: number;
  atrLen: number;
  src: SourceType;
}

export const defaultInputs: PriceActionSystemInputs = {
  maLen: 50,
  atrLen: 14,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'maLen', type: 'int', title: 'MA Length', defval: 50, min: 1 },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 14, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SMA', color: '#787B86', lineWidth: 2 },
  { id: 'plot1', title: 'Low Price Line', color: '#787B86', lineWidth: 2 },
  { id: 'plot2', title: 'High Price Line', color: '#787B86', lineWidth: 2 },
  { id: 'plot3', title: 'Median Price Line', color: '#FF9800', lineWidth: 2 },
  { id: 'plot4', title: 'Slow EMA Trend Line', color: '#2196F3', lineWidth: 2 },
];

export const metadata = {
  title: 'Price Action Trading System',
  shortTitle: 'PATS',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<PriceActionSystemInputs> = {}): IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[]; bgColors: BgColorData[] } {
  const { maLen, atrLen } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeSeries = new Series(bars, (b) => b.close);
  const sma = ta.sma(closeSeries, maLen);
  const smaArr = sma.toArray();

  // Pine price channel: emaLo = ema(low, 5), emaHi = ema(high, 5), emaMe = ema(hl2, 4)
  const lowSeries = new Series(bars, (b) => b.low);
  const highSeries = new Series(bars, (b) => b.high);
  const hl2Series = new Series(bars, (b) => (b.high + b.low) / 2);
  const emaLoArr = ta.ema(lowSeries, 5).toArray();
  const emaHiArr = ta.ema(highSeries, 5).toArray();
  const emaMeArr = ta.ema(hl2Series, 4).toArray();

  const warmup = Math.max(maLen, atrLen);
  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];
  const bgColors: BgColorData[] = [];

  // CCI for bar coloring (Pine uses CCI > 75 = aqua, CCI < -75 = black)
  const cci = ta.cci(closeSeries, 14).toArray();

  // MACD for background coloring: Pine: bgcolor(OutputSignal>0?red: OutputSignal<0?green:yellow, transp=90)
  // OutputSignal = signal > macd ? 1 : signal < macd ? -1 : 0
  const fastMCArr = ta.ema(closeSeries, 12).toArray();
  const slowMCArr = ta.ema(closeSeries, 17).toArray();
  const macdArr: number[] = new Array(n);
  for (let j = 0; j < n; j++) {
    macdArr[j] = (fastMCArr[j] ?? 0) - (slowMCArr[j] ?? 0);
  }
  const macdSignalArr = ta.sma(Series.fromArray(bars, macdArr), 8).toArray();

  for (let i = warmup + 1; i < n; i++) {
    const curr = bars[i];
    const prev = bars[i - 1];
    const close = curr.close;
    const open = curr.open;
    const high = curr.high;
    const low = curr.low;
    const maVal = smaArr[i] ?? 0;

    const body = Math.abs(close - open);
    const range = high - low;
    if (range === 0) continue;

    const upperShadow = high - Math.max(close, open);
    const lowerShadow = Math.min(close, open) - low;

    const prevBullish = prev.close > prev.open;
    const prevBearish = prev.close < prev.open;
    const bullish = close > open;
    const bearish = close < open;

    const uptrend = close > maVal;
    const downtrend = close < maVal;

    // Hammer: lower shadow > body*2, upper shadow < body*0.3
    const isHammer = lowerShadow > body * 2 && upperShadow < body * 0.3 && range > 0;
    // Shooting star: upper shadow > body*2, lower shadow < body*0.3
    const isShootingStar = upperShadow > body * 2 && lowerShadow < body * 0.3 && range > 0;

    // Bullish engulfing: prev bearish, curr bullish, curr body engulfs prev body
    const isBullishEngulfing = prevBearish && bullish &&
      close > prev.open && open < prev.close;
    // Bearish engulfing: prev bullish, curr bearish, curr body engulfs prev body
    const isBearishEngulfing = prevBullish && bearish &&
      close < prev.open && open > prev.close;

    if (uptrend && (isBullishEngulfing || isHammer)) {
      markers.push({ time: curr.time, position: 'belowBar', shape: 'labelUp', color: '#26A69A', text: 'Buy' });
    } else if (downtrend && (isBearishEngulfing || isShootingStar)) {
      markers.push({ time: curr.time, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'Sell' });
    }

    // Bar colors: CCI > 75 = aqua (#00BCD4), CCI < -75 = black (#000000)
    const cciVal = cci[i];
    if (cciVal != null && !isNaN(cciVal)) {
      if (cciVal > 75) {
        barColors.push({ time: curr.time, color: '#00BCD4' });
      } else if (cciVal < -75) {
        barColors.push({ time: curr.time, color: '#000000' });
      }
    }

    // Background: Pine OutputSignal = signal > macd ? 1 (red) : signal < macd ? -1 (green) : 0 (yellow)
    const macdSig = macdSignalArr[i] ?? 0;
    const macdVal = macdArr[i];
    if (macdSig > macdVal) {
      bgColors.push({ time: curr.time, color: 'rgba(239,83,80,0.1)' });
    } else if (macdSig < macdVal) {
      bgColors.push({ time: curr.time, color: 'rgba(38,166,154,0.1)' });
    } else {
      bgColors.push({ time: curr.time, color: 'rgba(255,235,59,0.1)' });
    }
  }

  const plot0 = smaArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v,
  }));

  const toPlot = (arr: (number | null)[]) =>
    arr.map((v, i) => ({
      time: bars[i].time,
      value: (v == null || i < 5) ? NaN : v,
    }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': toPlot(emaLoArr), 'plot2': toPlot(emaHiArr), 'plot3': toPlot(emaMeArr), 'plot4': toPlot(slowMCArr) },
    markers,
    barColors,
    bgColors,
  };
}

export const PriceActionSystem = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
