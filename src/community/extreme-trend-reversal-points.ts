/**
 * Extreme Trend Reversal Points
 *
 * Builds `level` nested moving averages of the source: level 0 is the source, level k is the moving average of
 * level k - 1 (type sma / ema / rma / wma, `length` bars). The script keeps them in a matrix of the last
 * `length - 1` bars (one row per bar, newest first; the first row, all equal to the first source value, is the seed).
 * "Strength" counts the pairs (i < j) where level i is above level j: 0 to level * (level + 1) / 2. Its rolling
 * nearest-rank percentiles over `history` bars give the ranges that colour the moving average (green / lime above
 * the upper ranges, red / orange below the lower ones, silver between). A bullish trend reversal point (red
 * triangle above the bar) is a source crossing under the moving average just after the strength was at its maximum;
 * a bearish one (green triangle below the bar) is a crossing over it just after the strength was 0. On the last bar
 * a line and a label are drawn at each level value (green to red gradient), 20 bars long.
 *
 * Library functions of the original, ported here: `_matrix.unshift`, `arrayutils.ma` (array moving averages; its
 * `var` result is shared by every call of the loop and starts with the true range of the first bar, na),
 * `enhanced_ta.ma` and `drawingutils.draw_labelled_line` (by HeWhoMustNotBeNamed, MPL 2.0).
 *
 * Reference: "Extreme Trend Reversal Points [HeWhoMustNotBeNamed]" by Trendoscope
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © HeWhoMustNotBeNamed
 */

import {
  taStep, str, color, math as pmath,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type ShapeConfig, type SourceType,
} from 'oakscriptjs';
import type { LabelData, LineDrawingData, MarkerData } from '../types';
import { mintickOf, type ChartContext } from '../chart-context';
import { timeAfterLastBar } from '../anchor-period';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { StudyDrawingKind } from '../style-outputs';

export interface ExtremeTrendReversalPointsInputs {
  /** Moving average source */
  source: SourceType;
  /** Moving average type */
  type: 'sma' | 'ema' | 'rma' | 'wma';
  /** Moving average length */
  length: number;
  /** Number of nested moving averages */
  level: number;
  /** Percentile distance of the min / max range from 50 */
  minMaxRangePercentile: number;
  /** Percentile distance of the extreme min / max range from 50 */
  extremeMinMaxRangePercentile: number;
  /** Bars of the percentile window */
  history: number;
  /** Alerts on the current bar (true) or on the bar after the signal (false) */
  realTimeAlerts: boolean;
}

export const defaultInputs: ExtremeTrendReversalPointsInputs = {
  source: 'close',
  type: 'sma',
  length: 20,
  level: 10,
  minMaxRangePercentile: 20,
  extremeMinMaxRangePercentile: 45,
  history: 1000,
  realTimeAlerts: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'close', group: 'Moving Average' },
  { id: 'type', type: 'string', title: 'Type', defval: 'sma', options: ['sma', 'ema', 'rma', 'wma'], group: 'Moving Average' },
  { id: 'length', type: 'int', title: 'Length', defval: 20, step: 5, group: 'Moving Average' },
  { id: 'level', type: 'int', title: 'Level', defval: 10, min: 5, step: 5, group: 'Moving Average' },
  { id: 'minMaxRangePercentile', type: 'int', title: 'Range Percentile', defval: 20, min: 5, max: 45, step: 5 },
  { id: 'extremeMinMaxRangePercentile', type: 'int', title: 'Extreme Range Percentile', defval: 45, min: 40, max: 48, step: 2 },
  { id: 'history', type: 'int', title: 'Percentile History', defval: 1000, min: 1000, max: 5000, step: 500 },
  {
    id: 'realTimeAlerts', type: 'bool', title: 'Real Time Alerts', defval: false,
    tooltip: 'If set to true, alerts are fired on latest candle - which may repaint. For safer option set this to false',
  },
];

// Pine v5 colour constants
const GREEN = '#4CAF50';
const LIME = '#00E676';
const RED = '#FF5252';
const ORANGE = '#FF9800';
const SILVER = '#B2B5BE';
const BLUE = '#2962ff';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Strength', color: SILVER, lineWidth: 1, display: 'data_window' },
  { id: 'plot1', title: 'Min Range', color: ORANGE, lineWidth: 1, display: 'data_window' },
  { id: 'plot2', title: 'Max Range', color: LIME, lineWidth: 1, display: 'data_window' },
  { id: 'plot3', title: 'Extreme Min Range', color: RED, lineWidth: 1, display: 'data_window' },
  { id: 'plot4', title: 'Extreme Max Range', color: GREEN, lineWidth: 1, display: 'data_window' },
  { id: 'plot5', title: 'Strength Range', color: BLUE, lineWidth: 1, display: 'data_window' },
  { id: 'plot6', title: 'Moving Average', color: BLUE, lineWidth: 1 },
];

export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Bullish Trend Reversal Point', style: 'triangledown', location: 'abovebar', color: RED, size: 'small' },
  { id: 'shape1', kind: 'shape', title: 'Bearish Trend Reversal Point', style: 'triangleup', location: 'belowbar', color: GREEN, size: 'small' },
];

export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Trend Reversal', message: 'Possible reversal of bullish trend' },
  { id: 'alert1', title: 'Bearish Trend Reversal', message: 'Possible reversal of bearish trend' },
];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label'];

export const metadata = {
  title: 'Extreme Trend Reversal Points [HeWhoMustNotBeNamed]',
  shortTitle: 'ETRP[HWMNBN]',
  overlay: true,
};

/** Pine float comparison: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;

/** arrayutils.wma: weighted average of the first `length` elements (an na element gives na) */
function arrayWma(src: number[], length: number): number {
  let masum = 0;
  for (let i = 0; i <= length - 1; i++) masum += src[i] * (length - i);
  return masum / ((length * (length + 1)) / 2);
}

/** array.avg: mean of the non-na elements (na when there are none) */
function arrayAvg(src: number[]): number {
  let s = 0;
  let c = 0;
  for (const v of src) {
    if (!Number.isNaN(v)) {
      s += v;
      c++;
    }
  }
  return c > 0 ? s / c : NaN;
}

/**
 * ta.percentile_nearest_rank(source, length, percentage) for several percentages of one source, one bar at a time,
 * with the operations of the oakscriptjs array function (same values): a sorted window of the last `length` values
 * (a new value goes before the first value not below it), na before bar `length - 1`.
 */
class NearestRankStep {
  private values: number[] = [];
  private bars: number[] = [];
  private pending: { values: number[]; bars: number[] } | null = null;
  private readonly ranks: number[];

  constructor(private readonly length: number, percentages: number[]) {
    this.ranks = percentages.map((p) => Math.min(length, Math.max(1, Math.ceil((p / 100) * length))));
  }

  /** The percentiles on bar `i` (one per percentage) */
  step(i: number, v: number): number[] {
    const values = this.values.slice();
    const bars = this.bars.slice();
    let k = 0;
    while (k < values.length && !(values[k] >= v)) k++;
    values.splice(k, 0, v);
    bars.splice(k, 0, i);
    if (i >= this.length) {
      const old = bars.indexOf(i - this.length);
      values.splice(old, 1);
      bars.splice(old, 1);
    }
    this.pending = { values, bars };
    return this.ranks.map((rank) => (i < this.length - 1 ? NaN : values[rank - 1]));
  }

  commit(): void {
    if (!this.pending) return;
    this.values = this.pending.values;
    this.bars = this.pending.bars;
    this.pending = null;
  }
}

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { alerts: AlertConditionState[]; labels: LabelData[]; lines: LineDrawingData[] };
type MaStep = { step(v: number): number; commit(): void };

interface EtrpVars {
  /** matrix.new<float>(1, level + 1, source): rows newest first (replaced on each bar, rows never changed) */
  mtx: readonly (readonly number[])[];
  /** `var float ma = ta.tr` inside arrayutils.ma: one variable for the call site of the loop; ta.tr of bar 0 is na */
  arrMa: number;
  /** The row of the bar */
  lastRow: readonly number[];
}

interface EtrpRun extends BarRunState<EtrpVars> {
  ranks: NearestRankStep;
  ma: MaStep;
  crossUnder: ReturnType<typeof taStep.crossunder>;
  crossOver: ReturnType<typeof taStep.crossover>;
  strength: number[];
  bull: boolean[];
  bear: boolean[];
  plots: Point[][];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<ExtremeTrendReversalPointsInputs>): BarStudy<EtrpRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { type, length, level, history } = cfg;
  const value = barSource(cfg.source);
  const maxHistory = length - 1;
  const kEma = 2 / (length + 1);
  const maxStrength = (level * (level + 1)) / 2;
  const lag = cfg.realTimeAlerts ? 0 : 1;
  const maStep = (): MaStep => {
    if (type === 'ema') return taStep.ema(length);
    if (type === 'rma') return taStep.rma(length);
    const m = type === 'wma' ? taStep.wma() : taStep.sma();
    return { step: (v) => m.step(v, length), commit: () => m.commit() };
  };
  return {
    fullRunReason: () => (isBarSource(cfg.source) ? null : 'source of another study'),
    init() {
      const s: EtrpRun = {
        ranks: new NearestRankStep(history, [
          50 - cfg.minMaxRangePercentile, 50 + cfg.minMaxRangePercentile,
          50 - cfg.extremeMinMaxRangePercentile, 50 + cfg.extremeMinMaxRangePercentile,
        ]),
        ma: maStep(), crossUnder: taStep.crossunder(), crossOver: taStep.crossover(),
        strength: [], bull: [], bear: [], plots: Array.from({ length: 7 }, () => []), markers: [],
        flags: [[], []], times: [[], []],
        steps: [], vars: { mtx: [], arrMa: NaN, lastRow: [] }, lists: [], series: [],
      };
      s.steps = [s.ranks, s.ma, s.crossUnder, s.crossOver];
      s.lists = [s.markers, ...s.times];
      s.series = [s.strength, s.bull, s.bear, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const time = bars[i].time;
      const src = value(bars[i]) ?? NaN;
      // matrix.new<float>(1, level + 1, source) on the first bar
      if (i === 0) v.mtx = [new Array(level + 1).fill(src)];
      const mtx = v.mtx;
      const row: number[] = [src];
      if (type === 'ema') {
        for (let c = 1; c <= level; c++) row.push(row[c - 1] * kEma + (1 - kEma) * mtx[0][c]);
      } else if (type === 'rma') {
        for (let c = 1; c <= level; c++) row.push((mtx[0][c] * (length - 1) + row[c - 1]) / length);
      } else {
        for (let c = 1; c <= level; c++) {
          const tmp = [row[c - 1], ...mtx.map((r) => r[c - 1])];
          if (tmp.length >= length) {
            const sliced = tmp.slice(0, length);
            v.arrMa = type === 'sma' ? arrayAvg(sliced) : arrayWma(sliced, length);
          }
          row.push(v.arrMa);
        }
      }
      // _matrix.unshift(maMatrix, row, maxHistory)
      let next = [row, ...mtx];
      if (next.length > maxHistory) next = next.slice(0, next.length - 1);
      v.mtx = next;
      v.lastRow = row;

      let st = 0;
      for (let a = 0; a <= level; a++) {
        for (let b = a + 1; b <= level; b++) if (gt(row[a], row[b])) st++;
      }
      s.strength[i] = st;
      const [minRange, maxRange, extremeMinRange, extremeMaxRange] = s.ranks.step(i, st).map((x) => x ?? NaN);

      const ma = s.ma.step(src) ?? NaN;
      const crossUnder = s.crossUnder.step(src, ma);
      const crossOver = s.crossOver.step(src, ma);
      const bull = i > 0 && s.strength[i - 1] === maxStrength && !!crossUnder;
      const bear = i > 0 && s.strength[i - 1] === 0 && !!crossOver;
      s.bull[i] = bull;
      s.bear[i] = bear;

      const p = s.plots;
      p[0][i] = { time, value: st };
      p[1][i] = { time, value: minRange };
      p[2][i] = { time, value: maxRange };
      p[3][i] = { time, value: extremeMinRange };
      p[4][i] = { time, value: extremeMaxRange };
      p[5][i] = {
        time,
        value: st > extremeMaxRange ? 2 : st > maxRange ? 1 : st > minRange ? 0 : st < extremeMinRange ? -1 : -2,
      };
      const c = st > extremeMaxRange ? GREEN : st > maxRange ? LIME : st < extremeMinRange ? RED
        : st < minRange ? ORANGE : SILVER;
      p[6][i] = { time, value: ma, color: c };

      if (bull) s.markers.push({ id: 'shape0', time, position: 'aboveBar', shape: 'triangleDown', color: RED, size: 'small' });
      if (bear) s.markers.push({ id: 'shape1', time, position: 'belowBar', shape: 'triangleUp', color: GREEN, size: 'small' });

      // the alerts on the bar of the signal (real time) or on the bar after it
      [s.bull, s.bear].forEach((f, k) => {
        const on = i >= lag ? f[i - lag] : false;
        s.flags[k][i] = on;
        if (on) s.times[k].push(time as number);
      });
    },
    result(s, bars, chart) {
      const n = bars.length;
      // Last bar: drawingutils.draw_labelled_line(value, type + '(' + i + ')', levelColor, levelColor, 0, true, ...):
      // a solid line from bar_index to bar_index + 20 and a text-only label at bar_index + 10
      const lines: LineDrawingData[] = [];
      const labels: LabelData[] = [];
      if (n > 0) {
        const lastRow = s.vars.lastRow;
        const tick = mintickOf(chart);
        const t0 = bars[n - 1].time;
        const t10 = timeAfterLastBar(bars, 10, chart);
        const t20 = timeAfterLastBar(bars, 20, chart);
        for (let k = 1; k <= level; k++) {
          const levelColor = color.from_gradient(k, 1, level, GREEN, RED);
          const y = lastRow[k];
          lines.push({ time1: t0, price1: y, time2: t20, price2: y, color: levelColor, style: 'solid' });
          labels.push({
            time: t10, price: y, text: `${type}(${k})\n${str.tostring(pmath.round_to_mintick(y, tick))}`,
            style: 'none', textColor: levelColor, size: 'normal', color: String(color.new(levelColor, 100)),
          });
        }
      }
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(),
          plot1: p[1].slice(),
          plot2: p[2].slice(),
          plot3: p[3].slice(),
          plot4: p[4].slice(),
          plot5: p[5].slice(),
          plot6: p[6].slice(),
        },
        markers: s.markers.slice(),
        lines,
        labels,
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ExtremeTrendReversalPointsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<ExtremeTrendReversalPointsInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { alerts: AlertConditionState[]; labels: LabelData[]; lines: LineDrawingData[] } {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const ExtremeTrendReversalPoints = {
  calculate, createRun, metadata,
 defaultInputs, inputConfig, plotConfig, shapeConfig, alertConditions, drawingKinds,
};
