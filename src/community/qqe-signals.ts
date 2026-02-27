/**
 * QQE Signals
 *
 * Overlay indicator that shows only Long/Short plotshape markers.
 * No RSI or trailing lines are displayed - only the signal markers on the price chart.
 *
 * Reference: TradingView "QQE signals" by colinmck
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface QQESignalsInputs {
  rsiLen: number;
  smoothFactor: number;
  qqeFactor: number;
  src: SourceType;
}

export const defaultInputs: QQESignalsInputs = {
  rsiLen: 14,
  smoothFactor: 5,
  qqeFactor: 4.238,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'smoothFactor', type: 'int', title: 'RSI Smoothing', defval: 5, min: 1 },
  { id: 'qqeFactor', type: 'float', title: 'Fast QQE Factor', defval: 4.238, min: 0.01, step: 0.001 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'QQE Signals',
  shortTitle: 'QQESig',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<QQESignalsInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { rsiLen, smoothFactor, qqeFactor, src } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const wildersLen = rsiLen * 2 - 1;

  const source = getSourceSeries(bars, src);
  const rsi = ta.rsi(source, rsiLen);
  const smoothedRsi = ta.ema(rsi, smoothFactor);
  const srArr = smoothedRsi.toArray();

  // ATR of RSI
  const atrRsiRaw: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const prev = i > 0 ? (srArr[i - 1] ?? 0) : 0;
    const cur = srArr[i] ?? 0;
    atrRsiRaw[i] = Math.abs(cur - prev);
  }
  const atrRsiSeries = Series.fromArray(bars, atrRsiRaw);
  const maAtrRsi = ta.ema(atrRsiSeries, wildersLen);
  const dar = ta.ema(maAtrRsi, wildersLen);
  const darArr = dar.toArray();

  // Trailing stop bands
  const longBand: number[] = new Array(n);
  const shortBand: number[] = new Array(n);
  const trendDir: number[] = new Array(n);
  const trailing: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const sr = srArr[i] ?? 0;
    const prevSr = i > 0 ? (srArr[i - 1] ?? 0) : 0;
    const deltaFast = (darArr[i] ?? 0) * qqeFactor;
    const newLong = sr - deltaFast;
    const newShort = sr + deltaFast;

    if (i === 0) {
      longBand[i] = newLong;
      shortBand[i] = newShort;
      trendDir[i] = 1;
    } else {
      longBand[i] = (prevSr > longBand[i - 1] && sr > longBand[i - 1])
        ? Math.max(longBand[i - 1], newLong)
        : newLong;
      shortBand[i] = (prevSr < shortBand[i - 1] && sr < shortBand[i - 1])
        ? Math.min(shortBand[i - 1], newShort)
        : newShort;

      // Pine: trend := cross(RSIndex, shortband[1]) ? 1 : cross_1 ? -1 : nz(trend[1], 1)
      const crossUp = (prevSr <= shortBand[i - 1] && sr > shortBand[i - 1]) || (prevSr >= shortBand[i - 1] && sr < shortBand[i - 1]);
      const crossDown = (prevSr <= longBand[i - 1] && sr > longBand[i - 1]) || (prevSr >= longBand[i - 1] && sr < longBand[i - 1]);

      // Pine uses cross(RSIndex, shortband[1]) for trend=1 and cross(longband[1], RSIndex) for trend=-1
      const crossRsiShort = (prevSr < shortBand[i - 1] && sr >= shortBand[i - 1]) || (prevSr > shortBand[i - 1] && sr <= shortBand[i - 1]);
      const crossLongRsi = (longBand[i - 1] < prevSr && longBand[i - 1] >= sr) || (longBand[i - 1] > prevSr && longBand[i - 1] <= sr);

      if (crossRsiShort) {
        trendDir[i] = 1;
      } else if (crossLongRsi) {
        trendDir[i] = -1;
      } else {
        trendDir[i] = trendDir[i - 1];
      }
    }
    trailing[i] = trendDir[i] === 1 ? longBand[i] : shortBand[i];
  }

  // QQE cross count
  const qqeXlong: number[] = new Array(n).fill(0);
  const qqeXshort: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const sr = srArr[i] ?? 0;
    if (i > 0) {
      qqeXlong[i] = trailing[i] < sr ? qqeXlong[i - 1] + 1 : 0;
      qqeXshort[i] = trailing[i] > sr ? qqeXshort[i - 1] + 1 : 0;
    }
  }

  const warmup = rsiLen * 2 + smoothFactor;

  // Pine: plotshape for Long when QQExlong == 1, Short when QQExshort == 1
  const markers: MarkerData[] = [];
  for (let i = warmup; i < n; i++) {
    if (qqeXlong[i] === 1) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#00FF00', text: 'Long' });
    }
    if (qqeXshort[i] === 1) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#FF0000', text: 'Short' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
  };
}

export const QQESignals = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
