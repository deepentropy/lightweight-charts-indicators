/**
 * CM Pivot Points Custom
 *
 * Classic pivot levels of the previous daily, weekly, monthly, quarterly and yearly bar of the same symbol:
 * pivot = (high + low + close) / 3, R1 = pivot + (pivot - low), S1 = pivot - (high - pivot),
 * R2 / S2 = pivot +- (high - low), and with "Show R3 & S3?" R3 = R1 + (high - low), S3 = S1 - (high - low).
 * Each timeframe has its own switch; a level is drawn only when it is not na and not 0.
 *
 * As in the original (a version 1 script), every chart bar of a period shows the levels of the previous bar of that
 * timeframe (no gaps). A timeframe equal to the chart timeframe is the chart series itself (the levels of the
 * previous chart bar). The bars of each timeframe are built from the chart bars (see src/anchor-period.ts): the
 * levels of a period need the full previous bar of that timeframe in the chart bars. A timeframe below the chart
 * timeframe (e.g. daily pivots on a weekly chart) needs intrabar data: the port throws an Error when such a
 * timeframe is switched on.
 *
 * Periods and the chart context (optional third argument of calculate): with the exchange time zone and the session
 * of the symbol the periods are those of the exchange calendar (trading days, holidays, session hours); without
 * them the UTC calendar and the bars. `timeframe`, when given, is the chart timeframe; else it is read from the bar
 * spacing.
 *
 * Reference: "CM_Pivot Points_Custom" by ChrisMoody
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, timeframe, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { chartTimeframe, higherTimeframeBars } from '../anchor-period';
import type { ChartContext } from '../chart-context';

export interface CmPivotPointsCustomInputs {
  /** Show Daily Pivots? */
  sd: boolean;
  /** Show Weekly Pivots? */
  sw: boolean;
  /** Show Monthly Pivots? */
  sm: boolean;
  /** Show Quarterly Pivots? */
  sq: boolean;
  /** Show Yearly Pivots? */
  sy: boolean;
  /** Show R3 & S3? */
  sh3: boolean;
}

export const defaultInputs: CmPivotPointsCustomInputs = {
  sd: true,
  sw: false,
  sm: false,
  sq: false,
  sy: false,
  sh3: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'sd', type: 'bool', title: 'Show Daily Pivots?', defval: true },
  { id: 'sw', type: 'bool', title: 'Show Weekly Pivots?', defval: false },
  { id: 'sm', type: 'bool', title: 'Show Monthly Pivots?', defval: false },
  { id: 'sq', type: 'bool', title: 'Show Quarterly Pivots?', defval: false },
  { id: 'sy', type: 'bool', title: 'Show Yearly Pivots?', defval: false },
  { id: 'sh3', type: 'bool', title: 'Show R3 & S3?', defval: false },
];

// Colour constants of Pine version 1, with the default plot transparency of that version (35)
const V1 = (hex: string) => String(color.new(hex, 35));
const COLORS = [V1('#FF00FF'), V1('#DC143C'), V1('#00FF00'), V1('#800000'), V1('#228B22'), V1('#FA8072'), V1('#CD5C5C')];

type Level = 'pivot' | 'r1' | 's1' | 'r2' | 's2' | 'r3' | 's3';
const LEVELS: Level[] = ['pivot', 'r1', 's1', 'r2', 's2', 'r3', 's3'];
type Switch = 'sd' | 'sw' | 'sm' | 'sq' | 'sy';

interface Group {
  name: string;
  tf: string;
  on: Switch;
  style: 'circles' | 'cross';
  width: number;
}

const GROUPS: Group[] = [
  { name: 'Daily', tf: 'D', on: 'sd', style: 'circles', width: 3 },
  { name: 'Weekly', tf: 'W', on: 'sw', style: 'circles', width: 4 },
  { name: 'Monthly', tf: 'M', on: 'sm', style: 'cross', width: 3 },
  { name: 'Quarterly', tf: '3M', on: 'sq', style: 'cross', width: 3 },
  { name: 'Yearly', tf: '12M', on: 'sy', style: 'cross', width: 3 },
];

const TITLES: Record<Level, string> = {
  pivot: 'Pivot', r1: 'R1', s1: 'S1', r2: 'R2', s2: 'S2', r3: 'R3', s3: 'S3',
};

interface Spec {
  group: Group;
  level: Level;
}

const SPECS: Spec[] = GROUPS.flatMap((group) => LEVELS.map((level) => ({ group, level })));

export const plotConfig: PlotConfig[] = SPECS.map((s, j) => ({
  id: `plot${j}`,
  title: `${s.group.name} ${TITLES[s.level]}`,
  color: COLORS[LEVELS.indexOf(s.level)],
  lineWidth: s.group.width,
  style: s.group.style,
}));

export const metadata = {
  title: 'CM_Pivot Points',
  shortTitle: 'CM_Pivots',
  overlay: true,
};

/** A number used as a condition: na and 0 are false */
const truthy = (v: number) => !isNaN(v) && v !== 0;

/**
 * security(tickerid, tf, ...) on the chart symbol: the bars of timeframe `tf` built from the chart bars, and the
 * function that brings one value per bar of that timeframe back to the chart bars. Version 1 rule: every chart bar
 * of a period shows the value of the bar of that period (no gaps).
 */
function timeframeBars(bars: Bar[], tf: string, context?: ChartContext): { htf: Bar[]; toChart: (values: number[]) => number[] } {
  const chart = chartTimeframe(bars, context);
  if (chart === '' || timeframe.in_seconds(tf) === timeframe.in_seconds(chart)) {
    return { htf: bars, toChart: (values) => values };
  }
  if (timeframe.in_seconds(tf) < timeframe.in_seconds(chart)) {
    throw new Error(`The timeframe "${tf}" is lower than the chart timeframe "${chart}": the bars do not carry that data.`);
  }
  const { htf, group } = higherTimeframeBars(bars, tf, context);
  return { htf, toChart: (values) => group.map((g) => values[g]) };
}

/** security(tickerid, tf, level[1]) of every level: the levels of the previous bar of timeframe `tf`, on the chart bars */
function levelsOf(bars: Bar[], tf: string, sh3: boolean, context?: ChartContext): Record<Level, number[]> {
  const { htf, toChart } = timeframeBars(bars, tf, context);
  const out: Record<Level, number[]> = { pivot: [], r1: [], s1: [], r2: [], s2: [], r3: [], s3: [] };
  for (const { high, low, close } of htf) {
    const pivot = (high + low + close) / 3.0;
    const r1 = pivot + (pivot - low);
    const s1 = pivot - (high - pivot);
    out.pivot.push(pivot);
    out.r1.push(r1);
    out.s1.push(s1);
    out.r2.push(pivot + (high - low));
    out.s2.push(pivot - (high - low));
    // r3 = sh3 and r1 + (high - low) ? r1 + (high - low) : na
    const r3 = r1 + (high - low);
    const s3 = s1 - (high - low);
    out.r3.push(sh3 && truthy(r3) ? r3 : NaN);
    out.s3.push(sh3 && truthy(s3) ? s3 : NaN);
  }
  const previous = (a: number[]) => toChart(a.map((_v, i) => (i > 0 ? a[i - 1] : NaN)));
  return Object.fromEntries(LEVELS.map((l) => [l, previous(out[l])])) as Record<Level, number[]>;
}

export function calculate(bars: Bar[], inputs: Partial<CmPivotPointsCustomInputs> = {}, chart?: ChartContext): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };

  // A timeframe is computed only when its switch is on
  const levels = new Map<string, Record<Level, number[]>>();
  const plots: Record<string, Array<{ time: number; value: number }>> = {};
  SPECS.forEach((s, j) => {
    // plot(sd and dtime_pivot ? dtime_pivot : na)
    let values: number[] | null = null;
    if (cfg[s.group.on]) {
      if (!levels.has(s.group.tf)) levels.set(s.group.tf, levelsOf(bars, s.group.tf, cfg.sh3, chart));
      values = levels.get(s.group.tf)![s.level];
    }
    plots[`plot${j}`] = bars.map((b, i) => ({ time: b.time, value: values && truthy(values[i]) ? values[i] : NaN }));
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
  };
}

export const CmPivotPointsCustom = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
