/**
 * Market Cipher A
 *
 * EMA ribbon overlay with 8 EMAs (5,11,15,18,21,24,28,34) and crossover signals.
 * - Green circle: EMA2 crosses above EMA8 (long signal)
 * - Red xcross: EMA1 crosses below EMA2 (warning)
 * - Blue triangle: EMA2 crosses above EMA3 (momentum)
 *
 * Reference: TradingView "Market Cipher A free version 1.1"
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface MarketCipherAInputs {
  ema1Len: number;
  ema2Len: number;
  ema3Len: number;
  ema4Len: number;
  ema5Len: number;
  ema6Len: number;
  ema7Len: number;
  ema8Len: number;
}

export const defaultInputs: MarketCipherAInputs = {
  ema1Len: 5,
  ema2Len: 11,
  ema3Len: 15,
  ema4Len: 18,
  ema5Len: 21,
  ema6Len: 24,
  ema7Len: 28,
  ema8Len: 34,
};

export const inputConfig: InputConfig[] = [
  { id: 'ema1Len', type: 'int', title: 'EMA 1', defval: 5, min: 1 },
  { id: 'ema2Len', type: 'int', title: 'EMA 2', defval: 11, min: 1 },
  { id: 'ema3Len', type: 'int', title: 'EMA 3', defval: 15, min: 1 },
  { id: 'ema4Len', type: 'int', title: 'EMA 4', defval: 18, min: 1 },
  { id: 'ema5Len', type: 'int', title: 'EMA 5', defval: 21, min: 1 },
  { id: 'ema6Len', type: 'int', title: 'EMA 6', defval: 24, min: 1 },
  { id: 'ema7Len', type: 'int', title: 'EMA 7', defval: 28, min: 1 },
  { id: 'ema8Len', type: 'int', title: 'EMA 8', defval: 34, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'ema1', title: 'EMA 1', color: '#265aa6', lineWidth: 2 },
  { id: 'ema2', title: 'EMA 2', color: '#265aa6', lineWidth: 2 },
  { id: 'ema3', title: 'EMA 3', color: '#1976d2', lineWidth: 2 },
  { id: 'ema4', title: 'EMA 4', color: '#1976d2', lineWidth: 2 },
  { id: 'ema5', title: 'EMA 5', color: '#7fb3ff', lineWidth: 2 },
  { id: 'ema6', title: 'EMA 6', color: '#7fb3ff', lineWidth: 2 },
  { id: 'ema7', title: 'EMA 7', color: '#bbdefb', lineWidth: 2 },
  { id: 'ema8', title: 'EMA 8', color: '#bbdefb', lineWidth: 2 },
];

export const metadata = {
  title: 'Market Cipher A',
  shortTitle: 'MCA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<MarketCipherAInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { ema1Len, ema2Len, ema3Len, ema4Len, ema5Len, ema6Len, ema7Len, ema8Len } = { ...defaultInputs, ...inputs };

  const close = new Series(bars, (b) => b.close);

  const lengths = [ema1Len, ema2Len, ema3Len, ema4Len, ema5Len, ema6Len, ema7Len, ema8Len];
  const emaArrays = lengths.map(len => ta.ema(close, len).toArray());

  const warmup = Math.max(...lengths);
  const plotIds = ['ema1', 'ema2', 'ema3', 'ema4', 'ema5', 'ema6', 'ema7', 'ema8'];

  const plots: Record<string, Array<{ time: number; value: number }>> = {};
  for (let p = 0; p < 8; p++) {
    plots[plotIds[p]] = emaArrays[p].map((v, i) => ({
      time: bars[i].time,
      value: (v == null || i < lengths[p]) ? NaN : v,
    }));
  }

  // Crossover markers from Pine:
  // Longema = crossover(ema2_, ema8_) -> green circle aboveBar
  // Redcross = crossunder(ema1_, ema2_) -> red xcross aboveBar
  // Bluetriangle = crossover(ema2_, ema3_) -> blue triangleUp belowBar
  const markers: MarkerData[] = [];
  const ema1Arr = emaArrays[0];
  const ema2Arr = emaArrays[1];
  const ema3Arr = emaArrays[2];
  const ema8Arr = emaArrays[7];

  for (let i = warmup + 1; i < bars.length; i++) {
    const e2 = ema2Arr[i];
    const e8 = ema8Arr[i];
    const pe2 = ema2Arr[i - 1];
    const pe8 = ema8Arr[i - 1];
    const e1 = ema1Arr[i];
    const pe1 = ema1Arr[i - 1];
    const e3 = ema3Arr[i];
    const pe3 = ema3Arr[i - 1];

    if (e2 == null || e8 == null || pe2 == null || pe8 == null) continue;

    // Longema: ema2 crosses above ema8
    if (pe2 <= pe8 && e2 > e8) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'circle', color: '#00FF00', text: '' });
    }

    // Redcross: ema1 crosses below ema2
    if (e1 != null && pe1 != null) {
      if (pe1 >= pe2 && e1 < e2) {
        markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'xcross', color: '#FF0000', text: '' });
      }
    }

    // Bluetriangle: ema2 crosses above ema3
    if (e3 != null && pe3 != null) {
      if (pe2 <= pe3 && e2 > e3) {
        markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: '#0000FF', text: '' });
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    markers,
  };
}

export const MarketCipherA = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
