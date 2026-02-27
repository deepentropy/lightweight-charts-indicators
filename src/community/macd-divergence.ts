/**
 * MACD Divergence
 *
 * MACD with divergence detection using pivot high/low on MACD line.
 *
 * Reference: TradingView "MACD Divergence" community indicator
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface MACDDivergenceInputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
  pivotLookback: number;
  rangeUpper: number;
  rangeLower: number;
  dontTouchZero: boolean;
  plotBull: boolean;
  plotBear: boolean;
  plotHiddenBull: boolean;
  plotHiddenBear: boolean;
  src: SourceType;
}

export const defaultInputs: MACDDivergenceInputs = {
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  pivotLookback: 5,
  rangeUpper: 60,
  rangeLower: 5,
  dontTouchZero: true,
  plotBull: true,
  plotBear: true,
  plotHiddenBull: false,
  plotHiddenBear: false,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 9, min: 1 },
  { id: 'pivotLookback', type: 'int', title: 'Pivot Lookback', defval: 5, min: 1 },
  { id: 'rangeUpper', type: 'int', title: 'Max of Lookback Range', defval: 60, min: 1 },
  { id: 'rangeLower', type: 'int', title: 'Min of Lookback Range', defval: 5, min: 1 },
  { id: 'dontTouchZero', type: 'bool', title: "Don't touch the zero line?", defval: true },
  { id: 'plotBull', type: 'bool', title: 'Plot Bullish', defval: true },
  { id: 'plotBear', type: 'bool', title: 'Plot Bearish', defval: true },
  { id: 'plotHiddenBull', type: 'bool', title: 'Plot Hidden Bullish', defval: false },
  { id: 'plotHiddenBear', type: 'bool', title: 'Plot Hidden Bearish', defval: false },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MACD', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 2 },
  { id: 'plot2', title: 'Histogram', color: '#26A69A', lineWidth: 4, style: 'columns' },
  { id: 'regBull', title: 'Regular Bullish', color: '#26A69A', lineWidth: 2 },
  { id: 'regBear', title: 'Regular Bearish', color: '#EF5350', lineWidth: 2 },
  { id: 'hidBull', title: 'Hidden Bullish', color: 'rgba(0,150,136,0.20)', lineWidth: 2 },
  { id: 'hidBear', title: 'Hidden Bearish', color: 'rgba(255,82,82,0.20)', lineWidth: 2 },
];

export const metadata = {
  title: 'MACD Divergence',
  shortTitle: 'MACDDiv',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<MACDDivergenceInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { fastLength, slowLength, signalLength, pivotLookback, rangeUpper, rangeLower,
    dontTouchZero, plotBull, plotBear, plotHiddenBull, plotHiddenBear, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);
  const n = bars.length;
  const lbR = pivotLookback;
  const lbL = pivotLookback;

  const fastEMA = ta.ema(source, fastLength);
  const slowEMA = ta.ema(source, slowLength);
  const macdLine = fastEMA.sub(slowEMA);
  const signalLine = ta.ema(macdLine, signalLength);
  const histogram = macdLine.sub(signalLine);

  const macdArr = macdLine.toArray();
  const sigArr = signalLine.toArray();
  const histArr = histogram.toArray();

  // Pivot detection on MACD for divergence
  const phArr = ta.pivothigh(macdLine, lbL, lbR).toArray();
  const plArr = ta.pivotlow(macdLine, lbL, lbR).toArray();

  const warmup = slowLength;

  const toPlot = (arr: (number | null)[]) =>
    arr.map((v, i) => ({ time: bars[i].time, value: (i < warmup || v == null) ? NaN : v }));

  // Pine 4-color histogram: col_grow_above=#26A69A, col_fall_above=#B2DFDB, col_grow_below=#FFCDD2, col_fall_below=#FF5252
  const histPlot = histArr.map((v, i) => {
    if (i < warmup || v == null) return { time: bars[i].time, value: NaN };
    const prev = i > 0 ? (histArr[i - 1] ?? NaN) : NaN;
    let color: string;
    if (v >= 0) {
      color = v > prev ? '#26A69A' : '#B2DFDB'; // grow above / fall above
    } else {
      color = v < prev ? '#FF5252' : '#FFCDD2'; // fall below / grow below
    }
    return { time: bars[i].time, value: v, color };
  });

  // Divergence plot data arrays
  const regBullPlot = bars.map(b => ({ time: b.time, value: NaN }));
  const regBearPlot = bars.map(b => ({ time: b.time, value: NaN }));
  const hidBullPlot = bars.map(b => ({ time: b.time, value: NaN }));
  const hidBearPlot = bars.map(b => ({ time: b.time, value: NaN }));

  const markers: MarkerData[] = [];

  // Helper: _inRange checks if barsSince the last same-type pivot is within range
  // Pine: bars = barssince(cond == true); rangeLower <= bars and bars <= rangeUpper
  // We track pivot positions and compute barsSince inline.

  // Pine: highest(osc, lbL+lbR+5) for "don't touch zero" check
  const highestOsc = (idx: number): number => {
    let mx = -Infinity;
    for (let j = Math.max(0, idx - (lbL + lbR + 4)); j <= idx; j++) {
      const v = macdArr[j];
      if (v != null) mx = Math.max(mx, v);
    }
    return mx;
  };
  const lowestOsc = (idx: number): number => {
    let mn = Infinity;
    for (let j = Math.max(0, idx - (lbL + lbR + 4)); j <= idx; j++) {
      const v = macdArr[j];
      if (v != null) mn = Math.min(mn, v);
    }
    return mn;
  };

  // Track pivot positions for divergence
  let lastPLIdx = -1, lastPLVal = NaN, lastPLPrice = NaN;
  let lastPHIdx = -1, lastPHVal = NaN, lastPHPrice = NaN;

  for (let i = lbL + lbR; i < n; i++) {
    const plVal = plArr[i];
    if (plVal != null && !isNaN(plVal as number)) {
      const pivotIdx = i - lbR;
      const oscAtPivot = macdArr[pivotIdx] ?? NaN;
      const priceAtPivot = bars[pivotIdx].low;

      if (lastPLIdx >= 0 && !isNaN(lastPLVal) && !isNaN(oscAtPivot)) {
        const barsSince = pivotIdx - lastPLIdx;
        if (barsSince >= rangeLower && barsSince <= rangeUpper) {
          // Regular Bullish: osc higher low (oscAtPivot > lastPLVal), price lower low, osc < 0
          const blowzero = dontTouchZero ? highestOsc(i) < 0 : true;
          if (plotBull && oscAtPivot > lastPLVal && priceAtPivot < lastPLPrice && oscAtPivot < 0 && blowzero) {
            regBullPlot[pivotIdx] = { time: bars[pivotIdx].time, value: oscAtPivot };
            markers.push({ time: bars[pivotIdx].time as number, position: 'belowBar', shape: 'labelUp', color: '#26A69A', text: ' Bull ' });
          }
          // Hidden Bullish: osc lower low (oscAtPivot < lastPLVal), price higher low
          if (plotHiddenBull && oscAtPivot < lastPLVal && priceAtPivot > lastPLPrice) {
            hidBullPlot[pivotIdx] = { time: bars[pivotIdx].time, value: oscAtPivot };
            markers.push({ time: bars[pivotIdx].time as number, position: 'belowBar', shape: 'labelUp', color: 'rgba(0,150,136,0.50)', text: ' H Bull ' });
          }
        }
      }
      lastPLIdx = pivotIdx;
      lastPLVal = oscAtPivot;
      lastPLPrice = priceAtPivot;
    }

    const phVal = phArr[i];
    if (phVal != null && !isNaN(phVal as number)) {
      const pivotIdx = i - lbR;
      const oscAtPivot = macdArr[pivotIdx] ?? NaN;
      const priceAtPivot = bars[pivotIdx].high;

      if (lastPHIdx >= 0 && !isNaN(lastPHVal) && !isNaN(oscAtPivot)) {
        const barsSince = pivotIdx - lastPHIdx;
        if (barsSince >= rangeLower && barsSince <= rangeUpper) {
          // Regular Bearish: osc lower high (oscAtPivot < lastPHVal), price higher high, osc > 0
          const bearzero = dontTouchZero ? lowestOsc(i) > 0 : true;
          if (plotBear && oscAtPivot < lastPHVal && priceAtPivot > lastPHPrice && oscAtPivot > 0 && bearzero) {
            regBearPlot[pivotIdx] = { time: bars[pivotIdx].time, value: oscAtPivot };
            markers.push({ time: bars[pivotIdx].time as number, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: ' Bear ' });
          }
          // Hidden Bearish: osc higher high (oscAtPivot > lastPHVal), price lower high
          if (plotHiddenBear && oscAtPivot > lastPHVal && priceAtPivot < lastPHPrice) {
            hidBearPlot[pivotIdx] = { time: bars[pivotIdx].time, value: oscAtPivot };
            markers.push({ time: bars[pivotIdx].time as number, position: 'aboveBar', shape: 'labelDown', color: 'rgba(255,82,82,0.50)', text: ' H Bear ' });
          }
        }
      }
      lastPHIdx = pivotIdx;
      lastPHVal = oscAtPivot;
      lastPHPrice = priceAtPivot;
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'plot0': toPlot(macdArr),
      'plot1': toPlot(sigArr),
      'plot2': histPlot,
      'regBull': regBullPlot,
      'regBear': regBearPlot,
      'hidBull': hidBullPlot,
      'hidBear': hidBearPlot,
    },
    hlines: [{ value: 0, options: { color: '#787B86', linestyle: 'dashed', title: 'Zero' } }],
    markers,
  };
}

export const MACDDivergence = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
