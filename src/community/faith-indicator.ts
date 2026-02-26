/**
 * Faith Indicator
 *
 * Momentum-based indicator. Faith = EMA(close, fast) - EMA(close, slow).
 * Signal = SMA(faith, 9). Histogram colored by faith vs signal.
 *
 * Reference: TradingView "Faith Indicator" (community)
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface FaithIndicatorInputs {
  fastLen: number;
  slowLen: number;
}

export const defaultInputs: FaithIndicatorInputs = {
  fastLen: 14,
  slowLen: 28,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLen', type: 'int', title: 'Fast Length', defval: 14, min: 1 },
  { id: 'slowLen', type: 'int', title: 'Slow Length', defval: 28, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Faith', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'Faith Indicator',
  shortTitle: 'Faith',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<FaithIndicatorInputs> = {}): IndicatorResult {
  const { fastLen, slowLen } = { ...defaultInputs, ...inputs };

  const closeSeries = getSourceSeries(bars, 'close');
  const fastArr = ta.ema(closeSeries, fastLen).toArray();
  const slowArr = ta.ema(closeSeries, slowLen).toArray();

  const faithValues = fastArr.map((v, i) => v - (slowArr[i] ?? 0));
  const faithSeries = new Series(bars, (_b, i) => faithValues[i]);
  const signalArr = ta.sma(faithSeries, 9).toArray();

  const warmup = slowLen + 9;

  const faithPlot = faithValues.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const color = v > (signalArr[i] ?? 0) ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  const signalPlot = signalArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || isNaN(v) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': faithPlot, 'plot1': signalPlot },
  };
}

export const FaithIndicator = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
