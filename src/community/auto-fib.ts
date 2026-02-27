/**
 * Auto Fibonacci
 *
 * Automatic Fibonacci retracement levels based on highest high and lowest low
 * over a lookback period. Plots 7 standard Fibonacci levels.
 *
 * Reference: TradingView "Auto Fibonacci" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface AutoFibInputs {
  length: number;
}

export const defaultInputs: AutoFibInputs = {
  length: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 50, min: 2 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fib 0.0', color: '#787B86', lineWidth: 1 },
  { id: 'plot1', title: 'Fib 0.236', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot2', title: 'Fib 0.382', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot3', title: 'Fib 0.5', color: '#FFEB3B', lineWidth: 1 },
  { id: 'plot4', title: 'Fib 0.618', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot5', title: 'Fib 0.786', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot6', title: 'Fib 1.0', color: '#787B86', lineWidth: 1 },
];

export const metadata = {
  title: 'Auto Fibonacci',
  shortTitle: 'AutoFib',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<AutoFibInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const highestArr = ta.highest(highSeries, length).toArray();
  const lowestArr = ta.lowest(lowSeries, length).toArray();

  const warmup = length;
  const fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];

  const plots: Record<string, { time: number; value: number }[]> = {};
  for (let f = 0; f < fibLevels.length; f++) {
    plots[`plot${f}`] = [];
  }

  for (let i = 0; i < bars.length; i++) {
    if (i < warmup || isNaN(highestArr[i]) || isNaN(lowestArr[i])) {
      for (let f = 0; f < fibLevels.length; f++) {
        plots[`plot${f}`].push({ time: bars[i].time, value: NaN });
      }
    } else {
      const h = highestArr[i];
      const l = lowestArr[i];
      const range = h - l;
      for (let f = 0; f < fibLevels.length; f++) {
        plots[`plot${f}`].push({ time: bars[i].time, value: l + range * fibLevels[f] });
      }
    }
  }

  // Pine fills between adjacent fib level plots:
  // fill(ON,SS, red), fill(SS,SO, #3399FF), fill(SO,FI, lime),
  // fill(FI,TE, lime), fill(TE,TT, #3399FF), fill(TT,ZZ, red)
  // Levels: plot6=1.0, plot5=0.786, plot4=0.618, plot3=0.5, plot2=0.382, plot1=0.236, plot0=0.0
  const fills = [
    { plot1: 'plot6', plot2: 'plot5', options: { color: 'rgba(255,0,0,0.20)' } },
    { plot1: 'plot5', plot2: 'plot4', options: { color: 'rgba(51,153,255,0.20)' } },
    { plot1: 'plot4', plot2: 'plot3', options: { color: 'rgba(0,255,0,0.20)' } },
    { plot1: 'plot3', plot2: 'plot2', options: { color: 'rgba(0,255,0,0.20)' } },
    { plot1: 'plot2', plot2: 'plot1', options: { color: 'rgba(51,153,255,0.20)' } },
    { plot1: 'plot1', plot2: 'plot0', options: { color: 'rgba(255,0,0,0.20)' } },
  ];

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    fills,
  };
}

export const AutoFib = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
