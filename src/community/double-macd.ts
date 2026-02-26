/**
 * Double MACD
 *
 * Two MACD instances with independent parameters.
 * Buy when both histograms > 0, sell when both < 0.
 *
 * Reference: TradingView "Double MACD" (TV#192)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface DoubleMACDInputs {
  fast1: number;
  slow1: number;
  sig1: number;
  fast2: number;
  slow2: number;
  sig2: number;
  src: SourceType;
}

export const defaultInputs: DoubleMACDInputs = {
  fast1: 12,
  slow1: 26,
  sig1: 9,
  fast2: 19,
  slow2: 39,
  sig2: 9,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fast1', type: 'int', title: 'MACD1 Fast', defval: 12, min: 1 },
  { id: 'slow1', type: 'int', title: 'MACD1 Slow', defval: 26, min: 1 },
  { id: 'sig1', type: 'int', title: 'MACD1 Signal', defval: 9, min: 1 },
  { id: 'fast2', type: 'int', title: 'MACD2 Fast', defval: 19, min: 1 },
  { id: 'slow2', type: 'int', title: 'MACD2 Slow', defval: 39, min: 1 },
  { id: 'sig2', type: 'int', title: 'MACD2 Signal', defval: 9, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Hist1', color: '#26A69A', lineWidth: 4, style: 'histogram' },
  { id: 'plot1', title: 'Hist2', color: '#B2DFDB', lineWidth: 4, style: 'histogram' },
  { id: 'plot2', title: 'MACD1', color: '#2962FF', lineWidth: 2 },
  { id: 'plot3', title: 'Signal1', color: '#EF5350', lineWidth: 1 },
];

export const metadata = {
  title: 'Double MACD',
  shortTitle: 'DMACD',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<DoubleMACDInputs> = {}): IndicatorResult {
  const { fast1, slow1, sig1, fast2, slow2, sig2, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);

  // MACD 1
  const macd1Line = ta.ema(source, fast1).sub(ta.ema(source, slow1));
  const signal1Line = ta.ema(macd1Line, sig1);
  const hist1 = macd1Line.sub(signal1Line);

  // MACD 2
  const macd2Line = ta.ema(source, fast2).sub(ta.ema(source, slow2));
  const signal2Line = ta.ema(macd2Line, sig2);
  const hist2 = macd2Line.sub(signal2Line);

  const hist1Arr = hist1.toArray();
  const hist2Arr = hist2.toArray();
  const macd1Arr = macd1Line.toArray();
  const signal1Arr = signal1Line.toArray();

  const warmup1 = slow1 + sig1;
  const warmup2 = slow2 + sig2;
  const warmup = Math.max(warmup1, warmup2);

  const plot0 = hist1Arr.map((v, i) => {
    if (i < warmup1 || v == null) return { time: bars[i].time, value: NaN };
    const color = v >= 0 ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  const plot1 = hist2Arr.map((v, i) => {
    if (i < warmup2 || v == null) return { time: bars[i].time, value: NaN };
    const color = v >= 0 ? '#B2DFDB' : '#FFCDD2';
    return { time: bars[i].time, value: v, color };
  });

  const plot2 = macd1Arr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup1 || v == null) ? NaN : v,
  }));

  const plot3 = signal1Arr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup1 || v == null) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3 },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'dotted' as const, title: 'Zero' } },
    ],
  };
}

export const DoubleMACD = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
