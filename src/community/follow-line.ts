/**
 * Follow Line Indicator
 *
 * Bollinger Bands breakout determines trend direction.
 * ATR-based trailing stop ratchets in trend direction.
 *
 * Reference: TradingView "Follow Line Indicator" by Dreadblitz
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData, BgColorData } from '../types';

export interface FollowLineInputs {
  bbPeriod: number;
  bbDeviations: number;
  useATRFilter: boolean;
  atrPeriod: number;
}

export const defaultInputs: FollowLineInputs = {
  bbPeriod: 21,
  bbDeviations: 1.0,
  useATRFilter: true,
  atrPeriod: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'bbPeriod', type: 'int', title: 'BB Period', defval: 21, min: 1 },
  { id: 'bbDeviations', type: 'float', title: 'BB Deviations', defval: 1.0, min: 0.1, step: 0.05 },
  { id: 'useATRFilter', type: 'bool', title: 'ATR Filter', defval: true },
  { id: 'atrPeriod', type: 'int', title: 'ATR Period', defval: 5, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Follow Line', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Follow Line',
  shortTitle: 'FLI',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<FollowLineInputs> = {}): IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[]; bgColors: BgColorData[] } {
  const { bbPeriod, bbDeviations, useATRFilter, atrPeriod } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const close = new Series(bars, (b) => b.close);
  const stdevArr = ta.stdev(close, bbPeriod).toArray();
  const smaArr = ta.sma(close, bbPeriod).toArray();
  const atrArr = ta.atr(bars, atrPeriod).toArray();

  const trendLine: number[] = new Array(n);
  const iTrend: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const sma = smaArr[i] ?? 0;
    const sd = stdevArr[i] ?? 0;
    const bbUpper = sma + sd * bbDeviations;
    const bbLower = sma - sd * bbDeviations;
    const c = bars[i].close;
    const atr = atrArr[i] ?? 0;

    const bbSignal = c > bbUpper ? 1 : c < bbLower ? -1 : 0;
    const prev = i > 0 ? trendLine[i - 1] : 0;

    if (useATRFilter) {
      if (bbSignal === 1) {
        const val = bars[i].low - atr;
        trendLine[i] = val < prev ? prev : val;
      } else if (bbSignal === -1) {
        const val = bars[i].high + atr;
        trendLine[i] = val > prev ? prev : val;
      } else {
        trendLine[i] = prev;
      }
    } else {
      if (bbSignal === 1) {
        trendLine[i] = bars[i].low < prev ? prev : bars[i].low;
      } else if (bbSignal === -1) {
        trendLine[i] = bars[i].high > prev ? prev : bars[i].high;
      } else {
        trendLine[i] = prev;
      }
    }

    // Track trend direction: 1 = bullish (line below price), -1 = bearish
    iTrend[i] = bars[i].close > trendLine[i] ? 1 : bars[i].close < trendLine[i] ? -1 : (i > 0 ? iTrend[i - 1] : 0);
  }

  const warmup = bbPeriod;
  const plot0 = trendLine.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const color = iTrend[i] > 0 ? '#2962FF' : '#FF6D00';
    return { time: bars[i].time, value: v, color };
  });

  // Markers: buy when iTrend flips -1→1, sell when iTrend flips 1→-1
  const markers: MarkerData[] = [];
  for (let i = warmup; i < n; i++) {
    if (i > 0 && iTrend[i] !== iTrend[i - 1]) {
      if (iTrend[i] === 1) {
        markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#2962FF', text: 'BUY' });
      } else if (iTrend[i] === -1) {
        markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#FF6D00', text: 'SELL' });
      }
    }
  }

  // Bar colors: blue in bullish trend, red/orange in bearish trend
  const barColors: BarColorData[] = [];
  const bgColors: BgColorData[] = [];
  for (let i = warmup; i < n; i++) {
    barColors.push({
      time: bars[i].time,
      color: iTrend[i] > 0 ? '#2962FF' : '#FF6D00',
    });
    bgColors.push({
      time: bars[i].time,
      color: iTrend[i] > 0 ? 'rgba(41,98,255,0.05)' : 'rgba(255,109,0,0.05)',
    });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    markers,
    barColors,
    bgColors,
  };
}

export const FollowLine = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
