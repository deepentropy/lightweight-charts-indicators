/**
 * OBV MACD Indicator
 *
 * Applies MACD calculation to On Balance Volume instead of price.
 * MACD Line = EMA(OBV, fast) - EMA(OBV, slow)
 * Signal = EMA(MACD, signal)
 * Histogram = MACD - Signal
 *
 * Reference: TradingView community indicator
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface OBVMACDInputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
}

export const defaultInputs: OBVMACDInputs = {
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 9, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Histogram', color: '#26A69A', lineWidth: 4 },
  { id: 'plot1', title: 'MACD', color: '#2962FF', lineWidth: 2 },
  { id: 'plot2', title: 'Signal', color: '#FF6D00', lineWidth: 2 },
];

export const metadata = {
  title: 'OBV MACD',
  shortTitle: 'OBVMACD',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<OBVMACDInputs> = {}): IndicatorResult {
  const { fastLength, slowLength, signalLength } = { ...defaultInputs, ...inputs };

  // Compute OBV
  const obvArr: number[] = [];
  let obvCum = 0;
  for (let i = 0; i < bars.length; i++) {
    if (i > 0) {
      const vol = bars[i].volume ?? 0;
      if (bars[i].close > bars[i - 1].close) obvCum += vol;
      else if (bars[i].close < bars[i - 1].close) obvCum -= vol;
    }
    obvArr.push(obvCum);
  }

  const obvSeries = Series.fromArray(bars, obvArr);
  const fastEMA = ta.ema(obvSeries, fastLength);
  const slowEMA = ta.ema(obvSeries, slowLength);
  const macdLine = fastEMA.sub(slowEMA);
  const signalLine = ta.ema(macdLine, signalLength);
  const histogram = macdLine.sub(signalLine);

  const toPlot = (s: Series) =>
    s.toArray().map((value, i) => ({ time: bars[i].time, value: value ?? NaN }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': toPlot(histogram), 'plot1': toPlot(macdLine), 'plot2': toPlot(signalLine) },
  };
}

export const OBVMACD = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
