/**
 * Linear Regression Candles
 *
 * OHLC replaced by linear regression values with optional SMA smoothing.
 * Provides a smoothed candlestick representation of price.
 *
 * Reference: TradingView "Linear Regression Candles" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';

export interface LinRegCandlesInputs {
  length: number;
  smoothLen: number;
  signalLength: number;
  smaSignal: boolean;
}

export const defaultInputs: LinRegCandlesInputs = {
  length: 11,
  smoothLen: 1,
  signalLength: 11,
  smaSignal: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Linear Regression Length', defval: 11, min: 1 },
  { id: 'smoothLen', type: 'int', title: 'Smooth Length', defval: 1, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Smoothing', defval: 11, min: 1 },
  { id: 'smaSignal', type: 'bool', title: 'Simple MA (Signal Line)', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'signal', title: 'Signal', color: '#FFFFFF', lineWidth: 1 },
];

export const plotCandleConfig = [
  { id: 'candle0', title: 'LinReg Candle' },
];

export const metadata = {
  title: 'Linear Regression Candles',
  shortTitle: 'LRCandle',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<LinRegCandlesInputs> = {}): IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> } {
  const { length, smoothLen, signalLength, smaSignal } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const openSeries = new Series(bars, (b) => b.open);
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);
  const closeSeries = new Series(bars, (b) => b.close);

  // LinReg on each OHLC component
  const lrO = ta.linreg(openSeries, length, 0).toArray();
  const lrH = ta.linreg(highSeries, length, 0).toArray();
  const lrL = ta.linreg(lowSeries, length, 0).toArray();
  const lrC = ta.linreg(closeSeries, length, 0).toArray();

  // Optional SMA smoothing
  let finalO: (number | null)[];
  let finalH: (number | null)[];
  let finalL: (number | null)[];
  let finalC: (number | null)[];

  if (smoothLen > 1) {
    const lrOSeries = new Series(bars, (_b, i) => lrO[i] ?? NaN);
    const lrHSeries = new Series(bars, (_b, i) => lrH[i] ?? NaN);
    const lrLSeries = new Series(bars, (_b, i) => lrL[i] ?? NaN);
    const lrCSeries = new Series(bars, (_b, i) => lrC[i] ?? NaN);

    finalO = ta.sma(lrOSeries, smoothLen).toArray();
    finalH = ta.sma(lrHSeries, smoothLen).toArray();
    finalL = ta.sma(lrLSeries, smoothLen).toArray();
    finalC = ta.sma(lrCSeries, smoothLen).toArray();
  } else {
    finalO = lrO;
    finalH = lrH;
    finalL = lrL;
    finalC = lrC;
  }

  const warmup = length + smoothLen;
  const candles: PlotCandleData[] = [];

  for (let i = 0; i < n; i++) {
    if (i < warmup || finalO[i] == null || finalC[i] == null) {
      candles.push({ time: bars[i].time as number, open: NaN, high: NaN, low: NaN, close: NaN });
      continue;
    }

    const o = finalO[i]!;
    const h = finalH[i]!;
    const l = finalL[i]!;
    const c = finalC[i]!;
    const col = c >= o ? '#26A69A' : '#EF5350';

    candles.push({
      time: bars[i].time as number,
      open: o,
      high: h,
      low: l,
      close: c,
      color: col,
      borderColor: col,
      wickColor: col,
    });
  }

  // Pine: signal = sma_signal ? sma(bclose, signal_length) : ema(bclose, signal_length)
  // Compute signal from the linreg close values (finalC)
  const closeSeries2 = new Series(bars, (_b, i) => (finalC[i] != null && i >= warmup) ? finalC[i]! : NaN);
  const signalArr = smaSignal
    ? ta.sma(closeSeries2, signalLength).toArray()
    : ta.ema(closeSeries2, signalLength).toArray();

  const signalWarmup = warmup + signalLength;
  const signalPlot = signalArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < signalWarmup || v == null || isNaN(v)) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { signal: signalPlot },
    plotCandles: { candle0: candles },
  };
}

export const LinRegCandles = { calculate, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig };
