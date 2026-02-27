/**
 * TonyUX EMA Scalper - Buy / Sell
 *
 * Pine: overlay=true, 3 plots + buy/sell markers:
 *   1) EMA(close, 20) in blue
 *   2) highest(close, 8) in red (linewidth=2)
 *   3) lowest(close, 8) in green (linewidth=2)
 *   Buy arrow: cross(close, EMA) and close[1] < close (bullish cross)
 *   Sell arrow: cross(close, EMA) and close[1] > close (bearish cross)
 *
 * Reference: TradingView "Tony's EMA Scalper - Buy / Sell" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface TonyUXScalperInputs {
  emaLength: number;
  channelLength: number;
}

export const defaultInputs: TonyUXScalperInputs = {
  emaLength: 20,
  channelLength: 8,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaLength', type: 'int', title: 'EMA Length', defval: 20, min: 1 },
  { id: 'channelLength', type: 'int', title: 'Channel Length', defval: 8, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'ema', title: 'EMA', color: '#2962FF', lineWidth: 1 },
  { id: 'highChannel', title: 'High Channel', color: '#EF5350', lineWidth: 2 },
  { id: 'lowChannel', title: 'Low Channel', color: '#26A69A', lineWidth: 2 },
];

export const metadata = {
  title: 'TonyUX EMA Scalper',
  shortTitle: 'TUX Scalper',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<TonyUXScalperInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { emaLength, channelLength } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeSeries = new Series(bars, (b) => b.close);
  const emaArr = ta.ema(closeSeries, emaLength).toArray();
  const highArr = ta.highest(closeSeries, channelLength).toArray();
  const lowArr = ta.lowest(closeSeries, channelLength).toArray();

  const warmup = Math.max(emaLength, channelLength);

  const emaPlot = emaArr.map((v, i) => ({
    time: bars[i].time,
    value: i < emaLength ? NaN : (v ?? NaN),
  }));

  const highPlot = highArr.map((v, i) => ({
    time: bars[i].time,
    value: i < channelLength ? NaN : v,
  }));

  const lowPlot = lowArr.map((v, i) => ({
    time: bars[i].time,
    value: i < channelLength ? NaN : v,
  }));

  // Buy/Sell markers: cross(close, EMA) means close crosses EMA in either direction
  // bearish = cross(close, out) == 1 and close[1] > close  (price fell through EMA)
  // bullish = cross(close, out) == 1 and close[1] < close  (price rose through EMA)
  const markers: MarkerData[] = [];
  for (let i = warmup + 1; i < n; i++) {
    const emaVal = emaArr[i];
    const prevEma = emaArr[i - 1];
    if (emaVal == null || prevEma == null) continue;

    const c = bars[i].close;
    const pc = bars[i - 1].close;

    // cross(): true when the two series cross (either direction)
    const crossed = (pc <= prevEma && c > emaVal) || (pc >= prevEma && c < emaVal) ||
                    (pc < prevEma && c >= emaVal) || (pc > prevEma && c <= emaVal);

    if (crossed) {
      if (pc > c) {
        // bearish: close[1] > close
        markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#EF5350', text: 'Sell' });
      } else if (pc < c) {
        // bullish: close[1] < close
        markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#26A69A', text: 'Buy' });
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { ema: emaPlot, highChannel: highPlot, lowChannel: lowPlot },
    markers,
  };
}

export const TonyUXScalper = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
