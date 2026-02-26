/**
 * UCS Top & Bottom Candle
 *
 * Detects swing tops and bottoms using pivot high/low detection.
 * Marks pivot highs with down arrows and pivot lows with up arrows.
 *
 * Reference: TradingView "UCS_Top & Bottom Candle" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface TopBottomCandleInputs {
  leftBars: number;
  rightBars: number;
}

export const defaultInputs: TopBottomCandleInputs = {
  leftBars: 5,
  rightBars: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'leftBars', type: 'int', title: 'Left Bars', defval: 5, min: 1 },
  { id: 'rightBars', type: 'int', title: 'Right Bars', defval: 5, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Close', color: 'transparent', lineWidth: 0, display: 'none' },
];

export const metadata = {
  title: 'Top & Bottom Candle',
  shortTitle: 'TopBot',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<TopBottomCandleInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { leftBars, rightBars } = { ...defaultInputs, ...inputs };

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const phArr = ta.pivothigh(highSeries, leftBars, rightBars).toArray();
  const plArr = ta.pivotlow(lowSeries, leftBars, rightBars).toArray();

  const markers: MarkerData[] = [];
  const closePlot = bars.map((b) => ({ time: b.time, value: NaN }));

  for (let i = 0; i < bars.length; i++) {
    if (phArr[i] != null && !isNaN(phArr[i]!)) {
      markers.push({
        time: bars[i].time as number,
        position: 'aboveBar',
        shape: 'arrowDown',
        color: '#EF5350',
        text: 'Top',
      });
    }

    if (plArr[i] != null && !isNaN(plArr[i]!)) {
      markers.push({
        time: bars[i].time as number,
        position: 'belowBar',
        shape: 'arrowUp',
        color: '#26A69A',
        text: 'Bot',
      });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': closePlot },
    markers,
  };
}

export const TopBottomCandle = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
