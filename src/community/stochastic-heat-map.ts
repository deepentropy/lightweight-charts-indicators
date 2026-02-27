/**
 * Stochastic Heat Map
 *
 * Computes stochastic oscillator at multiple periods (1*incr through 28*incr),
 * smooths each, then averages all into fast/slow signal lines.
 * Heat map coloring based on average stochastic value.
 *
 * Reference: TradingView "Stochastic Heat Map" by Violent
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface StochasticHeatMapInputs {
  maType: string;
  increment: number;
  smooth: number;
  smoothSlow: number;
  plotNumber: number;
  paintBars: boolean;
}

export const defaultInputs: StochasticHeatMapInputs = {
  maType: 'EMA',
  increment: 10,
  smooth: 2,
  smoothSlow: 21,
  plotNumber: 28,
  paintBars: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'EMA', options: ['EMA', 'SMA', 'WMA'] },
  { id: 'increment', type: 'int', title: 'Increment', defval: 10, min: 1 },
  { id: 'smooth', type: 'int', title: 'Smooth', defval: 2, min: 1 },
  { id: 'smoothSlow', type: 'int', title: 'Slow Smooth', defval: 21, min: 1 },
  { id: 'plotNumber', type: 'int', title: 'Plot Number', defval: 28, min: 1, max: 28 },
  { id: 'paintBars', type: 'bool', title: 'Paint Bars', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'fast', title: 'Fast', color: '#FFFFFF', lineWidth: 1 },
  { id: 'slow', title: 'Slow', color: '#FF9800', lineWidth: 1 },
  { id: 'avg', title: 'Avg Stochastic', color: '#2196F3', lineWidth: 2, style: 'histogram' },
];

export const metadata = {
  title: 'Stochastic Heat Map',
  shortTitle: 'SHM',
  overlay: false,
};

/** Get heat map color for a stochastic value (0-100). Theme 3: red->orange->yellow->green gradient. */
function heatColor(v: number): string {
  if (v >= 90) return '#cf0000';
  if (v >= 80) return '#f25811';
  if (v >= 70) return '#f29811';
  if (v >= 60) return '#eef211';
  if (v >= 50) return '#3af211';
  if (v >= 40) return '#11e7f2';
  if (v >= 30) return '#0093c9';
  if (v >= 20) return '#1176f2';
  if (v >= 10) return '#0f44f5';
  return '#02269e';
}

/** Smooth an array using the selected MA type. */
function smoothArray(bars: Bar[], arr: number[], length: number, maType: string): number[] {
  const series = new Series(bars, (_b, i) => arr[i]);
  let result: (number | undefined)[];
  switch (maType) {
    case 'SMA':
      result = ta.sma(series, length).toArray();
      break;
    case 'WMA':
      result = ta.wma(series, length).toArray();
      break;
    case 'EMA':
    default:
      result = ta.ema(series, length).toArray();
      break;
  }
  return result.map(v => v ?? NaN);
}

export function calculate(bars: Bar[], inputs: Partial<StochasticHeatMapInputs> = {}): IndicatorResult & { barColors: BarColorData[] } {
  const { maType, increment, smooth, smoothSlow, plotNumber, paintBars } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const numLines = Math.min(plotNumber, 28);

  const closeSeries = new Series(bars, (b) => b.close);
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  // Compute stochastic at each period and smooth it
  const stochLines: number[][] = [];
  for (let line = 1; line <= numLines; line++) {
    const period = line * increment;
    const rawK = ta.stoch(closeSeries, highSeries, lowSeries, period).toArray().map(v => v ?? NaN);

    // Smooth with MA
    const smoothed = smoothArray(bars, rawK, smooth, maType);
    stochLines.push(smoothed);
  }

  // Compute average stochastic across all lines per bar
  const avgStoch: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let count = 0;
    for (let line = 0; line < numLines; line++) {
      const v = stochLines[line][i];
      if (!isNaN(v)) {
        sum += v;
        count++;
      }
    }
    avgStoch[i] = count > 0 ? sum / count : NaN;
  }

  // Fast = (avgStoch / 100) * plotNumber
  const fastArr: number[] = avgStoch.map(v => isNaN(v) ? NaN : (v / 100) * numLines);

  // Slow = MA(fast, smoothSlow)
  const slowArr = smoothArray(bars, fastArr, smoothSlow, maType);

  const warmup = numLines * increment;

  // Fast plot
  const fastPlot = fastArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || isNaN(v) ? NaN : v,
  }));

  // Slow plot
  const slowPlot = slowArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || isNaN(v) ? NaN : v,
  }));

  // Average stochastic histogram colored by heat map
  const avgPlot = avgStoch.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || isNaN(v) ? NaN : v,
    color: isNaN(v) ? '#787B86' : heatColor(v),
  }));

  // Bar colors when paintBars enabled
  const barColors: BarColorData[] = [];
  if (paintBars) {
    for (let i = warmup; i < n; i++) {
      const v = avgStoch[i];
      if (!isNaN(v)) {
        barColors.push({ time: bars[i].time as number, color: heatColor(v) });
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { fast: fastPlot, slow: slowPlot, avg: avgPlot },
    hlines: [
      { value: 50, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Mid' } },
    ],
    barColors,
  };
}

export const StochasticHeatMap = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
