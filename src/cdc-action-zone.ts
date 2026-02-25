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

export function calculate(bars: Bar[], inputs: Partial<CDCActionZoneInputs> = {}): IndicatorResult {
  const { source, shortPeriod, longPeriod } = { ...defaultInputs, ...inputs };

  const src = getSourceSeries(bars, source);
  const ap = ta.ema(src, 2);
  const fast = ta.ema(ap, shortPeriod);
  const slow = ta.ema(ap, longPeriod);

  const toPlot = (s: ReturnType<typeof ta.ema>) => {
    const arr = s.toArray();
    return arr.map((v, i) => ({ time: bars[i].time, value: i < longPeriod ? NaN : (v ?? NaN) }));
  };

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': toPlot(fast), 'plot1': toPlot(slow) },
    fills: [{ plot1: 'plot0', plot2: 'plot1' }],
  };
}

export const CDCActionZone = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
