/**
 * Market Cipher A (VuManChu Cipher A)
 *
 * EMA ribbon overlay with 8 EMAs (5,11,15,18,21,24,28,34), WaveTrend oscillator,
 * RSI, and RSI+MFI for signal generation.
 *
 * Display elements from Pine:
 * - 8 EMA ribbon lines with conditional colors (blue shades when bullish, gray when bearish)
 * - Fills between EMA1-EMA2 and EMA2-EMA8
 * - 8 plotshape markers: longEma, shortEma, redCross, blueTriangle, redDiamond,
 *   bullCandle, bloodDiamond, yellowCross
 *
 * Reference: TradingView "VuManChu Cipher A" (overlay=true)
 */

import { ta, Series, getSourceSeries, math, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface MarketCipherAInputs {
  wtChannelLen: number;
  wtAverageLen: number;
  wtMALen: number;
  ema1Len: number;
  ema2Len: number;
  ema3Len: number;
  ema4Len: number;
  ema5Len: number;
  ema6Len: number;
  ema7Len: number;
  ema8Len: number;
  rsiLen: number;
  rsiMFIPeriod: number;
  rsiMFIMultiplier: number;
}

export const defaultInputs: MarketCipherAInputs = {
  wtChannelLen: 9,
  wtAverageLen: 13,
  wtMALen: 3,
  ema1Len: 5,
  ema2Len: 11,
  ema3Len: 15,
  ema4Len: 18,
  ema5Len: 21,
  ema6Len: 24,
  ema7Len: 28,
  ema8Len: 34,
  rsiLen: 14,
  rsiMFIPeriod: 60,
  rsiMFIMultiplier: 150,
};

export const inputConfig: InputConfig[] = [
  { id: 'wtChannelLen', type: 'int', title: 'WT Channel Length', defval: 9, min: 1 },
  { id: 'wtAverageLen', type: 'int', title: 'WT Average Length', defval: 13, min: 1 },
  { id: 'wtMALen', type: 'int', title: 'WT MA Length', defval: 3, min: 1 },
  { id: 'ema1Len', type: 'int', title: 'EMA 1', defval: 5, min: 1 },
  { id: 'ema2Len', type: 'int', title: 'EMA 2', defval: 11, min: 1 },
  { id: 'ema3Len', type: 'int', title: 'EMA 3', defval: 15, min: 1 },
  { id: 'ema4Len', type: 'int', title: 'EMA 4', defval: 18, min: 1 },
  { id: 'ema5Len', type: 'int', title: 'EMA 5', defval: 21, min: 1 },
  { id: 'ema6Len', type: 'int', title: 'EMA 6', defval: 24, min: 1 },
  { id: 'ema7Len', type: 'int', title: 'EMA 7', defval: 28, min: 1 },
  { id: 'ema8Len', type: 'int', title: 'EMA 8', defval: 34, min: 1 },
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'rsiMFIPeriod', type: 'int', title: 'RSI+MFI Period', defval: 60, min: 1 },
  { id: 'rsiMFIMultiplier', type: 'int', title: 'RSI+MFI Multiplier', defval: 150, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'ema1', title: 'EMA 1', color: '#1573d4', lineWidth: 2 },
  { id: 'ema2', title: 'EMA 2', color: '#3096ff', lineWidth: 2 },
  { id: 'ema3', title: 'EMA 3', color: '#57abff', lineWidth: 2 },
  { id: 'ema4', title: 'EMA 4', color: '#85c2ff', lineWidth: 2 },
  { id: 'ema5', title: 'EMA 5', color: '#9bcdff', lineWidth: 2 },
  { id: 'ema6', title: 'EMA 6', color: '#b3d9ff', lineWidth: 2 },
  { id: 'ema7', title: 'EMA 7', color: '#c9e5ff', lineWidth: 2 },
  { id: 'ema8', title: 'EMA 8', color: '#dfecfb', lineWidth: 2 },
];

export const metadata = {
  title: 'Market Cipher A',
  shortTitle: 'MCA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<MarketCipherAInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const {
    wtChannelLen, wtAverageLen, wtMALen,
    ema1Len, ema2Len, ema3Len, ema4Len, ema5Len, ema6Len, ema7Len, ema8Len,
    rsiLen, rsiMFIPeriod, rsiMFIMultiplier,
  } = { ...defaultInputs, ...inputs };

  const n = bars.length;
  const close = new Series(bars, (b) => b.close);

  // --- 8 EMA Ribbon ---
  const lengths = [ema1Len, ema2Len, ema3Len, ema4Len, ema5Len, ema6Len, ema7Len, ema8Len];
  const emaArrays = lengths.map(len => ta.ema(close, len).toArray());
  const ema1Arr = emaArrays[0];
  const ema2Arr = emaArrays[1];
  const ema3Arr = emaArrays[2];
  const ema8Arr = emaArrays[7];

  // --- WaveTrend ---
  // Pine: esa = ema(hlc3, chlen), de = ema(abs(hlc3 - esa), chlen),
  //        ci = (hlc3 - esa) / (0.015 * de), tci = ema(ci, avg), wt1 = tci, wt2 = sma(wt1, malen)
  const hlc3 = getSourceSeries(bars, 'hlc3');
  const esa = ta.ema(hlc3, wtChannelLen);
  const de = ta.ema(math.abs(hlc3.sub(esa)) as Series, wtChannelLen);
  const ci = hlc3.sub(esa).div(de.mul(0.015));
  const wt1 = ta.ema(ci, wtAverageLen);
  const wt2 = ta.sma(wt1, wtMALen);
  const wt1Arr = wt1.toArray();
  const wt2Arr = wt2.toArray();

  // --- RSI ---
  const rsiArr = ta.rsi(close, rsiLen).toArray();

  // --- RSI+MFI: sma(((close - open) / (high - low)) * multiplier, period) ---
  const mfiRaw = new Series(bars, (b) => {
    const range = b.high - b.low;
    if (range === 0) return 0;
    return ((b.close - b.open) / range) * rsiMFIMultiplier;
  });
  const rsiMFIArr = ta.sma(mfiRaw, rsiMFIPeriod).toArray();

  // --- Warmup ---
  const warmup = Math.max(...lengths, wtChannelLen + wtAverageLen, rsiLen, rsiMFIPeriod);

  // --- EMA plots with conditional colors ---
  // Pine: ribbonDir = ema8 < ema2; color = ribbonDir ? blue_shade : gray
  const blueShades = ['#1573d4', '#3096ff', '#57abff', '#85c2ff', '#9bcdff', '#b3d9ff', '#c9e5ff', '#dfecfb'];
  const plotIds = ['ema1', 'ema2', 'ema3', 'ema4', 'ema5', 'ema6', 'ema7', 'ema8'];
  const plots: Record<string, Array<{ time: number; value: number; color?: string }>> = {};

  for (let p = 0; p < 8; p++) {
    plots[plotIds[p]] = emaArrays[p].map((v, i) => {
      if (v == null || i < lengths[p]) return { time: bars[i].time, value: NaN };
      const e2 = ema2Arr[i];
      const e8 = ema8Arr[i];
      const ribbonDir = (e2 != null && e8 != null) ? e8 < e2 : false;
      const color = ribbonDir ? blueShades[p] : '#787B86';
      return { time: bars[i].time, value: v, color };
    });
  }

  // --- Fills ---
  // Pine: fill(p1, p2, color=#1573d4, transp=85) => ~15% opacity
  // Pine: fill(p2, p8, color=#363a45, transp=85) => ~15% opacity
  const fills = [
    { plot1: 'ema1', plot2: 'ema2', options: { color: 'rgba(21,115,212,0.15)' } },
    { plot1: 'ema2', plot2: 'ema8', options: { color: 'rgba(54,58,69,0.15)' } },
  ];

  // --- Markers ---
  const markers: MarkerData[] = [];

  for (let i = warmup + 1; i < n; i++) {
    const e1 = ema1Arr[i];
    const e2 = ema2Arr[i];
    const e3 = ema3Arr[i];
    const e8 = ema8Arr[i];
    const pe1 = ema1Arr[i - 1];
    const pe2 = ema2Arr[i - 1];
    const pe3 = ema3Arr[i - 1];
    const pe8 = ema8Arr[i - 1];
    if (e1 == null || e2 == null || e3 == null || e8 == null) continue;
    if (pe1 == null || pe2 == null || pe3 == null || pe8 == null) continue;

    const w1 = wt1Arr[i];
    const w2 = wt2Arr[i];
    const pw1 = wt1Arr[i - 1];
    const pw2 = wt2Arr[i - 1];
    const rsi = rsiArr[i];
    const rsiMFI = rsiMFIArr[i];

    // Pine crossover/crossunder helpers
    const crossoverE2E8 = pe2 <= pe8 && e2 > e8;   // longEma
    const crossoverE8E2 = pe8 <= pe2 && e8 > e2;   // shortEma
    const crossunderE1E2 = pe1 >= pe2 && e1 < e2;  // redCross
    const crossoverE2E3 = pe2 <= pe3 && e2 > e3;   // blueTriangle

    // WaveTrend cross conditions
    let wtCross = false;
    let wtCrossDown = false;
    if (w1 != null && w2 != null && pw1 != null && pw2 != null) {
      // Pine: cross(wt1, wt2) => either crossover or crossunder
      wtCross = (pw1 <= pw2 && w1 > w2) || (pw1 >= pw2 && w1 < w2);
      // Pine: wtCrossDown = wt2 - wt1 >= 0  (wt2 above wt1 = bearish)
      wtCrossDown = (w2 - w1) >= 0;
    }

    // Pine signals
    const redDiamond = wtCross && wtCrossDown;
    const redCross = crossunderE1E2;
    const yellowCross = redDiamond && w2 != null && w2 < 45 && w2 > -80 &&
      rsi != null && rsi < 30 && rsi > 15 &&
      rsiMFI != null && rsiMFI < -5;
    const bloodDiamond = redDiamond && redCross;
    const bullCandle = bars[i].open > e2 && bars[i].open > e8 &&
      (i > 0 && bars[i - 1].close > bars[i - 1].open) &&
      (bars[i].close > bars[i].open) &&
      !redDiamond && !redCross;

    // Pine plotshape order (determines marker z-order / priority)
    // longEma: green circle aboveBar (transp=50)
    if (crossoverE2E8) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'circle', color: 'rgba(0,255,0,0.50)', text: '' });
    }
    // shortEma: red circle aboveBar (transp=50)
    if (crossoverE8E2) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'circle', color: 'rgba(255,0,0,0.50)', text: '' });
    }
    // redCross: red xcross aboveBar (transp=50)
    if (redCross) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'xcross', color: 'rgba(255,0,0,0.50)', text: '' });
    }
    // blueTriangle: blue triangleUp belowBar (transp=50)
    if (crossoverE2E3) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: 'rgba(0,100,255,0.50)', text: '' });
    }
    // redDiamond: red diamond aboveBar (transp=25)
    if (redDiamond) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'diamond', color: 'rgba(255,0,0,0.75)', text: '' });
    }
    // bullCandle: yellow diamond aboveBar (transp=75)
    if (bullCandle) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'diamond', color: 'rgba(255,255,0,0.25)', text: '' });
    }
    // bloodDiamond: red diamond aboveBar large (transp=15)
    if (bloodDiamond) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'diamond', color: 'rgba(255,0,0,0.85)', text: 'Blood' });
    }
    // yellowCross: yellow xcross aboveBar (transp=25)
    if (yellowCross) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'xcross', color: 'rgba(255,255,0,0.75)', text: '' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    fills,
    markers,
  };
}

export const MarketCipherA = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
