/**
 * Normalized Candles RSI [Jamallo]
 *
 * Fractional differencing of the close: weights w0 = 1, wk = -w(k-1) * (d - k + 1) / k, kept while |wk| >= the
 * threshold (at most Max Window weights); the differenced close is sum(wk * close[k]). The candle keeps its shape
 * around the differenced close (open, high and low at the same distance from it). The four prices are normalised
 * with the z-score over the lookback (mean and standard deviation of the differenced close) and a sigmoid:
 * 100 / (1 + exp(-z / (scale / 2))), and drawn as candles. The pane also shows the RSI with bands at 70 / 50 / 30,
 * a background fill, gradient fills above 70 and below 30, an optional smoothing moving average (with Bollinger
 * Bands for "SMA + Bollinger Bands") and optional regular divergences (RSI pivots 5 / 5).
 *
 * Alerts (alertcondition, `alerts` of the result): regular bullish / bearish divergence (only with "Calculate
 * Divergence" on, as in the original) and the normalised close crossing above 50, below 50, above 70 and below 30.
 *
 * Reference: "Normalized Candles RSI [Jamallo]" by Jamallo22
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertcondition() calls, in declaration order */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Regular Bullish Divergence', message: 'Found a new Regular Bullish Divergence, `Pivot Lookback Right` number of bars to the left of the current bar.' },
  { id: 'alert1', title: 'Regular Bearish Divergence', message: 'Found a new Regular Bearish Divergence, `Pivot Lookback Right` number of bars to the left of the current bar.' },
  { id: 'alert2', title: 'Norm Close Cross Above 50', message: 'FFD Normalized Close crossed above 50 — bullish regime shift.' },
  { id: 'alert3', title: 'Norm Close Cross Below 50', message: 'FFD Normalized Close crossed below 50 — bearish regime shift.' },
  { id: 'alert4', title: 'Norm Close Cross Above 70', message: 'FFD Normalized Close crossed above 70 — overbought.' },
  { id: 'alert5', title: 'Norm Close Cross Below 30', message: 'FFD Normalized Close crossed below 30 — oversold.' },
];

type MaType = 'None' | 'SMA' | 'SMA + Bollinger Bands' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';

export interface NormalizedCandlesRsiInputs {
  /** Enable the fractional differencing */
  fdEnabled: boolean;
  /** Fractional differencing order d */
  fdD: number;
  /** Weight threshold: weights below it end the weight list */
  fdThresh: number;
  /** Maximum number of weights */
  fdMaxWin: number;
  /** Z-score lookback */
  zLen: number;
  /** Sigmoid compression scale */
  zClip: number;
  bullColor: string;
  bearColor: string;
  rsiLength: number;
  rsiSource: SourceType;
  /** Detect regular divergences */
  calculateDivergence: boolean;
  /** Smoothing type */
  maType: MaType;
  /** Smoothing length */
  maLength: number;
  /** Bollinger Bands standard deviation multiplier */
  bbMult: number;
}

export const defaultInputs: NormalizedCandlesRsiInputs = {
  fdEnabled: true,
  fdD: 0.3,
  fdThresh: 0.01,
  fdMaxWin: 30,
  zLen: 100,
  zClip: 4.0,
  bullColor: color.teal,
  bearColor: color.maroon,
  rsiLength: 14,
  rsiSource: 'close',
  calculateDivergence: false,
  maType: 'SMA',
  maLength: 14,
  bbMult: 2.0,
};

const FD = 'Fractional Differencing';
const NORM = 'Normalization';

export const inputConfig: InputConfig[] = [
  { id: 'fdEnabled', type: 'bool', title: 'Enable Fractal Differencing', defval: true, group: FD,
    tooltip: 'Toggles the fractional differencing engine on or off.' },
  { id: 'fdD', type: 'float', title: 'Diff Order (d)', defval: 0.3, min: 0.01, max: 0.99, step: 0.01, group: FD,
    tooltip: 'The fractional differencing order. A higher value makes the series more stationary but removes more historical memory.' },
  { id: 'fdThresh', type: 'float', title: 'Weight Threshold', defval: 0.01, min: 0.001, max: 0.1, step: 0.001, group: FD,
    tooltip: 'Weight threshold to stop calculating historical lags. A smaller value increases the lookback memory.' },
  { id: 'fdMaxWin', type: 'int', title: 'Max Window', defval: 30, min: 10, max: 100, group: FD,
    tooltip: 'Maximum number of bars to process for fractional differencing.' },
  { id: 'zLen', type: 'int', title: 'Z-Score Lookback', defval: 100, min: 2, group: NORM,
    tooltip: 'The rolling lookback window used to calculate the mean and standard deviation for the Z-Score normalization.' },
  { id: 'zClip', type: 'float', title: 'Sigmoid Compression Scale', defval: 4.0, min: 1.0, max: 6.0, step: 0.5, group: NORM,
    tooltip: 'Controls the elasticity of the 0-100 bounds. Lower = faster compression at the edges. Higher = softer compression.' },
  { id: 'bullColor', type: 'color', title: 'Bullish Candle Color', defval: color.teal, group: 'Colors' },
  { id: 'bearColor', type: 'color', title: 'Bearish Candle Color', defval: color.maroon, group: 'Colors' },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1, group: 'RSI Settings' },
  { id: 'rsiSource', type: 'source', title: 'Source', defval: 'close', group: 'RSI Settings' },
  { id: 'calculateDivergence', type: 'bool', title: 'Calculate Divergence', defval: false, group: 'RSI Settings',
    display: 'none', tooltip: 'Calculating divergences is needed in order for divergence alerts to fire.' },
  { id: 'maType', type: 'string', title: 'Type', defval: 'SMA', group: 'Smoothing', display: 'none',
    options: ['None', 'SMA', 'SMA + Bollinger Bands', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'] },
  { id: 'maLength', type: 'int', title: 'Length', defval: 14, group: 'Smoothing', display: 'none' },
  { id: 'bbMult', type: 'float', title: 'BB StdDev', defval: 2.0, min: 0.001, max: 50, step: 0.5, group: 'Smoothing',
    display: 'none', tooltip: "Only applies when 'SMA + Bollinger Bands' is selected. Determines the distance between the SMA and the bands." },
];

const NONE_COLOR = String(color.new(color.white, 100));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: '#7E57C2', lineWidth: 1 },
  // midLinePlot = plot(50, color = na, editable = false, display = display.none): bounds the gradient fills
  { id: 'plot1', title: 'Middle Line', color: 'transparent', lineWidth: 1, display: 'none' },
  // display = enableMA ? display.all : display.none (result.visibility.enableMA)
  { id: 'plot2', title: 'RSI-based MA', color: color.yellow, lineWidth: 1, visible: 'enableMA' },
  // display = isBB ? display.all : display.none (result.visibility.isBB)
  { id: 'plot3', title: 'Upper Bollinger Band', color: color.green, lineWidth: 1, visible: 'isBB' },
  { id: 'plot4', title: 'Lower Bollinger Band', color: color.green, lineWidth: 1, visible: 'isBB' },
  // offset = -lookbackRight (5), display = display.pane
  { id: 'plot5', title: 'Regular Bullish', color: color.green, lineWidth: 2, display: 'pane' },
  { id: 'plot6', title: 'Regular Bearish', color: color.red, lineWidth: 2, display: 'pane' },
];

const BAND_COLOR = '#787B86';
const MIDDLE_COLOR = String(color.new('#787B86', 50));
const BAND_FILL = 'rgba(126, 87, 194, 0.1)'; // color.rgb(126, 87, 194, 90)
const BB_FILL = String(color.new(color.green, 90));

/** hline(70 / 50 / 30) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper', price: 70, title: 'RSI Upper Band', color: BAND_COLOR, linestyle: 'dashed' },
  { id: 'hline_mid', price: 50, title: 'RSI Middle Band', color: MIDDLE_COLOR, linestyle: 'dotted' },
  { id: 'hline_lower', price: 30, title: 'RSI Lower Band', color: BAND_COLOR, linestyle: 'dashed' },
];

/** fill(rsiUpperBand, rsiLowerBand, color.rgb(126, 87, 194, 90)); Bollinger Bands fill shown with isBB */
export const fillConfig: FillConfig[] = [
  { id: 'fill_bands', plot1: 'hline_upper', plot2: 'hline_lower', color: BAND_FILL, title: 'RSI Background Fill' },
  { id: 'fill_bb', plot1: 'plot3', plot2: 'plot4', color: BB_FILL, title: 'Bollinger Bands Background Fill', visible: 'isBB' },
];

export const metadata = {
  title: 'Normalized Candles RSI',
  shortTitle: 'Normalized Candles RSI',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color?: string };

type Result = Omit<IndicatorResult, 'markers'> & {
  markers: MarkerData[];
  plotCandles: Record<string, PlotCandleData[]>;
  visibility: Record<string, boolean>;
} & { alerts: AlertConditionState[] };
type Machine = { step(v: number, volume: number): number; commit(): void };

interface NcrVars {
  /** _inRange(plFound[1]) / _inRange(phFound[1]) run on every bar: ta.barssince(found[1]) */
  plSince: number;
  phSince: number;
}

interface NcrRun extends BarRunState<NcrVars> {
  fdMeanStep: ReturnType<typeof taStep.sma>;
  fdStdStep: ReturnType<typeof taStep.stdev>;
  upStep: ReturnType<typeof taStep.rma>;
  downStep: ReturnType<typeof taStep.rma>;
  maStep: Machine | null;
  sdStep: ReturnType<typeof taStep.stdev> | null;
  pl: PivotStep;
  ph: PivotStep;
  src: number[];
  rsi: number[];
  normClose: number[];
  plFound: boolean[];
  phFound: boolean[];
  rsiData: Point[];
  midData: Point[];
  maData: Point[];
  upperData: Point[];
  lowerData: Point[];
  /** plot5 / plot6: the value of bar i drawn on bar i - 5 (no point for the first 5 bars) */
  bullLine: Point[];
  bearLine: Point[];
  candles: PlotCandleData[];
  /** ta.valuewhen(found, x, 1) histories */
  plRsi: number[];
  plLow: number[];
  phRsi: number[];
  phHigh: number[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<NormalizedCandlesRsiInputs>): BarStudy<NcrRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.rsiSource);

  // f_fd_build_weights(d, thresh, maxL) (input Max Window >= 10: the loop counts up)
  const w: number[] = [1.0];
  for (let k = 1; k <= cfg.fdMaxWin - 1; k++) {
    const wPrev = w[k - 1];
    const wK = (-wPrev * (cfg.fdD - k + 1.0)) / k;
    if (Math.abs(wK) < cfg.fdThresh) break;
    w.push(wK);
  }
  const L = w.length;
  const fdWarmup = L;

  // Smoothing MA and Bollinger Bands
  const enableMA = cfg.maType !== 'None';
  const isBB = cfg.maType === 'SMA + Bollinger Bands';
  const maMachine = (): Machine | null => {
    if (!enableMA) return null;
    switch (cfg.maType) {
      case 'EMA': { const m = taStep.ema(cfg.maLength); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'SMMA (RMA)': { const m = taStep.rma(cfg.maLength); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, cfg.maLength), commit: () => m.commit() }; }
      case 'VWMA': { const m = taStep.vwma(cfg.maLength); return { step: (v, vol) => m.step(v, vol), commit: () => m.commit() }; }
      default: { const m = taStep.sma(); return { step: (v) => m.step(v, cfg.maLength), commit: () => m.commit() }; }
    }
  };

  // Regular divergences
  const lbR = 5;
  const lbL = 5;
  const rangeUpper = 60;
  const rangeLower = 5;
  const second = (a: number[]) => (a.length >= 2 ? a[a.length - 2] : NaN);
  const inRange = (bs: number) => rangeLower <= bs && bs <= rangeUpper;

  return {
    fullRunReason: () => (isBarSource(cfg.rsiSource) ? null : 'source of another study'),
    init() {
      const maStep = maMachine();
      const sdStep = isBB ? taStep.stdev() : null;
      const s: NcrRun = {
        fdMeanStep: taStep.sma(), fdStdStep: taStep.stdev(), upStep: taStep.rma(cfg.rsiLength), downStep: taStep.rma(cfg.rsiLength),
        maStep, sdStep, pl: new PivotStep(lbL, lbR, false), ph: new PivotStep(lbL, lbR, true),
        src: [], rsi: [], normClose: [], plFound: [], phFound: [], rsiData: [], midData: [], maData: [], upperData: [],
        lowerData: [], bullLine: [], bearLine: [], candles: [], plRsi: [], plLow: [], phRsi: [], phHigh: [], markers: [],
        flags: Array.from({ length: 6 }, () => []), times: Array.from({ length: 6 }, () => []),
        steps: [], vars: { plSince: NaN, phSince: NaN }, lists: [], series: [],
      };
      s.steps = [s.fdMeanStep, s.fdStdStep, s.upStep, s.downStep, ...(maStep ? [maStep] : []), ...(sdStep ? [sdStep] : []), s.pl, s.ph];
      s.lists = [s.candles, s.plRsi, s.plLow, s.phRsi, s.phHigh, s.markers, ...s.times];
      s.series = [
        s.src, s.rsi, s.normClose, s.plFound, s.phFound, s.rsiData, s.midData, s.maData, s.upperData, s.lowerData, ...s.flags,
      ];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const time = b.time;

      // f_frac_diff(fd_w, close): sum of w[k] * nz(close[k], close) once bar_index >= L - 1, else close
      const cl = b.close;
      let val = 0.0;
      if (i >= L - 1) {
        for (let k = 0; k < L; k++) {
          const x = bars[i - k].close;
          val += w[k] * (isNaN(x) ? cl : x);
        }
      } else {
        val = cl;
      }
      const on = cfg.fdEnabled && i >= fdWarmup;
      const fdClose = on ? val : b.close;
      const fdOpen = on ? val - (b.close - b.open) : b.open;
      const fdHigh = on ? val + (b.high - b.close) : b.high;
      const fdLow = on ? val - (b.close - b.low) : b.low;

      // Z-score + sigmoid
      const fdMean = s.fdMeanStep.step(fdClose, cfg.zLen);
      const fdStd = s.fdStdStep.step(fdClose, cfg.zLen);
      const fdSafe = isNaN(fdStd) ? NaN : Math.max(fdStd, 0.0001);
      const normalize = (x: number) => {
        const zScore = (x - fdMean) / fdSafe;
        const scaledZ = zScore / (cfg.zClip / 2.0);
        return 100.0 / (1.0 + Math.exp(-scaledZ));
      };
      const o = normalize(fdOpen);
      const h = normalize(fdHigh);
      const l = normalize(fdLow);
      const c = normalize(fdClose);
      s.normClose[i] = c;
      // candleColor = norm_close >= norm_open ? bullColor : bearColor
      const col = ge(c, o) ? cfg.bullColor : cfg.bearColor;
      // plotcandle draws no candle when a value is na
      if (Number.isFinite(o) && Number.isFinite(h) && Number.isFinite(l) && Number.isFinite(c)) {
        s.candles.push({ time, open: o, high: h, low: l, close: c, color: col, wickColor: col, borderColor: col });
      }

      // RSI: change = ta.change(src); up = ta.rma(math.max(change, 0)); down = ta.rma(-math.min(change, 0))
      const src = value(b);
      s.src[i] = src;
      const change = i > 0 ? src - s.src[i - 1] : NaN;
      const up = s.upStep.step(isNaN(change) ? NaN : Math.max(change, 0));
      const down = s.downStep.step(isNaN(change) ? NaN : -Math.min(change, 0));
      // rsi = down == 0 ? 100 : up == 0 ? 0 : 100 - (100 / (1 + up / down))
      const rsi = eq(down, 0) ? 100 : eq(up, 0) ? 0 : 100 - 100 / (1 + up / down);
      s.rsi[i] = rsi;
      const ma = s.maStep ? s.maStep.step(rsi, b.volume ?? NaN) : NaN;
      const sd = s.sdStep ? s.sdStep.step(rsi, cfg.maLength) * cfg.bbMult : NaN;
      s.rsiData[i] = { time, value: rsi, color: '#7E57C2' };
      s.midData[i] = { time, value: 50 };
      s.maData[i] = { time, value: ma, color: color.yellow };
      s.upperData[i] = { time, value: ma + sd, color: color.green };
      s.lowerData[i] = { time, value: ma - sd, color: color.green };

      v.plSince = i > 0 && s.plFound[i - 1] ? 0 : isNaN(v.plSince) ? NaN : v.plSince + 1;
      v.phSince = i > 0 && s.phFound[i - 1] ? 0 : isNaN(v.phSince) ? NaN : v.phSince + 1;
      const inRangePl = inRange(v.plSince);
      const inRangePh = inRange(v.phSince);
      let plFound = false;
      let phFound = false;
      let bullCond = false;
      let bearCond = false;
      const r = i - lbR >= 0 ? s.rsi[i - lbR] : NaN;
      if (cfg.calculateDivergence) {
        const lowLbr = i - lbR >= 0 ? bars[i - lbR].low : NaN;
        const highLbr = i - lbR >= 0 ? bars[i - lbR].high : NaN;

        plFound = !isNaN(s.pl.step(i, rsi));
        if (plFound) {
          s.plRsi.push(r);
          s.plLow.push(lowLbr);
        }
        const rsiHL = gt(r, second(s.plRsi)) && inRangePl;
        const priceLL = lt(lowLbr, second(s.plLow));
        bullCond = priceLL && rsiHL && plFound;

        phFound = !isNaN(s.ph.step(i, rsi));
        if (phFound) {
          s.phRsi.push(r);
          s.phHigh.push(highLbr);
        }
        const rsiLH = lt(r, second(s.phRsi)) && inRangePh;
        const priceHH = gt(highLbr, second(s.phHigh));
        bearCond = priceHH && rsiLH && phFound;
      }
      s.plFound[i] = plFound;
      s.phFound[i] = phFound;

      // plot(..., offset = -lookbackRight): the value of bar i is drawn on bar i - 5 (bar i is the only writer of it)
      if (i >= lbR) {
        const at = bars[i - lbR].time;
        s.bullLine[i - lbR] = { time: at, value: plFound ? r : NaN, color: bullCond ? color.green : NONE_COLOR };
        s.bearLine[i - lbR] = { time: at, value: phFound ? r : NaN, color: bearCond ? color.red : NONE_COLOR };
        // plotshape(bullCond ? rsiLBR : na, offset = -5, " Bull ", shape.labelup, location.absolute, green, textcolor white)
        if (!isNaN(r)) {
          if (bullCond) {
            s.markers.push({ time: at, position: 'atPriceBottom', price: r, shape: 'labelUp', color: color.green, text: ' Bull ',
              textColor: color.white });
          }
          if (bearCond) {
            s.markers.push({ time: at, position: 'atPriceTop', price: r, shape: 'labelDown', color: color.red, text: ' Bear ',
              textColor: color.white });
          }
        }
      }

      // alertcondition: divergences, ta.crossover / ta.crossunder of the normalised close (exact comparisons)
      const pc = i > 0 ? s.normClose[i - 1] : NaN;
      const f = s.flags;
      f[0][i] = bullCond;
      f[1][i] = bearCond;
      f[2][i] = c > 50 && pc <= 50;
      f[3][i] = c < 50 && pc >= 50;
      f[4][i] = c > 70 && pc <= 70;
      f[5][i] = c < 30 && pc >= 30;
      for (let k = 0; k < 6; k++) if (f[k][i]) s.times[k].push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      const shifted = Math.max(0, n - lbR);
      const constant = <T>(v: T) => new Array<T>(n).fill(v);
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.rsiData.slice(),
          plot1: s.midData.slice(),
          plot2: s.maData.slice(),
          plot3: s.upperData.slice(),
          plot4: s.lowerData.slice(),
          plot5: s.bullLine.slice(0, shifted),
          plot6: s.bearLine.slice(0, shifted),
        },
        hlines: [
          { value: 70, options: { title: 'RSI Upper Band', color: BAND_COLOR, linestyle: 'dashed' } },
          { value: 50, options: { title: 'RSI Middle Band', color: MIDDLE_COLOR, linestyle: 'dotted' } },
          { value: 30, options: { title: 'RSI Lower Band', color: BAND_COLOR, linestyle: 'dashed' } },
        ],
        fills: [
          { plot1: 'hline_upper', plot2: 'hline_lower', options: { title: 'RSI Background Fill' }, colors: constant(BAND_FILL) },
          // fill(rsiPlot, midLinePlot, 100, 70, top_color = color.new(color.green, 0), bottom_color = color.new(color.green, 100))
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Overbought Gradient Fill' },
            gradient: { topValue: constant(100), bottomValue: constant(70),
              topColor: constant(String(color.new(color.green, 0))), bottomColor: constant(String(color.new(color.green, 100))) } },
          // fill(rsiPlot, midLinePlot, 30, 0, top_color = color.new(color.red, 100), bottom_color = color.new(color.red, 0))
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Oversold Gradient Fill' },
            gradient: { topValue: constant(30), bottomValue: constant(0),
              topColor: constant(String(color.new(color.red, 100))), bottomColor: constant(String(color.new(color.red, 0))) } },
          // fill(bbUpperBand, bbLowerBand, color = isBB ? color.new(color.green, 90) : na, display = isBB ? all : none)
          { plot1: 'plot3', plot2: 'plot4', options: { title: 'Bollinger Bands Background Fill' },
            colors: constant(isBB ? BB_FILL : 'transparent') },
        ],
        markers: s.markers.slice(),
        plotCandles: { ffdNormalizedCandles: s.candles.slice() },
        visibility: { enableMA, isBB },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<NormalizedCandlesRsiInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<NormalizedCandlesRsiInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const NormalizedCandlesRsi = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
  alertConditions,
};
