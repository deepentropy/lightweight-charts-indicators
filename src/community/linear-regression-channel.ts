/**
 * Linear Regression Channel
 *
 * Middle line is linear regression of source over length bars.
 * Upper/lower bands at +/- mult * stdev of residuals.
 *
 * Reference: TradingView "Linear Regression Channel"
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';

export interface LinearRegressionChannelInputs {
  length: number;
  src: SourceType;
  mult: number;
}

export const defaultInputs: LinearRegressionChannelInputs = {
  length: 100,
  src: 'close',
  mult: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 100, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'mult', type: 'float', title: 'Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Middle', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Upper', color: '#26A69A', lineWidth: 1 },
  { id: 'plot2', title: 'Lower', color: '#EF5350', lineWidth: 1 },
];

export const metadata = {
  title: 'Linear Regression Channel',
  shortTitle: 'LRC',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<LinearRegressionChannelInputs> = {}): IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[] } {
  const { length, src, mult } = { ...defaultInputs, ...inputs };

  const srcSeries = getSourceSeries(bars, src);
  const srcArr = srcSeries.toArray();

  const middleArr = ta.linreg(srcSeries, length).toArray();

  // Residuals: src - linreg
  const residArr: number[] = new Array(bars.length);
  for (let i = 0; i < bars.length; i++) {
    const m = middleArr[i];
    const s = srcArr[i];
    if (m == null || s == null || isNaN(m) || isNaN(s)) {
      residArr[i] = 0;
    } else {
      residArr[i] = s - m;
    }
  }

  const residSeries = new Series(bars, (_b, i) => residArr[i]);
  const devArr = ta.stdev(residSeries, length).toArray();

  const warmup = length;

  const plot0 = bars.map((b, i) => {
    const m = middleArr[i];
    if (i < warmup || m == null || isNaN(m)) return { time: b.time, value: NaN };
    return { time: b.time, value: m };
  });

  const plot1 = bars.map((b, i) => {
    const m = middleArr[i];
    const d = devArr[i];
    if (i < warmup || m == null || isNaN(m) || d == null || isNaN(d)) return { time: b.time, value: NaN };
    return { time: b.time, value: m + mult * d };
  });

  const plot2 = bars.map((b, i) => {
    const m = middleArr[i];
    const d = devArr[i];
    if (i < warmup || m == null || isNaN(m) || d == null || isNaN(d)) return { time: b.time, value: NaN };
    return { time: b.time, value: m - mult * d };
  });

  const fillColors = bars.map((_b, i) => (i < warmup ? 'transparent' : '#2962FF20'));

  // Markers: when price touches/crosses upper or lower channel bands
  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];

  for (let i = warmup; i < bars.length; i++) {
    const m = middleArr[i];
    const d = devArr[i];
    if (m == null || isNaN(m) || d == null || isNaN(d)) continue;
    const upper = m + mult * d;
    const lower = m - mult * d;
    const c = bars[i].close;

    // Marker when price touches upper band
    if (bars[i].high >= upper) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: '#EF5350', text: 'UB' });
    }
    // Marker when price touches lower band
    if (bars[i].low <= lower) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: '#26A69A', text: 'LB' });
    }

    // Bar color: green above middle, red below middle
    barColors.push({
      time: bars[i].time,
      color: c > m ? '#26A69A' : '#EF5350',
    });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2 },
    fills: [{ plot1: 'plot1', plot2: 'plot2', colors: fillColors }],
    markers,
    barColors,
  };
}

export const LinearRegressionChannel = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
