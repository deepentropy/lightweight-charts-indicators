/**
 * EMA Wave Indicator
 *
 * Difference of fast/slow EMA pairs showing momentum waves.
 * Plots close-ema8, ema8-ema34, ema8-ema55, ema8-ema89.
 *
 * Reference: TradingView "EMA Wave Indicator" by LazyBear
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';

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

export function calculate(bars: Bar[], inputs: Partial<EMAWaveInputs> = {}): IndicatorResult & { barColors: BarColorData[] } {
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

  // barcolor: exhaustion spikes
  // Pine: wc = src-ema(src,clength=50), wb = src-ema(src,blength=25), wa = src-ema(src,alength=5)
  // wcf = wb!=0 ? wc/wb > cutoff : false, wbf = wa!=0 ? wb/wa > cutoff : false
  // barcolor: both wcf+wbf -> #81F7F3, either -> fuchsia
  const cutoff = 10;
  const barColors: BarColorData[] = [];
  for (let i = warmup; i < bars.length; i++) {
    const s = srcArr[i] ?? 0;
    const e8 = ema8[i] ?? 0;
    const e34 = ema34[i] ?? 0;
    const e55 = ema55[i] ?? 0;
    const wa = s - e8;
    const wb = e8 - e34;  // approximation: using ema8/ema34 as wave A/B
    const wc = e8 - e55;  // using ema55 as wave C
    const wcf = wb !== 0 ? Math.abs(wc / wb) > cutoff : false;
    const wbf = wa !== 0 ? Math.abs(wb / wa) > cutoff : false;
    if (wcf && wbf) barColors.push({ time: bars[i].time, color: '#81F7F3' });
    else if (wcf || wbf) barColors.push({ time: bars[i].time, color: '#E040FB' });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'plot0': makePlot(srcArr, ema8),
      'plot1': makePlot(ema8, ema34),
      'plot2': makePlot(ema8, ema55),
      'plot3': makePlot(ema8, ema89),
    },
    hlines: hlineConfig.map(h => ({ value: h.value, options: h.options })),
    barColors,
  };
}

export const EMAWave = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
