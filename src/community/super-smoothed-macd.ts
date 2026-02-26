/**
 * Super Smoothed MACD for Crypto
 *
 * MACD with extra smoothing via additional EMA pass.
 *
 * Reference: TradingView "Super Smoothed MACD for Crypto" community indicator
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface SuperSmoothedMACDInputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
  smoothLength: number;
  src: SourceType;
}

export const defaultInputs: SuperSmoothedMACDInputs = {
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  smoothLength: 5,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 9, min: 1 },
  { id: 'smoothLength', type: 'int', title: 'Smooth Length', defval: 5, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Smoothed MACD', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 2 },
  { id: 'plot2', title: 'Histogram', color: '#26A69A', lineWidth: 4, style: 'histogram' },
];

export const metadata = {
  title: 'Super Smoothed MACD',
  shortTitle: 'SSMACD',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<SuperSmoothedMACDInputs> = {}): IndicatorResult {
  const { fastLength, slowLength, signalLength, smoothLength, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);

  const fastEMA = ta.ema(source, fastLength);
  const slowEMA = ta.ema(source, slowLength);
  const rawMacd = fastEMA.sub(slowEMA);

  // Extra smoothing pass
  const smoothedMacd = ta.ema(rawMacd, smoothLength);
  const signalLine = ta.ema(smoothedMacd, signalLength);
  const histogram = smoothedMacd.sub(signalLine);

  const macdArr = smoothedMacd.toArray();
  const sigArr = signalLine.toArray();
  const histArr = histogram.toArray();

  const warmup = slowLength + smoothLength;

  const toPlot = (arr: (number | null)[]) =>
    arr.map((v, i) => ({ time: bars[i].time, value: (i < warmup || v == null) ? NaN : v }));

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

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': toPlot(macdArr), 'plot1': toPlot(sigArr), 'plot2': histPlot },
    hlines: [{ value: 0, options: { color: '#787B86', linestyle: 'dashed', title: 'Zero' } }],
  };
}

export const SuperSmoothedMACD = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
