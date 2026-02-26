/**
 * OBV MACD Indicator
 *
 * Applies MACD calculation to On Balance Volume instead of price.
 * MACD Line = EMA(OBV, fast) - EMA(OBV, slow)
 * Signal = EMA(MACD, signal)
 * Histogram = MACD - Signal
 *
 * Reference: TradingView community indicator
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface OBVMACDInputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
  showSignal: boolean;
}

export const defaultInputs: OBVMACDInputs = {
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  showSignal: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 9, min: 1 },
  { id: 'showSignal', type: 'bool', title: 'Show Cross Signals', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trend', color: '#2962FF', lineWidth: 4 },
  { id: 'plot1', title: 'Up Signal', color: '#2962FF', lineWidth: 4, style: 'cross' },
  { id: 'plot2', title: 'Down Signal', color: '#FF0000', lineWidth: 4, style: 'cross' },
];

export const metadata = {
  title: 'OBV MACD',
  shortTitle: 'OBVMACD',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<OBVMACDInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { fastLength, slowLength, signalLength, showSignal } = { ...defaultInputs, ...inputs };

  // Compute OBV
  const obvArr: number[] = [];
  let obvCum = 0;
  for (let i = 0; i < bars.length; i++) {
    if (i > 0) {
      const vol = bars[i].volume ?? 0;
      if (bars[i].close > bars[i - 1].close) obvCum += vol;
      else if (bars[i].close < bars[i - 1].close) obvCum -= vol;
    }
    obvArr.push(obvCum);
  }

  const obvSeries = Series.fromArray(bars, obvArr);
  const fastEMA = ta.ema(obvSeries, fastLength);
  const slowEMA = ta.ema(obvSeries, slowLength);
  const macdLine = fastEMA.sub(slowEMA);
  const signalLine = ta.ema(macdLine, signalLength);
  const histogram = macdLine.sub(signalLine);

  const macdArr = macdLine.toArray();
  const sigArr = signalLine.toArray();
  const histArr = histogram.toArray();

  // oc: 1=uptrend (MACD > signal), -1=downtrend
  const oc: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    const h = histArr[i] ?? 0;
    if (h >= 0) oc.push(1);
    else oc.push(-1);
  }

  // b5 = macd - signal (same as histogram), colored by trend direction
  const plot0 = histArr.map((v, i) => ({
    time: bars[i].time,
    value: v ?? NaN,
    color: oc[i] === 1 ? '#2962FF' : '#FF0000',
  }));

  // Cross signals: up when histogram crosses above 0, down when crosses below
  const plot1 = histArr.map((v, i) => {
    if (!showSignal || i < 1) return { time: bars[i].time, value: NaN };
    const prev = histArr[i - 1] ?? 0;
    const cur = v ?? 0;
    const up = prev <= 0 && cur > 0;
    return { time: bars[i].time, value: up ? cur : NaN };
  });

  const plot2 = histArr.map((v, i) => {
    if (!showSignal || i < 1) return { time: bars[i].time, value: NaN };
    const prev = histArr[i - 1] ?? 0;
    const cur = v ?? 0;
    const down = prev >= 0 && cur < 0;
    return { time: bars[i].time, value: down ? cur : NaN };
  });

  // Pivot markers
  const markers: MarkerData[] = [];
  const lookback = 5;
  for (let i = lookback; i < bars.length - lookback; i++) {
    const h = histArr[i] ?? 0;
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if ((histArr[i - j] ?? 0) >= h || (histArr[i + j] ?? 0) >= h) isHigh = false;
      if ((histArr[i - j] ?? 0) <= h || (histArr[i + j] ?? 0) <= h) isLow = false;
    }
    if (isHigh && h > 0) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#FF0000', text: 'Pivot' });
    }
    if (isLow && h < 0) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#2962FF', text: 'Pivot' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2 },
    hlines: [{ value: 0, options: { color: '#000000', linestyle: 'solid', linewidth: 3, title: 'Zero' } }],
    markers,
  };
}

export const OBVMACD = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
