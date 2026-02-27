/**
 * Transient Zones v1.1
 *
 * Volatility-based zones using ATR. Upper = close + ATR, Lower = close - ATR.
 *
 * Reference: TradingView "Transient Zones v1.1" (community)
 */

import { ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface TransientZonesInputs {
  length: number;
  hLeft: number;
  hRight: number;
  showPtz: boolean;
}

export const defaultInputs: TransientZonesInputs = {
  length: 14,
  hLeft: 10,
  hRight: 10,
  showPtz: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
  { id: 'hLeft', type: 'int', title: 'H left', defval: 10, min: 1 },
  { id: 'hRight', type: 'int', title: 'H right', defval: 10, min: 1 },
  { id: 'showPtz', type: 'bool', title: 'Show PTZ', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot1', title: 'Lower', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Transient Zones v1.1',
  shortTitle: 'TZones',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<TransientZonesInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { length, hLeft, hRight, showPtz } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const atrArr = ta.atr(bars, length).toArray();
  const warmup = length;

  const upperPlot = bars.map((b, i) => ({
    time: b.time,
    value: i < warmup || isNaN(atrArr[i]) ? NaN : b.close + atrArr[i],
  }));
  const lowerPlot = bars.map((b, i) => ({
    time: b.time,
    value: i < warmup || isNaN(atrArr[i]) ? NaN : b.close - atrArr[i],
  }));

  const markers: MarkerData[] = [];

  // PTZ markers: new highs/lows relative to h_left lookback (Pine: plotshape)
  if (showPtz) {
    for (let i = hLeft; i < n; i++) {
      let hLeftLow = Infinity;
      let hLeftHigh = -Infinity;
      for (let j = 1; j <= hLeft; j++) {
        if (bars[i - j].low < hLeftLow) hLeftLow = bars[i - j].low;
        if (bars[i - j].high > hLeftHigh) hLeftHigh = bars[i - j].high;
      }
      const newHigh = bars[i].high >= hLeftHigh;
      const newLow = bars[i].low <= hLeftLow;
      if (newHigh) {
        markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleUp', color: '#4CAF50' });
      }
      if (newLow) {
        markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleDown', color: '#EF5350' });
      }
    }
  }

  // Confirmed TZ: central bar is highest/lowest in full h_left + h_right + 1 window
  // Pine: plotarrow with offset=-h_right-1, so marker placed at central bar
  const fullWindow = hLeft + hRight + 1;
  for (let i = fullWindow - 1; i < n; i++) {
    const centralIdx = i - hRight;
    if (centralIdx < 0) continue;
    const centralLow = bars[centralIdx].low;
    const centralHigh = bars[centralIdx].high;
    let isHighest = true;
    let isLowest = true;
    for (let j = i - fullWindow + 1; j <= i; j++) {
      if (j === centralIdx) continue;
      if (bars[j].high > centralHigh) isHighest = false;
      if (bars[j].low < centralLow) isLowest = false;
      if (!isHighest && !isLowest) break;
    }
    if (isHighest) {
      markers.push({ time: bars[centralIdx].time, position: 'aboveBar', shape: 'arrowDown', color: '#EF5350', text: 'TZ' });
    }
    if (isLowest) {
      markers.push({ time: bars[centralIdx].time, position: 'belowBar', shape: 'arrowUp', color: '#4CAF50', text: 'TZ' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': upperPlot, 'plot1': lowerPlot },
    fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(41,98,255,0.08)' } }],
    markers,
  };
}

export const TransientZones = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
