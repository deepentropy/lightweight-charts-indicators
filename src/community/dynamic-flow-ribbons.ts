/**
 * Dynamic Flow Ribbons
 *
 * Supertrend-like bands around EMA(15) of hlc3: EMA +/- factor * SMA(high - low, 200). The lower band only rises
 * and the upper band only falls, unless the previous source crossed them. The trend is up (direction -1) when the
 * source closes above the upper band and down (direction 1) when it closes below the lower band. The trend line is
 * the average of both bands (a thick line and a wide glow). Five ribbon lines around the active band (band +/- 0.5
 * and 1 SMA range) fade from the band outwards; the lines of the other band are fully transparent. The candles are
 * redrawn in the trend colour at transparency 50.
 *
 * Reference: "Dynamic Flow Ribbons [BigBeluga]" by BigBeluga
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun, WindowSma } from '../live-run';

export interface DynamicFlowRibbonsInputs {
  /** Band width in SMA(high - low, 200) units (Pine title "Length") */
  factor: number;
  /** Uptrend colour */
  colUp: string;
  /** Downtrend colour */
  colDn: string;
}

export const defaultInputs: DynamicFlowRibbonsInputs = {
  factor: 3,
  colUp: '#1ADD7F',
  colDn: '#E79314',
};

export const inputConfig: InputConfig[] = [
  { id: 'factor', type: 'float', title: 'Length', defval: 3, step: 0.01 },
  { id: 'colUp', type: 'color', title: 'Up Color', defval: '#1ADD7F' },
  { id: 'colDn', type: 'color', title: 'Down Color', defval: '#E79314' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'TrendLine', color: '#1add7f', lineWidth: 4 },
  { id: 'plot1', title: 'TrendLine Glow', color: '#1add7f', lineWidth: 10 },
  { id: 'plot2', title: 'LowerBand1', color: '#1add7f', lineWidth: 1 },
  { id: 'plot3', title: 'LowerBand2', color: '#1add7f', lineWidth: 1 },
  { id: 'plot4', title: 'LowerBand3', color: '#1add7f', lineWidth: 1 },
  { id: 'plot5', title: 'LowerBand4', color: '#1add7f', lineWidth: 1 },
  { id: 'plot6', title: 'LowerBand5', color: '#1add7f', lineWidth: 1 },
  { id: 'plot7', title: 'UpperBand5', color: '#e79314', lineWidth: 1 },
  { id: 'plot8', title: 'UpperBand4', color: '#e79314', lineWidth: 1 },
  { id: 'plot9', title: 'UpperBand3', color: '#e79314', lineWidth: 1 },
  { id: 'plot10', title: 'UpperBand2', color: '#e79314', lineWidth: 1 },
  { id: 'plot11', title: 'UpperBand1', color: '#e79314', lineWidth: 1 },
];

export const metadata = {
  title: 'Dynamic Flow Ribbons',
  shortTitle: 'Dynamic Flow Ribbons',
  overlay: true,
};

/** Pine float comparison: a > b only when a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;
/** Pine a == b: |a - b| <= 1e-10 (false with na) */
const eq = (a: number, b: number) => Math.abs(a - b) <= 1e-10;
const nz = (v: number) => (isNaN(v) ? 0 : v);

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { plotCandles: Record<string, PlotCandleData[]> };

interface DfrVars {
  prevLower: number;
  prevUpper: number;
  prevSrc: number;
  prevDist: number;
  prevTrendLine: number;
}

interface DfrRun extends BarRunState<DfrVars> {
  dist: WindowSma;
  basis: ReturnType<typeof taStep.ema>;
  plots: Point[][];
  candles: PlotCandleData[];
}

// ribbon lines: [plot index, band, dist multiplier, transparency when active]
const RIBBONS: [number, 'lower' | 'upper', number, number][] = [
  [2, 'lower', 1, 80], [3, 'lower', 0.5, 60], [4, 'lower', 0, 40], [5, 'lower', -0.5, 20], [6, 'lower', -1, 0],
  [7, 'upper', 1, 0], [8, 'upper', 0.5, 20], [9, 'upper', 0, 40], [10, 'upper', -0.5, 60], [11, 'upper', -1, 80],
];

function study(inputs: Partial<DynamicFlowRibbonsInputs>): BarStudy<DfrRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { factor, colUp, colDn } = cfg;
  const c = (col: string, transp: number) => String(color.new(col, transp));
  return {
    init() {
      const s: DfrRun = {
        dist: new WindowSma(200), basis: taStep.ema(15), plots: Array.from({ length: 12 }, () => []), candles: [],
        steps: [], vars: { prevLower: NaN, prevUpper: NaN, prevSrc: NaN, prevDist: NaN, prevTrendLine: NaN },
        lists: [], series: [],
      };
      s.steps = [s.dist, s.basis];
      s.series = [...s.plots, s.candles];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      // dist = ta.sma(high - low, 200); src = hlc3; basis = ta.ema(src, 15)
      const dist = s.dist.step(b.high - b.low);
      const src = (b.high + b.low + b.close) / 3;
      const basis = s.basis.step(src);
      let lowerBand = basis - factor * dist;
      let upperBand = basis + factor * dist;
      const prevLowerBand = nz(v.prevLower);
      const prevUpperBand = nz(v.prevUpper);
      const prevSrc = v.prevSrc;
      // lowerBand := lowerBand > prevLowerBand or src[1] < prevLowerBand ? lowerBand : prevLowerBand
      lowerBand = gt(lowerBand, prevLowerBand) || gt(prevLowerBand, prevSrc) ? lowerBand : prevLowerBand;
      // upperBand := upperBand < prevUpperBand or src[1] > prevUpperBand ? upperBand : prevUpperBand
      upperBand = gt(prevUpperBand, upperBand) || gt(prevSrc, prevUpperBand) ? upperBand : prevUpperBand;
      let dir: number;
      if (i === 0 || isNaN(v.prevDist)) dir = 1;
      else if (eq(v.prevTrendLine, prevUpperBand)) dir = gt(src, upperBand) ? -1 : 1;
      else dir = gt(lowerBand, src) ? 1 : -1;
      // trend_line := _direction == -1 ? lowerBand : upperBand
      v.prevTrendLine = dir === -1 ? lowerBand : upperBand;
      v.prevLower = lowerBand;
      v.prevUpper = upperBand;
      v.prevSrc = src;
      v.prevDist = dist;

      const t = b.time;
      // t_col = _direction == 1 ? col_dn : col_up; line_ = math.avg(lowerBand, upperBand)
      const tCol = dir === 1 ? colDn : colUp;
      const line = (lowerBand + upperBand) / 2;
      s.plots[0][i] = { time: t, value: line, color: c(tCol, 0) };
      s.plots[1][i] = { time: t, value: line, color: c(tCol, 80) };
      for (const [k, band, mult, transp] of RIBBONS) {
        const active = band === 'lower' ? dir === -1 : dir === 1;
        const base = band === 'lower' ? lowerBand : upperBand;
        s.plots[k][i] = { time: t, value: mult === 0 ? base : base + dist * mult, color: c(tCol, active ? transp : 100) };
      }
      // plotcandle(open, high, low, close, color / wickcolor / bordercolor = color.new(t_col, 50))
      const candleCol = c(tCol, 50);
      s.candles[i] = { time: t, open: b.open, high: b.high, low: b.low, close: b.close, color: candleCol, wickColor: candleCol, borderColor: candleCol };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: Object.fromEntries(s.plots.map((p, k) => [`plot${k}`, p.slice()])),
        plotCandles: { candleStickColoring: s.candles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DynamicFlowRibbonsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DynamicFlowRibbonsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const DynamicFlowRibbons = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
