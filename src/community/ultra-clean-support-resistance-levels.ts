/**
 * Ultra Clean Support / Resistance Levels
 *
 * Pivot highs / lows (left / right lengths) of the high / low, read one bar later. The last pivot high is the
 * resistance level and the last pivot low the support level; each level is held until the next pivot. A level is
 * not coloured (not drawn) on the bar where its value changes, so each level is a separate flat segment. Each level
 * is drawn twice: shifted back by right length + 1 bars (on the pivot bar) and without a shift.
 *
 * Reference: "Ultra Clean Support / Resistance Levels" by Stocktitian
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Stocktitian
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface UltraCleanSupportResistanceLevelsInputs {
  /** Pivot left length */
  pvtLenL: number;
  /** Pivot right length */
  pvtLenR: number;
}

export const defaultInputs: UltraCleanSupportResistanceLevelsInputs = {
  pvtLenL: 25,
  pvtLenR: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'pvtLenL', type: 'int', title: 'Pivot Length Left Hand Side', defval: 25, min: 1 },
  { id: 'pvtLenR', type: 'int', title: 'Pivot Length Right Hand Side', defval: 5, min: 1 },
];

const RES_COLOR = '#4c0042';
const SUP_COLOR = '#004c0a';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Resistance', color: RES_COLOR, lineWidth: 2 },
  { id: 'plot1', title: 'Support', color: SUP_COLOR, lineWidth: 2 },
  { id: 'plot2', title: 'Resistance 2', color: RES_COLOR, lineWidth: 2 },
  { id: 'plot3', title: 'Support 2', color: SUP_COLOR, lineWidth: 2 },
];

export const metadata = {
  title: 'Ultra Clean Support / Resistance Levels',
  shortTitle: 'U C Sup Res',
  overlay: true,
};

/** Pine `!=`: beyond 1e-10; false when a value is na */
const ne = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) > 1e-10;

type Point = { time: number; value: number; color: string };

interface UltraCleanVars {
  /** pvthis / pvtlos: the last pivot high / low */
  hi: number;
  lo: number;
}

interface UltraCleanRun extends BarRunState<UltraCleanVars> {
  ph: PivotStep;
  pl: PivotStep;
  pvthi: number[];
  pvtlo: number[];
  pvthis: number[];
  pvtlos: number[];
  plots: Point[][];
}

function study(inputs: Partial<UltraCleanSupportResistanceLevelsInputs>): BarStudy<UltraCleanRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const shunt = 1;
  // offset = -pvtLenR - Shunt: the value of bar i is drawn on bar i - k
  const k = cfg.pvtLenR + shunt;
  // maxLvlLen = 0: the levels are always drawn (the ta.barssince counts are not used)
  return {
    init() {
      const ph = new PivotStep(cfg.pvtLenL, cfg.pvtLenR, true);
      const pl = new PivotStep(cfg.pvtLenL, cfg.pvtLenR, false);
      const s: UltraCleanRun = {
        ph, pl, pvthi: [], pvtlo: [], pvthis: [], pvtlos: [], plots: [[], [], [], []],
        steps: [ph, pl], vars: { hi: NaN, lo: NaN }, lists: [], series: [],
      };
      // the shifted plots get one point per bar from bar k on (a list); the others one point per bar
      s.lists = [s.plots[0], s.plots[1]];
      s.series = [s.pvthi, s.pvtlo, s.pvthis, s.pvtlos, s.plots[2], s.plots[3]];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      s.pvthi[i] = s.ph.step(i, b.high);
      s.pvtlo[i] = s.pl.step(i, b.low);
      // pvthis := na(pvthi) ? pvthis[1] : pvthi, with pvthi = pvthi_[Shunt]
      const ph = i >= shunt ? s.pvthi[i - shunt] : NaN;
      const pl = i >= shunt ? s.pvtlo[i - shunt] : NaN;
      if (!isNaN(ph)) v.hi = ph;
      if (!isNaN(pl)) v.lo = pl;
      const hi = v.hi;
      const lo = v.lo;
      s.pvthis[i] = hi;
      s.pvtlos[i] = lo;
      // hipc = ta.change(pvthis) != 0 ? na : color (na change: coloured)
      const hipc = i > 0 && ne(hi - s.pvthis[i - 1], 0) ? 'transparent' : RES_COLOR;
      const lopc = i > 0 && ne(lo - s.pvtlos[i - 1], 0) ? 'transparent' : SUP_COLOR;
      if (i >= k) {
        const time = bars[i - k].time;
        s.plots[0].push({ time, value: hi, color: hipc });
        s.plots[1].push({ time, value: lo, color: lopc });
      }
      s.plots[2][i] = { time: b.time, value: hi, color: hipc };
      s.plots[3][i] = { time: b.time, value: lo, color: lopc };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plots[0].slice(),
          plot1: s.plots[1].slice(),
          plot2: s.plots[2].slice(),
          plot3: s.plots[3].slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(
  inputs: Partial<UltraCleanSupportResistanceLevelsInputs> = {},
  chart: ChartContext = {},
): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<UltraCleanSupportResistanceLevelsInputs> = {},
): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const UltraCleanSupportResistanceLevels = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
