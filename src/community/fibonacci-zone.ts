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
  { id: 'plot0', title: 'High Border', color: '#00FFFF', lineWidth: 1 },
  { id: 'plot1', title: '76.4%', color: '#00FFFF', lineWidth: 1 },
  { id: 'plot2', title: '61.8%', color: '#787B86', lineWidth: 1 },
  { id: 'plot3', title: '38.2%', color: '#787B86', lineWidth: 1 },
  { id: 'plot4', title: '23.6%', color: '#FF9800', lineWidth: 1 },
  { id: 'plot5', title: 'Low Border', color: '#FF9800', lineWidth: 1 },
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
  const plot3: { time: number; value: number }[] = [];
  const plot4: { time: number; value: number }[] = [];
  const plot5: { time: number; value: number }[] = [];

  for (let i = 0; i < bars.length; i++) {
    if (i < warmup || isNaN(highestArr[i]) || isNaN(lowestArr[i])) {
      plot0.push({ time: bars[i].time, value: NaN });
      plot1.push({ time: bars[i].time, value: NaN });
      plot2.push({ time: bars[i].time, value: NaN });
      plot3.push({ time: bars[i].time, value: NaN });
      plot4.push({ time: bars[i].time, value: NaN });
      plot5.push({ time: bars[i].time, value: NaN });
    } else {
      const hl = highestArr[i];       // High Border
      const ll = lowestArr[i];        // Low Border
      const dist = hl - ll;
      const hf = hl - dist * 0.236;   // 76.4% (Highest Fibonacci)
      const cfh = hl - dist * 0.382;  // 61.8% (Center High Fibonacci)
      const cfl = hl - dist * 0.618;  // 38.2% (Center Low Fibonacci)
      const lf = hl - dist * 0.764;   // 23.6% (Lowest Fibonacci)
      plot0.push({ time: bars[i].time, value: hl });
      plot1.push({ time: bars[i].time, value: hf });
      plot2.push({ time: bars[i].time, value: cfh });
      plot3.push({ time: bars[i].time, value: cfl });
      plot4.push({ time: bars[i].time, value: lf });
      plot5.push({ time: bars[i].time, value: ll });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3, 'plot4': plot4, 'plot5': plot5 },
    fills: [
      { plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(0,255,255,0.15)' } },
      { plot1: 'plot2', plot2: 'plot3', options: { color: 'rgba(128,128,128,0.15)' } },
      { plot1: 'plot4', plot2: 'plot5', options: { color: 'rgba(255,152,0,0.15)' } },
    ],
  };
}

export const FibonacciZone = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
