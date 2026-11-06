/**
 * Machine Learning Moving Average [LuxAlgo]
 *
 * Gaussian Process Regression end point estimate, as the original computes it: an RBF kernel (length scale =
 * window) over the training points 0..window-1, Ktrain = K(xtrain, xtrain) + sigma^2 * I, its pseudo-inverse, and
 * K_row = (K(xtrain, xtest)^T * Ktrain^-1).row(window + forecast - 1). On each bar after `window`:
 * out = sum(K_row[i] * (src[window - 1 - i] - sma(src, window))) + sma(src, window).
 * Bands: out +- sma(abs(src - out), window) * mult (invisible plots, the fills' edges). os = 1 when close is above the
 * upper band with out rising, 0 when below the lower band with out falling, else kept; the 'Circle' plot (style
 * circles, width 3) marks the bars where os changes.
 *
 * Reference: "Machine Learning Moving Average [LuxAlgo]"
 */

import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import { color, matrix, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface MlMovingAverageInputs {
  window: number;
  forecast: number;
  sigma: number;
  mult: number;
  src: SourceType;
  upCss: string;
  dnCss: string;
  bullCss: string;
  bearCss: string;
}

const UP_CSS = String(color.new('#5b9cf6', 50));
const DN_CSS = String(color.new('#e91e63', 50));

export const defaultInputs: MlMovingAverageInputs = {
  window: 100,
  forecast: 0,
  sigma: 0.01,
  mult: 2,
  src: 'close',
  upCss: UP_CSS,
  dnCss: DN_CSS,
  bullCss: '#3179f5',
  bearCss: '#e91e63',
};

export const inputConfig: InputConfig[] = [
  { id: 'window', type: 'int', title: 'Window', defval: 100, min: 0 },
  { id: 'forecast', type: 'int', title: 'Forecast', defval: 0 },
  { id: 'sigma', type: 'float', title: 'Sigma', defval: 0.01, min: 0, step: 0.1 },
  { id: 'mult', type: 'float', title: 'Multiplicative Factor', defval: 2, min: 0 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'upCss', type: 'color', title: 'Upper Extremity', defval: UP_CSS, group: 'Style' },
  { id: 'dnCss', type: 'color', title: 'Lower Extremity', defval: DN_CSS, group: 'Style' },
  { id: 'bullCss', type: 'color', title: 'Moving Average', defval: '#3179f5', inline: 'ma', group: 'Style' },
  { id: 'bearCss', type: 'color', title: '', defval: '#e91e63', inline: 'ma', group: 'Style' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'End Point GPR', color: '#3179f5', lineWidth: 1 },
  { id: 'circle', title: 'Circle', color: '#3179f5', lineWidth: 3, style: 'circles' },
  // plot(upper, 'Upper', color = na) / plot(lower, 'Lower', color = na): the fills' edges, not drawn
  { id: 'plot1', title: 'Upper', color: 'transparent', lineWidth: 1 },
  { id: 'plot2', title: 'Lower', color: 'transparent', lineWidth: 1 },
];

export const metadata = {
  title: 'ML Moving Average',
  shortTitle: 'MLMA',
  overlay: true,
};

type PineMatrix = ReturnType<typeof matrix.new_matrix<number>>;

/** kernel_matrix(X1, X2, l): exp(-(x1 - x2)^2 / (2 * l^2)) */
function kernelMatrix(x1: number[], x2: number[], l: number): PineMatrix {
  const km = matrix.new_matrix<number>(x1.length, x2.length, NaN);
  x1.forEach((a, i) => x2.forEach((b, j) => matrix.set(km, i, j, Math.exp(-Math.pow(a - b, 2) / (2.0 * Math.pow(l, 2))))));
  return km;
}

/** The original's barstate.isfirst kernel setup: K_row (window values), or null when the setup has no such row */
export function gprKernelRow(window: number, forecast: number, sigma: number): number[] | null {
  if (window < 1 || window + forecast < 1) return null;
  const xtrain = Array.from({ length: window }, (_, i) => i);
  const xtest = Array.from({ length: window + forecast }, (_, i) => i);
  const identity = matrix.new_matrix<number>(window, window, 0);
  for (let i = 0; i < window; i++) matrix.set(identity, i, i, 1);
  const s = matrix.mult(identity, sigma * sigma) as PineMatrix;
  const kTrain = matrix.sum(kernelMatrix(xtrain, xtrain, window), s);
  const kInv = matrix.pinv(kTrain);
  const kStar = kernelMatrix(xtrain, xtest, window);
  const prod = matrix.mult(matrix.transpose(kStar), kInv) as PineMatrix;
  const r = window + forecast - 1;
  return Array.from({ length: window }, (_, i) => matrix.get(prod, r, i));
}

type Point = { time: number; value: number; color?: string };

interface MlmaRun extends BarRunState<{ state: number }> {
  mean: WindowSma | null;
  mae: WindowSma | null;
  srcArr: number[];
  out: number[];
  upper: number[];
  lower: number[];
  os: number[];
  plot0: Point[];
  circle: Point[];
  plot1: Point[];
  plot2: Point[];
}

function study(inputs: Partial<MlMovingAverageInputs>): BarStudy<MlmaRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const win = cfg.window;
  const value = barSource(cfg.src);
  const kRow = gprKernelRow(win, cfg.forecast, cfg.sigma);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const mean = win >= 1 ? new WindowSma(win) : null;
      const mae = win >= 1 ? new WindowSma(win) : null;
      const s: MlmaRun = {
        mean, mae, srcArr: [], out: [], upper: [], lower: [], os: [], plot0: [], circle: [], plot1: [], plot2: [],
        steps: [...(mean ? [mean] : []), ...(mae ? [mae] : [])], vars: { state: 0 }, lists: [], series: [],
      };
      s.series = [s.srcArr, s.out, s.upper, s.lower, s.os, s.plot0, s.circle, s.plot1, s.plot2];
      return s;
    },
    bar(s, t, bars) {
      const b = bars[t];
      const time = b.time as number;
      const srcArr = s.srcArr;
      const v = value(b);
      srcArr[t] = v;
      const mean = s.mean ? s.mean.step(v) : NaN;

      // float out = na; if bar_index > window: out := dotprod + mean
      let o = NaN;
      if (kRow && t >= win + 1) {
        let dot = 0;
        for (let i = 0; i < win; i++) dot += kRow[i] * (srcArr[t - (win - 1 - i)] - mean);
        o = dot + mean;
      }
      s.out[t] = o;

      // mae = ta.sma(math.abs(src - out), window) * mult
      const mae = s.mae ? s.mae.step(Math.abs(v - o)) * cfg.mult : NaN;
      const upper = o + mae;
      const lower = o - mae;
      s.upper[t] = upper;
      s.lower[t] = lower;

      // var os = 0; os := close > upper and out > out[1] ? 1 : close < lower and out < out[1] ? 0 : os
      const c = b.close;
      const prev = t > 0 ? s.out[t - 1] : NaN;
      if (c > upper && o > prev) s.vars.state = 1;
      else if (c < lower && o < prev) s.vars.state = 0;
      const os = s.vars.state;
      s.os[t] = os;

      const css = os ? cfg.bullCss : cfg.bearCss;
      s.plot0[t] = { time, value: o, color: css };
      // plot(os != os[1] ? out : na, 'Circle', os ? bullCss : bearCss, 3, plot.style_circles)
      s.circle[t] = { time, value: t > 0 && os !== s.os[t - 1] ? o : NaN, color: css };
      s.plot1[t] = { time, value: upper };
      s.plot2[t] = { time, value: lower };
    },
    result(s, bars) {
      const n = bars.length;
      //   fill(plot_upper, plot_out, out + mae, out, upCss, color.new(chart.bg_color, 100))
      //   fill(plot_out, plot_lower, out, out - mae, color.new(chart.bg_color, 100), dnCss)
      const bgTransparent = '#00000000';
      const constant = <T>(v: T): T[] => new Array(n).fill(v);
      const out = s.out.slice();
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'circle': s.circle.slice(), 'plot1': s.plot1.slice(), 'plot2': s.plot2.slice() },
        fills: [
          {
            plot1: 'plot1', plot2: 'plot0',
            gradient: { topValue: s.upper.slice(), bottomValue: out, topColor: constant(cfg.upCss), bottomColor: constant(bgTransparent) },
          },
          {
            plot1: 'plot0', plot2: 'plot2',
            gradient: { topValue: out.slice(), bottomValue: s.lower.slice(), topColor: constant(bgTransparent), bottomColor: constant(cfg.dnCss) },
          },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MlMovingAverageInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MlMovingAverageInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const MlMovingAverage = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
