/**
 * Pekipek's PPO Divergence
 *
 * Percentage Price Oscillator with pivot-based divergence detection.
 * PPO = (EMA_fast - EMA_slow) / EMA_slow * 100.
 *
 * Reference: TradingView "Pekipek's PPO Divergence" by Pekipek
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface PPODivergenceInputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
  src: SourceType;
}

export const defaultInputs: PPODivergenceInputs = {
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 9, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'PPO', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 2 },
  { id: 'plot2', title: 'Histogram', color: '#26A69A', lineWidth: 4, style: 'histogram' },
];

export const metadata = {
  title: 'PPO Divergence',
  shortTitle: 'PPODiv',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<PPODivergenceInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { fastLength, slowLength, signalLength, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);

  const emaFast = ta.ema(source, fastLength);
  const emaSlow = ta.ema(source, slowLength);

  const emaFastArr = emaFast.toArray();
  const emaSlowArr = emaSlow.toArray();

  // PPO = (EMA_fast - EMA_slow) / EMA_slow * 100
  const ppoArr: number[] = new Array(bars.length);
  for (let i = 0; i < bars.length; i++) {
    const f = emaFastArr[i];
    const s = emaSlowArr[i];
    if (f == null || s == null || s === 0) {
      ppoArr[i] = NaN;
    } else {
      ppoArr[i] = ((f - s) / s) * 100;
    }
  }

  const ppoSeries = new Series(bars, (_b, i) => ppoArr[i]);
  const signalLine = ta.ema(ppoSeries, signalLength);
  const sigArr = signalLine.toArray();

  const histArr: number[] = new Array(bars.length);
  for (let i = 0; i < bars.length; i++) {
    const p = ppoArr[i];
    const s = sigArr[i];
    histArr[i] = (isNaN(p) || s == null) ? NaN : p - s;
  }

  // Pivot-based divergence detection
  const pivotLookback = 5;
  const phArr = ta.pivothigh(ppoSeries, pivotLookback, pivotLookback).toArray();
  const plArr = ta.pivotlow(ppoSeries, pivotLookback, pivotLookback).toArray();

  let lastPivotLowIdx = -1, lastPivotLowVal = NaN, lastPivotLowPrice = NaN;
  let lastPivotHighIdx = -1, lastPivotHighVal = NaN, lastPivotHighPrice = NaN;
  const markers: MarkerData[] = [];

  for (let i = pivotLookback; i < bars.length; i++) {
    if (plArr[i] != null && !isNaN(plArr[i] as number)) {
      const curVal = plArr[i] as number;
      const curPrice = bars[i].low;
      if (lastPivotLowIdx >= 0 && curPrice < lastPivotLowPrice && curVal > lastPivotLowVal) {
        markers.push({ time: bars[i].time as number, position: 'belowBar', shape: 'labelUp', color: '#26A69A', text: 'Bull' });
      }
      lastPivotLowIdx = i; lastPivotLowVal = curVal; lastPivotLowPrice = curPrice;
    }
    if (phArr[i] != null && !isNaN(phArr[i] as number)) {
      const curVal = phArr[i] as number;
      const curPrice = bars[i].high;
      if (lastPivotHighIdx >= 0 && curPrice > lastPivotHighPrice && curVal < lastPivotHighVal) {
        markers.push({ time: bars[i].time as number, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'Bear' });
      }
      lastPivotHighIdx = i; lastPivotHighVal = curVal; lastPivotHighPrice = curPrice;
    }
  }

  const warmup = slowLength;

  const toPlot = (arr: number[]) =>
    arr.map((v, i) => ({ time: bars[i].time, value: (i < warmup || isNaN(v)) ? NaN : v }));

  const histPlot = histArr.map((v, i) => {
    if (i < warmup || isNaN(v)) return { time: bars[i].time, value: NaN };
    return { time: bars[i].time, value: v, color: v >= 0 ? '#26A69A' : '#EF5350' };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': toPlot(ppoArr), 'plot1': toPlot(sigArr.map(v => v ?? NaN)), 'plot2': histPlot },
    hlines: [{ value: 0, options: { color: '#787B86', linestyle: 'dashed', title: 'Zero' } }],
    markers,
  };
}

export const PPODivergence = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
