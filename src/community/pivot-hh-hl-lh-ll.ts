/**
 * Pivot Points HH/HL/LH/LL
 *
 * Detects pivot highs and lows, then classifies them as:
 * Higher High (HH), Higher Low (HL), Lower High (LH), Lower Low (LL).
 * Uses markers to annotate pivot points on the chart.
 *
 * Reference: TradingView "Pivot Points HH/HL/LH/LL" (TV#522)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface PivotHhHlLhLlInputs {
  leftBars: number;
  rightBars: number;
}

export const defaultInputs: PivotHhHlLhLlInputs = {
  leftBars: 5,
  rightBars: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'leftBars', type: 'int', title: 'Left Bars', defval: 5, min: 1 },
  { id: 'rightBars', type: 'int', title: 'Right Bars', defval: 5, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Pivot', color: 'transparent', lineWidth: 0 },
];

export const metadata = {
  title: 'Pivot Points HH/HL/LH/LL',
  shortTitle: 'PivotHHLL',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<PivotHhHlLhLlInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { leftBars, rightBars } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const phArr = ta.pivothigh(highSeries, leftBars, rightBars).toArray();
  const plArr = ta.pivotlow(lowSeries, leftBars, rightBars).toArray();

  let lastPivotHigh = NaN;
  let lastPivotLow = NaN;
  const markers: MarkerData[] = [];

  const plot0: { time: number; value: number }[] = [];

  for (let i = 0; i < n; i++) {
    const ph = phArr[i];
    const pl = plArr[i];

    if (ph != null && !isNaN(ph) && ph !== 0) {
      if (!isNaN(lastPivotHigh)) {
        if (ph > lastPivotHigh) {
          markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleUp', color: '#26A69A', text: 'HH' });
        } else {
          markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: '#EF5350', text: 'LH' });
        }
      }
      lastPivotHigh = ph;
    }

    if (pl != null && !isNaN(pl) && pl !== 0) {
      if (!isNaN(lastPivotLow)) {
        if (pl > lastPivotLow) {
          markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: '#26A69A', text: 'HL' });
        } else {
          markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleDown', color: '#EF5350', text: 'LL' });
        }
      }
      lastPivotLow = pl;
    }

    plot0.push({ time: bars[i].time, value: NaN });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    markers,
  };
}

export const PivotHhHlLhLl = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
