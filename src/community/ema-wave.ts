/**
 * EMA Wave Indicator
 *
 * Difference of fast/slow EMA pairs showing momentum waves.
 * Plots close-ema8, ema8-ema34, ema8-ema55, ema8-ema89.
 *
 * Reference: TradingView "EMA Wave Indicator" by LazyBear
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface EMAWaveInputs {
  src: SourceType;
}

export const defaultInputs: EMAWaveInputs = {
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Close - EMA8', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'EMA8 - EMA34', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot2', title: 'EMA8 - EMA55', color: '#00E676', lineWidth: 1 },
  { id: 'plot3', title: 'EMA8 - EMA89', color: '#E91E63', lineWidth: 1 },
];

export const hlineConfig = [
  { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } },
];

export const metadata = {
  title: 'EMA Wave Indicator',
  shortTitle: 'EMAW',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<EMAWaveInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const src = getSourceSeries(bars, cfg.src);
  const srcArr = src.toArray();

  const ema8 = ta.ema(src, 8).toArray();
  const ema34 = ta.ema(src, 34).toArray();
  const ema55 = ta.ema(src, 55).toArray();
  const ema89 = ta.ema(src, 89).toArray();

  const warmup = 89;

  const makePlot = (a: number[], b: number[]) =>
    a.map((av, i) => ({
      time: bars[i].time,
      value: i < warmup ? NaN : (av ?? 0) - (b[i] ?? 0),
    }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'plot0': makePlot(srcArr, ema8),
      'plot1': makePlot(ema8, ema34),
      'plot2': makePlot(ema8, ema55),
      'plot3': makePlot(ema8, ema89),
    },
    hlines: hlineConfig.map(h => ({ value: h.value, options: h.options })),
  };
}

export const EMAWave = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
