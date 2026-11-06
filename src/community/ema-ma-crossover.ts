/**
 * EMA & MA Crossover
 *
 * EMA and SMA plotted together for crossover signals.
 *
 * Reference: "EMA & MA Crossover" (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface EMAMACrossInputs {
  emaLen: number;
  smaLen: number;
  src: SourceType;
}

export const defaultInputs: EMAMACrossInputs = {
  emaLen: 12,
  smaLen: 26,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'emaLen', type: 'int', title: 'EMA Length', defval: 12, min: 1 },
  { id: 'smaLen', type: 'int', title: 'SMA Length', defval: 26, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA', color: '#00E676', lineWidth: 1 },
  { id: 'plot1', title: 'SMA', color: '#FF5252', lineWidth: 1 },
];

export const metadata = {
  title: 'EMA & MA Crossover',
  shortTitle: 'EMAC',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] };

interface EmaMaRun extends BarRunState<{ pos: number }> {
  ema: ReturnType<typeof taStep.ema>;
  sma: WindowSma;
  plot0: { time: number; value: number }[];
  plot1: { time: number; value: number }[];
  barColors: BarColorData[];
}

function study(inputs: Partial<EMAMACrossInputs>): BarStudy<EmaMaRun, Result> {
  const { emaLen, smaLen, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const warmup = Math.max(emaLen, smaLen);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const ema = taStep.ema(emaLen);
      const sma = new WindowSma(smaLen);
      const s: EmaMaRun = { ema, sma, plot0: [], plot1: [], barColors: [], steps: [ema, sma], vars: { pos: 0 }, lists: [], series: [] };
      s.lists = [s.barColors];
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = value(b);
      const emaV = s.ema.step(v);
      const smaV = s.sma.step(v);
      s.plot0[i] = { time: b.time, value: i < warmup ? NaN : (emaV ?? NaN) };
      s.plot1[i] = { time: b.time, value: i < warmup ? NaN : (smaV ?? NaN) };

      // barcolor: green when EMA < SMA (pos=1), red when EMA > SMA (pos=-1), blue otherwise
      // Pine: pos = iff(xEMA < xMA, 1, iff(xEMA > xMA, -1, nz(pos[1], 0)))
      if (i < warmup) return;
      const e = emaV ?? 0;
      const sm = smaV ?? 0;
      if (e < sm) s.vars.pos = 1;
      else if (e > sm) s.vars.pos = -1;
      const pos = s.vars.pos;
      if (pos === 1) s.barColors.push({ time: b.time, color: '#26A69A' });
      else if (pos === -1) s.barColors.push({ time: b.time, color: '#EF5350' });
      else s.barColors.push({ time: b.time, color: '#2196F3' });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice() },
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EMAMACrossInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<EMAMACrossInputs> = {}): Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const EMAMACross = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
