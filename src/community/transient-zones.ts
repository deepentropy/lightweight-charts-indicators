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
}

export const defaultInputs: TransientZonesInputs = {
  length: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
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
  const { length } = { ...defaultInputs, ...inputs };

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

  // Markers: PTZ - new highs and new lows relative to lookback
  const markers: MarkerData[] = [];
  for (let i = length; i < bars.length; i++) {
    // Check if current bar makes a new low within the lookback period
    let isNewLow = true;
    let isNewHigh = true;
    for (let j = 1; j <= length; j++) {
      if (bars[i].low > bars[i - j].low) isNewLow = false;
      if (bars[i].high < bars[i - j].high) isNewHigh = false;
      if (!isNewLow && !isNewHigh) break;
    }
    if (isNewHigh) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowUp', color: '#26A69A' });
    }
    if (isNewLow) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowDown', color: '#EF5350' });
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
