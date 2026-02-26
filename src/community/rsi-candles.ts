/**
 * RSI Candles
 *
 * Applies RSI individually to open, high, low, close to produce RSI-OHLC values.
 * These can be rendered as candles in an oscillator pane (0-100 scale).
 *
 * Reference: TradingView "RSI Chart Bars" by Glaz
 *
 * PineScript display:
 *   plotcandle(rsiOpen, rsiHigh, rsiLow, rsiClose, "RSI", color=col, bordercolor=col, wickcolor=col)
 *   hline(70), hline(50), hline(30)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';

export interface RSICandlesInputs {
  length: number;
}

export const defaultInputs: RSICandlesInputs = {
  length: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
];

// No line plots — rendered via plotCandles
export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [
  { id: 'rsi', title: 'RSI Candles' },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_ob', price: 70, color: '#787B86', linestyle: 'dashed', title: 'Overbought' },
  { id: 'hline_mid', price: 50, color: '#787B86', linestyle: 'dashed', title: 'Middle' },
  { id: 'hline_os', price: 30, color: '#787B86', linestyle: 'dashed', title: 'Oversold' },
];

export const metadata = {
  title: 'RSI Candles',
  shortTitle: 'RSIC',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<RSICandlesInputs> = {}): IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> } {
  const { length } = { ...defaultInputs, ...inputs };

  const rsiOpen = ta.rsi(new Series(bars, (b) => b.open), length).toArray();
  const rsiHigh = ta.rsi(new Series(bars, (b) => b.high), length).toArray();
  const rsiLow = ta.rsi(new Series(bars, (b) => b.low), length).toArray();
  const rsiClose = ta.rsi(new Series(bars, (b) => b.close), length).toArray();

  const candles: PlotCandleData[] = [];

  for (let i = 0; i < bars.length; i++) {
    if (rsiOpen[i] == null || rsiClose[i] == null || rsiHigh[i] == null || rsiLow[i] == null) {
      candles.push({ time: bars[i].time as number, open: NaN, high: NaN, low: NaN, close: NaN });
      continue;
    }

    const o = rsiOpen[i]!;
    const h = rsiHigh[i]!;
    const l = rsiLow[i]!;
    const c = rsiClose[i]!;
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
    plotCandles: { rsi: candles },
  };
}

export const RSICandles = { calculate, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig, hlineConfig };
