/**
 * RSI HistoAlert
 *
 * RSI displayed as a histogram with color alerts based on overbought/oversold levels.
 * Red when RSI > 70, green when RSI < 30, gray otherwise.
 *
 * Reference: TradingView "RSI HistoAlert"
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface RSIHistoAlertInputs {
  rsiLen: number;
  src: SourceType;
}

export const defaultInputs: RSIHistoAlertInputs = {
  rsiLen: 14,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI HistoAlert', color: '#2196F3', lineWidth: 1 },
  { id: 'plot1', title: 'RSI Histogram', color: '#787B86', lineWidth: 1, style: 'histogram' },
];

export const metadata = {
  title: 'RSI HistoAlert',
  shortTitle: 'RSIHist',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<RSIHistoAlertInputs> = {}): IndicatorResult & { barColors: BarColorData[] } {
  const { rsiLen, src } = { ...defaultInputs, ...inputs };

  const source = getSourceSeries(bars, src);
  const rsi = ta.rsi(source, rsiLen);
  const rsiArr = rsi.toArray();

  const warmup = rsiLen;

  // Pine: RSIMain = (rsi - 50) * RSIHistoModify
  const buyAlertLevel = -10;
  const sellAlertLevel = 10;
  const rsiHistoModify = 1.5;

  // Pine: plot(RSIMain, color=blue, title="RSI HistoAlert") -- line
  const plot0 = rsiArr.map((v, i) => {
    if (v == null || i < warmup) return { time: bars[i].time, value: NaN };
    return { time: bars[i].time, value: (v - 50) * rsiHistoModify };
  });

  // Pine: plot(RSIMain, color=rsiHcolor, style=histogram) -- histogram with conditional color
  const plot1 = rsiArr.map((v, i) => {
    if (v == null || i < warmup) return { time: bars[i].time, value: NaN };
    const rsiMain = (v - 50) * rsiHistoModify;
    const color = rsiMain >= 0 ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: rsiMain, color };
  });

  // barcolor: green when pos=1, red when pos=-1, blue otherwise
  const barColors: BarColorData[] = [];
  let pos = 0;
  for (let i = warmup; i < bars.length; i++) {
    const v = rsiArr[i];
    if (v == null) continue;
    const rsiMain = (v - 50) * rsiHistoModify;
    if (rsiMain > buyAlertLevel) pos = 1;
    else if (rsiMain < sellAlertLevel) pos = -1;
    if (pos === 1) barColors.push({ time: bars[i].time, color: '#26A69A' });
    else if (pos === -1) barColors.push({ time: bars[i].time, color: '#EF5350' });
    else barColors.push({ time: bars[i].time, color: '#2196F3' });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    hlines: [
      { value: 0, options: { color: '#9C27B0', linestyle: 'solid' as const, title: 'Zero' } },
      { value: buyAlertLevel, options: { color: '#26A69A', linestyle: 'dashed' as const, title: 'Buy Alert' } },
      { value: sellAlertLevel, options: { color: '#EF5350', linestyle: 'dashed' as const, title: 'Sell Alert' } },
    ],
    barColors,
  };
}

export const RSIHistoAlert = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
