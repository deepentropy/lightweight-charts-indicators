/**
 * Zero Lag EMA
 *
 * Reduces EMA lag by using a corrected source: 2*close - close[lag].
 * zlema = ema(2*src - src[lag], length) where lag = floor((length-1)/2).
 *
 * Reference: TradingView "Zero Lag EMA" (community)
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';

export interface ZeroLagEMAInputs {
  length: number;
  fastLen: number;
  slowLen: number;
  src: SourceType;
}

export const defaultInputs: ZeroLagEMAInputs = {
  length: 20,
  fastLen: 11,
  slowLen: 89,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'ZLEMA Length', defval: 20, min: 2 },
  { id: 'fastLen', type: 'int', title: 'Fast SMMA Length', defval: 11, min: 2 },
  { id: 'slowLen', type: 'int', title: 'Slow EMA Length', defval: 89, min: 2 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ZLEMA', color: '#FFEB3B', lineWidth: 2 },
  { id: 'plot1', title: 'Fast SMMA', color: '#808000', lineWidth: 2 },
  { id: 'plot2', title: 'Slow EMA', color: '#EF5350', lineWidth: 2 },
];

export const metadata = {
  title: 'Zero Lag EMA',
  shortTitle: 'ZLEMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<ZeroLagEMAInputs> = {}): IndicatorResult & { markers: MarkerData[]; bgColors: BgColorData[] } {
  const { length, fastLen, slowLen, src } = { ...defaultInputs, ...inputs };
  const srcArr = getSourceSeries(bars, src).toArray();
  const n = bars.length;
  const lag = Math.floor((length - 1) / 2);

  // Corrected source: 2*src - src[lag]
  const corrected = new Series(bars, (_bar, i) => {
    const cur = srcArr[i] ?? 0;
    const lagged = i >= lag ? (srcArr[i - lag] ?? cur) : cur;
    return 2 * cur - lagged;
  });

  const zlemaArr = ta.ema(corrected, length).toArray();
  // Regular EMA for crossover signals (Pine strategy: zlema vs ema)
  const source = getSourceSeries(bars, src);
  const emaArr = ta.ema(source, length).toArray();

  // Pine: FastMA = SMMA(close, fastLen) -- SMMA = RMA in Pine
  const fastMAArr = ta.rma(source, fastLen).toArray();
  // Pine: SlowMA = EMA(close, slowLen)
  const slowMAArr = ta.ema(source, slowLen).toArray();

  const warmup = Math.max(length + lag, fastLen, slowLen);

  // Markers: ZLEMA crosses above EMA = buy, crosses below = sell
  const markers: MarkerData[] = [];
  // bgColors: bullish when close > ZLEMA, bearish when close < ZLEMA
  const bgColors: BgColorData[] = [];

  for (let i = warmup + 1; i < n; i++) {
    const zlCur = zlemaArr[i] ?? NaN;
    const zlPrev = zlemaArr[i - 1] ?? NaN;
    const emaCur = emaArr[i] ?? NaN;
    const emaPrev = emaArr[i - 1] ?? NaN;

    if (!isNaN(zlCur) && !isNaN(zlPrev) && !isNaN(emaCur) && !isNaN(emaPrev)) {
      if (zlPrev <= emaPrev && zlCur > emaCur) {
        markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#26A69A', text: 'Buy' });
      } else if (zlPrev >= emaPrev && zlCur < emaCur) {
        markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#EF5350', text: 'Sell' });
      }
    }

    if (!isNaN(zlCur)) {
      bgColors.push({
        time: bars[i].time,
        color: bars[i].close > zlCur ? 'rgba(38,166,154,0.1)' : 'rgba(239,83,80,0.1)',
      });
    }
  }

  const plot = zlemaArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (v ?? NaN),
  }));

  const fastPlot = fastMAArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || v == null || isNaN(v) ? NaN : v,
  }));

  const slowPlot = slowMAArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || v == null || isNaN(v) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot, 'plot1': fastPlot, 'plot2': slowPlot },
    markers,
    bgColors,
  };
}

export const ZeroLagEMA = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
