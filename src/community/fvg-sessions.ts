/**
 * FVG Sessions [LuxAlgo]
 *
 * The first fair value gap of each day, and the range of the day.
 * - On the first bar of a new day: a dashed vertical line, and two lines (high and low of the day so far) that follow
 *   the day range. The range lines take the colour of the gap of the day (bullish or bearish).
 * - The first gap of the day (bullish: low above the high of two bars back and previous close above that high;
 *   bearish: the mirror) is drawn as a box with a dashed line at its middle, both extended to the current bar.
 *   On the next day they end two bars before the first bar of that day.
 * - When the close goes through the far side of the gap (below the bottom of a bullish gap, above the top of a
 *   bearish gap) the gap is mitigated: a new box in the 'Mitigated' colour and a new middle line start on the
 *   previous bar and take over the extension; the first box and line stay as they were.
 *
 * Drawings are kept up to 500 lines and 500 boxes (the oldest are removed).
 *
 * Alerts (alertcondition, `alerts` of the result): new bullish / bearish gap of the day, its mitigation, the close
 * inside the gap of the day, and the close crossing the middle of the gap of the day.
 *
 * Limits of the port:
 * - New days come from the UTC calendar and the bars (see anchor-period): equal on UTC symbols and on symbols whose
 *   trading day is inside one UTC day.
 *
 * Chart values (third argument): the port reads the symbol tick (the day delimiter goes from high + tick to
 * low - tick; without it: 0.01; the line is vertical and extended both ways, so it looks the same) and the chart
 * foreground colour (delimiter and first range lines; without it: #DBDBDB, a dark chart).
 *
 * Periods and the chart context (optional third argument of calculate): with the exchange time zone and the session
 * of the symbol (`timezone`, `session`) the periods are those of the exchange calendar (its trading days, holidays
 * and session hours), see src/anchor-period.ts.
 * Without them the port uses the UTC calendar and the bars, as described in this header. `timeframe`, when given,
 * is the chart timeframe; without it the chart timeframe is read from the bar spacing.
 *
 * Reference: "FVG Sessions [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import { chartSessions, color, periodTime, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SessionContext } from 'oakscriptjs';
import { calendarOf, chartTimeframe } from '../anchor-period';
import type { BoxData, LineDrawingData } from '../types';
import { foregroundColorOf, mintickOf, type ChartContext } from '../chart-context';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface FvgSessionsInputs {
  /** FVG Level (bullish) */
  bullCss: string;
  /** Area (bullish) */
  bullAreaCss: string;
  /** Mitigated (bullish) */
  bullMitigatedCss: string;
  /** FVG Level (bearish) */
  bearCss: string;
  /** Area (bearish) */
  bearAreaCss: string;
  /** Mitigated (bearish) */
  bearMitigatedCss: string;
}

export const defaultInputs: FvgSessionsInputs = {
  bullCss: '#00897B',
  bullAreaCss: 'rgba(0, 137, 123, 0.5)',
  bullMitigatedCss: 'rgba(0, 137, 123, 0.2)',
  bearCss: '#FF5252',
  bearAreaCss: 'rgba(255, 82, 82, 0.5)',
  bearMitigatedCss: 'rgba(255, 82, 82, 0.2)',
};

export const inputConfig: InputConfig[] = [
  { id: 'bullCss', type: 'color', title: 'FVG Level', defval: '#00897B', inline: 'bull' },
  { id: 'bullAreaCss', type: 'color', title: 'Area', defval: 'rgba(0, 137, 123, 0.5)', inline: 'bull' },
  { id: 'bullMitigatedCss', type: 'color', title: 'Mitigated', defval: 'rgba(0, 137, 123, 0.2)', inline: 'bull' },
  { id: 'bearCss', type: 'color', title: 'FVG Level', defval: '#FF5252', inline: 'bear' },
  { id: 'bearAreaCss', type: 'color', title: 'Area', defval: 'rgba(255, 82, 82, 0.5)', inline: 'bear' },
  { id: 'bearMitigatedCss', type: 'color', title: 'Mitigated', defval: 'rgba(255, 82, 82, 0.2)', inline: 'bear' },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'FVG Sessions [LuxAlgo]',
  shortTitle: 'FVG Sessions [LuxAlgo]',
  overlay: true,
};

/** max_lines_count, max_boxes_count */
const MAX_COUNT = 500;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

interface Ln {
  x1: number; y1: number; x2: number; y2: number;
  color: string; style?: 'dashed'; extend?: 'both'; dead: boolean;
}
interface Bx { left: number; top: number; right: number; bottom: number; bg: string; dead: boolean }

/** Live drawings of one kind: above max + 5 objects the oldest are deleted until max remain */
class Live<T extends { dead: boolean }> {
  readonly list: T[] = [];
  add(o: T): T {
    this.list.push(o);
    if (this.list.length > MAX_COUNT + 5) for (const old of this.list.splice(0, this.list.length - MAX_COUNT)) old.dead = true;
    return o;
  }

  /** A copy of the drawings (`map`: each drawing to its copy) */
  clone(map: Map<object, object>): Live<T> {
    const c = new Live<T>();
    for (const o of this.list) {
      const k = { ...o };
      map.set(o, k);
      c.list.push(k);
    }
    return c;
  }
}

/** Pine type fvg (mitigated / isbull are na before the first gap) */
interface Fvg { top: number; btm: number; mitigated: boolean; isnew: boolean; isbull: boolean; lvl: Ln | null; area: Bx | null }

type Result = IndicatorResult & { lines: LineDrawingData[]; boxes: BoxData[] } & { alerts: AlertConditionState[] };

const DAY_MS = 86400000;

/** A copy of the drawings and of the objects that point to them (a deleted drawing is never changed: kept as is) */
function cloneDrawings(v: FvgVars): FvgVars {
  const map = new Map<object, object>();
  const lines = v.lines.clone(map);
  const boxes = v.boxes.clone(map);
  const get = <T extends object>(o: T | null): T | null => (o === null ? null : ((map.get(o) as T | undefined) ?? o));
  return {
    ...v,
    lines,
    boxes,
    sfvg: { ...v.sfvg, lvl: get(v.sfvg.lvl), area: get(v.sfvg.area) },
    sesr: v.sesr === null ? null : { max: get(v.sesr.max)!, min: get(v.sesr.min)! },
  };
}

interface FvgVars {
  lines: Live<Ln>;
  boxes: Live<Bx>;
  sfvg: Fvg;
  sesr: { max: Ln; min: Ln } | null;
}

interface FvgRun extends BarRunState<FvgVars> {
  /** periodStarts(bars, 'D', chart) of each bar (the UTC day without the exchange calendar) */
  dayStart: number[];
  /** math.avg(sfvg.top, sfvg.btm) and isbull / isnew of the gap of the day at the end of each bar */
  gapAvg: number[];
  flags: boolean[][];
  times: number[][];
}

/** One calendar per chart context, timeframe and unit (the library caches its calendars per object) */

function study(inputs: Partial<FvgSessionsInputs>): BarStudy<FvgRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  let mintick = 0.01;
  let chartCss = '';
  let ms = false;
  /** The exchange calendar of periodStarts (src/anchor-period.ts), null for the UTC days */
  let calendar: SessionContext | null = null;
  let sessions: ReturnType<typeof chartSessions> | null = null;
  return {
    // the chart timeframe comes from the bar gaps (or the context), the time unit from the first bar
    key: (bars, chart) => `${chartTimeframe(bars, chart)}|${bars.length > 0 && bars[0].time >= 1e12}`,
    init(bars, chart) {
      // syminfo.mintick
      mintick = mintickOf(chart);
      chartCss = String(color.new(foregroundColorOf(chart), 50));
      ms = bars.length > 0 && bars[0].time >= 1e12;
      // the calendar of periodStarts
      const cal = calendarOf(bars, chart);
      calendar = cal?.chart ?? null;
      sessions = cal ? chartSessions(cal.chart) : null;
      const s: FvgRun = {
        dayStart: [], gapAvg: [], flags: Array.from({ length: 8 }, () => []), times: Array.from({ length: 8 }, () => []),
        steps: [],
        vars: {
          lines: new Live<Ln>(), boxes: new Live<Bx>(),
          sfvg: { top: NaN, btm: NaN, mitigated: false, isnew: true, isbull: false, lvl: null, area: null },
          sesr: null,
        },
        lists: [], series: [],
      };
      s.lists = [...s.times];
      s.series = [s.dayStart, s.gapAvg, ...s.flags];
      return s;
    },
    copyVars: cloneDrawings,
    bar(s, i, bars) {
      const v = s.vars;
      const { lines, boxes } = v;
      const { high, low, close, time } = bars[i];
      const H = (k: number) => (k >= 0 ? bars[k].high : NaN);
      const L = (k: number) => (k >= 0 ? bars[k].low : NaN);
      const C = (k: number) => (k >= 0 ? bars[k].close : NaN);

      // periodStarts(bars, 'D', chart): with the calendar, time("D") of the bar (a stray bar keeps the period of the
      // bar before, another bar without a trading day is its own period); else the UTC day
      if (calendar && sessions) {
        const unit = ms ? 1 : 1000;
        const t = periodTime(time, 'D', calendar);
        s.dayStart[i] = !Number.isNaN(t) ? t / unit : i > 0 && sessions.bars.stray(time * unit) ? s.dayStart[i - 1] : time;
      } else {
        s.dayStart[i] = Math.floor((ms ? time : time * 1000) / DAY_MS) * DAY_MS;
      }

      // set_fvg(): a new box and a new middle line from `offset` bars back to the current bar
      const setFvg = (id: Fvg, offset: number, bgCss: string, lCss: string) => {
        const avg = (id.top + id.btm) / 2;
        id.area = boxes.add({ left: i - offset, top: id.top, right: i, bottom: id.btm, bg: bgCss, dead: false });
        id.lvl = lines.add({ x1: i - offset, y1: avg, x2: i, y2: avg, color: lCss, style: 'dashed', dead: false });
      };

      const bullFvg = gt(low, H(i - 2)) && gt(C(i - 1), H(i - 2));
      const bearFvg = lt(high, L(i - 2)) && lt(C(i - 1), L(i - 2));
      const dtf = i > 0 && s.dayStart[i] !== s.dayStart[i - 1];

      if (dtf) {
        // Delimiter, new range, end of the gap of the prior day
        lines.add({ x1: i, y1: high + mintick, x2: i, y2: low - mintick, color: chartCss, style: 'dashed', extend: 'both', dead: false });
        v.sesr = {
          max: lines.add({ x1: i, y1: high, x2: i, y2: high, color: chartCss, dead: false }),
          min: lines.add({ x1: i, y1: low, x2: i, y2: low, color: chartCss, dead: false }),
        };
        v.sfvg.isnew = true;
        if (v.sfvg.lvl !== null) {
          if (!v.sfvg.lvl.dead) v.sfvg.lvl.x2 = i - 2;
          if (v.sfvg.area !== null && !v.sfvg.area.dead) v.sfvg.area.right = i - 2;
        }
      } else if (v.sesr !== null) {
        const sesr = v.sesr;
        // set_range(): math.max / math.min give na with an na argument (a deleted line)
        const max = sesr.max.dead ? NaN : Math.max(high, sesr.max.y2);
        const min = sesr.min.dead ? NaN : Math.min(low, sesr.min.y2);
        const css = v.sfvg.isbull ? cfg.bullCss : cfg.bearCss;
        if (!sesr.max.dead) {
          sesr.max.x2 = i;
          sesr.max.y2 = max;
          sesr.max.y1 = max;
          sesr.max.color = css;
        }
        if (!sesr.min.dead) {
          sesr.min.x2 = i;
          sesr.min.y2 = min;
          sesr.min.y1 = min;
          sesr.min.color = css;
        }
      }

      // First gap of the day
      let bullIsNew = false;
      let bearIsNew = false;
      let bullMitigated = false;
      let bearMitigated = false;
      if (bullFvg && v.sfvg.isnew) {
        v.sfvg = { top: low, btm: H(i - 2), mitigated: false, isnew: false, isbull: true, lvl: null, area: null };
        setFvg(v.sfvg, 2, cfg.bullAreaCss, cfg.bullCss);
        bullIsNew = true;
      } else if (bearFvg && v.sfvg.isnew) {
        v.sfvg = { top: L(i - 2), btm: high, mitigated: false, isnew: false, isbull: false, lvl: null, area: null };
        setFvg(v.sfvg, 2, cfg.bearAreaCss, cfg.bearCss);
        bearIsNew = true;
      }
      const sfvg = v.sfvg;

      // Mitigation
      if (!sfvg.mitigated) {
        if (sfvg.isbull && lt(close, sfvg.btm)) {
          setFvg(sfvg, 1, cfg.bullMitigatedCss, cfg.bullCss);
          sfvg.mitigated = true;
          bullMitigated = true;
        } else if (!sfvg.isbull && gt(close, sfvg.top)) {
          setFvg(sfvg, 1, cfg.bearMitigatedCss, cfg.bearCss);
          sfvg.mitigated = true;
          bearMitigated = true;
        }
      }
      // close >= sfvg.btm and close <= sfvg.top and (not) sfvg.isbull and not sfvg.isnew
      const within = ge(close, sfvg.btm) && le(close, sfvg.top) && !sfvg.isnew;
      const gapAvg = (sfvg.top + sfvg.btm) / 2;
      s.gapAvg[i] = gapAvg;
      // ta.cross(close, math.avg(sfvg.top, sfvg.btm)) and (not) sfvg.isbull and not sfvg.isnew
      const prevClose = i > 0 ? bars[i - 1].close : NaN;
      const prevAvg = i > 0 ? s.gapAvg[i - 1] : NaN;
      const over = close > gapAvg && prevClose <= prevAvg;
      const under = close < gapAvg && prevClose >= prevAvg;
      const avgCross = (over || under) && !sfvg.isnew;
      const flags = [
        bullIsNew, bearIsNew, bullMitigated, bearMitigated, within && sfvg.isbull, within && !sfvg.isbull,
        avgCross && sfvg.isbull, avgCross && !sfvg.isbull,
      ];
      for (let k = 0; k < flags.length; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(time as number);
      }

      // The gap of the day follows the current bar
      if (!sfvg.isnew) {
        if (sfvg.lvl !== null && !sfvg.lvl.dead) sfvg.lvl.x2 = i;
        if (sfvg.area !== null && !sfvg.area.dead) sfvg.area.right = i;
      }
    },
    result(s, bars) {
      const n = bars.length;
      const outLines: LineDrawingData[] = s.vars.lines.list.map((l) => ({
        time1: bars[l.x1].time, price1: l.y1, time2: bars[l.x2].time, price2: l.y2, color: l.color,
        ...(l.style ? { style: l.style } : {}),
        ...(l.extend ? { extend: l.extend } : {}),
      }));
      const outBoxes: BoxData[] = s.vars.boxes.list.map((b) => ({
        time1: bars[b.left].time, price1: b.top, time2: bars[b.right].time, price2: b.bottom,
        borderColor: 'transparent', bgColor: b.bg,
      }));
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        lines: outLines,
        boxes: outBoxes,
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FvgSessionsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<FvgSessionsInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { lines: LineDrawingData[]; boxes: BoxData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs, chart).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish FVG', message: 'New session bullish fvg' },
  { id: 'alert1', title: 'Bearish FVG', message: 'New session bearish fvg' },
  { id: 'alert2', title: 'Mitigated Bullish FVG', message: 'Session bullish fvg has been mitigated' },
  { id: 'alert3', title: 'Mitigated Bearish FVG', message: 'Session bearish fvg has been mitigated' },
  { id: 'alert4', title: 'Price Within Bullish FVG', message: 'Price is within bullish fvg' },
  { id: 'alert5', title: 'Price Within Bearish FVG', message: 'Price is within bearish fvg' },
  { id: 'alert6', title: 'Bullish FVG AVG Cross', message: 'Price crossed bullish fvg average' },
  { id: 'alert7', title: 'Bearish FVG AVG Cross', message: 'Price crossed bearish fvg average' },
];

export const FvgSessions = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
