/**
 * Fibonacci Zone
 *
 * Fibonacci zones as bands. Plots the golden zone (38.2%-61.8%) boundaries
 * and the 50% midline based on highest high and lowest low.
 *
 * Reference: TradingView "Fibonacci Zone" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface FibonacciZoneInputs {
  length: number;
}

export const defaultInputs: FibonacciZoneInputs = {
  length: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 50, min: 2 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '61.8%', color: '#FFEB3B', lineWidth: 1 },
  { id: 'plot1', title: '50%', color: '#787B86', lineWidth: 1 },
  { id: 'plot2', title: '38.2%', color: '#FFEB3B', lineWidth: 1 },
];

export const metadata = {
  title: 'Fibonacci Zone',
  shortTitle: 'FibZone',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<FibonacciZoneInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const highestArr = ta.highest(highSeries, length).toArray();
  const lowestArr = ta.lowest(lowSeries, length).toArray();

  const warmup = length;

  const plot0: { time: number; value: number }[] = [];
  const plot1: { time: number; value: number }[] = [];
  const plot2: { time: number; value: number }[] = [];

  for (let i = 0; i < bars.length; i++) {
    if (i < warmup || isNaN(highestArr[i]) || isNaN(lowestArr[i])) {
      plot0.push({ time: bars[i].time, value: NaN });
      plot1.push({ time: bars[i].time, value: NaN });
      plot2.push({ time: bars[i].time, value: NaN });
    } else {
      const h = highestArr[i];
      const l = lowestArr[i];
      const range = h - l;
      plot0.push({ time: bars[i].time, value: l + range * 0.618 });
      plot1.push({ time: bars[i].time, value: l + range * 0.5 });
      plot2.push({ time: bars[i].time, value: l + range * 0.382 });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2 },
    fills: [{ plot1: 'plot0', plot2: 'plot2', options: { color: 'rgba(255,235,59,0.1)' } }],
  };
}

export const FibonacciZone = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
