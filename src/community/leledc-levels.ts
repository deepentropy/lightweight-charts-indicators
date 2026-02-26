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
}

export const defaultInputs: LeledcLevelsInputs = {
  length: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Close', color: 'transparent', lineWidth: 0, display: 'none' },
];

export const metadata = {
  title: 'Leledc Levels',
  shortTitle: 'Leledc',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<LeledcLevelsInputs> = {}): IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[] } {
  const { length } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const lookback = 4;

  let upCount = 0;
  let dnCount = 0;
  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];

  const plot0 = bars.map((b) => ({ time: b.time, value: NaN }));

  for (let i = lookback; i < n; i++) {
    const close = bars[i].close;
    const closePrev = bars[i - lookback].close;

    if (close > closePrev) {
      upCount++;
      dnCount = 0;
    } else if (close < closePrev) {
      dnCount++;
      upCount = 0;
    } else {
      upCount = 0;
      dnCount = 0;
    }

    if (upCount >= length) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: '#EF5350', text: 'Top' });
      barColors.push({ time: bars[i].time, color: '#EF5350' });
      upCount = 0;
    } else if (dnCount >= length) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: '#26A69A', text: 'Bot' });
      barColors.push({ time: bars[i].time, color: '#26A69A' });
      dnCount = 0;
    } else {
      const bullish = close > closePrev;
      barColors.push({ time: bars[i].time, color: bullish ? 'rgba(38,166,154,0.3)' : 'rgba(239,83,80,0.3)' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    markers,
    barColors,
  };
}

export const LeledcLevels = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
