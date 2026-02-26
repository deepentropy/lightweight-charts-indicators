/**
 * MACD Crossover
 *
 * Standard MACD with cross detection between MACD and signal lines.
 *
 * Reference: TradingView "MACD Crossover" community indicator
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface MACDCrossoverInputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
  src: SourceType;
}

export const defaultInputs: MACDCrossoverInputs = {
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 9, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MACD', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 2 },
  { id: 'plot2', title: 'Histogram', color: '#26A69A', lineWidth: 4, style: 'histogram' },
];

export const metadata = {
  title: 'MACD Crossover',
  shortTitle: 'MACDCross',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<MACDCrossoverInputs> = {}): IndicatorResult {
  const { fastLength, slowLength, signalLength, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);

  const fastEMA = ta.ema(source, fastLength);
  const slowEMA = ta.ema(source, slowLength);
  const macdLine = fastEMA.sub(slowEMA);
  const signalLine = ta.ema(macdLine, signalLength);
  const histogram = macdLine.sub(signalLine);

  const macdArr = macdLine.toArray();
  const sigArr = signalLine.toArray();
  const histArr = histogram.toArray();

  const warmup = slowLength;

  const toPlot = (arr: (number | null)[]) =>
    arr.map((v, i) => ({ time: bars[i].time, value: (i < warmup || v == null) ? NaN : v }));

  const histPlot = histArr.map((v, i) => {
    if (i < warmup || v == null) return { time: bars[i].time, value: NaN };
    return { time: bars[i].time, value: v, color: v >= 0 ? '#26A69A' : '#EF5350' };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': toPlot(macdArr), 'plot1': toPlot(sigArr), 'plot2': histPlot },
    hlines: [{ value: 0, options: { color: '#787B86', linestyle: 'dashed', title: 'Zero' } }],
  };
}

export const MACDCrossover = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
