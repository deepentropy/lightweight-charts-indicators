/**
 * EMA Wave Indicator [LazyBear]
 *
 * Three wave components (WaveA, WaveB, WaveC) plotted as histograms.
 * WaveA = SMA(src - EMA(src, aLength), smaLen)
 * WaveB = SMA(src - EMA(src, bLength), smaLen)
 * WaveC = SMA(src - EMA(src, cLength), smaLen)
 * Spike/exhaustion overlays: fuchsia histogram when wc/wb or wb/wa ratio exceeds cutoff.
 *
 * Reference: TradingView "EMA Wave Indicator [LazyBear]" community indicator
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface EMAWaveInputs {
  aLength: number;
  bLength: number;
  cLength: number;
  smaLength: number;
  cutoff: number;
  identifySpikes: boolean;
  src: SourceType;
}

export const defaultInputs: EMAWaveInputs = {
  aLength: 5,
  bLength: 25,
  cLength: 50,
  smaLength: 4,
  cutoff: 10,
  identifySpikes: false,
  src: 'hlc3',
};

export const inputConfig: InputConfig[] = [
  { id: 'aLength', type: 'int', title: 'Wave A Length', defval: 5, min: 1 },
  { id: 'bLength', type: 'int', title: 'Wave B Length', defval: 25, min: 1 },
  { id: 'cLength', type: 'int', title: 'Wave C Length', defval: 50, min: 1 },
  { id: 'smaLength', type: 'int', title: 'Wave SMA Length', defval: 4, min: 1 },
  { id: 'cutoff', type: 'int', title: 'Cutoff', defval: 10, min: 1 },
  { id: 'identifySpikes', type: 'bool', title: 'Identify Spikes/Exhaustions', defval: false },
  { id: 'src', type: 'source', title: 'Source', defval: 'hlc3' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'waveC', title: 'WaveC', color: '#800000', lineWidth: 3, style: 'histogram' },
  { id: 'waveCSpike', title: 'WaveC Spike', color: '#FF00FF', lineWidth: 3, style: 'histogram' },
  { id: 'waveB', title: 'WaveB', color: '#0000FF', lineWidth: 3, style: 'histogram' },
  { id: 'waveBSpike', title: 'WaveB Spike', color: '#FF00FF', lineWidth: 3, style: 'histogram' },
  { id: 'waveA', title: 'WaveA', color: '#FF0000', lineWidth: 3, style: 'histogram' },
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
  const n = bars.length;

  // Pine: src = hlc3, ma(s,l) = ema(s,l)
  const src = getSourceSeries(bars, cfg.src);
  const srcArr = src.toArray();

  const emaA = ta.ema(src, cfg.aLength).toArray();
  const emaB = ta.ema(src, cfg.bLength).toArray();
  const emaC = ta.ema(src, cfg.cLength).toArray();

  // wa = sma(src - ema(src, aLength), smaLength)
  const diffA = new Series(bars, (_b, i) => (srcArr[i] ?? 0) - (emaA[i] ?? 0));
  const diffB = new Series(bars, (_b, i) => (srcArr[i] ?? 0) - (emaB[i] ?? 0));
  const diffC = new Series(bars, (_b, i) => (srcArr[i] ?? 0) - (emaC[i] ?? 0));

  const waArr = ta.sma(diffA, cfg.smaLength).toArray();
  const wbArr = ta.sma(diffB, cfg.smaLength).toArray();
  const wcArr = ta.sma(diffC, cfg.smaLength).toArray();

  const warmup = cfg.cLength + cfg.smaLength;

  // Spike detection: wcf = (wb != 0) ? (wc/wb > cutoff) : false
  //                  wbf = (wa != 0) ? (wb/wa > cutoff) : false
  const waveCPlot: Array<{ time: number; value: number }> = [];
  const waveCSPlot: Array<{ time: number; value: number }> = [];
  const waveBPlot: Array<{ time: number; value: number }> = [];
  const waveBSPlot: Array<{ time: number; value: number }> = [];
  const waveAPlot: Array<{ time: number; value: number }> = [];

  const barColors: BarColorData[] = [];

  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    if (i < warmup) {
      waveCPlot.push({ time: t, value: NaN });
      waveCSPlot.push({ time: t, value: NaN });
      waveBPlot.push({ time: t, value: NaN });
      waveBSPlot.push({ time: t, value: NaN });
      waveAPlot.push({ time: t, value: NaN });
      continue;
    }

    const wa = waArr[i] ?? 0;
    const wb = wbArr[i] ?? 0;
    const wc = wcArr[i] ?? 0;

    const wcf = wb !== 0 ? Math.abs(wc / wb) > cfg.cutoff : false;
    const wbf = wa !== 0 ? Math.abs(wb / wa) > cfg.cutoff : false;

    // Pine: plot(wc, color=maroon, style=histogram)
    waveCPlot.push({ time: t, value: wc });
    // Pine: plot(mse and wcf ? wc : na, color=fuchsia, style=histogram)
    waveCSPlot.push({ time: t, value: (cfg.identifySpikes && wcf) ? wc : NaN });
    // Pine: plot(wb, color=blue, style=histogram)
    waveBPlot.push({ time: t, value: wb });
    // Pine: plot(mse and wbf ? wb : na, color=fuchsia, style=histogram)
    waveBSPlot.push({ time: t, value: (cfg.identifySpikes && wbf) ? wb : NaN });
    // Pine: plot(wa, color=red, style=histogram)
    waveAPlot.push({ time: t, value: wa });

    // Pine: barcolor: both wcf+wbf -> #81F7F3, either -> fuchsia
    if (cfg.identifySpikes) {
      if (wcf && wbf) barColors.push({ time: t, color: '#81F7F3' });
      else if (wcf || wbf) barColors.push({ time: t, color: '#E040FB' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'waveC': waveCPlot,
      'waveCSpike': waveCSPlot,
      'waveB': waveBPlot,
      'waveBSpike': waveBSPlot,
      'waveA': waveAPlot,
    },
    hlines: hlineConfig.map(h => ({ value: h.value, options: h.options })),
    barColors,
  };
}

export const EMAWave = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
