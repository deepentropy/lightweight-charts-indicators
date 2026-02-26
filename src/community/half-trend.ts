/**
 * HalfTrend
 *
 * ATR-based trend detection with amplitude-filtered state transitions.
 * Tracks highest lows / lowest highs over the amplitude period, flips direction
 * when SMA of high/low crosses these extremes and price confirms.
 *
 * Reference: TradingView "HalfTrend" by everget
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface HalfTrendInputs {
  amplitude: number;
  channelDeviation: number;
}

export const defaultInputs: HalfTrendInputs = {
  amplitude: 2,
  channelDeviation: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'amplitude', type: 'int', title: 'Amplitude', defval: 2, min: 1 },
  { id: 'channelDeviation', type: 'int', title: 'Channel Deviation', defval: 2, min: 0 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'HalfTrend', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'ATR High', color: '#EF5350', lineWidth: 1, style: 'circles' },
  { id: 'plot2', title: 'ATR Low', color: '#2962FF', lineWidth: 1, style: 'circles' },
];

export const metadata = {
  title: 'HalfTrend',
  shortTitle: 'HT',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<HalfTrendInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { amplitude, channelDeviation } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const atr2Arr = ta.atr(bars, 100).toArray();
  const highestArr = ta.highestbars(new Series(bars, (b) => b.high), amplitude).toArray();
  const lowestArr = ta.lowestbars(new Series(bars, (b) => b.low), amplitude).toArray();
  const highmaArr = ta.sma(new Series(bars, (b) => b.high), amplitude).toArray();
  const lowmaArr = ta.sma(new Series(bars, (b) => b.low), amplitude).toArray();

  const htArr: number[] = new Array(n);
  const atrHighArr: number[] = new Array(n);
  const atrLowArr: number[] = new Array(n);
  const trendArr: number[] = new Array(n);

  let trend = 0;
  let nextTrend = 0;
  let maxLowPrice = bars.length > 1 ? bars[0].low : bars[0]?.low ?? 0;
  let minHighPrice = bars.length > 1 ? bars[0].high : bars[0]?.high ?? 0;
  let up = 0;
  let down = 0;

  for (let i = 0; i < n; i++) {
    const atr2 = ((atr2Arr[i] ?? 0) / 2);
    const dev = channelDeviation * atr2;
    const hbars = Math.abs(highestArr[i] ?? 0);
    const lbars = Math.abs(lowestArr[i] ?? 0);
    const highPrice = bars[Math.max(0, i - hbars)]?.high ?? bars[i].high;
    const lowPrice = bars[Math.max(0, i - lbars)]?.low ?? bars[i].low;
    const highma = highmaArr[i] ?? bars[i].high;
    const lowma = lowmaArr[i] ?? bars[i].low;
    const prevLow = i > 0 ? bars[i - 1].low : bars[i].low;
    const prevHigh = i > 0 ? bars[i - 1].high : bars[i].high;

    if (nextTrend === 1) {
      maxLowPrice = Math.max(lowPrice, maxLowPrice);
      if (highma < maxLowPrice && bars[i].close < prevLow) {
        trend = 1;
        nextTrend = 0;
        minHighPrice = highPrice;
      }
    } else {
      minHighPrice = Math.min(highPrice, minHighPrice);
      if (lowma > minHighPrice && bars[i].close > prevHigh) {
        trend = 0;
        nextTrend = 1;
        maxLowPrice = lowPrice;
      }
    }

    trendArr[i] = trend;

    if (trend === 0) {
      up = (i === 0) ? maxLowPrice : Math.max(maxLowPrice, up);
      htArr[i] = up;
      atrHighArr[i] = up + dev;
      atrLowArr[i] = up - dev;
    } else {
      down = (i === 0) ? minHighPrice : Math.min(minHighPrice, down);
      htArr[i] = down;
      atrHighArr[i] = down + dev;
      atrLowArr[i] = down - dev;
    }
  }

  const warmup = 100; // ATR(100) warmup
  const toPlot = (arr: number[]) =>
    arr.map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : v }));

  // Dynamic HT line color: blue for uptrend (0), red for downtrend (1)
  const htPlot = htArr.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const color = trendArr[i] === 0 ? '#2962FF' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  // Markers: buy when trend flips 1→0, sell when trend flips 0→1
  const markers: MarkerData[] = [];
  for (let i = warmup; i < n; i++) {
    if (i > 0 && trendArr[i] !== trendArr[i - 1]) {
      if (trendArr[i] === 0) {
        markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#2962FF', text: 'Buy' });
      } else {
        markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#FF6D00', text: 'Sell' });
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': htPlot, 'plot1': toPlot(atrHighArr), 'plot2': toPlot(atrLowArr) },
    fills: [{ plot1: 'plot0', plot2: 'plot1' }, { plot1: 'plot0', plot2: 'plot2' }],
    markers,
  };
}

export const HalfTrend = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
