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
  { id: 'plot0', title: 'Histogram', color: '#26A69A', lineWidth: 4, style: 'histogram' },
  { id: 'plot1', title: 'VXI', color: '#787B86', lineWidth: 2 },
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
  const signalLine = ta.ema(macdLine, signalLength);
  const histogram = macdLine.sub(signalLine);
  const histArr = histogram.toArray();

  // VXI = stdev of histogram
  const vxi = ta.stdev(histogram, signalLength);
  const vxiArr = vxi.toArray();

  const warmup = slowLength;

  const histPlot = histArr.map((v, i) => {
    if (i < warmup || v == null) return { time: bars[i].time, value: NaN };
    const prev = i > 0 ? (histArr[i - 1] ?? NaN) : NaN;
    let color: string;
    if (v >= 0) {
      color = v > prev ? '#00E676' : '#26A69A';
    } else {
      color = v < prev ? '#FF5252' : '#EF5350';
    }
    return { time: bars[i].time, value: v, color };
  });

  const vxiPlot = vxiArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null) ? NaN : v,
  }));

  // Background color: Pine bgcolor(OutputSignal>0?#000000:#128E89, transp=80)
  // OutputSignal = signal >= macd ? 1 : 0 (bearish=black, bullish=teal)
  const macdArr = macdLine.toArray();
  const sigArr = signalLine.toArray();
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
    plots: { 'plot0': histPlot, 'plot1': vxiPlot },
    hlines: [{ value: 0, options: { color: '#787B86', linestyle: 'dashed', title: 'Zero' } }],
    bgColors,
  };
}

export const MACDVXI = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
