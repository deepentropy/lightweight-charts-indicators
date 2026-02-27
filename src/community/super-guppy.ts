/**
 * Super Guppy R1.0
 *
 * Multi-EMA trend alignment indicator.
 * 11 Fast EMAs (3-23) and 16 Slow EMAs (25-70) detect trend strength and alignment.
 * Fast/slow bands are filled with alignment-dependent colors.
 * Swing and Break buy/sell signals on alignment changes.
 *
 * Reference: TradingView "Super Guppy R1.0" by JustUncleL
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';

export interface SuperGuppyInputs {
  showBreak: boolean;
  showSwing: boolean;
  lookback: number;
}

export const defaultInputs: SuperGuppyInputs = {
  showBreak: true,
  showSwing: true,
  lookback: 6,
};

export const inputConfig: InputConfig[] = [
  { id: 'showBreak', type: 'bool', title: 'Show Break Signals', defval: true },
  { id: 'showSwing', type: 'bool', title: 'Show Swing Signals', defval: true },
  { id: 'lookback', type: 'int', title: 'Signal Lookback', defval: 6, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast Upper (EMA 3)', color: '#00FFFF', lineWidth: 1 },
  { id: 'plot1', title: 'Fast Lower (EMA 23)', color: '#00FFFF', lineWidth: 1 },
  { id: 'plot2', title: 'Slow Upper (EMA 25)', color: '#00FF00', lineWidth: 1 },
  { id: 'plot3', title: 'Slow Lower (EMA 70)', color: '#00FF00', lineWidth: 1 },
  { id: 'plot4', title: 'EMA Fast Avg', color: '#FFD700', lineWidth: 2 },
  { id: 'plot5', title: 'EMA Slow Avg', color: '#FF00FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Super Guppy',
  shortTitle: 'SGuppy',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<SuperGuppyInputs> = {}): IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[] } {
  const { showBreak, showSwing, lookback } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const close = new Series(bars, (b) => b.close);

  // Fast EMAs: periods 3,5,7,9,11,13,15,17,19,21,23
  const fastPeriods = [3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23];
  const fastEmas = fastPeriods.map((p) => ta.ema(close, p).toArray());

  // Slow EMAs: periods 25,28,31,34,37,40,43,46,49,52,55,58,61,64,67,70
  const slowPeriods = [25, 28, 31, 34, 37, 40, 43, 46, 49, 52, 55, 58, 61, 64, 67, 70];
  const slowEmas = slowPeriods.map((p) => ta.ema(close, p).toArray());

  const warmup = 70; // longest EMA period

  // Compute averages
  const emaFastAvg: number[] = new Array(n);
  const emaSlowAvg: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    let fSum = 0;
    for (let j = 0; j < fastEmas.length; j++) fSum += fastEmas[j][i] ?? 0;
    emaFastAvg[i] = fSum / fastEmas.length;

    let sSum = 0;
    for (let j = 0; j < slowEmas.length; j++) sSum += slowEmas[j][i] ?? 0;
    emaSlowAvg[i] = sSum / slowEmas.length;
  }

  // Alignment checks
  const fastAlignedLong: boolean[] = new Array(n);
  const fastAlignedShort: boolean[] = new Array(n);
  const slowAlignedLong: boolean[] = new Array(n);
  const slowAlignedShort: boolean[] = new Array(n);

  for (let i = 0; i < n; i++) {
    // Fast aligned long: F1>F2>F3>...>F11 AND S1>S16
    let fLong = true;
    let fShort = true;
    for (let j = 0; j < fastEmas.length - 1; j++) {
      if ((fastEmas[j][i] ?? 0) <= (fastEmas[j + 1][i] ?? 0)) fLong = false;
      if ((fastEmas[j][i] ?? 0) >= (fastEmas[j + 1][i] ?? 0)) fShort = false;
    }
    const s1 = slowEmas[0][i] ?? 0;
    const s16 = slowEmas[slowEmas.length - 1][i] ?? 0;
    fastAlignedLong[i] = fLong && s1 > s16;
    fastAlignedShort[i] = fShort && s1 < s16;

    // Slow aligned long: S1>S2>...>S16
    let sLong = true;
    let sShort = true;
    for (let j = 0; j < slowEmas.length - 1; j++) {
      if ((slowEmas[j][i] ?? 0) <= (slowEmas[j + 1][i] ?? 0)) sLong = false;
      if ((slowEmas[j][i] ?? 0) >= (slowEmas[j + 1][i] ?? 0)) sShort = false;
    }
    slowAlignedLong[i] = sLong;
    slowAlignedShort[i] = sShort;
  }

  // Plots
  const toPlot = (arr: number[]) =>
    arr.map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : v }));

  const f1 = fastEmas[0]; // EMA 3 (fastest of fast)
  const f11 = fastEmas[fastEmas.length - 1]; // EMA 23 (slowest of fast)
  const s1 = slowEmas[0]; // EMA 25 (fastest of slow)
  const s16 = slowEmas[slowEmas.length - 1]; // EMA 70 (slowest of slow)

  // Fast band coloring
  const fastColor = (i: number): string => {
    if (i < warmup) return 'transparent';
    if (fastAlignedLong[i]) return '#00FFFF'; // Aqua
    if (fastAlignedShort[i]) return '#0000FF'; // Blue
    return '#808080'; // Gray
  };

  // Slow band coloring
  const slowColor = (i: number): string => {
    if (i < warmup) return 'transparent';
    if (slowAlignedLong[i]) return '#00FF00'; // Lime
    if (slowAlignedShort[i]) return '#FF0000'; // Red
    return '#808080'; // Gray
  };

  const plot0 = f1.map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : (v ?? NaN), color: fastColor(i) }));
  const plot1 = f11.map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : (v ?? NaN), color: fastColor(i) }));
  const plot2 = s1.map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : (v ?? NaN), color: slowColor(i) }));
  const plot3 = s16.map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : (v ?? NaN), color: slowColor(i) }));
  const plot4 = toPlot(emaFastAvg);
  const plot5 = toPlot(emaSlowAvg);

  // Fill colors
  const fastFillColors = f1.map((_v, i) => {
    if (i < warmup) return 'transparent';
    if (fastAlignedLong[i]) return 'rgba(0,255,255,0.15)';
    if (fastAlignedShort[i]) return 'rgba(0,0,255,0.15)';
    return 'rgba(128,128,128,0.08)';
  });

  const slowFillColors = s1.map((_v, i) => {
    if (i < warmup) return 'transparent';
    if (slowAlignedLong[i]) return 'rgba(0,255,0,0.15)';
    if (slowAlignedShort[i]) return 'rgba(255,0,0,0.15)';
    return 'rgba(128,128,128,0.08)';
  });

  // Signals
  const markers: MarkerData[] = [];

  // Track consecutive bars for swing signals
  let swingBuyCount = 0;
  let swingSellCount = 0;
  let breakBuyFired = false;
  let breakSellFired = false;

  for (let i = warmup; i < n; i++) {
    const fastAboveSlow = emaFastAvg[i] > emaSlowAvg[i];
    const fastBelowSlow = emaFastAvg[i] < emaSlowAvg[i];
    const prevFastAboveSlow = i > 0 ? emaFastAvg[i - 1] > emaSlowAvg[i - 1] : false;
    const prevFastBelowSlow = i > 0 ? emaFastAvg[i - 1] < emaSlowAvg[i - 1] : false;
    const s1Val = slowEmas[0][i] ?? 0;
    const s16Val = slowEmas[slowEmas.length - 1][i] ?? 0;

    // Break signals: crossover/crossunder of emaFast vs emaSlow
    if (showBreak) {
      if (fastAboveSlow && !prevFastAboveSlow && !slowAlignedShort[i]) {
        markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#00FFFF', text: 'Break' });
        breakBuyFired = true;
        breakSellFired = false;
      }
      if (fastBelowSlow && !prevFastBelowSlow && !slowAlignedLong[i]) {
        markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#0000FF', text: 'Break' });
        breakSellFired = true;
        breakBuyFired = false;
      }
    }

    // Swing signals: alignment conditions met for first bar
    if (showSwing) {
      const swingBuyCond = fastAboveSlow && s1Val > s16Val && !slowAlignedShort[i] && fastAlignedLong[i];
      const swingSellCond = fastBelowSlow && s1Val < s16Val && !slowAlignedLong[i] && fastAlignedShort[i];

      if (swingBuyCond) {
        swingBuyCount++;
        if (swingBuyCount === 1) {
          markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#00FF00', text: 'Swing' });
        }
      } else {
        swingBuyCount = 0;
      }

      if (swingSellCond) {
        swingSellCount++;
        if (swingSellCount === 1) {
          markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#FF0000', text: 'Swing' });
        }
      } else {
        swingSellCount = 0;
      }
    }
  }

  // Bar colors: fast alignment color
  const barColors: BarColorData[] = [];
  for (let i = warmup; i < n; i++) {
    if (fastAlignedLong[i]) {
      barColors.push({ time: bars[i].time, color: '#00FFFF' });
    } else if (fastAlignedShort[i]) {
      barColors.push({ time: bars[i].time, color: '#0000FF' });
    } else {
      barColors.push({ time: bars[i].time, color: '#808080' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3, 'plot4': plot4, 'plot5': plot5 },
    fills: [
      { plot1: 'plot0', plot2: 'plot1', options: { color: '#00FFFF' }, colors: fastFillColors },
      { plot1: 'plot2', plot2: 'plot3', options: { color: '#00FF00' }, colors: slowFillColors },
    ],
    markers,
    barColors,
  };
}

export const SuperGuppy = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
