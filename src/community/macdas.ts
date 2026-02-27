/**
 * MACDAS (MACD Average Signal)
 *
 * Computes MACD-AS = MACD - Signal, then its own EMA (signalAS).
 * This is a "second derivative" of MACD, showing momentum of the MACD histogram.
 * Plots macdAS (blue) and signalAS (red) plus zero line.
 *
 * Reference: TradingView "MACDAS"
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface MACDASInputs {
  fastperiod: number;
  slowperiod: number;
  signalperiod: number;
  src: SourceType;
}

export const defaultInputs: MACDASInputs = {
  fastperiod: 12,
  slowperiod: 26,
  signalperiod: 9,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastperiod', type: 'int', title: 'Fast Period', defval: 12, min: 1, max: 500 },
  { id: 'slowperiod', type: 'int', title: 'Slow Period', defval: 26, min: 1, max: 500 },
  { id: 'signalperiod', type: 'int', title: 'Signal Period', defval: 9, min: 1, max: 500 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MACD-AS', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Signal-AS', color: '#EF5350', lineWidth: 2 },
];

export const metadata = {
  title: 'MACDAS',
  shortTitle: 'MACDAS',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<MACDASInputs> = {}): IndicatorResult {
  const { fastperiod, slowperiod, signalperiod, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);

  // Pine: macd = ema(close, fast) - ema(close, slow)
  const fastEMA = ta.ema(source, fastperiod);
  const slowEMA = ta.ema(source, slowperiod);
  const macd = fastEMA.sub(slowEMA);

  // Pine: signal = ema(macd, signalperiod)
  const signal = ta.ema(macd, signalperiod);

  // Pine: macdAS = macd - signal
  const macdAS = macd.sub(signal);

  // Pine: signalAS = ema(macdAS, signalperiod)
  const signalAS = ta.ema(macdAS, signalperiod);

  const macdASArr = macdAS.toArray();
  const signalASArr = signalAS.toArray();

  const warmup = slowperiod + signalperiod;

  const toPlot = (arr: (number | null)[]) =>
    arr.map((v, i) => ({ time: bars[i].time, value: (i < warmup || v == null) ? NaN : v }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': toPlot(macdASArr), 'plot1': toPlot(signalASArr) },
    hlines: [{ value: 0, options: { color: '#000000', linestyle: 'solid', title: 'Zero' } }],
  };
}

export const MACDAS = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
