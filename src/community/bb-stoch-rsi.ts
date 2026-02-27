/**
 * Bollinger Bands Stochastic RSI Extreme Signal
 *
 * Overlay=true: Bollinger Bands on price (basis/upper/lower with fill),
 * plus bull/bear triangle markers based on StochRSI extreme conditions.
 *
 * Bull: close[1] < lower[1] and close > lower and K[1] < lowerlimit and D[1] < lowerlimit
 * Bear: close[1] > upper[1] and close < upper and K[1] > upperlimit and D[1] > upperlimit
 *
 * Reference: TradingView "Bollinger Bands Stochastic RSI Extreme Signal"
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface BBStochRSIInputs {
  src: SourceType;
  bbLength: number;
  bbMult: number;
  kSmooth: number;
  dSmooth: number;
  rsiLen: number;
  stochLen: number;
  upperLimit: number;
  lowerLimit: number;
}

export const defaultInputs: BBStochRSIInputs = {
  src: 'close',
  bbLength: 20,
  bbMult: 2.0,
  kSmooth: 3,
  dSmooth: 3,
  rsiLen: 14,
  stochLen: 14,
  upperLimit: 90,
  lowerLimit: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'bbLength', type: 'int', title: 'Bollinger Band Length', defval: 20, min: 1 },
  { id: 'bbMult', type: 'float', title: 'StdDev', defval: 2.0, min: 0.001, step: 0.1 },
  { id: 'kSmooth', type: 'int', title: 'K', defval: 3, min: 1 },
  { id: 'dSmooth', type: 'int', title: 'D', defval: 3, min: 1 },
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'stochLen', type: 'int', title: 'Stochastic Length', defval: 14, min: 1 },
  { id: 'upperLimit', type: 'int', title: 'Upper Limit', defval: 90, min: 1 },
  { id: 'lowerLimit', type: 'int', title: 'Lower Limit', defval: 10, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'BB Basis', color: '#872323', lineWidth: 1 },
  { id: 'plot1', title: 'BB Upper', color: '#009688', lineWidth: 1 },
  { id: 'plot2', title: 'BB Lower', color: '#009688', lineWidth: 1 },
];

export const metadata = {
  title: 'BB Stochastic RSI Extreme Signal',
  shortTitle: 'BBSR Extreme',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<BBStochRSIInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { src, bbLength, bbMult, kSmooth, dSmooth, rsiLen, stochLen, upperLimit, lowerLimit } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // Bollinger Bands on price
  const source = getSourceSeries(bars, src);
  const basis = ta.sma(source, bbLength);
  const dev = ta.stdev(source, bbLength).mul(bbMult);
  const upper = basis.add(dev);
  const lower = basis.sub(dev);

  const basisArr = basis.toArray();
  const upperArr = upper.toArray();
  const lowerArr = lower.toArray();

  // Stochastic RSI: stoch(rsi1, rsi1, rsi1, lengthStoch)
  const rsi = ta.rsi(source, rsiLen);
  const rsiArr = rsi.toArray();
  const rsiHigh = ta.highest(rsi, stochLen);
  const rsiLow = ta.lowest(rsi, stochLen);
  const rsiHighArr = rsiHigh.toArray();
  const rsiLowArr = rsiLow.toArray();

  const stochRSI: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const r = rsiArr[i];
    const h = rsiHighArr[i];
    const l = rsiLowArr[i];
    if (r == null || h == null || l == null || h === l) {
      stochRSI[i] = NaN;
    } else {
      stochRSI[i] = (r - l) / (h - l) * 100;
    }
  }

  const stochSeries = Series.fromArray(bars, stochRSI);
  const kSeries = ta.sma(stochSeries, kSmooth);
  const dSeries = ta.sma(kSeries, dSmooth);
  const kArr = kSeries.toArray();
  const dArr = dSeries.toArray();

  const warmup = bbLength;

  // Plot BB on price
  const plot0 = basisArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null) ? NaN : v,
  }));
  const plot1 = upperArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null) ? NaN : v,
  }));
  const plot2 = lowerArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null) ? NaN : v,
  }));

  // Bull/Bear markers from StochRSI extreme conditions
  const markers: MarkerData[] = [];
  const stochWarmup = rsiLen + stochLen + kSmooth + dSmooth;

  for (let i = Math.max(warmup, stochWarmup) + 1; i < n; i++) {
    const closeCur = bars[i].close;
    const closePrev = bars[i - 1].close;
    const upperPrev = upperArr[i - 1];
    const upperCur = upperArr[i];
    const lowerPrev = lowerArr[i - 1];
    const lowerCur = lowerArr[i];
    const kPrev = kArr[i - 1];
    const dPrev = dArr[i - 1];

    if (upperPrev == null || upperCur == null || lowerPrev == null || lowerCur == null ||
        kPrev == null || dPrev == null || isNaN(kPrev) || isNaN(dPrev)) continue;

    // Bear: close[1] > upper[1] and close < upper and k[1] > upperlimit and d[1] > upperlimit
    const bear = closePrev > upperPrev && closeCur < upperCur &&
                 kPrev > upperLimit && dPrev > upperLimit;

    // Bull: close[1] < lower[1] and close > lower and k[1] < lowerlimit and d[1] < lowerlimit
    const bull = closePrev < lowerPrev && closeCur > lowerCur &&
                 kPrev < lowerLimit && dPrev < lowerLimit;

    if (bear) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: '#FF5252' });
    }
    if (bull) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: '#4CAF50' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2 },
    fills: [
      { plot1: 'plot1', plot2: 'plot2', options: { color: 'rgba(25,135,135,0.05)' } },
    ],
    markers,
  };
}

export const BBStochRSI = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
