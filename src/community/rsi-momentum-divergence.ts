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
import type { MarkerData, LineDrawingData } from '../types';

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

export function calculate(bars: Bar[], inputs: Partial<RsiMomentumDivergenceInputs> = {}): IndicatorResult & { markers: MarkerData[]; lines: LineDrawingData[] } {
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
  const qtyDivLevels = 10;

  // Track divergence events: { barIndex (of the divergence bar), isBull }
  const divEvents: { barIdx: number; isBull: boolean }[] = [];

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
            const divBar = i - divLookbackR;
            markers.push({
              time: bars[divBar]?.time ?? bars[i].time,
              position: 'belowBar',
              shape: 'labelUp',
              color: bullColor,
              text: 'Bull',
            });
            divEvents.push({ barIdx: divBar, isBull: true });
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
            const divBar = i - divLookbackR;
            markers.push({
              time: bars[divBar]?.time ?? bars[i].time,
              position: 'aboveBar',
              shape: 'labelDown',
              color: bearColor,
              text: 'Bear',
            });
            divEvents.push({ barIdx: divBar, isBull: false });
          }
        }

        lastPHRsiRight = rsiRight;
        lastPHPriceHigh = bars[i - divLookbackR]?.high ?? NaN;
        lastPHBar = i;
      }
    }
  }

  // Build divergence zone lines (force_overlay=true in Pine — drawn on price chart)
  // Simulates Pine's bar-by-bar zone management:
  //   - New zone added at divergence price level
  //   - Each bar: if price breaks through zone, extend (solid); otherwise dashed + remove
  //   - Cap at qtyDivLevels per type
  const lines: LineDrawingData[] = [];

  if (divEvents.length > 0) {
    // Active zones: { priceLevel, startBarIdx, isBull, endBarIdx }
    type Zone = { price: number; startIdx: number; isBull: boolean; endIdx: number };
    const bullZones: Zone[] = [];
    const bearZones: Zone[] = [];

    // Finalized (expired) zones that got dashed when price didn't break through
    const expiredZones: (Zone & { style: 'dashed' })[] = [];

    // Sort divergence events by barIdx for sequential processing
    divEvents.sort((a, b) => a.barIdx - b.barIdx);
    let nextEventIdx = 0;

    for (let i = 0; i < n; i++) {
      // Add new zones from divergence events on this bar
      while (nextEventIdx < divEvents.length && divEvents[nextEventIdx].barIdx === i) {
        const ev = divEvents[nextEventIdx];
        const price = ev.isBull ? bars[i].low : bars[i].high;
        const zone: Zone = { price, startIdx: i, isBull: ev.isBull, endIdx: i };
        if (ev.isBull) {
          bullZones.push(zone);
          if (bullZones.length > qtyDivLevels) bullZones.shift();
        } else {
          bearZones.push(zone);
          if (bearZones.length > qtyDivLevels) bearZones.shift();
        }
        nextEventIdx++;
      }

      // Update existing bull zones
      for (let z = bullZones.length - 1; z >= 0; z--) {
        const zone = bullZones[z];
        if (bars[i].high > zone.price) {
          // Price broke through — extend zone (stays solid)
          zone.endIdx = i;
        } else {
          // Not broken — finalize as dashed and remove from active tracking
          zone.endIdx = i;
          expiredZones.push({ ...zone, style: 'dashed' });
          bullZones.splice(z, 1);
        }
      }

      // Update existing bear zones
      for (let z = bearZones.length - 1; z >= 0; z--) {
        const zone = bearZones[z];
        if (bars[i].low < zone.price) {
          // Price broke through — extend zone (stays solid)
          zone.endIdx = i;
        } else {
          // Not broken — finalize as dashed and remove from active tracking
          zone.endIdx = i;
          expiredZones.push({ ...zone, style: 'dashed' });
          bearZones.splice(z, 1);
        }
      }
    }

    // Emit still-active zones as solid lines
    for (const zone of [...bullZones, ...bearZones]) {
      lines.push({
        time1: bars[zone.startIdx].time,
        price1: zone.price,
        time2: bars[zone.endIdx].time,
        price2: zone.price,
        color: zone.isBull ? bullColor : bearColor,
        width: 2,
        style: 'solid',
      });
    }

    // Emit most recent expired zones as dashed lines (capped to avoid clutter)
    const recentExpired = expiredZones.slice(-qtyDivLevels * 2);
    for (const zone of recentExpired) {
      lines.push({
        time1: bars[zone.startIdx].time,
        price1: zone.price,
        time2: bars[zone.endIdx].time,
        price2: zone.price,
        color: zone.isBull ? bullColor : bearColor,
        width: 2,
        style: 'dashed',
      });
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
    lines,
  };
}

export const RsiMomentumDivergence = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
