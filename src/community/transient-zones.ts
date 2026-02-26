/**
 * Transient Zones v1.1
 *
 * Volatility-based zones using ATR. Upper = close + ATR, Lower = close - ATR.
 *
 * Reference: TradingView "Transient Zones v1.1" (community)
 */

import { ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

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

export function calculate(bars: Bar[], inputs: Partial<TransientZonesInputs> = {}): IndicatorResult {
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

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': upperPlot, 'plot1': lowerPlot },
    fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(41,98,255,0.08)' } }],
  };
}

export const TransientZones = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
