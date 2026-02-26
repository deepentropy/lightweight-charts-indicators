/**
 * CM EMA Trend Bars
 *
 * EMA-based bar coloring. Bars colored lime when hlc3 >= EMA, red otherwise.
 * EMA line also colored dynamically.
 *
 * Reference: TradingView "CM_EMA TrendBars" by ChrisMoody
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface CMEMATrendBarsInputs {
  emaLength: number;
  showEma: boolean;
}

export const defaultInputs: CMEMATrendBarsInputs = {
  emaLength: 34,
  showEma: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaLength', type: 'int', title: 'EMA Length', defval: 34, min: 1 },
  { id: 'showEma', type: 'bool', title: 'Show EMA', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'CM EMA Trend Bars',
  shortTitle: 'CM EMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<CMEMATrendBarsInputs> = {}): IndicatorResult {
  const { emaLength, showEma } = { ...defaultInputs, ...inputs };

  const closeSeries = getSourceSeries(bars, 'close');
  const ema = ta.ema(closeSeries, emaLength);
  const emaArr = ema.toArray();

  const warmup = emaLength;
  const barColors: BarColorData[] = [];

  const emaPlot = emaArr.map((v, i) => {
    if (i < warmup || v == null) return { time: bars[i].time, value: NaN };
    const hlc3 = (bars[i].high + bars[i].low + bars[i].close) / 3;
    const bullish = hlc3 >= v;
    const color = bullish ? '#00E676' : '#FF5252';
    barColors.push({ time: bars[i].time as number, color });
    return { time: bars[i].time, value: showEma ? v : NaN, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': emaPlot },
    barColors,
  } as IndicatorResult & { barColors: BarColorData[] };
}

export const CMEMATrendBars = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
