/**
 * Delta-RSI Oscillator
 *
 * Approximates the derivative of RSI using linear regression slope.
 * Computes RSI, then fits linreg over a rolling window to estimate the
 * rate of change (Delta-RSI). Signal line is EMA of Delta-RSI.
 * Histogram shows drsi colored green/red by sign.
 *
 * Reference: TradingView "Delta-RSI Oscillator" by tbiktag (simplified)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface DeltaRsiOscillatorInputs {
  rsiLength: number;
  window: number;
  signalLength: number;
}

export const defaultInputs: DeltaRsiOscillatorInputs = {
  rsiLength: 21,
  window: 21,
  signalLength: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 21, min: 2 },
  { id: 'window', type: 'int', title: 'Regression Window', defval: 21, min: 2 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 9, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Delta-RSI', color: '#2962FF', lineWidth: 2, style: 'histogram' },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 2 },
  { id: 'plot2', title: 'Zero', color: '#787B86', lineWidth: 1 },
];

export const metadata = {
  title: 'Delta-RSI Oscillator',
  shortTitle: 'DRSI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<DeltaRsiOscillatorInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { rsiLength, window, signalLength } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const close = new Series(bars, (b) => b.close);
  const rsiSeries = ta.rsi(close, rsiLength);
  const rsiArr = rsiSeries.toArray();

  // Delta-RSI via linreg slope approximation:
  // linreg(rsi, window, 0) gives the regression value at current bar
  // linreg(rsi, window, 1) gives the regression value projected 1 bar ahead (offset=1)
  // slope ~ linreg(rsi, window, 1) - linreg(rsi, window, 0)
  // But offset=1 means forecast, so slope = forecast - current
  // Actually in Pine: linreg(src, length, offset) where offset=0 is at current bar.
  // slope = linreg(src, len, 0) - linreg(src, len, 1)  would be current - lagged
  // We want the derivative: use simple difference of linreg values
  const lr0 = ta.linreg(rsiSeries, window, 0).toArray();
  const lr1 = ta.linreg(rsiSeries, window, 1).toArray();

  const drsiArr: number[] = new Array(n);
  const warmup = rsiLength + window;

  for (let i = 0; i < n; i++) {
    const v0 = lr0[i];
    const v1 = lr1[i];
    if (i < warmup || v0 == null || v1 == null || isNaN(v0) || isNaN(v1)) {
      drsiArr[i] = NaN;
    } else {
      drsiArr[i] = v0 - v1; // slope: current regression minus lagged
    }
  }

  // Signal line = EMA of drsi
  const drsiSeries = new Series(
    bars.map((b, i) => ({ ...b, close: isNaN(drsiArr[i]) ? 0 : drsiArr[i] })),
    (b) => b.close,
  );
  const signalArr = ta.ema(drsiSeries, signalLength).toArray();

  // Blank signal during warmup
  for (let i = 0; i < warmup; i++) {
    if (signalArr[i] !== undefined) signalArr[i] = NaN;
  }

  // Histogram plot with green/red coloring
  const plot0 = drsiArr.map((v, i) => {
    if (isNaN(v)) return { time: bars[i].time, value: NaN };
    const color = v >= 0 ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  const plot1 = signalArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || isNaN(v)) ? NaN : v,
  }));

  // Zero line as flat plot
  const plot2 = bars.map((b) => ({ time: b.time, value: 0 }));

  // Markers: zero-crossing buy/sell
  const markers: MarkerData[] = [];
  for (let i = warmup + 1; i < n; i++) {
    const prev = drsiArr[i - 1];
    const cur = drsiArr[i];
    if (isNaN(prev) || isNaN(cur)) continue;

    // Crossover zero = buy
    if (prev <= 0 && cur > 0) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#26A69A', text: 'B' });
    }
    // Crossunder zero = sell
    if (prev >= 0 && cur < 0) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#FF00FF', text: 'S' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2 },
    hlines: [{ value: 0, options: { color: '#787B86', linestyle: 'solid', title: 'Zero' } }],
    markers,
  };
}

export const DeltaRsiOscillator = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
