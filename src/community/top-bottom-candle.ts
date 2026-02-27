/**
 * UCS Top & Bottom Candle
 *
 * Detects swing tops and bottoms using pivot high/low detection.
 * Marks pivot highs with down arrows and pivot lows with up arrows.
 *
 * Reference: TradingView "UCS_Top & Bottom Candle" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';

export interface TopBottomCandleInputs {
  leftBars: number;
  rightBars: number;
}

export const defaultInputs: TopBottomCandleInputs = {
  leftBars: 5,
  rightBars: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'leftBars', type: 'int', title: 'Left Bars', defval: 5, min: 1 },
  { id: 'rightBars', type: 'int', title: 'Right Bars', defval: 5, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Close', color: 'transparent', lineWidth: 0, display: 'none' },
];

export const metadata = {
  title: 'Top & Bottom Candle',
  shortTitle: 'TopBot',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<TopBottomCandleInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { leftBars, rightBars } = { ...defaultInputs, ...inputs };

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const phArr = ta.pivothigh(highSeries, leftBars, rightBars).toArray();
  const plArr = ta.pivotlow(lowSeries, leftBars, rightBars).toArray();

  const markers: MarkerData[] = [];
  const closePlot = bars.map((b) => ({ time: b.time, value: NaN }));

  for (let i = 0; i < bars.length; i++) {
    if (phArr[i] != null && !isNaN(phArr[i]!)) {
      markers.push({
        time: bars[i].time as number,
        position: 'aboveBar',
        shape: 'arrowDown',
        color: '#EF5350',
        text: 'Top',
      });
    }

    if (plArr[i] != null && !isNaN(plArr[i]!)) {
      markers.push({
        time: bars[i].time as number,
        position: 'belowBar',
        shape: 'arrowUp',
        color: '#26A69A',
        text: 'Bot',
      });
    }
  }

  // Pine also computes SMI (Stochastic Momentum Index) for panel display with hlines, fills, and barcolor
  const a = leftBars; // Pine uses input 'a' for %K length (mapped to leftBars)
  const b = rightBars; // Pine uses input 'b' for %D length (mapped to rightBars)
  const n = bars.length;

  const lowS = new Series(bars, (bar) => bar.low);
  const highS = new Series(bars, (bar) => bar.high);
  const closeS = new Series(bars, (bar) => bar.close);

  const ll = ta.lowest(lowS, a);
  const hh = ta.highest(highS, a);
  const hhArr = hh.toArray();
  const llArr = ll.toArray();
  const closeArr = closeS.toArray();

  // diff = hh - ll, rdiff = close - (hh+ll)/2
  const diffArr: number[] = new Array(n);
  const rdiffArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    diffArr[i] = (hhArr[i] ?? 0) - (llArr[i] ?? 0);
    rdiffArr[i] = (closeArr[i] ?? 0) - ((hhArr[i] ?? 0) + (llArr[i] ?? 0)) / 2;
  }

  // avgrel = ema(ema(rdiff, b), b), avgdiff = ema(ema(diff, b), b)
  const rdiffS = Series.fromArray(bars, rdiffArr);
  const diffS = Series.fromArray(bars, diffArr);
  const avgrelArr = ta.ema(ta.ema(rdiffS, b), b).toArray();
  const avgdiffArr = ta.ema(ta.ema(diffS, b), b).toArray();

  // Momentum = (close - close[b]) / close[b] * 1000
  const momArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if (i >= b && closeArr[i - b] !== 0) {
      momArr[i] = ((closeArr[i]! - closeArr[i - b]!) / closeArr[i - b]!) * 1000;
    } else {
      momArr[i] = 0;
    }
  }

  // SMI = avgdiff != 0 ? (avgrel / (avgdiff / 2) * 100) : 0
  const smiArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const ad = avgdiffArr[i] ?? 0;
    smiArr[i] = ad !== 0 ? ((avgrelArr[i] ?? 0) / (ad / 2)) * 100 : 0;
  }

  // barcolor: long setup = SMI < -35 and mom > 0 and mom[1] < 0 -> lime
  //           short setup = SMI > 35 and mom < 0 and mom[1] > 0 -> red
  const barColors: BarColorData[] = [];
  const smiWarmup = a + b * 2;
  for (let i = smiWarmup + 1; i < n; i++) {
    const smi = smiArr[i];
    const mom = momArr[i];
    const prevMom = momArr[i - 1];
    if (smi < -35 && mom > 0 && prevMom < 0) {
      barColors.push({ time: bars[i].time, color: '#00E676' }); // lime
    } else if (smi > 35 && mom < 0 && prevMom > 0) {
      barColors.push({ time: bars[i].time, color: '#EF5350' }); // red
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': closePlot },
    markers,
    // hlines from Pine: H1=40 (overbought), H2=-40 (oversold), H0=0 (zero)
    hlines: [
      { value: 40, options: { color: '#EF5350', linestyle: 'solid' as const, title: 'Over Bought' } },
      { value: -40, options: { color: '#26A69A', linestyle: 'solid' as const, title: 'Over Sold' } },
      { value: 0, options: { color: '#2196F3', linestyle: 'solid' as const, title: 'Zero Line' } },
    ],
    // fills between hlines (Pine: fill(H0,H2,green), fill(H0,H1,red))
    fills: [
      { plot1: 'zeroLine', plot2: 'overSold', options: { color: 'rgba(38, 166, 154, 0.15)' } },
      { plot1: 'zeroLine', plot2: 'overBought', options: { color: 'rgba(239, 83, 80, 0.15)' } },
    ],
    barColors,
  } as IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[] };
}

export const TopBottomCandle = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
