/**
 * PAFT (Price Action Follow-Through)
 *
 * A column score of the follow-through after a cross of the close and its EMA. A bar where the close crosses over
 * the EMA (and closes above it) sets the score to +1; a cross under (close below) sets it to -1. On the other bars
 * the score adds +1 for an up candle, -1 for a down candle and 0 when the close equals the open or the EMA. Before
 * the EMA warm-up (bar index < EMA length) the score is 0. After a cross, the columns can stay hidden until the score
 * first reaches +2 (up cross) or -2 (down cross). The column is green when the close is above the EMA, red below it,
 * gray on it.
 *
 * Reference: "PAFT — Price Action Follow-Through" by TREESinvest
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PaftInputs {
  /** EMA length */
  emaLen: number;
  /** Score 0 while bar_index < EMA length */
  useWarmup: boolean;
  /** Hide the columns after a cross until the score reaches +2 / -2 */
  hideWeakAfterCross: boolean;
  /** Column colour when the close is above the EMA */
  colAboveEma: string;
  /** Column colour when the close is below the EMA */
  colBelowEma: string;
}

export const defaultInputs: PaftInputs = {
  emaLen: 20,
  useWarmup: true,
  hideWeakAfterCross: true,
  colAboveEma: color.green,
  colBelowEma: color.red,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaLen', type: 'int', title: 'EMA length', defval: 20, min: 1 },
  { id: 'useWarmup', type: 'bool', title: 'Wait for EMA warm-up before scoring', defval: true },
  { id: 'hideWeakAfterCross', type: 'bool', title: 'Hide until ±2 confirm (up: <2 to >=2 / down: >-2 to <=-2)', defval: true },
  { id: 'colAboveEma', type: 'color', title: 'Close above EMA', defval: color.green },
  { id: 'colBelowEma', type: 'color', title: 'Close below EMA', defval: color.red },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Score', color: color.green, lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'PAFT — Price Action Follow-Through',
  shortTitle: 'PAFT',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Point = { time: number; value: number; color: string };

interface PaftVars {
  score: number;
  maskAboveEarly: boolean;
  maskBelowEarly: boolean;
}

interface PaftRun extends BarRunState<PaftVars> {
  ema: ReturnType<typeof taStep.ema>;
  up: ReturnType<typeof taStep.crossover>;
  down: ReturnType<typeof taStep.crossunder>;
  plot0: Point[];
}

function study(inputs: Partial<PaftInputs>): BarStudy<PaftRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const gray = String(color.new(color.gray, 45));
  return {
    init() {
      const ema = taStep.ema(cfg.emaLen);
      // ta.crossover / ta.crossunder compare exactly
      const up = taStep.crossover();
      const down = taStep.crossunder();
      const s: PaftRun = {
        ema, up, down, plot0: [],
        steps: [ema, up, down], vars: { score: 0.0, maskAboveEarly: false, maskBelowEarly: false }, lists: [], series: [],
      };
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const { open, close } = bars[i]!;
      const ema = s.ema.step(close);
      const crossUp = !!s.up.step(close, ema);
      const crossDown = !!s.down.step(close, ema);
      const resetBar = (crossUp && gt(close, ema)) || (crossDown && lt(close, ema));
      const ready = !cfg.useWarmup || i >= cfg.emaLen;
      if (!ready) {
        v.score = 0.0;
        v.maskAboveEarly = false;
        v.maskBelowEarly = false;
      } else if (resetBar) {
        if (crossUp) {
          v.score = 1.0;
          v.maskAboveEarly = true;
          v.maskBelowEarly = false;
        } else if (crossDown) {
          v.score = -1.0;
          v.maskBelowEarly = true;
          v.maskAboveEarly = false;
        }
      } else {
        const candleDelta = eq(close, open) || eq(close, ema) ? 0.0 : lt(close, open) ? -1.0 : 1.0;
        v.score = v.score + candleDelta;
      }
      const score = v.score;
      if (ready) {
        if (v.maskAboveEarly && ge(score, 2.0)) v.maskAboveEarly = false;
        if (v.maskBelowEarly && le(score, -2.0)) v.maskBelowEarly = false;
      }
      const weakHidden = cfg.hideWeakAfterCross && ready
        && ((v.maskAboveEarly && lt(score, 2.0)) || (v.maskBelowEarly && gt(score, -2.0)));
      const c = gt(close, ema) ? cfg.colAboveEma : lt(close, ema) ? cfg.colBelowEma : gray;
      s.plot0[i] = { time: bars[i]!.time as number, value: weakHidden ? NaN : score, color: c };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        hlines: [{ value: 0, options: { title: 'Zero', color: String(color.new(color.gray, 50)), linestyle: 'dotted' } }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PaftInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PaftInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const Paft = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
