/**
 * RSI Swing Signal
 *
 * RSI with swing failure pattern detection.
 * Detects when RSI crosses above 30 (bullish) or below 70 (bearish) after being in extreme zone.
 *
 * Reference: TradingView "RSI Swing Signal"
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface RSISwingSignalInputs {
  rsiLen: number;
  src: SourceType;
}

export const defaultInputs: RSISwingSignalInputs = {
  rsiLen: 14,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: '#7E57C2', lineWidth: 2 },
];

export const metadata = {
  title: 'RSI Swing Signal',
  shortTitle: 'RSISwing',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<RSISwingSignalInputs> = {}): IndicatorResult {
  const { rsiLen, src } = { ...defaultInputs, ...inputs };

  const source = getSourceSeries(bars, src);
  const rsi = ta.rsi(source, rsiLen);
  const rsiArr = rsi.toArray();

  const warmup = rsiLen;

  const plot0 = rsiArr.map((v, i) => {
    if (v == null || i < warmup) return { time: bars[i].time, value: NaN };
    const prev = i > 0 ? rsiArr[i - 1] : null;
    let color = '#7E57C2';
    if (prev != null) {
      if (prev < 30 && v >= 30) color = '#26A69A';
      else if (prev > 70 && v <= 70) color = '#EF5350';
    }
    return { time: bars[i].time, value: v, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    hlines: [
      { value: 70, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Overbought' } },
      { value: 50, options: { color: '#787B86', linestyle: 'dotted' as const, title: 'Midline' } },
      { value: 30, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Oversold' } },
    ],
  };
}

export const RSISwingSignal = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
