/**
 * TDI - Traders Dynamic Index
 *
 * RSI-based oscillator with volatility bands, fast/slow MA crossovers,
 * and buy/sell signals. Combines RSI with Bollinger-style bands for
 * dynamic overbought/oversold detection.
 *
 * Reference: TradingView "Traders Dynamic Index" community indicator
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface TdiRsiInputs {
  rsiPeriod: number;
  bandLength: number;
  fastMALength: number;
  slowMALength: number;
}

export const defaultInputs: TdiRsiInputs = {
  rsiPeriod: 14,
  bandLength: 34,
  fastMALength: 7,
  slowMALength: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiPeriod', type: 'int', title: 'RSI Period', defval: 14, min: 1 },
  { id: 'bandLength', type: 'int', title: 'Band Length', defval: 34, min: 1 },
  { id: 'fastMALength', type: 'int', title: 'Fast MA Length', defval: 7, min: 1 },
  { id: 'slowMALength', type: 'int', title: 'Slow MA Length', defval: 2, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Band', color: '#12BCC9', lineWidth: 2 },
  { id: 'plot1', title: 'Lower Band', color: '#12BCC9', lineWidth: 2 },
  { id: 'plot2', title: 'Mid Band', color: '#FF9800', lineWidth: 2 },
  { id: 'plot3', title: 'RSI Price Line', color: '#00FF00', lineWidth: 2 },
  { id: 'plot4', title: 'Trade Signal Line', color: '#FF0000', lineWidth: 2 },
];

export const metadata = {
  title: 'TDI - Traders Dynamic Index',
  shortTitle: 'TDI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<TdiRsiInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { rsiPeriod, bandLength, fastMALength, slowMALength } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const close = new Series(bars, (b) => b.close);

  // RSI
  const rsiArr = ta.rsi(close, rsiPeriod).toArray();
  const rsiSeries = new Series(bars, (_, i) => rsiArr[i] ?? NaN);

  // Volatility Bands: SMA of RSI, then stdev-based bands
  const maArr = ta.sma(rsiSeries, bandLength).toArray();
  const stdevArr = ta.stdev(rsiSeries, bandLength).toArray();

  const upArr: number[] = new Array(n);
  const dnArr: number[] = new Array(n);
  const midArr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const ma = maArr[i] ?? NaN;
    const sd = stdevArr[i] ?? NaN;
    const offs = 1.6185 * sd;
    upArr[i] = ma + offs;
    dnArr[i] = ma - offs;
    midArr[i] = (upArr[i] + dnArr[i]) / 2;
  }

  // Fast MA (RSI Price Line) = SMA(RSI, fastMALength)
  const fastArr = ta.sma(rsiSeries, fastMALength).toArray();

  // Slow MA (Trade Signal Line) = SMA(RSI, slowMALength)
  const slowArr = ta.sma(rsiSeries, slowMALength).toArray();

  const warmup = rsiPeriod + bandLength;

  // Build plot arrays
  const plot0 = upArr.map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : v }));
  const plot1 = dnArr.map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : v }));
  const plot2 = midArr.map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : v }));
  const plot3 = fastArr.map((v, i) => ({ time: bars[i].time, value: i < rsiPeriod ? NaN : (v ?? NaN) }));
  const plot4 = slowArr.map((v, i) => ({ time: bars[i].time, value: i < rsiPeriod ? NaN : (v ?? NaN) }));

  // Markers: Buy/Sell signals
  const markers: MarkerData[] = [];
  for (let i = 1; i < n; i++) {
    const fast = fastArr[i] ?? NaN;
    const slow = slowArr[i] ?? NaN;
    const prevFast = fastArr[i - 1] ?? NaN;
    const prevSlow = slowArr[i - 1] ?? NaN;
    const mid = midArr[i] ?? NaN;

    if (isNaN(fast) || isNaN(slow) || isNaN(prevFast) || isNaN(prevSlow) || isNaN(mid)) continue;

    // Buy: crossover(fast, slow) AND slow > mid AND slow > 50
    if (prevFast <= prevSlow && fast > slow && slow > mid && slow > 50) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#00FF00', text: 'Buy' });
    }
    // Sell: crossunder(fast, slow) AND slow < mid AND slow < 50
    if (prevFast >= prevSlow && fast < slow && slow < mid && slow < 50) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#FF0000', text: 'Sell' });
    }
  }

  // Fill between fast and slow: green when fast > slow, red otherwise
  const fillColors = fastArr.map((f, i) => {
    const s = slowArr[i] ?? NaN;
    if (i < rsiPeriod || f == null || isNaN(f) || isNaN(s)) return 'transparent';
    return f > s ? 'rgba(0,255,0,0.15)' : 'rgba(255,0,0,0.15)';
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3, 'plot4': plot4 },
    fills: [{ plot1: 'plot3', plot2: 'plot4', colors: fillColors }],
    hlines: [
      { value: 30, options: { color: '#787B86', linestyle: 'dashed' as const, title: '30' } },
      { value: 50, options: { color: '#787B86', linestyle: 'dotted' as const, title: '50' } },
      { value: 70, options: { color: '#787B86', linestyle: 'dashed' as const, title: '70' } },
    ],
    markers,
  };
}

export const TdiRsi = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
