/**
 * Slow Heiken Ashi
 *
 * Heikin-Ashi candles smoothed with SMA for a slower, smoother view.
 *
 * Reference: TradingView "Slow Heiken Ashi" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData, MarkerData } from '../types';

export interface SlowHeikenAshiInputs {
  length: number;
}

export const defaultInputs: SlowHeikenAshiInputs = {
  length: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
];

export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [
  { id: 'candle0', title: 'Slow HA' },
];

export const metadata = {
  title: 'Slow Heiken Ashi',
  shortTitle: 'SlowHA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<SlowHeikenAshiInputs> = {}): IndicatorResult & { plotCandles: Record<string, PlotCandleData[]>; markers: MarkerData[] } {
  const { length } = { ...defaultInputs, ...inputs };
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

  // Step 2: SMA smooth each HA component
  const haOpenSeries = new Series(bars, (_b, i) => haOpen[i]);
  const haHighSeries = new Series(bars, (_b, i) => haHigh[i]);
  const haLowSeries = new Series(bars, (_b, i) => haLow[i]);
  const haCloseSeries = new Series(bars, (_b, i) => haClose[i]);

  const smoothO = ta.sma(haOpenSeries, length).toArray();
  const smoothH = ta.sma(haHighSeries, length).toArray();
  const smoothL = ta.sma(haLowSeries, length).toArray();
  const smoothC = ta.sma(haCloseSeries, length).toArray();

  const warmup = length;
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

  // Markers: HA color flip signals
  const markers: MarkerData[] = [];
  for (let i = warmup + 1; i < n; i++) {
    const o = smoothO[i];
    const c = smoothC[i];
    const po = smoothO[i - 1];
    const pc = smoothC[i - 1];
    if (o == null || c == null || po == null || pc == null) continue;

    const prevBullish = pc >= po; // previous candle was bullish (green)
    const currBullish = c >= o;

    // Cross(vOpen, vClose) means color flipped
    if (prevBullish && !currBullish) {
      // Was bullish, now bearish -> bearish signal (▼)
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#FFFFFF', text: 'Sell' });
    }
    if (!prevBullish && currBullish) {
      // Was bearish, now bullish -> bullish signal (▲)
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#FFFFFF', text: 'Buy' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    plotCandles: { candle0: candles },
    markers,
  };
}

export const SlowHeikenAshi = { calculate, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig };
