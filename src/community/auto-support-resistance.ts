/**
 * Automatic Support & Resistance by getmohsin.py
 *
 * Pine: overlay=true, 8 plots from pivot analysis:
 *   level1/level2 = quick pivot high/low (valuewhen occurrence 0)
 *   level3/level4 = regular pivot high/low (valuewhen occurrence 0)
 *   level5/level6 = regular pivot high/low (valuewhen occurrence 1)
 *   level7/level8 = regular pivot high/low (valuewhen occurrence 2)
 * Each plot colored green when close >= level, red otherwise.
 *
 * Reference: "Automatic Support & Resistance by getmohsin.py" (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AutoSupportResistanceInputs {
  left: number;
  right: number;
  quickRight: number;
}

export const defaultInputs: AutoSupportResistanceInputs = {
  left: 50,
  right: 25,
  quickRight: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'left', type: 'int', title: 'Left Bars', defval: 50, min: 1 },
  { id: 'right', type: 'int', title: 'Right Bars', defval: 25, min: 1 },
  { id: 'quickRight', type: 'int', title: 'Quick Right', defval: 5, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'level1', title: 'Quick Res', color: '#26A69A', lineWidth: 1 },
  { id: 'level2', title: 'Quick Sup', color: '#26A69A', lineWidth: 1 },
  { id: 'level3', title: 'Res 1', color: '#26A69A', lineWidth: 1 },
  { id: 'level4', title: 'Sup 1', color: '#26A69A', lineWidth: 1 },
  { id: 'level5', title: 'Res 2', color: '#26A69A', lineWidth: 1 },
  { id: 'level6', title: 'Sup 2', color: '#26A69A', lineWidth: 1 },
  { id: 'level7', title: 'Res 3', color: '#26A69A', lineWidth: 1 },
  { id: 'level8', title: 'Sup 3', color: '#26A69A', lineWidth: 1 },
];

export const metadata = {
  title: 'Automatic Support & Resistance',
  shortTitle: 'Auto S/R',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };

interface AutoSrRun extends BarRunState<Record<string, never>> {
  ph: PivotStep;
  pl: PivotStep;
  qph: PivotStep;
  qpl: PivotStep;
  levels: ReturnType<typeof taStep.valuewhen>[];
  plotData: Point[][];
}

const GREEN = '#26A69A';
const RED = '#EF5350';

function study(inputs: Partial<AutoSupportResistanceInputs>): BarStudy<AutoSrRun, IndicatorResult> {
  const { left, right, quickRight } = { ...defaultInputs, ...inputs };
  return {
    init() {
      // Pine default source is "Close" for pivots
      const ph = new PivotStep(left, right, true);
      const pl = new PivotStep(left, right, false);
      const qph = new PivotStep(left, quickRight, true);
      const qpl = new PivotStep(left, quickRight, false);
      // valuewhen occurrences of level1..level8
      const levels = [0, 0, 0, 0, 1, 1, 2, 2].map((occ) => taStep.valuewhen(occ));
      const s: AutoSrRun = {
        ph, pl, qph, qpl, levels, plotData: levels.map(() => []),
        steps: [ph, pl, qph, qpl, ...levels], vars: {}, lists: [], series: [],
      };
      s.series = s.plotData;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const close = b.close;
      // Pivot highs and lows as conditions (found where the pivot is not na)
      const pivotHighCond = !isNaN(s.ph.step(i, close));
      const pivotLowCond = !isNaN(s.pl.step(i, close));
      const quickPivotHighCond = !isNaN(s.qph.step(i, close));
      const quickPivotLowCond = !isNaN(s.qpl.step(i, close));

      // Pine: valuewhen(pivot_cond, close[offset], occurrence)
      // The pivot fires at the confirmation bar (offset bars after the pivot bar),
      // so close[offset] there is the close of the pivot bar.
      const closeQuick = i >= quickRight ? bars[i - quickRight].close : NaN;
      const closeRight = i >= right ? bars[i - right].close : NaN;
      const conds = [
        quickPivotHighCond, quickPivotLowCond, pivotHighCond, pivotLowCond,
        pivotHighCond, pivotLowCond, pivotHighCond, pivotLowCond,
      ];
      for (let k = 0; k < 8; k++) {
        const v = s.levels[k].step(conds[k], k < 2 ? closeQuick : closeRight);
        s.plotData[k][i] = {
          time: b.time,
          value: isNaN(v) ? NaN : v,
          color: !isNaN(v) ? (close >= v ? GREEN : RED) : undefined,
        };
      }
    },
    result(s) {
      const p = s.plotData;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          level1: p[0].slice(),
          level2: p[1].slice(),
          level3: p[2].slice(),
          level4: p[3].slice(),
          level5: p[4].slice(),
          level6: p[5].slice(),
          level7: p[6].slice(),
          level8: p[7].slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AutoSupportResistanceInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AutoSupportResistanceInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const AutoSupportResistance = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
