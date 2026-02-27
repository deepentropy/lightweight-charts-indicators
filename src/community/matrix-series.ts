/**
 * Matrix Series
 *
 * Series of oscillators in a matrix format.
 * Combines RSI and ROC (momentum) into a single normalized oscillator.
 *
 * Reference: TradingView "Matrix Series" (community)
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { PlotCandleData } from '../types';

export interface MatrixSeriesInputs {
  length: number;
  src: SourceType;
}

export const defaultInputs: MatrixSeriesInputs = {
  length: 14,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Matrix', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Matrix Series',
  shortTitle: 'MTX',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<MatrixSeriesInputs> = {}): IndicatorResult & { plotCandles: { candle0: PlotCandleData[] } } {
  const { length, src } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const nn = 5; // Pine: Smoother input, default 5

  const source = getSourceSeries(bars, src);
  const rsi = ta.rsi(source, length);
  const roc = ta.roc(source, length);

  const rsiArr = rsi.toArray();
  const rocArr = roc.toArray();
  const warmup = length;

  const plot0 = bars.map((b, i) => {
    if (i < warmup || rsiArr[i] == null || rocArr[i] == null) {
      return { time: b.time, value: NaN };
    }
    const rsiCentered = (rsiArr[i]! - 50);
    const combined = (rsiCentered + rocArr[i]!) / 2;
    return { time: b.time, value: combined };
  });

  // plotcandle from Pine: ys1 = (high+low+close*2)/4, then series of EMA/stdev transforms
  const ys1Series = new Series(bars, (b) => (b.high + b.low + b.close * 2) / 4);
  const rk3 = ta.ema(ys1Series, nn);
  const rk4 = ta.stdev(ys1Series, nn);
  const rk3Arr = rk3.toArray();
  const rk4Arr = rk4.toArray();

  const rk5Arr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const ys1Val = (bars[i].high + bars[i].low + bars[i].close * 2) / 4;
    const r3 = rk3Arr[i] ?? NaN;
    const r4 = rk4Arr[i] ?? NaN;
    rk5Arr[i] = (r4 !== 0 && !isNaN(r4)) ? (ys1Val - r3) * 200 / r4 : 0;
  }
  const rk5Series = new Series(bars, (_b, i) => rk5Arr[i]);
  const rk6 = ta.ema(rk5Series, nn);
  const upSeries = ta.ema(rk6, nn);
  const downSeries = ta.ema(upSeries, nn);
  const upArr = upSeries.toArray();
  const downArr = downSeries.toArray();

  const candles: PlotCandleData[] = bars.map((b, i) => {
    const up = upArr[i] ?? NaN;
    const dn = downArr[i] ?? NaN;
    if (isNaN(up) || isNaN(dn) || i < nn * 4) {
      return { time: b.time, open: NaN, high: NaN, low: NaN, close: NaN };
    }
    const Oo = Math.min(up, dn);
    const Ll = Math.max(up, dn);
    const color = up > dn ? '#26A69A' : '#EF5350';
    return { time: b.time, open: Oo, high: Oo, low: Ll, close: Ll, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'solid' as const, title: 'Zero' } },
    ],
    plotCandles: { candle0: candles },
  };
}

export const MatrixSeries = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
