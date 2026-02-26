/**
 * RSI Bands, RSI %B, RSI Bandwidth
 *
 * Bollinger Bands applied to RSI, then derives %B and Bandwidth.
 * %B = (RSI - lower) / (upper - lower). Bandwidth = (upper - lower) / basis * 100.
 *
 * Reference: TradingView "RSI Bands / RSI %B / RSI Bandwidth"
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface RSIBandsInputs {
  rsiLen: number;
  bbLen: number;
  bbMult: number;
  src: SourceType;
}

export const defaultInputs: RSIBandsInputs = {
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
  { id: 'plot0', title: 'RSI %B', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Bandwidth', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'RSI Bands %B & Bandwidth',
  shortTitle: 'RSIB',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<RSIBandsInputs> = {}): IndicatorResult {
  const { rsiLen, bbLen, bbMult, src } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const source = getSourceSeries(bars, src);
  const rsi = ta.rsi(source, rsiLen);
  const rsiArr = rsi.toArray();

  // Compute BB on RSI manually
  const basisArr: number[] = new Array(n);
  const upperArr: number[] = new Array(n);
  const lowerArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if (i < bbLen - 1 + rsiLen) {
      basisArr[i] = NaN;
      upperArr[i] = NaN;
      lowerArr[i] = NaN;
      continue;
    }
    let sum = 0, count = 0;
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
    const dev = count > 0 ? Math.sqrt(sqSum / count) * bbMult : NaN;
    upperArr[i] = mean + dev;
    lowerArr[i] = mean - dev;
  }

  const warmup = rsiLen + bbLen;

  const plot0: Array<{ time: number; value: number }> = [];
  const plot1: Array<{ time: number; value: number }> = [];

  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    const r = rsiArr[i];
    if (i < warmup || r == null || isNaN(basisArr[i])) {
      plot0.push({ time: t, value: NaN });
      plot1.push({ time: t, value: NaN });
      continue;
    }
    const range = upperArr[i] - lowerArr[i];
    const percentB = range !== 0 ? (r - lowerArr[i]) / range : 0;
    const bandwidth = basisArr[i] !== 0 ? range / basisArr[i] * 100 : 0;
    plot0.push({ time: t, value: percentB });
    plot1.push({ time: t, value: bandwidth });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    hlines: [
      { value: 1.0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Upper' } },
      { value: 0.0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Lower' } },
    ],
  };
}

export const RSIBands = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
