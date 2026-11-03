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
  ta, str, color, math as pmath, getSourceSeries, Series,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type ShapeConfig, type SourceType,
} from 'oakscriptjs';
import type { LabelData, LineDrawingData, MarkerData } from '../types';
import { mintickOf, type ChartContext } from '../chart-context';
import { timeAfterLastBar } from '../anchor-period';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';
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

export function calculate(
  bars: Bar[],
  inputs: Partial<ExtremeTrendReversalPointsInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { alerts: AlertConditionState[]; labels: LabelData[]; lines: LineDrawingData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const { type, length, level, history } = cfg;
  const n = bars.length;
  const srcSeries = getSourceSeries(bars, cfg.source);
  const src = srcSeries.toArray().map((v) => v ?? NaN);
  const maxHistory = length - 1;

  // matrix.new<float>(1, level + 1, source): rows newest first
  let mtx: number[][] = n > 0 ? [new Array(level + 1).fill(src[0])] : [];
  // `var float ma = ta.tr` inside arrayutils.ma: one variable for the call site of the loop; ta.tr of bar 0 is na
  let arrMa = NaN;
  const kEma = 2 / (length + 1);

  const strength = new Array<number>(n).fill(0);
  let lastRow: number[] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [src[i]];
    if (type === 'ema') {
      for (let c = 1; c <= level; c++) row.push(row[c - 1] * kEma + (1 - kEma) * mtx[0][c]);
    } else if (type === 'rma') {
      for (let c = 1; c <= level; c++) row.push((mtx[0][c] * (length - 1) + row[c - 1]) / length);
    } else {
      for (let c = 1; c <= level; c++) {
        const tmp = [row[c - 1], ...mtx.map((r) => r[c - 1])];
        if (tmp.length >= length) {
          const sliced = tmp.slice(0, length);
          arrMa = type === 'sma' ? arrayAvg(sliced) : arrayWma(sliced, length);
        }
        row.push(arrMa);
      }
    }
    // _matrix.unshift(maMatrix, row, maxHistory)
    mtx.unshift(row);
    if (mtx.length > maxHistory) mtx = mtx.slice(0, mtx.length - 1);

    let s = 0;
    for (let a = 0; a <= level; a++) {
      for (let b = a + 1; b <= level; b++) if (gt(row[a], row[b])) s++;
    }
    strength[i] = s;
    lastRow = row;
  }

  const S = new Series(bars, (_, i) => strength[i]);
  const A = (x: Series) => x.toArray().map((v) => v ?? NaN);
  const minRange = A(ta.percentile_nearest_rank(S, history, 50 - cfg.minMaxRangePercentile));
  const maxRange = A(ta.percentile_nearest_rank(S, history, 50 + cfg.minMaxRangePercentile));
  const extremeMinRange = A(ta.percentile_nearest_rank(S, history, 50 - cfg.extremeMinMaxRangePercentile));
  const extremeMaxRange = A(ta.percentile_nearest_rank(S, history, 50 + cfg.extremeMinMaxRangePercentile));
  const maxStrength = (level * (level + 1)) / 2;

  const maSeries = type === 'ema' ? ta.ema(srcSeries, length)
    : type === 'rma' ? ta.rma(srcSeries, length)
      : type === 'wma' ? ta.wma(srcSeries, length) : ta.sma(srcSeries, length);
  const ma = A(maSeries);
  const crossUnder = A(ta.crossunder(srcSeries, maSeries));
  const crossOver = A(ta.crossover(srcSeries, maSeries));

  const bull = bars.map((_, i) => i > 0 && strength[i - 1] === maxStrength && !!crossUnder[i]);
  const bear = bars.map((_, i) => i > 0 && strength[i - 1] === 0 && !!crossOver[i]);

  const pts = (v: number[]) => bars.map((b, i) => ({ time: b.time, value: v[i] }));
  const plot5 = strength.map((s, i) => (s > extremeMaxRange[i] ? 2 : s > maxRange[i] ? 1 : s > minRange[i] ? 0
    : s < extremeMinRange[i] ? -1 : -2));
  const plot6 = bars.map((b, i) => {
    const s = strength[i];
    const c = s > extremeMaxRange[i] ? GREEN : s > maxRange[i] ? LIME : s < extremeMinRange[i] ? RED
      : s < minRange[i] ? ORANGE : SILVER;
    return { time: b.time, value: ma[i], color: c };
  });

  const markers: MarkerData[] = [];
  for (let i = 0; i < n; i++) {
    if (bull[i]) markers.push({ id: 'shape0', time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: RED, size: 'small' });
    if (bear[i]) markers.push({ id: 'shape1', time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: GREEN, size: 'small' });
  }

  // Last bar: drawingutils.draw_labelled_line(value, type + '(' + i + ')', levelColor, levelColor, 0, true, ...):
  // a solid line from bar_index to bar_index + 20 and a text-only label at bar_index + 10
  const lines: LineDrawingData[] = [];
  const labels: LabelData[] = [];
  if (n > 0) {
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

  const lag = cfg.realTimeAlerts ? 0 : 1;
  const shift = (f: boolean[]) => f.map((_, i) => (i >= lag ? f[i - lag] : false));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: pts(strength),
      plot1: pts(minRange),
      plot2: pts(maxRange),
      plot3: pts(extremeMinRange),
      plot4: pts(extremeMaxRange),
      plot5: pts(plot5),
      plot6,
    },
    markers,
    lines,
    labels,
    alerts: alertStates(alertConditions, bars, [shift(bull), shift(bear)]),
  };
}

export const ExtremeTrendReversalPoints = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, shapeConfig, alertConditions, drawingKinds,
};
