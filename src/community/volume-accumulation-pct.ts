/**
 * Volume Accumulation Percentage Indicator
 *
 * Measures buying/selling pressure as a percentage using volume-weighted
 * price position within the bar range.
 * VA = volume * ((close - low) - (high - close)) / range
 * VA% = SMA(VA, length) / SMA(volume, length) * 100
 *
 * Reference: "Volume Accumulation Percentage Indicator [LazyBear]"
 */

import type { IndicatorResult, InputConfig, PlotConfig, Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolumeAccumulationPctInputs {
  length: number;
}

export const defaultInputs: VolumeAccumulationPctInputs = {
  length: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VA%', color: '#787B86', lineWidth: 2 },
  { id: 'plot1', title: 'VAPI Histogram', color: '#787B86', lineWidth: 4, style: 'histogram' },
  { id: 'plotU', title: 'DummyU', color: '#787B86', lineWidth: 1 },
  { id: 'plotL', title: 'DummyL', color: '#787B86', lineWidth: 1 },
];

export const metadata = {
  title: 'Volume Accumulation Percentage',
  shortTitle: 'VA%',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };

interface VaRun extends BarRunState<Record<string, never>> {
  smaVA: WindowSma;
  smaVol: WindowSma;
  vaValues: number[];
  plot0: Point[];
  plot1: Point[];
  plotU: Point[];
  plotL: Point[];
}

function study(inputs: Partial<VolumeAccumulationPctInputs>): BarStudy<VaRun, IndicatorResult> {
  const { length } = { ...defaultInputs, ...inputs };
  const warmup = length;
  return {
    init() {
      const smaVA = new WindowSma(length);
      const smaVol = new WindowSma(length);
      const s: VaRun = {
        smaVA, smaVol, vaValues: [], plot0: [], plot1: [], plotU: [], plotL: [],
        steps: [smaVA, smaVol], vars: {}, lists: [], series: [],
      };
      s.series = [s.vaValues, s.plot0, s.plot1, s.plotU, s.plotL];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      // Compute VA for each bar
      const range = b.high - b.low;
      const vol = b.volume ?? 0;
      const va = range > 0 ? vol * ((b.close - b.low) - (b.high - b.close)) / range : 0;
      const smaVA = s.smaVA.step(va);
      const smaVol = s.smaVol.step(vol);
      const v = i < warmup || isNaN(smaVA) || isNaN(smaVol) || smaVol === 0 ? NaN : (smaVA / smaVol) * 100;
      s.vaValues[i] = v;

      // plot0: VA% oscillator line
      s.plot0[i] = { time, value: isNaN(v) ? NaN : v };
      // plot1: histogram (same values, colored)
      s.plot1[i] = { time, value: isNaN(v) ? NaN : v, color: v >= 0 ? '#787B86' : '#787B86' };

      // DummyU: us = va<0 ? 0 : (va==0 ? va[prev] : va) — positive portion capped at 0 on negative side
      // DummyL: ls = va>0 ? 0 : (va==0 ? va[prev] : va) — negative portion capped at 0 on positive side
      if (isNaN(v)) {
        s.plotU[i] = { time, value: NaN };
        s.plotL[i] = { time, value: NaN };
      } else {
        const prev = i > 0 ? s.vaValues[i - 1] : 0;
        s.plotU[i] = { time, value: v < 0 ? 0 : (v === 0 ? prev : v) };
        s.plotL[i] = { time, value: v > 0 ? 0 : (v === 0 ? prev : v) };
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'plotU': s.plotU.slice(), 'plotL': s.plotL.slice() },
        hlines: [
          { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } },
        ],
        fills: [
          { plot1: 'plotU', plot2: 'plot1', options: { color: 'rgba(255, 0, 0, 0.5)' } },
          { plot1: 'plotL', plot2: 'plot1', options: { color: 'rgba(0, 255, 0, 0.5)' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeAccumulationPctInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolumeAccumulationPctInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const VolumeAccumulationPct = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
