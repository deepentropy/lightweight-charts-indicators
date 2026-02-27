/**
 * RSI + BB (EMA) + Dispersion
 *
 * RSI with Bollinger Bands overlay computed on the RSI values.
 * Basis = SMA(RSI, bbLen), bands = basis +/- bbMult * stdev(RSI, bbLen).
 *
 * Reference: TradingView "RSI + BB (EMA) + Dispersion"
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface RSIBBDispersionInputs {
  rsiLen: number;
  bbLen: number;
  bbMult: number;
  src: SourceType;
}

export const defaultInputs: RSIBBDispersionInputs = {
  rsiLen: 14,
  bbLen: 20,
  bbMult: 2.0,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'bbLen', type: 'int', title: 'BB Length', defval: 20, min: 1 },
  { id: 'bbMult', type: 'float', title: 'BB Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: '#7E57C2', lineWidth: 2 },
  { id: 'plot1', title: 'BB Upper', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot2', title: 'BB Lower', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot3', title: 'BB Basis', color: '#787B86', lineWidth: 1 },
];

export const metadata = {
  title: 'RSI + BB + Dispersion',
  shortTitle: 'RSIBB',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<RSIBBDispersionInputs> = {}): IndicatorResult {
  const { rsiLen, bbLen, bbMult, src } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const source = getSourceSeries(bars, src);
  const rsi = ta.rsi(source, rsiLen);
  const rsiArr = rsi.toArray();

  // Compute SMA and stdev of RSI manually
  const basisArr: number[] = new Array(n);
  const devArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if (i < bbLen - 1 + rsiLen) {
      basisArr[i] = NaN;
      devArr[i] = NaN;
      continue;
    }
    let sum = 0;
    let count = 0;
    for (let j = i - bbLen + 1; j <= i; j++) {
      const v = rsiArr[j];
      if (v != null) { sum += v; count++; }
    }
    const mean = count > 0 ? sum / count : NaN;
    basisArr[i] = mean;

    let sqSum = 0;
    for (let j = i - bbLen + 1; j <= i; j++) {
      const v = rsiArr[j];
      if (v != null) { sqSum += (v - mean) * (v - mean); }
    }
    devArr[i] = count > 0 ? Math.sqrt(sqSum / count) : NaN;
  }

  const warmup = rsiLen + bbLen;

  const plot0 = rsiArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < rsiLen) ? NaN : v,
  }));

  const plot1 = basisArr.map((v, i) => ({
    time: bars[i].time,
    value: (isNaN(v) || i < warmup) ? NaN : v + bbMult * devArr[i],
  }));

  const plot2 = basisArr.map((v, i) => ({
    time: bars[i].time,
    value: (isNaN(v) || i < warmup) ? NaN : v - bbMult * devArr[i],
  }));

  const plot3 = basisArr.map((v, i) => ({
    time: bars[i].time,
    value: (isNaN(v) || i < warmup) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3 },
    hlines: [
      { value: 70, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Overbought' } },
      { value: 30, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Oversold' } },
    ],
    fills: [
      { plot1: 'plot1', plot2: 'plot2', options: { color: 'rgba(255,109,0,0.15)' } },
    ],
  };
}

export const RSIBBDispersion = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
