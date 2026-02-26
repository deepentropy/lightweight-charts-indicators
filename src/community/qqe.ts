/**
 * Quantitative Qualitative Estimation (QQE)
 *
 * Basic QQE indicator. RSI smoothed with EMA, then dynamic trailing stop
 * computed from ATR-like RSI volatility multiplied by qqeFactor.
 *
 * Reference: TradingView "QQE" by Glaz
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface QQEInputs {
  rsiLen: number;
  smoothFactor: number;
  qqeFactor: number;
  src: SourceType;
}

export const defaultInputs: QQEInputs = {
  rsiLen: 14,
  smoothFactor: 5,
  qqeFactor: 4.236,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'smoothFactor', type: 'int', title: 'Smooth Factor', defval: 5, min: 1 },
  { id: 'qqeFactor', type: 'float', title: 'QQE Factor', defval: 4.236, min: 0.01, step: 0.001 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Smoothed RSI', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Trailing Stop', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'Quantitative Qualitative Estimation',
  shortTitle: 'QQE',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<QQEInputs> = {}): IndicatorResult {
  const { rsiLen, smoothFactor, qqeFactor, src } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const wildersLen = rsiLen * 2 - 1;

  const source = getSourceSeries(bars, src);
  const rsi = ta.rsi(source, rsiLen);
  const smoothedRsi = ta.ema(rsi, smoothFactor);
  const srArr = smoothedRsi.toArray();

  // ATR of RSI: EMA of abs(change in smoothedRsi)
  const atrRsiRaw: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const prev = i > 0 ? (srArr[i - 1] ?? 0) : 0;
    const cur = srArr[i] ?? 0;
    atrRsiRaw[i] = Math.abs(cur - prev);
  }
  const atrRsiSeries = Series.fromArray(bars, atrRsiRaw);
  const smoothedAtr = ta.ema(atrRsiSeries, wildersLen);
  const atrArr = smoothedAtr.toArray();

  // Trailing stop
  const longBand: number[] = new Array(n);
  const shortBand: number[] = new Array(n);
  const trendDir: number[] = new Array(n);
  const trailing: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const sr = srArr[i] ?? 0;
    const prevSr = i > 0 ? (srArr[i - 1] ?? 0) : 0;
    const dar = (atrArr[i] ?? 0) * qqeFactor;
    const newLong = sr - dar;
    const newShort = sr + dar;

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

      if (prevSr <= longBand[i - 1] && sr > longBand[i - 1]) {
        trendDir[i] = 1;
      } else if (prevSr >= shortBand[i - 1] && sr < shortBand[i - 1]) {
        trendDir[i] = -1;
      } else {
        trendDir[i] = trendDir[i - 1];
      }
    }
    trailing[i] = trendDir[i] === 1 ? longBand[i] : shortBand[i];
  }

  const warmup = rsiLen * 2 + smoothFactor;

  const plot0 = srArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v,
  }));

  const plot1 = trailing.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    hlines: [
      { value: 50, options: { color: '#787B86', linestyle: 'dotted' as const, title: 'Midline' } },
    ],
  };
}

export const QQE = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
