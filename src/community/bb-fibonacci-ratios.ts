/**
 * Bollinger Bands Fibonacci Ratios
 *
 * SMA with 3 upper and 3 lower bands at Fibonacci ATR ratios.
 * Bands = SMA +/- ATR * fibRatio
 *
 * Reference: TradingView "Bollinger Bands Fibonacci Ratios" (community)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface BBFibonacciRatiosInputs {
  length: number;
  fibRatio1: number;
  fibRatio2: number;
  fibRatio3: number;
}

export const defaultInputs: BBFibonacciRatiosInputs = {
  length: 20,
  fibRatio1: 1.618,
  fibRatio2: 2.618,
  fibRatio3: 4.236,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
  { id: 'fibRatio1', type: 'float', title: 'Fib Ratio 1', defval: 1.618, min: 0.01, step: 0.001 },
  { id: 'fibRatio2', type: 'float', title: 'Fib Ratio 2', defval: 2.618, min: 0.01, step: 0.001 },
  { id: 'fibRatio3', type: 'float', title: 'Fib Ratio 3', defval: 4.236, min: 0.01, step: 0.001 },
];

export const plotConfig: PlotConfig[] = [
  // Pine uses style=cross for SMA; cross not supported, kept as line
  { id: 'plot0', title: 'Basis', color: '#FF6D00', lineWidth: 2 },
  { id: 'plot1', title: 'Upper 1', color: '#2962FF', lineWidth: 1 },
  { id: 'plot2', title: 'Lower 1', color: '#2962FF', lineWidth: 1 },
  { id: 'plot3', title: 'Upper 2', color: '#2962FF', lineWidth: 1 },
  { id: 'plot4', title: 'Lower 2', color: '#2962FF', lineWidth: 1 },
  { id: 'plot5', title: 'Upper 3', color: '#2962FF', lineWidth: 1 },
  { id: 'plot6', title: 'Lower 3', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'BB Fibonacci Ratios',
  shortTitle: 'BB Fib',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<BBFibonacciRatiosInputs> = {}): IndicatorResult {
  const { length, fibRatio1, fibRatio2, fibRatio3 } = { ...defaultInputs, ...inputs };

  const source = getSourceSeries(bars, 'close');
  const sma = ta.sma(source, length);
  const atr = ta.atr(bars, length);
  const smaArr = sma.toArray();
  const atrArr = atr.toArray();

  const warmup = length;
  const makePlot = (fn: (s: number, a: number) => number) =>
    bars.map((b, i) => {
      if (i < warmup || smaArr[i] == null || atrArr[i] == null) return { time: b.time, value: NaN };
      return { time: b.time, value: fn(smaArr[i]!, atrArr[i]!) };
    });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'plot0': makePlot((s) => s),
      'plot1': makePlot((s, a) => s + a * fibRatio1),
      'plot2': makePlot((s, a) => s - a * fibRatio1),
      'plot3': makePlot((s, a) => s + a * fibRatio2),
      'plot4': makePlot((s, a) => s - a * fibRatio2),
      'plot5': makePlot((s, a) => s + a * fibRatio3),
      'plot6': makePlot((s, a) => s - a * fibRatio3),
    },
    fills: [
      { plot1: 'plot5', plot2: 'plot6', options: { color: 'rgba(41,98,255,0.05)' } },
    ],
  };
}

export const BBFibonacciRatios = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
