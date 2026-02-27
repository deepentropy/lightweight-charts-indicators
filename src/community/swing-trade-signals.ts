/**
 * SWING TRADE SIGNALS
 *
 * Swing trading signals using EMA cross + RSI filter.
 * Buy: fast EMA crosses above slow EMA AND RSI > 50.
 * Sell: fast EMA crosses below slow EMA AND RSI < 50.
 *
 * Reference: TradingView "SWING TRADE SIGNALS" (community)
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface SwingTradeSignalsInputs {
  fastLen: number;
  slowLen: number;
  rsiLen: number;
  overbought: number;
  oversold: number;
  src: SourceType;
}

export const defaultInputs: SwingTradeSignalsInputs = {
  fastLen: 10,
  slowLen: 30,
  rsiLen: 14,
  overbought: 80,
  oversold: 20,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLen', type: 'int', title: 'Fast EMA Length', defval: 10, min: 1 },
  { id: 'slowLen', type: 'int', title: 'Slow EMA Length', defval: 30, min: 1 },
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'overbought', type: 'int', title: 'Overbought limit of RSI', defval: 80, min: 50, max: 100 },
  { id: 'oversold', type: 'int', title: 'Oversold limit of RSI', defval: 20, min: 0, max: 50 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast EMA', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'Slow EMA', color: '#EF5350', lineWidth: 2 },
];

export const metadata = {
  title: 'Swing Trade Signals',
  shortTitle: 'STS',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<SwingTradeSignalsInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { fastLen, slowLen, rsiLen, overbought, oversold, src } = { ...defaultInputs, ...inputs };

  const source = getSourceSeries(bars, src);
  const fastEma = ta.ema(source, fastLen);
  const slowEma = ta.ema(source, slowLen);
  const rsi = ta.rsi(source, rsiLen);

  const fastArr = fastEma.toArray();
  const slowArr = slowEma.toArray();
  const rsiArr = rsi.toArray();

  const warmup = Math.max(slowLen, rsiLen);
  const markers: MarkerData[] = [];

  for (let i = warmup + 1; i < bars.length; i++) {
    const prevFast = fastArr[i - 1] ?? 0;
    const prevSlow = slowArr[i - 1] ?? 0;
    const currFast = fastArr[i] ?? 0;
    const currSlow = slowArr[i] ?? 0;
    const rsiVal = rsiArr[i] ?? 50;

    const prevRsi = rsiArr[i - 1] ?? 50;

    if (prevFast <= prevSlow && currFast > currSlow && rsiVal > 50) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#26A69A', text: 'Buy' });
    } else if (prevFast >= prevSlow && currFast < currSlow && rsiVal < 50) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'Sell' });
    }

    // Pine: buyexit = crossunder(rs, hl) - RSI crosses below overbought
    if (prevRsi >= overbought && rsiVal < overbought) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: '#008080', text: '\u2193' });
    }
    // Pine: sellexit = crossover(rs, ll) - RSI crosses above oversold
    if (prevRsi <= oversold && rsiVal > oversold) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: '#008080', text: '\u2191' });
    }
  }

  const plot0 = fastArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v,
  }));

  const plot1 = slowArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    markers,
  };
}

export const SwingTradeSignals = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
