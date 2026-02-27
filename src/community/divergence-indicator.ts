/**
 * Divergence Indicator (any oscillator)
 *
 * Overlay indicator that detects regular and hidden divergences by comparing
 * pivot highs/lows in price vs an oscillator source.
 * Since external indicator sourcing is not available, ohlc4 is used as the
 * default oscillator (matching the Pine default).
 *
 * Regular Bullish: price makes lower low, oscillator makes higher low
 * Regular Bearish: price makes higher high, oscillator makes lower high
 * Hidden Bullish: price makes higher low, oscillator makes lower low
 * Hidden Bearish: price makes lower high, oscillator makes higher high
 *
 * Pine plots 4 trendlines (connecting consecutive pivots where divergence found)
 * and 4 plotshape labels at divergence points. overlay=true.
 *
 * Reference: TradingView "Divergence Indicator (any oscillator)"
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, LineDrawingData } from '../types';

export interface DivergenceIndicatorInputs {
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
  src: 'ohlc4',
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
  { id: 'src', type: 'source', title: 'Indicator', defval: 'ohlc4' },
  { id: 'pivotLookbackLeft', type: 'int', title: 'Pivot Lookback Left', defval: 5, min: 1 },
  { id: 'pivotLookbackRight', type: 'int', title: 'Pivot Lookback Right', defval: 5, min: 1 },
  { id: 'rangeUpper', type: 'int', title: 'Max Lookback Range', defval: 60, min: 1 },
  { id: 'rangeLower', type: 'int', title: 'Min Lookback Range', defval: 5, min: 1 },
  { id: 'plotBull', type: 'bool', title: 'Plot Bullish', defval: true },
  { id: 'plotHiddenBull', type: 'bool', title: 'Plot Hidden Bullish', defval: false },
  { id: 'plotBear', type: 'bool', title: 'Plot Bearish', defval: true },
  { id: 'plotHiddenBear', type: 'bool', title: 'Plot Hidden Bearish', defval: false },
];

// Overlay on price - divergence shown via markers and lines
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Divergence Indicator',
  shortTitle: 'DivInd',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<DivergenceIndicatorInputs> = {}): IndicatorResult & { markers: MarkerData[]; lines: LineDrawingData[] } {
  const {
    src, pivotLookbackLeft, pivotLookbackRight,
    rangeUpper, rangeLower, plotBull, plotHiddenBull, plotBear, plotHiddenBear,
  } = { ...defaultInputs, ...inputs };

  const n = bars.length;
  const osc = getSourceSeries(bars, src);
  const oscArr = osc.toArray();

  const lbL = pivotLookbackLeft;
  const lbR = pivotLookbackRight;

  // Pivot detection on the oscillator
  // Library pivotlow/pivothigh place values at the actual pivot bar (center),
  // unlike Pine which places at the confirmation bar (center + rightbars).
  const plArr = ta.pivotlow(osc, lbL, lbR).toArray();
  const phArr = ta.pivothigh(osc, lbL, lbR).toArray();

  const markers: MarkerData[] = [];
  const lines: LineDrawingData[] = [];

  // Track previous pivot lows for bullish divergence checks
  // Pine uses valuewhen(plFound, osc[lbR], 1) and barssince to find previous pivot
  // and check if it's within range. We track pivot history manually.
  const pivotLows: { idx: number; oscVal: number; priceLow: number }[] = [];
  const pivotHighs: { idx: number; oscVal: number; priceHigh: number }[] = [];

  for (let i = 0; i < n; i++) {
    const plVal = plArr[i];
    const phVal = phArr[i];

    // Pivot low found on oscillator at bar i
    if (plVal != null && !isNaN(plVal as number)) {
      const oscAtPivot = oscArr[i];
      const priceAtPivot = bars[i].low;

      if (pivotLows.length > 0) {
        const prev = pivotLows[pivotLows.length - 1];
        const barsBetween = i - prev.idx;

        // Pine: _inRange checks rangeLower <= barssince(plFound[1]) <= rangeUpper
        if (barsBetween >= rangeLower && barsBetween <= rangeUpper) {
          // Regular Bullish: price lower low, osc higher low
          if (plotBull && priceAtPivot < prev.priceLow && oscAtPivot > prev.oscVal) {
            markers.push({
              time: bars[i].time as number,
              position: 'belowBar',
              shape: 'labelUp',
              color: '#4CAF50',
              text: 'Bull',
            });
            lines.push({
              time1: bars[prev.idx].time as number,
              price1: prev.priceLow,
              time2: bars[i].time as number,
              price2: priceAtPivot,
              color: '#4CAF50',
              width: 2,
              style: 'solid',
            });
          }

          // Hidden Bullish: price higher low, osc lower low
          if (plotHiddenBull && priceAtPivot > prev.priceLow && oscAtPivot < prev.oscVal) {
            markers.push({
              time: bars[i].time as number,
              position: 'belowBar',
              shape: 'labelUp',
              color: 'rgba(76, 175, 80, 0.20)',
              text: 'H Bull',
            });
            lines.push({
              time1: bars[prev.idx].time as number,
              price1: prev.priceLow,
              time2: bars[i].time as number,
              price2: priceAtPivot,
              color: 'rgba(76, 175, 80, 0.20)',
              width: 2,
              style: 'solid',
            });
          }
        }
      }

      pivotLows.push({ idx: i, oscVal: oscAtPivot, priceLow: priceAtPivot });
    }

    // Pivot high found on oscillator at bar i
    if (phVal != null && !isNaN(phVal as number)) {
      const oscAtPivot = oscArr[i];
      const priceAtPivot = bars[i].high;

      if (pivotHighs.length > 0) {
        const prev = pivotHighs[pivotHighs.length - 1];
        const barsBetween = i - prev.idx;

        if (barsBetween >= rangeLower && barsBetween <= rangeUpper) {
          // Regular Bearish: price higher high, osc lower high
          if (plotBear && priceAtPivot > prev.priceHigh && oscAtPivot < prev.oscVal) {
            markers.push({
              time: bars[i].time as number,
              position: 'aboveBar',
              shape: 'labelDown',
              color: '#EF5350',
              text: 'Bear',
            });
            lines.push({
              time1: bars[prev.idx].time as number,
              price1: prev.priceHigh,
              time2: bars[i].time as number,
              price2: priceAtPivot,
              color: '#EF5350',
              width: 2,
              style: 'solid',
            });
          }

          // Hidden Bearish: price lower high, osc higher high
          if (plotHiddenBear && priceAtPivot < prev.priceHigh && oscAtPivot > prev.oscVal) {
            markers.push({
              time: bars[i].time as number,
              position: 'aboveBar',
              shape: 'labelDown',
              color: 'rgba(239, 83, 80, 0.20)',
              text: 'H Bear',
            });
            lines.push({
              time1: bars[prev.idx].time as number,
              price1: prev.priceHigh,
              time2: bars[i].time as number,
              price2: priceAtPivot,
              color: 'rgba(239, 83, 80, 0.20)',
              width: 2,
              style: 'solid',
            });
          }
        }
      }

      pivotHighs.push({ idx: i, oscVal: oscAtPivot, priceHigh: priceAtPivot });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    lines,
  };
}

export const DivergenceIndicator = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
