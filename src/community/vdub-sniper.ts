/**
 * Vdub FX SniperVX2 Color v2
 *
 * EMA-based sniper oscillator with two wave components and a combined histogram.
 * wave1 = EMA(src, len1) - EMA(src, len2).
 * wave2 = EMA(src, len2) - EMA(src, len3).
 * Combined = wave1 + wave2.
 *
 * Reference: TradingView "Vdub FX SniperVX2 Color v2" (community)
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface VdubSniperInputs {
  len1: number;
  len2: number;
  len3: number;
  src: SourceType;
}

export const defaultInputs: VdubSniperInputs = {
  len1: 6,
  len2: 14,
  len3: 26,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'len1', type: 'int', title: 'Length 1', defval: 6, min: 1 },
  { id: 'len2', type: 'int', title: 'Length 2', defval: 14, min: 1 },
  { id: 'len3', type: 'int', title: 'Length 3', defval: 26, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Wave 1', color: '#26A69A', lineWidth: 1 },
  { id: 'plot1', title: 'Wave 2', color: '#EF5350', lineWidth: 1 },
  { id: 'plot2', title: 'Combined', color: '#2962FF', lineWidth: 3, style: 'histogram' },
];

export const metadata = {
  title: 'Vdub FX Sniper',
  shortTitle: 'VSniper',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<VdubSniperInputs> = {}): IndicatorResult {
  const { len1, len2, len3, src } = { ...defaultInputs, ...inputs };

  const source = getSourceSeries(bars, src);
  const ema1 = ta.ema(source, len1);
  const ema2 = ta.ema(source, len2);
  const ema3 = ta.ema(source, len3);

  const wave1 = ema1.sub(ema2);
  const wave2 = ema2.sub(ema3);
  const combined = wave1.add(wave2);

  const w1Arr = wave1.toArray();
  const w2Arr = wave2.toArray();
  const cArr = combined.toArray();

  const warmup = len3;

  const toPlot = (arr: (number | null)[]) =>
    arr.map((v, i) => ({
      time: bars[i].time,
      value: (v == null || i < warmup) ? NaN : v,
    }));

  const plot2 = cArr.map((v, i) => {
    if (v == null || i < warmup) return { time: bars[i].time, value: NaN };
    const color = v >= 0 ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': toPlot(w1Arr), 'plot1': toPlot(w2Arr), 'plot2': plot2 },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'solid' as const, title: 'Zero' } },
    ],
  };
}

export const VdubSniper = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
