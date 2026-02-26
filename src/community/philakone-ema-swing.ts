/**
 * Philakone 55 EMA Swing Trading
 *
 * EMA 55 with EMA 9 for swing trading. Buy signal when close > EMA55 and EMA9 crosses
 * above EMA55. Sell signal when close < EMA55 and EMA9 crosses below EMA55.
 *
 * Reference: TradingView "Philakone 55 EMA Swing Trading" (community)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface PhilakoneEMASwingInputs {
  src: SourceType;
}

export const defaultInputs: PhilakoneEMASwingInputs = {
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA 55', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'EMA 9', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'Philakone 55 EMA Swing Trading',
  shortTitle: 'P55EMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<PhilakoneEMASwingInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const src = getSourceSeries(bars, cfg.src);

  const ema55 = ta.ema(src, 55).toArray();
  const ema9 = ta.ema(src, 9).toArray();

  const warmup = 55;

  const plot0 = ema55.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (v ?? NaN),
  }));

  const plot1 = ema9.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const e9 = v ?? 0;
    const e55 = ema55[i] ?? 0;
    return { time: bars[i].time, value: e9, color: e9 > e55 ? '#26A69A' : '#EF5350' };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
  };
}

export const PhilakoneEMASwing = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
