/**
 * CM Heikin-Ashi Candlesticks V1
 *
 * Standard Heikin-Ashi OHLC candle overlay.
 * haClose = (O+H+L+C)/4, haOpen recurrently averaged, haHigh/haLow adjusted.
 *
 * Reference: TradingView "CM_Heikin-Ashi" by ChrisMoody
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData, BarColorData } from '../types';

export interface CMHeikinAshiInputs {}

export const defaultInputs: CMHeikinAshiInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [
  { id: 'candle0', title: 'HA Candle' },
];

export const metadata = {
  title: 'CM Heikin-Ashi',
  shortTitle: 'CMHA',
  overlay: true,
};

export function calculate(bars: Bar[], _inputs: Partial<CMHeikinAshiInputs> = {}): IndicatorResult & { plotCandles: Record<string, PlotCandleData[]>; barColors: BarColorData[] } {
  const n = bars.length;

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

  const candles: PlotCandleData[] = [];
  for (let i = 0; i < n; i++) {
    const col = haClose[i] >= haOpen[i] ? '#26A69A' : '#EF5350';
    candles.push({
      time: bars[i].time as number,
      open: haOpen[i],
      high: haHigh[i],
      low: haLow[i],
      close: haClose[i],
      color: col,
      borderColor: col,
      wickColor: col,
    });
  }

  // Pine: barcolor(heikUpColor() ? aqua: heikDownColor() ? red : na)
  // heikUpColor = haclose > haopen, heikDownColor = haclose <= haopen
  const barColors: BarColorData[] = [];
  for (let i = 0; i < n; i++) {
    if (haClose[i] > haOpen[i]) {
      barColors.push({ time: bars[i].time as number, color: '#00FFFF' }); // aqua
    } else {
      barColors.push({ time: bars[i].time as number, color: '#FF0000' }); // red
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    plotCandles: { candle0: candles },
    barColors,
  };
}

export const CMHeikinAshi = { calculate, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig };
