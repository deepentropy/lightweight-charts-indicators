/**
 * ST0P
 *
 * ATR-based trailing stop loss indicator.
 * In uptrend: stop = close - mult*ATR, trails upward only.
 * In downtrend: stop = close + mult*ATR, trails downward only.
 *
 * Reference: TradingView "ST0P" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface ST0PInputs {
  length: number;
  mult: number;
}

export const defaultInputs: ST0PInputs = {
  length: 14,
  mult: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'ATR Length', defval: 14, min: 1 },
  { id: 'mult', type: 'float', title: 'Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Stop', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'ST0P',
  shortTitle: 'ST0P',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<ST0PInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { length, mult } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const atrSeries = ta.atr(bars, length);
  const atrArr = atrSeries.toArray();

  const stopArr: number[] = new Array(n);
  const dirArr: number[] = new Array(n); // 1 = long, -1 = short

  stopArr[0] = bars[0].close;
  dirArr[0] = 1;

  for (let i = 1; i < n; i++) {
    const close = bars[i].close;
    const atrVal = (atrArr[i] ?? 0) * mult;
    const prevStop = stopArr[i - 1];
    const prevDir = dirArr[i - 1];

    if (prevDir === 1) {
      const newStop = close - atrVal;
      stopArr[i] = Math.max(newStop, prevStop);
      dirArr[i] = close < stopArr[i] ? -1 : 1;
    } else {
      const newStop = close + atrVal;
      stopArr[i] = Math.min(newStop, prevStop);
      dirArr[i] = close > stopArr[i] ? 1 : -1;
    }
  }

  const warmup = length;
  const markers: MarkerData[] = [];

  for (let i = warmup + 1; i < n; i++) {
    if (dirArr[i] !== dirArr[i - 1]) {
      if (dirArr[i] === 1) {
        markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#26A69A', text: 'Buy' });
      } else {
        markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'Sell' });
      }
    }
  }

  const plot0 = stopArr.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const color = dirArr[i] === 1 ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    markers,
  };
}

export const ST0P = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
