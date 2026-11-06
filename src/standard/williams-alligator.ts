/**
 * Williams Alligator Indicator
 *
 * A trend-following indicator consisting of three smoothed moving averages:
 * - Jaw (Blue): 13-period SMMA, shifted 8 bars
 * - Teeth (Red): 8-period SMMA, shifted 5 bars
 * - Lips (Green): 5-period SMMA, shifted 3 bars
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface WilliamsAlligatorInputs {
  /** Jaw period */
  jawLength: number;
  /** Teeth period */
  teethLength: number;
  /** Lips period */
  lipsLength: number;
  /** Jaw offset */
  jawOffset: number;
  /** Teeth offset */
  teethOffset: number;
  /** Lips offset */
  lipsOffset: number;
}

export const defaultInputs: WilliamsAlligatorInputs = {
  jawLength: 13,
  teethLength: 8,
  lipsLength: 5,
  jawOffset: 8,
  teethOffset: 5,
  lipsOffset: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'jawLength', type: 'int', title: 'Jaw Length', defval: 13, min: 1 },
  { id: 'teethLength', type: 'int', title: 'Teeth Length', defval: 8, min: 1 },
  { id: 'lipsLength', type: 'int', title: 'Lips Length', defval: 5, min: 1 },
  { id: 'jawOffset', type: 'int', title: 'Jaw Offset', defval: 8 },
  { id: 'teethOffset', type: 'int', title: 'Teeth Offset', defval: 5 },
  { id: 'lipsOffset', type: 'int', title: 'Lips Offset', defval: 3 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Jaw', color: '#2962FF', lineWidth: 1, offset: 8 },
  { id: 'plot1', title: 'Teeth', color: '#E91E63', lineWidth: 1, offset: 5 },
  { id: 'plot2', title: 'Lips', color: '#66BB6A', lineWidth: 1, offset: 3 },
];

export const metadata = {
  title: 'Williams Alligator',
  shortTitle: 'Alligator',
  overlay: true,
};

type Point = { time: number; value: number };

interface AlligatorRun extends BarRunState<Record<string, never>> {
  rmas: ReturnType<typeof taStep.rma>[];
  /** The SMMA of each line by bar */
  values: number[][];
  /** The shifted line of each SMMA */
  lines: Point[][];
}

function study(inputs: Partial<WilliamsAlligatorInputs>): BarStudy<AlligatorRun, IndicatorResult> {
  const { jawLength, jawOffset, teethLength, teethOffset, lipsLength, lipsOffset } = { ...defaultInputs, ...inputs };
  const offsets = [jawOffset, teethOffset, lipsOffset];
  return {
    init() {
      const rmas = [taStep.rma(jawLength), taStep.rma(teethLength), taStep.rma(lipsLength)];
      const s: AlligatorRun = { rmas, values: [[], [], []], lines: [[], [], []], steps: rmas, vars: {}, lists: [], series: [] };
      s.series = [...s.values, ...s.lines];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const hl2 = (b.high + b.low) / 2;
      for (let k = 0; k < 3; k++) {
        const v = s.rmas[k].step(hl2);
        const values = s.values[k];
        const line = s.lines[k];
        values[i] = v;
        // Apply offsets by shifting values: value[i + offset] = calculated[i] (the PineScript offset shifts values
        // forward on the chart); a negative offset: bar i writes its own point to na and the point of bar i + offset
        const offset = offsets[k];
        if (offset >= 0) {
          line[i] = { time: b.time, value: i >= offset ? values[i - offset] ?? NaN : NaN };
        } else {
          line[i] = { time: b.time, value: NaN };
          const j = i + offset;
          if (j >= 0) line[j] = { time: bars[j].time, value: v ?? NaN };
        }
      }
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.lines[0].slice(),
          'plot1': s.lines[1].slice(),
          'plot2': s.lines[2].slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<WilliamsAlligatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<WilliamsAlligatorInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const WilliamsAlligator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
