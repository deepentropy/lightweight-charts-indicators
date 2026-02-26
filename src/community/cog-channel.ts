/**
 * Custom Center of Gravity Channel
 *
 * Center of Gravity via linear regression with standard deviation channel.
 * COG = linreg(source, length). Channel = COG +/- numDevs * stdev(source, length).
 *
 * Reference: TradingView "Center of Gravity Channel" community indicator
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface COGChannelInputs {
  length: number;
  numDevs: number;
  src: SourceType;
}

export const defaultInputs: COGChannelInputs = {
  length: 10,
  numDevs: 2.0,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 10, min: 1 },
  { id: 'numDevs', type: 'float', title: 'Num Deviations', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'COG', color: '#FFEB3B', lineWidth: 2 },
  { id: 'plot1', title: 'Upper', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot2', title: 'Lower', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'Center of Gravity Channel',
  shortTitle: 'COGCh',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<COGChannelInputs> = {}): IndicatorResult {
  const { length, numDevs, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);

  const cog = ta.linreg(source, length, 0);
  const dev = ta.stdev(source, length).mul(numDevs);
  const upper = cog.add(dev);
  const lower = cog.sub(dev);

  const cogArr = cog.toArray();
  const upperArr = upper.toArray();
  const lowerArr = lower.toArray();

  const warmup = length;

  const toPlot = (arr: (number | null)[]) =>
    arr.map((v, i) => ({ time: bars[i].time, value: (i < warmup || v == null) ? NaN : v }));

  const fillColors = bars.map((_b, i) => (i < warmup ? 'transparent' : '#FF6D0020'));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': toPlot(cogArr), 'plot1': toPlot(upperArr), 'plot2': toPlot(lowerArr) },
    fills: [{ plot1: 'plot1', plot2: 'plot2', colors: fillColors }],
  };
}

export const COGChannel = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
