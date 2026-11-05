/**
 * Market Profile (TPO)
 *
 * On the first bar of each period of the higher timeframe, the profile of the period that just ended is drawn to
 * the right of that bar. The range of the ended period is cut into 20 channels; the size of a channel is the number
 * of bars of the period that touch it (the first bar of the period is not counted, as in the original). The channel
 * with the most bars is the point of control (POC); the value area grows from it, towards the larger neighbour
 * channel, until it holds "Percent for Value Area %" of the counts. The profile is drawn as a stepped outline of
 * lines (value area and other channels in two colours), with a POC line that runs until the next profile (the last
 * one is extended to the right).
 *
 * "Auto" takes the higher timeframe from the chart timeframe.
 * The periods come from the UTC calendar and the bars (see anchor-period.ts): exact on symbols that trade every day
 * in UTC and on symbols whose trading day is inside the UTC day.
 * Alerts (alertcondition, `alerts` of the result): 'Price in POC' (close inside the POC channel of the last profile,
 * on the current channel grid), 'Price went above POC' and 'Price went below POC' (from in / below, in / above on the
 * bar before).
 *
 * Periods and the chart context (optional third argument of calculate): with the exchange time zone and the session
 * of the symbol (`timezone`, `session`) the periods are those of the exchange calendar (its trading days, holidays
 * and session hours), see src/anchor-period.ts.
 * Without them the port uses the UTC calendar and the bars, as described in this header. `timeframe`, when given,
 * is the chart timeframe; without it the chart timeframe is read from the bar spacing.
 *
 * Reference: "Market Profile" by LonesomeTheBlue
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LonesomeTheBlue
 */

import { compare, math, timeframe, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LineDrawingData } from '../types';
import { barInterval, barTime } from '../bar-time';
import { chartTimeframe, hasCalendar, periodStarts } from '../anchor-period';
import type { ChartContext } from '../chart-context';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

type ShowWhat = "Don't Show Value Area" | 'Show Value Area High' | 'Show All Channels';

export interface MarketProfileInputs {
  /** Higher Time Frame */
  timeframe: string;
  /** Percent for Value Area % */
  percent: number;
  showPocLine: boolean;
  keepOldMp: boolean;
  showWhat: ShowWhat;
  lineWidth: number;
  /** Sizing Rate % */
  sizingRate: number;
  pocColor: string;
  vahColor: string;
  nonVaColor: string;
}

export const defaultInputs: MarketProfileInputs = {
  timeframe: 'Auto',
  percent: 70,
  showPocLine: true,
  keepOldMp: true,
  showWhat: 'Show All Channels',
  lineWidth: 2,
  sizingRate: 100,
  pocColor: '#FFEB3B',
  vahColor: '#2196F3',
  nonVaColor: '#787B86',
};

export const inputConfig: InputConfig[] = [
  {
    id: 'timeframe', type: 'string', title: 'Higher Time Frame', defval: 'Auto',
    options: ['Auto', '1', '5', '10', '15', '30', '60', '120', '180', '240', '360', '480', '720', 'D', 'W', '2W', 'M', '3M', '6M', '12M'],
  },
  { id: 'percent', type: 'float', title: 'Percent for Value Area %', defval: 70, min: 1, max: 100 },
  { id: 'showPocLine', type: 'bool', title: 'Show POC Line', defval: true },
  { id: 'keepOldMp', type: 'bool', title: 'Keep Old MPs', defval: true },
  {
    id: 'showWhat', type: 'string', title: 'Show', defval: 'Show All Channels',
    options: ["Don't Show Value Area", 'Show Value Area High', 'Show All Channels'],
  },
  { id: 'lineWidth', type: 'int', title: 'Line Width', defval: 2, min: 1, max: 4 },
  { id: 'sizingRate', type: 'float', title: 'Sizing Rate %', defval: 100, min: 10, max: 500 },
  { id: 'pocColor', type: 'color', title: 'POC Line Color', defval: '#FFEB3B' },
  { id: 'vahColor', type: 'color', title: 'Value Area Color', defval: '#2196F3' },
  { id: 'nonVaColor', type: 'color', title: 'Non-Value Area Color', defval: '#787B86' },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Market Profile',
  shortTitle: 'MP/TPO',
  overlay: true,
};

/** study(max_lines_count = 500) */
const MAX_LINES = 500;

/** A line with bar indexes */
interface LineObj {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  extend: 'none' | 'right';
  deleted: boolean;
}

/** Pine `for i = a to b`: counts down when a > b */
function pineRange(a: number, b: number): number[] {
  const out: number[] = [];
  if (a <= b) for (let i = a; i <= b; i++) out.push(i);
  else for (let i = a; i >= b; i--) out.push(i);
  return out;
}

/** The higher timeframe of "Auto", from the chart timeframe (timeframe.period) */
function autoTimeframe(period: string): string {
  switch (period) {
    case '1': return '120';
    case '2': return '180';
    case '3': return '240';
    case '5': return 'D';
    case '10': case '15': case '30': case '45': case '60': return 'W';
    case '120': case '180': case '240': return 'M';
    case 'D': case 'W': return '12M';
    default: return 'D';
  }
}

const DAY = 86400000;
const WEEK = 7 * DAY;

/** Start (UNIX ms, UTC) of the D / W / M calendar period of the day `day` (the UTC rule of `periodStarts`) */
function calendarPeriodStart(day: number, info: ReturnType<typeof timeframe.info>): number {
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

/** Bars on a Saturday or a Sunday (UTC): the symbol trades every day (the rule of `periodStarts`) */
function tradesEveryDay(bars: ReadonlyArray<{ time: number }>): boolean {
  const ms = bars.length > 0 && bars[0].time >= 1e12;
  for (const b of bars) {
    const wd = (((Math.floor((ms ? b.time : b.time * 1000) / DAY) + 4) % 7) + 7) % 7;
    if (wd === 0 || wd === 6) return true;
  }
  return false;
}

/** The state of the UTC fallback of `periodStarts`, one bar at a time */
interface PeriodState {
  prevDay: number;
  sessionStart: number;
  prevKey: number;
  start: number;
  tradingYear: number;
  tradingDays: number;
  prevTradingDay: number;
}

type MpResult = IndicatorResult & { lines: LineDrawingData[] } & { alerts: AlertConditionState[] };

interface MpVars {
  period: PeriodState;
  /** time(Timeframe) of the bar before */
  prevStart: number;
  highestHtf: number;
  lowestHtf: number;
  highest: number;
  lowest: number;
  barnum: number;
  len: number;
  glPocLoc: number;
  /** Live lines in creation order; the lines of the last profile */
  live: LineObj[];
  allLines: LineObj[];
}

interface MpRun extends BarRunState<MpVars> {
  inPoc: boolean[];
  abovePoc: boolean[];
  belowPoc: boolean[];
  flags: boolean[][];
  times: number[][];
}

function copyMpVars(v: MpVars): MpVars {
  const copies = new Map<LineObj, LineObj>();
  const copy = (l: LineObj) => {
    let c = copies.get(l);
    if (!c) {
      c = { ...l };
      copies.set(l, c);
    }
    return c;
  };
  return { ...v, period: { ...v.period }, live: v.live.map(copy), allLines: v.allLines.map(copy) };
}

function study(inputs: Partial<MarketProfileInputs>): BarStudy<MpRun, MpResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const percent = cfg.percent / 100;
  const srate = cfg.sizingRate / 100;
  let tf = '';
  let inMs = false;
  let everyDay = false;
  let info: ReturnType<typeof timeframe.info> | null = null;
  let periodLen = 0;
  /** time(Timeframe) of every bar, from the exchange calendar of the whole bar set */
  let pre: number[] | null = null;

  /** periodStarts(bars, tf) of one bar, the UTC fallback (see anchor-period.ts) */
  const periodStart = (p: PeriodState, time: number): number => {
    if (!info) {
      info = timeframe.info(tf);
      if (info.isticks) throw new RangeError(`Unsupported timeframe "${tf}"`);
      periodLen = info.isintraday ? timeframe.in_seconds(tf) * 1000 : 0;
    }
    const t = inMs ? time : time * 1000;
    const day = Math.floor(t / DAY) * DAY;
    if (day !== p.prevDay) p.sessionStart = everyDay ? day : t;
    p.prevDay = day;
    if (info.isintraday) {
      p.start = periodLen >= DAY ? p.sessionStart : p.sessionStart + Math.floor((t - p.sessionStart) / periodLen) * periodLen;
    } else if (info.isdaily && info.multiplier > 1 && !everyDay) {
      // n trading days (UTC days with bars) counted from the first trading day of the year
      const year = new Date(day).getUTCFullYear();
      if (year !== p.tradingYear) {
        p.tradingYear = year;
        p.tradingDays = -1;
      }
      if (day !== p.prevTradingDay) {
        p.tradingDays++;
        p.prevTradingDay = day;
        if (p.tradingDays % info.multiplier === 0) p.start = t;
      }
    } else {
      const key = calendarPeriodStart(day, info);
      if (key !== p.prevKey) p.start = everyDay ? key : t;
      p.prevKey = key;
    }
    return inMs ? p.start : Math.floor(p.start / 1000);
  };

  const H = (bars: Bar[], i: number) => (i >= 0 ? bars[i].high : NaN);
  const L = (bars: Bar[], i: number) => (i >= 0 ? bars[i].low : NaN);
  // math.max / math.min: na with an na argument
  const pmax = (a: number, b: number) => (Number.isNaN(a) || Number.isNaN(b) ? NaN : Math.max(a, b));
  const pmin = (a: number, b: number) => (Number.isNaN(a) || Number.isNaN(b) ? NaN : Math.min(a, b));
  const included = (t1: number, t2: number, t3: number, t4: number) =>
    (compare.ge(t3, t1) && compare.le(t3, t2)) || (compare.ge(t4, t1) && compare.le(t4, t2))
    || (compare.le(t3, t1) && compare.ge(t4, t2));

  return {
    // the chart timeframe comes from the bar gaps, the time unit from the first bar, the trading days from the
    // weekend bars
    key: (bars, chart) =>
      `${chartTimeframe(bars, chart)}|${bars.length > 0 && bars[0].time >= 1e12}|${hasCalendar(chart) || tradesEveryDay(bars)}`,
    // with the exchange calendar the periods come from the calendar of the whole bar set
    fullRunReason: (chart) => (hasCalendar(chart) ? 'exchange calendar periods' : null),
    init(bars, chart) {
      const n = bars.length;
      // timeframe.period: "D" / "W" / "M" without the multiplier 1
      const period = chartTimeframe(bars, chart).replace(/^1([DWM])$/, '$1');
      tf = cfg.timeframe === 'Auto' ? autoTimeframe(period) : cfg.timeframe;
      inMs = n > 0 && bars[0].time >= 1e12;
      everyDay = tradesEveryDay(bars);
      info = null;
      pre = hasCalendar(chart) && n > 0 ? periodStarts(bars, tf, chart) : null;
      const s: MpRun = {
        inPoc: [], abovePoc: [], belowPoc: [], flags: [[], [], []], times: [[], [], []],
        steps: [],
        vars: {
          period: { prevDay: NaN, sessionStart: NaN, prevKey: NaN, start: NaN, tradingYear: NaN, tradingDays: -1, prevTradingDay: NaN },
          prevStart: NaN, highestHtf: NaN, lowestHtf: NaN, highest: NaN, lowest: NaN, barnum: 0, len: 0, glPocLoc: 0,
          live: [], allLines: [],
        },
        lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [s.inPoc, s.abovePoc, s.belowPoc, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const bar = bars[i];
      if (i === 0) {
        v.highest = bar.high;
        v.lowest = bar.low;
      }
      // Live lines in creation order: above max + 5 lines the oldest are deleted until max remain
      const newLine = (x1: number, y1: number, x2: number, y2: number, color: string, extend: 'none' | 'right' = 'none') => {
        const l: LineObj = { x1, y1, x2, y2, color, extend, deleted: false };
        v.live.push(l);
        if (v.live.length > MAX_LINES + 5) {
          for (const old of v.live.splice(0, v.live.length - MAX_LINES)) old.deleted = true;
        }
        return l;
      };
      // var int gl_poc_loc = 0; the alert series price_in_poc / price_above_poc / price_below_poc on each bar
      const alertsOfBar = () => {
        // get_base(x) = lowest + (x - 1) * channel, channel = (highest - lowest) / 20 (the var levels of the last profile)
        const channel = (v.highest - v.lowest) / 20;
        const base = (x: number) => v.lowest + (x - 1) * channel;
        const c = bar.close;
        const inPoc = compare.ge(c, base(v.glPocLoc)) && compare.le(c, base(v.glPocLoc + 1));
        const abovePoc = compare.gt(c, base(v.glPocLoc + 1));
        const belowPoc = compare.le(c, base(v.glPocLoc));
        s.inPoc[i] = inPoc;
        s.abovePoc[i] = abovePoc;
        s.belowPoc[i] = belowPoc;
        // alertcondition(price_in_poc), ((price_in_poc[1] or price_below_poc[1]) and price_above_poc),
        // ((price_in_poc[1] or price_above_poc[1]) and price_below_poc)
        const flags = [
          inPoc,
          i > 0 && (s.inPoc[i - 1] || s.belowPoc[i - 1]) && abovePoc,
          i > 0 && (s.inPoc[i - 1] || s.abovePoc[i - 1]) && belowPoc,
        ];
        for (let k = 0; k < 3; k++) {
          s.flags[k][i] = flags[k];
          if (flags[k]) s.times[k].push(bar.time as number);
        }
      };

      // newbar = change(time(Timeframe)) != 0 (na on the first bar: false)
      const start = pre ? pre[i] : periodStart(v.period, bar.time);
      const newbar = i > 0 && start !== v.prevStart;
      v.prevStart = start;
      const prevHighestHtf = v.highestHtf;
      const prevLowestHtf = v.lowestHtf;
      const prevBarnum = v.barnum;
      if (newbar) {
        v.highestHtf = bar.high;
        v.lowestHtf = bar.low;
        v.barnum = 0;
      } else {
        v.highestHtf = pmax(v.highestHtf, bar.high);
        v.lowestHtf = pmin(v.lowestHtf, bar.low);
        v.barnum += 1;
      }
      if (!newbar) {
        alertsOfBar();
        return;
      }

      v.highest = prevHighestHtf;
      v.lowest = prevLowestHtf;
      v.len = prevBarnum;
      const { highest, lowest, len } = v;
      const channel = (highest - lowest) / 20;
      const base = (x: number) => lowest + (x - 1) * channel;

      // Number of bars of the ended period in each channel
      const ch: number[] = new Array(22).fill(0);
      for (let x = 1; x <= 20; x++) {
        const lower = lowest + (x - 1) * channel;
        const upper = lowest + x * channel;
        let ret = 0;
        for (const k of pineRange(1, len)) if (included(lower, upper, L(bars, i - k), H(bars, i - k))) ret += 1;
        ch[x] = ret;
      }

      // Point of control: the highest channel with the largest count
      let total = 0;
      let pocLoc = 0;
      let pocVal = 0;
      for (let x = 1; x <= 20; x++) {
        total += ch[x];
        if (ch[x] >= pocVal) {
          pocVal = ch[x];
          pocLoc = x;
        }
      }
      v.glPocLoc = pocLoc;

      // Value area
      let vaVal = pocVal;
      let vahind = pocLoc;
      let valind = pocLoc;
      for (let x = 1; x <= 20; x++) {
        if (compare.ge(vaVal, total * percent)) break;
        const upval = ch[vahind + 1];
        const downval = ch[valind - 1];
        const chval = Math.max(upval, downval);
        if (chval === 0) break;
        if (upval >= downval) vahind += 1;
        else valind -= 1;
        vaVal += chval;
      }

      if (cfg.keepOldMp && v.allLines.length > 0) {
        const lastLine = v.allLines[v.allLines.length - 1];
        if (!lastLine.deleted) {
          lastLine.x2 = i - 1;
          lastLine.extend = 'none';
        }
        v.allLines = [];
      }
      if (!cfg.keepOldMp) {
        for (const l of v.allLines) l.deleted = true;
        v.live = v.live.filter((l) => !l.deleted);
        v.allLines = [];
      }
      const allLines = v.allLines;

      const lineColor = (isVa: boolean) => (isVa ? cfg.vahColor : cfg.nonVaColor);
      const inVa = (x: number) => x >= valind && x <= vahind;
      // draw_mp: a horizontal line; draw_mpd: a vertical line at the end of the channel
      const drawMp = (y: number, chval: number, isVa: boolean) =>
        newLine(i, y, i + math.round(srate * chval), y, lineColor(isVa));
      const drawMpd = (y1: number, y2: number, chval: number, isVa: boolean) => {
        const x = i + math.round(srate * chval);
        return newLine(x, y1, x, y2, lineColor(isVa));
      };

      if (cfg.showWhat === 'Show Value Area High' || cfg.showWhat === 'Show All Channels') {
        const str = cfg.showWhat === 'Show All Channels' ? 1 : valind;
        const end = cfg.showWhat === 'Show All Channels' ? 20 : vahind;
        for (const x of pineRange(str, end)) {
          let isVa = inVa(x);
          const lwdhm = Math.trunc(ch[x]);
          let lwdh = lwdhm;
          if (x > str) {
            const mytmp = Math.trunc(ch[x - 1]);
            if (mytmp > lwdh) {
              lwdh = mytmp;
              isVa = inVa(x - 1);
            }
          }
          allLines.push(drawMp(base(x), lwdh, isVa));
          allLines.push(drawMpd(base(x), base(x + 1), lwdhm, inVa(x)));
        }
        allLines.push(drawMp(base(end + 1), Math.trunc(ch[end]), inVa(end)));
      }

      if (cfg.showPocLine) {
        const midpoc = (lowest + (pocLoc - 1) * channel + lowest + pocLoc * channel) / 2;
        allLines.push(newLine(i, midpoc, i + 1, midpoc, cfg.pocColor, 'right'));
      }
      alertsOfBar();
    },
    copyVars: copyMpVars,
    result(s, bars) {
      const n = bars.length;
      // Outputs: bar indexes to bar times (a line with an na price is not drawn)
      const interval = barInterval(bars);
      const time = (x: number) => barTime(bars, x, interval);
      const lines: LineDrawingData[] = s.vars.live
        .filter((l) => !Number.isNaN(l.y1) && !Number.isNaN(l.y2) && !Number.isNaN(l.x1) && !Number.isNaN(l.x2))
        .map((l) => ({
          time1: time(l.x1), price1: l.y1, time2: time(l.x2), price2: l.y2, color: l.color, width: cfg.lineWidth,
          ...(l.extend === 'right' ? { extend: 'right' as const } : {}),
        }));
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        lines,
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MarketProfileInputs> = {}, chart: ChartContext = {}): IndicatorRun<MpResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MarketProfileInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { lines: LineDrawingData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs, chart).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Price in POC', message: 'Price in POC' },
  { id: 'alert1', title: 'Price went above POC', message: 'Price went above POC' },
  { id: 'alert2', title: 'Price went below POC', message: 'Price went below POC' },
];

export const MarketProfile = { calculate, createRun, metadata,
 defaultInputs, inputConfig, plotConfig, alertConditions };
