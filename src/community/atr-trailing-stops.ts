/**
 * ATR Trailing Stops Colored
 *
 * ATR-based trailing stop with direction color.
 * Trailing stop ratchets in favorable direction only.
 * Green when price above stop (long), red when below (short).
 *
 * Reference: TradingView "ATR Trailing Stops" (community)
 */

import { ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';

export interface ATRTrailingStopsInputs {
  atrPeriod: number;
  atrMultiplier: number;
}

export const defaultInputs: ATRTrailingStopsInputs = {
  atrPeriod: 5,
  atrMultiplier: 3.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrPeriod', type: 'int', title: 'ATR Period', defval: 5, min: 1 },
  { id: 'atrMultiplier', type: 'float', title: 'ATR Multiplier', defval: 3.5, min: 0.1, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trailing Stop', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'ATR Trailing Stops',
  shortTitle: 'ATRTS',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<ATRTrailingStopsInputs> = {}): IndicatorResult {
  const { atrPeriod, atrMultiplier } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const atrArr = ta.atr(bars, atrPeriod).toArray();

  const stopArr: number[] = new Array(n);
  const dirArr: number[] = new Array(n); // 1 = long, -1 = short

  for (let i = 0; i < n; i++) {
    const atrVal = (atrArr[i] ?? 0) * atrMultiplier;
    const close = bars[i].close;

    if (i === 0) {
      stopArr[i] = close - atrVal;
      dirArr[i] = 1;
      continue;
    }

    const prevStop = stopArr[i - 1];
    const prevClose = bars[i - 1].close;
    const prevDir = dirArr[i - 1];

    if (prevDir === 1) {
      // Long: trailing stop is below price
      const newStop = close - atrVal;
      stopArr[i] = close > prevStop ? Math.max(newStop, prevStop) : newStop;
      dirArr[i] = close < prevStop ? -1 : 1;
    } else {
      // Short: trailing stop is above price
      const newStop = close + atrVal;
      stopArr[i] = close < prevStop ? Math.min(newStop, prevStop) : newStop;
      dirArr[i] = close > prevStop ? 1 : -1;
    }
  }

  const warmup = atrPeriod;
  const plot = stopArr.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const color = dirArr[i] === 1 ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  // Pine barcolor: green when close > TS, red when close < TS, black otherwise
  const barColors: BarColorData[] = [];
  for (let i = warmup; i < n; i++) {
    const c = bars[i].close;
    const ts = stopArr[i];
    if (c > ts) {
      barColors.push({ time: bars[i].time, color: '#00FF00' });
    } else if (c < ts) {
      barColors.push({ time: bars[i].time, color: '#FF0000' });
    } else {
      barColors.push({ time: bars[i].time, color: '#000000' });
    }
  }

  // Pine plotshape: Buy on crossover(close, TS), Sell on crossunder(close, TS)
  const markers: MarkerData[] = [];
  for (let i = warmup + 1; i < n; i++) {
    const prevBelow = bars[i - 1].close <= stopArr[i - 1];
    const curAbove = bars[i].close > stopArr[i];
    const prevAbove = bars[i - 1].close >= stopArr[i - 1];
    const curBelow = bars[i].close < stopArr[i];

    if (prevBelow && curAbove) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#00FF00', text: 'BUY' });
    }
    if (prevAbove && curBelow) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#FF0000', text: 'SELL' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot },
    markers,
    barColors,
  } as IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[] };
}

export const ATRTrailingStops = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
