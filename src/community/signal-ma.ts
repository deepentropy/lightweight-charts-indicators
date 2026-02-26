/**
 * Signal Moving Average
 *
 * SMA with signal line (EMA of SMA). SMA colored green when above signal, red when below.
 *
 * Reference: TradingView "Signal Moving Average" by LuxAlgo
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface SignalMAInputs {
  length: number;
  signalLength: number;
  src: SourceType;
}

export const defaultInputs: SignalMAInputs = {
  length: 20,
  signalLength: 9,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 9, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SMA', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'Signal Moving Average',
  shortTitle: 'SigMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<SignalMAInputs> = {}): IndicatorResult {
  const { length, signalLength, src } = { ...defaultInputs, ...inputs };
  const srcSeries = getSourceSeries(bars, src);

  const smaArr = ta.sma(srcSeries, length).toArray();

  // Create Series from SMA for signal EMA calculation
  const smaSeries = new Series(bars, (_bar, i) => smaArr[i] ?? 0);
  const signalArr = ta.ema(smaSeries, signalLength).toArray();

  const warmup = length + signalLength;

  const plot0 = smaArr.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const smaVal = v ?? 0;
    const sigVal = signalArr[i] ?? 0;
    return { time: bars[i].time, value: smaVal, color: smaVal > sigVal ? '#26A69A' : '#EF5350' };
  });

  const plot1 = signalArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (v ?? NaN),
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
  };
}

export const SignalMA = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
