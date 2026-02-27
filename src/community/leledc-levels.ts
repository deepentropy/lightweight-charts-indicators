/**
 * Leledc Levels
 *
 * Bar counting method for exhaustion detection.
 * Counts consecutive bars closing above/below close[4].
 * When counter reaches length, signals potential exhaustion (top/bottom).
 *
 * Reference: TradingView "Leledc Levels" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';

export interface LeledcLevelsInputs {
  length: number;
  bars: number;
}

export const defaultInputs: LeledcLevelsInputs = {
  length: 40,
  bars: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Swing Length', defval: 40, min: 1 },
  { id: 'bars', type: 'int', title: 'Exhaustion Bar Count', defval: 10, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Close', color: 'transparent', lineWidth: 0, display: 'none' },
  { id: 'plot1', title: 'Resistance Level', color: '#FF0000', lineWidth: 2 },
  { id: 'plot2', title: 'Support Level', color: '#138484', lineWidth: 2 },
];

export const metadata = {
  title: 'Leledc Levels',
  shortTitle: 'Leledc',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<LeledcLevelsInputs> = {}): IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[] } {
  const { length, bars: barCount } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const lookback = 4;

  let bindex = 0;
  let sindex = 0;
  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];

  const plot0 = bars.map((b) => ({ time: b.time, value: NaN }));
  const plot1: { time: number; value: number }[] = [];
  const plot2: { time: number; value: number }[] = [];

  // Track highest high over length for exhaustion condition
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);
  const highestArr = ta.highest(highSeries, length).toArray();
  const lowestArr = ta.lowest(lowSeries, length).toArray();

  let resistance = NaN;
  let support = NaN;

  for (let i = 0; i < n; i++) {
    if (i < lookback) {
      plot1.push({ time: bars[i].time, value: NaN });
      plot2.push({ time: bars[i].time, value: NaN });
      continue;
    }

    const close = bars[i].close;
    const open = bars[i].open;
    const high = bars[i].high;
    const low = bars[i].low;
    const closePrev = bars[i - lookback].close;

    // Pine: bindex increments when close > close[4]
    if (close > closePrev) bindex++;
    if (close < closePrev) sindex++;

    let lelex = 0;
    // Pine: bearish exhaustion: bindex > bars AND close < open AND high >= highest(high, len)
    if (bindex > barCount && close < open && high >= (highestArr[i] ?? Infinity)) {
      bindex = 0;
      lelex = -1;
    }
    // Pine: bullish exhaustion: sindex > bars AND close > open AND low <= lowest(low, len)
    if (sindex > barCount && close > open && low <= (lowestArr[i] ?? -Infinity)) {
      sindex = 0;
      lelex = 1;
    }

    // Markers for exhaustion arrows
    if (lelex === -1) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: '#EF5350', text: 'Top' });
      barColors.push({ time: bars[i].time, color: '#EF5350' });
    } else if (lelex === 1) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: '#26A69A', text: 'Bot' });
      barColors.push({ time: bars[i].time, color: '#26A69A' });
    } else {
      const bullish = close > closePrev;
      barColors.push({ time: bars[i].time, color: bullish ? 'rgba(38,166,154,0.3)' : 'rgba(239,83,80,0.3)' });
    }

    // Pine: resistance := close < open and Lelex ? high : resistance[1]
    if (close < open && lelex !== 0) {
      resistance = high;
    }
    // Pine: support := close > open and Lelex ? low : support[1]
    if (close > open && lelex !== 0) {
      support = low;
    }

    plot1.push({ time: bars[i].time, value: isNaN(resistance) ? NaN : resistance });
    plot2.push({ time: bars[i].time, value: isNaN(support) ? NaN : support });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2 },
    markers,
    barColors,
  };
}

export const LeledcLevels = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
