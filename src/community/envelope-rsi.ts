/**
 * Envelope RSI
 *
 * RSI with envelope bands around its SMA.
 * Basis = SMA(RSI, rsiLen), upper = basis + pct, lower = basis - pct.
 *
 * Reference: TradingView "Envelope RSI"
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface EnvelopeRSIInputs {
  rsiLen: number;
  envelopePct: number;
  src: SourceType;
}

export const defaultInputs: EnvelopeRSIInputs = {
  rsiLen: 14,
  envelopePct: 5.0,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'envelopePct', type: 'float', title: 'Envelope %', defval: 5.0, min: 0.01, step: 0.1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: '#7E57C2', lineWidth: 2 },
  { id: 'plot1', title: 'Upper Envelope', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot2', title: 'Lower Envelope', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'Envelope RSI',
  shortTitle: 'EnvRSI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<EnvelopeRSIInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { rsiLen, envelopePct, src } = { ...defaultInputs, ...inputs };

  const source = getSourceSeries(bars, src);
  const rsi = ta.rsi(source, rsiLen);
  const rsiArr = rsi.toArray();

  // Basis = SMA of RSI
  const basis = ta.sma(rsi, rsiLen);
  const basisArr = basis.toArray();

  const warmup = rsiLen * 2;

  const plot0 = rsiArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < rsiLen) ? NaN : v,
  }));

  const plot1 = basisArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v + envelopePct,
  }));

  const plot2 = basisArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v - envelopePct,
  }));

  // Pine markers:
  // condition_buy = rsi < Oversold_RSI and price crosses lower envelope
  // condition_sell = rsi > Overbought_RSI and price crosses upper envelope
  const markers: MarkerData[] = [];
  for (let i = warmup + 1; i < bars.length; i++) {
    const rsiVal = rsiArr[i];
    const basisVal = basisArr[i];
    if (rsiVal == null || basisVal == null) continue;

    const upperVal = basisVal + envelopePct;
    const lowerVal = basisVal - envelopePct;

    // Buy: RSI crosses above lower envelope from below
    if (rsiVal < 30 && rsiArr[i - 1] != null) {
      const prevRsi = rsiArr[i - 1]!;
      const prevBasis = basisArr[i - 1];
      if (prevBasis != null) {
        const prevLower = prevBasis - envelopePct;
        if (prevRsi <= prevLower && rsiVal > lowerVal) {
          markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#26A69A', text: 'Buy' });
        }
      }
    }
    // Sell: RSI crosses below upper envelope from above
    if (rsiVal > 70 && rsiArr[i - 1] != null) {
      const prevRsi = rsiArr[i - 1]!;
      const prevBasis = basisArr[i - 1];
      if (prevBasis != null) {
        const prevUpper = prevBasis + envelopePct;
        if (prevRsi >= prevUpper && rsiVal < upperVal) {
          markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'Sell' });
        }
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2 },
    hlines: [
      { value: 70, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Overbought' } },
      { value: 30, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Oversold' } },
    ],
    fills: [
      { plot1: 'plot1', plot2: 'plot2', options: { color: 'rgba(33, 150, 243, 0.05)' } },
    ],
    markers,
  };
}

export const EnvelopeRSI = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
