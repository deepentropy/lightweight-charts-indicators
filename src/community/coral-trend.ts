/**
 * Coral Trend Indicator
 *
 * 6 cascaded EMA filters combined with polynomial coefficients.
 * bfr = -cd^3*i6 + c3*i5 + c4*i4 + c5*i3
 *
 * Reference: "Coral Trend Indicator" by LazyBear
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData, BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CoralTrendInputs {
  smoothingPeriod: number;
  constantD: number;
  src: SourceType;
  enableBarColor: boolean;
  ribbonMode: boolean;
}

export const defaultInputs: CoralTrendInputs = {
  smoothingPeriod: 21,
  constantD: 0.4,
  src: 'close',
  enableBarColor: false,
  ribbonMode: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'smoothingPeriod', type: 'int', title: 'Smoothing Period', defval: 21, min: 1 },
  { id: 'constantD', type: 'float', title: 'Constant D', defval: 0.4, min: 0.01, max: 0.99, step: 0.01 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'enableBarColor', type: 'bool', title: 'Enable Bar Color', defval: false },
  { id: 'ribbonMode', type: 'bool', title: 'Ribbon Mode', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Coral Trend', color: '#2962FF', lineWidth: 3, style: 'circles' },
];

export const metadata = {
  title: 'Coral Trend',
  shortTitle: 'Coral',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[]; bgColors: BgColorData[] };

interface CoralVars {
  i1: number;
  i2: number;
  i3: number;
  i4: number;
  i5: number;
  i6: number;
}

interface CoralRun extends BarRunState<CoralVars> {
  bfrArr: number[];
  data: { time: number; value: number; color?: string }[];
  barColors: BarColorData[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<CoralTrendInputs>): BarStudy<CoralRun, Result> {
  const { smoothingPeriod, constantD, src, enableBarColor, ribbonMode } = { ...defaultInputs, ...inputs };
  const source = barSource(src);

  const cd = constantD;
  const di = (smoothingPeriod - 1.0) / 2.0 + 1.0;
  const c1 = 2 / (di + 1.0);
  const c2 = 1 - c1;
  const c3 = 3.0 * (cd * cd + cd * cd * cd);
  const c4 = -3.0 * (2.0 * cd * cd + cd + cd * cd * cd);
  const c5 = 3.0 * cd + 1.0 + cd * cd * cd + 3.0 * cd * cd;

  // Warm-up: roughly smoothingPeriod bars for the cascaded filters to settle
  const warmup = smoothingPeriod;
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const s: CoralRun = {
        bfrArr: [], data: [], barColors: [], bgColors: [],
        steps: [], vars: { i1: 0, i2: 0, i3: 0, i4: 0, i5: 0, i6: 0 }, lists: [], series: [],
      };
      s.lists = [s.barColors, s.bgColors];
      s.series = [s.bfrArr, s.data];
      return s;
    },
    bar(s, idx, bars) {
      const v = s.vars;
      const x = source(bars[idx]) ?? 0;
      v.i1 = c1 * x + c2 * v.i1;
      v.i2 = c1 * v.i1 + c2 * v.i2;
      v.i3 = c1 * v.i2 + c2 * v.i3;
      v.i4 = c1 * v.i3 + c2 * v.i4;
      v.i5 = c1 * v.i4 + c2 * v.i5;
      v.i6 = c1 * v.i5 + c2 * v.i6;

      const value = -cd * cd * cd * v.i6 + c3 * v.i5 + c4 * v.i4 + c5 * v.i3;
      s.bfrArr[idx] = value;

      const time = bars[idx].time;
      if (idx < warmup) {
        s.data[idx] = { time, value: NaN };
        return;
      }
      const prev = idx > 0 ? s.bfrArr[idx - 1] : value;
      const color = value > prev ? '#26A69A' : value < prev ? '#EF5350' : '#2962FF';
      if (enableBarColor) s.barColors.push({ time: time as number, color });
      if (ribbonMode) s.bgColors.push({ time: time as number, color: value > prev ? 'rgba(38,166,154,0.15)' : value < prev ? 'rgba(239,83,80,0.15)' : 'rgba(41,98,255,0.15)' });
      s.data[idx] = { time, value, color };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.data.slice() },
        barColors: s.barColors.slice(),
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CoralTrendInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CoralTrendInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars)) as IndicatorResult;
}

export const CoralTrend = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
