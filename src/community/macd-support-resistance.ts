/**
 * MACD Support and Resistance [ChartPrime]
 *
 * Standard MACD (fast=12, slow=26, signal=9) with dynamic support/resistance levels.
 * On MACD crossunder signal: highest high in last 6 bars becomes a RESISTANCE level.
 * On MACD crossover signal: lowest low in last 6 bars becomes a SUPPORT level.
 * Levels are removed when price crosses through them. Max 20 levels.
 *
 * Sub-panel indicator (overlay: false) for MACD histogram/signal.
 * S/R lines are output as overlay drawing primitives.
 *
 * Reference: TradingView "MACD Support and Resistance [ChartPrime]" by ChartPrime
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, LineDrawingData, LabelData } from '../types';

export interface MacdSupportResistanceInputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
  oscMaType: 'EMA' | 'SMA';
  sigMaType: 'EMA' | 'SMA';
}

export const defaultInputs: MacdSupportResistanceInputs = {
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  oscMaType: 'EMA',
  sigMaType: 'EMA',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Smoothing', defval: 9, min: 1, max: 50 },
  { id: 'oscMaType', type: 'string', title: 'Oscillator MA Type', defval: 'EMA', options: ['EMA', 'SMA'] },
  { id: 'sigMaType', type: 'string', title: 'Signal Line MA Type', defval: 'EMA', options: ['EMA', 'SMA'] },
];

export const plotConfig: PlotConfig[] = [
  { id: 'signal', title: 'Signal', color: '#FF6D00', lineWidth: 2 },
  { id: 'localHigh', title: 'Local High', color: '#787B86', lineWidth: 1 },
  { id: 'localLow', title: 'Local Low', color: '#787B86', lineWidth: 1 },
];

export const metadata = {
  title: 'MACD Support and Resistance [ChartPrime]',
  shortTitle: 'MACD S/R',
  overlay: false,
};

interface Level {
  isSupport: boolean;
  price: number;
  startIdx: number;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MacdSupportResistanceInputs> = {},
): IndicatorResult & { lines: LineDrawingData[]; labels: LabelData[]; markers: MarkerData[] } {
  const { fastLength, slowLength, signalLength, oscMaType, sigMaType } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeSeries = new Series(bars, (b) => b.close);

  // MACD calculation
  const fastMaArr = (oscMaType === 'SMA'
    ? ta.sma(closeSeries, fastLength)
    : ta.ema(closeSeries, fastLength)
  ).toArray();

  const slowMaArr = (oscMaType === 'SMA'
    ? ta.sma(closeSeries, slowLength)
    : ta.ema(closeSeries, slowLength)
  ).toArray();

  const macdArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const f = fastMaArr[i];
    const s = slowMaArr[i];
    macdArr[i] = (f != null && s != null) ? (f as number) - (s as number) : NaN;
  }

  const macdSeries = new Series(bars, (_b, i) => macdArr[i]);
  const signalArr = (sigMaType === 'SMA'
    ? ta.sma(macdSeries, signalLength)
    : ta.ema(macdSeries, signalLength)
  ).toArray().map(v => v != null ? v as number : NaN);

  // Highest MACD and lowest MACD over 100 bars for local high/low dashed lines
  const macdHighArr = ta.highest(macdSeries, 100).toArray();
  const macdLowArr = ta.lowest(macdSeries, 100).toArray();

  // Track S/R levels
  const levels: Level[] = [];
  const lines: LineDrawingData[] = [];
  const labels: LabelData[] = [];
  const markers: MarkerData[] = [];

  const warmup = slowLength;
  const colUp = '#2962FF';
  const colDn = '#FF6D00';

  for (let i = 1; i < n; i++) {
    if (isNaN(macdArr[i]) || isNaN(signalArr[i]) || isNaN(macdArr[i - 1]) || isNaN(signalArr[i - 1])) continue;

    const prevMacd = macdArr[i - 1];
    const prevSignal = signalArr[i - 1];
    const curMacd = macdArr[i];
    const curSignal = signalArr[i];

    // Crossunder: MACD crosses below signal → RESISTANCE (highest high in last 6 bars)
    if (prevMacd >= prevSignal && curMacd < curSignal) {
      let maxHigh = -Infinity;
      let maxIdx = i;
      for (let j = 0; j <= 5 && i - j >= 0; j++) {
        if (bars[i - j].high > maxHigh) {
          maxHigh = bars[i - j].high;
          maxIdx = i - j;
        }
      }
      levels.push({ isSupport: false, price: maxHigh, startIdx: maxIdx });

      markers.push({
        time: bars[i].time,
        position: 'inBar',
        shape: 'diamond',
        color: curMacd > curSignal ? colUp : colDn,
        text: 'DN',
        size: 1,
      });
    }

    // Crossover: MACD crosses above signal → SUPPORT (lowest low in last 6 bars)
    if (prevMacd <= prevSignal && curMacd > curSignal) {
      let minLow = Infinity;
      let minIdx = i;
      for (let j = 0; j <= 5 && i - j >= 0; j++) {
        if (bars[i - j].low < minLow) {
          minLow = bars[i - j].low;
          minIdx = i - j;
        }
      }
      levels.push({ isSupport: true, price: minLow, startIdx: minIdx });

      markers.push({
        time: bars[i].time,
        position: 'inBar',
        shape: 'diamond',
        color: curMacd > curSignal ? colUp : colDn,
        text: 'UP',
        size: 1,
      });
    }

    // Trim to max 20 levels
    while (levels.length > 20) {
      levels.shift();
    }

    // Remove crossed levels (iterate backward so removal doesn't skip entries)
    for (let k = levels.length - 1; k >= 0; k--) {
      const lv = levels[k];
      if (i <= lv.startIdx) continue;
      if (lv.isSupport && bars[i].low < lv.price) {
        levels.splice(k, 1);
      } else if (!lv.isSupport && bars[i].high > lv.price) {
        levels.splice(k, 1);
      }
    }
  }

  // Draw remaining levels as lines from their start bar to last bar
  for (const lv of levels) {
    const col = lv.isSupport ? colUp : colDn;
    lines.push({
      time1: bars[lv.startIdx].time,
      price1: lv.price,
      time2: bars[n - 1].time,
      price2: lv.price,
      color: col,
      width: 1,
      style: 'solid',
    });
    // Diamond label at start
    labels.push({
      time: bars[lv.startIdx].time,
      price: lv.price,
      text: '',
      color: col,
      style: 'label_center',
      size: 'tiny',
    });
    // Price label at end
    labels.push({
      time: bars[n - 1].time,
      price: lv.price,
      text: lv.price.toFixed(2),
      color: col,
      textColor: '#FFFFFF',
      style: 'label_left',
      size: 'small',
    });
  }

  // Build plots
  const signalPlot = signalArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
    color: macdArr[i] > v ? colUp : colDn,
  }));

  // Local high/low as dashed lines (skip every bar where i%5==0 || i%4==0 || i%3==0 to create dashes)
  const localHighPlot = macdHighArr.map((v, i) => {
    const skip = i % 5 === 0 || i % 4 === 0 || i % 3 === 0;
    return { time: bars[i].time, value: (i < warmup || skip || v == null) ? NaN : v as number };
  });
  const localLowPlot = macdLowArr.map((v, i) => {
    const skip = i % 5 === 0 || i % 4 === 0 || i % 3 === 0;
    return { time: bars[i].time, value: (i < warmup || skip || v == null) ? NaN : v as number };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      signal: signalPlot,
      localHigh: localHighPlot,
      localLow: localLowPlot,
    },
    lines,
    labels,
    markers,
  };
}

export const MacdSupportResistance = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
