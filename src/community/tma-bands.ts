/**
 * TMA Bands - Triangular Moving Average Bands
 *
 * TMA is a double-smoothed SMA: SMA of SMA.
 * Bands are offset by ATR * multiplier.
 *
 * Reference: "TMA Bands"
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TMABandsInputs {
  length: number;
  atrMultiplier: number;
  atrLength: number;
}

export const defaultInputs: TMABandsInputs = {
  length: 20,
  atrMultiplier: 2.0,
  atrLength: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
  { id: 'atrMultiplier', type: 'float', title: 'ATR Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'TMA', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Upper', color: '#26A69A', lineWidth: 1 },
  { id: 'plot2', title: 'Lower', color: '#EF5350', lineWidth: 1 },
];

export const metadata = {
  title: 'TMA Bands',
  shortTitle: 'TMA',
  overlay: true,
};

type Point = { time: number; value: number };

interface TmaRun extends BarRunState<Record<string, never>> {
  sma1: WindowSma;
  sma2: WindowSma;
  atr: ReturnType<typeof taStep.atr>;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  fillColors: string[];
}

function study(inputs: Partial<TMABandsInputs>): BarStudy<TmaRun, IndicatorResult> {
  const { length, atrMultiplier, atrLength } = { ...defaultInputs, ...inputs };
  const halfLen = Math.ceil(length / 2);
  const secondLen = Math.floor(length / 2) + 1;
  const warmup = length + atrLength;
  return {
    init() {
      const sma1 = new WindowSma(halfLen);
      const sma2 = new WindowSma(secondLen);
      const atr = taStep.atr(atrLength);
      const s: TmaRun = {
        sma1, sma2, atr, plot0: [], plot1: [], plot2: [], fillColors: [],
        steps: [sma1, sma2, atr], vars: {}, lists: [], series: [],
      };
      s.series = [s.plot0, s.plot1, s.plot2, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time as number;
      const t = s.sma2.step(s.sma1.step(b.close));
      const a = s.atr.step(b.high, b.low, b.close);
      s.plot0[i] = i < warmup || t == null || isNaN(t) ? { time, value: NaN } : { time, value: t };
      const off = i < warmup || t == null || isNaN(t) || a == null || isNaN(a);
      s.plot1[i] = off ? { time, value: NaN } : { time, value: t + atrMultiplier * a };
      s.plot2[i] = off ? { time, value: NaN } : { time, value: t - atrMultiplier * a };
      s.fillColors[i] = i < warmup ? 'transparent' : '#2962FF20';
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'plot2': s.plot2.slice() },
        fills: [{ plot1: 'plot1', plot2: 'plot2', colors: s.fillColors.slice() }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TMABandsInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TMABandsInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const TMABands = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
