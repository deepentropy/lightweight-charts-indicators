/**
 * Fibonacci Levels
 *
 * Basic Fibonacci retracement with longer lookback.
 * Plots 7 levels from 0% to 100% between lowest low and highest high.
 *
 * Reference: TradingView "Fibonacci Levels" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface FibonacciLevelsInputs {
  length: number;
}

export const defaultInputs: FibonacciLevelsInputs = {
  length: 100,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 100, min: 2 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '0%', color: '#787B86', lineWidth: 1 },
  { id: 'plot1', title: '23.6%', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot2', title: '38.2%', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot3', title: '50%', color: '#FFEB3B', lineWidth: 1 },
  { id: 'plot4', title: '61.8%', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot5', title: '78.6%', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot6', title: '100%', color: '#787B86', lineWidth: 1 },
];

export const metadata = {
  title: 'Fibonacci Levels',
  shortTitle: 'FibLvl',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<FibonacciLevelsInputs> = {}): IndicatorResult {
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

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
  };
}

export const FibonacciLevels = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
