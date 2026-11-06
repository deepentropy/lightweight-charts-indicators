/**
 * AK TREND ID
 *
 * Trend identification using EMA spread oscillator.
 * bspread = (EMA(close,3) - EMA(close,8)) * 1.001
 * Plotted as non-overlay oscillator with zero line.
 * Bars colored green/red by spread sign.
 *
 * Reference: "AK_TREND ID (M)" by Algokid
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AKTrendIDInputs {
  input1: number;
  input2: number;
  src: SourceType;
}

export const defaultInputs: AKTrendIDInputs = {
  input1: 3,
  input2: 8,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'input1', type: 'int', title: 'Fast EMA', defval: 3, min: 1 },
  { id: 'input2', type: 'int', title: 'Slow EMA', defval: 8, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Zero Line', color: '#FFFFFF', lineWidth: 1 },
  { id: 'plot1', title: 'Spread', color: '#26A69A', lineWidth: 2 },
];

export const metadata = {
  title: 'AK TREND ID',
  shortTitle: 'AKTID',
  overlay: false,
};

type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] };
type Point = { time: number; value: number; color?: string };

interface AkRun extends BarRunState<Record<string, never>> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  plot0: Point[];
  plot1: Point[];
  barColors: BarColorData[];
}

function study(inputs: Partial<AKTrendIDInputs>): BarStudy<AkRun, Result> {
  const { input1, input2, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const warmup = Math.max(input1, input2);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const fast = taStep.ema(input1);
      const slow = taStep.ema(input2);
      const s: AkRun = { fast, slow, plot0: [], plot1: [], barColors: [], steps: [fast, slow], vars: {}, lists: [], series: [] };
      s.lists = [s.barColors];
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = value(b);
      const f = s.fast.step(v);
      const sl = s.slow.step(v);
      s.plot0[i] = { time: b.time, value: i < warmup ? NaN : 0 };
      if (i < warmup || f == null || sl == null || isNaN(f) || isNaN(sl)) {
        s.plot1[i] = { time: b.time, value: NaN };
      } else {
        const bspread = (f - sl) * 1.001;
        s.plot1[i] = { time: b.time, value: bspread, color: bspread > 0 ? '#00FF00' : '#FF0000' };
      }
      if (i >= warmup && f != null && sl != null) {
        const bspread = (f - sl) * 1.001;
        s.barColors.push({ time: b.time, color: bspread > 0 ? '#008000' : '#FF0000' });
      }
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
export function createRun(inputs: Partial<AKTrendIDInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AKTrendIDInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const AKTrendID = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
