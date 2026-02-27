/**
 * vdubus BinaryPro Indicators 1 & 2
 *
 * Overlay indicator (overlay=true) with:
 * - Upper channel: highest(length) plotted as circles (fuchsia)
 * - Lower channel: lowest(length) plotted as circles (fuchsia)
 * - SMA 50 (red, linewidth 2)
 * - Bollinger Bands (upper/lower, blue) based on avg(upper,lower) basis + 1.5*stdev
 * - Fill between BB upper and lower bands
 *
 * Reference: TradingView "vdubus BinaryPro - Indicators 1 & 2" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface VdubusBinaryProInputs {
  upperChannelLen: number;
  lowerChannelLen: number;
  maPeriod: number;
  bbLength: number;
  bbMult: number;
}

export const defaultInputs: VdubusBinaryProInputs = {
  upperChannelLen: 20,
  lowerChannelLen: 20,
  maPeriod: 50,
  bbLength: 20,
  bbMult: 1.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'upperChannelLen', type: 'int', title: 'Upper Channel', defval: 20, min: 1 },
  { id: 'lowerChannelLen', type: 'int', title: 'Lower Channel', defval: 20, min: 1 },
  { id: 'maPeriod', type: 'int', title: 'MA1 Period', defval: 50, min: 1 },
  { id: 'bbLength', type: 'int', title: 'BB Length', defval: 20, min: 1 },
  { id: 'bbMult', type: 'float', title: 'BB Multiplier', defval: 1.5, min: 0.001, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'upper', title: 'Upper Channel', color: '#FF00FF', lineWidth: 2, style: 'circles' as any },
  { id: 'lower', title: 'Lower Channel', color: '#FF00FF', lineWidth: 2, style: 'circles' as any },
  { id: 'ma50', title: 'MA 50', color: '#EF5350', lineWidth: 2 },
  { id: 'bbUpper', title: 'BB Upper', color: '#2196F3', lineWidth: 1 },
  { id: 'bbLower', title: 'BB Lower', color: '#2196F3', lineWidth: 1 },
];

export const metadata = {
  title: 'vdubus BinaryPro',
  shortTitle: 'VBP',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<VdubusBinaryProInputs> = {}): IndicatorResult {
  const { upperChannelLen, lowerChannelLen, maPeriod, bbLength, bbMult } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeSeries = new Series(bars, (b) => b.close);
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  // Pine: upper = highest(length1), lower = lowest(length2)
  const upperArr = ta.highest(highSeries, upperChannelLen).toArray();
  const lowerArr = ta.lowest(lowSeries, lowerChannelLen).toArray();

  // Pine: basis = avg(upper, lower)
  // Pine: SMA 50
  const sma50Arr = ta.sma(closeSeries, maPeriod).toArray();

  // Pine: BB based on basis = avg(upper, lower), dev = mult * stdev(close, bbLength)
  // basis for BB = avg(upper, lower)
  const basisArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    basisArr[i] = ((upperArr[i] ?? 0) + (lowerArr[i] ?? 0)) / 2;
  }
  const basisSeries = Series.fromArray(bars, basisArr);

  // Pine: bb1_dev = bb1_mult * stdev(close, bb1_l)
  const stdevArr = ta.stdev(closeSeries, bbLength).toArray();

  const bbUpperArr: number[] = new Array(n);
  const bbLowerArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const basis = basisArr[i];
    const dev = bbMult * (stdevArr[i] ?? 0);
    bbUpperArr[i] = basis + dev;
    bbLowerArr[i] = basis - dev;
  }

  const warmup = Math.max(upperChannelLen, lowerChannelLen, bbLength);

  const upperPlot = bars.map((b, i) => ({
    time: b.time,
    value: (i < warmup || upperArr[i] == null) ? NaN : upperArr[i]!,
  }));

  const lowerPlot = bars.map((b, i) => ({
    time: b.time,
    value: (i < warmup || lowerArr[i] == null) ? NaN : lowerArr[i]!,
  }));

  const ma50Plot = bars.map((b, i) => ({
    time: b.time,
    value: (i < maPeriod || sma50Arr[i] == null) ? NaN : sma50Arr[i]!,
  }));

  const bbUpperPlot = bars.map((b, i) => ({
    time: b.time,
    value: (i < warmup || isNaN(bbUpperArr[i])) ? NaN : bbUpperArr[i],
  }));

  const bbLowerPlot = bars.map((b, i) => ({
    time: b.time,
    value: (i < warmup || isNaN(bbLowerArr[i])) ? NaN : bbLowerArr[i],
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'upper': upperPlot,
      'lower': lowerPlot,
      'ma50': ma50Plot,
      'bbUpper': bbUpperPlot,
      'bbLower': bbLowerPlot,
    },
    fills: [
      { plot1: 'bbUpper', plot2: 'bbLower', options: { color: 'rgba(33,150,243,0.10)', title: 'BB Fill' } },
    ],
  };
}

export const VdubusBinaryPro = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
