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
  macdEmaLength: number;
  showDots: boolean;
}

export const defaultInputs: ZeroLagMACDInputs = {
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  macdEmaLength: 9,
  showDots: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Period', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Period', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Period', defval: 9, min: 1 },
  { id: 'macdEmaLength', type: 'int', title: 'MACD EMA Length', defval: 9, min: 1 },
  { id: 'showDots', type: 'bool', title: 'Show Crossing Dots', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Positive Histogram', color: '#008000', lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Negative Histogram', color: '#800080', lineWidth: 1, style: 'columns' },
  { id: 'plot2', title: 'MACD', color: '#000000', lineWidth: 2 },
  { id: 'plot3', title: 'Signal', color: '#787B86', lineWidth: 2 },
  { id: 'plot4', title: 'EMA on MACD', color: '#FF0000', lineWidth: 2 },
  { id: 'plot5', title: 'Cross Dots', color: '#008000', lineWidth: 4, style: 'circles' },
];

export const metadata = {
  title: 'Zero Lag MACD',
  shortTitle: 'ZLMACD',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<ZeroLagMACDInputs> = {}): IndicatorResult {
  const { fastLength, slowLength, signalLength, macdEmaLength, showDots } = { ...defaultInputs, ...inputs };

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
  const macdEma = ta.ema(macdLine, macdEmaLength);

  const histArr = hist.toArray();
  const macdArr = macdLine.toArray();
  const sigArr = signal.toArray();
  const macdEmaArr = macdEma.toArray();

  const warmup = slowLength * 2;

  // Separate positive and negative histograms
  const upHist = histArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : ((v ?? 0) > 0 ? (v ?? NaN) : NaN),
  }));
  const downHist = histArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : ((v ?? 0) <= 0 ? (v ?? NaN) : NaN),
  }));

  const macdPlot = macdArr.map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : (v ?? NaN) }));
  const sigPlot = sigArr.map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : (v ?? NaN) }));
  const emaPlot = macdEmaArr.map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : (v ?? NaN) }));

  // Cross dots at MACD/signal crossovers
  const dotsPlot = macdArr.map((v, i) => {
    if (!showDots || i < warmup + 1) return { time: bars[i].time, value: NaN };
    const cur = v ?? 0;
    const curSig = sigArr[i] ?? 0;
    const prev = macdArr[i - 1] ?? 0;
    const prevSig = sigArr[i - 1] ?? 0;
    const cross = (prev <= prevSig && cur > curSig) || (prev >= prevSig && cur < curSig);
    if (!cross) return { time: bars[i].time, value: NaN };
    const h = histArr[i] ?? 0;
    return { time: bars[i].time, value: cur, color: h > 0 ? '#008000' : '#800080' };
  });

  // Dynamic fill colors: green when MACD > signal, purple otherwise
  const fillColors = histArr.map((v, i) => {
    if (i < warmup) return 'transparent';
    return (v ?? 0) > 0 ? 'rgba(0,128,0,0.25)' : 'rgba(128,0,128,0.25)';
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': upHist, 'plot1': downHist, 'plot2': macdPlot, 'plot3': sigPlot, 'plot4': emaPlot, 'plot5': dotsPlot },
    fills: [{ plot1: 'plot2', plot2: 'plot3', colors: fillColors }],
    hlines: [{ value: 0, options: { color: '#787B86', linestyle: 'dotted', title: 'Zero' } }],
  };
}

export const ZeroLagMACD = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
