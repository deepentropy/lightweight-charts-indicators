/**
 * Auto Trend Detector
 *
 * Automatically draws the prevailing trendlines by connecting the two most
 * recent confirmed pivot highs (resistance) and the two most recent confirmed
 * pivot lows (support), extending both to the right. Pivot points are marked.
 *
 * Approximation of TradingView's built-in "Auto Trend Detector"
 * (STD;Auto_Trend_Detector).
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LineDrawingData, MarkerData } from '../types';

export interface AutoTrendDetectorInputs {
  /** Bars on each side required to confirm a pivot */
  pivotLength: number;
}

export const defaultInputs: AutoTrendDetectorInputs = {
  pivotLength: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'pivotLength', type: 'int', title: 'Pivot Length', defval: 10, min: 1 },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Auto Trend Detector',
  shortTitle: 'Auto Trend',
  overlay: true,
};

const RESISTANCE = '#F23645';
const SUPPORT = '#089981';

export function calculate(
  bars: Bar[],
  inputs: Partial<AutoTrendDetectorInputs> = {},
): IndicatorResult & { lines: LineDrawingData[]; markers: MarkerData[] } {
  const { pivotLength: p } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const highPivots: { barIndex: number; price: number }[] = [];
  const lowPivots: { barIndex: number; price: number }[] = [];
  const markers: MarkerData[] = [];

  for (let i = p; i < n - p; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= p; j++) {
      if (bars[i].high <= bars[i - j].high || bars[i].high <= bars[i + j].high) isHigh = false;
      if (bars[i].low >= bars[i - j].low || bars[i].low >= bars[i + j].low) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) {
      highPivots.push({ barIndex: i, price: bars[i].high });
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: RESISTANCE });
    }
    if (isLow) {
      lowPivots.push({ barIndex: i, price: bars[i].low });
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: SUPPORT });
    }
  }

  const lastTime = n > 0 ? bars[n - 1].time : 0;
  const lines: LineDrawingData[] = [];

  const connectLast = (pivots: { barIndex: number; price: number }[], color: string) => {
    if (pivots.length < 2) return;
    const a = pivots[pivots.length - 2];
    const b = pivots[pivots.length - 1];
    const t1 = bars[a.barIndex].time;
    const t2 = bars[b.barIndex].time;
    // Project the line to the right edge using its slope.
    const slope = t2 !== t1 ? (b.price - a.price) / (t2 - t1) : 0;
    const projected = b.price + slope * (lastTime - t2);
    lines.push({
      time1: t1,
      price1: a.price,
      time2: lastTime,
      price2: projected,
      color,
      width: 2,
      style: 'solid',
      extend: 'right',
    });
  };

  connectLast(highPivots, RESISTANCE);
  connectLast(lowPivots, SUPPORT);

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {},
    lines,
    markers,
  };
}

export const AutoTrendDetector = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
