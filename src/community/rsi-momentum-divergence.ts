/**
 * RSI Momentum Divergence Zones [ChartPrime]
 *
 * RSI computed on momentum (close change over 10 bars) with divergence
 * detection via pivot analysis. Bullish divergence: price lower low + RSI
 * higher low. Bearish: price higher high + RSI lower high.
 *
 * Reference: TradingView "RSI Momentum Divergence Zones [ChartPrime]" by ChartPrime
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface RsiMomentumDivergenceInputs {
  rsiLength: number;
  enableDivCheck: boolean;
  divLookbackL: number;
  divLookbackR: number;
  minBarsInRange: number;
  maxBarsInRange: number;
}

export const defaultInputs: RsiMomentumDivergenceInputs = {
  rsiLength: 14,
  enableDivCheck: true,
  divLookbackL: 5,
  divLookbackR: 5,
  minBarsInRange: 5,
  maxBarsInRange: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'enableDivCheck', type: 'bool', title: 'Enable Divergence Detection', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: '#ae4ce6', lineWidth: 2 },
  { id: 'plot1', title: '50 Level', color: '#808080', lineWidth: 1 },
];

export const metadata = {
  title: 'RSI Momentum Divergence',
  shortTitle: 'RSIM Div',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<RsiMomentumDivergenceInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { rsiLength, enableDivCheck, divLookbackL, divLookbackR, minBarsInRange, maxBarsInRange } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const bearColor = '#ae4ce6';
  const bullColor = '#33c570';

  // RSI source = momentum(close, 10)
  const momArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    momArr[i] = i >= 10 ? bars[i].close - bars[i - 10].close : 0;
  }
  const momSeries = Series.fromArray(bars, momArr);
  const rsiArr = ta.rsi(momSeries, rsiLength).toArray();

  // Pivot detection for divergence
  // pivothigh/pivotlow on rsiVal with lookback L and R
  const rsiSeries = Series.fromArray(bars, rsiArr.map((v) => v ?? NaN));
  const pivotHighArr = ta.pivothigh(rsiSeries, divLookbackL, divLookbackR).toArray();
  const pivotLowArr = ta.pivotlow(rsiSeries, divLookbackL, divLookbackR).toArray();

  const warmup = 10 + rsiLength;

  // Track barssince for pivots and valuewhen
  const markers: MarkerData[] = [];

  if (enableDivCheck) {
    // Store pivot history for valuewhen lookback
    let lastPLRsiRight = NaN;
    let lastPLPriceLow = NaN;
    let lastPLBar = -999;

    let lastPHRsiRight = NaN;
    let lastPHPriceHigh = NaN;
    let lastPHBar = -999;

    for (let i = 0; i < n; i++) {
      const rsiRight = rsiArr[i - divLookbackR] ?? NaN;

      // Check for pivot low (bullish divergence)
      const foundPL = pivotLowArr[i] != null && !isNaN(pivotLowArr[i]!);
      if (foundPL) {
        const barsSincePrevPL = i - lastPLBar;
        const inRange = barsSincePrevPL >= minBarsInRange && barsSincePrevPL <= maxBarsInRange;

        // Bullish: price LL, RSI HL
        if (inRange && !isNaN(lastPLRsiRight) && !isNaN(rsiRight)) {
          const rsiHL = rsiRight > lastPLRsiRight;
          const priceLL = bars[i - divLookbackR]?.low < lastPLPriceLow;
          if (rsiHL && priceLL && i >= warmup) {
            markers.push({
              time: bars[i - divLookbackR]?.time ?? bars[i].time,
              position: 'belowBar',
              shape: 'labelUp',
              color: bullColor,
              text: 'Bull',
            });
          }
        }

        lastPLRsiRight = rsiRight;
        lastPLPriceLow = bars[i - divLookbackR]?.low ?? NaN;
        lastPLBar = i;
      }

      // Check for pivot high (bearish divergence)
      const foundPH = pivotHighArr[i] != null && !isNaN(pivotHighArr[i]!);
      if (foundPH) {
        const barsSincePrevPH = i - lastPHBar;
        const inRange = barsSincePrevPH >= minBarsInRange && barsSincePrevPH <= maxBarsInRange;

        // Bearish: price HH, RSI LH
        if (inRange && !isNaN(lastPHRsiRight) && !isNaN(rsiRight)) {
          const rsiLH = rsiRight < lastPHRsiRight;
          const priceHH = bars[i - divLookbackR]?.high > lastPHPriceHigh;
          if (rsiLH && priceHH && i >= warmup) {
            markers.push({
              time: bars[i - divLookbackR]?.time ?? bars[i].time,
              position: 'aboveBar',
              shape: 'labelDown',
              color: bearColor,
              text: 'Bear',
            });
          }
        }

        lastPHRsiRight = rsiRight;
        lastPHPriceHigh = bars[i - divLookbackR]?.high ?? NaN;
        lastPHBar = i;
      }
    }
  }

  // RSI plot with gradient color (30-70 range maps from bullColor to bearColor)
  const plot0 = rsiArr.map((v, i) => {
    if (i < warmup || v == null || isNaN(v)) return { time: bars[i].time, value: NaN };
    // Gradient: below 30 = bullColor, above 70 = bearColor, linear between
    const t = Math.max(0, Math.min(1, (v - 30) / 40));
    // Interpolate between bullColor (#33c570) and bearColor (#ae4ce6)
    const r = Math.round(0x33 + t * (0xae - 0x33));
    const g = Math.round(0xc5 + t * (0x4c - 0xc5));
    const b = Math.round(0x70 + t * (0xe6 - 0x70));
    const color = `rgb(${r},${g},${b})`;
    return { time: bars[i].time, value: v, color };
  });

  // 50-level reference line
  const plot1 = bars.map((b) => ({ time: b.time, value: 50 }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    fills: [
      { plot1: 'plot0', plot2: 'plot1', options: { color: bearColor + '33' } },
    ],
    hlines: [
      { value: 70, options: { color: bearColor, linestyle: 'dashed', title: 'Overbought' } },
      { value: 50, options: { color: '#808080', linestyle: 'dotted', title: 'Mid' } },
      { value: 30, options: { color: bullColor, linestyle: 'dashed', title: 'Oversold' } },
    ],
    markers,
  };
}

export const RsiMomentumDivergence = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
