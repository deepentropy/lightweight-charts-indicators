/**
 * CM Gann Swing High Low V2
 *
 * Gann swing high/low detection. Tracks the highest high and lowest low
 * over a lookback period as step-style swing lines.
 *
 * Reference: TradingView "CM_Gann Swing High Low V2" by ChrisMoody (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData, BgColorData } from '../types';

export interface CMGannSwingInputs {
  length: number;
}

export const defaultInputs: CMGannSwingInputs = {
  length: 12,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 12, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Swing High', color: '#EF5350', lineWidth: 2 },
  { id: 'plot1', title: 'Swing Low', color: '#26A69A', lineWidth: 2 },
];

export const metadata = {
  title: 'CM Gann Swing High Low V2',
  shortTitle: 'Gann Swing',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<CMGannSwingInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const highestArr = ta.highest(highSeries, length).toArray();
  const lowestArr = ta.lowest(lowSeries, length).toArray();

  // Track step-style swing levels that only update on new swings
  let swingHigh = NaN;
  let swingLow = NaN;

  const shPlot: { time: number; value: number }[] = [];
  const slPlot: { time: number; value: number }[] = [];

  const warmup = length;

  for (let i = 0; i < n; i++) {
    if (i < warmup) {
      shPlot.push({ time: bars[i].time, value: NaN });
      slPlot.push({ time: bars[i].time, value: NaN });
      continue;
    }

    const hh = highestArr[i];
    const ll = lowestArr[i];

    // Update swing high when bar high equals the highest high (new swing high)
    if (bars[i].high >= hh) {
      swingHigh = hh;
    }
    // Update swing low when bar low equals the lowest low (new swing low)
    if (bars[i].low <= ll) {
      swingLow = ll;
    }

    shPlot.push({ time: bars[i].time, value: swingHigh });
    slPlot.push({ time: bars[i].time, value: swingLow });
  }

  // Pine display elements based on cross conditions
  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];
  const bgColors: BgColorData[] = [];

  // Build arrays from plots for cross detection
  const hiArr = shPlot.map(p => p.value);
  const loArr = slPlot.map(p => p.value);

  for (let i = warmup + 1; i < n; i++) {
    const hi = hiArr[i];
    const lo = loArr[i];

    // Cross above swing high: close > hi and close[1] < hi
    const crossAbove = !isNaN(hi) && bars[i].close > hi && bars[i - 1].close < hi;
    // Cross below swing low: close < lo and close[1] > lo
    const crossBelow = !isNaN(lo) && bars[i].close < lo && bars[i - 1].close > lo;

    // Pine barcolor: yellow on cross
    if (crossAbove || crossBelow) {
      barColors.push({ time: bars[i].time, color: '#FFFF00' });
    }

    // Pine bgcolor: green on cross above, red on cross below (transp=60)
    if (crossAbove) {
      bgColors.push({ time: bars[i].time, color: 'rgba(0,128,0,0.40)' });
    }
    if (crossBelow) {
      bgColors.push({ time: bars[i].time, color: 'rgba(255,0,0,0.40)' });
    }

    // Pine plotshape: triangles on cross events (pttb=true by default)
    if (crossAbove) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: '#00FF00', text: 'Cross Up' });
    }
    if (crossBelow) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: '#FF0000', text: 'Cross Down' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': shPlot, 'plot1': slPlot },
    markers,
    barColors,
    bgColors,
  } as IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[]; bgColors: BgColorData[] };
}

export const CMGannSwing = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
