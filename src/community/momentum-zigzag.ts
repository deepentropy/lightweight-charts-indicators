/**
 * Momentum-based ZigZag (incl. QQE) NON-REPAINTING
 *
 * Non-repainting ZigZag that switches direction based on momentum signals
 * from MACD, Moving Average, or QQE. ZigZag tracks peaks/bottoms;
 * momentum determines direction changes. Force detection via RSI(5).
 *
 * Reference: TradingView "Momentum-based ZigZag (incl. QQE) NON-REPAINTING" by Peter_O
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface MomentumZigZagInputs {
  momentumSelect: string;
  colorLines: boolean;
  fastLength: number;
  slowLength: number;
  signalLength: number;
  macdOscType: string;
  macdSigType: string;
  maType: string;
  maLength: number;
  rsiPeriod: number;
  qqeFactor: number;
  rsiSmoothing: number;
  qqeThreshold: number;
}

export const defaultInputs: MomentumZigZagInputs = {
  momentumSelect: 'QQE',
  colorLines: true,
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  macdOscType: 'EMA',
  macdSigType: 'EMA',
  maType: 'SMA',
  maLength: 20,
  rsiPeriod: 14,
  qqeFactor: 4.238,
  rsiSmoothing: 5,
  qqeThreshold: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'momentumSelect', type: 'string', title: 'Select Momentum Indicator', defval: 'QQE', options: ['MACD', 'MovingAverage', 'QQE'] },
  { id: 'colorLines', type: 'bool', title: 'Color ZigZag lines to show force direction', defval: true },
  { id: 'fastLength', type: 'int', title: 'MACD Fast Length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'MACD Slow Length', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'MACD Signal Smoothing', defval: 9, min: 1 },
  { id: 'macdOscType', type: 'string', title: 'MACD Oscillator MA Type', defval: 'EMA', options: ['SMA', 'EMA'] },
  { id: 'macdSigType', type: 'string', title: 'MACD Signal MA Type', defval: 'EMA', options: ['SMA', 'EMA'] },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'SMA', options: ['EMA', 'SMA', 'WMA', 'HMA', 'RMA'] },
  { id: 'maLength', type: 'int', title: 'MA Length', defval: 20, min: 1 },
  { id: 'rsiPeriod', type: 'int', title: 'QQE RSI Length', defval: 14, min: 1 },
  { id: 'qqeFactor', type: 'float', title: 'QQE Factor', defval: 4.238, min: 0.001, step: 0.001 },
  { id: 'rsiSmoothing', type: 'int', title: 'QQE RSI Smoothing', defval: 5, min: 1 },
  { id: 'qqeThreshold', type: 'int', title: 'QQE Threshold', defval: 10, min: 0 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ZigZag', color: '#000000', lineWidth: 5 },
];

export const metadata = {
  title: 'Momentum-based ZigZag',
  shortTitle: 'MomZZ',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<MomentumZigZagInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeSeries = new Series(bars, (b) => b.close);
  const closeArr = closeSeries.toArray();
  const highArr = new Series(bars, (b) => b.high).toArray();
  const lowArr = new Series(bars, (b) => b.low).toArray();

  // --- Momentum UP/DOWN signals ---
  const momentumUp: boolean[] = new Array(n).fill(false);
  const momentumDown: boolean[] = new Array(n).fill(false);

  if (cfg.momentumSelect === 'MACD') {
    // MACD
    const fastMa = cfg.macdOscType === 'SMA'
      ? ta.sma(closeSeries, cfg.fastLength).toArray()
      : ta.ema(closeSeries, cfg.fastLength).toArray();
    const slowMa = cfg.macdOscType === 'SMA'
      ? ta.sma(closeSeries, cfg.slowLength).toArray()
      : ta.ema(closeSeries, cfg.slowLength).toArray();

    const macdLine: number[] = new Array(n);
    for (let i = 0; i < n; i++) {
      macdLine[i] = (fastMa[i] ?? 0) - (slowMa[i] ?? 0);
    }

    const macdSeries = Series.fromArray(bars, macdLine);
    const signalArr = cfg.macdSigType === 'SMA'
      ? ta.sma(macdSeries, cfg.signalLength).toArray()
      : ta.ema(macdSeries, cfg.signalLength).toArray();

    // Crossover/crossunder
    for (let i = 1; i < n; i++) {
      const m = macdLine[i];
      const mPrev = macdLine[i - 1];
      const s = signalArr[i] ?? 0;
      const sPrev = signalArr[i - 1] ?? 0;
      if (mPrev <= sPrev && m > s) momentumUp[i] = true;
      if (mPrev >= sPrev && m < s) momentumDown[i] = true;
    }
  } else if (cfg.momentumSelect === 'MovingAverage') {
    // Moving Average direction change
    let maArr: number[];
    switch (cfg.maType) {
      case 'EMA': maArr = ta.ema(closeSeries, cfg.maLength).toArray(); break;
      case 'WMA': maArr = ta.wma(closeSeries, cfg.maLength).toArray(); break;
      case 'HMA': maArr = ta.hma(closeSeries, cfg.maLength).toArray(); break;
      case 'RMA': maArr = ta.rma(closeSeries, cfg.maLength).toArray(); break;
      default: maArr = ta.sma(closeSeries, cfg.maLength).toArray(); break;
    }
    // Pine: maUP = ma > ma[1] and ma[2] > ma[1] (trough detection)
    // maDOWN = ma < ma[1] and ma[2] < ma[1] (peak detection)
    for (let i = 2; i < n; i++) {
      const cur = maArr[i] ?? 0;
      const prev = maArr[i - 1] ?? 0;
      const prev2 = maArr[i - 2] ?? 0;
      if (cur > prev && prev2 > prev) momentumUp[i] = true;
      if (cur < prev && prev2 < prev) momentumDown[i] = true;
    }
  } else {
    // QQE
    const rsiArr = ta.rsi(closeSeries, cfg.rsiPeriod).toArray();
    const rsiSeries = Series.fromArray(bars, rsiArr.map(v => v ?? 50));
    const rsiMaArr = ta.ema(rsiSeries, cfg.rsiSmoothing).toArray();

    const wildPeriod = cfg.rsiPeriod * 2 - 1;

    // AtrRsi = abs(RsiMa[1] - RsiMa)
    const atrRsi: number[] = new Array(n).fill(0);
    for (let i = 1; i < n; i++) {
      atrRsi[i] = Math.abs((rsiMaArr[i - 1] ?? 50) - (rsiMaArr[i] ?? 50));
    }
    const atrRsiSeries = Series.fromArray(bars, atrRsi);
    const maAtrRsiArr = ta.ema(atrRsiSeries, wildPeriod).toArray();
    const maAtrRsiSeries = Series.fromArray(bars, maAtrRsiArr.map(v => v ?? 0));
    const darArr = ta.ema(maAtrRsiSeries, wildPeriod).toArray();

    const longband: number[] = new Array(n).fill(0);
    const shortband: number[] = new Array(n).fill(0);
    const trend: number[] = new Array(n).fill(1);
    const qqeLong: number[] = new Array(n).fill(0);
    const qqeShort: number[] = new Array(n).fill(0);

    // Track last QQE high/low for breakout detection
    const lastQqeHigh: number[] = new Array(n).fill(0);
    const lastQqeLow: number[] = new Array(n).fill(0);

    for (let i = 1; i < n; i++) {
      const dar = (darArr[i] ?? 0) * cfg.qqeFactor;
      const rsiIndex = rsiMaArr[i] ?? 50;
      const rsiIndexPrev = rsiMaArr[i - 1] ?? 50;

      const newLongband = rsiIndex - dar;
      const newShortband = rsiIndex + dar;

      longband[i] = rsiIndexPrev > longband[i - 1] && rsiIndex > longband[i - 1]
        ? Math.max(longband[i - 1], newLongband)
        : newLongband;

      shortband[i] = rsiIndexPrev < shortband[i - 1] && rsiIndex < shortband[i - 1]
        ? Math.min(shortband[i - 1], newShortband)
        : newShortband;

      // Determine barssince for qqeLong/qqeShort
      let barsSinceUp = n;
      let barsSinceDown = n;
      for (let j = i - 1; j >= 0; j--) {
        if (qqeLong[j] === 1) { barsSinceUp = i - j; break; }
      }
      for (let j = i - 1; j >= 0; j--) {
        if (qqeShort[j] === 1) { barsSinceDown = i - j; break; }
      }

      const goingUp = barsSinceUp < barsSinceDown;
      const goingDown = barsSinceUp > barsSinceDown;

      let prevGoingUp = false;
      let prevGoingDown = false;
      if (i >= 2) {
        let bsU2 = n, bsD2 = n;
        for (let j = i - 2; j >= 0; j--) {
          if (qqeLong[j] === 1) { bsU2 = i - 1 - j; break; }
        }
        for (let j = i - 2; j >= 0; j--) {
          if (qqeShort[j] === 1) { bsD2 = i - 1 - j; break; }
        }
        prevGoingUp = bsU2 < bsD2;
        prevGoingDown = bsU2 > bsD2;
      }

      // Track last QQE high/low
      lastQqeHigh[i] = (highArr[i] > lastQqeHigh[i - 1] && goingUp) || (prevGoingDown && goingUp)
        ? highArr[i]
        : lastQqeHigh[i - 1] || highArr[i];

      lastQqeLow[i] = (lowArr[i] < lastQqeLow[i - 1] && goingDown) || (prevGoingUp && goingDown)
        ? lowArr[i]
        : lastQqeLow[i - 1] || lowArr[i];

      // Trend
      const crossOverShort = rsiIndex > shortband[i - 1] && rsiIndexPrev <= shortband[i - 1];
      const crossUnderLong = rsiIndex < longband[i - 1] && rsiIndexPrev >= longband[i - 1];
      const breakHigh = highArr[i] > lastQqeHigh[i - 1] && (i < 2 || highArr[i - 1] <= lastQqeHigh[i - 2]);
      const breakLow = lowArr[i] < lastQqeLow[i - 1] && (i < 2 || lowArr[i - 1] >= lastQqeLow[i - 2]);

      if (crossOverShort || breakHigh) {
        trend[i] = 1;
      } else if (crossUnderLong || breakLow) {
        trend[i] = -1;
      } else {
        trend[i] = trend[i - 1];
      }

      // QQE crosses
      qqeLong[i] = trend[i] === 1 && trend[i - 1] === -1 ? 1 : 0;
      qqeShort[i] = trend[i] === -1 && trend[i - 1] === 1 ? 1 : 0;
    }

    for (let i = 0; i < n; i++) {
      if (qqeLong[i] === 1) momentumUp[i] = true;
      if (qqeShort[i] === 1) momentumDown[i] = true;
    }
  }

  // --- Momentum direction ---
  const momDir: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (momentumUp[i]) momDir[i] = 1;
    else if (momentumDown[i]) momDir[i] = -1;
    else momDir[i] = i > 0 ? momDir[i - 1] : 0;
  }

  // --- Force detection (RSI 5) ---
  const rsi5Arr = ta.rsi(closeSeries, 5).toArray();
  const ob = 80;
  const os = 20;

  // barssince helpers
  function barsSince(arr: boolean[], from: number): number {
    for (let j = from; j >= 0; j--) {
      if (arr[j]) return from - j;
    }
    return from + 1; // never found
  }

  function barsSinceRsiAbove(rsiArr: (number | undefined)[], threshold: number, from: number): number {
    for (let j = from; j >= 0; j--) {
      if ((rsiArr[j] ?? 0) > threshold) return from - j;
    }
    return from + 1;
  }

  function barsSinceRsiBelow(rsiArr: (number | undefined)[], threshold: number, from: number): number {
    for (let j = from; j >= 0; j--) {
      if ((rsiArr[j] ?? 0) < threshold) return from - j;
    }
    return from + 1;
  }

  const forceUpColor: string[] = new Array(n).fill('#808080'); // gray default

  for (let i = 1; i < n; i++) {
    if (momentumDown[i]) {
      // Was force up: barssince(momentumUP) >= barssince(rsi5 > ob) at [i-1]
      const bsUp = barsSince(momentumUp, i - 1);
      const bsOb = barsSinceRsiAbove(rsi5Arr, ob, i - 1);
      if (bsUp >= bsOb) {
        forceUpColor[i] = '#00FF00'; // lime = force up
      }
    }
    if (momentumUp[i]) {
      // Was force down: barssince(momentumDOWN) >= barssince(rsi5 < os) at [i-1]
      const bsDown = barsSince(momentumDown, i - 1);
      const bsOs = barsSinceRsiBelow(rsi5Arr, os, i - 1);
      if (bsDown >= bsOs) {
        forceUpColor[i] = '#FF0000'; // red = force down
      }
    }
  }

  // --- ZigZag computation ---
  const zzPeak: number[] = new Array(n).fill(NaN);
  const zzBottom: number[] = new Array(n).fill(NaN);
  const zigzag: number[] = new Array(n).fill(NaN);

  for (let i = 0; i < n; i++) {
    const goingUp = momDir[i] === 1;
    const goingDown = momDir[i] === -1;
    const prevGoingUp = i > 0 ? momDir[i - 1] === 1 : false;
    const prevGoingDown = i > 0 ? momDir[i - 1] === -1 : false;

    // Peak
    if (i === 0) {
      zzPeak[i] = highArr[i];
    } else if ((highArr[i] > zzPeak[i - 1] && goingUp) || (prevGoingDown && goingUp)) {
      zzPeak[i] = highArr[i];
    } else {
      zzPeak[i] = zzPeak[i - 1] || highArr[i];
    }

    // Bottom
    if (i === 0) {
      zzBottom[i] = lowArr[i];
    } else if ((lowArr[i] < zzBottom[i - 1] && goingDown) || (prevGoingUp && goingDown)) {
      zzBottom[i] = lowArr[i];
    } else {
      zzBottom[i] = zzBottom[i - 1] || lowArr[i];
    }

    // ZigZag value
    if (i > 0) {
      if (goingUp && prevGoingDown) {
        zigzag[i] = zzBottom[i - 1];
      } else if (prevGoingUp && goingDown) {
        zigzag[i] = zzPeak[i - 1];
      }
    }
  }

  // Build connected zigzag plot line
  // Pine plots zigzag as line style - only non-NaN at direction changes, connected
  // We'll output a continuous line by interpolating between zigzag pivot points
  const pivotPoints: { idx: number; value: number }[] = [];
  for (let i = 0; i < n; i++) {
    if (!isNaN(zigzag[i])) {
      pivotPoints.push({ idx: i, value: zigzag[i] });
    }
  }

  // Build the running zigzag: at each bar, the value is either a pivot or the running extreme
  const zzLine: number[] = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    if (!isNaN(zigzag[i])) {
      zzLine[i] = zigzag[i];
    } else if (momDir[i] === 1) {
      // Going up: track peak
      zzLine[i] = zzPeak[i];
    } else if (momDir[i] === -1) {
      // Going down: track bottom
      zzLine[i] = zzBottom[i];
    } else if (i > 0) {
      zzLine[i] = zzLine[i - 1];
    }
  }

  // Determine per-bar color based on the last momentum signal's force classification
  // The color sticks from one momentum signal until the next
  const perBarColor: string[] = new Array(n).fill('#808080');
  let lastColor = '#808080';
  for (let i = 0; i < n; i++) {
    if (forceUpColor[i] !== '#808080') {
      lastColor = forceUpColor[i];
    }
    if (momentumUp[i] || momentumDown[i]) {
      if (forceUpColor[i] !== '#808080') {
        lastColor = forceUpColor[i];
      } else {
        lastColor = '#808080';
      }
    }
    perBarColor[i] = cfg.colorLines ? lastColor : '#000000';
  }

  const plot0 = zzLine.map((v, i) => ({
    time: bars[i].time,
    value: v,
    color: perBarColor[i],
  }));

  // --- Markers for LONG/SHORT ---
  const markers: MarkerData[] = [];

  // Determine force flags at each momentum signal bar
  for (let i = 1; i < n; i++) {
    if (momentumDown[i]) {
      const bsUp = barsSince(momentumUp, i - 1);
      const bsOb = barsSinceRsiAbove(rsi5Arr, ob, i - 1);
      const wasForceUp = bsUp >= bsOb;
      // GoShort = momentumDOWN and not force_up
      if (!wasForceUp && !isNaN(zigzag[i])) {
        markers.push({
          time: bars[i].time,
          position: 'aboveBar',
          shape: 'labelDown',
          color: '#FF0000',
          text: 'SHORT\npivot high:\n' + zigzag[i].toFixed(2),
        });
      }
    }
    if (momentumUp[i]) {
      const bsDown = barsSince(momentumDown, i - 1);
      const bsOs = barsSinceRsiBelow(rsi5Arr, os, i - 1);
      const wasForceDown = bsDown >= bsOs;
      // GoLong = momentumUP and not force_down
      if (!wasForceDown && !isNaN(zigzag[i])) {
        markers.push({
          time: bars[i].time,
          position: 'belowBar',
          shape: 'labelUp',
          color: '#00FF00',
          text: 'LONG\npivot low:\n' + zigzag[i].toFixed(2),
        });
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    markers,
  };
}

export const MomentumZigZag = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
