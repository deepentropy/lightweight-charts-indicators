/**
 * Market Shift Levels [ChartPrime]
 *
 * Detect market structure shifts using HMA crossovers.
 * Plots shift level, colored candles, bar colors, and reversal labels.
 *
 * Reference: TradingView "Market Shift Levels [ChartPrime]" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData, PlotCandleData, LabelData } from '../types';

export interface MarketShiftLevelsInputs {
  length: number;
  labelData: 'Volume' | 'Price';
}

export const defaultInputs: MarketShiftLevelsInputs = {
  length: 55,
  labelData: 'Volume',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 55, min: 1 },
  { id: 'labelData', type: 'string', title: 'Label Data', defval: 'Volume', options: ['Volume', 'Price'] },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Market Shift Level', color: '#787B86', lineWidth: 2 },
];

export const metadata = {
  title: 'Market Shift Levels',
  shortTitle: 'MSL',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<MarketShiftLevelsInputs> = {}): IndicatorResult & { barColors: BarColorData[]; plotCandles: Record<string, PlotCandleData[]>; labels: LabelData[] } {
  const { length, labelData } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const useLblVol = labelData === 'Volume';

  const closeSeries = new Series(bars, (b) => b.close);

  // Pine: hma1 = ta.hma(close, length), hma2 = hma1[5]
  const hmaArr = ta.hma(closeSeries, length).toArray();

  // level tracks the shift level
  let level = NaN;
  const levelArr: number[] = new Array(n);

  const warmup = length + 5;

  for (let i = 0; i < n; i++) {
    if (i < warmup || hmaArr[i] == null) {
      levelArr[i] = NaN;
      continue;
    }
    const hma1 = hmaArr[i]!;
    const hma2 = i >= 5 ? (hmaArr[i - 5] ?? NaN) : NaN;

    if (!isNaN(hma2)) {
      // Pine: crossover(hma1, hma2) => level := low
      const prevHma1 = hmaArr[i - 1] ?? NaN;
      const prevHma2 = i >= 6 ? (hmaArr[i - 6] ?? NaN) : NaN;
      if (!isNaN(prevHma1) && !isNaN(prevHma2)) {
        if (prevHma1 <= prevHma2 && hma1 > hma2) {
          level = bars[i].low;
        }
        if (prevHma1 >= prevHma2 && hma1 < hma2) {
          level = bars[i].high;
        }
      }
    }
    levelArr[i] = level;
  }

  // Pine: plot(level != level[1] ? na : level, ..., style=plot.style_linebr)
  // Also: color = bar_index % 2 == 0 ? na : chart.fg_color  (alternating visibility)
  const shiftPlot: { time: number; value: number; color?: string }[] = [];
  for (let i = 0; i < n; i++) {
    const lvl = levelArr[i];
    const prevLvl = i > 0 ? levelArr[i - 1] : NaN;
    if (isNaN(lvl) || lvl !== prevLvl) {
      shiftPlot.push({ time: bars[i].time, value: NaN });
    } else {
      shiftPlot.push({ time: bars[i].time, value: lvl });
    }
  }

  // Pine barcolor(shift_col): close < level => red, close >= level => green
  // Pine plotcandle colored by shift_col
  const barColors: BarColorData[] = [];
  const candles: PlotCandleData[] = [];
  for (let i = warmup; i < n; i++) {
    const lvl = levelArr[i];
    if (isNaN(lvl)) continue;
    const color = bars[i].close < lvl ? '#E12B2B' : '#24D580';
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

  // Reversal detection labels
  // Pine: if high[2] < level and high < level and high[1] > level => label down at bar_index-1
  // Pine: if low[2] > level and low[1] < level and low > level => label up at bar_index-1
  const labels: LabelData[] = [];
  for (let i = 2; i < n; i++) {
    const lvl = levelArr[i];
    if (isNaN(lvl)) continue;

    const volSum = (bars[i].volume ?? 0) + (i >= 1 ? (bars[i - 1].volume ?? 0) : 0) + (i >= 2 ? (bars[i - 2].volume ?? 0) : 0);

    // Bearish reversal: wick above level then rejected
    if (bars[i - 2].high < lvl && bars[i].high < lvl && bars[i - 1].high > lvl) {
      const labelText = useLblVol
        ? formatVolume(volSum) + '\n\u2B19'
        : bars[i - 1].high.toFixed(2) + '\n\u2B19';
      labels.push({
        time: bars[i - 1].time,
        price: bars[i - 1].high,
        text: labelText,
        textColor: '#FF0000',
        style: 'label_down',
      });
    }

    // Bullish reversal: wick below level then recovered
    if (bars[i - 2].low > lvl && bars[i - 1].low < lvl && bars[i].low > lvl) {
      const labelText = '\u2B18\n' + (useLblVol
        ? formatVolume(volSum)
        : bars[i - 1].high.toFixed(2));
      labels.push({
        time: bars[i - 1].time,
        price: bars[i - 1].low,
        text: labelText,
        textColor: '#00FF00',
        style: 'label_up',
      });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': shiftPlot },
    barColors,
    plotCandles: { candle0: candles },
    labels,
  };
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(1) + 'K';
  return v.toFixed(0);
}

export const MarketShiftLevels = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
