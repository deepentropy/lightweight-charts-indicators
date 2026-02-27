/**
 * Triangular Momentum Oscillator
 *
 * Triangular-weighted momentum. Momentum = close - close[length].
 * Smoothed with triangular moving average: SMA(SMA(momentum, len), len).
 *
 * Reference: TradingView "Triangular Momentum Oscillator" (community)
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface TriangularMomentumOscInputs {
  length: number;
  src: SourceType;
}

export const defaultInputs: TriangularMomentumOscInputs = {
  length: 14,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 2 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'TMO', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Triangular Momentum Oscillator',
  shortTitle: 'TMO',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<TriangularMomentumOscInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { length, src } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const source = getSourceSeries(bars, src);
  const srcArr = source.toArray();

  // Momentum = source - source[length]
  const momArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if (i < length || srcArr[i] == null || srcArr[i - length] == null) {
      momArr[i] = NaN;
    } else {
      momArr[i] = srcArr[i]! - srcArr[i - length]!;
    }
  }

  // Triangular smoothing: SMA(SMA(mom, halfLen1), halfLen2)
  const halfLen1 = Math.ceil(length / 2);
  const halfLen2 = Math.floor(length / 2) + 1;

  const momSeries = new Series(bars, (_b, i) => momArr[i]);
  const sma1 = ta.sma(momSeries, halfLen1);
  const tmo = ta.sma(sma1, halfLen2);
  const tmoArr = tmo.toArray();

  const warmup = length + halfLen1 + halfLen2;

  const plot0 = tmoArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v,
  }));

  // Markers: divergence signals
  // phosc = osc peaks (change goes + to -), plosc = osc troughs (change goes - to +)
  const markers: MarkerData[] = [];

  // Track last two peaks and troughs for divergence
  let prevPeakOsc = NaN, prevPeakHigh = NaN;
  let prevTroughOsc = NaN, prevTroughLow = NaN;

  for (let i = warmup + 2; i < n; i++) {
    const osc = tmoArr[i];
    const oscPrev = tmoArr[i - 1];
    const oscPrev2 = tmoArr[i - 2];
    if (osc == null || oscPrev == null || oscPrev2 == null) continue;

    const chg = osc - oscPrev;
    const prevChg = oscPrev - oscPrev2;

    // Peak: change crosses from positive to negative (crossunder(change(osc), 0))
    if (prevChg > 0 && chg <= 0 && osc > 0) {
      const highVal = bars[i - 1].high;
      // Bearish divergence: osc peak lower but price peak higher
      if (!isNaN(prevPeakOsc) && oscPrev < prevPeakOsc && highVal > prevPeakHigh) {
        markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'Sell' });
      }
      prevPeakOsc = oscPrev;
      prevPeakHigh = highVal;
    }

    // Trough: change crosses from negative to positive (crossover(change(osc), 0))
    if (prevChg < 0 && chg >= 0 && osc < 0) {
      const lowVal = bars[i - 1].low;
      // Bullish divergence: osc trough higher but price trough lower
      if (!isNaN(prevTroughOsc) && oscPrev > prevTroughOsc && lowVal < prevTroughLow) {
        markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#26A69A', text: 'Buy' });
      }
      prevTroughOsc = oscPrev;
      prevTroughLow = lowVal;
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'solid' as const, title: 'Zero' } },
    ],
    markers,
  };
}

export const TriangularMomentumOsc = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
