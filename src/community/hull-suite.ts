/**
 * Hull Suite
 *
 * Three Hull MA variants: HMA, EHMA (EMA-based), THMA (Triple).
 * Outputs MHULL (current) and SHULL (2-bar lag) for band/cloud display.
 * Alerts (alertcondition, `alerts` of the result): 'Hull trending up.' (MHULL crosses over SHULL) and
 * 'Hull trending down.' (SHULL crosses over MHULL).
 *
 * Reference: "Hull Suite by InSilico"
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface HullSuiteInputs {
  source: SourceType;
  mode: string;
  length: number;
}

export const defaultInputs: HullSuiteInputs = {
  source: 'close',
  mode: 'Hma',
  length: 55,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'mode', type: 'string', title: 'Hull Variation', defval: 'Hma', options: ['Hma', 'Ehma', 'Thma'] },
  { id: 'length', type: 'int', title: 'Length', defval: 55, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MHULL', color: '#00ff00', lineWidth: 2 },
  { id: 'plot1', title: 'SHULL', color: '#00ff00', lineWidth: 2 },
];

export const metadata = {
  title: 'Hull Suite',
  shortTitle: 'HS',
  overlay: true,
};

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Hull trending up.', message: 'Hull trending up.' },
  { id: 'alert1', title: 'Hull trending down.', message: 'Hull trending down.' },
];

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { alerts: AlertConditionState[] };
type Hull = { step(v: number): number; commit(): void };

interface HullRun extends BarRunState<Record<string, never>> {
  hull: Hull;
  hullArr: number[];
  mhull: Point[];
  shull: Point[];
  fillColors: string[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

/** The Hull variant stepped bar by bar */
function hullStep(mode: string, length: number): Hull {
  const sqrtLen = Math.round(Math.sqrt(length));
  if (mode === 'Ehma') {
    // EHMA: ema(2*ema(src, len/2) - ema(src, len), sqrt(len))
    const halfEma = taStep.ema(Math.max(1, Math.floor(length / 2)));
    const fullEma = taStep.ema(length);
    const outer = taStep.ema(Math.max(1, sqrtLen));
    return {
      step: (v) => outer.step(halfEma.step(v) * 2 - fullEma.step(v)),
      commit: () => { halfEma.commit(); fullEma.commit(); outer.commit(); },
    };
  }
  if (mode === 'Thma') {
    // THMA: wma(wma(src, len/3)*3 - wma(src, len/2) - wma(src, len), len)
    const halfLen = Math.max(1, Math.floor(length / 2));
    const thirdLen = Math.max(1, Math.floor(length / 3));
    const wma3 = taStep.wma();
    const wmaHalf = taStep.wma();
    const wmaFull = taStep.wma();
    const outer = taStep.wma();
    return {
      step: (v) => outer.step(wma3.step(v, thirdLen) * 3 - wmaHalf.step(v, halfLen) - wmaFull.step(v, length), length),
      commit: () => { wma3.commit(); wmaHalf.commit(); wmaFull.commit(); outer.commit(); },
    };
  }
  // HMA: wma(2*wma(src, len/2) - wma(src, len), sqrt(len))
  return taStep.hma(length);
}

function study(inputs: Partial<HullSuiteInputs>): BarStudy<HullRun, Result> {
  const { source, mode, length } = { ...defaultInputs, ...inputs };
  const value = barSource(source);
  const warmup = length;
  return {
    fullRunReason: () => (isBarSource(source) ? null : 'source of another study'),
    init() {
      const hull = hullStep(mode, length);
      const s: HullRun = {
        hull, hullArr: [], mhull: [], shull: [], fillColors: [], barColors: [], flags: [[], []], times: [[], []],
        steps: [hull], vars: {}, lists: [], series: [],
      };
      s.lists = [s.barColors, ...s.times];
      s.series = [s.hullArr, s.mhull, s.shull, s.fillColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const hullArr = s.hullArr;
      const time = bars[i].time;
      const v = s.hull.step(value(bars[i]));
      hullArr[i] = v;
      if (i < warmup) {
        s.mhull[i] = { time, value: NaN };
      } else {
        const shullVal = i >= warmup + 2 ? hullArr[i - 2] : NaN;
        const color = !isNaN(shullVal) && v > shullVal ? '#00FF00' : '#FF0000';
        s.barColors.push({ time: time as number, color });
        s.mhull[i] = { time, value: v, color };
      }
      if (i < warmup + 2) {
        s.shull[i] = { time, value: NaN };
      } else {
        const shullVal = hullArr[i - 2];
        s.shull[i] = { time, value: shullVal, color: v > shullVal ? '#00FF00' : '#FF0000' };
      }
      // Dynamic fill colors
      s.fillColors[i] = i < warmup + 2 ? 'transparent' : v > hullArr[i - 2] ? '#00FF0040' : '#FF000040';

      // alertcondition(crossover(MHULL, SHULL), "Hull trending up.") / alertcondition(crossover(SHULL, MHULL), ...):
      // MHULL = HULL, SHULL = HULL[2]
      const sh = i >= 2 ? hullArr[i - 2] : NaN;
      const pv = i > 0 ? hullArr[i - 1] : NaN;
      const psh = i >= 3 ? hullArr[i - 3] : NaN;
      const flags = [v > sh && pv <= psh, sh > v && psh <= pv];
      for (let k = 0; k < 2; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.mhull.slice(), 'plot1': s.shull.slice() },
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: '#00ff00' }, colors: s.fillColors.slice() }],
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      } as Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[]; alerts: AlertConditionState[] };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<HullSuiteInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<HullSuiteInputs> = {},
): IndicatorResult & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const HullSuite = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
