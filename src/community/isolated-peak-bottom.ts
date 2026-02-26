/**
 * Isolated Peak and Bottom
 *
 * Detects isolated peaks (high surrounded by lower highs) and bottoms
 * (low surrounded by higher lows) using pivot point detection.
 *
 * Reference: TradingView "Isolated Peak and Bottom" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface IsolatedPeakBottomInputs {
  leftBars: number;
  rightBars: number;
}

export const defaultInputs: IsolatedPeakBottomInputs = {
  leftBars: 3,
  rightBars: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'leftBars', type: 'int', title: 'Left Bars', defval: 3, min: 1 },
  { id: 'rightBars', type: 'int', title: 'Right Bars', defval: 3, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Close', color: 'transparent', lineWidth: 0, display: 'none' },
];

export const metadata = {
  title: 'Isolated Peak and Bottom',
  shortTitle: 'PeakBot',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<IsolatedPeakBottomInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { leftBars, rightBars } = { ...defaultInputs, ...inputs };

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const phArr = ta.pivothigh(highSeries, leftBars, rightBars).toArray();
  const plArr = ta.pivotlow(lowSeries, leftBars, rightBars).toArray();

  const markers: MarkerData[] = [];
  const plot0 = bars.map((b) => ({ time: b.time, value: NaN }));

  for (let i = 0; i < bars.length; i++) {
    if (!isNaN(phArr[i]) && phArr[i] !== 0) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: '#EF5350', text: 'Peak' });
    }
    if (!isNaN(plArr[i]) && plArr[i] !== 0) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: '#26A69A', text: 'Bottom' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    markers,
  };
}

export const IsolatedPeakBottom = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
