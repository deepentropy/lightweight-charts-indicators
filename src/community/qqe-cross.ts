/**
 * QQE Cross Indicator Alert v2.0
 *
 * ATR-like adaptive bands around smoothed RSI (QQE method).
 * Three types of signal crosses: QQE cross (RSI vs trailing stop),
 * zero cross (RSI vs 50), and channel cross (RSI enters OB/OS threshold).
 * Optional triple-MA filter for confirming BUY/SELL signals.
 *
 * Reference: TradingView "QQE Cross" by JustUncleL
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface QqeCrossInputs {
  rsiLength: number;
  rsiSmoothing: number;
  qqeFactor: number;
  threshold: number;
  fastMALen: number;
  medMALen: number;
  slowMALen: number;
  maType: string;
  useFilter: boolean;
}

export const defaultInputs: QqeCrossInputs = {
  rsiLength: 6,
  rsiSmoothing: 3,
  qqeFactor: 2.618,
  threshold: 10,
  fastMALen: 8,
  medMALen: 21,
  slowMALen: 34,
  maType: 'HullMA',
  useFilter: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 6, min: 1 },
  { id: 'rsiSmoothing', type: 'int', title: 'RSI Smoothing', defval: 3, min: 1 },
  { id: 'qqeFactor', type: 'float', title: 'QQE Factor', defval: 2.618, min: 0.01, step: 0.001 },
  { id: 'threshold', type: 'int', title: 'Threshold', defval: 10, min: 0 },
  { id: 'fastMALen', type: 'int', title: 'Fast MA Length', defval: 8, min: 1 },
  { id: 'medMALen', type: 'int', title: 'Medium MA Length', defval: 21, min: 1 },
  { id: 'slowMALen', type: 'int', title: 'Slow MA Length', defval: 34, min: 1 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'HullMA', options: ['SMA', 'EMA', 'WMA', 'HullMA', 'DEMA', 'SMMA'] },
  { id: 'useFilter', type: 'bool', title: 'Use MA Filter', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'maFast', title: 'Fast MA', color: '#000000', lineWidth: 2 },
  { id: 'maMed', title: 'Medium MA', color: '#26A69A', lineWidth: 3 },
  { id: 'maSlow', title: 'Slow MA', color: '#2196F3', lineWidth: 2 },
];

export const metadata = {
  title: 'QQE Cross',
  shortTitle: 'QQEX',
  overlay: true,
};

/** Compute a selectable MA variant */
function computeMA(src: Series, length: number, maType: string): number[] {
  switch (maType) {
    case 'SMA': return ta.sma(src, length).toArray().map(v => v ?? NaN);
    case 'EMA': return ta.ema(src, length).toArray().map(v => v ?? NaN);
    case 'WMA': return ta.wma(src, length).toArray().map(v => v ?? NaN);
    case 'HullMA': return ta.hma(src, length).toArray().map(v => v ?? NaN);
    case 'DEMA': {
      const e1 = ta.ema(src, length).toArray().map(v => v ?? NaN);
      const e1Series = new Series(
        e1.map((v, i) => ({ time: i, open: v, high: v, low: v, close: v, volume: 0 }) as unknown as Bar),
        (b) => b.close,
      );
      const e2 = ta.ema(e1Series, length).toArray().map(v => v ?? NaN);
      return e1.map((v, i) => 2 * v - (e2[i] ?? NaN));
    }
    case 'SMMA': {
      // Smoothed MA: smma[0] = sma, smma[i] = (smma[i-1]*(len-1) + src[i]) / len
      const srcArr = src.toArray().map(v => v ?? NaN);
      const n = srcArr.length;
      const out: number[] = new Array(n).fill(NaN);
      let sum = 0;
      for (let i = 0; i < n; i++) {
        if (isNaN(srcArr[i])) continue;
        if (i < length) {
          sum += srcArr[i];
          if (i === length - 1) out[i] = sum / length;
        } else {
          out[i] = (out[i - 1] * (length - 1) + srcArr[i]) / length;
        }
      }
      return out;
    }
    default: return ta.ema(src, length).toArray().map(v => v ?? NaN);
  }
}

export function calculate(bars: Bar[], inputs: Partial<QqeCrossInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const close = new Series(bars, (b) => b.close);

  // --- QQE Core ---
  // RSI
  const rsiArr = ta.rsi(close, cfg.rsiLength).toArray().map(v => v ?? NaN);

  // RSIndex = EMA(RSI, SF)
  const rsiSeries = new Series(
    rsiArr.map((v, i) => ({ time: bars[i].time, open: v, high: v, low: v, close: v, volume: 0 }) as unknown as Bar),
    (b) => b.close,
  );
  const rsIndexArr = ta.ema(rsiSeries, cfg.rsiSmoothing).toArray().map(v => v ?? NaN);

  // AtrRsi = abs(RSIndex[1] - RSIndex)
  const atrRsi: number[] = new Array(n).fill(NaN);
  for (let i = 1; i < n; i++) {
    if (!isNaN(rsIndexArr[i]) && !isNaN(rsIndexArr[i - 1])) {
      atrRsi[i] = Math.abs(rsIndexArr[i - 1] - rsIndexArr[i]);
    }
  }

  // Wilders_Period = RSILen * 2 - 1
  const wildersPeriod = cfg.rsiLength * 2 - 1;

  // MaAtrRsi = EMA(AtrRsi, Wilders_Period)
  const atrRsiSeries = new Series(
    atrRsi.map((v, i) => ({ time: bars[i].time, open: v, high: v, low: v, close: v, volume: 0 }) as unknown as Bar),
    (b) => b.close,
  );
  const maAtrRsiArr = ta.ema(atrRsiSeries, wildersPeriod).toArray().map(v => v ?? NaN);

  // DeltaFastAtrRsi = EMA(MaAtrRsi, Wilders_Period) * QQE_factor
  const maAtrRsiSeries = new Series(
    maAtrRsiArr.map((v, i) => ({ time: bars[i].time, open: v, high: v, low: v, close: v, volume: 0 }) as unknown as Bar),
    (b) => b.close,
  );
  const deltaFastArr = ta.ema(maAtrRsiSeries, wildersPeriod).toArray().map(v => (v ?? NaN) * cfg.qqeFactor);

  // Build longband, shortband, trend, FastAtrRsiTL
  const longband: number[] = new Array(n).fill(0);
  const shortband: number[] = new Array(n).fill(0);
  const trend: number[] = new Array(n).fill(0);
  const fastAtrRsiTL: number[] = new Array(n).fill(NaN);

  for (let i = 0; i < n; i++) {
    if (isNaN(rsIndexArr[i]) || isNaN(deltaFastArr[i])) {
      if (i > 0) {
        longband[i] = longband[i - 1];
        shortband[i] = shortband[i - 1];
        trend[i] = trend[i - 1];
        fastAtrRsiTL[i] = fastAtrRsiTL[i - 1];
      }
      continue;
    }

    const newLongband = rsIndexArr[i] - deltaFastArr[i];
    const newShortband = rsIndexArr[i] + deltaFastArr[i];

    if (i === 0) {
      longband[i] = newLongband;
      shortband[i] = newShortband;
      trend[i] = 1;
    } else {
      // Longband ratchets up
      longband[i] = rsIndexArr[i] > longband[i - 1]
        ? Math.max(longband[i - 1], newLongband)
        : newLongband;

      // Shortband ratchets down
      shortband[i] = rsIndexArr[i] < shortband[i - 1]
        ? Math.min(shortband[i - 1], newShortband)
        : newShortband;

      // Trend detection via cross
      const prevRSI = rsIndexArr[i - 1];
      const crossAboveShort = prevRSI <= shortband[i - 1] && rsIndexArr[i] > shortband[i - 1];
      const crossBelowLong = longband[i - 1] >= prevRSI && longband[i - 1] < rsIndexArr[i];
      // Actually: cross(RSIndex, shortband[1]) => RSIndex crosses above or below shortband
      // Pine cross() means either direction. But in QQE context:
      // trend = cross(RSIndex, shortband[1]) ? 1 : cross(longband[1], RSIndex) ? -1 : nz(trend[1],1)
      // cross(a,b) = (a>b AND a[1]<=b[1]) OR (a<b AND a[1]>=b[1])
      const crossShort = (rsIndexArr[i] > shortband[i - 1] && prevRSI <= shortband[i - 1]) ||
                          (rsIndexArr[i] < shortband[i - 1] && prevRSI >= shortband[i - 1]);
      const crossLong = (longband[i - 1] > rsIndexArr[i] && longband[i - 2 >= 0 ? i - 2 : 0] <= prevRSI) ||
                         (longband[i - 1] < rsIndexArr[i] && longband[i - 2 >= 0 ? i - 2 : 0] >= prevRSI);

      if (crossShort) {
        trend[i] = 1;
      } else if (crossLong) {
        trend[i] = -1;
      } else {
        trend[i] = trend[i - 1] || 1;
      }
    }

    fastAtrRsiTL[i] = trend[i] === 1 ? longband[i] : shortband[i];
  }

  // --- Signal crosses ---
  const warmup = cfg.rsiLength * 2 + cfg.rsiSmoothing + wildersPeriod;
  const markers: MarkerData[] = [];

  // Track channel entry for XC
  let xcBuyCount = 0;
  let xcSellCount = 0;

  for (let i = 1; i < n; i++) {
    if (i < warmup || isNaN(rsIndexArr[i]) || isNaN(fastAtrRsiTL[i])) continue;

    const rsi = rsIndexArr[i];
    const rsiPrev = rsIndexArr[i - 1];
    const tl = fastAtrRsiTL[i];
    const tlPrev = fastAtrRsiTL[i - 1];

    // XQ: RSI signal crossing FastAtrRsiTL
    const xqUp = rsiPrev <= tlPrev && rsi > tl;
    const xqDn = rsiPrev >= tlPrev && rsi < tl;

    // XZ: RSI signal crossing 50
    const xzUp = rsiPrev <= 50 && rsi > 50;
    const xzDn = rsiPrev >= 50 && rsi < 50;

    // XC: RSI entering threshold channel
    const upperThresh = 50 + cfg.threshold;
    const lowerThresh = 50 - cfg.threshold;
    const inUpperChannel = rsi > upperThresh;
    const inLowerChannel = rsi < lowerThresh;
    const wasInUpperChannel = rsiPrev > upperThresh;
    const wasInLowerChannel = rsiPrev < lowerThresh;

    // Count consecutive bars in channel
    if (inUpperChannel && !wasInUpperChannel) {
      xcSellCount = 1;
    } else if (inUpperChannel) {
      xcSellCount++;
    } else {
      xcSellCount = 0;
    }

    if (inLowerChannel && !wasInLowerChannel) {
      xcBuyCount = 1;
    } else if (inLowerChannel) {
      xcBuyCount++;
    } else {
      xcBuyCount = 0;
    }

    const xcBuyFirst = xcBuyCount === 1;
    const xcSellFirst = xcSellCount === 1;

    // MA filter
    let buyFilter = true;
    let sellFilter = true;

    if (cfg.useFilter) {
      const closeSeries = new Series(bars, (b) => b.close);
      const fastMA = computeMA(closeSeries, cfg.fastMALen, cfg.maType);
      const medMA = computeMA(closeSeries, cfg.medMALen, cfg.maType);
      const slowMA = computeMA(closeSeries, cfg.slowMALen, cfg.maType);

      const c = bars[i].close;
      const fma = fastMA[i];
      const mma = medMA[i];
      const sma = slowMA[i];

      buyFilter = c > mma && mma > sma && fma > mma;
      sellFilter = c < mma && mma < sma && fma < mma;
    }

    // Final BUY/SELL (XC channel entry with filter)
    const isBuy = xcBuyFirst && buyFilter;
    const isSell = xcSellFirst && sellFilter;

    if (isBuy) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#00FF00', text: 'BUY' });
    } else if (isSell) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#FF0000', text: 'SELL' });
    }

    // XQ cross markers (not overlapping with BUY/SELL)
    if (xqUp && !isBuy) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: '#2196F3', text: 'XQ' });
    } else if (xqDn && !isSell) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: '#000000', text: 'XQ' });
    }

    // XC markers (channel entry that is not already a BUY/SELL)
    if (xcBuyFirst && !isBuy) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: '#808000', text: 'XC' });
    } else if (xcSellFirst && !isSell) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: '#FF0000', text: 'XC' });
    }
  }

  // --- MA plots ---
  const closeSeries = new Series(bars, (b) => b.close);
  const fastMA = computeMA(closeSeries, cfg.fastMALen, cfg.maType);
  const medMA = computeMA(closeSeries, cfg.medMALen, cfg.maType);
  const slowMA = computeMA(closeSeries, cfg.slowMALen, cfg.maType);

  const maFastPlot = fastMA.map((v, i) => ({ time: bars[i].time, value: v }));
  const maMedPlot = medMA.map((v, i) => {
    const rising = i > 0 && v > medMA[i - 1];
    return { time: bars[i].time, value: v, color: rising ? '#26A69A' : '#EF5350' };
  });
  const maSlowPlot = slowMA.map((v, i) => ({ time: bars[i].time, value: v }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      maFast: maFastPlot,
      maMed: maMedPlot,
      maSlow: maSlowPlot,
    },
    markers,
  };
}

export const QqeCross = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
