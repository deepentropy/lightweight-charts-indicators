/**
 * Adaptive Trend Flow [QuantAlgo]
 *
 * Dual EMA basis (fast + slow on hlc3) plus stdev volatility bands.
 * Trend state tracks: bullish when close > upper, bearish when close < lower.
 * Plots basis line and trailing level (lower in uptrend, upper in downtrend).
 *
 * Reference: TradingView "Adaptive Trend Flow [QuantAlgo]" by QuantAlgo
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData, BgColorData } from '../types';

export interface AdaptiveTrendFlowInputs {
  length: number;
  smoothLen: number;
  sensitivity: number;
}

export const defaultInputs: AdaptiveTrendFlowInputs = {
  length: 10,
  smoothLen: 14,
  sensitivity: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Main Length', defval: 10, min: 2 },
  { id: 'smoothLen', type: 'int', title: 'Smoothing Length', defval: 14, min: 2 },
  { id: 'sensitivity', type: 'float', title: 'Sensitivity', defval: 2.0, min: 0.1, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Basis', color: '#787B86', lineWidth: 2 },
  { id: 'plot1', title: 'Level', color: '#787B86', lineWidth: 2 },
];

export const metadata = {
  title: 'Adaptive Trend Flow [QuantAlgo]',
  shortTitle: 'ATF',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<AdaptiveTrendFlowInputs> = {}): IndicatorResult {
  const { length, smoothLen, sensitivity } = { ...defaultInputs, ...inputs };
  const len = bars.length;

  const typical = new Series(bars, (b) => (b.high + b.low + b.close) / 3);

  // Dual EMA basis
  const fastEmaArr = ta.ema(typical, length).toArray();
  const slowEmaArr = ta.ema(typical, length * 2).toArray();

  // Volatility: stdev of typical, smoothed with EMA
  const volArr = ta.stdev(typical, length).toArray();
  const volSeries = Series.fromArray(bars, volArr);
  const smoothVolArr = ta.ema(volSeries, smoothLen).toArray();

  // Build basis, upper, lower arrays
  const basisArr: number[] = new Array(len);
  const upperArr: number[] = new Array(len);
  const lowerArr: number[] = new Array(len);

  for (let i = 0; i < len; i++) {
    const fast = fastEmaArr[i];
    const slow = slowEmaArr[i];
    const sVol = smoothVolArr[i];

    if (isNaN(fast) || isNaN(slow) || isNaN(sVol)) {
      basisArr[i] = NaN;
      upperArr[i] = NaN;
      lowerArr[i] = NaN;
    } else {
      basisArr[i] = (fast + slow) / 2;
      upperArr[i] = basisArr[i] + sVol * sensitivity;
      lowerArr[i] = basisArr[i] - sVol * sensitivity;
    }
  }

  // Trend state tracking (bar-by-bar, matches PineScript var logic)
  const trendArr: number[] = new Array(len); // 1 = bull, -1 = bear
  const levelArr: number[] = new Array(len);

  for (let i = 0; i < len; i++) {
    if (isNaN(basisArr[i])) {
      trendArr[i] = 0;
      levelArr[i] = NaN;
      continue;
    }

    const close = bars[i].close;

    if (i === 0 || trendArr[i - 1] === 0) {
      // Initialize: first valid bar
      trendArr[i] = close > basisArr[i] ? 1 : -1;
      levelArr[i] = trendArr[i] === 1 ? lowerArr[i] : upperArr[i];
      continue;
    }

    const prevTrend = trendArr[i - 1];

    if (prevTrend === 1) {
      if (close < lowerArr[i]) {
        trendArr[i] = -1;
        levelArr[i] = upperArr[i];
      } else {
        trendArr[i] = 1;
        levelArr[i] = lowerArr[i];
      }
    } else {
      if (close > upperArr[i]) {
        trendArr[i] = 1;
        levelArr[i] = lowerArr[i];
      } else {
        trendArr[i] = -1;
        levelArr[i] = upperArr[i];
      }
    }
  }

  const warmup = length * 2 + smoothLen;

  // plot0: basis colored by trend
  const plot0 = basisArr.map((v, i) => {
    if (i < warmup || isNaN(v)) return { time: bars[i].time, value: NaN };
    const color = trendArr[i] === 1 ? '#00ffaa' : '#ff0000';
    return { time: bars[i].time, value: v, color };
  });

  // plot1: level with linebr style (NaN on trend change)
  const plot1 = levelArr.map((v, i) => {
    if (i < warmup || isNaN(v)) return { time: bars[i].time, value: NaN };
    const color = bars[i].close > v ? '#00ffaa' : '#ff0000';
    return { time: bars[i].time, value: v, color };
  });

  // barcolor: bars colored by trend direction (Pine: barcolor(trend == 1 ? bullcolor : bearcolor))
  const barColors: BarColorData[] = [];
  for (let i = warmup; i < len; i++) {
    if (trendArr[i] !== 0) {
      barColors.push({
        time: bars[i].time,
        color: trendArr[i] === 1 ? 'rgba(0, 255, 170, 0.85)' : 'rgba(255, 0, 0, 0.85)',
      });
    }
  }

  // bgcolor: gradient background that intensifies over trend duration
  // Pine: intensity increments each bar (max 20), color from 95% to 80% transparency
  const bgColors: BgColorData[] = [];
  let intensity = 0;
  let prevTrend = 0;
  for (let i = warmup; i < len; i++) {
    if (trendArr[i] !== prevTrend) {
      intensity = 0;
      prevTrend = trendArr[i];
    }
    intensity = Math.min(intensity + 1, 20);
    // Map intensity 0->20 to alpha 0.05->0.20
    const alpha = 0.05 + (intensity / 20) * 0.15;
    if (trendArr[i] === 1) {
      bgColors.push({ time: bars[i].time, color: `rgba(0, 255, 170, ${alpha.toFixed(2)})` });
    } else if (trendArr[i] === -1) {
      bgColors.push({ time: bars[i].time, color: `rgba(255, 0, 0, ${alpha.toFixed(2)})` });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    // fill between basis (plot0) and level (plot1) colored by trend
    fills: [
      { plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(0, 255, 170, 0.15)' } },
    ],
    barColors,
    bgColors,
  } as IndicatorResult & { barColors: BarColorData[]; bgColors: BgColorData[] };
}

export const AdaptiveTrendFlow = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
