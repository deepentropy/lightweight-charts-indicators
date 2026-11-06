/**
 * Cup Finder
 *
 * Looks for cup shapes: a half circle of prices between an earlier extreme and the current bar.
 * - Bullish cup: the current bar breaks above a high that is 20 to `Number of Bars to search` bars back, that high was
 *   the highest of its last 30 bars, no bar in between was higher, and the previous close was still below it.
 *   Bearish cup: the mirror with lows (only searched when no bullish cup starts on the bar).
 * - The cup is a half circle from that bar to the current bar. Its height unit is 1 % of the range (highest high -
 *   lowest low) of the last 292 bars, so the circle keeps the same look on any price scale.
 * - The cup is kept when enough bars touch the band around the half circle (`Channel Width of the Cup` units on
 *   each side): at least `Contained Bar Rate %` of the bars.
 * - Drawings: the half circle (lines of width 3), a dashed line between its two ends, the optional channel lines, and
 *   a label with the radius and the rate of contained bars.
 *
 * At most 500 lines and 50 labels are kept (the oldest are removed).
 *
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Cup Found', 'Bearish Cup Found' and 'Cup Found' (either),
 * true on the bars where a cup is kept; the messages read the hidden "included" plot.
 *
 * Chart values (third argument): the port reads the symbol tick (the radius in the label is rounded to the tick;
 * without it: 0.01).
 *
 * Reference: "Cup Finder" by LonesomeTheBlue
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LonesomeTheBlue
 */

import { str, math, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LabelData, LineDrawingData } from '../types';
import { mintickOf, type ChartContext } from '../chart-context';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CupFinderInputs {
  /** Number of bars to search */
  loopback: number;
  /** Channel width of the cup */
  widthr: number;
  /** Source for the breakout */
  checkHc: 'Close' | 'High/Low';
  /** Contained bar rate % */
  includeRate: number;
  showChannel: boolean;
  noLabel: boolean;
  removeOldLines: boolean;
  removeOldLabels: boolean;
  bullColor: string;
  bearColor: string;
}

export const defaultInputs: CupFinderInputs = {
  loopback: 150,
  widthr: 5,
  checkHc: 'Close',
  includeRate: 75,
  showChannel: false,
  noLabel: false,
  removeOldLines: false,
  removeOldLabels: false,
  bullColor: '#00E676',
  bearColor: '#FF5252',
};

export const inputConfig: InputConfig[] = [
  { id: 'loopback', type: 'int', title: 'Number of Bars to search', defval: 150, min: 30, max: 250 },
  { id: 'widthr', type: 'float', title: 'Channel Width of the Cup', defval: 5, min: 1 },
  { id: 'checkHc', type: 'string', title: 'Source for Breakout', defval: 'Close', options: ['Close', 'High/Low'] },
  { id: 'includeRate', type: 'float', title: 'Contained Bar Rate %', defval: 75, min: 10, max: 100 },
  { id: 'showChannel', type: 'bool', title: 'Show Channels of Cups', defval: false },
  { id: 'noLabel', type: 'bool', title: "Don't Show Labels", defval: false },
  { id: 'removeOldLines', type: 'bool', title: 'Remove Old Lines', defval: false },
  { id: 'removeOldLabels', type: 'bool', title: 'Remove Old Labels', defval: false },
  { id: 'bullColor', type: 'color', title: 'Colors', defval: '#00E676', inline: 'colors' },
  { id: 'bearColor', type: 'color', title: '', defval: '#FF5252', inline: 'colors' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'included', color: '#2196F3', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Cup Finder',
  shortTitle: 'CF',
  overlay: true,
};

/** study(max_lines_count = 500); labels: the default limit */
const MAX_LINES = 500;
const MAX_LABELS = 50;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => a - b >= -EPS;
const le = (a: number, b: number) => b - a >= -EPS;

interface Ln { x1: number; y1: number; x2: number; y2: number; color: string; dashed: boolean; width: number; deleted: boolean }
interface Lb { x: number; y: number; text: string; bull: boolean; deleted: boolean }

/**
 * ta.highestbars(source, 30) == 0 (lowestbars): the value of the bar is finite and no value of the window (the last
 * 30 finite values, this one included) beats it; the newest of equal values is the extreme (the oakscriptjs rules)
 */
function extremeIsCurrent(bars: Bar[], i: number, length: number, lowest: boolean): boolean {
  if (i < length - 1) return false;
  const x = lowest ? bars[i].low : bars[i].high;
  if (!Number.isFinite(x)) return false;
  let kept = 1;
  for (let j = i - 1; j >= 0 && kept < length; j--) {
    const v = lowest ? bars[j].low : bars[j].high;
    if (!Number.isFinite(v)) continue;
    kept++;
    if (lowest ? v < x : v > x) return false;
  }
  return true;
}

type Result = IndicatorResult & { lines: LineDrawingData[]; labels: LabelData[]; alerts: AlertConditionState[] };

interface CupVars {
  /** Live drawings in creation order */
  liveLines: Ln[];
  liveLabels: Lb[];
  cupLabel: Lb | null;
  /** var cup_lines (its deleted lines are left out: deleting them again does nothing) */
  cupLines: Ln[];
}

interface CupRun extends BarRunState<CupVars> {
  hi292: WindowExtreme;
  lo292: WindowExtreme;
  highestBar: boolean[];
  lowestBar: boolean[];
  points: { time: number; value: number }[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<CupFinderInputs>): BarStudy<CupRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const loopback = Math.trunc(cfg.loopback);
  const includeRate = cfg.includeRate / 100;
  const byClose = cfg.checkHc === 'Close';
  let mintick = 0.01;
  return {
    init(_bars, chart) {
      mintick = mintickOf(chart);
      const s: CupRun = {
        hi292: new WindowExtreme(false, 292), lo292: new WindowExtreme(true, 292), highestBar: [], lowestBar: [],
        points: [], flags: [[], [], []], times: [[], [], []],
        steps: [], vars: { liveLines: [], liveLabels: [], cupLabel: null, cupLines: [] }, lists: [], series: [],
      };
      s.steps = [s.hi292, s.lo292];
      s.lists = s.times;
      s.series = [s.highestBar, s.lowestBar, s.points, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      // Live drawings in creation order: above max + 5 objects the oldest are deleted until max remain. The label held
      // by the `var` variable is not deleted by this limit, but it counts.
      const liveLines = v.liveLines;
      const liveLabels = v.liveLabels;
      const newLine = (x1: number, y1: number, x2: number, y2: number, color: string, dashed: boolean, width: number): Ln => {
        const o: Ln = { x1, y1, x2, y2, color, dashed, width, deleted: false };
        liveLines.push(o);
        if (liveLines.length > MAX_LINES + 5) for (const old of liveLines.splice(0, liveLines.length - MAX_LINES)) old.deleted = true;
        return o;
      };
      const { high, low, close, time } = bars[i];
      const H = (x: number) => (i - x >= 0 ? bars[i - x].high : NaN);
      const L = (x: number) => (i - x >= 0 ? bars[i - x].low : NaN);
      const prevClose = i > 0 ? bars[i - 1].close : NaN;
      const hi292 = s.hi292.step(high);
      const lo292 = s.lo292.step(low);
      // highestbars(30) == 0, lowestbars(30) == 0
      s.highestBar[i] = extremeIsCurrent(bars, i, 30, false);
      s.lowestBar[i] = extremeIsCurrent(bars, i, 30, true);
      let included = NaN;
      let bullishCup = false;
      let bearishCup = false;

      // Unit of the circle height
      const width = (hi292 - lo292) / 100;
      const uwidth = width * cfg.widthr;
      const bullSrc = byClose ? close : high;
      const bearSrc = byClose ? close : low;

      let hh = 0;
      let lasthh = 0;
      let ind = 0;
      let bull = false;
      for (let x = 1; x <= loopback; x++) {
        // max() with an na value is na
        const hx = H(x);
        lasthh = isNaN(lasthh) || isNaN(hx) ? NaN : Math.max(lasthh, hx);
        if (le(bullSrc, lasthh)) break;
        if (x >= 20 && gt(bullSrc, hx) && lt(prevClose, hx) && ge(hx, lasthh) && s.highestBar[i - x]) {
          hh = hx;
          ind = x;
          bull = true;
        }
      }

      let ll = 0;
      let lastll = hi292;
      if (ind === 0) {
        for (let x = 1; x <= loopback; x++) {
          const lx = L(x);
          lastll = isNaN(lastll) || isNaN(lx) ? NaN : Math.min(lastll, lx);
          if (ge(bearSrc, lastll)) break;
          if (x >= 20 && lt(bearSrc, lx) && gt(prevClose, lx) && le(lx, lastll) && s.lowestBar[i - x]) {
            ll = lx;
            ind = x;
          }
        }
      }

      cup: if (ind !== 0) {
        // Half circle: levs[x] is the level of the bar x bars back (ind + 1 levels)
        const levs: number[] = [];
        const powRadius = (ind / 2) ** 2; // a float division, also for an odd number of bars
        const end = (ind - (ind % 2)) / 2;
        const level = (ycoord: number) => (bull ? hh - ycoord : ll + ycoord);
        if (ind % 2 === 0) levs.push(level(Math.sqrt(powRadius) * width));
        for (let x = 1; x <= end; x++) {
          const y = level(Math.sqrt(powRadius - x * x) * width);
          levs.push(y);
          levs.unshift(y);
        }
        if (ind % 2 === 1) {
          levs.push(bull ? hh : ll);
          levs.unshift(bull ? hh : ll);
        }

        let inCnt = 0;
        for (let x = 0; x < levs.length; x++) {
          const top = Math.min(levs[x] + uwidth, H(x));
          const bottom = Math.max(levs[x] - uwidth, L(x));
          if (gt(top - bottom, 0)) inCnt++;
        }

        if (!ge(inCnt / (ind + 1), includeRate)) break cup;
        const css = bull ? cfg.bullColor : cfg.bearColor;
        if (!cfg.noLabel) {
          if (cfg.removeOldLabels && v.cupLabel && !v.cupLabel.deleted) {
            v.cupLabel.deleted = true;
            liveLabels.splice(liveLabels.indexOf(v.cupLabel), 1);
          }
          const rounded = math.round((width * ind) / 2 / mintick) * mintick;
          const cupLabel: Lb = {
            x: i, y: levs[0], bull, deleted: false,
            text: `Cup\nRadius = ${str.tostring(rounded)}\nIncluded = ${str.tostring((100 * inCnt) / (ind + 1), '#.#')}%`,
          };
          v.cupLabel = cupLabel;
          liveLabels.push(cupLabel);
          if (liveLabels.length > MAX_LABELS + 5) {
            for (let k = 0; k < liveLabels.length && liveLabels.length > MAX_LABELS; ) {
              if (liveLabels[k] === cupLabel) k++;
              else liveLabels.splice(k, 1)[0].deleted = true;
            }
          }
        }

        if (cfg.removeOldLines) {
          for (const l of v.cupLines) {
            if (l.deleted) continue;
            l.deleted = true;
            liveLines.splice(liveLines.indexOf(l), 1);
          }
          v.cupLines.length = 0;
        }

        const cupLines = v.cupLines;
        cupLines.push(newLine(i, levs[0], i - ind + 1, levs[0], css, true, 1));
        let xloc = ind;
        for (let x = 0; x <= levs.length - 2; x++) {
          cupLines.push(newLine(i - xloc, levs[x], i - xloc + 1, levs[x + 1], css, false, 3));
          if (cfg.showChannel && x % 2 === 0 && x > 0 && x < levs.length - 2) {
            cupLines.push(newLine(i - xloc, levs[x] + uwidth, i - xloc + 1, levs[x + 1] + uwidth, css, false, 1));
            cupLines.push(newLine(i - xloc, levs[x] - uwidth, i - xloc + 1, levs[x + 1] - uwidth, css, false, 1));
          }
          xloc--;
        }

        included = math.round((100 * inCnt) / (ind + 1));
        if (bull) bullishCup = true;
        else bearishCup = true;
      }
      s.points[i] = { time, value: included };
      // alertcondition(bullish_cup) / alertcondition(bearish_cup) / alertcondition(bullish_cup or bearish_cup)
      const flags = [bullishCup, bearishCup, bullishCup || bearishCup];
      for (let k = 0; k < 3; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(time as number);
      }
    },
    copyVars: (v) => {
      const copies = new Map<Ln, Ln>();
      const liveLines = v.liveLines.map((l) => {
        const c = { ...l };
        copies.set(l, c);
        return c;
      });
      let cupLabel: Lb | null = null;
      const liveLabels = v.liveLabels.map((l) => {
        const c = { ...l };
        if (l === v.cupLabel) cupLabel = c;
        return c;
      });
      // a deleted label is not in the list: deleting it again does nothing
      if (v.cupLabel && !cupLabel) cupLabel = { ...v.cupLabel };
      const cupLines: Ln[] = [];
      for (const l of v.cupLines) {
        const c = copies.get(l);
        if (c) cupLines.push(c);
      }
      return { liveLines, liveLabels, cupLabel, cupLines };
    },
    result(s, bars) {
      const n = bars.length;
      const { liveLines, liveLabels } = s.vars;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.points.slice() },
        lines: liveLines.map((l) => ({
          time1: bars[l.x1].time, price1: l.y1, time2: bars[l.x2].time, price2: l.y2, color: l.color,
          ...(l.dashed ? { style: 'dashed' as const } : {}),
          ...(l.width !== 1 ? { width: l.width } : {}),
        })),
        labels: liveLabels.map((l) => ({
          time: bars[l.x].time, price: l.y, text: l.text,
          color: l.bull ? cfg.bullColor : cfg.bearColor,
          textColor: l.bull ? '#363A45' : '#FFFFFF',
          style: l.bull ? ('label_lower_right' as const) : ('label_upper_right' as const),
          textAlign: 'left' as const,
        })),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CupFinderInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CupFinderInputs> = {}, chart?: ChartContext): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Cup Found', message: 'Bullish Cup Found, Included:{{plot("included")}}' },
  { id: 'alert1', title: 'Bearish Cup Found', message: 'Bearish Cup Found, Included:{{plot("included")}}' },
  { id: 'alert2', title: 'Cup Found', message: 'Cup Found, Included:{{plot("included")}}' },
];

export const CupFinder = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
