/**
 * CM Modified Heikin-Ashi TrendBars
 *
 * Modified Heikin-Ashi using EMA smoothing on HA values.
 * First computes standard HA candles, then smooths each OHLC with EMA.
 *
 * Reference: TradingView "CM_Modified_HeikinAshi" by ChrisMoody
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';

export interface ModifiedHeikinAshiInputs {
  emaLen: number;
}

export const defaultInputs: ModifiedHeikinAshiInputs = {
  emaLen: 6,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaLen', type: 'int', title: 'EMA Length', defval: 6, min: 1 },
];

export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [
  { id: 'candle0', title: 'Modified HA' },
];

export const metadata = {
  title: 'Modified Heikin-Ashi',
  shortTitle: 'ModHA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<ModifiedHeikinAshiInputs> = {}): IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> } {
  const { emaLen } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // Step 1: Standard HA candles
  const haClose: number[] = new Array(n);
  const haOpen: number[] = new Array(n);
  const haHigh: number[] = new Array(n);
  const haLow: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const { open, high, low, close } = bars[i];

    haClose[i] = (open + high + low + close) / 4;

    if (i === 0) {
      haOpen[i] = (open + close) / 2;
    } else {
      haOpen[i] = (haOpen[i - 1] + haClose[i - 1]) / 2;
    }

    haHigh[i] = Math.max(high, haOpen[i], haClose[i]);
    haLow[i] = Math.min(low, haOpen[i], haClose[i]);
  }

  // Step 2: EMA smooth each HA component
  const haOpenSeries = new Series(bars, (_b, i) => haOpen[i]);
  const haHighSeries = new Series(bars, (_b, i) => haHigh[i]);
  const haLowSeries = new Series(bars, (_b, i) => haLow[i]);
  const haCloseSeries = new Series(bars, (_b, i) => haClose[i]);

  const smoothO = ta.ema(haOpenSeries, emaLen).toArray();
  const smoothH = ta.ema(haHighSeries, emaLen).toArray();
  const smoothL = ta.ema(haLowSeries, emaLen).toArray();
  const smoothC = ta.ema(haCloseSeries, emaLen).toArray();

  const warmup = emaLen;
  const candles: PlotCandleData[] = [];

  for (let i = 0; i < n; i++) {
    if (i < warmup || smoothO[i] == null || smoothC[i] == null) {
      candles.push({ time: bars[i].time as number, open: NaN, high: NaN, low: NaN, close: NaN });
      continue;
    }

    const o = smoothO[i]!;
    const h = smoothH[i]!;
    const l = smoothL[i]!;
    const c = smoothC[i]!;
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
    plotCandles: { candle0: candles },
  };
}

export const ModifiedHeikinAshi = { calculate, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig };
