/**
 * RSI HistoAlert
 *
 * RSI displayed as a histogram with color alerts based on overbought/oversold levels.
 * Red when RSI > 70, green when RSI < 30, gray otherwise.
 *
 * Reference: TradingView "RSI HistoAlert"
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

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
  { id: 'plot0', title: 'RSI Histogram', color: '#787B86', lineWidth: 4, style: 'histogram' },
];

export const metadata = {
  title: 'RSI HistoAlert',
  shortTitle: 'RSIHist',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<RSIHistoAlertInputs> = {}): IndicatorResult {
  const { rsiLen, src } = { ...defaultInputs, ...inputs };

  const source = getSourceSeries(bars, src);
  const rsi = ta.rsi(source, rsiLen);
  const rsiArr = rsi.toArray();

  const warmup = rsiLen;

  const plot0 = rsiArr.map((v, i) => {
    if (v == null || i < warmup) return { time: bars[i].time, value: NaN };
    let color: string;
    if (v > 70) color = '#EF5350';
    else if (v < 30) color = '#26A69A';
    else color = '#787B86';
    return { time: bars[i].time, value: v, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    hlines: [
      { value: 70, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Overbought' } },
      { value: 30, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Oversold' } },
    ],
  };
}

export const RSIHistoAlert = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
