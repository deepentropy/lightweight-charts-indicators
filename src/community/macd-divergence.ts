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
  src: SourceType;
}

export const defaultInputs: MACDDivergenceInputs = {
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  pivotLookback: 5,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 9, min: 1 },
  { id: 'pivotLookback', type: 'int', title: 'Pivot Lookback', defval: 5, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MACD', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 2 },
  { id: 'plot2', title: 'Histogram', color: '#26A69A', lineWidth: 4, style: 'histogram' },
];

export const metadata = {
  title: 'MACD Divergence',
  shortTitle: 'MACDDiv',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<MACDDivergenceInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { fastLength, slowLength, signalLength, pivotLookback, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);

  const fastEMA = ta.ema(source, fastLength);
  const slowEMA = ta.ema(source, slowLength);
  const macdLine = fastEMA.sub(slowEMA);
  const signalLine = ta.ema(macdLine, signalLength);
  const histogram = macdLine.sub(signalLine);

  const macdArr = macdLine.toArray();
  const sigArr = signalLine.toArray();
  const histArr = histogram.toArray();

  // Pivot detection on MACD for divergence
  const phArr = ta.pivothigh(macdLine, pivotLookback, pivotLookback).toArray();
  const plArr = ta.pivotlow(macdLine, pivotLookback, pivotLookback).toArray();

  const warmup = slowLength;

  const toPlot = (arr: (number | null)[]) =>
    arr.map((v, i) => ({ time: bars[i].time, value: (i < warmup || v == null) ? NaN : v }));

  const histPlot = histArr.map((v, i) => {
    if (i < warmup || v == null) return { time: bars[i].time, value: NaN };
    const prev = i > 0 ? (histArr[i - 1] ?? NaN) : NaN;
    let color: string;
    if (v >= 0) {
      color = v > prev ? '#00E676' : '#26A69A';
    } else {
      color = v < prev ? '#FF5252' : '#EF5350';
    }
    return { time: bars[i].time, value: v, color };
  });

  // Detect divergences using pivots
  let lastPivotLowIdx = -1;
  let lastPivotLowVal = NaN;
  let lastPivotLowPrice = NaN;
  let lastPivotHighIdx = -1;
  let lastPivotHighVal = NaN;
  let lastPivotHighPrice = NaN;

  const markers: MarkerData[] = [];

  for (let i = pivotLookback; i < bars.length; i++) {
    if (plArr[i] != null && !isNaN(plArr[i] as number)) {
      const curMacdLow = plArr[i] as number;
      const curPriceLow = bars[i].low;
      if (lastPivotLowIdx >= 0 && curPriceLow < lastPivotLowPrice && curMacdLow > lastPivotLowVal) {
        markers.push({ time: bars[i].time as number, position: 'belowBar', shape: 'labelUp', color: '#26A69A', text: 'Bull' });
      }
      lastPivotLowIdx = i;
      lastPivotLowVal = curMacdLow;
      lastPivotLowPrice = curPriceLow;
    }

    if (phArr[i] != null && !isNaN(phArr[i] as number)) {
      const curMacdHigh = phArr[i] as number;
      const curPriceHigh = bars[i].high;
      if (lastPivotHighIdx >= 0 && curPriceHigh > lastPivotHighPrice && curMacdHigh < lastPivotHighVal) {
        markers.push({ time: bars[i].time as number, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'Bear' });
      }
      lastPivotHighIdx = i;
      lastPivotHighVal = curMacdHigh;
      lastPivotHighPrice = curPriceHigh;
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': toPlot(macdArr), 'plot1': toPlot(sigArr), 'plot2': histPlot },
    hlines: [{ value: 0, options: { color: '#787B86', linestyle: 'dashed', title: 'Zero' } }],
    markers,
  };
}

export const MACDDivergence = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
