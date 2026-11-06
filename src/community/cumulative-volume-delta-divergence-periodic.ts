/**
 * Cumulative Volume Delta Divergence [TradingFinder] Periodic EMA
 *
 * Volume delta of a bar: the volume split by the position of the close in the bar range, buying = volume x
 * (close - low) / (high - low), selling = volume x (high - close) / (high - low), delta = buying - selling. The
 * oscillator is the sum of the delta over "CVD Period" bars ("Periodic") or its EMA ("EMA"), drawn as columns (green
 * above zero, red below).
 *
 * Divergences use fractals: a pivot high (n bars on each side) whose close is above the 50-bar EMA of the current
 * bar, or a pivot low whose close is below it.
 * - Bearish (-RD): the two latest high fractals are less than 30 bars apart, the latest is less than 30 bars old, the
 *   oscillator is positive on both, the price high is higher and the oscillator is lower.
 * - Bullish (+RD): the mirror on the low fractals with a negative oscillator.
 * While a divergence holds, every bar draws a line between the two fractals and a label on the latest one, on the
 * oscillator and on the price chart (so the same line is drawn several times). At most 500 lines and 500 labels are
 * kept.
 *
 * "Ultra Data" (off by default) adds the volume of the same ticker on 26 other exchanges, which are other symbols:
 * the chart bars do not have that data and the port throws an Error when it is switched on.
 *
 * Reference: "Cumulative Volume Delta Divergence [TradingFinder] Periodic EMA" by TradingFinder
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © TFlab
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LabelData, LineDrawingData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, PivotStep, WindowSum, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CumulativeVolumeDeltaDivergencePeriodicInputs {
  /** Bars on each side of a fractal */
  n: number;
  period: number;
  cumMode: 'Periodic' | 'EMA';
  /** Add the volume of other exchanges (not available: throws when true) */
  ultraData: boolean;
  market: 'Forex' | 'Crypto' | 'Stock';
  showLabel: 'Yes' | 'No';
}

export const defaultInputs: CumulativeVolumeDeltaDivergencePeriodicInputs = {
  n: 2,
  period: 21,
  cumMode: 'Periodic',
  ultraData: false,
  market: 'Forex',
  showLabel: 'Yes',
};

export const inputConfig: InputConfig[] = [
  { id: 'n', type: 'int', title: 'Divergence Fractal Periods', defval: 2, min: 1, group: 'Logic Setting' },
  { id: 'period', type: 'int', title: 'CVD Period', defval: 21, group: 'Logic Setting' },
  { id: 'cumMode', type: 'string', title: 'Cumulative Mode', defval: 'Periodic', options: ['Periodic', 'EMA'], group: 'Logic Setting' },
  { id: 'ultraData', type: 'bool', title: '', defval: false, inline: 'Data', group: 'Logic Setting' },
  { id: 'market', type: 'string', title: 'Market Ultra Data', defval: 'Forex', options: ['Forex', 'Crypto', 'Stock'], inline: 'Data', group: 'Logic Setting' },
  { id: 'showLabel', type: 'string', title: 'Show Label', defval: 'Yes', options: ['Yes', 'No'], group: 'display Setting' },
];

const UP = 'rgba(76, 175, 79, 0.5)';
const DOWN = 'rgba(255, 82, 82, 0.5)';
const BULL_LINE = 'rgb(21, 151, 25)';
const BEAR_LINE = 'rgb(212, 44, 44)';
const GREEN = '#4CAF50';
const RED = '#FF5252';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Show Cumulative Vol Delta', color: UP, lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'Cumulative Volume Delta Divergence [TradingFinder] Periodic EMA',
  shortTitle: 'CVD Divergence Oscillator',
  overlay: false,
};

/** indicator(max_labels_count = 500, max_lines_count = 500) */
const MAX_OBJECTS = 500;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = Omit<IndicatorResult, 'labels' | 'lines'> & { labels: LabelData[]; lines: LineDrawingData[] };

interface Ln { x1: number; y1: number; x2: number; y2: number; color: string; overlay: boolean }
interface Lb { x: number; y: number; bull: boolean; overlay: boolean }

/**
 * Live drawings in creation order: when a creation brings the count above max + 5, the oldest are deleted until max
 * remain. An object held by a `var` variable of the script (the latest line and label of each of the four kinds) is
 * never deleted by this limit, but it counts.
 */
function newObject<T extends object>(list: T[], held: Set<object>, l: T): T {
  list.push(l);
  if (list.length > MAX_OBJECTS + 5) {
    for (let k = 0; k < list.length && list.length > MAX_OBJECTS; ) {
      if (held.has(list[k])) k++;
      else list.splice(k, 1);
    }
  }
  return l;
}

/** `variable := object`: the variable holds the new object and releases the one before */
function hold<T extends object>(held: Set<object>, before: T | null, now: T): T {
  if (before) held.delete(before);
  held.add(now);
  return now;
}

/** hist of bar k (na before the first bar, for an infinite value, or for no bar) */
const histAt = (hist: number[], k: number) => (!isNaN(k) && k >= 0 && Number.isFinite(hist[k]) ? hist[k] : NaN);

interface CvdVars {
  /** Live drawings in creation order (the objects are not changed once created) */
  lines: Ln[];
  labels: Lb[];
  /** The objects held by a `var` variable of the script */
  held: Set<object>;
  buLine: Ln | null;
  buLineOnChart: Ln | null;
  beLine: Ln | null;
  beLineOnChart: Ln | null;
  buLabel: Lb | null;
  buLabelOnChart: Lb | null;
  beLabel: Lb | null;
  beLabelOnChart: Lb | null;
  /** Bar of the latest fractal and of the one before (ta.valuewhen(fractal, x[n], 0 / 1) reads x on these bars) */
  highLast: number;
  highPer: number;
  lowLast: number;
  lowPer: number;
}

interface CvdRun extends BarRunState<CvdVars> {
  sum: WindowSum | null;
  histEma: ReturnType<typeof taStep.ema> | null;
  ema: ReturnType<typeof taStep.ema>;
  upPivot: PivotStep;
  downPivot: PivotStep;
  hist: number[];
  plot0: Array<{ time: number; value: number; color: string }>;
}

function study(inputs: Partial<CumulativeVolumeDeltaDivergencePeriodicInputs>): BarStudy<CvdRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const n = Math.trunc(cfg.n);
  /** A number used as a condition: na and 0 are false */
  const truthy = (v: number) => !isNaN(v) && v !== 0;
  const withLabels = cfg.showLabel === 'Yes';
  return {
    init() {
      if (cfg.ultraData) {
        throw new Error('Cumulative Volume Delta Divergence: "Ultra Data" needs the volume of the same ticker on other exchanges (other symbols), which the chart bars do not have');
      }
      const s: CvdRun = {
        sum: cfg.cumMode === 'Periodic' ? new WindowSum(cfg.period) : null,
        histEma: cfg.cumMode === 'EMA' ? taStep.ema(cfg.period) : null,
        ema: taStep.ema(50), upPivot: new PivotStep(n, n, true), downPivot: new PivotStep(n, n, false),
        hist: [], plot0: [],
        steps: [],
        vars: {
          lines: [], labels: [], held: new Set(), buLine: null, buLineOnChart: null, beLine: null, beLineOnChart: null,
          buLabel: null, buLabelOnChart: null, beLabel: null, beLabelOnChart: null,
          highLast: NaN, highPer: NaN, lowLast: NaN, lowPer: NaN,
        },
        lists: [], series: [],
      };
      for (const m of [s.sum, s.histEma, s.ema, s.upPivot, s.downPivot]) if (m) s.steps.push(m);
      s.series = [s.hist, s.plot0];
      return s;
    },
    copyVars: (v) => ({ ...v, lines: v.lines.slice(), labels: v.labels.slice(), held: new Set(v.held) }),
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      // delta = Buying - Selling; a bar without range gives 0 / 0 (na)
      const volume = b.volume ?? NaN;
      const buying = volume * ((b.close - b.low) / (b.high - b.low));
      const selling = volume * ((b.high - b.close) / (b.high - b.low));
      const delta = buying - selling;
      const hist = s.sum ? s.sum.step(delta) : s.histEma ? s.histEma.step(delta) : NaN;
      s.hist[i] = hist;

      const ema = s.ema.step(b.close);
      const upPivot = s.upPivot.step(i, b.high);
      const downPivot = s.downPivot.step(i, b.low);

      const closeN = i >= n ? bars[i - n].close : NaN;
      const upFractal = truthy(upPivot) && gt(closeN, ema);
      const downFractal = truthy(downPivot) && lt(closeN, ema);
      if (upFractal) {
        v.highPer = v.highLast;
        v.highLast = i - n;
      }
      if (downFractal) {
        v.lowPer = v.lowLast;
        v.lowLast = i - n;
      }
      const { highLast, highPer, lowLast, lowPer } = v;

      // Bearish divergence
      const highLastHist = histAt(s.hist, highLast);
      const highPerHist = histAt(s.hist, highPer);
      const bearish = gt(highLastHist, 0) && gt(highPerHist, 0) && gt(highLast + 30, i) && lt(highLast - highPer, 30)
        ? gt(bars[highLast].high, bars[highPer].high) && lt(highLastHist, highPerHist)
        : false;
      // Bullish divergence
      const lowLastHist = histAt(s.hist, lowLast);
      const lowPerHist = histAt(s.hist, lowPer);
      const bullish = lt(lowLastHist, 0) && lt(lowPerHist, 0) && gt(lowLast + 30, i) && lt(lowLast - lowPer, 30)
        ? lt(bars[lowLast].low, bars[lowPer].low) && gt(lowLastHist, lowPerHist)
        : false;

      // Drawing()
      if (bullish) {
        v.buLine = hold(v.held, v.buLine, newObject(v.lines, v.held, { x1: lowPer, y1: lowPerHist, x2: lowLast, y2: lowLastHist, color: BULL_LINE, overlay: false }));
        if (withLabels) v.buLabel = hold(v.held, v.buLabel, newObject(v.labels, v.held, { x: lowLast, y: lowLastHist, bull: true, overlay: false }));
        v.buLineOnChart = hold(v.held, v.buLineOnChart, newObject(v.lines, v.held, {
          x1: lowPer, y1: bars[lowPer].low, x2: lowLast, y2: bars[lowLast].low, color: BULL_LINE, overlay: true,
        }));
        if (withLabels) v.buLabelOnChart = hold(v.held, v.buLabelOnChart, newObject(v.labels, v.held, { x: lowLast, y: bars[lowLast].low, bull: true, overlay: true }));
      }
      if (bearish) {
        v.beLine = hold(v.held, v.beLine, newObject(v.lines, v.held, { x1: highPer, y1: highPerHist, x2: highLast, y2: highLastHist, color: BEAR_LINE, overlay: false }));
        if (withLabels) v.beLabel = hold(v.held, v.beLabel, newObject(v.labels, v.held, { x: highLast, y: highLastHist, bull: false, overlay: false }));
        v.beLineOnChart = hold(v.held, v.beLineOnChart, newObject(v.lines, v.held, {
          x1: highPer, y1: bars[highPer].high, x2: highLast, y2: bars[highLast].high, color: BEAR_LINE, overlay: true,
        }));
        if (withLabels) v.beLabelOnChart = hold(v.held, v.beLabelOnChart, newObject(v.labels, v.held, { x: highLast, y: bars[highLast].high, bull: false, overlay: true }));
      }

      const value = histAt(s.hist, i);
      // no colour (na) when the value is 0 or na
      s.plot0[i] = { time: b.time, value, color: gt(value, 0) ? UP : lt(value, 0) ? DOWN : 'transparent' };
    },
    result(s, bars) {
      const T = (index: number) => bars[index].time;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        lines: s.vars.lines.map((l) => ({
          time1: T(l.x1), price1: l.y1, time2: T(l.x2), price2: l.y2, color: l.color, width: 2,
          ...(l.overlay ? { forceOverlay: true } : {}),
        })),
        labels: s.vars.labels.map((l) => ({
          time: T(l.x), price: l.y, text: l.bull ? '+RD' : '-RD', color: l.bull ? GREEN : RED, textColor: '#FFFFFF',
          size: 'tiny' as const, style: l.bull ? 'label_up' as const : 'label_down' as const,
          ...(l.overlay ? { forceOverlay: true } : {}),
        })),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CumulativeVolumeDeltaDivergencePeriodicInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CumulativeVolumeDeltaDivergencePeriodicInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const CumulativeVolumeDeltaDivergencePeriodic = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
