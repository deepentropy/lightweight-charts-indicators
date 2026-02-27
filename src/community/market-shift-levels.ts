/**
 * Market Shift Levels
 *
 * Detect market structure shifts by tracking swing highs/lows.
 * A bullish shift occurs when price breaks above a swing high.
 * A bearish shift occurs when price breaks below a swing low.
 * The break level is plotted as a horizontal line.
 *
 * Reference: TradingView "Market Shift Levels" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData, PlotCandleData } from '../types';

export interface MarketShiftLevelsInputs {
  pivotLen: number;
}

export const defaultInputs: MarketShiftLevelsInputs = {
  pivotLen: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'pivotLen', type: 'int', title: 'Pivot Length', defval: 5, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Shift Level', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Market Shift Levels',
  shortTitle: 'MSL',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<MarketShiftLevelsInputs> = {}): IndicatorResult & { barColors: BarColorData[]; plotCandles: Record<string, PlotCandleData[]> } {
  const { pivotLen } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const phArr = ta.pivothigh(highSeries, pivotLen, pivotLen).toArray();
  const plArr = ta.pivotlow(lowSeries, pivotLen, pivotLen).toArray();

  const warmup = pivotLen * 2;
  let lastPH = NaN;
  let lastPL = NaN;
  let shiftLevel = NaN;
  let shiftDir = 0; // 1 = bullish, -1 = bearish

  const shiftPlot: { time: number; value: number; color?: string }[] = [];

  for (let i = 0; i < n; i++) {
    if (i >= warmup && !isNaN(phArr[i]) && phArr[i] !== 0) {
      lastPH = phArr[i];
    }
    if (i >= warmup && !isNaN(plArr[i]) && plArr[i] !== 0) {
      lastPL = plArr[i];
    }

    // Detect market structure shift
    if (!isNaN(lastPH) && bars[i].close > lastPH && shiftDir !== 1) {
      shiftLevel = lastPH;
      shiftDir = 1;
    } else if (!isNaN(lastPL) && bars[i].close < lastPL && shiftDir !== -1) {
      shiftLevel = lastPL;
      shiftDir = -1;
    }

    const color = shiftDir === 1 ? '#26A69A' : shiftDir === -1 ? '#EF5350' : '#787B86';
    shiftPlot.push({ time: bars[i].time, value: i < warmup ? NaN : shiftLevel, color });
  }

  // Pine barcolor(shift_col): close < level => red, close >= level => green
  // Pine plotcandle(open, high, low, close, color=shift_col, wickcolor=shift_col, bordercolor=shift_col)
  const barColors: BarColorData[] = [];
  const candles: PlotCandleData[] = [];
  for (let i = warmup; i < n; i++) {
    const lvl = shiftPlot[i].value;
    if (isNaN(lvl)) continue;
    const color = bars[i].close < lvl ? '#EF5350' : '#26A69A';
    barColors.push({ time: bars[i].time, color });
    candles.push({
      time: bars[i].time,
      open: bars[i].open,
      high: bars[i].high,
      low: bars[i].low,
      close: bars[i].close,
      color,
      borderColor: color,
      wickColor: color,
    });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': shiftPlot },
    barColors,
    plotCandles: { candle0: candles },
  };
}

export const MarketShiftLevels = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
