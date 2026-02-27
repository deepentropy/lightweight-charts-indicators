/**
 * RSI Divergence
 *
 * RSI with a signal line (SMA of RSI) for divergence identification.
 * Pivot-based divergence detection: bullish when price makes lower low but RSI makes higher low,
 * bearish when price makes higher high but RSI makes lower high.
 *
 * Reference: TradingView "RSI Divergence" by Libertus
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface RSIDivergenceInputs {
  rsiLen: number;
  pivotLen: number;
  src: SourceType;
}

export const defaultInputs: RSIDivergenceInputs = {
  rsiLen: 14,
  pivotLen: 5,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'pivotLen', type: 'int', title: 'Pivot Lookback', defval: 5, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: '#7E57C2', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'RSI Divergence',
  shortTitle: 'RSIDiv',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<RSIDivergenceInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { rsiLen, pivotLen, src } = { ...defaultInputs, ...inputs };

  const source = getSourceSeries(bars, src);
  const rsi = ta.rsi(source, rsiLen);
  const rsiArr = rsi.toArray();

  // Signal = SMA(RSI, 3)
  const rsiSeries = Series.fromArray(bars, rsiArr.map(v => v ?? 0));
  const signal = ta.sma(rsiSeries, 3);
  const sigArr = signal.toArray();

  const warmup = rsiLen;

  const plot0 = rsiArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v,
  }));

  const plot1 = sigArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup + 2) ? NaN : v,
  }));

  // Pivot-based divergence detection markers
  const markers: MarkerData[] = [];
  const rsiClean = rsiArr.map(v => v ?? 0);

  // Find pivot lows and highs in RSI for divergence detection
  for (let i = warmup + pivotLen; i < bars.length - pivotLen; i++) {
    // Check for pivot low in RSI
    let isPivotLow = true;
    let isPivotHigh = true;
    for (let j = 1; j <= pivotLen; j++) {
      if (rsiClean[i - j] <= rsiClean[i] || rsiClean[i + j] <= rsiClean[i]) isPivotLow = false;
      if (rsiClean[i - j] >= rsiClean[i] || rsiClean[i + j] >= rsiClean[i]) isPivotHigh = false;
    }

    if (isPivotLow) {
      // Look back for previous pivot low to detect bullish divergence
      for (let k = i - pivotLen - 1; k >= warmup + pivotLen; k--) {
        let prevPivLow = true;
        for (let j = 1; j <= pivotLen; j++) {
          if (rsiClean[k - j] <= rsiClean[k] || rsiClean[k + j] <= rsiClean[k]) { prevPivLow = false; break; }
        }
        if (prevPivLow) {
          // Bullish divergence: price lower low, RSI higher low
          if (bars[i].low < bars[k].low && rsiClean[i] > rsiClean[k]) {
            markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#26A69A', text: 'Bull Div' });
          }
          // Hidden bullish: price higher low, RSI lower low
          if (bars[i].low > bars[k].low && rsiClean[i] < rsiClean[k]) {
            markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#66BB6A', text: 'H.Bull' });
          }
          break;
        }
      }
    }

    if (isPivotHigh) {
      // Look back for previous pivot high to detect bearish divergence
      for (let k = i - pivotLen - 1; k >= warmup + pivotLen; k--) {
        let prevPivHigh = true;
        for (let j = 1; j <= pivotLen; j++) {
          if (rsiClean[k - j] >= rsiClean[k] || rsiClean[k + j] >= rsiClean[k]) { prevPivHigh = false; break; }
        }
        if (prevPivHigh) {
          // Bearish divergence: price higher high, RSI lower high
          if (bars[i].high > bars[k].high && rsiClean[i] < rsiClean[k]) {
            markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'Bear Div' });
          }
          // Hidden bearish: price lower high, RSI higher high
          if (bars[i].high < bars[k].high && rsiClean[i] > rsiClean[k]) {
            markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#FF7043', text: 'H.Bear' });
          }
          break;
        }
      }
    }
  }

  // Fill between RSI and Signal (positive = green, negative = red)
  const fillColors = bars.map((_b, i) => {
    const r = rsiArr[i];
    const s = sigArr[i];
    if (r == null || s == null || i < warmup + 2) return 'transparent';
    return r > s ? 'rgba(38,166,154,0.15)' : 'rgba(239,83,80,0.15)';
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    hlines: [
      { value: 70, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Overbought' } },
      { value: 30, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Oversold' } },
    ],
    fills: [{ plot1: 'plot0', plot2: 'plot1', colors: fillColors }],
    markers,
  };
}

export const RSIDivergence = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
