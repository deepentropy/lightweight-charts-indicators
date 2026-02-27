/**
 * Moving Average Colored EMA/SMA
 *
 * Single MA line colored by direction: green when rising, red when falling.
 *
 * Reference: TradingView "Moving Average Colored EMA/SMA" (community)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface MAColoredInputs {
  emaLength: number;
  smaLength: number;
  src: SourceType;
}

export const defaultInputs: MAColoredInputs = {
  emaLength: 8,
  smaLength: 8,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'emaLength', type: 'int', title: 'EMA Length', defval: 8, min: 1 },
  { id: 'smaLength', type: 'int', title: 'SMA Length', defval: 8, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA', color: '#26A69A', lineWidth: 3 },
  { id: 'plot1', title: 'SMA', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Moving Average Colored',
  shortTitle: 'MAC',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<MAColoredInputs> = {}): IndicatorResult {
  const { emaLength, smaLength, src } = { ...defaultInputs, ...inputs };
  const srcSeries = getSourceSeries(bars, src);

  const emaArr = ta.ema(srcSeries, emaLength).toArray();
  const smaArr = ta.sma(srcSeries, smaLength).toArray();

  const emaPlot = emaArr.map((v, i) => {
    if (i < emaLength) return { time: bars[i].time, value: NaN };
    const val = v ?? NaN;
    const prev = i > 0 ? (emaArr[i - 1] ?? val) : val;
    const color = val > prev ? '#26A69A' : val < prev ? '#EF5350' : '#2962FF';
    return { time: bars[i].time, value: val, color };
  });

  const smaPlot = smaArr.map((v, i) => {
    if (i < smaLength) return { time: bars[i].time, value: NaN };
    const val = v ?? NaN;
    const prev = i > 0 ? (smaArr[i - 1] ?? val) : val;
    const color = val > prev ? '#26A69A' : val < prev ? '#EF5350' : '#2962FF';
    return { time: bars[i].time, value: val, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': emaPlot, 'plot1': smaPlot },
  };
}

export const MAColored = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
