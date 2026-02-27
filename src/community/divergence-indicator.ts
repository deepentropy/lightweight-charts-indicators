/**
 * Divergence Indicator (any oscillator)
 *
 * Detects regular and hidden divergences by comparing pivot highs/lows
 * in price vs RSI oscillator. Plots the RSI with divergence markers.
 *
 * Regular Bullish: price makes lower low, RSI makes higher low
 * Regular Bearish: price makes higher high, RSI makes lower high
 * Hidden Bullish: price makes higher low, RSI makes lower low
 * Hidden Bearish: price makes lower high, RSI makes higher high
 *
 * Reference: TradingView "Divergence Indicator (any oscillator)"
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface DivergenceIndicatorInputs {
  rsiLength: number;
  src: SourceType;
  pivotLookbackLeft: number;
  pivotLookbackRight: number;
  rangeUpper: number;
  rangeLower: number;
  plotBull: boolean;
  plotHiddenBull: boolean;
  plotBear: boolean;
  plotHiddenBear: boolean;
}

export const defaultInputs: DivergenceIndicatorInputs = {
  rsiLength: 14,
  src: 'close',
  pivotLookbackLeft: 5,
  pivotLookbackRight: 5,
  rangeUpper: 60,
  rangeLower: 5,
  plotBull: true,
  plotHiddenBull: false,
  plotBear: true,
  plotHiddenBear: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'pivotLookbackLeft', type: 'int', title: 'Pivot Lookback Left', defval: 5, min: 1 },
  { id: 'pivotLookbackRight', type: 'int', title: 'Pivot Lookback Right', defval: 5, min: 1 },
  { id: 'rangeUpper', type: 'int', title: 'Max Lookback Range', defval: 60, min: 1 },
  { id: 'rangeLower', type: 'int', title: 'Min Lookback Range', defval: 5, min: 1 },
  { id: 'plotBull', type: 'bool', title: 'Plot Bullish', defval: true },
  { id: 'plotHiddenBull', type: 'bool', title: 'Plot Hidden Bullish', defval: false },
  { id: 'plotBear', type: 'bool', title: 'Plot Bearish', defval: true },
  { id: 'plotHiddenBear', type: 'bool', title: 'Plot Hidden Bearish', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: '#7E57C2', lineWidth: 2 },
];

export const metadata = {
  title: 'Divergence Indicator',
  shortTitle: 'DivInd',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<DivergenceIndicatorInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const {
    rsiLength, src, pivotLookbackLeft, pivotLookbackRight,
    rangeUpper, rangeLower, plotBull, plotHiddenBull, plotBear, plotHiddenBear,
  } = { ...defaultInputs, ...inputs };

  const n = bars.length;
  const source = getSourceSeries(bars, src);
  const rsiSeries = ta.rsi(source, rsiLength);
  const rsiArr = rsiSeries.toArray();

  // Pivot detection on RSI
  const lbL = pivotLookbackLeft;
  const lbR = pivotLookbackRight;
  const plArr = ta.pivotlow(rsiSeries, lbL, lbR).toArray();
  const phArr = ta.pivothigh(rsiSeries, lbL, lbR).toArray();

  const markers: MarkerData[] = [];

  // Track previous pivot lows and highs for divergence comparison
  // We need to replicate PineScript's valuewhen + barssince + _inRange logic
  // Store pivot history: each entry is { barIndex, oscVal, priceVal }
  const pivotLows: { idx: number; oscVal: number; priceLow: number }[] = [];
  const pivotHighs: { idx: number; oscVal: number; priceHigh: number }[] = [];

  for (let i = 0; i < n; i++) {
    const plVal = plArr[i];
    const phVal = phArr[i];

    // Check for pivot low (RSI had a local minimum at bar i)
    if (plVal != null && !isNaN(plVal as number)) {
      const oscAtPivot = plVal as number;
      const priceAtPivot = bars[i].low;

      if (pivotLows.length > 0) {
        const prev = pivotLows[pivotLows.length - 1];
        const barsSincePrev = i - prev.idx;

        // _inRange check: rangeLower <= barsSince <= rangeUpper
        if (barsSincePrev >= rangeLower && barsSincePrev <= rangeUpper) {
          // Regular Bullish: price lower low, RSI higher low
          if (plotBull && priceAtPivot < prev.priceLow && oscAtPivot > prev.oscVal) {
            markers.push({
              time: bars[i].time as number,
              position: 'belowBar',
              shape: 'labelUp',
              color: '#26A69A',
              text: 'Bull',
            });
          }

          // Hidden Bullish: price higher low, RSI lower low
          if (plotHiddenBull && priceAtPivot > prev.priceLow && oscAtPivot < prev.oscVal) {
            markers.push({
              time: bars[i].time as number,
              position: 'belowBar',
              shape: 'labelUp',
              color: '#4CAF50',
              text: 'H Bull',
            });
          }
        }
      }

      pivotLows.push({ idx: i, oscVal: oscAtPivot, priceLow: priceAtPivot });
    }

    // Check for pivot high (RSI had a local maximum at bar i)
    if (phVal != null && !isNaN(phVal as number)) {
      const oscAtPivot = phVal as number;
      const priceAtPivot = bars[i].high;

      if (pivotHighs.length > 0) {
        const prev = pivotHighs[pivotHighs.length - 1];
        const barsSincePrev = i - prev.idx;

        if (barsSincePrev >= rangeLower && barsSincePrev <= rangeUpper) {
          // Regular Bearish: price higher high, RSI lower high
          if (plotBear && priceAtPivot > prev.priceHigh && oscAtPivot < prev.oscVal) {
            markers.push({
              time: bars[i].time as number,
              position: 'aboveBar',
              shape: 'labelDown',
              color: '#EF5350',
              text: 'Bear',
            });
          }

          // Hidden Bearish: price lower high, RSI higher high
          if (plotHiddenBear && priceAtPivot < prev.priceHigh && oscAtPivot > prev.oscVal) {
            markers.push({
              time: bars[i].time as number,
              position: 'aboveBar',
              shape: 'labelDown',
              color: '#FF5252',
              text: 'H Bear',
            });
          }
        }
      }

      pivotHighs.push({ idx: i, oscVal: oscAtPivot, priceHigh: priceAtPivot });
    }
  }

  const warmup = rsiLength;

  const plot0 = rsiArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null || isNaN(v as number)) ? NaN : v as number,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    hlines: [
      { value: 70, options: { color: '#787B86', linestyle: 'dashed', title: 'Overbought' } },
      { value: 30, options: { color: '#787B86', linestyle: 'dashed', title: 'Oversold' } },
    ],
    markers,
  };
}

export const DivergenceIndicator = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
