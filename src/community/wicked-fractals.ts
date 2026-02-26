/**
 * WICK.ED Fractals
 *
 * Fractal detection based on wicks (high/low).
 * Fractal up = high is highest among leftBars left and rightBars right.
 * Fractal down = low is lowest among leftBars left and rightBars right.
 *
 * Reference: TradingView "WICK.ED Fractals" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface WickedFractalsInputs {
  leftBars: number;
  rightBars: number;
}

export const defaultInputs: WickedFractalsInputs = {
  leftBars: 2,
  rightBars: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'leftBars', type: 'int', title: 'Left Bars', defval: 2, min: 1 },
  { id: 'rightBars', type: 'int', title: 'Right Bars', defval: 2, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Close', color: 'transparent', lineWidth: 0, display: 'none' },
];

export const metadata = {
  title: 'WICK.ED Fractals',
  shortTitle: 'WFrac',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<WickedFractalsInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { leftBars, rightBars } = { ...defaultInputs, ...inputs };

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const pivotHighs = ta.pivothigh(highSeries, leftBars, rightBars);
  const pivotLows = ta.pivotlow(lowSeries, leftBars, rightBars);

  const phArr = pivotHighs.toArray();
  const plArr = pivotLows.toArray();

  const markers: MarkerData[] = [];
  const plot0 = bars.map((b) => ({ time: b.time, value: NaN }));

  for (let i = 0; i < bars.length; i++) {
    if (phArr[i] != null && !isNaN(phArr[i]!)) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: '#EF5350', text: 'F' });
    }
    if (plArr[i] != null && !isNaN(plArr[i]!)) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: '#26A69A', text: 'F' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    markers,
  };
}

export const WickedFractals = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
