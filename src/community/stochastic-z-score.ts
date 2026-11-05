/**
 * Stochastic Z-Score [AlgoAlpha]
 *
 * The z-score of the source over `len` bars ((src - sma) / stdev) goes through a stochastic of itself over `len`
 * bars, scaled to [-2, 2] (stoch / 25 - 2) and smoothed with a Hull MA: the "Smoothed Oscillator" (grey, bright when
 * it rises). Its value one bar back is a hidden line; the fill between them shows the direction. An ALMA of the
 * z-score (offset 0, sigma 0.1) is the long-term momentum, filled against zero. Bands at +/-2 and +/-2.5 take a
 * gradient colour as the oscillator nears them. A dot marks each cross of the oscillator with its previous value;
 * triangles (and labels on the price pane) mark reversals: a cross up below -2 with positive momentum, a cross down
 * above 2 with negative momentum. The raw z-score columns are drawn with "Show Histogram".
 * Alerts (alertcondition, `alerts` of the result): momentum shift, reversals, zero crosses of the oscillator and of
 * the momentum, overbought (> 2.5) and oversold (< -2.5).
 *
 * Chart values (third argument): the port reads the chart foreground colour (dot and label texts) and background
 * colour (band fills); without them #DBDBDB and #0F0F0F (a dark chart).
 *
 * Reference: "Stochastic Z-Score [AlgoAlpha]" by AlgoAlpha
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © AlgoAlpha
 */

import {
  taStep,
  color,
  type Bar,
  type FillConfig,
  type FillData,
  type IndicatorResult,
  type InputConfig,
  type MarkerData,
  type PlotConfig,
  type ShapeConfig,
  type SourceType,
} from 'oakscriptjs';
import { foregroundColorOf, backgroundColorOf, type ChartContext } from '../chart-context';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface StochasticZScoreInputs {
  /** Price series of all the calculations */
  src: SourceType;
  /** Look-back of the averages, deviations, stochastic, Hull MA and ALMA */
  len: number;
  /** Draw the raw z-score as columns */
  hist: boolean;
  /** Colour of the bullish elements */
  green: string;
  /** Colour of the bearish elements */
  red: string;
}

export const defaultInputs: StochasticZScoreInputs = {
  src: 'hlc3',
  len: 21,
  hist: false,
  green: '#00ffbb',
  red: '#ff1100',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'hlc3', group: 'Calculation',
    tooltip: 'Price series used for all calculations. Changing it alters the base values from which the Z-score and momentum are derived.' },
  { id: 'len', type: 'int', title: 'Length', defval: 21, group: 'Calculation',
    tooltip: 'Look-back period for moving averages and deviations. Higher values give smoother, slower signals; lower values make the oscillator faster and more sensitive.' },
  { id: 'hist', type: 'bool', title: 'Show Histogram', defval: false, group: 'Appearance',
    tooltip: 'Toggle display of the raw, unsmoothed Z-score as columns. Useful for visualising noise layer beneath the smoothed oscillator.' },
  { id: 'green', type: 'color', title: 'Bullish Colour', defval: '#00ffbb', group: 'Appearance',
    tooltip: 'Primary colour for bullish visual elements. Adjust for preferred palette – affects bars, fills, and labels when momentum is positive.' },
  { id: 'red', type: 'color', title: 'Bearish Colour', defval: '#ff1100', group: 'Appearance',
    tooltip: 'Primary colour for bearish visual elements. Adjust for preferred palette – affects bars, fills, and labels when momentum is negative.' },
];

const GRAY = color.gray;

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Z-Score', color: String(color.new('#00ffbb', 70)), lineWidth: 2, style: 'columns', visible: 'hist' },
  { id: 'plot1', title: 'Smoothed Oscillator', color: GRAY, lineWidth: 3 },
  { id: 'plot2', title: 'Oscillator (Lag 1)', color: String(color.new(GRAY, 20)), lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Long-Term Momentum (ALMA)', color: String(color.new('#00ffbb', 70)), lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'Zero Line', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Upper', color: String(color.new(GRAY, 70)), lineWidth: 3 },
  { id: 'plot6', title: 'Down', color: String(color.new(GRAY, 70)), lineWidth: 3 },
  { id: 'plot7', title: 'Upper Outer', color: GRAY, lineWidth: 3 },
  { id: 'plot8', title: 'Down Outer', color: GRAY, lineWidth: 3 },
];

/** Style declarations of the fills (drawn from the result's `fills`) */
export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot7', plot2: 'plot5', title: 'Upper Fill' },
  { id: 'fill1', plot1: 'plot6', plot2: 'plot8', title: 'Lower Fill' },
  { id: 'fill2', plot1: 'plot1', plot2: 'plot2', title: 'Oscillator Fill' },
  { id: 'fill3', plot1: 'plot3', plot2: 'plot4', title: 'Plots Background' },
];

/** plotchar / plotshape declarations: the markers of the result with the same `id` belong to them */
export const shapeConfig: ShapeConfig[] = [
  { id: 'char0', kind: 'char', title: 'Momentum Shift', char: '●', location: 'absolute', color: '#DBDBDB', size: 'tiny' },
  { id: 'char1', kind: 'char', title: 'Bullish Reversal', char: '▲', location: 'absolute', color: '#00ffbb', size: 'tiny' },
  { id: 'char2', kind: 'char', title: 'Bearish Reversal', char: '▼', location: 'absolute', color: '#ff1100', size: 'tiny' },
  { id: 'shape0', kind: 'shape', title: 'Bullish Trend', style: 'labelup', location: 'belowbar',
    color: String(color.new('#00ffbb', 50)), text: '▲', textcolor: '#DBDBDB', size: 'small', forceOverlay: true },
  { id: 'shape1', kind: 'shape', title: 'Bearish Trend', style: 'labeldown', location: 'abovebar',
    color: String(color.new('#ff1100', 50)), text: '▼', textcolor: '#DBDBDB', size: 'small', forceOverlay: true },
];

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Momentum Shift', message: 'Stochastic Z-Score momentum direction changed.' },
  { id: 'alert1', title: 'Bullish Reversal', message: 'Bullish reversal detected (oscillator crosses up while long-term momentum is positive).' },
  { id: 'alert2', title: 'Bearish Reversal', message: 'Bearish reversal detected (oscillator crosses down while long-term momentum is negative).' },
  { id: 'alert3', title: 'Oscillator Crosses Above Zero', message: 'Oscillator crossed above the zero line (bullish momentum).' },
  { id: 'alert4', title: 'Oscillator Crosses Below Zero', message: 'Oscillator crossed below the zero line (bearish momentum).' },
  { id: 'alert5', title: 'Long-Term Momentum Bullish', message: 'Long-term momentum (ALMA) crossed above zero.' },
  { id: 'alert6', title: 'Long-Term Momentum Bearish', message: 'Long-term momentum (ALMA) crossed below zero.' },
  { id: 'alert7', title: 'Overbought', message: 'Oscillator entered overbought zone (> 2.5).' },
  { id: 'alert8', title: 'Oversold', message: 'Oscillator entered oversold zone (< -2.5).' },
];

export const metadata = {
  title: 'Stochastic Z-Score [AlgoAlpha]',
  shortTitle: 'AlgoAlpha - Stoch Z-Score',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };

type Result = IndicatorResult & { alerts: AlertConditionState[] };

interface StochZRun extends BarRunState<Record<string, never>> {
  basis: ReturnType<typeof taStep.sma>;
  dev: ReturnType<typeof taStep.stdev>;
  stoch: ReturnType<typeof taStep.stoch>;
  hma: ReturnType<typeof taStep.hma>;
  crossAny: ReturnType<typeof taStep.cross>;
  crossUp: ReturnType<typeof taStep.crossover>;
  crossDown: ReturnType<typeof taStep.crossunder>;
  crossZeroUp: ReturnType<typeof taStep.crossover>;
  crossZeroDown: ReturnType<typeof taStep.crossunder>;
  ltmUp: ReturnType<typeof taStep.crossover>;
  ltmDown: ReturnType<typeof taStep.crossunder>;
  zscore: number[];
  ss: number[];
  plots: Point[][];
  fill0Top: string[];
  fill0Bottom: string[];
  fill1Top: string[];
  fill1Bottom: string[];
  fill2: string[];
  fill3TopValue: number[];
  fill3Top: string[];
  fill3Bottom: string[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<StochasticZScoreInputs>): BarStudy<StochZRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { len, green, red } = cfg;
  const value = barSource(cfg.src);
  let CHART_FG = '';
  let CHART_BG = '';
  // ta.alma(zscore, len, 0, 0.1): the weights of the library function
  let weights: number[] = [];
  const C = (c: unknown) => String(c);
  const num = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init(_bars, chart) {
      // chart.fg_color / chart.bg_color
      CHART_FG = foregroundColorOf(chart);
      CHART_BG = backgroundColorOf(chart);
      const m = 0 * (len - 1);
      const sg = len / 0.1;
      weights = [];
      let weightSum = 0;
      for (let i = 0; i < len; i++) {
        const weight = Math.exp(-1 * Math.pow(i - m, 2) / (2 * Math.pow(sg, 2)));
        weights.push(weight);
        weightSum += weight;
      }
      for (let i = 0; i < len; i++) weights[i] /= weightSum;
      const s: StochZRun = {
        basis: taStep.sma(), dev: taStep.stdev(), stoch: taStep.stoch(len), hma: taStep.hma(len),
        crossAny: taStep.cross(), crossUp: taStep.crossover(), crossDown: taStep.crossunder(),
        crossZeroUp: taStep.crossover(), crossZeroDown: taStep.crossunder(), ltmUp: taStep.crossover(),
        ltmDown: taStep.crossunder(),
        zscore: [], ss: [], plots: Array.from({ length: 9 }, () => []),
        fill0Top: [], fill0Bottom: [], fill1Top: [], fill1Bottom: [], fill2: [], fill3TopValue: [], fill3Top: [],
        fill3Bottom: [], markers: [], flags: Array.from({ length: 9 }, () => []), times: Array.from({ length: 9 }, () => []),
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.basis, s.dev, s.stoch, s.hma, s.crossAny, s.crossUp, s.crossDown, s.crossZeroUp, s.crossZeroDown, s.ltmUp, s.ltmDown];
      s.lists = [s.markers, ...s.times];
      s.series = [
        s.zscore, s.ss, ...s.plots, s.fill0Top, s.fill0Bottom, s.fill1Top, s.fill1Bottom, s.fill2, s.fill3TopValue,
        s.fill3Top, s.fill3Bottom, ...s.flags,
      ];
      return s;
    },
    bar(s, i, bars) {
      const t = bars[i].time as number;
      // basis = ta.sma(src, len); zscore = (src - basis) / ta.stdev(src, len)
      const src = value(bars[i]) ?? NaN;
      const basis = s.basis.step(src, len) ?? NaN;
      const dev = s.dev.step(src, len) ?? NaN;
      const zscore = (src - basis) / dev;
      s.zscore[i] = zscore;
      // stochZ = ta.stoch(zscore, zscore, zscore, len); scaledSZ = stochZ / 25 - 2
      const stochZ = s.stoch.step(zscore, zscore, zscore) ?? NaN;
      const scaled = stochZ / 25 - 2;
      // smoothed_scaled = ta.hma(scaledSZ, len); ltm = ta.alma(zscore, len, 0, 0.1)
      const ss = s.hma.step(scaled) ?? NaN;
      s.ss[i] = ss;
      let ltm = NaN;
      if (!(i < len - 1)) {
        ltm = 0;
        for (let j = 0; j < len; j++) ltm += s.zscore[i - len + 1 + j] * weights[j];
      }
      const prev = i > 0 ? s.ss[i - 1] : NaN;

      const rising = gt(ss, prev);
      const mx0 = Math.max(0, ss);
      const mn0 = Math.min(0, ss);
      const ltmColor = C(color.new(gt(ltm, 0) ? green : red, 70));
      // zscore_color: the transparency max(min(int((1 - abs(zscore) / 4) * 100), 70), 70) is 70, na when zscore is na
      // (color.new with an na transparency gives no colour)
      const zTransp = Math.max(Math.min(Math.trunc((1 - Math.abs(zscore) / 4) * 100), 70), 70);
      const p = s.plots;
      p[0][i] = { time: t, value: num(zscore), color: C(color.new(color.from_gradient(zscore, -2, 2, red, green), zTransp)) };
      p[1][i] = { time: t, value: num(ss), color: C(color.new(GRAY, rising ? 0 : 50)) };
      p[2][i] = { time: t, value: num(prev), color: C(color.new(GRAY, rising ? 20 : 70)) };
      p[3][i] = { time: t, value: num(ltm), color: ltmColor };
      p[4][i] = { time: t, value: 0, color: '#2962FF' };
      p[5][i] = { time: t, value: 2, color: C(color.new(color.from_gradient(mx0, 0, 2, GRAY, red), 70)) };
      p[6][i] = { time: t, value: -2, color: C(color.new(color.from_gradient(mn0, -2, 0, green, GRAY), 70)) };
      p[7][i] = { time: t, value: 2.5, color: C(color.from_gradient(mx0, 0, 2.5, GRAY, red)) };
      p[8][i] = { time: t, value: -2.5, color: C(color.from_gradient(mn0, -2.5, 0, green, GRAY)) };

      // Crossings: one ta.* call per Pine call site (same values, so the shared results are equal)
      const crossAny = !!s.crossAny.step(ss, prev);
      const crossUp = !!s.crossUp.step(ss, prev);
      const crossDown = !!s.crossDown.step(ss, prev);
      const bullRev = crossUp && gt(ltm, 0) && lt(prev, -2);
      const bearRev = crossDown && lt(ltm, 0) && gt(prev, 2);

      // plotchar(ta.cross(ss, prev) ? prev : na, "Momentum Shift", "●", location.absolute, chart.fg_color, size.tiny)
      if (crossAny && Number.isFinite(prev)) {
        s.markers.push({ id: 'char0', time: t, position: 'atPriceMiddle', price: prev, shape: 'circle', char: '●',
          color: CHART_FG, size: 'tiny' });
      }
      // plotchar(bullish reversal ? -3 : na, "Bullish Reversal", "▲", location.absolute, green, size.tiny)
      if (bullRev) {
        s.markers.push({ id: 'char1', time: t, position: 'atPriceMiddle', price: -3, shape: 'circle', char: '▲', color: green, size: 'tiny' });
      }
      // plotchar(bearish reversal ? 3 : na, "Bearish Reversal", "▼", location.absolute, red, size.tiny)
      if (bearRev) {
        s.markers.push({ id: 'char2', time: t, position: 'atPriceMiddle', price: 3, shape: 'circle', char: '▼', color: red, size: 'tiny' });
      }
      // plotshape(..., "Bullish Trend", shape.labelup, location.belowbar, color.new(green, 50), text = "▲",
      //   textcolor = chart.fg_color, size = size.small, force_overlay = true)
      if (bullRev) {
        s.markers.push({ id: 'shape0', time: t, position: 'belowBar', shape: 'labelUp', color: C(color.new(green, 50)),
          text: '▲', textColor: CHART_FG, size: 'small', forceOverlay: true });
      }
      if (bearRev) {
        s.markers.push({ id: 'shape1', time: t, position: 'aboveBar', shape: 'labelDown', color: C(color.new(red, 50)),
          text: '▼', textColor: CHART_FG, size: 'small', forceOverlay: true });
      }

      // fill(u1, u, 2.5, 2, upper_fill_color, upper_fill_color_100, "Upper Fill")
      s.fill0Top[i] = C(color.new(color.from_gradient(mx0, 0, 2, CHART_BG, red), 50));
      s.fill0Bottom[i] = C(color.new(color.from_gradient(mx0, 0, 2, CHART_BG, red), 100));
      // fill(d, d1, -2, -2.5, lower_fill_color, lower_fill_color_50, "Lower Fill")
      s.fill1Top[i] = C(color.new(color.from_gradient(mn0, -2, 0, green, CHART_BG), 100));
      s.fill1Bottom[i] = C(color.new(color.from_gradient(mn0, -2, 0, green, CHART_BG), 50));
      // fill(main, main1, color.new(color.gray, ss > prev ? 20 : 70), "Oscillator Fill")
      s.fill2[i] = C(color.new(GRAY, rising ? 20 : 70));
      // fill(longtm, mid, ltm, 0, ltm_color, color.new(ltm > 0 ? green : red, 90))
      s.fill3TopValue[i] = num(ltm);
      s.fill3Top[i] = ltmColor;
      s.fill3Bottom[i] = C(color.new(gt(ltm, 0) ? green : red, 90));

      const crossZeroUp = !!s.crossZeroUp.step(ss, 0);
      const crossZeroDown = !!s.crossZeroDown.step(ss, 0);
      const ltmUp = !!s.ltmUp.step(ltm, 0);
      const ltmDown = !!s.ltmDown.step(ltm, 0);
      const f = s.flags;
      const flag = (k: number, v: boolean) => {
        f[k][i] = v;
        if (v) s.times[k].push(t);
      };
      flag(0, crossAny);
      flag(1, bullRev);
      flag(2, bearRev);
      flag(3, crossZeroUp);
      flag(4, crossZeroDown);
      flag(5, ltmUp);
      flag(6, ltmDown);
      flag(7, gt(ss, 2.5));
      flag(8, lt(ss, -2.5));
    },
    result(s, bars) {
      const n = bars.length;
      const constant = <T>(v: T): T[] => new Array(n).fill(v);
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      const fills: FillData[] = [
        {
          id: 'fill0', plot1: 'plot7', plot2: 'plot5', options: { title: 'Upper Fill' },
          gradient: { topValue: constant(2.5), bottomValue: constant(2), topColor: s.fill0Top.slice(), bottomColor: s.fill0Bottom.slice() },
        },
        {
          id: 'fill1', plot1: 'plot6', plot2: 'plot8', options: { title: 'Lower Fill' },
          gradient: { topValue: constant(-2), bottomValue: constant(-2.5), topColor: s.fill1Top.slice(), bottomColor: s.fill1Bottom.slice() },
        },
        { id: 'fill2', plot1: 'plot1', plot2: 'plot2', options: { title: 'Oscillator Fill' }, colors: s.fill2.slice() },
        {
          id: 'fill3', plot1: 'plot3', plot2: 'plot4', options: { title: 'Plots Background' },
          gradient: { topValue: s.fill3TopValue.slice(), bottomValue: constant(0), topColor: s.fill3Top.slice(), bottomColor: s.fill3Bottom.slice() },
        },
      ];
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills,
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<StochasticZScoreInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<StochasticZScoreInputs> = {},
  chart?: ChartContext,
): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const StochasticZScore = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  fillConfig,
  shapeConfig,
  alertConditions,
};
