/**
 * Median Gaussian Trend | NAL
 *
 * The rolling median of the source is smoothed by a Gaussian filter (weights exp(-0.5 * ((i - (len - 1) / 2) /
 * sigma)^2) over `len` bars). Bands: the filtered line +- a Gaussian-weighted standard deviation of it (weights
 * exp(-((i / period) / 2)^2) over `period` bars) times the upper / lower multipliers. The trend turns up when the close
 * is above the upper band and down when it is below the lower band, and keeps its state in between. Candles, bands,
 * glow lines and gradient fills from each band to the band midline take the trend colour.
 *
 * Reference: "Median Gaussian Trend | NAL" by NordicAlphaLab
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © NordicAlphaLab
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MedianGaussianTrendNalInputs {
  /** Colour set: 'Standard', 'Nordic' or 'Simple' */
  colMode: 'Standard' | 'Nordic' | 'Simple';
  src: SourceType;
  /** Length of the median and of the Gaussian filter */
  baseLen: number;
  /** Sigma of the Gaussian filter */
  gaussianSig: number;
  /** Length of the Gaussian deviation */
  sdLen: number;
  /** Upper band multiplier */
  sdMul: number;
  /** Lower band multiplier */
  sdMulb: number;
}

export const defaultInputs: MedianGaussianTrendNalInputs = {
  colMode: 'Standard',
  src: 'close',
  baseLen: 16,
  gaussianSig: 5,
  sdLen: 20,
  sdMul: 2.5,
  sdMulb: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'colMode', type: 'string', title: 'Color Mode', defval: 'Standard', options: ['Standard', 'Nordic', 'Simple'] },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'baseLen', type: 'int', title: 'Gaussian Length', defval: 16 },
  { id: 'gaussianSig', type: 'float', title: 'Sigma', defval: 5, step: 0.1 },
  { id: 'sdLen', type: 'int', title: 'Gaussian Volatility Length', defval: 20 },
  { id: 'sdMul', type: 'float', title: 'Upper Band', defval: 2.5, step: 0.1 },
  { id: 'sdMulb', type: 'float', title: 'Lower Band', defval: 2, step: 0.1 },
];

const COLOURS: Record<string, [string, string, string]> = {
  Standard: [String(color.rgb(0, 255, 200)), String(color.rgb(32, 94, 144)), color.gray],
  Nordic: [String(color.rgb(46, 161, 255)), String(color.rgb(150, 154, 169)), color.gray],
  Simple: [color.lime, color.red, color.gray],
};

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Band', color: color.gray, lineWidth: 1 },
  { id: 'plot1', title: 'Lower Band', color: color.gray, lineWidth: 1 },
  { id: 'plot2', title: 'Band Midline', color: color.white, lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Upper Band Glow', color: String(color.new(color.gray, 50)), lineWidth: 5 },
  { id: 'plot4', title: 'Lower Band Glow', color: String(color.new(color.gray, 50)), lineWidth: 5 },
];

export const metadata = {
  title: 'Median Gaussian Trend | NAL',
  shortTitle: 'Median Gaussian Trend',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

/** x[i] at bar b: na before the first bar */
const hist = (x: number[], b: number, i: number) => (b - i >= 0 ? x[b - i] : NaN);

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> };

interface MedianGaussianVars {
  /** NAL := close > upper ? 1 : close < lower ? -1 : NAL[1] (NAL[1] is na on the first bar) */
  nal: number;
}

interface MedianGaussianRun extends BarRunState<MedianGaussianVars> {
  median: ReturnType<typeof taStep.median>;
  medianRaw: number[];
  medianBase: number[];
  upper: number[];
  lower: number[];
  midli: number[];
  fillTop: string[];
  fillBottom: string[];
  plots: Point[][];
  candles: PlotCandleData[];
}

function study(inputs: Partial<MedianGaussianTrendNalInputs>): BarStudy<MedianGaussianRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const [colUp, colDn, colNu] = COLOURS[cfg.colMode] ?? COLOURS.Standard;
  const value = barSource(cfg.src);
  // gaussianFilter(median_raw, base_len, gaussian_sig): (len - 1) / 2 is a float division in Pine v6
  const len = cfg.baseLen;
  const gaussWeights: number[] = [];
  for (let i = 0; i <= len - 1; i++) gaussWeights.push(Math.exp(-0.5 * Math.pow((i - (len - 1) / 2) / cfg.gaussianSig, 2)));
  // gaussianDeviation(median_base, sd_len): i / period is a float division in Pine v6
  const period = cfg.sdLen;
  const weights: number[] = [];
  let sumw = 0.0;
  for (let i = 0; i <= period - 1; i++) {
    const w = Math.exp(-Math.pow(i / period / 2, 2));
    weights.push(w);
    sumw += w;
  }
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: MedianGaussianRun = {
        // median_raw = ta.median(fil_src, base_len)
        median: taStep.median(cfg.baseLen),
        medianRaw: [], medianBase: [], upper: [], lower: [], midli: [], fillTop: [], fillBottom: [],
        plots: Array.from({ length: 5 }, () => []), candles: [],
        steps: [], vars: { nal: NaN }, lists: [], series: [],
      };
      s.steps = [s.median];
      s.series = [
        s.medianRaw, s.medianBase, s.upper, s.lower, s.midli, s.fillTop, s.fillBottom, ...s.plots, s.candles,
      ];
      return s;
    },
    bar(s, b, bars) {
      const bar = bars[b];
      const medianRaw = s.medianRaw;
      medianRaw[b] = s.median.step(value(bar));
      let totalWeight = 0.0;
      let weightedSum = 0.0;
      for (let i = 0; i <= len - 1; i++) {
        const weight = gaussWeights[i];
        totalWeight += weight;
        weightedSum += hist(medianRaw, b, i) * weight;
      }
      const medianBase = s.medianBase;
      const m = weightedSum / totalWeight;
      medianBase[b] = m;

      let wmean = 0.0;
      for (let i = 0; i <= period - 1; i++) wmean += hist(medianBase, b, i) * weights[i];
      wmean = wmean / sumw;
      let wvar = 0.0;
      for (let i = 0; i <= period - 1; i++) {
        const diff = hist(medianBase, b, i) - wmean;
        wvar += Math.pow(diff, 2) * weights[i];
      }
      const sdRange = Math.sqrt(wvar / sumw);

      const upper = m + sdRange * cfg.sdMul;
      const lower = m - sdRange * cfg.sdMulb;
      const midli = (upper + lower) / 2;
      s.upper[b] = upper;
      s.lower[b] = lower;
      s.midli[b] = midli;

      const c = bar.close;
      const v = s.vars;
      v.nal = gt(c, upper) ? 1 : gt(lower, c) ? -1 : v.nal;
      const col = eq(v.nal, 1) ? colUp : eq(v.nal, -1) ? colDn : colNu;
      const glow = String(color.new(col, 50));
      s.fillTop[b] = String(color.new(col, 30));
      s.fillBottom[b] = String(color.new(col, 100));

      const time = bar.time;
      const p = s.plots;
      p[0][b] = { time, value: fin(upper), color: col };
      p[1][b] = { time, value: fin(lower), color: col };
      p[2][b] = { time, value: fin(midli), color: color.white };
      p[3][b] = { time, value: fin(upper), color: glow };
      p[4][b] = { time, value: fin(lower), color: glow };
      // plotcandle(open, high, low, close, "Bar Color", col, col, bordercolor = col, display = display.pane,
      //   force_overlay = true)
      s.candles[b] = {
        time, open: bar.open, high: bar.high, low: bar.low, close: bar.close,
        color: col, wickColor: col, borderColor: col, forceOverlay: true,
      };
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice() },
        fills: [
          // fill(u, m, upper, midli, color.new(col, 30), color.new(col, 100))
          { plot1: 'plot0', plot2: 'plot2', gradient: { topValue: s.upper.slice(), bottomValue: s.midli.slice(),
            topColor: s.fillTop.slice(), bottomColor: s.fillBottom.slice() } },
          // fill(l, m, lower, midli, color.new(col, 30), color.new(col, 100))
          { plot1: 'plot1', plot2: 'plot2', gradient: { topValue: s.lower.slice(), bottomValue: s.midli.slice(),
            topColor: s.fillTop.slice(), bottomColor: s.fillBottom.slice() } },
        ],
        plotCandles: { barColor: s.candles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MedianGaussianTrendNalInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MedianGaussianTrendNalInputs> = {},
): IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> } {
  return fullResult(createRun(inputs).update(bars));
}

export const MedianGaussianTrendNal = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
