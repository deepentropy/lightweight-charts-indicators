/**
 * Quartile For Loop
 *
 * Weighted quartile of the source over `Quartile Length` bars: (Q1 + 2 * median + Q3) / 4 with nearest-rank
 * percentiles. The score sums +1 / -1 for i = Loop Start to Loop End: +1 when the source is above the weighted
 * quartile i bars ago (alternate signal: when the current weighted quartile is above it). The trend is long when the
 * score is above the uptrend threshold and short when it is below the downtrend threshold; the score line, an SMA(14)
 * of the close on the price pane and optionally the candles take the trend colour. Labels on the price pane mark the
 * changes to the up / down state of the score (7.5 % below / above the weighted quartile).
 * Alerts (alertcondition, `alerts` of the result): 'Quartile For-Loop Postive Trend' / 'Quartile For-Loop Negative
 * Trend', true on every bar of the long / short signal state.
 *
 * Reference: "Quartile For Loop [SeerQuant]" by SeerQuant
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © SeerQuant
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import {
  barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun,
} from '../live-run';

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Quartile For-Loop Postive Trend', message: 'Quartile For-Loop Bullish Signal on: {{exchange}}:{{ticker}}' },
  { id: 'alert1', title: 'Quartile For-Loop Negative Trend', message: 'Quartile For-Loop Bearish Signal on: {{exchange}}:{{ticker}}' },
];

export type QuartileForLoopColorScheme = 'Default' | 'Modern' | 'Cool' | 'Alternate' | 'Bright';

export interface QuartileForLoopInputs {
  /** Quartile length */
  qLength: number;
  /** Calculation source */
  src: SourceType;
  /** Alternate signal: compare the current weighted quartile (not the source) with its past values */
  typeSig: boolean;
  /** Loop start */
  sl: number;
  /** Loop end */
  el: number;
  /** Threshold uptrend */
  thrUp: number;
  /** Threshold downtrend */
  thrDown: number;
  /** Colour the candles */
  paint: boolean;
  colScheme: QuartileForLoopColorScheme;
}

export const defaultInputs: QuartileForLoopInputs = {
  qLength: 14,
  src: 'close',
  typeSig: false,
  sl: 5,
  el: 55,
  thrUp: 35,
  thrDown: -5,
  paint: false,
  colScheme: 'Default',
};

export const inputConfig: InputConfig[] = [
  { id: 'qLength', type: 'int', title: 'Quartile Length', defval: 14 },
  { id: 'src', type: 'source', title: 'Calculation Source', defval: 'close' },
  { id: 'typeSig', type: 'bool', title: 'Use Alternate Signal?', defval: false },
  { id: 'sl', type: 'int', title: 'Loop Start', defval: 5 },
  { id: 'el', type: 'int', title: 'Loop End', defval: 55 },
  { id: 'thrUp', type: 'float', title: 'Threshold Uptrend', defval: 35 },
  { id: 'thrDown', type: 'float', title: 'Threshold Downtrend', defval: -5 },
  { id: 'paint', type: 'bool', title: 'Colour Candles?', defval: false },
  { id: 'colScheme', type: 'string', title: 'Color Scheme', defval: 'Default', options: ['Default', 'Modern', 'Cool', 'Alternate', 'Bright'] },
];

/** [bull, bear, neutral] per colour scheme */
const SCHEMES: Record<QuartileForLoopColorScheme, [string, string, string]> = {
  Default: ['#00ff73', '#ff0040', '#606060'],
  Modern: ['#23d7e4', '#e11179', '#707070'],
  Cool: ['#00ffcc', '#4e4f75', '#505050'],
  Alternate: ['#00ff80', '#ff6600', '#505050'],
  Bright: ['#e8ec00', '#f200fa', '#505050'],
};

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Score', color: '#606060', lineWidth: 3 },
  { id: 'plot1', title: 'Threshold Uptrend', color: String(color.new('#00ff73', 50)), lineWidth: 2 },
  { id: 'plot2', title: 'Threshold Downtrend', color: String(color.new('#ff0040', 50)), lineWidth: 2 },
  // Pine force_overlay = true: the SMA is drawn on the price pane
  { id: 'plot3', title: 'SMA', color: '#606060', lineWidth: 4, forceOverlay: true },
];

export const metadata = {
  title: 'Quartile For Loop [SeerQuant]',
  shortTitle: 'QFL [SeerQuant]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;

/**
 * The sorted window of `ta.percentile_nearest_rank` (the oakscriptjs rules: each bar inserts the new value before the
 * first value `>=` it, then removes the value of the bar leaving the window), read at several ranks, one bar at a
 * time: the step reads the window with the new value without changing it, the commit changes it.
 */
class NearestRanks {
  private values: number[] = [];
  private barIds: number[] = [];
  private bar = 0;
  private pending = NaN;
  private stepped = false;
  private readonly ranks: number[];
  readonly out: number[];

  constructor(private readonly length: number, percentages: number[]) {
    if (Math.trunc(length) <= 0) {
      throw new Error(`Invalid value of the 'length' argument (${Math.trunc(length).toFixed(1)}) in the 'percentile_nearest_rank' function. It must be > 0.`);
    }
    this.ranks = percentages.map((p) => Math.min(length, Math.max(1, Math.ceil((p / 100) * length))));
    this.out = percentages.map(() => NaN);
  }

  /** The percentiles of the window with `v` (in `out`) */
  step(v: number): number[] {
    this.stepped = true;
    this.pending = v;
    const i = this.bar;
    const values = this.values;
    if (i < this.length - 1) {
      this.out.fill(NaN);
      return this.out;
    }
    let k = 0;
    while (k < values.length && !(values[k]! >= v)) k++;
    // the position of the leaving value in the window with `v` (-1: none)
    let removed = -1;
    if (i >= this.length) {
      const p = this.barIds.indexOf(i - this.length);
      removed = p < 0 ? -1 : p < k ? p : p + 1;
    }
    const inserted = (m: number) => (m < k ? values[m]! : m === k ? v : values[m - 1]!);
    for (let r = 0; r < this.ranks.length; r++) {
      const j = this.ranks[r]! - 1;
      this.out[r] = removed >= 0 && j >= removed ? inserted(j + 1) : inserted(j);
    }
    return this.out;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    const i = this.bar++;
    const v = this.pending;
    const values = this.values;
    let k = 0;
    while (k < values.length && !(values[k]! >= v)) k++;
    values.splice(k, 0, v);
    this.barIds.splice(k, 0, i);
    if (i >= this.length) {
      const old = this.barIds.indexOf(i - this.length);
      values.splice(old, 1);
      this.barIds.splice(old, 1);
    }
  }
}

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface QuartileVars {
  /** var signal = 0 */
  signal: number;
  /** var int prevTrendState = 0 */
  prevTrendState: number;
}

interface QuartileRun extends BarRunState<QuartileVars> {
  ranks: NearestRanks;
  sma: WindowSma;
  src: number[];
  aq: number[];
  smaArr: number[];
  plots: Point[][];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
}

function study(inputs: Partial<QuartileForLoopInputs>): BarStudy<QuartileRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const [bull, bear, neutral] = SCHEMES[cfg.colScheme] ?? SCHEMES.Default;
  const upCol = String(color.new(bull, 50));
  const downCol = String(color.new(bear, 50));
  // a negative loop bound reads the quartile of later bars: the score is calculated from the whole set of bars
  const later = Math.min(cfg.sl, cfg.el) < 0;

  /** The score, signal, colours, markers and alerts of bar `b` (`n`: the bar count) */
  const scoreBar = (s: QuartileRun, b: number, bars: Bar[], n: number) => {
    const { aq } = s;
    const v = s.vars;
    // calcScore(sl, el, adaptive_quartile, typeSig): sum of (x > val[i] ? 1 : -1) for i = sl to el
    // (x = src, or the current quartile with the alternate signal; val[i] before bar 0 is na: -1)
    const x = cfg.typeSig ? aq[b] : s.src[b];
    let sum = 0;
    const step = cfg.sl <= cfg.el ? 1 : -1;
    for (let i = cfg.sl; step > 0 ? i <= cfg.el : i >= cfg.el; i += step) {
      const past = b - i >= 0 && b - i < n ? aq[b - i] : NaN;
      sum += gt(x, past) ? 1 : -1;
    }

    const goLong = gt(sum, cfg.thrUp);
    const goShort = lt(sum, cfg.thrDown);
    if (goLong && !goShort) v.signal = 1;
    if (goShort) v.signal = -1;
    const signal = v.signal;
    const histColor = signal === 1 ? bull : signal === -1 ? bear : neutral;

    // currentTrendState: 1 above thrUp, -1 below thrDown, else 0
    const current = gt(sum, cfg.thrUp) ? 1 : lt(sum, cfg.thrDown) ? -1 : 0;
    const bullishTransition = v.prevTrendState !== 1 && current === 1;
    const bearishTransition = v.prevTrendState !== -1 && current === -1;
    if (bullishTransition || bearishTransition) v.prevTrendState = current;

    const t = bars[b].time;
    // plotshape(bullishTransition ? aq - aq * 0.075 : na, shape.labelup, location.absolute, color = bull,
    //   text = "▲", textcolor = #000000, size.small, force_overlay = true)
    const lo = aq[b] - aq[b] * 0.075;
    if (bullishTransition && !isNaN(lo)) {
      s.markers.push({ time: t, position: 'atPriceBottom', price: lo, shape: 'labelUp', color: bull, text: '▲',
        textColor: '#000000', size: 'small', forceOverlay: true });
    }
    // plotshape(bearishTransition ? aq + aq * 0.075 : na, shape.labeldown, ..., color = bear, text = "▼")
    const hi = aq[b] + aq[b] * 0.075;
    if (bearishTransition && !isNaN(hi)) {
      s.markers.push({ time: t, position: 'atPriceTop', price: hi, shape: 'labelDown', color: bear, text: '▼',
        textColor: '#000000', size: 'small', forceOverlay: true });
    }

    // plot(score, color = color.new(hist_color, 0), linewidth = 3)
    s.plots[0][b] = { time: t, value: sum, color: histColor };
    // plot(sma, color = hist_color, linewidth = 4, force_overlay = true)
    s.plots[3][b] = { time: t, value: s.smaArr[b], color: histColor };
    // barcolor(paint ? hist_color : na)
    if (cfg.paint) s.barColors[b] = { time: t, color: histColor };
    // alertcondition(signal == 1) / alertcondition(signal == -1)
    [signal === 1, signal === -1].forEach((f, k) => {
      s.flags[k][b] = f;
      if (f) s.times[k].push(t as number);
    });
  };

  return {
    fullRunReason: () => (!isBarSource(cfg.src) ? 'source of another study' : later ? 'negative loop bound (later bars)' : null),
    init() {
      const s: QuartileRun = {
        ranks: new NearestRanks(cfg.qLength, [25, 50, 75]), sma: new WindowSma(14), src: [], aq: [], smaArr: [],
        plots: Array.from({ length: 4 }, () => []), barColors: [], flags: [[], []], times: [[], []], markers: [],
        steps: [], vars: { signal: 0, prevTrendState: 0 }, lists: [], series: [],
      };
      s.steps = [s.ranks, s.sma];
      s.lists = [s.markers, ...s.times];
      s.series = [s.src, s.aq, s.smaArr, ...s.plots, s.barColors, ...s.flags];
      return s;
    },
    bar(s, b, bars) {
      const bar = bars[b];
      const src = value(bar);
      s.src[b] = src;
      // f_quartile: (Q1 + 2 * median + Q3) / 4 with ta.percentile_nearest_rank
      const [q1, med, q3] = s.ranks.step(src);
      s.aq[b] = (q1 + 2 * med + q3) / 4;
      s.smaArr[b] = s.sma.step(bar.close);
      // plot(thrUp, color = color.new(bull, 50), linewidth = 2); plot(thrDown, color = color.new(bear, 50), linewidth = 2)
      s.plots[1][b] = { time: bar.time, value: cfg.thrUp, color: upCol };
      s.plots[2][b] = { time: bar.time, value: cfg.thrDown, color: downCol };
      if (!later) scoreBar(s, b, bars, b + 1);
    },
    result(s, bars) {
      const n = bars.length;
      if (later) for (let b = 0; b < n; b++) scoreBar(s, b, bars, n);
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice(), plot3: s.plots[3].slice() },
        markers: s.markers.slice(),
        barColors: cfg.paint ? s.barColors.slice() : [],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<QuartileForLoopInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<QuartileForLoopInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const QuartileForLoop = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
