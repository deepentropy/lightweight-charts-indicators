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
import type { MarkerData } from '../types';

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

export function calculate(bars: Bar[], inputs: Partial<TurtleTradeChannelsInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { entryLength, exitLength } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const entryHighArr = ta.highest(highSeries, entryLength).toArray();
  const entryLowArr = ta.lowest(lowSeries, entryLength).toArray();
  const exitHighArr = ta.highest(highSeries, exitLength).toArray();
  const exitLowArr = ta.lowest(lowSeries, exitLength).toArray();

  const warmup = entryLength;

  // Turtle signals with barssince logic:
  // buySignal = high >= upper[1], sellSignal = low <= lower[1]
  // buyExit = low <= exitLow[1], sellExit = high >= exitHigh[1]
  // Simplified: track last signal times for entry/exit filtering
  const markers: MarkerData[] = [];
  let lastBuyEntry = -Infinity;
  let lastSellEntry = -Infinity;
  let lastBuyExit = -Infinity;
  let lastSellExit = -Infinity;

  for (let i = warmup + 1; i < n; i++) {
    const buySignal = bars[i].high >= (entryHighArr[i - 1] ?? 0);
    const sellSignal = bars[i].low <= (entryLowArr[i - 1] ?? Infinity);
    const buyExit = bars[i].low <= (exitLowArr[i - 1] ?? Infinity);
    const sellExit = bars[i].high >= (exitHighArr[i - 1] ?? 0);

    // Pine: plotshape(buySignal and O3<O1[1] ? down : na) -- long entry if last buyExit before last buyEntry
    if (buySignal && lastBuyExit > lastBuyEntry) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#26A69A', text: 'Long' });
      lastBuyEntry = i;
    }
    if (sellSignal && lastSellExit > lastSellEntry) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'Short' });
      lastSellEntry = i;
    }
    if (buyExit && lastBuyEntry > lastBuyExit) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#2196F3', text: 'Exit L' });
      lastBuyExit = i;
    }
    if (sellExit && lastSellEntry > lastSellExit) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#2196F3', text: 'Exit S' });
      lastSellExit = i;
    }
  }

  // Fill: Pine fills upper channel to exit line (green for long, red for short)
  // Determine fill color based on which entry signal is most recent
  const fillColors: string[] = [];
  let lastDir = 0;
  let lastBuyI = -Infinity;
  let lastSellI = -Infinity;
  let lastBuyExitI = -Infinity;
  let lastSellExitI = -Infinity;
  for (let i = 0; i < n; i++) {
    if (i >= warmup + 1) {
      if (bars[i].high >= (entryHighArr[i - 1] ?? 0) && lastBuyExitI > lastBuyI) { lastBuyI = i; }
      if (bars[i].low <= (entryLowArr[i - 1] ?? Infinity) && lastSellExitI > lastSellI) { lastSellI = i; }
      if (bars[i].low <= (exitLowArr[i - 1] ?? Infinity) && lastBuyI > lastBuyExitI) { lastBuyExitI = i; }
      if (bars[i].high >= (exitHighArr[i - 1] ?? 0) && lastSellI > lastSellExitI) { lastSellExitI = i; }
    }
    if (i < warmup) {
      fillColors.push('rgba(0,0,0,0)');
    } else if (lastBuyI > lastSellI && lastBuyI > lastBuyExitI) {
      fillColors.push('rgba(38,166,154,0.12)');
    } else if (lastSellI > lastBuyI && lastSellI > lastSellExitI) {
      fillColors.push('rgba(239,83,80,0.12)');
    } else {
      fillColors.push('rgba(0,0,0,0)');
    }
  }

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
    fills: [
      { plot1: 'plot0', plot2: 'plot2', options: { color: 'rgba(38,166,154,0.12)' }, colors: fillColors },
      { plot1: 'plot1', plot2: 'plot3', options: { color: 'rgba(239,83,80,0.12)' }, colors: fillColors },
    ],
    markers,
  };
}

export const TurtleTradeChannels = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
