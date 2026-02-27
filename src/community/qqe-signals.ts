/**
 * QQE Signals
 *
 * Overlay indicator that shows Long/Short plotshape markers based on QQE crosses.
 * RSI is smoothed with EMA, then a Wilder-style ATR trailing stop is computed on
 * the smoothed RSI. When RSI crosses the trailing stop, a signal fires.
 *
 * Pine display elements:
 *   - plotshape: "QQE long"  (labelup, belowbar, green, text "Long", textcolor white)
 *   - plotshape: "QQE short" (labeldown, abovebar, red, text "Short", textcolor white)
 *
 * Reference: TradingView "QQE signals" by colinmck
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface QQESignalsInputs {
  rsiLen: number;
  smoothFactor: number;
  qqeFactor: number;
  threshHold: number;
}

export const defaultInputs: QQESignalsInputs = {
  rsiLen: 14,
  smoothFactor: 5,
  qqeFactor: 4.238,
  threshHold: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'smoothFactor', type: 'int', title: 'RSI Smoothing', defval: 5, min: 1 },
  { id: 'qqeFactor', type: 'float', title: 'Fast QQE Factor', defval: 4.238, min: 0.01, step: 0.001 },
  { id: 'threshHold', type: 'int', title: 'Thresh-hold', defval: 10, min: 0 },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'QQE Signals',
  shortTitle: 'QQESig',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<QQESignalsInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { rsiLen, smoothFactor, qqeFactor } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const wildersLen = rsiLen * 2 - 1;

  // Pine: src = close
  const closeSeries = new Series(bars, (b) => b.close);

  // Pine: Rsi = rsi(src, RSI_Period)
  const rsi = ta.rsi(closeSeries, rsiLen);

  // Pine: RsiMa = ema(Rsi, SF)
  const rsiMa = ta.ema(rsi, smoothFactor);
  const rsiMaArr = rsiMa.toArray();

  // Pine: AtrRsi = abs(RsiMa[1] - RsiMa)
  const atrRsiRaw: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const prev = i > 0 ? (rsiMaArr[i - 1] ?? 0) : 0;
    const cur = rsiMaArr[i] ?? 0;
    atrRsiRaw[i] = Math.abs(prev - cur);
  }

  // Pine: MaAtrRsi = ema(AtrRsi, Wilders_Period)
  const atrRsiSeries = Series.fromArray(bars, atrRsiRaw);
  const maAtrRsi = ta.ema(atrRsiSeries, wildersLen);

  // Pine: dar = ema(MaAtrRsi, Wilders_Period) * QQE
  const darSeries = ta.ema(maAtrRsi, wildersLen);
  const darArr = darSeries.toArray();

  // Trailing stop bands
  const longBand: number[] = new Array(n);
  const shortBand: number[] = new Array(n);
  const trendDir: number[] = new Array(n);
  const trailing: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const rsIndex = rsiMaArr[i] ?? 0;
    const dar = (darArr[i] ?? 0) * qqeFactor;
    const newLongBand = rsIndex - dar;
    const newShortBand = rsIndex + dar;

    if (i === 0) {
      longBand[i] = newLongBand;
      shortBand[i] = newShortBand;
      trendDir[i] = 1;
    } else {
      const prevRsIndex = rsiMaArr[i - 1] ?? 0;

      // Pine: longband := RSIndex[1] > longband[1] and RSIndex > longband[1] ? max(longband[1], newlongband) : newlongband
      longBand[i] = (prevRsIndex > longBand[i - 1] && rsIndex > longBand[i - 1])
        ? Math.max(longBand[i - 1], newLongBand)
        : newLongBand;

      // Pine: shortband := RSIndex[1] < shortband[1] and RSIndex < shortband[1] ? min(shortband[1], newshortband) : newshortband
      shortBand[i] = (prevRsIndex < shortBand[i - 1] && rsIndex < shortBand[i - 1])
        ? Math.min(shortBand[i - 1], newShortBand)
        : newShortBand;

      // Pine: cross_1 = cross(longband[1], RSIndex)
      // cross(a, b) = (a[1] <= b[1] and a > b) or (a[1] >= b[1] and a < b)
      // a = longband[1] => at bar i: a = longband[i-1], a[1] = longband[i-2]
      // b = RSIndex     => at bar i: b = RSIndex[i],     b[1] = RSIndex[i-1]
      let crossLongRsi = false;
      if (i >= 2) {
        crossLongRsi = (longBand[i - 2] <= prevRsIndex && longBand[i - 1] > rsIndex)
          || (longBand[i - 2] >= prevRsIndex && longBand[i - 1] < rsIndex);
      }

      // Pine: cross(RSIndex, shortband[1])
      // a = RSIndex     => at bar i: a = RSIndex[i],     a[1] = RSIndex[i-1]
      // b = shortband[1]=> at bar i: b = shortband[i-1], b[1] = shortband[i-2]
      let crossRsiShort = false;
      if (i >= 2) {
        crossRsiShort = (prevRsIndex <= shortBand[i - 2] && rsIndex > shortBand[i - 1])
          || (prevRsIndex >= shortBand[i - 2] && rsIndex < shortBand[i - 1]);
      }

      // Pine: trend := cross(RSIndex, shortband[1]) ? 1 : cross_1 ? -1 : nz(trend[1], 1)
      if (crossRsiShort) {
        trendDir[i] = 1;
      } else if (crossLongRsi) {
        trendDir[i] = -1;
      } else {
        trendDir[i] = trendDir[i - 1];
      }
    }

    // Pine: FastAtrRsiTL = trend == 1 ? longband : shortband
    trailing[i] = trendDir[i] === 1 ? longBand[i] : shortBand[i];
  }

  // Pine: QQE cross count
  // QQExlong := FastAtrRsiTL < RSIndex ? QQExlong + 1 : 0
  // QQExshort := FastAtrRsiTL > RSIndex ? QQExshort + 1 : 0
  const qqeXlong: number[] = new Array(n).fill(0);
  const qqeXshort: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const rsIndex = rsiMaArr[i] ?? 0;
    qqeXlong[i] = trailing[i] < rsIndex ? qqeXlong[i - 1] + 1 : 0;
    qqeXshort[i] = trailing[i] > rsIndex ? qqeXshort[i - 1] + 1 : 0;
  }

  // Pine: qqeLong = QQExlong == 1 ? FastAtrRsiTL[1] - 50 : na
  //        qqeShort = QQExshort == 1 ? FastAtrRsiTL[1] - 50 : na
  // plotshape fires when value is not na, so condition is QQExlong == 1
  const warmup = wildersLen + smoothFactor;

  const markers: MarkerData[] = [];
  for (let i = warmup; i < n; i++) {
    if (qqeXlong[i] === 1) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#4CAF50', text: 'Long' });
    }
    if (qqeXshort[i] === 1) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#FF5252', text: 'Short' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
  };
}

export const QQESignals = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
