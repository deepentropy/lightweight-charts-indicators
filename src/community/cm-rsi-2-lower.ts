/**
 * CM RSI-2 Strategy Lower
 *
 * RSI(2) oscillator displayed as histogram.
 * < 10 green, > 90 red, else gray.
 *
 * Reference: TradingView "CM_RSI-2 Strategy Lower" by ChrisMoody
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface CMRSI2LowerInputs {
  rsiLen: number;
  src: SourceType;
}

export const defaultInputs: CMRSI2LowerInputs = {
  rsiLen: 2,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 2, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI(2)', color: '#787B86', lineWidth: 4, style: 'histogram' },
  { id: 'plot_band1', title: 'Upper Line 90', color: 'transparent', lineWidth: 0 },
  { id: 'plot_band0', title: 'Lower Line 10', color: 'transparent', lineWidth: 0 },
];

export const metadata = {
  title: 'CM RSI-2 Strategy Lower',
  shortTitle: 'CMRSI2L',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<CMRSI2LowerInputs> = {}): IndicatorResult {
  const { rsiLen, src } = { ...defaultInputs, ...inputs };

  const source = getSourceSeries(bars, src);
  const rsi = ta.rsi(source, rsiLen);
  const rsiArr = rsi.toArray();

  const warmup = rsiLen;

  const plot0 = rsiArr.map((v, i) => {
    if (v == null || i < warmup) return { time: bars[i].time, value: NaN };
    let color: string;
    if (v < 10) color = '#26A69A';
    else if (v > 90) color = '#EF5350';
    else color = '#787B86';
    return { time: bars[i].time, value: v, color };
  });

  // Hidden level plots for fill reference (Pine: fill(band1, band0, color=silver, transp=90))
  const plot_band1 = bars.map((b, i) => ({ time: b.time, value: i < warmup ? NaN : 90 }));
  const plot_band0 = bars.map((b, i) => ({ time: b.time, value: i < warmup ? NaN : 10 }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot_band1': plot_band1, 'plot_band0': plot_band0 },
    hlines: [
      { value: 90, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Overbought' } },
      { value: 10, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Oversold' } },
    ],
    fills: [
      { plot1: 'plot_band1', plot2: 'plot_band0', options: { color: 'rgba(192,192,192,0.10)' } },
    ],
  };
}

export const CMRSI2Lower = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
