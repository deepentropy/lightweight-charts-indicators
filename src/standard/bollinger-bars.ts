/**
 * Bollinger Bars Indicator
 *
 * Visual candle indicator with two plotcandle layers:
 * 1. Wicks: (high, high, low, low) - navy blue outline
 * 2. Body: (open, high, low, close) - green up / red down candle body
 *
 * PineScript reference:
 *   plotcandle(high, high, low, low, "Bollinger Bars Wicks", color=#0D349E, bordercolor=#0D349E, wickcolor=na)
 *   plotcandle(open, high, low, close, "Bollinger Bars Body", color=col, bordercolor=col, wickcolor=na)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';

export interface BollingerBarsInputs {
  // No configurable inputs
}

export const defaultInputs: BollingerBarsInputs = {};

export const inputConfig: InputConfig[] = [];

// No line plots needed — everything goes through plotCandles
export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [
  { id: 'wicks', title: 'Bollinger Bars Wicks' },
  { id: 'body', title: 'Bollinger Bars Body' },
];

export const metadata = {
  title: 'Bollinger Bars',
  shortTitle: 'BB Bars',
  overlay: true,
};

export function calculate(bars: Bar[], _inputs: Partial<BollingerBarsInputs> = {}): IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> } {
  // Wicks: plotcandle(high, high, low, low) — all navy blue
  const wicks: PlotCandleData[] = bars.map(b => ({
    time: b.time as number,
    open: b.high,
    high: b.high,
    low: b.low,
    close: b.low,
    color: '#0D349E',
    borderColor: '#0D349E',
    wickColor: '#0D349E',
  }));

  // Body: plotcandle(open, high, low, close) — green if up, red if down
  const body: PlotCandleData[] = bars.map(b => {
    const col = b.close > b.open ? '#089981' : '#F23645';
    return {
      time: b.time as number,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      color: col,
      borderColor: col,
    };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    plotCandles: { wicks, body },
  };
}

export const BollingerBars = { calculate, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig };
