/**
 * EMA + SuperTrend Combo
 *
 * EMA line combined with SuperTrend indicator.
 * SuperTrend uses ATR-based trailing stops that flip on trend change.
 *
 * Reference: TradingView "EMA + SuperTrend" (community)
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface EMASuperTrendInputs {
  emaLen: number;
  atrLen: number;
  factor: number;
  src: SourceType;
}

export const defaultInputs: EMASuperTrendInputs = {
  emaLen: 20,
  atrLen: 10,
  factor: 3.0,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'emaLen', type: 'int', title: 'EMA Length', defval: 20, min: 1 },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 10, min: 1 },
  { id: 'factor', type: 'float', title: 'Factor', defval: 3.0, min: 0.1, step: 0.1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA', color: '#FFEB3B', lineWidth: 2 },
  { id: 'plot1', title: 'SuperTrend', color: '#26A69A', lineWidth: 2 },
];

export const metadata = {
  title: 'EMA + SuperTrend',
  shortTitle: 'EMA+ST',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<EMASuperTrendInputs> = {}): IndicatorResult {
  const { emaLen, atrLen, factor, src } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const source = getSourceSeries(bars, src);

  const emaArr = ta.ema(source, emaLen).toArray();
  const atrArr = ta.atr(bars, atrLen).toArray();

  // SuperTrend
  const stArr: number[] = new Array(n);
  const dirArr: number[] = new Array(n); // 1=up (bullish), -1=down (bearish)
  const upperBand: number[] = new Array(n);
  const lowerBand: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const hl2 = (bars[i].high + bars[i].low) / 2;
    const atr = atrArr[i] ?? 0;
    upperBand[i] = hl2 + factor * atr;
    lowerBand[i] = hl2 - factor * atr;

    if (i === 0) {
      dirArr[i] = 1;
      stArr[i] = lowerBand[i];
      continue;
    }

    // Ratchet bands
    if (lowerBand[i] > lowerBand[i - 1] || bars[i - 1].close < lowerBand[i - 1]) {
      // keep new lower band
    } else {
      lowerBand[i] = lowerBand[i - 1];
    }

    if (upperBand[i] < upperBand[i - 1] || bars[i - 1].close > upperBand[i - 1]) {
      // keep new upper band
    } else {
      upperBand[i] = upperBand[i - 1];
    }

    // Direction
    const prevDir = dirArr[i - 1];
    if (prevDir === -1 && bars[i].close > upperBand[i - 1]) {
      dirArr[i] = 1;
    } else if (prevDir === 1 && bars[i].close < lowerBand[i - 1]) {
      dirArr[i] = -1;
    } else {
      dirArr[i] = prevDir;
    }

    stArr[i] = dirArr[i] === 1 ? lowerBand[i] : upperBand[i];
  }

  const warmup = Math.max(emaLen, atrLen);

  const plot0 = emaArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || isNaN(v) ? NaN : v,
  }));

  const plot1 = stArr.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const color = dirArr[i] === 1 ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  // Pine fill: between bodyMiddle and supertrend line (green/red based on direction)
  // We fill between EMA (plot0) and SuperTrend (plot1) with dynamic colors
  const fillColors: string[] = [];
  for (let i = 0; i < n; i++) {
    if (i < warmup) {
      fillColors.push('rgba(0,0,0,0)');
    } else {
      fillColors.push(dirArr[i] === 1 ? 'rgba(0,128,0,0.10)' : 'rgba(255,0,0,0.10)');
    }
  }

  // Pine label.new: buy/sell on supertrend direction change
  const markers: MarkerData[] = [];
  for (let i = warmup + 1; i < n; i++) {
    if (dirArr[i] === 1 && dirArr[i - 1] !== 1) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#00FF00', text: 'BUY' });
    }
    if (dirArr[i] === -1 && dirArr[i - 1] !== -1) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#FF0000', text: 'SELL' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(0,128,0,0.10)' }, colors: fillColors }],
    markers,
  } as IndicatorResult & { markers: MarkerData[] };
}

export const EMASupertrend = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
