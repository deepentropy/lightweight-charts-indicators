/**
 * Easy Entry/Exit Trend Colors
 *
 * Simple trend coloring using EMA. Green when close > EMA and EMA is rising,
 * red when close < EMA and EMA is falling.
 *
 * Reference: TradingView "Easy Entry/Exit Trend Colors" (community)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface EasyTrendColorsInputs {
  length: number;
  src: SourceType;
}

export const defaultInputs: EasyTrendColorsInputs = {
  length: 20,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Easy Entry/Exit Trend Colors',
  shortTitle: 'EasyTrend',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<EasyTrendColorsInputs> = {}): IndicatorResult {
  const { length, src } = { ...defaultInputs, ...inputs };

  const srcSeries = getSourceSeries(bars, src);
  const emaArr = ta.ema(srcSeries, length).toArray();

  const warmup = length;

  const plot0 = emaArr.map((v, i) => {
    if (i < warmup || isNaN(v)) return { time: bars[i].time, value: NaN };
    const rising = i > 0 && v > (emaArr[i - 1] ?? 0);
    const bullish = bars[i].close > v && rising;
    const bearish = bars[i].close < v && !rising;
    const color = bullish ? '#26A69A' : bearish ? '#EF5350' : '#787B86';
    return { time: bars[i].time, value: v, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
  };
}

export const EasyTrendColors = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
