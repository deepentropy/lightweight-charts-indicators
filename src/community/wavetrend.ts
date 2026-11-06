/**
 * WaveTrend with Crosses
 *
 * Normalized momentum oscillator using EMA of deviation.
 * WT1 = EMA(CI, n2) where CI = (hlc3 - EMA(hlc3, n1)) / (0.015 * EMA(|hlc3 - EMA(hlc3, n1)|, n1))
 * WT2 = SMA(WT1, 4)
 * On each cross of WT1 and WT2, circles at WT2 (two circle plots as the original: a wide black one under a red / lime
 * one) and an aqua / yellow bar colour.
 *
 * Reference: "WaveTrend with Crosses" by LazyBear
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { MarkerData, BarColorData } from '../types';

export interface WaveTrendInputs {
  channelLength: number;
  averageLength: number;
  obLevel1: number;
  osLevel1: number;
}

export const defaultInputs: WaveTrendInputs = {
  channelLength: 10,
  averageLength: 21,
  obLevel1: 60,
  osLevel1: -60,
};

export const inputConfig: InputConfig[] = [
  { id: 'channelLength', type: 'int', title: 'Channel Length', defval: 10, min: 1 },
  { id: 'averageLength', type: 'int', title: 'Average Length', defval: 21, min: 1 },
  { id: 'obLevel1', type: 'int', title: 'Over Bought Level', defval: 60 },
  { id: 'osLevel1', type: 'int', title: 'Over Sold Level', defval: -60 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'WT1', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'WT2', color: '#EF5350', lineWidth: 1 },
  { id: 'plot2', title: 'Diff', color: '#2962FF', lineWidth: 1, style: 'area' },
  { id: 'plot3', title: 'Cross', color: '#000000', lineWidth: 3, style: 'circles' },
  { id: 'plot4', title: 'Cross Color', color: '#00FF00', lineWidth: 2, style: 'circles' },
];

export const metadata = {
  title: 'WaveTrend',
  shortTitle: 'WT',
  overlay: false,
};

type Point = { time: number; value: number };
type ColorPoint = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] };

interface WtRun extends BarRunState<Record<string, never>> {
  esa: ReturnType<typeof taStep.ema>;
  d: ReturnType<typeof taStep.ema>;
  wt1: ReturnType<typeof taStep.ema>;
  wt2: WindowSma;
  wt1Arr: number[];
  wt2Arr: number[];
  wt1Data: Point[];
  wt2Data: Point[];
  diffData: Point[];
  crossBlack: ColorPoint[];
  crossColor: ColorPoint[];
  barColors: BarColorData[];
}

function study(inputs: Partial<WaveTrendInputs>): BarStudy<WtRun, Result> {
  const { channelLength, averageLength } = { ...defaultInputs, ...inputs };
  const hlc3 = barSource('hlc3');
  return {
    init() {
      const s: WtRun = {
        esa: taStep.ema(channelLength), d: taStep.ema(channelLength), wt1: taStep.ema(averageLength), wt2: new WindowSma(4),
        wt1Arr: [], wt2Arr: [], wt1Data: [], wt2Data: [], diffData: [], crossBlack: [], crossColor: [], barColors: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.esa, s.d, s.wt1, s.wt2];
      s.lists = [s.barColors];
      s.series = [s.wt1Arr, s.wt2Arr, s.wt1Data, s.wt2Data, s.diffData, s.crossBlack, s.crossColor];
      return s;
    },
    bar(s, i, bars) {
      const t = bars[i].time as number;
      const ap = hlc3(bars[i]);
      const esa = s.esa.step(ap);
      const d = s.d.step(Math.abs(ap - esa));
      const ci = (ap - esa) / (d * 0.015);
      const w1 = s.wt1.step(ci);
      const w2 = s.wt2.step(w1);
      s.wt1Arr[i] = w1;
      s.wt2Arr[i] = w2;
      s.wt1Data[i] = { time: t, value: w1 };
      s.wt2Data[i] = { time: t, value: w2 };
      s.diffData[i] = { time: t, value: w1 - w2 };

      // Cross circles and barcolor at WT1/WT2 crossover points
      // plot(cross(wt1, wt2) ? wt2 : na, color = black, style = circles, linewidth = 3)
      // plot(cross(wt1, wt2) ? wt2 : na, color = (wt2 - wt1 > 0 ? red : lime), style = circles, linewidth = 2)
      const pw1 = i > 0 ? s.wt1Arr[i - 1] : NaN;
      const pw2 = i > 0 ? s.wt2Arr[i - 1] : NaN;
      const cross = (pw1 <= pw2 && w1 > w2) || (pw1 >= pw2 && w1 < w2);
      const bearish = cross && w2 > w1;
      s.crossBlack[i] = { time: t, value: cross ? w2 : NaN, color: '#000000' };
      s.crossColor[i] = { time: t, value: cross ? w2 : NaN, color: bearish ? '#FF0000' : '#00FF00' };
      if (cross) {
        s.barColors.push({
          time: t,
          color: bearish ? '#00FFFF' : '#FFFF00',
        });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.wt1Data.slice(), 'plot1': s.wt2Data.slice(), 'plot2': s.diffData.slice(), 'plot3': s.crossBlack.slice(), 'plot4': s.crossColor.slice() },
        hlines: [
          { value: 0, options: { color: '#787B86', linestyle: 'solid', title: 'Zero' } },
          { value: 60, options: { color: '#EF5350', linestyle: 'dashed', title: 'OB1' } },
          { value: -60, options: { color: '#26A69A', linestyle: 'dashed', title: 'OS1' } },
          { value: 53, options: { color: '#EF5350', linestyle: 'dotted', title: 'OB2' } },
          { value: -53, options: { color: '#26A69A', linestyle: 'dotted', title: 'OS2' } },
        ],
        markers: [],
        barColors: s.barColors.slice(),
      } as Result;
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<WaveTrendInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<WaveTrendInputs> = {}): Omit<IndicatorResult, 'markers'> {
  return fullResult(createRun(inputs).update(bars));
}

export const WaveTrend = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
