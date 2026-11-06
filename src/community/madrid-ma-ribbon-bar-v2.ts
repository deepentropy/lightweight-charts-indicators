/**
 * Madrid MA Ribbon Bar v2
 *
 * Twenty moving averages of the close (lengths 5 to 100, step 5; EMA or SMA) shown as a stack of 20 column bands
 * (band k from 5 * (k - 1) to 5 * k). Each band is coloured from the slope of its average and the position of the
 * 5-bar average against the 100-bar average: lime (rising, 5 above 100), maroon (falling, 5 above 100), red
 * (falling or flat, 5 below 100), green (rising, 5 below 100), else gray. The bands 95 and 100 use the 90-bar
 * average, as the original does.
 *
 * Reference: "Madrid MA Ribbon Bar v2" by Madrid
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type Bar, type IndicatorResult, type InputConfig, type PlotConfig } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MadridMaRibbonBarV2Inputs {
  /** Exponential MA (else simple) */
  exponential: boolean;
}

export const defaultInputs: MadridMaRibbonBarV2Inputs = {
  exponential: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'exponential', type: 'bool', title: 'Exponential MA', defval: true },
];

const LEVELS = Array.from({ length: 20 }, (_, k) => 5 * (k + 1));

export const plotConfig: PlotConfig[] = LEVELS.map((lvl, k) => ({
  id: `plot${k}`,
  title: `MMA${lvl < 10 ? '0' : ''}${lvl}`,
  color: '#2962FF',
  lineWidth: 2,
  style: 'columns' as const,
  histbase: lvl - 5,
}));

export const metadata = {
  title: 'Madrid MA Ribbon Bar v2',
  shortTitle: 'MMARB',
  overlay: false,
  precision: 0,
};

/** Pine float comparisons (1e-10; na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => a - b > -EPS;
const le = (a: number, b: number) => b - a > -EPS;

type Point = { time: number; value: number; color: string };
type Ma = { step(v: number): number; commit(): void };

interface MadridRun extends BarRunState<Record<string, never>> {
  mas: Ma[];
  /** The value of each average by bar */
  vals: number[][];
  plots: Point[][];
}

function study(inputs: Partial<MadridMaRibbonBarV2Inputs>): BarStudy<MadridRun, IndicatorResult> {
  const { exponential } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const mas: Ma[] = LEVELS.map((len) => (exponential ? taStep.ema(len) : new WindowSma(len)));
      const s: MadridRun = {
        mas, vals: LEVELS.map(() => []), plots: LEVELS.map(() => []),
        steps: mas, vars: {}, lists: [], series: [],
      };
      s.series = [...s.vals, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const c = b.close;
      for (let k = 0; k < LEVELS.length; k++) s.vals[k][i] = s.mas[k].step(c);
      const ma05 = s.vals[0];
      const ma100 = s.vals[19];

      // maColor(ma, maRef): ta.change(ma) against 0, ma05 against the reference
      const colourOf = (ma: number[]): string => {
        const ch = i > 0 ? ma[i] - ma[i - 1] : NaN;
        const above = gt(ma05[i], ma100[i]);
        const below = lt(ma05[i], ma100[i]);
        if (ge(ch, 0) && above) return color.lime;
        if (lt(ch, 0) && above) return color.maroon;
        if (le(ch, 0) && below) return color.red;
        if (ge(ch, 0) && below) return color.green;
        return color.gray;
      };
      for (let k = 0; k < LEVELS.length; k++) {
        // MMA95 and MMA100 take the colour of ma90 in the original
        s.plots[k][i] = { time: b.time, value: LEVELS[k], color: colourOf(s.vals[Math.min(k, 17)]) };
      }
    },
    result(s) {
      const plots: IndicatorResult['plots'] = {};
      LEVELS.forEach((_, k) => { plots[`plot${k}`] = s.plots[k].slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MadridMaRibbonBarV2Inputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MadridMaRibbonBarV2Inputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const MadridMaRibbonBarV2 = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
