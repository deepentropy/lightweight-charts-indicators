/**
 * Trading Activity Index
 *
 * Trading activity = log of the average dollar volume (close * volume) over the formation window. The line colour
 * goes from light blue to orange-red with the position of the value between its lowest and highest value over the
 * history window. Four quintile bands (20th, 40th, 60th and 80th percentiles of the activity over the history
 * window, linear interpolation) are drawn in shades from light blue to deep blue.
 *
 * Reference: "Trading Activity Index (Zeiierman)" by Zeiierman
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, math, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface TradingActivityIndexInputs {
  /** Formation window (bars) for averaging dollar volume before taking the log */
  lenForm: number;
  /** History window (bars) used to compute rolling percentiles and bands */
  lenHist: number;
}

export const defaultInputs: TradingActivityIndexInputs = {
  lenForm: 20,
  lenHist: 252,
};

export const inputConfig: InputConfig[] = [
  { id: 'lenForm', type: 'int', title: 'Formation Window (bars)', defval: 20, min: 2, step: 1 },
  { id: 'lenHist', type: 'int', title: 'History Window (bars)', defval: 252, min: 50, step: 5 },
];

/** gradientColor / blueGradient of the script: linear blend of two RGB colours, channels rounded */
function blend(v: number, from: [number, number, number], to: [number, number, number]): string {
  const [r1, g1, b1] = from;
  const [r2, g2, b2] = to;
  const r = r1 + (r2 - r1) * v;
  const g = g1 + (g2 - g1) * v;
  const b = b1 + (b2 - b1) * v;
  return String(color.rgb(math.round(r), math.round(g), math.round(b)));
}
const LIGHT_BLUE: [number, number, number] = [173, 216, 230];
const ORANGE_RED: [number, number, number] = [255, 69, 0];
const DEEP_BLUE: [number, number, number] = [0, 0, 255];
const gradientColor = (v: number) => blend(v, LIGHT_BLUE, ORANGE_RED);
const blueGradient = (v: number) => blend(v, LIGHT_BLUE, DEEP_BLUE);

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trading Activity', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'P20', color: blueGradient(0.2), lineWidth: 1 },
  { id: 'plot2', title: 'P40', color: blueGradient(0.4), lineWidth: 1 },
  { id: 'plot3', title: 'P60', color: blueGradient(0.6), lineWidth: 1 },
  { id: 'plot4', title: 'P80', color: blueGradient(0.8), lineWidth: 1 },
];

export const metadata = {
  title: 'Trading Activity Index (Zeiierman)',
  shortTitle: 'Trading Activity Index',
  overlay: false,
};

/** Pine float equality: |a - b| <= 1e-10 (na compares false) */
const eq = (a: number, b: number) => Math.abs(a - b) <= 1e-10;

/**
 * `ta.percentile_linear_interpolation(source, length, percentage)` one bar at a time for several percentages of the
 * same source and length, with the sorted window of the library function (the new value inserted before the first
 * value `>=` it, then the value of the bar leaving the window removed): the same doubles. `step` reads the window with
 * the new value without changing it; `commit` applies the insertion and removal of the last step.
 */
class PercentilesLinear implements Committable {
  private readonly values: number[] = [];
  private readonly bars: number[] = [];
  private count = 0;
  private pending = NaN;
  private pendingK = 0;
  private stepped = false;

  constructor(private readonly length: number, private readonly percentages: readonly number[]) {}

  /** The percentiles of the window with `v` in `out` (NaN before bar `length - 1`) */
  step(v: number, out: number[]): void {
    this.stepped = true;
    this.pending = v;
    const { values, bars, length } = this;
    const i = this.count;
    let k = 0;
    while (k < values.length && !(values[k] >= v)) k++;
    this.pendingK = k;
    if (i < length - 1) {
      for (let p = 0; p < this.percentages.length; p++) out[p] = NaN;
      return;
    }
    // index in the window after the insertion of the bar that leaves it (-1: none)
    let old = -1;
    if (i >= length) {
      const r = bars.indexOf(i - length);
      old = r < k ? r : r + 1;
    }
    const inserted = (j: number) => (j < k ? values[j] : j === k ? v : values[j - 1]);
    const at = (j: number) => (old < 0 || j < old ? inserted(j) : inserted(j + 1));
    for (let p = 0; p < this.percentages.length; p++) {
      const pos = (this.percentages[p] / 100) * length - 0.5;
      if (pos <= 0) out[p] = at(0);
      else if (pos >= length - 1) out[p] = at(length - 1);
      else {
        const lo = Math.floor(pos);
        out[p] = at(lo) + (pos - lo) * (at(lo + 1) - at(lo));
      }
    }
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    const { values, bars, length } = this;
    const i = this.count++;
    const k = this.pendingK;
    values.splice(k, 0, this.pending);
    bars.splice(k, 0, i);
    if (i >= length) {
      const old = bars.indexOf(i - length);
      values.splice(old, 1);
      bars.splice(old, 1);
    }
  }
}

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface TaiRun extends BarRunState<Record<string, never>> {
  avg: ReturnType<typeof taStep.sma>;
  pct: PercentilesLinear;
  pctOut: number[];
  vMin: ReturnType<typeof taStep.lowest>;
  vMax: ReturnType<typeof taStep.highest>;
  plots: Point[][];
}

const BAND_COLORS = [blueGradient(0.2), blueGradient(0.4), blueGradient(0.6), blueGradient(0.8)];

function study(inputs: Partial<TradingActivityIndexInputs>): BarStudy<TaiRun, Result> {
  const { lenForm, lenHist } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: TaiRun = {
        avg: taStep.sma(), pct: new PercentilesLinear(lenHist, [20, 40, 60, 80]), pctOut: [NaN, NaN, NaN, NaN], vMin: taStep.lowest(),
        vMax: taStep.highest(), plots: [[], [], [], [], []], steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.avg, s.pct, s.vMin, s.vMax];
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      // dlrVol = close * volume; dlrVolAvg = ta.sma(dlrVol, len_form); vscale = math.log(math.max(dlrVolAvg, 1e-10))
      const dlrVolAvg = s.avg.step(b.close * (b.volume ?? NaN), lenForm);
      const vscale = isNaN(dlrVolAvg) ? NaN : Math.log(Math.max(dlrVolAvg, 1e-10));

      // Rolling percentiles of vscale over len_hist
      s.pct.step(vscale, s.pctOut);
      for (let k = 0; k < 4; k++) {
        // plot(pXX, color = blueGradient(0.2 / 0.4 / 0.6 / 0.8))
        s.plots[1 + k][i] = { time, value: s.pctOut[k], color: BAND_COLORS[k] };
      }

      // rank01 = vMax == vMin ? 0.5 : math.max(0.0, math.min(1.0, (vscale - vMin) / (vMax - vMin))) (na when a value is na)
      const vMin = s.vMin.step(vscale, lenHist);
      const vMax = s.vMax.step(vscale, lenHist);
      let rank01: number;
      if (eq(vMax, vMin)) rank01 = 0.5;
      else {
        const r = (vscale - vMin) / (vMax - vMin);
        rank01 = isNaN(r) ? NaN : Math.max(0, Math.min(1, r));
      }
      // plot(vscale, "Trading Activity", color = gradientColor(rank01), linewidth = 2)
      s.plots[0][i] = { time, value: vscale, color: gradientColor(rank01) };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice(), plot3: s.plots[3].slice(),
          plot4: s.plots[4].slice(),
        },
        markers: [],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TradingActivityIndexInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<TradingActivityIndexInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const TradingActivityIndex = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
