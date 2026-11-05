/**
 * Relative ATR Volatility
 *
 * The ATR is compared with its own distribution over a rolling window: the bottom, top and 50 % percentiles
 * (nearest rank) of the ATR over the window are the thresholds. Where the ATR is at or above the top threshold, the
 * area between the ATR and the top threshold is filled red; at or below the bottom threshold, the area between the
 * ATR and the bottom threshold is filled green. The fill is more opaque the further the ATR is from the threshold
 * (relative distance, capped at 100 %). The ratios of the ATR to each threshold are shown in the status line.
 *
 * Reference: "Relative ATR Volatility" by ZenAndTheArtOfTrading
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © ZenAndTheArtOfTrading
 */

import { taCore, taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RelativeAtrVolatilityInputs {
  atrLength: number;
  /** Rolling window of the percentiles */
  windowLength: number;
  /** Top percentile */
  topPercent: number;
  /** Bottom percentile */
  bottomPercent: number;
}

export const defaultInputs: RelativeAtrVolatilityInputs = {
  atrLength: 14,
  windowLength: 100,
  topPercent: 80,
  bottomPercent: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14 },
  { id: 'windowLength', type: 'int', title: 'Rolling Window Length', defval: 100 },
  { id: 'topPercent', type: 'float', title: 'Top Percentile', defval: 80 },
  { id: 'bottomPercent', type: 'float', title: 'Bottom Percentile', defval: 20 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ATR', color: color.white, lineWidth: 1 },
  { id: 'plot1', title: 'Bottom X% Threshold', color: color.green, lineWidth: 1, display: 'pane' },
  { id: 'plot2', title: 'Top X% Threshold', color: color.red, lineWidth: 1, display: 'pane' },
  { id: 'plot3', title: 'Median ATR', color: color.gray, lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'Top ATR Fill', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Bottom ATR Fill', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot6', title: 'ATR Ratio (vs Upper Band)', color: color.red, lineWidth: 1, display: 'status_line' },
  { id: 'plot7', title: 'ATR Ratio (vs Lower Band)', color: color.green, lineWidth: 1, display: 'status_line' },
];

export const metadata = {
  title: 'Relative ATR Volatility',
  shortTitle: 'Relative ATR Volatility',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a >= b when b - a <= 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

/**
 * The sorted window of `ta.percentile_nearest_rank(source, length, p)` stepped bar by bar, with the rules of the
 * oakscriptjs array function: every value is kept (na values too, after the values they do not compare with), a new
 * value goes before the first value that is >= it, the value of bar i - length leaves the window, the result is the
 * value of rank `rank` (na before bar length - 1). One window serves several percentages.
 */
class SortedWindow {
  private readonly values: number[] = [];
  private readonly bars: number[] = [];
  private count = 0;
  /** The step of the current bar: its value, its insertion index, the post-insertion index of the value that leaves */
  private v = NaN;
  private k = 0;
  private out = -1;
  private stepped = false;

  constructor(private readonly length: number) {}

  step(v: number): void {
    const values = this.values;
    let k = 0;
    while (k < values.length && !(values[k] >= v)) k++;
    this.v = v;
    this.k = k;
    const i = this.count;
    if (i >= this.length) {
      const o = this.bars.indexOf(i - this.length);
      this.out = o < k ? o : o + 1;
    } else {
      this.out = -1;
    }
    this.stepped = true;
  }

  /** The value of rank `rank` (1-based) of the window with the value of the current bar */
  at(rank: number): number {
    if (this.count < this.length - 1) return NaN;
    const r = rank - 1;
    // the index in the window with the new value, before the removal
    const p = this.out >= 0 && r >= this.out ? r + 1 : r;
    if (p < this.k) return this.values[p]!;
    if (p === this.k) return this.v;
    return this.values[p - 1]!;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    const i = this.count;
    this.values.splice(this.k, 0, this.v);
    this.bars.splice(this.k, 0, i);
    if (this.out >= 0) {
      this.values.splice(this.out, 1);
      this.bars.splice(this.out, 1);
    }
    this.count++;
  }
}

type Point = { time: number; value: number; color?: string };

interface RatrRun extends BarRunState<Record<string, never>> {
  atr: ReturnType<typeof taStep.atr>;
  window: SortedWindow;
  plots: Point[][];
  topColors: string[];
  bottomColors: string[];
}

function study(inputs: Partial<RelativeAtrVolatilityInputs>): BarStudy<RatrRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const length = cfg.windowLength;
  const rankOf = (percentage: number) => Math.min(length, Math.max(1, Math.ceil((percentage / 100) * length)));
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      // the length check of ta.percentile_nearest_rank
      taCore.percentile_nearest_rank([], length, 50);
      const atr = taStep.atr(cfg.atrLength);
      const window = new SortedWindow(length);
      const s: RatrRun = {
        atr, window, plots: Array.from({ length: 8 }, () => []), topColors: [], bottomColors: [],
        steps: [atr, window], vars: {}, lists: [], series: [],
      };
      s.series = [...s.plots, s.topColors, s.bottomColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const atr = s.atr.step(b.high, b.low, b.close);
      s.window.step(atr);
      const bottom = s.window.at(rankOf(cfg.bottomPercent));
      const top = s.window.at(rankOf(cfg.topPercent));
      const center = s.window.at(rankOf(50));

      const isTop = ge(atr, top);
      const isBottom = le(atr, bottom);
      let topGradient = 0;
      let bottomGradient = 0;
      if (isTop && gt(top, 0)) topGradient = (atr - top) / top;
      if (isBottom && gt(bottom, 0)) bottomGradient = (bottom - atr) / bottom;
      topGradient = Math.min(topGradient, 1.0);
      bottomGradient = Math.min(bottomGradient, 1.0);
      // 90 - int(gradient * 80)
      s.topColors[i] = String(color.new(color.red, 90 - Math.trunc(topGradient * 80)));
      s.bottomColors[i] = String(color.new(color.green, 90 - Math.trunc(bottomGradient * 80)));

      const p = s.plots;
      p[0][i] = { time, value: fin(atr), color: color.white };
      p[1][i] = { time, value: fin(bottom), color: color.green };
      p[2][i] = { time, value: fin(top), color: color.red };
      p[3][i] = { time, value: fin(center), color: color.gray };
      // isTopX ? atrValue : na / isBottomX ? atrValue : na
      p[4][i] = { time, value: fin(isTop ? atr : NaN) };
      p[5][i] = { time, value: fin(isBottom ? atr : NaN) };
      // a plain division (x / 0 is +-infinity, shown as na)
      p[6][i] = { time, value: fin(atr / top), color: color.red };
      p[7][i] = { time, value: fin(atr / bottom), color: color.green };
    },
    result(s) {
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((pl, k) => { plots[`plot${k}`] = pl.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills: [
          // fill(topAtrFillPlot, topPlot, color.new(color.red, topTransparency))
          { plot1: 'plot4', plot2: 'plot2', colors: s.topColors.slice() },
          // fill(bottomAtrFillPlot, bottomPlot, color.new(color.green, bottomTransparency))
          { plot1: 'plot5', plot2: 'plot1', colors: s.bottomColors.slice() },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RelativeAtrVolatilityInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RelativeAtrVolatilityInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const RelativeAtrVolatility = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  createRun,
};
