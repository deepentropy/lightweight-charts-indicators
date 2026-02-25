/**
 * Zero Lag MACD Enhanced
 *
 * MACD calculated from Zero-Lag EMAs instead of standard EMAs.
 * Zero-Lag EMA = 2*EMA - EMA(EMA) (removes one period of lag).
 * Signal line also zero-lag smoothed. Histogram = MACD - signal.
 *
 * Reference: TradingView "Zero Lag MACD Enhanced - Version 1.2" by AC (based on Glaz)
 */

import { ta, Series, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface ZeroLagMACDInputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
}

export const defaultInputs: ZeroLagMACDInputs = {
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Period', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Period', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Period', defval: 9, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MACD', color: '#000000', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#787B86', lineWidth: 2 },
  { id: 'plot2', title: 'Histogram', color: '#26A69A', lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'Zero Lag MACD',
  shortTitle: 'ZLMACD',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<ZeroLagMACDInputs> = {}): IndicatorResult {
  const { fastLength, slowLength, signalLength } = { ...defaultInputs, ...inputs };

  const src = getSourceSeries(bars, 'close');

  // Zero-lag fast line: 2*EMA(src, fast) - EMA(EMA(src, fast), fast)
  const ma1 = ta.ema(src, fastLength);
  const ma2 = ta.ema(ma1, fastLength);
  const zlFast = ma1.mul(2).sub(ma2);

  // Zero-lag slow line
  const mas1 = ta.ema(src, slowLength);
  const mas2 = ta.ema(mas1, slowLength);
  const zlSlow = mas1.mul(2).sub(mas2);

  // MACD = zlFast - zlSlow
  const macdLine = zlFast.sub(zlSlow);

  // Zero-lag signal: 2*EMA(MACD, signal) - EMA(EMA(MACD, signal), signal)
  const emasig1 = ta.ema(macdLine, signalLength);
  const emasig2 = ta.ema(emasig1, signalLength);
  const signal = emasig1.mul(2).sub(emasig2);

  const hist = macdLine.sub(signal);

  const warmup = slowLength * 2;
  const toPlot = (s: Series) =>
    s.toArray().map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : (v ?? NaN) }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': toPlot(macdLine), 'plot1': toPlot(signal), 'plot2': toPlot(hist) },
    fills: [{ plot1: 'plot0', plot2: 'plot1' }],
  };
}

export const ZeroLagMACD = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
