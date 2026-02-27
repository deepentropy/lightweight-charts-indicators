/**
 * Order Blocks with Signals (Sonarlab)
 *
 * Detects Order Blocks using Rate of Change (ROC) momentum.
 * Bearish OB: ROC crosses under -sensitivity, box drawn at first green candle in [4..15] lookback.
 * Bullish OB: ROC crosses over +sensitivity, box drawn at first red candle in [4..15] lookback.
 * OBs are mitigated (removed) when price closes beyond the OB boundary.
 *
 * Reference: TradingView "Sonarlab - Order Blocks" by ClayeWeight
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BoxData } from '../types';

export interface OrderBlocksSignalsInputs {
  sensitivity: number;
  mitigationType: 'Close' | 'Wick';
}

export const defaultInputs: OrderBlocksSignalsInputs = {
  sensitivity: 28,
  mitigationType: 'Close',
};

export const inputConfig: InputConfig[] = [
  { id: 'sensitivity', type: 'int', title: 'Sensitivity', defval: 28, min: 1 },
  { id: 'mitigationType', type: 'string', title: 'OB Mitigation Type', defval: 'Close', options: ['Close', 'Wick'] },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Order Blocks with Signals',
  shortTitle: 'OBSignals',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<OrderBlocksSignalsInputs> = {}): IndicatorResult & { boxes: BoxData[]; markers: MarkerData[] } {
  const { sensitivity, mitigationType } = { ...defaultInputs, ...inputs };
  const sens = sensitivity / 100;
  const n = bars.length;

  // Custom ROC: (open - open[4]) / open[4] * 100
  const pc: number[] = new Array(n).fill(NaN);
  for (let i = 4; i < n; i++) {
    pc[i] = (bars[i].open - bars[i - 4].open) / bars[i - 4].open * 100;
  }

  // Track active order blocks
  interface OB { top: number; bottom: number; startIdx: number; type: 'bull' | 'bear' }
  const activeOBs: OB[] = [];

  const boxes: BoxData[] = [];
  const markers: MarkerData[] = [];

  // Track cross_index for cooldown
  let crossIndex = -10;
  let prevCrossIndex = -10;

  for (let i = 5; i < n; i++) {
    if (isNaN(pc[i]) || isNaN(pc[i - 1])) continue;

    // Crossunder: pc crosses under -sens
    const crossUnder = pc[i - 1] >= -sens && pc[i] < -sens;
    // Crossover: pc crosses over +sens
    const crossOver = pc[i - 1] <= sens && pc[i] > sens;

    let obCreated = false;
    let obCreatedBull = false;

    if (crossUnder) {
      obCreated = true;
      prevCrossIndex = crossIndex;
      crossIndex = i;
    }
    if (crossOver) {
      obCreatedBull = true;
      prevCrossIndex = crossIndex;
      crossIndex = i;
    }

    // Bearish OB creation with cooldown check
    if (obCreated && crossIndex - prevCrossIndex > 5) {
      // Find first green candle in bars [4..15] back
      for (let j = 4; j <= 15; j++) {
        const idx = i - j;
        if (idx < 0) break;
        if (bars[idx].close > bars[idx].open) {
          activeOBs.push({
            top: bars[idx].high,
            bottom: bars[idx].low,
            startIdx: idx,
            type: 'bear',
          });
          break;
        }
      }
    }

    // Bullish OB creation with cooldown check
    if (obCreatedBull && crossIndex - prevCrossIndex > 5) {
      // Find first red candle in bars [4..15] back
      for (let j = 4; j <= 15; j++) {
        const idx = i - j;
        if (idx < 0) break;
        if (bars[idx].close < bars[idx].open) {
          activeOBs.push({
            top: bars[idx].high,
            bottom: bars[idx].low,
            startIdx: idx,
            type: 'bull',
          });
          break;
        }
      }
    }

    // Mitigation check: remove OBs that have been invalidated
    const bearMitigation = mitigationType === 'Close' ? (i > 0 ? bars[i - 1].close : bars[i].close) : bars[i].high;
    const bullMitigation = mitigationType === 'Close' ? (i > 0 ? bars[i - 1].close : bars[i].close) : bars[i].low;

    for (let j = activeOBs.length - 1; j >= 0; j--) {
      const ob = activeOBs[j];
      if (ob.type === 'bear') {
        // Bearish OB mitigated when close/high exceeds top
        if (bearMitigation > ob.top) {
          // Finalize box from start to current bar
          boxes.push({
            time1: bars[ob.startIdx].time,
            price1: ob.top,
            time2: bars[i].time,
            price2: ob.bottom,
            bgColor: 'rgba(80,108,211,0.15)',
            borderColor: '#4760bb',
            borderWidth: 1,
          });
          activeOBs.splice(j, 1);
        } else if (bars[i].high > ob.bottom) {
          // Price inside bearish OB - signal
          markers.push({
            time: bars[i].time,
            position: 'aboveBar',
            shape: 'triangleDown',
            color: '#4760bb',
            text: 'Sell',
          });
        }
      } else {
        // Bullish OB mitigated when close/low goes below bottom
        if (bullMitigation < ob.bottom) {
          // Finalize box from start to current bar
          boxes.push({
            time1: bars[ob.startIdx].time,
            price1: ob.top,
            time2: bars[i].time,
            price2: ob.bottom,
            bgColor: 'rgba(100,196,172,0.15)',
            borderColor: '#5db49e',
            borderWidth: 1,
          });
          activeOBs.splice(j, 1);
        } else if (bars[i].low < ob.top) {
          // Price inside bullish OB - signal
          markers.push({
            time: bars[i].time,
            position: 'belowBar',
            shape: 'triangleUp',
            color: '#5db49e',
            text: 'Buy',
          });
        }
      }
    }
  }

  // Draw remaining active OBs extending to last bar
  for (const ob of activeOBs) {
    boxes.push({
      time1: bars[ob.startIdx].time,
      price1: ob.top,
      time2: bars[n - 1].time,
      price2: ob.bottom,
      bgColor: ob.type === 'bull' ? 'rgba(100,196,172,0.15)' : 'rgba(80,108,211,0.15)',
      borderColor: ob.type === 'bull' ? '#5db49e' : '#4760bb',
      borderWidth: 1,
    });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    boxes,
    markers,
  };
}

export const OrderBlocksSignals = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
