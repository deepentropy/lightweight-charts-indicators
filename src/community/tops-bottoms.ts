/**
 * Tops/Bottoms
 *
 * Swing high/low detection using pivot points.
 * Plots horizontal lines at last detected top and bottom levels.
 *
 * Reference: TradingView "Tops/Bottoms" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface TopsBottomsInputs {
  length: number;
}

export const defaultInputs: TopsBottomsInputs = {
  length: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 5, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Top Level', color: '#EF5350', lineWidth: 2, style: 'linebr' },
  { id: 'plot1', title: 'Bottom Level', color: '#26A69A', lineWidth: 2, style: 'linebr' },
];

export const metadata = {
  title: 'Tops/Bottoms',
  shortTitle: 'TB',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<TopsBottomsInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { length } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const pivotHighs = ta.pivothigh(highSeries, length, length);
  const pivotLows = ta.pivotlow(lowSeries, length, length);

  const phArr = pivotHighs.toArray();
  const plArr = pivotLows.toArray();

  let lastTop = NaN;
  let lastBottom = NaN;
  const markers: MarkerData[] = [];

  const topData: { time: number; value: number }[] = [];
  const bottomData: { time: number; value: number }[] = [];

  for (let i = 0; i < n; i++) {
    if (phArr[i] != null && !isNaN(phArr[i]!)) {
      lastTop = phArr[i]!;
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: '#EF5350', text: 'Top' });
    }
    if (plArr[i] != null && !isNaN(plArr[i]!)) {
      lastBottom = plArr[i]!;
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: '#26A69A', text: 'Bot' });
    }
    topData.push({ time: bars[i].time, value: lastTop });
    bottomData.push({ time: bars[i].time, value: lastBottom });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': topData, 'plot1': bottomData },
    markers,
  };
}

export const TopsBottoms = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
