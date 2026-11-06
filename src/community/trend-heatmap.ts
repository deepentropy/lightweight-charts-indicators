/**
 * Trend Heatmap
 *
 * Two volume-weighted RSI-like lines: trendline = 100 - 100 / (1 + up / down), where up / down are the 8-bar sums of
 * volume * ohlc4 on bars where ohlc4 rose / fell; trendline2 is the same with close over 20 bars. The bar strength is
 * (2 * close - low - high) / (high - low) * volume / volume (0 on a flat bar). The plotted line is
 * trendline + strength / trendline2 + strength, coloured by a green to red gradient between 30 and 80, with
 * horizontal lines at 100, 50 and 0.
 *
 * Reference: "Trend Heatmap" by autocrp
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSum, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TrendHeatmapInputs {}

export const defaultInputs: TrendHeatmapInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trend', color: color.green, lineWidth: 3 },
];

/** hline(100 / 50 / 0, color = color.gray, linestyle = hline.style_dotted) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_max', price: 100, title: 'Max', color: color.gray, linestyle: 'dotted' },
  { id: 'hline_mid', price: 50, title: 'Mid', color: color.gray, linestyle: 'dotted' },
  { id: 'hline_min', price: 0, title: 'Min', color: color.gray, linestyle: 'dotted' },
];

export const metadata = {
  title: 'Trend Heatmap',
  shortTitle: 'Trend Heatmap',
  overlay: false,
};

/** Pine float comparisons: a == b within 1e-10, a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Point = { time: number; value: number; color: string };

interface HeatmapVars {
  /** math.sum(calculations, 1) / math.sum(volume, 1): the value itself, the previous result on a bar with an na value */
  sumCalc: number;
  sumVol: number;
}

interface HeatmapRun extends BarRunState<HeatmapVars> {
  top1: WindowSum;
  low1: WindowSum;
  top2: WindowSum;
  low2: WindowSum;
  plot0: Point[];
}

/** ta.change(x) <= 0 ? 0 : x (na on bar 0 compares false: the bar counts on both sides), the window sums of
 *  volume * that on the up and down sides, and 100.0 - 100.0 / (1.0 + top / low) (paramaters(): the two `if` blocks
 *  have no effect) */
function sides(v: number, ch: number, volume: number, top: WindowSum, low: WindowSum): number {
  const t = top.step(volume * (le(ch, 0) ? 0 : v));
  const l = low.step(volume * (ge(ch, 0) ? 0 : v));
  return 100.0 - 100.0 / (1.0 + t / l);
}

function study(): BarStudy<HeatmapRun, IndicatorResult> {
  return {
    init() {
      const s: HeatmapRun = {
        top1: new WindowSum(8), low1: new WindowSum(8),
        top2: new WindowSum(20), low2: new WindowSum(20), plot0: [],
        steps: [], vars: { sumCalc: NaN, sumVol: NaN }, lists: [], series: [],
      };
      s.steps = [s.top1, s.low1, s.top2, s.low2];
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const volume = b.volume ?? NaN;
      // calculations = close == high and close == low or high == low ? 0 : (2 * close - low - high) / (high - low) * volume
      const calc = (eq(b.close, b.high) && eq(b.close, b.low)) || eq(b.high, b.low)
        ? 0 : ((2 * b.close - b.low - b.high) / (b.high - b.low)) * volume;
      // trendstrength = math.sum(calculations, 1) / math.sum(volume, 1) (trendstrength2 is the same)
      const v = s.vars;
      if (Number.isFinite(calc)) v.sumCalc = calc;
      if (Number.isFinite(volume)) v.sumVol = volume;
      const strength = v.sumCalc / v.sumVol;

      const p = i > 0 ? bars[i - 1] : b;
      const ohlc4 = (b.open + b.high + b.low + b.close) / 4;
      const trendline = sides(ohlc4, i > 0 ? ohlc4 - (p.open + p.high + p.low + p.close) / 4 : NaN, volume, s.top1, s.low1);
      const trendline2 = sides(b.close, i > 0 ? b.close - p.close : NaN, volume, s.top2, s.low2);

      // combinedTrend = trendline + trendstrength / trendline2 + trendstrength2 (plain division: x / 0 is infinite)
      const combined = trendline + strength / trendline2 + strength;
      // color.new(color.from_gradient(combinedTrend, 30, 80, color.green, color.red), 0)
      const c = String(color.new(color.from_gradient(combined, 30, 80, color.green, color.red), 0));
      s.plot0[i] = { time: b.time, value: Number.isFinite(combined) ? combined : NaN, color: c };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        hlines: hlineConfig.map((h) => ({ value: h.price, options: { title: h.title, color: h.color, linestyle: h.linestyle } })),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<TrendHeatmapInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(), chart);
}

export function calculate(bars: Bar[], _inputs: Partial<TrendHeatmapInputs> = {}): IndicatorResult {
  return fullResult(createRun(_inputs).update(bars));
}

export const TrendHeatmap = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
