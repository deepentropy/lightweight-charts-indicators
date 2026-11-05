/**
 * Triple Gaussian Smoothed Ribbon [BOSWaves]
 *
 * A Gaussian filter (normalised weights exp(-x^2 / (2 sigma^2)), x = i - floor(length / 2), weight i on the value
 * length - 1 - i bars ago) applied three times to the source gives the core line v1; the same filter on v1 with the
 * signal length gives v2, and with signal length + 4 / + 8 / + 12 / + 16 the four outer ribbon lines. The colour is a
 * gradient of the normalised distance v2 - v1 over 70 bars (bullish to bearish); the ribbon fill opacity follows the
 * momentum |v1 - v1[5]| relative to its 50-bar high. An ATR glow band, bar colours and triangles at crossings of v2
 * and v1 (away from consolidation) complete the display.
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Signal' and 'Bearish Signal', true on the bars of the
 * triangles (v2 crosses under / over v1 away from consolidation).
 *
 * Reference: "Triple Gaussian Smoothed Ribbon [BOSWaves]" by BOSWaves
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © BOSWaves
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TripleGaussianSmoothedRibbonInputs {
  /** Main smoothing length */
  slength: number;
  /** Signal length */
  siglen: number;
  /** Sigma (standard deviation) */
  sigma: number;
  src: SourceType;
  bullishColor: string;
  bearishColor: string;
  showCandleColors: boolean;
  /** Minimum signal separation (fraction of v1) */
  minSeparation: number;
  /** Trend strength period */
  trendStrength: number;
}

export const defaultInputs: TripleGaussianSmoothedRibbonInputs = {
  slength: 7,
  siglen: 18,
  sigma: 3.0,
  src: 'close',
  bullishColor: '#4ab2c8',
  bearishColor: '#7f30cb',
  showCandleColors: true,
  minSeparation: 0.03,
  trendStrength: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'slength', type: 'int', title: 'Main Smoothing Length', defval: 7 },
  { id: 'siglen', type: 'int', title: 'Signal Length', defval: 18 },
  { id: 'sigma', type: 'float', title: 'Sigma (Standard Deviation)', defval: 3.0, min: 0.1 },
  { id: 'src', type: 'source', title: 'Data Source', defval: 'close' },
  { id: 'bullishColor', type: 'color', title: 'Bullish Color', defval: '#4ab2c8' },
  { id: 'bearishColor', type: 'color', title: 'Bearish Color', defval: '#7f30cb' },
  { id: 'showCandleColors', type: 'bool', title: 'Color Candles', defval: true },
  { id: 'minSeparation', type: 'float', title: 'Minimum Signal Separation %', defval: 0.03, min: 0.0, max: 1.0, step: 0.01 },
  { id: 'trendStrength', type: 'int', title: 'Trend Strength Period', defval: 20, min: 5 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Ribbon 1', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot1', title: 'Ribbon 2', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'Ribbon 3', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Ribbon 4', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'Ribbon 5', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Core Gaussian', color: '#4ab2c8', lineWidth: 3 },
  { id: 'plot6', title: 'Glow Upper', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot7', title: 'Glow Lower', color: '#2962FF', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Triple Gaussian Smoothed Ribbon [BOSWaves]',
  shortTitle: 'Triple Gaussian Smoothed Ribbon [BOSWaves]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** The normalised weights of gaussian(source, length, sig): exp(-x^2 / (2 sigma^2)), x = i - floor(length / 2) */
function gaussianWeights(length: number, sig: number): number[] {
  const weights: number[] = [];
  let sumWeights = 0.0;
  const center = Math.floor(length / 2);
  for (let i = 0; i <= length - 1; i++) {
    const x = i - center;
    const w = Math.exp(-(x * x) / (2 * sig * sig));
    weights.push(w);
    sumWeights += w;
  }
  for (let i = 0; i < weights.length; i++) weights[i] = weights[i] / sumWeights;
  return weights;
}

/**
 * gaussian(source, length, sig) on bar b: result = sum over i of weight[i] * source[length - 1 - i], added only when
 * bar_index >= i; a missing history value (na) makes the sum na, so the result is na until bar length - 1.
 */
function gaussianAt(source: number[], b: number, length: number, weights: number[]): number {
  let result = 0.0;
  for (let i = 0; i <= length - 1; i++) {
    if (b >= i) {
      const k = b - (length - 1 - i);
      result += weights[i] * (k >= 0 ? source[k] : NaN);
    }
  }
  return result;
}

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] };
type Step = ReturnType<typeof taStep.highest>;

interface TgsrRun extends BarRunState<Record<string, never>> {
  distLow: Step;
  distHigh: Step;
  maxMomentum: Step;
  extremeHigh: Step;
  extremeLow: Step;
  rangeHigh: Step;
  rangeLow: Step;
  atr: ReturnType<typeof taStep.atr>;
  crossUnder: ReturnType<typeof taStep.crossunder>;
  crossOver: ReturnType<typeof taStep.crossover>;
  src: number[];
  g1: number[];
  g2: number[];
  v1: number[];
  plots: Point[][];
  layers: string[][];
  glowColor: string[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
}

function study(inputs: Partial<TripleGaussianSmoothedRibbonInputs>): BarStudy<TgsrRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { slength, siglen, sigma } = cfg;
  const value = barSource(cfg.src);
  const wMain = gaussianWeights(slength, sigma);
  // signal line and ribbon layers on v1: signal length, + 4, + 8, + 12, + 16
  const outerLengths = [siglen, siglen + 4, siglen + 8, siglen + 12, siglen + 16];
  const wOuter = outerLengths.map((l) => gaussianWeights(l, sigma));
  const baseOpacity = 35;
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: TgsrRun = {
        distLow: taStep.lowest(), distHigh: taStep.highest(), maxMomentum: taStep.highest(),
        extremeHigh: taStep.highest(), extremeLow: taStep.lowest(), rangeHigh: taStep.highest(), rangeLow: taStep.lowest(),
        atr: taStep.atr(14), crossUnder: taStep.crossunder(), crossOver: taStep.crossover(),
        src: [], g1: [], g2: [], v1: [], plots: Array.from({ length: 8 }, () => []), layers: [[], [], [], []],
        glowColor: [], barColors: [], flags: [[], []], times: [[], []], markers: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.distLow, s.distHigh, s.maxMomentum, s.extremeHigh, s.extremeLow, s.rangeHigh, s.rangeLow, s.atr, s.crossUnder, s.crossOver];
      s.lists = [...s.times, s.markers];
      s.series = [s.src, s.g1, s.g2, s.v1, ...s.plots, ...s.layers, s.glowColor, s.barColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time as number;
      // Triple Gaussian smoothing on the source; signal line and ribbon layers on v1
      s.src[i] = value(b);
      s.g1[i] = gaussianAt(s.src, i, slength, wMain);
      s.g2[i] = gaussianAt(s.g1, i, slength, wMain);
      const v1 = gaussianAt(s.g2, i, slength, wMain);
      s.v1[i] = v1;
      const v2 = gaussianAt(s.v1, i, outerLengths[0], wOuter[0]);
      const ribbon2 = gaussianAt(s.v1, i, outerLengths[1], wOuter[1]);
      const ribbon3 = gaussianAt(s.v1, i, outerLengths[2], wOuter[2]);
      const ribbon4 = gaussianAt(s.v1, i, outerLengths[3], wOuter[3]);
      const ribbon5 = gaussianAt(s.v1, i, outerLengths[4], wOuter[4]);

      // ndist = (dist - ta.lowest(dist, 70)) / (ta.highest(dist, 70) - ta.lowest(dist, 70)) (x / 0: +-infinity or na)
      const dist = v2 - v1;
      const distLow = s.distLow.step(dist, 70);
      const distHigh = s.distHigh.step(dist, 70);
      const ndist = (dist - distLow) / (distHigh - distLow);

      // normMomentum = maxMomentum > 0 ? momentum / maxMomentum : 0
      const momentum = Math.abs(v1 - (i >= 5 ? s.v1[i - 5] : NaN));
      const maxMomentum = s.maxMomentum.step(momentum, 50);
      const normMomentum = gt(maxMomentum, 0) ? momentum / maxMomentum : 0;

      const trendColor = color.from_gradient(ndist, 0, 1, cfg.bullishColor, cfg.bearishColor);
      // opacityK = int(baseOpacity + 5 * k - normMomentum * 15) (int() truncates; na stays na)
      for (let k = 0; k < 4; k++) s.layers[k][i] = String(color.new(trendColor, Math.trunc(baseOpacity + 5 * k - normMomentum * 15)));

      // atr = ta.atr(14); glow = v1 +- atr * 0.5
      const atr = s.atr.step(b.high, b.low, b.close);

      // barcolor(showCandleColors ? candleColor : na)
      if (cfg.showCandleColors) s.barColors[i] = { time: b.time, color: trendColor };

      // Signals at extremes
      const extremeHigh = s.extremeHigh.step(v1, 7);
      const extremeLow = s.extremeLow.step(v1, 7);
      const rangeHigh = s.rangeHigh.step(v1, cfg.trendStrength);
      const rangeLow = s.rangeLow.step(v1, cfg.trendStrength);
      // ta.crossunder(v2, v1) / ta.crossover(v2, v1): exact comparisons
      const crossUnder = s.crossUnder.step(v2, v1);
      const crossOver = s.crossOver.step(v2, v1);
      const signalOffset = atr * 1.5;
      // isConsolidating = rangev1 / v1 < minSeparation
      const isConsolidating = lt((rangeHigh - rangeLow) / v1, cfg.minSeparation);
      // validBullish = ta.crossunder(v2, v1) and not isConsolidating / validBearish = ta.crossover(v2, v1) and ...
      const bull = crossUnder && !isConsolidating;
      const bear = crossOver && !isConsolidating;
      [bull, bear].forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(time);
      });
      // plotshape(validBullish ? extremeLow - signalOffset : na, shape.triangleup, location.absolute, size.normal)
      if (bull) {
        const price = extremeLow - signalOffset;
        if (Number.isFinite(price)) {
          s.markers.push({ time: b.time, position: 'atPriceMiddle', price, shape: 'triangleUp', color: cfg.bullishColor, size: 'normal' });
        }
      }
      // plotshape(validBearish ? extremeHigh + signalOffset : na, shape.triangledown, location.absolute, size.normal)
      if (bear) {
        const price = extremeHigh + signalOffset;
        if (Number.isFinite(price)) {
          s.markers.push({ time: b.time, position: 'atPriceMiddle', price, shape: 'triangleDown', color: cfg.bearishColor, size: 'normal' });
        }
      }

      // p1..p5 = plot(ribbon1..5, display = display.none)
      const p = s.plots;
      p[0][i] = { time, value: v1 };
      p[1][i] = { time, value: ribbon2 };
      p[2][i] = { time, value: ribbon3 };
      p[3][i] = { time, value: ribbon4 };
      p[4][i] = { time, value: ribbon5 };
      // plot(v1, "Core Gaussian", color = trendColor, linewidth = 3)
      p[5][i] = { time, value: v1, color: trendColor };
      // p_glow_upper / p_glow_lower = plot(v1 +- atr * 0.5, display = display.none)
      p[6][i] = { time, value: v1 + atr * 0.5 };
      p[7][i] = { time, value: v1 - atr * 0.5 };
      s.glowColor[i] = String(color.new(trendColor, 88));
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice(),
          plot5: p[5].slice(), plot6: p[6].slice(), plot7: p[7].slice(),
        },
        fills: [
          // fill(pK, pK+1, color = color.new(trendColor, opacityK))
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Ribbon Layer 1' }, colors: s.layers[0].slice() },
          { plot1: 'plot1', plot2: 'plot2', options: { title: 'Ribbon Layer 2' }, colors: s.layers[1].slice() },
          { plot1: 'plot2', plot2: 'plot3', options: { title: 'Ribbon Layer 3' }, colors: s.layers[2].slice() },
          { plot1: 'plot3', plot2: 'plot4', options: { title: 'Ribbon Layer 4' }, colors: s.layers[3].slice() },
          // fill(p_glow_upper, p_glow_lower, color = color.new(trendColor, 88))
          { plot1: 'plot6', plot2: 'plot7', options: { title: 'Outer Glow' }, colors: s.glowColor.slice() },
        ],
        barColors: cfg.showCandleColors ? s.barColors.slice() : [],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TripleGaussianSmoothedRibbonInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<TripleGaussianSmoothedRibbonInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions (no message: the default one) */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Signal', message: 'Alert Fired!' },
  { id: 'alert1', title: 'Bearish Signal', message: 'Alert Fired!' },
];

export const TripleGaussianSmoothedRibbon = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
