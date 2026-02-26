/**
 * Binary Option Arrows
 *
 * Buy/sell arrows based on RSI crossing 50 combined with MACD histogram direction.
 * Buy: RSI crosses above 50 AND MACD histogram > 0.
 * Sell: RSI crosses below 50 AND MACD histogram < 0.
 *
 * Reference: TradingView "Binary Option Arrows" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface BinaryOptionArrowsInputs {
  rsiLen: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
}

export const defaultInputs: BinaryOptionArrowsInputs = {
  rsiLen: 14,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'macdFast', type: 'int', title: 'MACD Fast', defval: 12, min: 1 },
  { id: 'macdSlow', type: 'int', title: 'MACD Slow', defval: 26, min: 1 },
  { id: 'macdSignal', type: 'int', title: 'MACD Signal', defval: 9, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Close', color: 'transparent', lineWidth: 0, display: 'none' },
];

export const metadata = {
  title: 'Binary Option Arrows',
  shortTitle: 'BinArrows',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<BinaryOptionArrowsInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { rsiLen, macdFast, macdSlow, macdSignal } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const closeSeries = new Series(bars, (b) => b.close);

  const rsiArr = ta.rsi(closeSeries, rsiLen).toArray();

  // MACD manually: fast EMA - slow EMA, then signal EMA on that
  const emaFastArr = ta.ema(closeSeries, macdFast).toArray();
  const emaSlowArr = ta.ema(closeSeries, macdSlow).toArray();
  const macdLineArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    macdLineArr[i] = (emaFastArr[i] ?? NaN) - (emaSlowArr[i] ?? NaN);
  }
  const signalArr = ta.ema(new Series(bars, (_b, i) => macdLineArr[i]), macdSignal).toArray();
  const histArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    histArr[i] = macdLineArr[i] - (signalArr[i] ?? NaN);
  }

  const warmup = Math.max(rsiLen, macdSlow) + macdSignal;
  const markers: MarkerData[] = [];
  const plot0 = bars.map((b) => ({ time: b.time, value: NaN }));

  for (let i = warmup; i < n; i++) {
    const rsiCur = rsiArr[i];
    const rsiPrev = rsiArr[i - 1];
    if (isNaN(rsiCur) || isNaN(rsiPrev) || isNaN(histArr[i])) continue;

    // RSI crosses above 50
    if (rsiPrev <= 50 && rsiCur > 50 && histArr[i] > 0) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#26A69A', text: 'Buy' });
    }
    // RSI crosses below 50
    if (rsiPrev >= 50 && rsiCur < 50 && histArr[i] < 0) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#EF5350', text: 'Sell' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    markers,
  };
}

export const BinaryOptionArrows = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
