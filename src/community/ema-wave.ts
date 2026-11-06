/**
 * EMA Wave Indicator [LazyBear]
 *
 * Three wave components (WaveA, WaveB, WaveC) plotted as histograms.
 * WaveA = SMA(src - EMA(src, aLength), smaLen)
 * WaveB = SMA(src - EMA(src, bLength), smaLen)
 * WaveC = SMA(src - EMA(src, cLength), smaLen)
 * Spike/exhaustion overlays: fuchsia histogram when wc/wb or wb/wa ratio exceeds cutoff.
 * Separate barcolor input: both spikes -> #81F7F3, either spike -> fuchsia.
 *
 * Reference: "EMA Wave Indicator [LazyBear]" community indicator
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface EMAWaveInputs {
  aLength: number;
  bLength: number;
  cLength: number;
  smaLength: number;
  cutoff: number;
  identifySpikes: boolean;
  colorBarsOnSpikes: boolean;
  src: SourceType;
}

export const defaultInputs: EMAWaveInputs = {
  aLength: 5,
  bLength: 25,
  cLength: 50,
  smaLength: 4,
  cutoff: 10,
  identifySpikes: false,
  colorBarsOnSpikes: false,
  src: 'hlc3',
};

export const inputConfig: InputConfig[] = [
  { id: 'aLength', type: 'int', title: 'Wave A Length', defval: 5, min: 1 },
  { id: 'bLength', type: 'int', title: 'Wave B Length', defval: 25, min: 1 },
  { id: 'cLength', type: 'int', title: 'Wave C Length', defval: 50, min: 1 },
  { id: 'smaLength', type: 'int', title: 'Wave SMA Length', defval: 4, min: 1 },
  { id: 'cutoff', type: 'int', title: 'Cutoff', defval: 10, min: 1 },
  { id: 'identifySpikes', type: 'bool', title: 'Identify Spikes/Exhaustions', defval: false },
  { id: 'colorBarsOnSpikes', type: 'bool', title: 'Color Bars on Spikes/Exhaustions', defval: false },
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

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] };

interface EmaWaveRun extends BarRunState<Record<string, never>> {
  emaA: ReturnType<typeof taStep.ema>;
  emaB: ReturnType<typeof taStep.ema>;
  emaC: ReturnType<typeof taStep.ema>;
  smaA: WindowSma;
  smaB: WindowSma;
  smaC: WindowSma;
  plots: Point[][];
  barColors: BarColorData[];
}

function study(inputs: Partial<EMAWaveInputs>): BarStudy<EmaWaveRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const warmup = cfg.cLength + cfg.smaLength;
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      // Pine: src = hlc3, ma(s,l) = ema(s,l)
      const emaA = taStep.ema(cfg.aLength);
      const emaB = taStep.ema(cfg.bLength);
      const emaC = taStep.ema(cfg.cLength);
      const smaA = new WindowSma(cfg.smaLength);
      const smaB = new WindowSma(cfg.smaLength);
      const smaC = new WindowSma(cfg.smaLength);
      const s: EmaWaveRun = {
        emaA, emaB, emaC, smaA, smaB, smaC, plots: [[], [], [], [], []], barColors: [],
        steps: [emaA, emaB, emaC, smaA, smaB, smaC], vars: {}, lists: [], series: [],
      };
      s.lists = [s.barColors];
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const t = bars[i].time;
      const src = value(bars[i]);
      // wa = sma(src - ema(src, aLength), smaLength)
      const wa = s.smaA.step(src - s.emaA.step(src));
      const wb = s.smaB.step(src - s.emaB.step(src));
      const wc = s.smaC.step(src - s.emaC.step(src));
      const p = s.plots;
      const waveCPlot = p[0], waveCSPlot = p[1], waveBPlot = p[2], waveBSPlot = p[3], waveAPlot = p[4];
      if (i < warmup) {
        waveCPlot[i] = { time: t, value: NaN };
        waveCSPlot[i] = { time: t, value: NaN };
        waveBPlot[i] = { time: t, value: NaN };
        waveBSPlot[i] = { time: t, value: NaN };
        waveAPlot[i] = { time: t, value: NaN };
        return;
      }

      // Pine spike detection (raw ratio, no abs):
      // Pine: wcf=(wb != 0) ? (wc/wb > cutoff) : false  (raw ratio, not absolute)
      const wcf = wb !== 0 ? (wc / wb) > cfg.cutoff : false;
      // Pine: wbf=(wa != 0) ? (wb/wa > cutoff) : false
      const wbf = wa !== 0 ? (wb / wa) > cfg.cutoff : false;

      // Pine: plot(wc, color=maroon, style=histogram, linewidth=3)
      waveCPlot[i] = { time: t, value: wc };
      // Pine: plot(mse and wcf ? wc : na, color=fuchsia, style=histogram, linewidth=3)
      waveCSPlot[i] = { time: t, value: (cfg.identifySpikes && wcf) ? wc : NaN };
      // Pine: plot(wb, color=blue, style=histogram, linewidth=3)
      waveBPlot[i] = { time: t, value: wb };
      // Pine: plot(mse and wbf ? wb : na, color=fuchsia, style=histogram, linewidth=3)
      waveBSPlot[i] = { time: t, value: (cfg.identifySpikes && wbf) ? wb : NaN };
      // Pine: plot(wa, color=red, style=histogram, linewidth=3)
      waveAPlot[i] = { time: t, value: wa };

      // Pine: barcolor(ebc ? (wcf and wbf) ? #81F7F3 : (wcf or wbf) ? fuchsia : na : na)
      // Uses separate ebc input (colorBarsOnSpikes), independent of mse (identifySpikes)
      if (cfg.colorBarsOnSpikes) {
        if (wcf && wbf) s.barColors.push({ time: t, color: '#81F7F3' });
        else if (wcf || wbf) s.barColors.push({ time: t, color: '#E040FB' });
      }
    },
    result(s) {
      const [waveCPlot, waveCSPlot, waveBPlot, waveBSPlot, waveAPlot] = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          'waveC': waveCPlot.slice(),
          'waveCSpike': waveCSPlot.slice(),
          'waveB': waveBPlot.slice(),
          'waveBSpike': waveBSPlot.slice(),
          'waveA': waveAPlot.slice(),
        },
        hlines: hlineConfig.map(h => ({ value: h.value, options: h.options })),
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EMAWaveInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<EMAWaveInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const EMAWave = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig };
