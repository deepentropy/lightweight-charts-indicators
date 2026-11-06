/**
 * ADX Trend Visualizer with Dual Thresholds
 *
 * Hand-made ADX: +DM / -DM from the high / low changes, +DI and -DI as 100 * RMA(DM) / RMA(true range),
 * DX = 100 * |+DI - -DI| / (+DI + -DI) and ADX = RMA(DX). The ADX line is green above the strong trend threshold,
 * red below the weak trend threshold and yellow between them. +DI and -DI are hidden plots.
 *
 * Reference: "ADX Trend Visualizer with Dual Thresholds" by crankyprofits
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AdxTrendVisualizerWithDualThresholdsInputs {
  /** ADX smoothing length */
  adxLength: number;
  /** Below this ADX the trend is weak */
  lowerThreshold: number;
  /** Above this ADX the trend is strong */
  upperThreshold: number;
}

export const defaultInputs: AdxTrendVisualizerWithDualThresholdsInputs = {
  adxLength: 14,
  lowerThreshold: 15,
  upperThreshold: 25,
};

export const inputConfig: InputConfig[] = [
  { id: 'adxLength', type: 'int', title: 'ADX Length', defval: 14 },
  { id: 'lowerThreshold', type: 'int', title: 'Weak Trend Threshold', defval: 15 },
  { id: 'upperThreshold', type: 'int', title: 'Strong Trend Threshold', defval: 25 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ADX', color: color.yellow, lineWidth: 2 },
  { id: 'plot1', title: '+DI', color: color.teal, lineWidth: 1, display: 'none' },
  { id: 'plot2', title: '-DI', color: color.orange, lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'ADX Trend Visualizer with Dual Thresholds',
  shortTitle: 'ADX Trend Visualizer with Dual Thresholds',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
/** Plots show na for non-finite values */
const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

type Point = { time: number; value: number; color: string };

interface AdxRun extends BarRunState<Record<string, never>> {
  tr: ReturnType<typeof taStep.tr>;
  trur: ReturnType<typeof taStep.rma>;
  plusRma: ReturnType<typeof taStep.rma>;
  minusRma: ReturnType<typeof taStep.rma>;
  adx: ReturnType<typeof taStep.rma>;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
}

function study(inputs: Partial<AdxTrendVisualizerWithDualThresholdsInputs>): BarStudy<AdxRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.adxLength;
  return {
    init() {
      const s: AdxRun = {
        tr: taStep.tr(true), trur: taStep.rma(len), plusRma: taStep.rma(len), minusRma: taStep.rma(len),
        adx: taStep.rma(len), plot0: [], plot1: [], plot2: [], steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.tr, s.trur, s.plusRma, s.minusRma, s.adx];
      s.series = [s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const time = b.time as number;
      const prev = i > 0 ? bars[i - 1]! : null;
      // up = math.max(ta.change(high), 0), down = math.max(-ta.change(low), 0) (na on bar 0)
      const up = prev ? Math.max(b.high - prev.high, 0) : NaN;
      const down = prev ? Math.max(-(b.low - prev.low), 0) : NaN;
      const plusDM = gt(up, down) && gt(up, 0) ? up : 0;
      const minusDM = gt(down, up) && gt(down, 0) ? down : 0;
      const trur = s.trur.step(s.tr.step(b.high, b.low, b.close));
      const plusRma = s.plusRma.step(plusDM);
      const minusRma = s.minusRma.step(minusDM);
      // Plain divisions: x / 0 is +-infinity, 0 / 0 is na (ta.rma skips both)
      const plusDI = (100 * plusRma) / trur;
      const minusDI = (100 * minusRma) / trur;
      const dx = (100 * Math.abs(plusDI - minusDI)) / (plusDI + minusDI);
      const adx = s.adx.step(dx);
      const c = gt(adx, cfg.upperThreshold) ? color.green : lt(adx, cfg.lowerThreshold) ? color.red : color.yellow;
      s.plot0[i] = { time, value: fin(adx), color: c };
      s.plot1[i] = { time, value: fin(plusDI), color: color.teal };
      s.plot2[i] = { time, value: fin(minusDI), color: color.orange };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        hlines: [
          { value: cfg.lowerThreshold, options: { title: 'Lower Threshold', color: color.red, linestyle: 'dotted' } },
          { value: cfg.upperThreshold, options: { title: 'Upper Threshold', color: color.green, linestyle: 'dotted' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(
  inputs: Partial<AdxTrendVisualizerWithDualThresholdsInputs> = {},
  chart: ChartContext = {},
): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<AdxTrendVisualizerWithDualThresholdsInputs> = {},
): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const AdxTrendVisualizerWithDualThresholds = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
