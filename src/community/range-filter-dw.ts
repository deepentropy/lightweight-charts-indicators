/**
 * Range Filter [DW]
 *
 * Smoothed range filter that tracks price movement.
 * smoothRange = EMA(|close - close[1]|, period) * mult
 * Filter moves up when close > filter + smoothRange, down vice versa.
 * Upper and lower bands derived from filter +/- smoothRange.
 *
 * Reference: TradingView "Range Filter [DW]" (TV#567)
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface RangeFilterDWInputs {
  period: number;
  mult: number;
  src: SourceType;
}

export const defaultInputs: RangeFilterDWInputs = {
  period: 50,
  mult: 3.0,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'period', type: 'int', title: 'Period', defval: 50, min: 1 },
  { id: 'mult', type: 'float', title: 'Multiplier', defval: 3.0, min: 0.1, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Filter', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Upper Band', color: '#26A69A', lineWidth: 1 },
  { id: 'plot2', title: 'Lower Band', color: '#EF5350', lineWidth: 1 },
];

export const metadata = {
  title: 'Range Filter [DW]',
  shortTitle: 'RngFilt',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<RangeFilterDWInputs> = {}): IndicatorResult {
  const { period, mult, src } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const srcSeries = getSourceSeries(bars, src);
  const srcArr = srcSeries.toArray();

  // Calculate bar-to-bar absolute range
  const absRange: number[] = new Array(n);
  absRange[0] = 0;
  for (let i = 1; i < n; i++) {
    absRange[i] = Math.abs((srcArr[i] ?? 0) - (srcArr[i - 1] ?? 0));
  }

  // Smooth range using EMA
  const rangeSeries = Series.fromArray(bars, absRange);
  const smoothRangeArr = ta.ema(rangeSeries, period).toArray();

  // Apply multiplier (default to 0 during EMA warmup to avoid NaN propagation)
  const smrng: number[] = smoothRangeArr.map((v) => (v != null && !isNaN(v) ? v : 0) * mult);

  // Range filter calculation
  const filter: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const s = srcArr[i] ?? 0;
    const sr = smrng[i];

    if (i === 0) {
      filter[i] = s;
      continue;
    }

    const prevFilter = filter[i - 1];

    if (s > prevFilter) {
      // Price above filter: filter moves up, ratchets
      filter[i] = Math.max(prevFilter, s - sr);
    } else if (s < prevFilter) {
      // Price below filter: filter moves down, ratchets
      filter[i] = Math.min(prevFilter, s + sr);
    } else {
      filter[i] = prevFilter;
    }
  }

  const warmup = period;

  const plot0 = filter.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const upward = i > 0 && filter[i] > filter[i - 1];
    const downward = i > 0 && filter[i] < filter[i - 1];
    const color = upward ? '#26A69A' : downward ? '#EF5350' : '#787B86';
    return { time: bars[i].time, value: v, color };
  });

  const plot1 = filter.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v + smrng[i],
  }));

  const plot2 = filter.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v - smrng[i],
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2 },
  };
}

export const RangeFilterDW = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
