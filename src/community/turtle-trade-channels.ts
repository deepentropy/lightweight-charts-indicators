/**
 * Turtle Trade Channels
 *
 * Classic Turtle Trading channel breakout system.
 * Entry channel: highest high / lowest low over entryLength bars.
 * Exit channel: highest high / lowest low over exitLength bars.
 *
 * Reference: TradingView "Turtle Trade Channels" by Richard Dennis / William Eckhardt
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface TurtleTradeChannelsInputs {
  entryLength: number;
  exitLength: number;
}

export const defaultInputs: TurtleTradeChannelsInputs = {
  entryLength: 20,
  exitLength: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'entryLength', type: 'int', title: 'Entry Length', defval: 20, min: 1 },
  { id: 'exitLength', type: 'int', title: 'Exit Length', defval: 10, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Entry High', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'Entry Low', color: '#EF5350', lineWidth: 2 },
  { id: 'plot2', title: 'Exit High', color: '#2962FF', lineWidth: 1 },
  { id: 'plot3', title: 'Exit Low', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'Turtle Trade Channels',
  shortTitle: 'TTC',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<TurtleTradeChannelsInputs> = {}): IndicatorResult {
  const { entryLength, exitLength } = { ...defaultInputs, ...inputs };

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const entryHighArr = ta.highest(highSeries, entryLength).toArray();
  const entryLowArr = ta.lowest(lowSeries, entryLength).toArray();
  const exitHighArr = ta.highest(highSeries, exitLength).toArray();
  const exitLowArr = ta.lowest(lowSeries, exitLength).toArray();

  const warmup = entryLength;

  const plot0 = entryHighArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || isNaN(v) ? NaN : v,
  }));
  const plot1 = entryLowArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || isNaN(v) ? NaN : v,
  }));
  const plot2 = exitHighArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || isNaN(v) ? NaN : v,
  }));
  const plot3 = exitLowArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || isNaN(v) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3 },
  };
}

export const TurtleTradeChannels = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
