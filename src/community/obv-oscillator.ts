/**
 * OBV Oscillator
 *
 * On Balance Volume minus its EMA, displayed as a histogram.
 * Positive values indicate accumulation, negative indicate distribution.
 *
 * Reference: community indicator
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface OBVOscillatorInputs {
  length: number;
}

export const defaultInputs: OBVOscillatorInputs = {
  length: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'OBV Oscillator', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'OBV Osc Area', color: '#C0C0C0', lineWidth: 1, style: 'area' },
];

export const metadata = {
  title: 'OBV Oscillator',
  shortTitle: 'OBVOsc',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };

interface ObvOscRun extends BarRunState<Record<string, never>> {
  ema: ReturnType<typeof taStep.ema>;
  obvArr: number[];
  plot0: Point[];
  plot1: Point[];
}

function study(inputs: Partial<OBVOscillatorInputs>): BarStudy<ObvOscRun, IndicatorResult> {
  const { length } = { ...defaultInputs, ...inputs };
  const warmup = length;
  return {
    init() {
      const ema = taStep.ema(length);
      const s: ObvOscRun = { ema, obvArr: [], plot0: [], plot1: [], steps: [ema], vars: {}, lists: [], series: [] };
      s.series = [s.obvArr, s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      // Cumulative OBV
      const b = bars[i];
      let obv: number;
      if (i === 0) {
        obv = b.volume ?? 0;
      } else {
        const vol = b.volume ?? 0;
        const prev = s.obvArr[i - 1];
        if (b.close > bars[i - 1].close) obv = prev + vol;
        else if (b.close < bars[i - 1].close) obv = prev - vol;
        else obv = prev;
      }
      s.obvArr[i] = obv;

      // EMA of OBV
      const ema = s.ema.step(obv);
      let p: Point;
      if (i < warmup || ema == null) {
        p = { time: b.time, value: NaN };
      } else {
        const osc = obv - ema;
        const color = osc >= 0 ? '#26A69A' : '#EF5350';
        p = { time: b.time, value: osc, color };
      }
      s.plot0[i] = p;
      // Area plot: same data, silver color (Pine: plot(obv_osc, color=silver, transp=70, style=area))
      s.plot1[i] = { time: p.time, value: p.value };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice() },
        hlines: [
          { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<OBVOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<OBVOscillatorInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const OBVOscillator = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
