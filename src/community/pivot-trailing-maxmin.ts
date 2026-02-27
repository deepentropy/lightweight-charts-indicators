/**
 * Pivot Based Trailing Maxima & Minima [LuxAlgo]
 *
 * Tracks trailing maximum and minimum levels using pivot detection.
 * When a pivot high or low is detected, max/min reset to the bar's
 * high/low at the pivot offset. Between pivots, max ratchets up and
 * min ratchets down. An average line is plotted between the two.
 *
 * Note: Backpainting is disabled (offset = 0) for real-time accuracy.
 *
 * Reference: TradingView "Pivot Based Trailing Maxima & Minima [LuxAlgo]" by LuxAlgo
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface PivotTrailingMaxMinInputs {
  length: number;
}

export const defaultInputs: PivotTrailingMaxMinInputs = {
  length: 24,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 24, min: 2, max: 500 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trailing Maximum', color: '#26A69A', lineWidth: 1 },
  { id: 'plot1', title: 'Trailing Minimum', color: '#EF5350', lineWidth: 1 },
  { id: 'plot2', title: 'Average', color: '#ff5d00', lineWidth: 1 },
];

export const metadata = {
  title: 'Pivot Based Trailing Maxima & Minima',
  shortTitle: 'Pivot Trail MaxMin',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<PivotTrailingMaxMinInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { length } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const phArr = ta.pivothigh(highSeries, length, length).toArray();
  const plArr = ta.pivotlow(lowSeries, length, length).toArray();

  const maxArr: number[] = new Array(n);
  const minArr: number[] = new Array(n);
  const avgArr: number[] = new Array(n);

  // No backpainting: offset = 0, so we use current bar's high/low for ratcheting
  let trailMax = NaN;
  let trailMin = NaN;

  for (let i = 0; i < n; i++) {
    const ph = phArr[i];
    const pl = plArr[i];
    const phValid = ph != null && !isNaN(ph) && ph !== 0;
    const plValid = pl != null && !isNaN(pl) && pl !== 0;

    // When a pivot is detected, reset max/min to the bar at the pivot offset (length bars back)
    if (phValid || plValid) {
      const pivotIdx = i - length;
      if (pivotIdx >= 0) {
        trailMax = bars[pivotIdx].high;
        trailMin = bars[pivotIdx].low;
      }
    }

    // Ratchet: max goes up, min goes down (using current bar since no backpaint)
    if (!isNaN(trailMax)) {
      trailMax = Math.max(bars[i].high, trailMax);
    }
    if (!isNaN(trailMin)) {
      trailMin = Math.min(bars[i].low, trailMin);
    }

    maxArr[i] = trailMax;
    minArr[i] = trailMin;
    avgArr[i] = (trailMax + trailMin) / 2;
  }

  // Warmup: need at least 2*length bars for first pivot detection
  const warmup = length * 2;

  // Markers: pivot low -> labelUp (bullish), pivot high -> labelDown (bearish)
  const markers: MarkerData[] = [];
  for (let i = warmup; i < n; i++) {
    const ph = phArr[i];
    const pl = plArr[i];
    const phValid = ph != null && !isNaN(ph) && ph !== 0;
    const plValid = pl != null && !isNaN(pl) && pl !== 0;
    if (plValid) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#26A69A', text: '\u25B2' });
    }
    if (phValid) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: '\u25BC' });
    }
  }

  // Fill between trailing max and trailing min, colored by last pivot type
  const fillColors: string[] = [];
  let lastPivotBullish = true;
  for (let i = 0; i < n; i++) {
    const ph = phArr[i];
    const pl = plArr[i];
    const phValid = ph != null && !isNaN(ph) && ph !== 0;
    const plValid = pl != null && !isNaN(pl) && pl !== 0;
    if (phValid) lastPivotBullish = false;
    if (plValid) lastPivotBullish = true;

    if (i < warmup || isNaN(maxArr[i]) || isNaN(minArr[i])) {
      fillColors.push('rgba(0,0,0,0)');
    } else {
      fillColors.push(lastPivotBullish ? 'rgba(38,166,154,0.2)' : 'rgba(239,83,80,0.2)');
    }
  }

  const plot0 = maxArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || isNaN(v)) ? NaN : v,
  }));

  const plot1 = minArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || isNaN(v)) ? NaN : v,
  }));

  const plot2 = avgArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || isNaN(v)) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2 },
    fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(38,166,154,0.2)' }, colors: fillColors }],
    markers,
  };
}

export const PivotTrailingMaxMin = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
