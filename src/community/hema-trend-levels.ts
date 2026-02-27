/**
 * HEMA Trend Levels [AlgoAlpha]
 *
 * Hull EMA (HEMA) trend indicator with crossover signals.
 * HEMA = EMA of (2*EMA(halfLen) - EMA(fullLen)), smoothed by EMA(sqrt(len)).
 * Two HEMA lines (fast/slow) with fill and bar coloring for trend direction.
 *
 * Reference: TradingView "HEMA Trend Levels [AlgoAlpha]" by AlgoAlpha
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';

export interface HemaTrendLevelsInputs {
  hemaLengthFast: number;
  hemaLengthSlow: number;
  bullColor: string;
  bearColor: string;
}

export const defaultInputs: HemaTrendLevelsInputs = {
  hemaLengthFast: 20,
  hemaLengthSlow: 40,
  bullColor: '#00ffbb',
  bearColor: '#ff1100',
};

export const inputConfig: InputConfig[] = [
  { id: 'hemaLengthFast', type: 'int', title: 'HEMA Length Fast', defval: 20, min: 1 },
  { id: 'hemaLengthSlow', type: 'int', title: 'HEMA Length Slow', defval: 40, min: 1 },
  { id: 'bullColor', type: 'string', title: 'Bullish Color', defval: '#00ffbb' },
  { id: 'bearColor', type: 'string', title: 'Bearish Color', defval: '#ff1100' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'HEMA Fast', color: '#00ffbb', lineWidth: 2 },
  { id: 'plot1', title: 'HEMA Slow', color: '#ff1100', lineWidth: 2 },
];

export const metadata = {
  title: 'HEMA Trend Levels',
  shortTitle: 'HEMA',
  overlay: true,
};

function computeHEMA(src: Series, length: number): Series {
  const halfLength = Math.max(1, Math.round(length / 2));
  const sqrtLength = Math.max(1, Math.round(Math.sqrt(length)));
  const emaHalf = ta.ema(src, halfLength);
  const emaFull = ta.ema(src, length);
  // diff = 2 * ema_half - ema_full
  const diff = emaHalf.mul(2).sub(emaFull);
  return ta.ema(diff, sqrtLength);
}

export function calculate(bars: Bar[], inputs: Partial<HemaTrendLevelsInputs> = {}): IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[] } {
  const { hemaLengthFast, hemaLengthSlow, bullColor, bearColor } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeSeries = new Series(bars, (b) => b.close);

  const hema1 = computeHEMA(closeSeries, hemaLengthFast);
  const hema2 = computeHEMA(closeSeries, hemaLengthSlow);

  const h1Arr = hema1.toArray();
  const h2Arr = hema2.toArray();

  const atrArr = ta.atr(bars, 14).toArray();

  const warmup = hemaLengthSlow;
  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];

  // Detect crossovers
  for (let i = warmup; i < n; i++) {
    const h1 = h1Arr[i] ?? NaN;
    const h2 = h2Arr[i] ?? NaN;
    const prevH1 = h1Arr[i - 1] ?? NaN;
    const prevH2 = h2Arr[i - 1] ?? NaN;
    const vola = (atrArr[i] ?? 0) / 2;

    // Crossover: hema1 crosses above hema2 (bullish)
    if (prevH1 <= prevH2 && h1 > h2) {
      markers.push({
        time: bars[i].time,
        position: 'belowBar',
        shape: 'triangleUp',
        color: bullColor,
        text: '',
      });
    }
    // Crossunder: hema1 crosses below hema2 (bearish)
    if (prevH1 >= prevH2 && h1 < h2) {
      markers.push({
        time: bars[i].time,
        position: 'aboveBar',
        shape: 'triangleDown',
        color: bearColor,
        text: '',
      });
    }

    // Bar colors
    const close = bars[i].close;
    const bullishCond = close > h1 && h1 > h2;
    const bearishCond = close < h1 && h1 < h2;
    const grayCond = (close < h1 && h1 > h2) || (close > h1 && h1 < h2);

    if (bullishCond) {
      barColors.push({ time: bars[i].time, color: bullColor + '80' });
    } else if (bearishCond) {
      barColors.push({ time: bars[i].time, color: bearColor + '80' });
    } else if (grayCond) {
      barColors.push({ time: bars[i].time, color: '#80808080' });
    }
  }

  // Plots with dynamic color based on trend
  const plot0 = h1Arr.map((v, i) => {
    if (i < warmup || v == null || isNaN(v)) return { time: bars[i].time, value: NaN };
    const h2v = h2Arr[i] ?? NaN;
    const color = v > h2v ? bullColor + 'B3' : bearColor + 'B3';
    return { time: bars[i].time, value: v, color };
  });

  const plot1 = h2Arr.map((v, i) => {
    if (i < warmup || v == null || isNaN(v)) return { time: bars[i].time, value: NaN };
    const h1v = h1Arr[i] ?? NaN;
    const color = h1v > v ? bullColor + 'B3' : bearColor + 'B3';
    return { time: bars[i].time, value: v, color };
  });

  // Fill colors: dynamic per bar (green when hema1 > hema2, red otherwise)
  const fillColors = h1Arr.map((h1v, i) => {
    if (i < warmup || h1v == null) return 'transparent';
    const h2v = h2Arr[i] ?? NaN;
    return h1v > h2v ? bullColor + '1A' : bearColor + '1A';
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: bullColor + '1A' }, colors: fillColors }],
    markers,
    barColors,
  };
}

export const HemaTrendLevels = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
