/**
 * Gaussian Acceleration Array
 *
 * For a WMA of the high, of the low and of hl2 over the sample period: velocity = change of the signed logarithm
 * (sign(x) * log(|x| + 1)) of the EMA (smoothing length) of the WMA; acceleration = change of the signed logarithm
 * of the ALMA (sample period, offset 0.85, sigma 6) of the velocity. This is done for five periods (period,
 * period -+ variance, period -+ 2 * variance; the last two are drawn only with "Display Exponential Array"). The hl2
 * line is green when its velocity is positive, red otherwise; the zone between the high and the low accelerations is
 * filled green when the hl2 acceleration rises, red otherwise. The indicator can be inverted.
 *
 * Reference: "Gaussian Acceleration Array" by NantzOS
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © NantzOS
 */

import { taCore, taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface GaussianAccelerationArrayInputs {
  /** Sample period (WMA and ALMA length) */
  period: number;
  /** EMA length of the velocity source */
  smoothing: number;
  /** Period step of the squeezed / stretched arrays */
  aVar: number;
  /** Draw the double squeezed / double stretched arrays */
  displayExpArray: boolean;
  /** Invert the accelerations */
  invertIndicator: boolean;
  colorBear: string;
  colorBull: string;
  colorBearBG: string;
  colorBullBG: string;
}

export const defaultInputs: GaussianAccelerationArrayInputs = {
  period: 26,
  smoothing: 9,
  aVar: 3,
  displayExpArray: false,
  invertIndicator: false,
  colorBear: 'rgb(238, 30, 7)',
  colorBull: 'rgb(98, 255, 41)',
  colorBearBG: 'rgba(238, 30, 7, 0.2)',
  colorBullBG: 'rgba(98, 255, 41, 0.2)',
};

export const inputConfig: InputConfig[] = [
  { id: 'period', type: 'int', title: 'Sample Period', defval: 26 },
  { id: 'smoothing', type: 'int', title: 'Smoothing Function', defval: 9 },
  { id: 'aVar', type: 'int', title: 'Array Variance', defval: 3 },
  { id: 'displayExpArray', type: 'bool', title: 'Display Exponential Array', defval: false },
  { id: 'invertIndicator', type: 'bool', title: 'Invert Indicator', defval: false },
  { id: 'colorBear', type: 'color', title: 'Negative Velocity', defval: 'rgb(238, 30, 7)' },
  { id: 'colorBull', type: 'color', title: 'Positive Velocity', defval: 'rgb(98, 255, 41)' },
  { id: 'colorBearBG', type: 'color', title: 'Decreasing Acceleration', defval: 'rgba(238, 30, 7, 0.2)' },
  { id: 'colorBullBG', type: 'color', title: 'Increasing Acceleration', defval: 'rgba(98, 255, 41, 0.2)' },
];

// One group per period: the hl2 line, then the high and the low lines of the fill (display.none in Pine).
// The double squeezed / stretched line and fill have display = displayExpArray ? display.all : display.none:
// PlotConfig `visible` = the input id, fill colours transparent when the input is off.
const GROUPS = ['Primary', 'Squeezed', 'Stretched', 'Double Squeezed', 'Double Stretched'];
const LINE_TITLES = ['Prime Acceleration', 'Squeezed Acceleration', 'Stretched Acceleration',
  'Double Squeezed Acceleration', 'Double Stretched Acceleration'];

export const plotConfig: PlotConfig[] = GROUPS.flatMap((g, k) => [
  {
    id: `plot${3 * k}`, title: LINE_TITLES[k], color: 'rgb(98, 255, 41)', lineWidth: 1,
    ...(k >= 3 ? { visible: 'displayExpArray' } : {}),
  },
  { id: `plot${3 * k + 1}`, title: `${g} High Acceleration`, color: 'rgb(98, 255, 41)', lineWidth: 1, display: 'none' as const },
  { id: `plot${3 * k + 2}`, title: `${g} Low Acceleration`, color: 'rgb(98, 255, 41)', lineWidth: 1, display: 'none' as const },
]);

export const metadata = {
  title: 'Gaussian Acceleration Array',
  shortTitle: 'ACC-L ',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number; color?: string };

/**
 * `ta.alma(source, length, offset, sigma)` one bar at a time (no taStep machine): the weights and the sum of the last
 * `length` values in the order of the oakscriptjs array function (same doubles); na until `length` bars.
 */
class AlmaStep implements Committable {
  private readonly weights: number[] = [];
  private readonly len: number;
  private values: number[] = [];
  private pending = NaN;
  private stepped = false;

  constructor(length: number, offset: number, sigma: number) {
    // the length check of ta.alma
    taCore.alma([], length, offset, sigma);
    this.len = length;
    const m = offset * (length - 1);
    const s = length / sigma;
    let weightSum = 0;
    for (let i = 0; i < length; i++) {
      const weight = Math.exp(-1 * Math.pow(i - m, 2) / (2 * Math.pow(s, 2)));
      this.weights.push(weight);
      weightSum += weight;
    }
    for (let i = 0; i < length; i++) this.weights[i] /= weightSum;
  }

  step(value: number): number {
    this.stepped = true;
    this.pending = value;
    const len = this.len;
    const n = this.values.length;
    if (n + 1 < len) return NaN;
    let almaValue = 0;
    for (let j = 0; j < len; j++) {
      almaValue += (j === len - 1 ? value : this.values[n - len + 1 + j]) * this.weights[j];
    }
    return almaValue;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.values.push(this.pending);
    if (this.values.length > this.len * 2 + 64) this.values = this.values.slice(-this.len);
  }
}

/** calc_acceleration(src, period, smoothing) of one source: the machines and the values of the bars */
interface Accel {
  wma: ReturnType<typeof taStep.wma>;
  ema: ReturnType<typeof taStep.ema>;
  alma: AlmaStep;
  velSource: number[];
  accSource: number[];
}

interface GaussianRun extends BarRunState<Record<string, never>> {
  /** Per period: the high, low and hl2 accelerations */
  accels: Accel[][];
  /** Per period: the hl2 acceleration (after the inversion) */
  mAcc: number[][];
  plots: Point[][];
  bg: string[][];
}

function study(inputs: Partial<GaussianAccelerationArrayInputs>): BarStudy<GaussianRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  // logarithmic(src) = math.sign(src) * math.log(math.abs(src) + 1)
  const logarithmic = (x: number) => (isNaN(x) ? NaN : Math.sign(x) * Math.log(Math.abs(x) + 1));
  const sign = cfg.invertIndicator ? -1 : 1;
  const bullBg = cfg.colorBullBG;
  const bearBg = cfg.colorBearBG;
  const periods = [cfg.period, cfg.period - cfg.aVar, cfg.period + cfg.aVar,
    cfg.period - 2 * cfg.aVar, cfg.period + 2 * cfg.aVar];

  // calc_acceleration(src, period, smoothing): [acc, vel] of bar i
  const accel = (a: Accel, src: number, len: number, i: number) => {
    const velSource = a.ema.step(a.wma.step(src, len));
    a.velSource[i] = velSource;
    const vel = i > 0 ? logarithmic(velSource) - logarithmic(a.velSource[i - 1]) : NaN;
    const accSource = a.alma.step(vel);
    a.accSource[i] = accSource;
    const acc = i > 0 ? logarithmic(accSource) - logarithmic(a.accSource[i - 1]) : NaN;
    return { acc, vel };
  };

  return {
    init() {
      const s: GaussianRun = {
        accels: periods.map((len) => [0, 1, 2].map((): Accel => ({
          wma: taStep.wma(), ema: taStep.ema(cfg.smoothing), alma: new AlmaStep(len, 0.85, 6), velSource: [], accSource: [],
        }))),
        mAcc: periods.map(() => []), plots: periods.flatMap(() => [[], [], []]), bg: periods.map(() => []),
        steps: [], vars: {}, lists: [], series: [],
      };
      const all = s.accels.flat();
      s.steps = all.flatMap((a) => [a.wma, a.ema, a.alma]);
      s.series = [...all.flatMap((a) => [a.velSource, a.accSource]), ...s.mAcc, ...s.plots, ...s.bg];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const hl2 = (b.high + b.low) / 2;
      periods.forEach((len, k) => {
        const [ha, la, ma] = s.accels[k];
        const h = accel(ha, b.high, len, i);
        const l = accel(la, b.low, len, i);
        const m = accel(ma, hl2, len, i);
        // Inversion: x := invertIndicator ? -x : x
        const hAcc = sign * h.acc;
        const lAcc = sign * l.acc;
        const mAcc = sign * m.acc;
        s.mAcc[k][i] = mAcc;
        // get_colors(vel, acc, acc[1], ...): acc_color = vel > 0 ? bull : bear; acc_bg = acc > acc[1] ? bullBG : bearBG
        const lineColor = gt(m.vel, 0) ? cfg.colorBull : cfg.colorBear;
        const shown = k < 3 || cfg.displayExpArray;
        s.bg[k][i] = !shown ? 'transparent' : i > 0 && gt(mAcc, s.mAcc[k][i - 1]) ? bullBg : bearBg;
        const point = (v: number): Point => ({ time: b.time, value: Number.isFinite(v) ? v : NaN, color: lineColor });
        s.plots[3 * k][i] = point(mAcc);
        s.plots[3 * k + 1][i] = point(hAcc);
        s.plots[3 * k + 2][i] = point(lAcc);
      });
    },
    result(s) {
      const plots: Record<string, Point[]> = {};
      const fills: { plot1: string; plot2: string; colors: string[] }[] = [];
      periods.forEach((_len, k) => {
        plots[`plot${3 * k}`] = s.plots[3 * k].slice();
        plots[`plot${3 * k + 1}`] = s.plots[3 * k + 1].slice();
        plots[`plot${3 * k + 2}`] = s.plots[3 * k + 2].slice();
        fills.push({ plot1: `plot${3 * k + 1}`, plot2: `plot${3 * k + 2}`, colors: s.bg[k].slice() });
      });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills,
        hlines: [
          { value: 0, options: { title: 'Centroid', color: String(color.new(color.white, 80)), linestyle: 'dashed' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<GaussianAccelerationArrayInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<GaussianAccelerationArrayInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const GaussianAccelerationArray = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
