/**
 * Traders Dynamic Index + HLC Trends + Trix Ribbon
 *
 * TDI: RSI with Bollinger Bands overlay. RSI line, signal line (fast SMA of RSI),
 * and BB bands on RSI for overbought/oversold with volatility context.
 *
 * Reference: TradingView "Traders Dynamic Index + HLC Trends + Trix Ribbon" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface TDIHLCTrixInputs {
  rsiLen: number;
  bbLen: number;
  bbMult: number;
}

export const defaultInputs: TDIHLCTrixInputs = {
  rsiLen: 13,
  bbLen: 34,
  bbMult: 1.6185,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 13, min: 1 },
  { id: 'bbLen', type: 'int', title: 'BB Length', defval: 34, min: 1 },
  { id: 'bbMult', type: 'float', title: 'BB Multiplier', defval: 1.6185, min: 0.01, step: 0.01 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#EF5350', lineWidth: 1 },
  { id: 'plot2', title: 'BB Upper', color: '#2962FF', lineWidth: 1 },
  { id: 'plot3', title: 'BB Lower', color: '#2962FF', lineWidth: 1 },
  { id: 'plot4', title: 'BB Mid', color: '#FFEB3B', lineWidth: 1 },
];

export const metadata = {
  title: 'Traders Dynamic Index',
  shortTitle: 'TDI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<TDIHLCTrixInputs> = {}): IndicatorResult {
  const { rsiLen, bbLen, bbMult } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeSeries = new Series(bars, (b) => b.close);
  const rsiArr = ta.rsi(closeSeries, rsiLen).toArray();

  // BB on RSI
  const rsiSeries = new Series(bars, (_b, i) => rsiArr[i]);
  const bbMid = ta.sma(rsiSeries, bbLen).toArray();
  const bbStd = ta.stdev(rsiSeries, bbLen).toArray();

  // Signal line: SMA of RSI with period 2
  const signalArr = ta.sma(rsiSeries, 2).toArray();

  const warmup = rsiLen + bbLen;

  const plot0 = rsiArr.map((v, i) => ({
    time: bars[i].time,
    value: i < rsiLen || isNaN(v) ? NaN : v,
  }));

  const plot1 = signalArr.map((v, i) => ({
    time: bars[i].time,
    value: i < rsiLen || v == null || isNaN(v) ? NaN : v,
  }));

  const plot2 = bars.map((b, i) => {
    if (i < warmup || bbMid[i] == null || bbStd[i] == null) return { time: b.time, value: NaN };
    return { time: b.time, value: bbMid[i]! + bbMult * bbStd[i]! };
  });

  const plot3 = bars.map((b, i) => {
    if (i < warmup || bbMid[i] == null || bbStd[i] == null) return { time: b.time, value: NaN };
    return { time: b.time, value: bbMid[i]! - bbMult * bbStd[i]! };
  });

  const plot4 = bbMid.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || v == null || isNaN(v) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3, 'plot4': plot4 },
    hlines: [
      { value: 68, options: { color: '#EF5350', linestyle: 'dashed' as const, title: 'Overbought' } },
      { value: 50, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Mid' } },
      { value: 32, options: { color: '#26A69A', linestyle: 'dashed' as const, title: 'Oversold' } },
    ],
    fills: [
      { plot1: 'plot2', plot2: 'plot3', options: { color: 'rgba(41,98,255,0.1)' } },
    ],
  };
}

export const TDIHLCTrix = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
