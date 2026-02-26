/**
 * CDC Action Zone V.2
 *
 * Two-EMA crossover system with an intermediate smoothing layer.
 * AP = EMA(source, 2), Fast = EMA(AP, short), Slow = EMA(AP, long).
 * Zones: Green (bullish + AP > Fast), Red (bearish + AP < Fast),
 * Yellow (bullish + AP < Fast), Blue (bearish + AP > Fast).
 *
 * Reference: TradingView "CDC Action Zone V.2"
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface CDCActionZoneInputs {
  source: SourceType;
  shortPeriod: number;
  longPeriod: number;
}

export const defaultInputs: CDCActionZoneInputs = {
  source: 'ohlc4',
  shortPeriod: 12,
  longPeriod: 26,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'ohlc4' },
  { id: 'shortPeriod', type: 'int', title: 'Short MA Period', defval: 12, min: 1 },
  { id: 'longPeriod', type: 'int', title: 'Long MA Period', defval: 26, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast', color: '#EF5350', lineWidth: 1 },
  { id: 'plot1', title: 'Slow', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'CDC Action Zone',
  shortTitle: 'CDC',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<CDCActionZoneInputs> = {}): IndicatorResult & { barColors: BarColorData[] } {
  const { source, shortPeriod, longPeriod } = { ...defaultInputs, ...inputs };

  const src = getSourceSeries(bars, source);
  const ap = ta.ema(src, 2);
  const fast = ta.ema(ap, shortPeriod);
  const slow = ta.ema(ap, longPeriod);
  const fastArr = fast.toArray();
  const slowArr = slow.toArray();
  const apArr = ap.toArray();

  const toPlot = (arr: (number | null)[]) =>
    arr.map((v, i) => ({ time: bars[i].time, value: i < longPeriod ? NaN : (v ?? NaN) }));

  // Zone coloring: Green (bull + AP>Fast), Yellow (bull + AP<Fast), Red (bear + AP<Fast), Blue (bear + AP>Fast)
  const barColors: BarColorData[] = [];
  const fillColors: string[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (i < longPeriod) { fillColors.push('transparent'); continue; }
    const f = fastArr[i] ?? 0;
    const s2 = slowArr[i] ?? 0;
    const a = apArr[i] ?? 0;
    const bullish = f > s2;
    let color: string;
    if (bullish && a > f) color = '#00FF00';       // Green zone
    else if (bullish && a <= f) color = '#FFFF00';  // Yellow zone
    else if (!bullish && a < f) color = '#FF0000';  // Red zone
    else color = '#0000FF';                          // Blue zone
    barColors.push({ time: bars[i].time as number, color });
    fillColors.push(color + '40'); // 25% alpha
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': toPlot(fastArr), 'plot1': toPlot(slowArr) },
    fills: [{ plot1: 'plot0', plot2: 'plot1', colors: fillColors }],
    barColors,
  };
}

export const CDCActionZone = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
