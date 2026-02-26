/**
 * Zero Lag EMA
 *
 * Reduces EMA lag by using a corrected source: 2*close - close[lag].
 * zlema = ema(2*src - src[lag], length) where lag = floor((length-1)/2).
 *
 * Reference: TradingView "Zero Lag EMA" (community)
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface ZeroLagEMAInputs {
  length: number;
  src: SourceType;
}

export const defaultInputs: ZeroLagEMAInputs = {
  length: 21,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 21, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ZLEMA', color: '#FFEB3B', lineWidth: 2 },
];

export const metadata = {
  title: 'Zero Lag EMA',
  shortTitle: 'ZLEMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<ZeroLagEMAInputs> = {}): IndicatorResult {
  const { length, src } = { ...defaultInputs, ...inputs };
  const srcArr = getSourceSeries(bars, src).toArray();
  const n = bars.length;
  const lag = Math.floor((length - 1) / 2);

  // Corrected source: 2*src - src[lag]
  const corrected = new Series(bars, (_bar, i) => {
    const cur = srcArr[i] ?? 0;
    const lagged = i >= lag ? (srcArr[i - lag] ?? cur) : cur;
    return 2 * cur - lagged;
  });

  const zlemaArr = ta.ema(corrected, length).toArray();
  const warmup = length + lag;

  const plot = zlemaArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (v ?? NaN),
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot },
  };
}

export const ZeroLagEMA = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
