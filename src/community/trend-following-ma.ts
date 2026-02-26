/**
 * Trend Following Moving Averages
 *
 * EMA 9, SMA 50, SMA 200. EMA9 colored green when EMA9 > SMA50 > SMA200 (bullish),
 * red otherwise.
 *
 * Reference: TradingView "Trend Following Moving Averages" (community)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface TrendFollowingMAInputs {
  src: SourceType;
}

export const defaultInputs: TrendFollowingMAInputs = {
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA 9', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot1', title: 'SMA 50', color: '#2962FF', lineWidth: 1 },
  { id: 'plot2', title: 'SMA 200', color: '#E91E63', lineWidth: 2 },
];

export const metadata = {
  title: 'Trend Following Moving Averages',
  shortTitle: 'TFMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<TrendFollowingMAInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const src = getSourceSeries(bars, cfg.src);

  const ema9 = ta.ema(src, 9).toArray();
  const sma50 = ta.sma(src, 50).toArray();
  const sma200 = ta.sma(src, 200).toArray();

  const warmup = 200;

  const plot0 = ema9.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const e9 = v ?? 0;
    const s50 = sma50[i] ?? 0;
    const s200 = sma200[i] ?? 0;
    const bullish = e9 > s50 && s50 > s200;
    return { time: bars[i].time, value: e9, color: bullish ? '#26A69A' : '#EF5350' };
  });

  const plot1 = sma50.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (v ?? NaN),
  }));

  const plot2 = sma200.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (v ?? NaN),
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2 },
  };
}

export const TrendFollowingMA = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
