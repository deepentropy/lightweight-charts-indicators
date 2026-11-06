/**
 * CM EMA Trend Bars
 *
 * EMA-based bar coloring. Bars colored lime when hlc3 >= EMA, red otherwise.
 * EMA line also colored dynamically.
 *
 * Reference: "CM_EMA TrendBars" by ChrisMoody
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CMEMATrendBarsInputs {
  emaLength: number;
  showEma: boolean;
}

export const defaultInputs: CMEMATrendBarsInputs = {
  emaLength: 34,
  showEma: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaLength', type: 'int', title: 'EMA Length', defval: 34, min: 1 },
  { id: 'showEma', type: 'bool', title: 'Show EMA', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'CM EMA Trend Bars',
  shortTitle: 'CM EMA',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] };

interface CmEmaRun extends BarRunState<Record<string, never>> {
  ema: ReturnType<typeof taStep.ema>;
  emaPlot: Point[];
  barColors: BarColorData[];
}

function study(inputs: Partial<CMEMATrendBarsInputs>): BarStudy<CmEmaRun, Result> {
  const { emaLength, showEma } = { ...defaultInputs, ...inputs };
  const warmup = emaLength;
  return {
    init() {
      const ema = taStep.ema(emaLength);
      const s: CmEmaRun = { ema, emaPlot: [], barColors: [], steps: [ema], vars: {}, lists: [], series: [] };
      s.lists = [s.barColors];
      s.series = [s.emaPlot];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.ema.step(b.close);
      if (i < warmup || v == null) {
        s.emaPlot[i] = { time: b.time as number, value: NaN };
        return;
      }
      const hlc3 = (b.high + b.low + b.close) / 3;
      const bullish = hlc3 >= v;
      const color = bullish ? '#00E676' : '#FF5252';
      s.barColors.push({ time: b.time as number, color });
      s.emaPlot[i] = { time: b.time as number, value: showEma ? v : NaN, color };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.emaPlot.slice() },
        barColors: s.barColors.slice(),
      } as Result;
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CMEMATrendBarsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CMEMATrendBarsInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars)) as unknown as IndicatorResult;
}

export const CMEMATrendBars = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
