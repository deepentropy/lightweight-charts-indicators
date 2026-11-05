/**
 * AI-Weighted RSI (Zeiierman)
 *
 * The target is the previous bar's RSI. Five predictors are the previous bar's log return, RSI, ATR(200) / close,
 * log volume change and volume. Over a learning window, each predictor gets the correlation with the target as its
 * coefficient (the RSI coefficient is fixed at 1), the predictors are ordered by absolute correlation and the
 * prediction is the sum of coefficient * z-score of each predictor. The predicted z-score is mapped back to an RSI
 * level with the rolling mean and stdev of the target, then to a weight -(50 - predicted RSI) / 50 clamped to -2..2.
 * The weight is plotted with an SMA signal line, bands at +/- 0.5 and gradient fills to zero.
 *
 * Reference: "AI-Weighted RSI (Zeiierman)" by Zeiierman
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AIWeightedRSIInputs {
  /** RSI length */
  rsiLen: number;
  /** SMA length of the signal line */
  sigLen: number;
  /** Rolling window for the correlations and z-scores */
  learnLen: number;
}

export const defaultInputs: AIWeightedRSIInputs = {
  rsiLen: 14,
  sigLen: 20,
  learnLen: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 2 },
  { id: 'sigLen', type: 'int', title: 'Signal Length', defval: 20, min: 2 },
  { id: 'learnLen', type: 'int', title: 'Learning Window', defval: 20, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'AI-Weighted RSI', color: '#7E57C2', lineWidth: 1 },
  { id: 'plot1', title: 'AI-Weighted RSI Signal Line', color: color.yellow, lineWidth: 1 },
  { id: 'plot2', title: 'Zero', color: 'transparent', lineWidth: 1, display: 'none' },
];

const MID_COLOR = String(color.new('#787B86', 50));
const BAND_FILL = String(color.rgb(126, 87, 194, 90));

// Pine hline default style: dashed
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper', price: 0.5, title: 'AI-Weighted RSI Upper Band', color: '#787B86', linestyle: 'dashed' },
  { id: 'hline_mid', price: 0, title: 'AI-Weighted RSI Middle Band', color: MID_COLOR, linestyle: 'dashed' },
  { id: 'hline_lower', price: -0.5, title: 'AI-Weighted RSI Lower Band', color: '#787B86', linestyle: 'dashed' },
];

export const fillConfig = [
  { id: 'fill0', plot1: 'hline_upper', plot2: 'hline_lower', color: BAND_FILL },
];

export const metadata = {
  title: 'AI-Weighted RSI (Zeiierman)',
  shortTitle: 'AI-Weighted RSI (Zeiierman)',
  overlay: false,
  precision: 1,
};

// Pine compares floats with a tolerance of 1e-10; a comparison with na is false.
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
// Pine nz(): na and +-infinity (log(0), x / 0) give the replacement
const nz = (v: number, r = 0) => (Number.isFinite(v) ? v : r);
/** Division: Pine x / 0 is +-Infinity, but each use here is guarded, has a price denominator, or goes through
 * nz() (volLogChg), where NaN gives the same value */
const div = (a: number, b: number) => (b === 0 ? NaN : a / b);

/** f_topk_indices(arr) of the script: indices of the 5 largest values (nz), first index on ties */
function topkIndices(arr: number[]): number[] {
  const sz = arr.length;
  const kk = Math.min(5, sz);
  const tmp = arr.map((v) => nz(v));
  const out: number[] = [];
  for (let k = 0; k < kk; k++) {
    let maxI = 0;
    let maxV = tmp[0];
    for (let j = 1; j < sz; j++) {
      const vj = tmp[j];
      // take = na(maxV) or (not na(vj) and vj > maxV)
      if (isNaN(maxV) || (!isNaN(vj) && gt(vj, maxV))) {
        maxV = vj;
        maxI = j;
      }
    }
    out.push(maxI);
    tmp[maxI] = NaN;
  }
  return out;
}

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };
type Point = { time: number; value: number };
type Corr = ReturnType<typeof taStep.correlation>;
type Sma = ReturnType<typeof taStep.sma>;
type Stdev = ReturnType<typeof taStep.stdev>;

interface AIWeightedRSIRun extends BarRunState<Record<string, never>> {
  rsi: ReturnType<typeof taStep.rsi>;
  atr: ReturnType<typeof taStep.atr>;
  /** ta.correlation(y_rsi, x, learnLen) of each predictor */
  corr: Corr[];
  /** ta.sma / ta.stdev(x, learnLen) of each predictor (f_z) */
  zMean: Sma[];
  zStd: Stdev[];
  rsiMean: Sma;
  rsiStd: Stdev;
  signal: Sma;
  /** Per-bar features (read on the next bar) */
  retLog: number[];
  rsiVal: number[];
  atrPct: number[];
  volLogChg: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
}

function study(inputs: Partial<AIWeightedRSIInputs>): BarStudy<AIWeightedRSIRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { rsiLen, sigLen, learnLen } = cfg;
  return {
    init() {
      const s: AIWeightedRSIRun = {
        rsi: taStep.rsi(rsiLen), atr: taStep.atr(200),
        corr: Array.from({ length: 5 }, () => taStep.correlation(learnLen)),
        zMean: Array.from({ length: 5 }, () => taStep.sma()),
        zStd: Array.from({ length: 5 }, () => taStep.stdev()),
        rsiMean: taStep.sma(), rsiStd: taStep.stdev(), signal: taStep.sma(),
        retLog: [], rsiVal: [], atrPct: [], volLogChg: [], plot0: [], plot1: [], plot2: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.rsi, s.atr, ...s.corr, ...s.zMean, ...s.zStd, s.rsiMean, s.rsiStd, s.signal];
      s.series = [s.retLog, s.rsiVal, s.atrPct, s.volLogChg, s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const close = b.close;
      const vol = b.volume ?? NaN;
      const prevBar = i > 0 ? bars[i - 1] : null;
      const prev = (a: number[]) => (i > 0 ? a[i - 1] : NaN);

      // Per-bar features
      // retLog = math.log(close / nz(close[1], close)); volLogChg = math.log(vol / nz(vol[1], vol))
      s.retLog[i] = Math.log(div(close, nz(prevBar ? prevBar.close : NaN, close)));
      const rsiVal = s.rsi.step(close);
      s.rsiVal[i] = rsiVal;
      const atr200 = s.atr.step(b.high, b.low, close);
      s.atrPct[i] = div(atr200, close);
      s.volLogChg[i] = Math.log(div(vol, nz(prevBar ? prevBar.volume ?? NaN : NaN, vol)));

      // Target: prior bar RSI; predictors: prior-bar values of each feature
      const yRsi = prev(s.rsiVal);
      const x = [
        nz(prev(s.retLog)), nz(prev(s.rsiVal)), nz(prev(s.atrPct)), nz(prev(s.volLogChg)),
        nz(prevBar ? prevBar.volume ?? NaN : NaN),
      ];

      const corrs = x.map((v, k) => s.corr[k].step(yRsi, v));
      // f_z(src, len): s > 0 ? (src - sma) / stdev : 0
      const featZ = x.map((v, k) => {
        const m = s.zMean[k].step(v, learnLen);
        const sd = s.zStd[k].step(v, learnLen);
        return nz(gt(sd, 0) ? div(v - m, sd) : 0);
      });

      // rsi_mean = ta.sma(y_rsi, learnLen); rsi_std = ta.stdev(y_rsi, learnLen)
      const rsiMean = s.rsiMean.step(yRsi, learnLen);
      const rsiStd = s.rsiStd.step(yRsi, learnLen);

      // corrs = |nz(corr)| of each predictor; topIdx = f_topk_indices(corrs)
      const topIdx = topkIndices(corrs.map((c) => Math.abs(nz(c))));
      // coef = nz(corr) of each predictor, coef_rsi = 1.0
      const coef = [nz(corrs[0]), 1.0, nz(corrs[2]), nz(corrs[3]), nz(corrs[4])];
      // f_pred: s += nz(coef[idx]) * nz(featZ[idx]) over topIdx
      let sum = 0.0;
      for (const idx of topIdx) sum += nz(coef[idx]) * nz(featZ[idx]);
      // pred_rsi = nz(rsi_mean) + nz(rsi_std) * pred_rsi_z
      const predRsi = nz(rsiMean) + nz(rsiStd) * sum;
      // rsiWeight = math.max(-2, math.min(2, (50 - nz(pred_rsi)) / 50)) * -1
      const rsiWeight = Math.max(-2, Math.min(2, (50 - nz(predRsi)) / 50)) * -1;
      const maRsi = s.signal.step(rsiWeight, sigLen);

      s.plot0[i] = { time: b.time, value: rsiWeight };
      s.plot1[i] = { time: b.time, value: maRsi };
      // midLinePlot = plot(0, color = na, editable = false, display = display.none)
      s.plot2[i] = { time: b.time, value: 0 };
    },
    result(s, bars) {
      const n = bars.length;
      const constant = <T>(v: T) => new Array<T>(n).fill(v);
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: metadata.precision },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        hlines: hlineConfig.map((h) => ({ value: h.price, options: { title: h.title, color: h.color, linestyle: h.linestyle } })),
        fills: [
          // fill(rsiUpperBand, rsiLowerBand, color = color.rgb(126, 87, 194, 90))
          { plot1: 'hline_upper', plot2: 'hline_lower', options: { title: 'AI-Weighted RSI Background Fill', color: BAND_FILL } },
          // fill(rsiPlot, midLinePlot, 0.5, 0, top_color = color.new(color.lime, 0), bottom_color = color.new(color.lime, 100))
          { plot1: 'plot0', plot2: 'plot2', options: { title: 'Overbought Gradient Fill' }, gradient: {
            topValue: constant(0.5), bottomValue: constant(0),
            topColor: constant<string | null>(String(color.new(color.lime, 0))),
            bottomColor: constant<string | null>(String(color.new(color.lime, 100))),
          } },
          // fill(rsiPlot, midLinePlot, 0, -0.5, top_color = color.new(color.red, 100), bottom_color = color.new(color.red, 0))
          { plot1: 'plot0', plot2: 'plot2', options: { title: 'Oversold Gradient Fill' }, gradient: {
            topValue: constant(0), bottomValue: constant(-0.5),
            topColor: constant<string | null>(String(color.new(color.red, 100))),
            bottomColor: constant<string | null>(String(color.new(color.red, 0))),
          } },
        ],
        markers: [],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AIWeightedRSIInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AIWeightedRSIInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const AIWeightedRSI = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
