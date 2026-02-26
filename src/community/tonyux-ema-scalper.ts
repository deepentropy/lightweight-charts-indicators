/**
 * TonyUX EMA Scalper
 *
 * EMA-based scalper with 4 EMA lines.
 * Buy when all aligned bullish (EMA8 > EMA13 > EMA21 > EMA55).
 * Sell when bearish aligned (EMA8 < EMA13 < EMA21 < EMA55).
 *
 * Reference: TradingView "TonyUX EMA Scalper" (community)
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface TonyUXScalperInputs {
  len1: number;
  len2: number;
  len3: number;
  len4: number;
  src: SourceType;
}

export const defaultInputs: TonyUXScalperInputs = {
  len1: 8,
  len2: 13,
  len3: 21,
  len4: 55,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'len1', type: 'int', title: 'EMA 1 Length', defval: 8, min: 1 },
  { id: 'len2', type: 'int', title: 'EMA 2 Length', defval: 13, min: 1 },
  { id: 'len3', type: 'int', title: 'EMA 3 Length', defval: 21, min: 1 },
  { id: 'len4', type: 'int', title: 'EMA 4 Length', defval: 55, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA 8', color: '#00E676', lineWidth: 2 },
  { id: 'plot1', title: 'EMA 13', color: '#26A69A', lineWidth: 2 },
  { id: 'plot2', title: 'EMA 21', color: '#FF6D00', lineWidth: 2 },
  { id: 'plot3', title: 'EMA 55', color: '#EF5350', lineWidth: 2 },
];

export const metadata = {
  title: 'TonyUX EMA Scalper',
  shortTitle: 'TUXS',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<TonyUXScalperInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { len1, len2, len3, len4, src } = { ...defaultInputs, ...inputs };

  const source = getSourceSeries(bars, src);
  const ema1 = ta.ema(source, len1);
  const ema2 = ta.ema(source, len2);
  const ema3 = ta.ema(source, len3);
  const ema4 = ta.ema(source, len4);

  const arr1 = ema1.toArray();
  const arr2 = ema2.toArray();
  const arr3 = ema3.toArray();
  const arr4 = ema4.toArray();

  const warmup = len4;
  const markers: MarkerData[] = [];

  for (let i = warmup + 1; i < bars.length; i++) {
    const e1 = arr1[i] ?? 0;
    const e2 = arr2[i] ?? 0;
    const e3 = arr3[i] ?? 0;
    const e4 = arr4[i] ?? 0;
    const pe1 = arr1[i - 1] ?? 0;
    const pe2 = arr2[i - 1] ?? 0;
    const pe3 = arr3[i - 1] ?? 0;
    const pe4 = arr4[i - 1] ?? 0;

    const bullish = e1 > e2 && e2 > e3 && e3 > e4;
    const prevBullish = pe1 > pe2 && pe2 > pe3 && pe3 > pe4;
    const bearish = e1 < e2 && e2 < e3 && e3 < e4;
    const prevBearish = pe1 < pe2 && pe2 < pe3 && pe3 < pe4;

    if (bullish && !prevBullish) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#26A69A', text: 'Buy' });
    } else if (bearish && !prevBearish) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'Sell' });
    }
  }

  const toPlot = (arr: (number | null)[]) =>
    arr.map((v, i) => ({
      time: bars[i].time,
      value: (v == null || i < warmup) ? NaN : v,
    }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': toPlot(arr1), 'plot1': toPlot(arr2), 'plot2': toPlot(arr3), 'plot3': toPlot(arr4) },
    markers,
  };
}

export const TonyUXScalper = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
