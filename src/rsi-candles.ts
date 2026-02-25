/**
 * RSI Candles
 *
 * Applies RSI individually to open, high, low, close to produce RSI-OHLC values.
 * These can be rendered as candles in an oscillator pane (0-100 scale).
 *
 * Reference: TradingView "RSI Chart Bars" by Glaz
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface RSICandlesInputs {
  length: number;
}

export const defaultInputs: RSICandlesInputs = {
  length: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI Open', color: '#787B86', lineWidth: 1 },
  { id: 'plot1', title: 'RSI High', color: '#26A69A', lineWidth: 1 },
  { id: 'plot2', title: 'RSI Low', color: '#EF5350', lineWidth: 1 },
  { id: 'plot3', title: 'RSI Close', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'RSI Candles',
  shortTitle: 'RSIC',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<RSICandlesInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };

  const rsiOpen = ta.rsi(new Series(bars, (b) => b.open), length).toArray();
  const rsiHigh = ta.rsi(new Series(bars, (b) => b.high), length).toArray();
  const rsiLow = ta.rsi(new Series(bars, (b) => b.low), length).toArray();
  const rsiClose = ta.rsi(new Series(bars, (b) => b.close), length).toArray();

  const warmup = length;
  const toPlot = (arr: (number | null)[]) =>
    arr.map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : (v ?? NaN) }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': toPlot(rsiOpen), 'plot1': toPlot(rsiHigh), 'plot2': toPlot(rsiLow), 'plot3': toPlot(rsiClose) },
  };
}

export const RSICandles = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
