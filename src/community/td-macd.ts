/**
 * TDMacd
 *
 * Standard MACD (EMA fast - EMA slow) with SMA signal.
 * Histogram is the MACD line itself, colored by direction (2-color).
 * MACD line plotted in black.
 * Signal line colored by direction (2-color: red/green).
 *
 * Pine source:
 *   fastMA = ema(source, fastLength)
 *   slowMA = ema(source, slowLength)
 *   macd = fastMA - slowMA
 *   signal = sma(macd, signalLength)
 *   plot(macd, color = change(macd) <= 0 ? red : lime, style=histogram)
 *   plot(macd, color=black, style=line)
 *   plot(signal, color=change(signal) <= 0 ? red : green, style=line)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface TDMacdInputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
}

export const defaultInputs: TDMacdInputs = {
  fastLength: 5,
  slowLength: 20,
  signalLength: 30,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 5, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 20, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 30, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MACD Histogram', color: '#00E676', lineWidth: 4, style: 'histogram' },
  { id: 'plot1', title: 'MACD', color: '#000000', lineWidth: 2 },
  { id: 'plot2', title: 'Signal', color: '#4CAF50', lineWidth: 2 },
];

export const metadata = {
  title: 'TDMacd',
  shortTitle: 'MACD',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<TDMacdInputs> = {}): IndicatorResult {
  const { fastLength, slowLength, signalLength } = { ...defaultInputs, ...inputs };

  const closeSeries = new Series(bars, (b) => b.close);
  const fastMA = ta.ema(closeSeries, fastLength);
  const slowMA = ta.ema(closeSeries, slowLength);
  const macd = fastMA.sub(slowMA);
  const signal = ta.sma(macd, signalLength);

  const macdArr = macd.toArray();
  const sigArr = signal.toArray();

  const warmup = Math.max(fastLength, slowLength);
  const sigWarmup = warmup + signalLength - 1;

  // Plot 0: MACD as histogram, 2-color based on change(macd)
  // lime (#00E676) when rising, red (#FF1744) when falling or flat
  const histPlot = macdArr.map((v, i) => {
    if (i < warmup || v == null) return { time: bars[i].time, value: NaN };
    const val = v as number;
    const prev = (i > 0 && i - 1 >= warmup && macdArr[i - 1] != null) ? macdArr[i - 1] as number : val;
    const change = val - prev;
    const color = change <= 0 ? '#FF1744' : '#00E676';
    return { time: bars[i].time, value: val, color };
  });

  // Plot 1: MACD as line, black
  const macdLinePlot = macdArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null) ? NaN : v as number,
  }));

  // Plot 2: Signal as line, 2-color based on change(signal)
  // green (#4CAF50) when rising, red (#FF1744) when falling or flat
  const signalPlot = sigArr.map((v, i) => {
    if (i < sigWarmup || v == null) return { time: bars[i].time, value: NaN };
    const val = v as number;
    const prev = (i > 0 && i - 1 >= sigWarmup && sigArr[i - 1] != null) ? sigArr[i - 1] as number : val;
    const change = val - prev;
    const color = change <= 0 ? '#FF1744' : '#4CAF50';
    return { time: bars[i].time, value: val, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': histPlot, 'plot1': macdLinePlot, 'plot2': signalPlot },
  };
}

export const TDMacd = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
