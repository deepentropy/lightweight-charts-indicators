/**
 * Bjorgum AutoTrail
 *
 * Automatic trailing stop indicator using ATR, Percent, or fixed Price offset.
 * Computes swing high/low over a lookback window, applies offset, and ratchets
 * the trail in the favorable direction. Flips direction when price breaches trail.
 *
 * Reference: TradingView "Bjorgum AutoTrail" by Bjorgum (simplified for auto mode)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface BjorgumAutoTrailInputs {
  trailType: string;
  atrLength: number;
  atrMult: number;
  perc: number;
  lookback: number;
}

export const defaultInputs: BjorgumAutoTrailInputs = {
  trailType: 'ATR',
  atrLength: 14,
  atrMult: 1.0,
  perc: 2.0,
  lookback: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'trailType', type: 'string', title: 'Trail Type', defval: 'ATR', options: ['ATR', 'Percent', 'Price'] },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14, min: 1 },
  { id: 'atrMult', type: 'float', title: 'ATR Multiplier', defval: 1.0, min: 0.1, step: 0.1 },
  { id: 'perc', type: 'float', title: 'Percent', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'lookback', type: 'int', title: 'Lookback', defval: 5, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trail', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Bjorgum AutoTrail',
  shortTitle: 'BjAutoTrail',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<BjorgumAutoTrailInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { trailType, atrLength, atrMult, perc, lookback } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // Compute offset per bar
  const atrArr = ta.atr(bars, atrLength).toArray();
  const lowSeries = new Series(bars, (b) => b.low);
  const highSeries = new Series(bars, (b) => b.high);
  const swingLowArr = ta.lowest(lowSeries, lookback).toArray();
  const swingHighArr = ta.highest(highSeries, lookback).toArray();

  // Initial ATR for Price mode fallback
  const initAtr = atrArr.find((v) => v != null && !isNaN(v)) ?? 1;

  const getOffset = (i: number): number => {
    if (trailType === 'ATR') return (atrArr[i] ?? initAtr) * atrMult;
    if (trailType === 'Percent') return bars[i].close * (perc / 100);
    // Price: use fixed offset based on initial ATR
    return initAtr * atrMult;
  };

  const warmup = Math.max(atrLength, lookback);

  // Direction: 1 = long, -1 = short
  const trail: number[] = new Array(n);
  const dir: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    if (i < warmup) {
      trail[i] = NaN;
      dir[i] = 1;
      continue;
    }

    const offset = getOffset(i);
    const longTrail = (swingLowArr[i] ?? bars[i].low) - offset;
    const shortTrail = (swingHighArr[i] ?? bars[i].high) + offset;

    if (i === warmup) {
      // Initialize direction based on close vs mid of range
      const mid = (bars[i].high + bars[i].low) / 2;
      dir[i] = bars[i].close >= mid ? 1 : -1;
      trail[i] = dir[i] === 1 ? longTrail : shortTrail;
      continue;
    }

    const prevDir = dir[i - 1];
    const prevTrail = trail[i - 1];

    if (prevDir === 1) {
      // Long: trail ratchets up only
      const newTrail = Math.max(longTrail, isNaN(prevTrail) ? longTrail : prevTrail);
      if (bars[i].close < prevTrail) {
        // Price broke below trail, flip to short
        dir[i] = -1;
        trail[i] = shortTrail;
      } else {
        dir[i] = 1;
        trail[i] = newTrail;
      }
    } else {
      // Short: trail ratchets down only
      const newTrail = Math.min(shortTrail, isNaN(prevTrail) ? shortTrail : prevTrail);
      if (bars[i].close > prevTrail) {
        // Price broke above trail, flip to long
        dir[i] = 1;
        trail[i] = longTrail;
      } else {
        dir[i] = -1;
        trail[i] = newTrail;
      }
    }
  }

  // Plot with direction-based color
  const plot0 = trail.map((v, i) => {
    if (i < warmup || isNaN(v)) return { time: bars[i].time, value: NaN };
    const color = dir[i] === 1 ? '#2962FF' : '#FF0000';
    return { time: bars[i].time, value: v, color };
  });

  // Markers on direction changes
  const markers: MarkerData[] = [];
  for (let i = warmup + 1; i < n; i++) {
    if (isNaN(trail[i]) || isNaN(trail[i - 1])) continue;
    if (dir[i] === -1 && dir[i - 1] === 1) {
      // Long trail hit -> bearish flip
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'xcross', color: '#2962FF', text: 'Stop' });
    } else if (dir[i] === 1 && dir[i - 1] === -1) {
      // Short trail hit -> bullish flip
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'xcross', color: '#FF0000', text: 'Stop' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    markers,
  };
}

export const BjorgumAutoTrail = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
