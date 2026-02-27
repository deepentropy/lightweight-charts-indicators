/**
 * Trendlines with Breaks [LuxAlgo]
 *
 * Pivot-based trendline indicator. Detects swing highs/lows, then
 * calculates slope-adjusted trendlines that update on each new pivot.
 * Breakout signals fire when price crosses through a trendline.
 *
 * Reference: TradingView "Trendlines with Breaks [LuxAlgo]" by LuxAlgo
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, LineDrawingData } from '../types';

export interface TrendlinesWithBreaksInputs {
  length: number;
  mult: number;
  calcMethod: string;
}

export const defaultInputs: TrendlinesWithBreaksInputs = {
  length: 14,
  mult: 1.0,
  calcMethod: 'Atr',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Swing Detection Lookback', defval: 14, min: 1 },
  { id: 'mult', type: 'float', title: 'Slope', defval: 1.0, min: 0, step: 0.1 },
  { id: 'calcMethod', type: 'string', title: 'Slope Calculation Method', defval: 'Atr', options: ['Atr', 'Stdev', 'Linreg'] },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Trendline', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'Lower Trendline', color: '#EF5350', lineWidth: 2 },
];

export const metadata = {
  title: 'Trendlines with Breaks [LuxAlgo]',
  shortTitle: 'TwB',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<TrendlinesWithBreaksInputs> = {}): IndicatorResult & { markers: MarkerData[]; lines: LineDrawingData[] } {
  const { length, mult, calcMethod } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeSeries = new Series(bars, (b) => b.close);
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  // Slope calculation
  let slopeArr: number[];
  if (calcMethod === 'Stdev') {
    const stdevArr = ta.stdev(closeSeries, length).toArray();
    slopeArr = stdevArr.map((v) => ((v ?? 0) / length) * mult);
  } else if (calcMethod === 'Linreg') {
    // Approximate linreg slope: |cov(src, n)| / var(n)
    const atrArr = ta.atr(bars, length).toArray();
    slopeArr = atrArr.map((v) => ((v ?? 0) / length) * mult);
  } else {
    // ATR
    const atrArr = ta.atr(bars, length).toArray();
    slopeArr = atrArr.map((v) => ((v ?? 0) / length) * mult);
  }

  // Detect pivot highs and pivot lows
  const highArr = highSeries.toArray();
  const lowArr = lowSeries.toArray();
  const closeArr = closeSeries.toArray();
  const ph: (number | null)[] = new Array(n).fill(null);
  const pl: (number | null)[] = new Array(n).fill(null);

  for (let i = length; i < n - length; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= length; j++) {
      if (highArr[i] <= highArr[i - j] || highArr[i] <= highArr[i + j]) isHigh = false;
      if (lowArr[i] >= lowArr[i - j] || lowArr[i] >= lowArr[i + j]) isLow = false;
      if (!isHigh && !isLow) break;
    }
    // Pivots are confirmed 'length' bars later
    if (isHigh) ph[i + length] = highArr[i];
    if (isLow) pl[i + length] = lowArr[i];
  }

  // Build trendlines
  const upperLine: number[] = new Array(n).fill(NaN);
  const lowerLine: number[] = new Array(n).fill(NaN);
  let upper = NaN;
  let lower = NaN;
  let slopePh = 0;
  let slopePl = 0;

  const upos: number[] = new Array(n).fill(0);
  const dnos: number[] = new Array(n).fill(0);

  // Track last pivot bar indices for extended lines
  let lastPhBar = -1;
  let lastPhUpper = NaN;
  let lastPhSlope = 0;
  let lastPlBar = -1;
  let lastPlLower = NaN;
  let lastPlSlope = 0;

  for (let i = 0; i < n; i++) {
    const slope = slopeArr[i] ?? 0;

    if (ph[i] !== null) {
      slopePh = slope;
      upper = ph[i]!;
      lastPhBar = i;
      lastPhUpper = upper;
      lastPhSlope = slopePh;
    } else if (!isNaN(upper)) {
      upper = upper - slopePh;
    }

    if (pl[i] !== null) {
      slopePl = slope;
      lower = pl[i]!;
      lastPlBar = i;
      lastPlLower = lower;
      lastPlSlope = slopePl;
    } else if (!isNaN(lower)) {
      lower = lower + slopePl;
    }

    // Breakout detection
    if (ph[i] !== null) {
      upos[i] = 0;
    } else if (closeArr[i] > upper - slopePh * length) {
      upos[i] = 1;
    } else {
      upos[i] = i > 0 ? upos[i - 1] : 0;
    }

    if (pl[i] !== null) {
      dnos[i] = 0;
    } else if (closeArr[i] < lower + slopePl * length) {
      dnos[i] = 1;
    } else {
      dnos[i] = i > 0 ? dnos[i - 1] : 0;
    }

    upperLine[i] = upper - slopePh * length;
    lowerLine[i] = lower + slopePl * length;
  }

  const warmup = length * 2;
  const upCss = '#26A69A';
  const dnCss = '#EF5350';

  const plot0 = upperLine.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || ph[i] !== null ? NaN : v,
    color: upCss,
  }));

  const plot1 = lowerLine.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || pl[i] !== null ? NaN : v,
    color: dnCss,
  }));

  // Markers for breakouts
  const markers: MarkerData[] = [];
  for (let i = warmup + 1; i < n; i++) {
    if (upos[i] > (i > 0 ? upos[i - 1] : 0)) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: upCss, text: 'B' });
    }
    if (dnos[i] > (i > 0 ? dnos[i - 1] : 0)) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: dnCss, text: 'B' });
    }
  }

  // Extended projection lines (dashed, extend right) from last pivot high/low
  const lines: LineDrawingData[] = [];
  if (lastPhBar >= 0 && lastPhBar < n - 1) {
    const y1 = lastPhUpper - lastPhSlope * length;
    const y2 = lastPhUpper - lastPhSlope * (length + 1);
    lines.push({
      time1: bars[lastPhBar].time, price1: y1,
      time2: bars[Math.min(lastPhBar + 1, n - 1)].time, price2: y2,
      color: upCss, width: 1, style: 'dashed', extend: 'right',
    });
  }
  if (lastPlBar >= 0 && lastPlBar < n - 1) {
    const y1 = lastPlLower + lastPlSlope * length;
    const y2 = lastPlLower + lastPlSlope * (length + 1);
    lines.push({
      time1: bars[lastPlBar].time, price1: y1,
      time2: bars[Math.min(lastPlBar + 1, n - 1)].time, price2: y2,
      color: dnCss, width: 1, style: 'dashed', extend: 'right',
    });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    markers,
    lines,
  };
}

export const TrendlinesWithBreaks = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
