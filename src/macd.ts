/**
 * Moving Average Convergence Divergence (MACD) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Trend-following momentum indicator showing relationship between two EMAs.
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface MACDInputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
  src: SourceType;
}

export const defaultInputs: MACDInputs = {
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Smoothing', defval: 9, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Histogram', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'MACD', color: '#2962FF', lineWidth: 2 },
  { id: 'plot2', title: 'Signal', color: '#FF6D00', lineWidth: 2 },
];

export const metadata = {
  title: 'Moving Average Convergence Divergence',
  shortTitle: 'MACD',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<MACDInputs> = {}): IndicatorResult {
  const { fastLength, slowLength, signalLength, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);

  // MACD line = Fast EMA - Slow EMA
  const fastEMA = ta.ema(source, fastLength);
  const slowEMA = ta.ema(source, slowLength);
  const macdLine = fastEMA.sub(slowEMA);

  // Signal line = EMA of MACD line
  const signalLine = ta.ema(macdLine, signalLength);

  // Histogram = MACD line - Signal line
  const histogram = macdLine.sub(signalLine);

  const histData = histogram.toArray().map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  const macdData = macdLine.toArray().map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  const signalData = signalLine.toArray().map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'plot0': histData,
      'plot1': macdData,
      'plot2': signalData,
    },
  };
}

export const MACD = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
