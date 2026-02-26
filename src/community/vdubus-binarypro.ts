/**
 * vdubus BinaryPro Indicators
 *
 * Multi-oscillator combining RSI and Stochastic, both centered at 0.
 * RSI centered = RSI - 50. Stochastic centered = %K - 50.
 * Combined = RSI centered + Stoch centered.
 *
 * Reference: TradingView "vdubus BinaryPro Indicators" (community)
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface VdubusBinaryProInputs {
  rsiLen: number;
  stochLen: number;
  src: SourceType;
}

export const defaultInputs: VdubusBinaryProInputs = {
  rsiLen: 14,
  stochLen: 14,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'stochLen', type: 'int', title: 'Stoch Length', defval: 14, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI Centered', color: '#7E57C2', lineWidth: 1 },
  { id: 'plot1', title: 'Stoch Centered', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot2', title: 'Combined', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'vdubus BinaryPro',
  shortTitle: 'VBP',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<VdubusBinaryProInputs> = {}): IndicatorResult {
  const { rsiLen, stochLen, src } = { ...defaultInputs, ...inputs };

  const source = getSourceSeries(bars, src);
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const rsi = ta.rsi(source, rsiLen);
  const stochK = ta.stoch(source, highSeries, lowSeries, stochLen);

  const rsiArr = rsi.toArray();
  const stochArr = stochK.toArray();

  const warmup = Math.max(rsiLen, stochLen);

  const plot0 = rsiArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v - 50,
  }));

  const plot1 = stochArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v - 50,
  }));

  const plot2 = bars.map((b, i) => {
    if (i < warmup || rsiArr[i] == null || stochArr[i] == null) {
      return { time: b.time, value: NaN };
    }
    return { time: b.time, value: (rsiArr[i]! - 50) + (stochArr[i]! - 50) };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2 },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'solid' as const, title: 'Zero' } },
      { value: 30, options: { color: '#EF5350', linestyle: 'dashed' as const, title: 'OB' } },
      { value: -30, options: { color: '#26A69A', linestyle: 'dashed' as const, title: 'OS' } },
    ],
  };
}

export const VdubusBinaryPro = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
