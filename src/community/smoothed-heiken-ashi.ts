/**
 * Smoothed Heiken Ashi Candles v1
 *
 * Two-pass smoothing: first EMA-smooth raw OHLC, then compute Heiken Ashi
 * on smoothed data, then EMA-smooth the HA candles again.
 *
 * Reference: TradingView "Smoothed Heiken Ashi Candles v1" by jackvmk
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';

export interface SmoothedHeikenAshiInputs {
  emaLength1: number;
  emaLength2: number;
}

export const defaultInputs: SmoothedHeikenAshiInputs = {
  emaLength1: 10,
  emaLength2: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaLength1', type: 'int', title: 'EMA Length 1', defval: 10, min: 1 },
  { id: 'emaLength2', type: 'int', title: 'EMA Length 2', defval: 10, min: 1 },
];

export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [
  { id: 'sha', title: 'Smoothed HA' },
];

export const metadata = {
  title: 'Smoothed Heiken Ashi',
  shortTitle: 'SmHA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<SmoothedHeikenAshiInputs> = {}): IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> } {
  const { emaLength1, emaLength2 } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // Step 1: EMA smooth each OHLC
  const openSeries = new Series(bars, (b) => b.open);
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);
  const closeSeries = new Series(bars, (b) => b.close);

  const o1 = ta.ema(openSeries, emaLength1).toArray();
  const h1 = ta.ema(highSeries, emaLength1).toArray();
  const l1 = ta.ema(lowSeries, emaLength1).toArray();
  const c1 = ta.ema(closeSeries, emaLength1).toArray();

  // Step 2: Heiken Ashi on smoothed values
  const haClose: number[] = new Array(n);
  const haOpen: number[] = new Array(n);
  const haHigh: number[] = new Array(n);
  const haLow: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const oo = isNaN(o1[i]) ? bars[i].open : o1[i];
    const hh = isNaN(h1[i]) ? bars[i].high : h1[i];
    const ll = isNaN(l1[i]) ? bars[i].low : l1[i];
    const cc = isNaN(c1[i]) ? bars[i].close : c1[i];

    haClose[i] = (oo + hh + ll + cc) / 4;

    if (i === 0) {
      haOpen[i] = (oo + cc) / 2;
    } else {
      haOpen[i] = (haOpen[i - 1] + haClose[i - 1]) / 2;
    }

    haHigh[i] = Math.max(hh, haOpen[i], haClose[i]);
    haLow[i] = Math.min(ll, haOpen[i], haClose[i]);
  }

  // Step 3: EMA smooth the HA candles
  const haOpenSeries = new Series(bars, (_b, i) => haOpen[i]);
  const haHighSeries = new Series(bars, (_b, i) => haHigh[i]);
  const haLowSeries = new Series(bars, (_b, i) => haLow[i]);
  const haCloseSeries = new Series(bars, (_b, i) => haClose[i]);

  const finalO = ta.ema(haOpenSeries, emaLength2).toArray();
  const finalH = ta.ema(haHighSeries, emaLength2).toArray();
  const finalL = ta.ema(haLowSeries, emaLength2).toArray();
  const finalC = ta.ema(haCloseSeries, emaLength2).toArray();

  const warmup = emaLength1 + emaLength2;
  const candles: PlotCandleData[] = [];

  for (let i = 0; i < n; i++) {
    if (i < warmup || finalO[i] == null || finalC[i] == null || !isFinite(finalO[i]!) || !isFinite(finalC[i]!)) {
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

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    plotCandles: { sha: candles },
  };
}

export const SmoothedHeikenAshi = { calculate, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig };
