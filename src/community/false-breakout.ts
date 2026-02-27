/**
 * False Breakout (Expo)
 *
 * Detects false breakouts by identifying new highs/lows followed by
 * price reversal (crossing back through the breakout level).
 * A false breakout up occurs when price makes consecutive new highs
 * then crosses below the breakout level. Vice versa for down.
 * Draws horizontal lines from breakout bar to current bar at breakout price level.
 *
 * Reference: TradingView "False Breakout (Expo)" by Zeiierman
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, LineDrawingData } from '../types';

export interface FalseBreakoutInputs {
  period: number;
  minPeriod: number;
  maxPeriod: number;
  maType: 'none' | 'WMA' | 'HMA';
  smoothLength: number;
  aggressive: boolean;
}

export const defaultInputs: FalseBreakoutInputs = {
  period: 20,
  minPeriod: 5,
  maxPeriod: 5,
  maType: 'none',
  smoothLength: 10,
  aggressive: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'period', type: 'int', title: 'False Breakout Period', defval: 20, min: 2 },
  { id: 'minPeriod', type: 'int', title: 'New Breakout within min X bars', defval: 5, min: 0 },
  { id: 'maxPeriod', type: 'int', title: 'Signal valid for X bars', defval: 5, min: 1 },
  { id: 'maType', type: 'string', title: 'Smoothing Type', defval: 'none', options: ['none', 'WMA', 'HMA'] },
  { id: 'smoothLength', type: 'int', title: 'Smoothing Length', defval: 10, min: 1 },
  { id: 'aggressive', type: 'bool', title: 'Aggressive', defval: false },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'False Breakout (Expo)',
  shortTitle: 'FalseBrk',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<FalseBreakoutInputs> = {}): IndicatorResult & { markers: MarkerData[]; lines: LineDrawingData[] } {
  const { period, minPeriod, maxPeriod, maType, smoothLength, aggressive } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // Build source series for highest/lowest
  // aggressive: highest uses low, lowest uses high (tighter detection)
  const hiSrcSeries = aggressive
    ? new Series(bars, (b) => b.low)
    : new Series(bars, (b) => b.high);
  const loSrcSeries = aggressive
    ? new Series(bars, (b) => b.high)
    : new Series(bars, (b) => b.low);

  // ta.highest / ta.lowest over period
  const hiRawArr = ta.highest(hiSrcSeries, period).toArray();
  const loRawArr = ta.lowest(loSrcSeries, period).toArray();

  // Apply optional smoothing
  let hiArr: number[];
  let loArr: number[];

  if (maType === 'WMA') {
    const hiSeries = new Series(bars, (_b, i) => (hiRawArr[i] != null ? hiRawArr[i] as number : NaN));
    const loSeries = new Series(bars, (_b, i) => (loRawArr[i] != null ? loRawArr[i] as number : NaN));
    hiArr = ta.wma(hiSeries, smoothLength).toArray().map(v => v != null ? v : NaN);
    loArr = ta.wma(loSeries, smoothLength).toArray().map(v => v != null ? v : NaN);
  } else if (maType === 'HMA') {
    const hiSeries = new Series(bars, (_b, i) => (hiRawArr[i] != null ? hiRawArr[i] as number : NaN));
    const loSeries = new Series(bars, (_b, i) => (loRawArr[i] != null ? loRawArr[i] as number : NaN));
    hiArr = ta.hma(hiSeries, smoothLength).toArray().map(v => v != null ? v : NaN);
    loArr = ta.hma(loSeries, smoothLength).toArray().map(v => v != null ? v : NaN);
  } else {
    hiArr = hiRawArr.map(v => v != null ? v as number : NaN);
    loArr = loRawArr.map(v => v != null ? v as number : NaN);
  }

  // Detect new high/low conditions:
  // condHi = hi > hi[1] and hi[1] <= hi[2]  (transition to new high)
  // condLo = lo < lo[1] and lo[1] >= lo[2]  (transition to new low)
  const condHi: boolean[] = new Array(n).fill(false);
  const condLo: boolean[] = new Array(n).fill(false);

  for (let i = 2; i < n; i++) {
    if (!isNaN(hiArr[i]) && !isNaN(hiArr[i - 1]) && !isNaN(hiArr[i - 2])) {
      condHi[i] = hiArr[i] > hiArr[i - 1] && hiArr[i - 1] <= hiArr[i - 2];
    }
    if (!isNaN(loArr[i]) && !isNaN(loArr[i - 1]) && !isNaN(loArr[i - 2])) {
      condLo[i] = loArr[i] < loArr[i - 1] && loArr[i - 1] >= loArr[i - 2];
    }
  }

  // State tracking
  let val = NaN;
  let prevVal = NaN; // val[1] in Pine: previous bar's final val for crossunder/crossover
  let count = 0;
  let indx0 = 0; // most recent breakout bar
  let indx1 = 0; // previous breakout bar

  const markers: MarkerData[] = [];
  const lines: LineDrawingData[] = [];
  const warmup = period + 2;

  for (let i = 0; i < n; i++) {
    // Track new highs (count goes negative)
    if (condHi[i]) {
      if (count > 0) count = 0;
      count = count - 1;
      val = bars[i].low;
      indx1 = indx0;
      indx0 = i;
    }

    // Track new lows (count goes positive)
    if (condLo[i]) {
      if (count < 0) count = 0;
      count = count + 1;
      val = bars[i].high;
      indx1 = indx0;
      indx0 = i;
    }

    if (i < warmup || isNaN(val)) {
      prevVal = val;
      continue;
    }

    const c = bars[i].close;
    const prevClose = i > 0 ? bars[i - 1].close : NaN;

    // Crossunder: close crosses below val (Pine: ta.crossunder(c, val))
    // Uses current val for current bar, prevVal for previous bar comparison
    const breakdown = !isNaN(prevClose) && !isNaN(prevVal) && prevClose >= prevVal && c < val;
    // Crossover: close crosses above val (Pine: ta.crossover(c, val))
    const breakup = !isNaN(prevClose) && !isNaN(prevVal) && prevClose <= prevVal && c > val;

    // Min bars between breakouts
    const minbars = indx1 + minPeriod < indx0;
    // Signal still valid (within maxPeriod bars of last breakout)
    const maxvalid = i - maxPeriod <= indx0;

    // False breakout up: multiple new highs (count < -1), then price breaks down
    const falsebreakoutup = count < -1 && breakdown && maxvalid && minbars;
    // False breakout down: multiple new lows (count > 1), then price breaks up
    const falsebreakoutdown = count > 1 && breakup && maxvalid && minbars;

    if (falsebreakoutup) {
      count = 0;
      markers.push({
        time: bars[i].time as number,
        position: 'aboveBar',
        shape: 'triangleDown',
        color: '#f23645',
        text: 'False Up',
      });
      lines.push({
        time1: bars[indx0].time,
        price1: val,
        time2: bars[i].time,
        price2: val,
        color: '#f23645',
        width: 2,
        style: 'solid',
      });
    }

    if (falsebreakoutdown) {
      count = 0;
      markers.push({
        time: bars[i].time as number,
        position: 'belowBar',
        shape: 'triangleUp',
        color: '#6ce5a0',
        text: 'False Down',
      });
      lines.push({
        time1: bars[indx0].time,
        price1: val,
        time2: bars[i].time,
        price2: val,
        color: '#6ce5a0',
        width: 2,
        style: 'solid',
      });
    }

    prevVal = val;
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    lines,
  };
}

export const FalseBreakout = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
