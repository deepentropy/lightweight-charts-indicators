/**
 * MACD VXI
 *
 * MACD with Volatility Index. VXI = stdev of histogram over signal period.
 *
 * Reference: TradingView "MACD VXI" community indicator
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BgColorData } from '../types';

export interface MACDVXIInputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
  src: SourceType;
}

export const defaultInputs: MACDVXIInputs = {
  fastLength: 13,
  slowLength: 21,
  signalLength: 8,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 13, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 21, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 8, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Histogram', color: '#000000', lineWidth: 1, style: 'histogram' },
  { id: 'plot1', title: 'MACD', color: '#FF0000', lineWidth: 1 },
  { id: 'plot2', title: 'Signal', color: '#0000FF', lineWidth: 2 },
  { id: 'plot3', title: 'Cross', color: '#000000', lineWidth: 4, style: 'circles' },
];

export const metadata = {
  title: 'MACD VXI',
  shortTitle: 'MACDVXI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<MACDVXIInputs> = {}): IndicatorResult & { bgColors: BgColorData[] } {
  const { fastLength, slowLength, signalLength, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);

  const fastEMA = ta.ema(source, fastLength);
  const slowEMA = ta.ema(source, slowLength);
  const macdLine = fastEMA.sub(slowEMA);
  const signalLine = ta.sma(macdLine, signalLength); // Pine uses sma for signal
  const histogram = macdLine.sub(signalLine);
  const histArr = histogram.toArray();
  const macdArr = macdLine.toArray();
  const sigArr = signalLine.toArray();

  const warmup = slowLength;

  // plot0: histogram (black, style=histogram per Pine)
  const histPlot = histArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null) ? NaN : v,
  }));

  // plot1: MACD line (red per Pine)
  const macdPlot = macdArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null) ? NaN : v,
  }));

  // plot2: Signal line (blue per Pine)
  const signalPlot = sigArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null) ? NaN : v,
  }));

  // plot3: Cross detection circles - plot signal value when cross(signal, macd)
  const crossPlot = sigArr.map((v, i) => {
    if (i < warmup + 1 || v == null) return { time: bars[i].time, value: NaN };
    const s = sigArr[i]!;
    const sPrev = sigArr[i - 1] ?? NaN;
    const m = macdArr[i] ?? NaN;
    const mPrev = macdArr[i - 1] ?? NaN;
    // cross(signal, macd): signal crosses above or below macd
    const crossUp = sPrev <= mPrev && s > m;
    const crossDn = sPrev >= mPrev && s < m;
    return { time: bars[i].time, value: (crossUp || crossDn) ? s : NaN };
  });

  // Background color: Pine bgcolor(OutputSignal>0?#000000:#128E89, transp=80)
  const bgColors: BgColorData[] = [];
  for (let i = warmup; i < bars.length; i++) {
    const m = macdArr[i] ?? NaN;
    const s = sigArr[i] ?? NaN;
    if (isNaN(m) || isNaN(s)) continue;
    const color = s >= m
      ? 'rgba(0,0,0,0.1)'        // bearish: black at low alpha
      : 'rgba(18,142,137,0.1)';  // bullish: teal
    bgColors.push({ time: bars[i].time, color });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': histPlot, 'plot1': macdPlot, 'plot2': signalPlot, 'plot3': crossPlot },
    hlines: [{ value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } }],
    bgColors,
  };
}

export const MACDVXI = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
