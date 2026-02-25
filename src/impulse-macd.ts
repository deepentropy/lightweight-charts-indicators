/**
 * Impulse MACD
 *
 * SMMA channel (high/low) + ZLEMA of hlc3.
 * When ZLEMA > SMMA(high): impulse = ZLEMA - SMMA(high) (bullish)
 * When ZLEMA < SMMA(low): impulse = ZLEMA - SMMA(low) (bearish)
 * Otherwise: 0 (neutral, filtering whipsaw)
 *
 * Reference: TradingView "Impulse MACD" by LazyBear
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface ImpulseMACDInputs {
  lengthMA: number;
  lengthSignal: number;
}

export const defaultInputs: ImpulseMACDInputs = {
  lengthMA: 34,
  lengthSignal: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'lengthMA', type: 'int', title: 'Length MA', defval: 34, min: 1 },
  { id: 'lengthSignal', type: 'int', title: 'Length Signal', defval: 9, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ImpulseMACD', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 2 },
  { id: 'plot2', title: 'Histogram', color: '#26A69A', lineWidth: 4 },
];

export const metadata = {
  title: 'Impulse MACD',
  shortTitle: 'IMACD',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<ImpulseMACDInputs> = {}): IndicatorResult {
  const { lengthMA, lengthSignal } = { ...defaultInputs, ...inputs };

  const hlc3 = getSourceSeries(bars, 'hlc3');
  const highSeries = getSourceSeries(bars, 'high');
  const lowSeries = getSourceSeries(bars, 'low');

  // SMMA = RMA in oakscriptjs
  const hi = ta.rma(highSeries, lengthMA);
  const lo = ta.rma(lowSeries, lengthMA);

  // ZLEMA = EMA + (EMA - EMA(EMA))
  const ema1 = ta.ema(hlc3, lengthMA);
  const ema2 = ta.ema(ema1, lengthMA);
  const mi = ema1.add(ema1.sub(ema2)); // zlema = ema1 + (ema1 - ema2)

  // Impulse: above hi channel = bullish, below lo channel = bearish, else 0
  const miArr = mi.toArray();
  const hiArr = hi.toArray();
  const loArr = lo.toArray();

  const mdArr: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    const m = miArr[i] ?? NaN;
    const h = hiArr[i] ?? NaN;
    const l = loArr[i] ?? NaN;
    if (isNaN(m) || isNaN(h) || isNaN(l)) {
      mdArr.push(NaN);
    } else if (m > h) {
      mdArr.push(m - h);
    } else if (m < l) {
      mdArr.push(m - l);
    } else {
      mdArr.push(0);
    }
  }

  // Signal = SMA of md
  // We need to compute SMA manually since md is a plain array
  const sbArr: number[] = [];
  for (let i = 0; i < mdArr.length; i++) {
    if (i < lengthSignal - 1 || isNaN(mdArr[i])) {
      sbArr.push(NaN);
    } else {
      let sum = 0;
      let count = 0;
      for (let j = 0; j < lengthSignal; j++) {
        const v = mdArr[i - j];
        if (!isNaN(v)) { sum += v; count++; }
      }
      sbArr.push(count > 0 ? sum / count : NaN);
    }
  }

  const shArr = mdArr.map((md, i) => {
    const sb = sbArr[i];
    return isNaN(md) || isNaN(sb) ? NaN : md - sb;
  });

  const toPlot = (arr: number[]) =>
    arr.map((value, i) => ({ time: bars[i].time, value: isNaN(value) ? NaN : value }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': toPlot(mdArr), 'plot1': toPlot(sbArr), 'plot2': toPlot(shArr) },
  };
}

export const ImpulseMACD = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
