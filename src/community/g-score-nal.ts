/**
 * G-Score | NAL
 *
 * Price Z: a Jurik-style moving average of the z-score of the source ((src - SMA) / stdev over the z-score length).
 * Thresholds: +- a Jurik-style moving average (3 x smoothing) of the z-score of a GARCH volatility. The GARCH
 * variance mixes the long-run variance (SMA of the lagged one-bar variance), the squared lagged log return of the
 * source and the lagged one-bar variance; its weights are fitted on each bar by a grid search: beta (1..99) then
 * gamma (1..100 - beta), each the candidate with the lowest sum of squared errors against the realized variance (SMA
 * of the squared returns) over the lookback. The state turns bullish when Price Z is above the upper threshold and
 * bearish below the lower threshold, and is kept between. Colours of the lines, fills, background and candles
 * follow the state; triangles mark the changes from bearish to bullish and back.
 *
 * Reference: "G-Score | NAL" by NordicAlphaLab
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © NordicAlphaLab
 */

import { taStep, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BgColorData, PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface GScoreNalInputs {
  /** Colour mode: Standard, Nordic or Simple */
  colMode: 'Standard' | 'Nordic' | 'Simple';
  src: SourceType;
  /** GARCH lookback (window of the fit and of the variance averages) */
  garchLookback: number;
  /** Z-score length */
  len: number;
  /** Jurik-style smoothing length (3 x for the volatility z-score) */
  smoothLen: number;
}

export const defaultInputs: GScoreNalInputs = {
  colMode: 'Standard',
  src: 'hlcc4',
  garchLookback: 30,
  len: 48,
  smoothLen: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'colMode', type: 'string', title: 'Color Mode', defval: 'Standard', options: ['Standard', 'Nordic', 'Simple'] },
  { id: 'src', type: 'source', title: 'Source', defval: 'hlcc4' },
  { id: 'garchLookback', type: 'int', title: 'GARCH Lookback', defval: 30, min: 2 },
  { id: 'len', type: 'int', title: 'Z-Score Length', defval: 48, min: 1 },
  { id: 'smoothLen', type: 'int', title: 'Smoothing', defval: 10, min: 1 },
];

const STANDARD_UP = String(color.rgb(0, 255, 200));
const ZERO_COL = String(color.new(color.white, 85));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Zero', color: ZERO_COL, lineWidth: 1, display: 'pane' },
  { id: 'plot1', title: 'Upper Threshold', color: String(color.new(color.gray, 35)), lineWidth: 1 },
  { id: 'plot2', title: 'Lower Threshold', color: String(color.new(color.gray, 35)), lineWidth: 1 },
  { id: 'plot3', title: 'Price Z', color: color.gray, lineWidth: 1 },
  { id: 'plot4', title: 'GLOW Price Z', color: String(color.new(color.gray, 50)), lineWidth: 5, display: 'pane' },
];

export const metadata = {
  title: 'G-Score | NAL',
  shortTitle: 'G-Score',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; na operands give false */
const EPS = 1e-10;
const gt = (a: number, b: number): boolean => a - b > EPS;
const lt = (a: number, b: number): boolean => b - a > EPS;
/** Pine nz: na and +-infinity give the replacement */
const nz = (v: number, r: number) => (Number.isFinite(v) ? v : r);

type Result = Omit<IndicatorResult, 'markers'> & {
  markers: MarkerData[]; bgColors: BgColorData[]; plotCandles: Record<string, PlotCandleData[]>;
};
type Point = { time: number; value: number; color: string };
/** The state of one jma() call: e0, e1, e2, val (immutable) */
type JmaState = readonly [number, number, number, number];

interface GScoreVars {
  jmaPrice: JmaState;
  jmaVol: JmaState;
  /** NAL (nz(NAL[1], 0)) */
  state: number;
  /** plotColor (nz(plotColor[1], col_nu)) */
  prevColor: string;
}

interface GScoreRun extends BarRunState<GScoreVars> {
  laggedVar: ReturnType<typeof taStep.variance>;
  realizedSma: ReturnType<typeof taStep.sma>;
  longRunSma: ReturnType<typeof taStep.sma>;
  lambdaSum: LoopSum;
  gammaSum: LoopSum;
  priceMean: ReturnType<typeof taStep.sma>;
  priceDev: ReturnType<typeof taStep.stdev>;
  volMean: ReturnType<typeof taStep.sma>;
  volDev: ReturnType<typeof taStep.stdev>;
  /** The source of another study (read from the whole bar set; such a run is always full) */
  external: number[] | null;
  src: number[];
  nal: number[];
  plotColor: string[];
  plots: Point[][];
  fillZ: string[];
  markers: MarkerData[];
  bgColors: BgColorData[];
  candles: PlotCandleData[];
}

function study(inputs: Partial<GScoreNalInputs>): BarStudy<GScoreRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const lookback = cfg.garchLookback;
  const value = barSource(cfg.src);

  const [colUp, colDn, colNu] = cfg.colMode === 'Nordic'
    ? [String(color.rgb(46, 161, 255)), String(color.rgb(150, 154, 169)), color.gray]
    : cfg.colMode === 'Simple'
      ? [color.lime, color.red, color.gray]
      : [STANDARD_UP, String(color.rgb(32, 94, 144)), color.gray];
  const fillUp = String(color.new(colUp, 90));
  const fillDn = String(color.new(colDn, 90));
  const jmaPrice = jmaOf(cfg.smoothLen, 100, 7);
  const jmaVol = jmaOf(cfg.smoothLen * 3, 100, 7);
  const START: JmaState = [NaN, NaN, NaN, NaN];

  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init(bars) {
      const s: GScoreRun = {
        laggedVar: taStep.variance(), realizedSma: taStep.sma(), longRunSma: taStep.sma(),
        // math.sum(x, lookback) inside the two loops: one call site each. Its history has one value per bar (the value
        // of its last call in that bar), so each call gives x + the last values of the lookback - 1 previous bars.
        lambdaSum: new LoopSum(lookback), gammaSum: new LoopSum(lookback),
        priceMean: taStep.sma(), priceDev: taStep.stdev(), volMean: taStep.sma(), volDev: taStep.stdev(),
        external: isBarSource(cfg.src) ? null : getSourceSeries(bars, cfg.src).toArray().map((v) => v ?? NaN),
        src: [], nal: [], plotColor: [], plots: [[], [], [], [], []], fillZ: [], markers: [], bgColors: [], candles: [],
        steps: [], vars: { jmaPrice: START, jmaVol: START, state: 0, prevColor: colNu }, lists: [], series: [],
      };
      s.steps = [s.laggedVar, s.realizedSma, s.longRunSma, s.lambdaSum, s.gammaSum, s.priceMean, s.priceDev, s.volMean, s.volDev];
      s.lists = [s.markers];
      s.series = [s.src, s.nal, s.plotColor, ...s.plots, s.fillZ, s.bgColors, s.candles];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const t = b.time;
      const src = s.src;
      src[i] = s.external ? s.external[i] : value(b);

      // Lagged return / variance components
      const s1 = i >= 1 ? src[i - 1] : NaN;
      const s2 = i >= 2 ? src[i - 2] : NaN;
      const logReturn = !isNaN(s2) && gt(s1, 0.0) && gt(s2, 0.0) ? Math.log(s1 / s2) : 0.0;
      // nz(ta.variance(src[1], 1), 0.0)
      const lagged = nz(s.laggedVar.step(s1, 1), 0.0);
      const sq = Math.pow(logReturn, 2.0);
      const realized = nz(s.realizedSma.step(sq, lookback), sq);
      const longRunVariance = nz(s.longRunSma.step(lagged, lookback), lagged);

      const lambdaSse: number[] = [];
      for (let c = 1; c <= 99; c++) {
        const w = c / 100.0;
        const est = w * lagged + (1.0 - w) * sq;
        lambdaSse.push(s.lambdaSum.call(Math.pow(est - realized, 2.0)));
      }
      const betaIndex = indexOfMin(lambdaSse) + 1;

      const gammaSse: number[] = [];
      for (let g = 1; g <= 100 - betaIndex; g++) {
        const bw = betaIndex / 100.0;
        const gw = g / 100.0;
        const aw = 1.0 - bw - gw;
        const est = gw * longRunVariance + aw * sq + bw * lagged;
        gammaSse.push(s.gammaSum.call(Math.pow(est - realized, 2.0)));
      }
      const gammaIndex = indexOfMin(gammaSse) + 1;

      const beta = betaIndex / 100.0;
      const gamma = gammaIndex / 100.0;
      const alpha = 1.0 - beta - gamma;
      const variance = gamma * longRunVariance + alpha * sq + beta * lagged;
      const volatility = Math.sqrt(Math.max(variance, 0.0));

      // f_zScore(Zsrc, Zlen) = (Zsrc - ta.sma(Zsrc, Zlen)) / ta.stdev(Zsrc, Zlen): a plain division (x / 0 is +-infinity)
      const zp = (src[i] - s.priceMean.step(src[i], cfg.len)) / s.priceDev.step(src[i], cfg.len);
      const zv = (volatility - s.volMean.step(volatility, cfg.len)) / s.volDev.step(volatility, cfg.len);
      v.jmaPrice = jmaPrice(v.jmaPrice, zp);
      v.jmaVol = jmaVol(v.jmaVol, zv);
      const zPrice = v.jmaPrice[3];
      const zVol = v.jmaVol[3];

      const neg = zVol * -1;
      // math.max / math.min: na with an na argument
      const upper = isNaN(zVol) ? NaN : Math.max(zVol, neg);
      const lower = isNaN(zVol) ? NaN : Math.min(zVol, neg);
      // NAL := zScore_Price < lower_threshold ? -1 : zScore_Price > upper_threshold ? 1 : nz(NAL[1], 0)
      v.state = lt(zPrice, lower) ? -1 : gt(zPrice, upper) ? 1 : v.state;
      const nal = v.state;
      s.nal[i] = nal;
      // plotColor := NAL == 1 ? col_up : NAL == -1 ? col_dn : nz(plotColor[1], col_nu)
      v.prevColor = nal === 1 ? colUp : nal === -1 ? colDn : v.prevColor;
      const plotColor = v.prevColor;
      s.plotColor[i] = plotColor;

      const thr = String(color.new(plotColor, 35));
      const glow = String(color.new(plotColor, 50));
      const fin = (x: number) => (Number.isFinite(x) ? x : NaN);
      s.plots[0][i] = { time: t, value: 0, color: ZERO_COL };
      s.plots[1][i] = { time: t, value: fin(upper), color: thr };
      s.plots[2][i] = { time: t, value: fin(lower), color: thr };
      s.plots[3][i] = { time: t, value: fin(zPrice), color: plotColor };
      s.plots[4][i] = { time: t, value: fin(zPrice), color: glow };
      s.fillZ[i] = String(color.new(plotColor, 90));

      // bgcolor(color.new(plotColor, 70), force_overlay = true)
      s.bgColors[i] = { time: t, color: String(color.new(plotColor, 70)), forceOverlay: true };
      if (i > 0 && nal === 1 && s.nal[i - 1] === -1) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: colUp, text: '𝓑𝓾𝔂', textColor: colUp,
          size: 'tiny', forceOverlay: true });
      }
      if (i > 0 && nal === -1 && s.nal[i - 1] === 1) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: colDn, text: '𝓢𝓮𝓵𝓵', textColor: colDn,
          size: 'tiny', forceOverlay: true });
      }
      // plotcandle(open, high, low, close, "Colored Candles", plotColor, plotColor, bordercolor = plotColor,
      //            force_overlay = true, display = display.pane)
      s.candles[i] = { time: t, open: b.open, high: b.high, low: b.low, close: b.close,
        color: plotColor, wickColor: plotColor, borderColor: plotColor, forceOverlay: true };
    },
    result(s, bars) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plots[0].slice(),
          plot1: s.plots[1].slice(),
          plot2: s.plots[2].slice(),
          plot3: s.plots[3].slice(),
          plot4: s.plots[4].slice(),
        },
        fills: [
          // fill(pu, p0, color.new(col_up, 90)); fill(pl, p0, color.new(col_dn, 90)); fill(pz, p0, color.new(plotColor, 90))
          { plot1: 'plot1', plot2: 'plot0', options: { title: 'Plots Background', color: fillUp }, colors: bars.map(() => fillUp) },
          { plot1: 'plot2', plot2: 'plot0', options: { title: 'Plots Background', color: fillDn }, colors: bars.map(() => fillDn) },
          { plot1: 'plot3', plot2: 'plot0', options: { title: 'Plots Background' }, colors: s.fillZ.slice() },
        ],
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
        plotCandles: { coloredCandles: s.candles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<GScoreNalInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<GScoreNalInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/**
 * Jurik-style moving average of the script (jma(src, length, phase, power)) one bar at a time: the state of one call
 * and the source of the bar give the new state (its val is the result). nz() treats na and +-infinity as na.
 */
function jmaOf(length: number, phase: number, power: number): (st: JmaState, x: number) => JmaState {
  const phaseRatio = phase < -100.0 ? 0.5 : phase > 100.0 ? 2.5 : phase / 100.0 + 1.5;
  const beta = (0.45 * (length - 1)) / (0.45 * (length - 1) + 2.0);
  const alpha = Math.pow(beta, power);
  return ([pe0, pe1, pe2, pval], x) => {
    const e0 = (1.0 - alpha) * x + alpha * nz(pe0, x);
    const e1 = (x - e0) * (1.0 - beta) + beta * nz(pe1, 0.0);
    const e2 = (e0 + phaseRatio * e1 - nz(pval, x)) * Math.pow(1.0 - alpha, 2.0) + Math.pow(alpha, 2.0) * nz(pe2, 0.0);
    const val = e2 + nz(pval, x);
    return [e0, e1, e2, val];
  };
}

/**
 * array.indexof(arr, array.min(arr)): array.min skips na; array.indexof compares as Pine `==` (within 1e-10), so it
 * gives the first value within 1e-10 of the smallest one; -1 when every value is na.
 */
function indexOfMin(values: number[]): number {
  let min = NaN;
  for (const v of values) if (!isNaN(v) && (isNaN(min) || v < min)) min = v;
  if (isNaN(min)) return -1;
  return values.findIndex((v) => !isNaN(v) && !(Math.abs(v - min) > EPS));
}

/**
 * Pine math.sum(x, len) of one call site called several times per bar (in a loop): each call gives x + the values
 * of the len - 1 previous bars where it ran (na before); the value kept for a bar is the one of its last call
 * (committed by the run when the bar is final).
 */
class LoopSum implements Committable {
  private hist: number[] = [];
  private last = NaN;
  private called = false;
  constructor(private readonly len: number) {}
  call(x: number): number {
    this.last = x;
    this.called = true;
    const h = this.hist.length;
    if (h < this.len - 1) return NaN;
    let s = x;
    for (let k = 1; k < this.len; k++) s += this.hist[h - k];
    return s;
  }
  commit(): void {
    if (!this.called) return;
    this.called = false;
    this.hist.push(this.last);
    if (this.hist.length > this.len) this.hist.shift();
  }
}

export const GScoreNal = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
