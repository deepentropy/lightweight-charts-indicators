/**
 * CM Pivot Points M-W-D-4H-1H Filtered
 *
 * Classic pivot levels of the previous 1 hour, 4 hour, daily, weekly, monthly and yearly bar of the same symbol:
 * pivot = (high + low + close) / 3, R1 / S1, R2 / S2 = pivot +- (high - low), R3 / S3 (1 hour and 4 hour only) and
 * the 3-bar average of the pivot. With "Show Filtered Pivots" only the pivot, R1 and S1 are drawn, and R1 / S1
 * depend on the move of the pivot: when the pivot rises more than 0.0025 above the mean of the last two pivots, R1
 * is pivot + range; when it falls more than 0.0025 below, S1 is pivot - range.
 *
 * As in the original, the "4 Hour S3" plot follows the weekly switch (not the 4 hour switch).
 *
 * The bars of each timeframe are built from the chart bars (periods from the UTC calendar and the bars, see
 * src/anchor-period.ts): the levels of a period need the full previous bar of that timeframe in the chart bars (3
 * bars for the pivot average). As in the original (a version 1 script), every chart bar of a period shows the
 * levels of that period. A timeframe below the chart timeframe needs data that the bars do not carry: the port
 * throws an Error when such a timeframe is switched on.
 *
 * Reference: "CM_Pivot Points_M-W-D-4H-1H_Filtered" by ChrisMoody
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, timeframe, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { periodStarts, chartTimeframe } from '../anchor-period';

export interface CmPivotPointsFilteredInputs {
  /** Show Filtered Pivots */
  pf: boolean;
  /** Show Pivot Average */
  sa: boolean;
  /** Show 1 Hour Pivots */
  sh: boolean;
  /** Show 4 Hour Pivots */
  sf: boolean;
  /** Show Daily Pivots */
  sd: boolean;
  /** Show Weekly Pivots */
  sw: boolean;
  /** Show Monthly Pivots */
  sm: boolean;
  /** Show Yearly Pivots */
  sy: boolean;
  /** Show R3 & S3 (1 hour and 4 hour only) */
  sh3: boolean;
}

export const defaultInputs: CmPivotPointsFilteredInputs = {
  pf: true,
  sa: true,
  sh: false,
  sf: false,
  sd: false,
  sw: false,
  sm: true,
  sy: false,
  sh3: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'pf', type: 'bool', title: 'Show Filtered Pivots', defval: true },
  { id: 'sa', type: 'bool', title: 'Show Pivot Average', defval: true },
  { id: 'sh', type: 'bool', title: 'Show 1 Hour Pivots?', defval: false },
  { id: 'sf', type: 'bool', title: 'Show 4 Hour Pivots?', defval: false },
  { id: 'sd', type: 'bool', title: 'Show Daily Pivots?', defval: false },
  { id: 'sw', type: 'bool', title: 'Show Weekly Pivots?', defval: false },
  { id: 'sm', type: 'bool', title: 'Show Monthly Pivots?', defval: true },
  { id: 'sy', type: 'bool', title: 'Show Yearly Pivots?', defval: false },
  { id: 'sh3', type: 'bool', title: 'Show R3 & S3 Only On 1 Hour & 4 Hour?', defval: false },
];

// Colour constants of Pine version 1, with the default plot transparency of that version (35)
const V1 = (hex: string) => String(color.new(hex, 35));
const ORANGE = V1('#FF7F00');
const FUCHSIA = V1('#FF00FF');
const CRIMSON = V1('#DC143C');
const LIME = V1('#00FF00');
const MAROON = V1('#800000');
const FOREST = V1('#228B22');
const SALMON = V1('#FA8072');
const INDIAN_RED = V1('#CD5C5C');

type Level = 'avg' | 'pivot' | 'r1' | 's1' | 'r2' | 's2' | 'r3' | 's3';
type Switch = 'sh' | 'sf' | 'sd' | 'sw' | 'sm' | 'sy';
interface Spec {
  title: string;
  tf: string;
  level: Level;
  /** Input that shows the plot */
  on: Switch;
  color: string;
  width: number;
  style: 'cross' | 'circles';
}

/** The plots of one timeframe, in the order of the original */
function group(
  name: string, tf: string, on: Switch, widths: [number, number], levels: Level[],
  opt: { style?: 'cross' | 'circles'; r1Color?: string; s3On?: Switch } = {},
): Spec[] {
  const titles: Record<Level, string> = {
    avg: 'Pivot Average', pivot: 'Pivot', r1: 'R1', s1: 'S1', r2: 'R2', s2: 'S2', r3: 'R3', s3: 'S3',
  };
  const colors: Record<Level, string> = {
    avg: ORANGE, pivot: FUCHSIA, r1: opt.r1Color ?? CRIMSON, s1: LIME, r2: MAROON, s2: FOREST, r3: SALMON, s3: INDIAN_RED,
  };
  return levels.map((level) => ({
    title: `${name} ${titles[level]}`,
    tf,
    level,
    on: level === 's3' && opt.s3On ? opt.s3On : on,
    color: colors[level],
    width: level === 'avg' ? widths[0] : widths[1],
    style: level === 'avg' ? 'cross' : opt.style ?? 'circles',
  }));
}

const SIX: Level[] = ['avg', 'pivot', 'r1', 's1', 'r2', 's2'];
const EIGHT: Level[] = [...SIX, 'r3', 's3'];
const SPECS: Spec[] = [
  ...group('Hourly', '60', 'sh', [2, 2], EIGHT),
  // plot(sw and ftime_S3 ? ftime_S3 : na, title = "4 Hour S3"): the weekly switch, as in the original
  ...group('4 Hour', '240', 'sf', [2, 3], EIGHT, { s3On: 'sw' }),
  ...group('Daily', 'D', 'sd', [2, 3], SIX),
  ...group('Weekly', 'W', 'sw', [3, 4], SIX),
  ...group('Monthly', 'M', 'sm', [4, 5], SIX, { r1Color: V1('#DC145C') }),
  ...group('Yearly', '12M', 'sy', [4, 6], SIX, { style: 'cross' }),
];

export const plotConfig: PlotConfig[] = SPECS.map((s, j) => ({
  id: `plot${j}`, title: s.title, color: s.color, lineWidth: s.width, style: s.style,
}));

export const metadata = {
  title: 'CM_Pivot Points_M-W-D_4H_1H_Filtered',
  shortTitle: 'CM_Pivots_Filtered',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
/** A number used as a condition: na and 0 are false */
const truthy = (v: number) => !isNaN(v) && v !== 0;

/**
 * security(tickerid, tf, ...) on the chart symbol: the bars of timeframe `tf` built from the chart bars, and the
 * function that brings one value per bar of that timeframe back to the chart bars. Version 1 rule: every chart bar
 * of a period shows the value of the period (no gaps).
 */
function timeframeBars(bars: Bar[], tf: string): { htf: Bar[]; toChart: (values: number[]) => number[] } {
  const chart = chartTimeframe(bars);
  if (tf.trim() === '' || chart === '' || timeframe.in_seconds(tf) === timeframe.in_seconds(chart)) {
    return { htf: bars, toChart: (values) => values };
  }
  if (timeframe.in_seconds(tf) < timeframe.in_seconds(chart)) {
    throw new Error(`The timeframe "${tf}" is lower than the chart timeframe "${chart}": the bars do not carry that data.`);
  }
  const starts = periodStarts(bars, tf);
  const htf: Bar[] = [];
  const group: number[] = [];
  bars.forEach((b, i) => {
    if (i === 0 || starts[i] !== starts[i - 1]) {
      htf.push({ time: starts[i], open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume ?? NaN });
    } else {
      const last = htf[htf.length - 1];
      last.high = Math.max(last.high, b.high);
      last.low = Math.min(last.low, b.low);
      last.close = b.close;
      last.volume = (last.volume ?? NaN) + (b.volume ?? NaN);
    }
    group.push(htf.length - 1);
  });
  return { htf, toChart: (values) => group.map((g) => values[g]) };
}

/** security(tickerid, tf, level[1]) of every level: the levels of the previous bar of timeframe `tf`, on the chart bars */
function levelsOf(bars: Bar[], tf: string, pf: boolean, sh3: boolean): Record<Level, number[]> {
  const { htf, toChart } = timeframeBars(bars, tf);
  const m = htf.length;
  const pivot = htf.map((b) => (b.high + b.low + b.close) / 3.0);
  const smaP = ta.sma(Series.fromArray(htf, pivot), 3).toArray().map((v) => v ?? NaN);
  const out: Record<Level, number[]> = { avg: smaP, pivot, r1: [], s1: [], r2: [], s2: [], r3: [], s3: [] };
  for (let i = 0; i < m; i++) {
    const { high, low } = htf[i];
    const p = pivot[i];
    const mean = (p + (i > 0 ? pivot[i - 1] : NaN)) / 2;
    const bull = gt(p, mean + 0.0025);
    const bear = lt(p, mean - 0.0025);
    const r1 = pf && bear ? p + (p - low) : pf && bull ? p + (high - low) : p + (p - low);
    const s1 = pf && bull ? p - (high - p) : pf && bear ? p - (high - low) : p - (high - p);
    out.r1.push(r1);
    out.s1.push(s1);
    out.r2.push(pf ? NaN : p + (high - low));
    out.s2.push(pf ? NaN : p - (high - low));
    // r3 = sh3 and r1 + (high - low) ? r1 + (high - low) : na
    const r3 = r1 + (high - low);
    const s3 = s1 - (high - low);
    out.r3.push(sh3 && truthy(r3) ? r3 : NaN);
    out.s3.push(sh3 && truthy(s3) ? s3 : NaN);
  }
  const previous = (a: number[]) => toChart(a.map((_v, i) => (i > 0 ? a[i - 1] : NaN)));
  return {
    avg: previous(out.avg), pivot: previous(out.pivot), r1: previous(out.r1), s1: previous(out.s1),
    r2: previous(out.r2), s2: previous(out.s2), r3: previous(out.r3), s3: previous(out.s3),
  };
}

export function calculate(bars: Bar[], inputs: Partial<CmPivotPointsFilteredInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };

  // A timeframe is computed only when one of its plots is shown
  const levels = new Map<string, Record<Level, number[]>>();
  const plots: Record<string, Array<{ time: number; value: number }>> = {};
  SPECS.forEach((s, j) => {
    // plot(sa and sh and htime_pivotAvg ? htime_pivotAvg : na) / plot(sh and htime_pivot ? htime_pivot : na)
    // r3 / s3 are na without sh3 (r3 = sh3 and ... ? ... : na)
    const shown = cfg[s.on] && (s.level !== 'avg' || cfg.sa) && ((s.level !== 'r3' && s.level !== 's3') || cfg.sh3);
    let values: number[] | null = null;
    if (shown) {
      if (!levels.has(s.tf)) levels.set(s.tf, levelsOf(bars, s.tf, cfg.pf, cfg.sh3));
      values = levels.get(s.tf)![s.level];
    }
    plots[`plot${j}`] = bars.map((b, i) => ({ time: b.time, value: values && truthy(values[i]) ? values[i] : NaN }));
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
  };
}

export const CmPivotPointsFiltered = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
