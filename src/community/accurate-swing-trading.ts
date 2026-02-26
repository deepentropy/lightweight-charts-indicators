/**
 * Accurate Swing Trading System
 *
 * Swing support/resistance with buy/sell signals.
 * TSL line based on highest/lowest over swing length, colored by direction.
 *
 * Reference: TradingView "Accurate Swing Trading System" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData, BgColorData } from '../types';

export interface AccurateSwingTradingInputs {
  swingLength: number;
  showBarColor: boolean;
  showBgColor: boolean;
}

export const defaultInputs: AccurateSwingTradingInputs = {
  swingLength: 3,
  showBarColor: true,
  showBgColor: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'swingLength', type: 'int', title: 'Swing Length', defval: 3, min: 1 },
  { id: 'showBarColor', type: 'bool', title: 'Color Bars', defval: true },
  { id: 'showBgColor', type: 'bool', title: 'Background Color', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'TSL', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Accurate Swing Trading',
  shortTitle: 'AST',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<AccurateSwingTradingInputs> = {}): IndicatorResult {
  const { swingLength, showBarColor, showBgColor } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);
  const hh = ta.highest(highSeries, swingLength).toArray();
  const ll = ta.lowest(lowSeries, swingLength).toArray();

  // TSL with direction tracking
  const tslArr: number[] = new Array(n);
  const dirArr: number[] = new Array(n); // 1 = up (long), -1 = down (short)

  for (let i = 0; i < n; i++) {
    const close = bars[i].close;

    if (i === 0) {
      const v = ll[i];
      tslArr[i] = (v == null || isNaN(v)) ? bars[i].low : v;
      dirArr[i] = 1;
      continue;
    }

    const prevTsl = tslArr[i - 1];
    const prevDir = dirArr[i - 1];

    if (prevDir === 1) {
      // Long: TSL = max(prevTSL, lowest low)
      const newTsl = isNaN(ll[i] as number) ? bars[i].low : (ll[i] ?? bars[i].low);
      tslArr[i] = isNaN(prevTsl) ? newTsl : Math.max(prevTsl, newTsl);
      dirArr[i] = close < tslArr[i] ? -1 : 1;
    } else {
      // Short: TSL = min(prevTSL, highest high)
      const newTsl = isNaN(hh[i] as number) ? bars[i].high : (hh[i] ?? bars[i].high);
      tslArr[i] = isNaN(prevTsl) ? newTsl : Math.min(prevTsl, newTsl);
      dirArr[i] = close > tslArr[i] ? 1 : -1;
    }
  }

  const warmup = swingLength;
  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];
  const bgColors: BgColorData[] = [];

  const tslPlot = tslArr.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const bullish = dirArr[i] === 1;
    const color = bullish ? '#26A69A' : '#EF5350';

    if (showBarColor) barColors.push({ time: bars[i].time as number, color });
    if (showBgColor) bgColors.push({ time: bars[i].time as number, color: bullish ? 'rgba(38,166,154,0.1)' : 'rgba(239,83,80,0.1)' });

    return { time: bars[i].time, value: v, color };
  });

  // Buy/sell signals on direction change
  for (let i = warmup; i < n; i++) {
    if (i > 0 && dirArr[i] !== dirArr[i - 1]) {
      if (dirArr[i] === 1) {
        markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#26A69A', text: 'Buy' });
      } else {
        markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'Sell' });
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': tslPlot },
    markers,
    barColors,
    bgColors,
  } as IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[]; bgColors: BgColorData[] };
}

export const AccurateSwingTrading = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
