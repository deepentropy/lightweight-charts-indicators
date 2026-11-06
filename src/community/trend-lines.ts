/**
 * Trend Lines
 *
 * Finds pivot highs and pivot lows ("Left Bars" bars before and "Right Bars" bars after the pivot bar) and joins each
 * new pivot to the pivot before it on the same side:
 * - a pivot high below the pivot high before it gives a downtrend line through the two highs;
 * - a pivot low above the pivot low before it gives an uptrend line through the two lows.
 * A new line is extended to the right. The slope of each line (price change per bar) is compared with the slope of
 * the line before it: when the new downtrend line is less steep, the line before stops at its second pivot; when it
 * is steeper, the new line itself is not extended (the same rule, mirrored, for uptrend lines). A pivot that does not
 * give a line resets the slope. With "Show Old Line as Dashed" the line of the pivot before becomes dashed when the
 * next pivot of that side arrives.
 *
 * Each pivot is marked with an "H" above its bar or an "L" below it. At most 50 lines are kept.
 *
 * Reference: "Trend Lines" by LonesomeTheBlue
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LonesomeTheBlue
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LineDrawingData, MarkerData } from '../types';
import { barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TrendLinesInputs {
  /** Bars before the pivot bar */
  lb: number;
  /** Bars after the pivot bar */
  rb: number;
  showpivot: boolean;
  chdashed: boolean;
  ucolor: string;
  dcolor: string;
}

export const defaultInputs: TrendLinesInputs = {
  lb: 30,
  rb: 30,
  showpivot: true,
  chdashed: true,
  ucolor: '#00E676',
  dcolor: '#FF5252',
};

export const inputConfig: InputConfig[] = [
  { id: 'lb', type: 'int', title: 'Left Bars', defval: 30, min: 1 },
  { id: 'rb', type: 'int', title: 'Right Bars', defval: 30, min: 1 },
  { id: 'showpivot', type: 'bool', title: 'Show Pivot Points', defval: true },
  { id: 'chdashed', type: 'bool', title: 'Show Old Line as Dashed', defval: true },
  { id: 'ucolor', type: 'color', title: 'Uptrend line color', defval: '#00E676' },
  { id: 'dcolor', type: 'color', title: 'Downtrend line color', defval: '#FF5252' },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Trend Lines',
  shortTitle: 'Trend Lines',
  overlay: true,
};

/** Default number of lines kept */
const MAX_LINES = 50;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
/** `x != 0` (false when x is na) */
const nonZero = (x: number) => !isNaN(x) && Math.abs(x) > EPS;

interface Ln {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  extend: 'right' | 'none';
  dashed: boolean;
  deleted: boolean;
}

type Result = Omit<IndicatorResult, 'lines' | 'markers'> & { lines: LineDrawingData[]; markers: MarkerData[] };

/** The state of one side (pivot highs or pivot lows) */
interface Side {
  /** bst / bsb */
  since: number;
  /** t_angle / b_angle: na on the first bar, then carried */
  angle: number;
  /** `line tline = na` inside the `if` block: tline[1] is the value the block gave it the last time it ran */
  lineBefore: Ln | null;
}

interface TlVars {
  /** Lines in creation order (the deleted ones are out) */
  lines: Ln[];
  top: Side;
  bot: Side;
}

interface TlRun extends BarRunState<TlVars> {
  ph: PivotStep;
  pl: PivotStep;
  /** valuewhen(top, top, 1), valuewhen(bot, bot, 1) */
  ltop: ReturnType<typeof taStep.valuewhen>;
  lbot: ReturnType<typeof taStep.valuewhen>;
  markers: MarkerData[];
}

function study(inputs: Partial<TrendLinesInputs>): BarStudy<TlRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const lb = Math.trunc(cfg.lb);
  const rb = Math.trunc(cfg.rb);
  const mb = lb + rb + 1;
  const labelColor = String(color.new('#FFFFFF', 100));

  /** Lines in creation order: when a creation brings the count above max + 5, the oldest are deleted until max remain */
  const newLine = (lines: Ln[], l: Omit<Ln, 'deleted'>): Ln => {
    const o = { ...l, deleted: false };
    lines.push(o);
    if (lines.length > MAX_LINES + 5) for (const old of lines.splice(0, lines.length - MAX_LINES)) old.deleted = true;
    return o;
  };

  /** One bar of one side: pivot highs (downtrend lines) or pivot lows (uptrend lines) */
  const sideBar = (s: TlRun, sd: Side, isTop: boolean, i: number, bars: Bar[], p: number, last: number) => {
    const price = (j: number) => (j >= 0 ? (isTop ? bars[j].high : bars[j].low) : NaN);
    const css = isTop ? cfg.dcolor : cfg.ucolor;
    const isPivot = nonZero(p);
    const sinceBefore = sd.since;
    sd.since = isPivot ? 1 : (isNaN(sinceBefore) ? 0 : sinceBefore) + 1;
    const angleBefore = sd.angle;

    if (isPivot && cfg.showpivot) {
      const time = barTime(bars, i - rb);
      s.markers.push(isTop
        ? { time, position: 'aboveBar', shape: 'labelDown', color: labelColor, text: 'H', textColor: '#FF5252' }
        : { time, position: 'belowBar', shape: 'labelUp', color: labelColor, text: 'L', textColor: '#00E676' });
    }

    if (isNaN(last) || isNaN(p)) return;
    let line: Ln | null = null;
    const lineBefore = sd.lineBefore;
    if (isTop ? gt(last, p) : lt(last, p)) {
      const y1 = price(i - sinceBefore - rb);
      const y2 = price(i - rb);
      line = newLine(s.vars.lines, { x1: i - sinceBefore - rb, y1, x2: i - rb, y2, color: css, extend: 'right', dashed: false });
      sd.angle = (y1 - y2) / sinceBefore;
      const flatter = isTop ? lt(sd.angle, angleBefore) : gt(sd.angle, angleBefore);
      const steeper = isTop ? gt(sd.angle, angleBefore) : lt(sd.angle, angleBefore);
      if (flatter && nonZero(angleBefore) && lineBefore && !lineBefore.deleted) lineBefore.extend = 'none';
      if (steeper && nonZero(angleBefore)) line.extend = 'none';
    }
    if (isTop ? !gt(last, p) : !lt(last, p)) sd.angle = 0;
    if (cfg.chdashed && lineBefore && !lineBefore.deleted) lineBefore.dashed = true;
    sd.lineBefore = line;
  };

  return {
    init() {
      // highestbars(high, mb) == -rb: the newest highest of the last mb values is on the bar rb bars back
      const ph = new PivotStep(lb, rb, true);
      const pl = new PivotStep(lb, rb, false);
      const ltop = taStep.valuewhen(1);
      const lbot = taStep.valuewhen(1);
      const side = (): Side => ({ since: NaN, angle: NaN, lineBefore: null });
      const s: TlRun = {
        ph, pl, ltop, lbot, markers: [], steps: [ph, pl, ltop, lbot],
        vars: { lines: [], top: side(), bot: side() }, lists: [], series: [],
      };
      s.lists = [s.markers];
      return s;
    },
    copyVars(v) {
      // the lines are changed in place: copied with the line of each side (a deleted line is never changed again)
      const copies = new Map<Ln, Ln>();
      const lines = v.lines.map((l) => {
        const c = { ...l };
        copies.set(l, c);
        return c;
      });
      const side = (sd: Side): Side => ({
        since: sd.since, angle: sd.angle, lineBefore: sd.lineBefore ? (copies.get(sd.lineBefore) ?? sd.lineBefore) : null,
      });
      return { lines, top: side(v.top), bot: side(v.bot) };
    },
    bar(s, i, bars) {
      const b = bars[i];
      const isHigh = !Number.isNaN(s.ph.step(i, b.high));
      const isLow = !Number.isNaN(s.pl.step(i, b.low));
      // top := not na(high[mb]) ? (highestbars(high, mb) == -rb ? high[rb] : na) : na
      const top = i >= mb && !isNaN(bars[i - mb].high) && isHigh ? bars[i - rb].high : NaN;
      const bot = i >= mb && !isNaN(bars[i - mb].low) && isLow ? bars[i - rb].low : NaN;
      // valuewhen(top, top, 1): the pivot before the latest one (a float is true when it is not na and not 0)
      const ltop = s.ltop.step(nonZero(top) ? 1 : 0, top);
      const lbot = s.lbot.step(nonZero(bot) ? 1 : 0, bot);
      sideBar(s, s.vars.top, true, i, bars, top, ltop);
      sideBar(s, s.vars.bot, false, i, bars, bot, lbot);
    },
    result(s, bars) {
      const markers = s.markers.slice().sort((a, b) => a.time - b.time);
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers,
        // a line with an na coordinate is not drawn
        lines: s.vars.lines.filter((l) => !isNaN(l.y1) && !isNaN(l.y2) && !isNaN(l.x1)).map((l) => ({
          time1: barTime(bars, l.x1), price1: l.y1, time2: barTime(bars, l.x2), price2: l.y2, color: l.color, extend: l.extend,
          ...(l.dashed ? { style: 'dashed' as const } : {}),
        })),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TrendLinesInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TrendLinesInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const TrendLines = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
