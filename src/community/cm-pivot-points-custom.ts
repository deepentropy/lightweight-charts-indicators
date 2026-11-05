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
import { chartTimeframe, hasCalendar, higherTimeframeBars } from '../anchor-period';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

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

type Point = { time: number; value: number };

/** Start (UNIX ms, UTC) of the D / W / M calendar period of the day `day` (the UTC rule of `periodStarts`) */
function calendarPeriodStart(day: number, info: ReturnType<typeof timeframe.info>): number {
  const DAY = 86400000;
  const WEEK = 7 * DAY;
  const n = info.multiplier;
  const d = new Date(day);
  const year = d.getUTCFullYear();
  if (info.isdaily) {
    if (n === 1) return day;
    const jan1 = Date.UTC(year, 0, 1);
    return jan1 + Math.floor((day - jan1) / DAY / n) * n * DAY;
  }
  if (info.isweekly) {
    const monday = day - ((d.getUTCDay() + 6) % 7) * DAY;
    if (n === 1) return monday;
    const jan1 = Date.UTC(new Date(monday).getUTCFullYear(), 0, 1);
    const firstMonday = jan1 + ((8 - new Date(jan1).getUTCDay()) % 7) * DAY;
    return firstMonday + Math.floor((monday - firstMonday) / WEEK / n) * n * WEEK;
  }
  return Date.UTC(year, Math.floor(d.getUTCMonth() / n) * n, 1);
}

/** One timeframe of the run: how its periods are found, the bar of the current period, the levels of the previous one */
interface TfState {
  /** 'chart': each chart bar is a period; 'utc': the UTC calendar periods; 'pre': levels computed on all bars */
  mode: 'chart' | 'utc' | 'pre';
  info: ReturnType<typeof timeframe.info> | null;
  pre: Record<Level, number[]> | null;
  /** Period key of the current period, its high / low / close */
  key: number;
  high: number;
  low: number;
  close: number;
  /** The levels of the previous period (LEVELS order) */
  prev: number[];
}

interface PivotVars {
  tfs: TfState[];
}

interface PivotRun extends BarRunState<PivotVars> {
  plots: Point[][];
}

/** The levels of a bar of the timeframe (LEVELS order) */
function barLevels(high: number, low: number, close: number, sh3: boolean): number[] {
  const pivot = (high + low + close) / 3.0;
  const r1 = pivot + (pivot - low);
  const s1 = pivot - (high - pivot);
  // r3 = sh3 and r1 + (high - low) ? r1 + (high - low) : na
  const r3 = r1 + (high - low);
  const s3 = s1 - (high - low);
  return [pivot, r1, s1, pivot + (high - low), pivot - (high - low), sh3 && truthy(r3) ? r3 : NaN, sh3 && truthy(s3) ? s3 : NaN];
}

const NO_LEVELS = LEVELS.map(() => NaN);

function study(inputs: Partial<CmPivotPointsCustomInputs>): BarStudy<PivotRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  let inMs = false;
  const SPEC_GROUP = SPECS.map((sp) => GROUPS.indexOf(sp.group));
  const SPEC_LEVEL = SPECS.map((sp) => LEVELS.indexOf(sp.level));
  const SPEC_ON = SPECS.map((sp) => cfg[sp.group.on]);
  return {
    // the chart timeframe comes from the bar gaps, the time unit from the first bar
    key: (bars, chart) => `${chartTimeframe(bars, chart)}|${bars.length > 0 && bars[0].time >= 1e12}`,
    // with the exchange calendar the periods come from the calendar of the whole bar set
    fullRunReason: (chart) => (hasCalendar(chart) ? 'exchange calendar periods' : null),
    init(bars, chart) {
      inMs = bars.length > 0 && bars[0].time >= 1e12;
      const chartTf = chartTimeframe(bars, chart);
      // A timeframe is computed only when its switch is on
      const tfs: TfState[] = GROUPS.map((g) => {
        const st: TfState = { mode: 'chart', info: null, pre: null, key: NaN, high: NaN, low: NaN, close: NaN, prev: NO_LEVELS };
        if (!cfg[g.on]) return st;
        if (hasCalendar(chart)) {
          st.mode = 'pre';
          st.pre = levelsOf(bars, g.tf, cfg.sh3, chart);
        } else if (chartTf !== '' && timeframe.in_seconds(g.tf) !== timeframe.in_seconds(chartTf)) {
          if (timeframe.in_seconds(g.tf) < timeframe.in_seconds(chartTf)) {
            throw new Error(`The timeframe "${g.tf}" is lower than the chart timeframe "${chartTf}": the bars do not carry that data.`);
          }
          st.mode = 'utc';
          st.info = timeframe.info(g.tf);
        }
        return st;
      });
      const s: PivotRun = { plots: SPECS.map(() => []), steps: [], vars: { tfs }, lists: [], series: [] };
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      // changed in place: copyVars copies them at the end of the last confirmed bar
      const tfs = s.vars.tfs;
      for (let k = 0; k < GROUPS.length; k++) {
        const st = tfs[k];
        if (!cfg[GROUPS[k].on] || st.mode === 'pre') continue;
        // security(tickerid, tf, level[1]): the levels of the bar of the previous period
        let key: number;
        if (st.mode === 'chart') key = i;
        else {
          const t = inMs ? time : time * 1000;
          key = calendarPeriodStart(Math.floor(t / 86400000) * 86400000, st.info!);
        }
        if (i === 0 || key !== st.key) {
          if (i > 0) st.prev = barLevels(st.high, st.low, st.close, cfg.sh3);
          st.key = key;
          st.high = b.high;
          st.low = b.low;
          st.close = b.close;
        } else {
          st.high = Math.max(st.high, b.high);
          st.low = Math.min(st.low, b.low);
          st.close = b.close;
        }
      }
      for (let j = 0; j < SPECS.length; j++) {
        // plot(sd and dtime_pivot ? dtime_pivot : na)
        const st = tfs[SPEC_GROUP[j]];
        let v = NaN;
        if (SPEC_ON[j]) v = st.mode === 'pre' ? st.pre![SPECS[j].level][i] : st.prev[SPEC_LEVEL[j]];
        s.plots[j][i] = { time, value: truthy(v) ? v : NaN };
      }
    },
    copyVars: (v) => ({ tfs: v.tfs.map((t) => ({ ...t })) }),
    result(s) {
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, j) => { plots[`plot${j}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CmPivotPointsCustomInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CmPivotPointsCustomInputs> = {}, chart?: ChartContext): IndicatorResult {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const CmPivotPointsCustom = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
