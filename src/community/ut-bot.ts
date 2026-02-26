/**
 * UT Bot Alerts
 *
 * ATR-based trailing stop that flips direction with price.
 * Trailing stop = price ± (key * ATR). Ratchets in trend direction only.
 *
 * Reference: TradingView "UT Bot Alerts"
 */

import { ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';

export interface UTBotInputs {
  keyValue: number;
  atrPeriod: number;
}

export const defaultInputs: UTBotInputs = {
  keyValue: 1,
  atrPeriod: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'keyValue', type: 'float', title: 'Key Value (Sensitivity)', defval: 1, min: 0.1, step: 0.1 },
  { id: 'atrPeriod', type: 'int', title: 'ATR Period', defval: 10, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trailing Stop', color: '#26A69A', lineWidth: 2 },
];

export const metadata = {
  title: 'UT Bot',
  shortTitle: 'UTBot',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<UTBotInputs> = {}): IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[] } {
  const { keyValue, atrPeriod } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const atrArr = ta.atr(bars, atrPeriod).toArray();
  const trailStop: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const nLoss = keyValue * (atrArr[i] ?? 0);
    const src = bars[i].close;

    if (i === 0) {
      trailStop[i] = src - nLoss;
    } else {
      const prev = trailStop[i - 1];
      const prevSrc = bars[i - 1].close;
      if (src > prev && prevSrc > prev) {
        trailStop[i] = Math.max(prev, src - nLoss);
      } else if (src < prev && prevSrc < prev) {
        trailStop[i] = Math.min(prev, src + nLoss);
      } else if (src > prev) {
        trailStop[i] = src - nLoss;
      } else {
        trailStop[i] = src + nLoss;
      }
    }
  }

  const warmup = atrPeriod;
  // Dynamic color: green when close > trailing stop, red otherwise
  const barColors: BarColorData[] = [];
  const plot0 = trailStop.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const above = bars[i].close > v;
    const color = above ? '#26A69A' : '#EF5350';
    barColors.push({ time: bars[i].time as number, color });
    return { time: bars[i].time, value: v, color };
  });

  // Markers: buy when close crosses above trailing stop, sell when crosses below
  const markers: MarkerData[] = [];
  for (let i = warmup + 1; i < n; i++) {
    const prevAbove = bars[i - 1].close > trailStop[i - 1];
    const curAbove = bars[i].close > trailStop[i];
    if (!prevAbove && curAbove) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#26A69A', text: 'Buy' });
    } else if (prevAbove && !curAbove) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'Sell' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    markers,
    barColors,
  };
}

export const UTBot = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
