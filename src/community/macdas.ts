/**
 * MACDAS (MACD Average Signal)
 *
 * MACD with an additional average of the signal line (SMA of signal).
 *
 * Reference: TradingView "MACDAS" community indicator
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface MACDASInputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
  avgLength: number;
  src: SourceType;
}

export const defaultInputs: MACDASInputs = {
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  avgLength: 9,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 9, min: 1 },
  { id: 'avgLength', type: 'int', title: 'Average Signal Length', defval: 9, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MACD', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 2 },
  { id: 'plot2', title: 'Avg Signal', color: '#E91E63', lineWidth: 2 },
];

export const metadata = {
  title: 'MACDAS',
  shortTitle: 'MACDAS',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<MACDASInputs> = {}): IndicatorResult {
  const { fastLength, slowLength, signalLength, avgLength, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);

  const fastEMA = ta.ema(source, fastLength);
  const slowEMA = ta.ema(source, slowLength);
  const macdLine = fastEMA.sub(slowEMA);
  const signalLine = ta.ema(macdLine, signalLength);
  const avgSignal = ta.sma(signalLine, avgLength);

  const macdArr = macdLine.toArray();
  const sigArr = signalLine.toArray();
  const avgArr = avgSignal.toArray();

  const warmup = slowLength;

  const toPlot = (arr: (number | null)[]) =>
    arr.map((v, i) => ({ time: bars[i].time, value: (i < warmup || v == null) ? NaN : v }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': toPlot(macdArr), 'plot1': toPlot(sigArr), 'plot2': toPlot(avgArr) },
    hlines: [{ value: 0, options: { color: '#787B86', linestyle: 'dashed', title: 'Zero' } }],
  };
}

export const MACDAS = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
