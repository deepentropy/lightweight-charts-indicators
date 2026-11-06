/**
 * Volume Flow Indicator (VFI)
 *
 * Volume-based oscillator using log price changes and volume cutoff.
 * VFI = SUM(signed_volume, length) / SMA(volume, length)
 *
 * Reference: "Volume Flow Indicator [LazyBear]"
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolumeFlowIndicatorInputs {
  length: number;
  coef: number;
  vcoef: number;
  signalLength: number;
  smoothVFI: boolean;
}

export const defaultInputs: VolumeFlowIndicatorInputs = {
  length: 130,
  coef: 0.2,
  vcoef: 2.5,
  signalLength: 5,
  smoothVFI: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'VFI Length', defval: 130, min: 1 },
  { id: 'coef', type: 'float', title: 'Coefficient', defval: 0.2, min: 0.01, step: 0.01 },
  { id: 'vcoef', type: 'float', title: 'Max Vol Cutoff', defval: 2.5, min: 0.1, step: 0.1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 5, min: 1 },
  { id: 'smoothVFI', type: 'bool', title: 'Smooth VFI', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VFI', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot2', title: 'Histogram', color: '#787B86', lineWidth: 3, style: 'histogram' },
];

export const metadata = {
  title: 'Volume Flow Indicator',
  shortTitle: 'VFI',
  overlay: false,
};

type Point = { time: number; value: number };

interface VfiRun extends BarRunState<{ runningSum: number }> {
  vinter: WindowStdev;
  vave: WindowSma;
  smooth: WindowSma;
  signal: ReturnType<typeof taStep.ema>;
  hlc3: number[];
  vaveArr: number[];
  vcpArr: number[];
  vfiPlot: Point[];
  sigPlot: Point[];
  histPlot: Point[];
}

function study(inputs: Partial<VolumeFlowIndicatorInputs>): BarStudy<VfiRun, IndicatorResult> {
  const { length, coef, vcoef, signalLength, smoothVFI } = { ...defaultInputs, ...inputs };
  const warmup = length + 30;
  return {
    init() {
      const s: VfiRun = {
        vinter: new WindowStdev(30), vave: new WindowSma(length), smooth: new WindowSma(3),
        signal: taStep.ema(signalLength), hlc3: [], vaveArr: [], vcpArr: [], vfiPlot: [], sigPlot: [], histPlot: [],
        steps: [], vars: { runningSum: 0 }, lists: [], series: [],
      };
      s.steps = [s.vinter, s.vave, ...(smoothVFI ? [s.smooth] : []), s.signal];
      s.series = [s.hlc3, s.vaveArr, s.vcpArr, s.vfiPlot, s.sigPlot, s.histPlot];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const { hlc3, vaveArr, vcpArr } = s;
      hlc3[i] = (b.high + b.low + b.close) / 3;

      // Log inter-bar change and its stdev
      const inter = i > 0 ? Math.log(hlc3[i]) - Math.log(hlc3[i - 1]) : 0;
      const vinterV = s.vinter.step(inter);

      // Volume average and cutoff
      vaveArr[i] = s.vave.step(b.volume ?? 0);

      // Compute VCP (volume-confirmed price flow)
      const vinter = vinterV ?? 0;
      const cutoff = coef * vinter * b.close;
      const vave = i > 0 ? (vaveArr[i - 1] ?? 1) : 1;
      const vmax = vave * vcoef;
      const vol = b.volume ?? 0;
      const vc = vol < vmax ? vol : vmax;
      const mf = i > 0 ? hlc3[i] - hlc3[i - 1] : 0;
      vcpArr[i] = mf > cutoff ? vc : mf < -cutoff ? -vc : 0;

      // Rolling sum of VCP over length, divide by vave, optionally smooth
      let runningSum = s.vars.runningSum;
      runningSum += vcpArr[i];
      if (i >= length) runningSum -= vcpArr[i - length];
      s.vars.runningSum = runningSum;
      const v = vaveArr[i] ?? 1;
      const rawVfi = v !== 0 ? runningSum / v : 0;

      // Optional SMA smoothing
      const vfi = smoothVFI ? s.smooth.step(rawVfi) ?? 0 : rawVfi;
      const sig = s.signal.step(vfi);

      const time = b.time as number;
      s.vfiPlot[i] = { time, value: i < warmup ? NaN : vfi };
      s.sigPlot[i] = { time, value: (i < warmup || sig == null) ? NaN : sig };
      // Pine: d = vfi - vfima (histogram)
      s.histPlot[i] = { time, value: (i < warmup || sig == null) ? NaN : vfi - sig };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.vfiPlot.slice(), 'plot1': s.sigPlot.slice(), 'plot2': s.histPlot.slice() },
        hlines: [
          { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeFlowIndicatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolumeFlowIndicatorInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const VolumeFlowIndicator = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
