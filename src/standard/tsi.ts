/**
 * True Strength Index (TSI) Indicator
 *
 * A momentum oscillator that uses double-smoothed price changes.
 * TSI = 100 * (double_smooth(pc) / double_smooth(|pc|))
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TSIInputs {
  /** Long EMA period */
  longLength: number;
  /** Short EMA period */
  shortLength: number;
  /** Signal line period */
  signalLength: number;
}

export const defaultInputs: TSIInputs = {
  longLength: 25,
  shortLength: 13,
  signalLength: 13,
};

export const inputConfig: InputConfig[] = [
  { id: 'longLength', type: 'int', title: 'Long Length', defval: 25 },
  { id: 'shortLength', type: 'int', title: 'Short Length', defval: 13 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 13 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'True Strength Index', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Signal', color: '#E91E63', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, color: '#787B86', linestyle: 'solid', title: 'Zero' },
];

export const metadata = {
  title: 'True Strength Index',
  shortTitle: 'TSI',
  overlay: false,
};

type Ema = ReturnType<typeof taStep.ema>;
type Point = { time: any; value: number };

interface TsiRun extends BarRunState<Record<string, never>> {
  pc1: Ema;
  pc2: Ema;
  abs1: Ema;
  abs2: Ema;
  sig: Ema;
  tsiData: Point[];
  signalData: Point[];
}

function study(inputs: Partial<TSIInputs>): BarStudy<TsiRun, IndicatorResult> {
  const { longLength, shortLength, signalLength } = { ...defaultInputs, ...inputs };
  return {
    init() {
      // Double smooth function: EMA(EMA(src, long), short)
      const pc1 = taStep.ema(longLength);
      const pc2 = taStep.ema(shortLength);
      const abs1 = taStep.ema(longLength);
      const abs2 = taStep.ema(shortLength);
      // Signal = EMA(TSI, signalLength)
      const sig = taStep.ema(signalLength);
      const s: TsiRun = {
        pc1, pc2, abs1, abs2, sig, tsiData: [], signalData: [],
        steps: [pc1, pc2, abs1, abs2, sig], vars: {}, lists: [], series: [],
      };
      s.series = [s.tsiData, s.signalData];
      return s;
    },
    bar(s, i, bars) {
      // Price change, absolute price change
      const pc = i > 0 ? bars[i].close - bars[i - 1].close : NaN;
      const absPC = isNaN(pc) ? NaN : Math.abs(pc);
      const dsPC = s.pc2.step(s.pc1.step(pc));
      const dsAbsPC = s.abs2.step(s.abs1.step(absPC));
      // TSI = 100 * (double_smooth_pc / double_smooth_abs_pc)
      const value = dsPC == null || dsAbsPC == null || dsAbsPC === 0 ? NaN : 100 * dsPC / dsAbsPC;
      const signal = s.sig.step(value);
      s.tsiData[i] = { time: bars[i].time, value: value ?? NaN };
      s.signalData[i] = { time: bars[i].time, value: signal ?? NaN };
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.tsiData.slice(),
          'plot1': s.signalData.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TSIInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TSIInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const TSI = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
