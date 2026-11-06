/**
 * Fibonacci Ranges (Real-Time) [LuxAlgo]
 *
 * Fibonacci channels between the two latest swings, kept until the price breaks out.
 * - Swings: pivot highs and lows ("L" bars before, "R" bars after). A pivot in the direction of the latest swing
 *   that goes further replaces it; a pivot in the other direction starts a new swing.
 * - When no channel is active and a pivot is confirmed, a channel is drawn from the pivot to the swing before the
 *   latest one: nine horizontal levels (-0.382, 0, 0.236, 0.382, 0.5, 0.618, 0.764, 1 and 1.382 of the distance),
 *   a dashed diagonal between the two points and two small labels at the break levels. The levels follow the
 *   current bar (8 bars ahead).
 * - The channel ends when the close stays outside the "Break level" pair for more than "Break count" consecutive
 *   bars. A label marks the bar of the break (above the bar when it breaks up, below when it breaks down).
 * - The nine plots carry the level values (they are fully transparent); "Channel + Shadows" fills between them with
 *   gradients from the level colour to nothing.
 * - "Latest Fibonacci": the retracement of the latest two swings, with four filled areas, a middle line, a
 *   diagonal and a label on the latest swing.
 * - Alerts (alertcondition, `alerts` of the result): 'break Up' / 'break Down', true on the bars where a channel that
 *   was active on the bar before breaks up / down (the bars of the break labels, also when they are hidden).
 *
 * Chart values (third argument): the port reads the chart background colour (the transparent end of the gradient
 * fills; without it: #0F0F0F, a dark chart).
 *
 * Reference: "Fibonacci Ranges (Real-Time) [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LabelData, LineDrawingData, LinefillData, MarkerData } from '../types';
import { barInterval, barTime } from '../bar-time';
import { backgroundColorOf, type ChartContext } from '../chart-context';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import { createBarRun, fullResult, liveAlertStates, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface FibonacciRangesInputs {
  /** Bars before a pivot */
  L: number;
  /** Bars after a pivot */
  R: number;
  channel: 'Channel' | 'Channel + Shadows' | 'None';
  /** Pair of levels that the close has to leave */
  breakLevel: '-0.382 - 1.382' | '0.000 - 1.000' | '0.236 - 0.764' | '0.382 - 0.618';
  /** Consecutive closes outside the levels that are allowed */
  breakCount: number;
  showBreaks: boolean;
  /** Latest Fibonacci */
  latestFibonacci: boolean;
  color0: string;
  colorLow: string;
  colorMid: string;
  colorHigh: string;
  color1: string;
}

export const defaultInputs: FibonacciRangesInputs = {
  L: 5,
  R: 1,
  channel: 'Channel + Shadows',
  breakLevel: '0.000 - 1.000',
  breakCount: 2,
  showBreaks: true,
  latestFibonacci: false,
  color0: 'rgba(8, 153, 129, 0.39)',
  colorLow: 'rgba(8, 153, 129, 0.5)',
  colorMid: 'rgba(30, 66, 176, 0.44)',
  colorHigh: 'rgba(242, 54, 69, 0.5)',
  color1: 'rgba(242, 54, 69, 0.39)',
};

export const inputConfig: InputConfig[] = [
  { id: 'L', type: 'int', title: 'L', defval: 5, min: 1, group: 'Swing Settings' },
  { id: 'R', type: 'int', title: 'R', defval: 1, min: 1, group: 'Swing Settings' },
  { id: 'channel', type: 'string', title: 'Channel', defval: 'Channel + Shadows', options: ['Channel', 'Channel + Shadows', 'None'], group: 'Fibonacci Channel' },
  { id: 'breakLevel', type: 'string', title: 'Break level', defval: '0.000 - 1.000', options: ['-0.382 - 1.382', '0.000 - 1.000', '0.236 - 0.764', '0.382 - 0.618'], group: 'Fibonacci Channel' },
  { id: 'breakCount', type: 'int', title: 'Break count', defval: 2, min: 0, group: 'Fibonacci Channel' },
  { id: 'showBreaks', type: 'bool', title: '                    Show breaks', defval: true, group: 'Fibonacci Channel' },
  { id: 'latestFibonacci', type: 'bool', title: '                 Latest Fibonacci', defval: false, group: 'Fibonacci' },
  { id: 'color0', type: 'color', title: '      ', defval: 'rgba(8, 153, 129, 0.39)', inline: 'f', group: 'Fibonacci' },
  { id: 'colorLow', type: 'color', title: '', defval: 'rgba(8, 153, 129, 0.5)', inline: 'f', group: 'Fibonacci' },
  { id: 'colorMid', type: 'color', title: '', defval: 'rgba(30, 66, 176, 0.44)', inline: 'f', group: 'Fibonacci' },
  { id: 'colorHigh', type: 'color', title: '', defval: 'rgba(242, 54, 69, 0.5)', inline: 'f', group: 'Fibonacci' },
  { id: 'color1', type: 'color', title: '', defval: 'rgba(242, 54, 69, 0.39)', inline: 'f', group: 'Fibonacci' },
];

/** color.new(color.blue, 100): the plots only carry the values for the fills */
const HIDDEN = String(color.new('#2962FF', 100));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '-0.382', color: HIDDEN, lineWidth: 1, style: 'steplinebr' },
  { id: 'plot1', title: '0.000', color: HIDDEN, lineWidth: 1, style: 'steplinebr' },
  { id: 'plot2', title: '0.236', color: HIDDEN, lineWidth: 1, style: 'steplinebr' },
  { id: 'plot3', title: '0.382', color: HIDDEN, lineWidth: 1, style: 'steplinebr' },
  { id: 'plot4', title: '0.500', color: HIDDEN, lineWidth: 1, style: 'steplinebr' },
  { id: 'plot5', title: '0.618', color: HIDDEN, lineWidth: 1, style: 'steplinebr' },
  { id: 'plot6', title: '0.764', color: HIDDEN, lineWidth: 1, style: 'steplinebr' },
  { id: 'plot7', title: '1.000', color: HIDDEN, lineWidth: 1, style: 'steplinebr' },
  { id: 'plot8', title: '1.382', color: HIDDEN, lineWidth: 1, style: 'steplinebr' },
];

export const metadata = {
  title: 'Fibonacci Ranges (Real-Time) [LuxAlgo]',
  shortTitle: 'LuxAlgo - Fibonacci Ranges (Real-Time)',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** color.gray, color.silver and color.blue of Pine v5, and the default label text colour */
const GRAY = '#787B86';
const SILVER = '#B2B5BE';
const BLUE = '#2962FF';
const LABEL_TEXT = '#363A45';

interface Ln { x1: number; y1: number; x2: number; y2: number; color: string; dashed?: boolean }
interface Lb { x: number; y: number; style: 'label_center' | 'label_up' | 'label_down'; size: 'tiny' | 'normal' }
/** Pine type piv: bar, price, direction */
interface Piv { b: number; p: number; d: number }

const newLine = (css: string, dashed = false): Ln => ({ x1: NaN, y1: NaN, x2: NaN, y2: NaN, color: css, dashed });
const setXy1 = (l: Ln, x: number, y: number) => { l.x1 = x; l.y1 = y; };
const setXy2 = (l: Ln, x: number, y: number) => { l.x2 = x; l.y2 = y; };
/** math.avg(a, b) */
const avg = (a: number, b: number) => (a + b) / 2;

type Result = Omit<IndicatorResult, 'markers' | 'lines' | 'labels' | 'linefills'> & {
  markers: MarkerData[]; lines: LineDrawingData[]; labels: LabelData[]; linefills: LinefillData[];
} & { alerts: AlertConditionState[] };

interface FibVars {
  /** var f = fib.new(...): the nine levels, the diagonal and the two labels of the channel */
  levels: Ln[];
  diagon: Ln;
  lab1: Lb;
  lab2: Lb;
  active: boolean;
  count: number;
  /** var fibLast fLast = fibLast.new(...): four filled pairs of lines and the middle line, the diagonal, the label */
  lastLines: Ln[];
  lastDiagon: Ln;
  lastLab: Lb;
  /** The two latest swings of the array of pivots (newest first: only these two are read) */
  pivs: Piv[];
  /** f.active[1] */
  prevActive: boolean;
  /** plot_0_000[1] */
  prev0: number;
}

interface FibRun extends BarRunState<FibVars> {
  ph: PivotStep;
  pl: PivotStep;
  plots: Array<Array<{ time: number; value: number }>>;
  /** Top and bottom values of the ten gradient fills */
  tops: number[][];
  bottoms: number[][];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
}

/** array.unshift(pivs, p), keeping the two newest */
const unshiftPiv = (pivs: Piv[], p: Piv) => {
  pivs.unshift(p);
  if (pivs.length > 2) pivs.length = 2;
};

const copyLn = (l: Ln): Ln => ({ ...l });
const copyLb = (l: Lb): Lb => ({ ...l });

function study(inputs: Partial<FibonacciRangesInputs>): BarStudy<FibRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const L = Math.trunc(cfg.L);
  const R = Math.trunc(cfg.R);
  const c = Math.trunc(cfg.breakCount);
  const sF = cfg.latestFibonacci;
  const Fc = cfg.channel !== 'None';
  const fl = cfg.channel === 'Channel + Shadows';
  const { color0: F0, colorLow: F_, colorMid: Fm, colorHigh: Fp, color1: F1 } = cfg;
  const opt = cfg.breakLevel;
  const a1 = opt === '-0.382 - 1.382' ? -0.382 : opt === '0.000 - 1.000' ? 0 : opt === '0.236 - 0.764' ? 0.236 : 0.382;
  const a2 = opt === '-0.382 - 1.382' ? 1.382 : opt === '0.000 - 1.000' ? 1 : opt === '0.236 - 0.764' ? 0.764 : 0.618;
  const lv1k = opt === '0.000 - 1.000' ? 1 : opt === '0.236 - 0.764' ? 2 : opt === '0.382 - 0.618' ? 3 : 0;
  const lv2k = opt === '0.000 - 1.000' ? 7 : opt === '0.236 - 0.764' ? 6 : opt === '0.382 - 0.618' ? 5 : 8;
  let clear = '';
  return {
    init(_bars, chart) {
      clear = String(color.new(backgroundColorOf(chart), 100));
      const s: FibRun = {
        ph: new PivotStep(L, R, true), pl: new PivotStep(L, R, false),
        plots: Array.from({ length: 9 }, () => []),
        tops: Array.from({ length: 10 }, () => []), bottoms: Array.from({ length: 10 }, () => []),
        flags: [[], []], times: [[], []], markers: [],
        steps: [],
        vars: {
          levels: [newLine(F0), newLine(F0), newLine(F_), newLine(F_), newLine(Fm), newLine(Fp), newLine(Fp), newLine(F1), newLine(F1)],
          diagon: newLine(SILVER, true),
          lab1: { x: NaN, y: NaN, style: 'label_center', size: 'tiny' },
          lab2: { x: NaN, y: NaN, style: 'label_center', size: 'tiny' },
          active: false,
          count: 0,
          // l0_1, l0_2, lM01, lM02, lM11, lM12, l1_1, l1_2, ln_0_5
          lastLines: [newLine(F0), newLine(F0), newLine(F_), newLine(F_), newLine(Fp), newLine(Fp), newLine(F1), newLine(F1), newLine(BLUE)],
          lastDiagon: newLine(SILVER, true),
          lastLab: { x: NaN, y: NaN, style: 'label_down', size: 'normal' },
          pivs: [],
          prevActive: false,
          prev0: NaN,
        },
        lists: [], series: [],
      };
      s.steps = [s.ph, s.pl];
      s.lists = [s.markers, ...s.times];
      s.series = [...s.plots, ...s.tops, ...s.bottoms, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const { high, low, close } = bars[i];
      const ph = s.ph.step(i, high);
      const pl = s.pl.step(i, low);
      const isPh = !Number.isNaN(ph) && ph !== 0;
      const isPl = !Number.isNaN(pl) && pl !== 0;
      let brokeU = false;
      let brokeD = false;
      const levels = v.levels;
      const pivs = v.pivs;

      if (isPh) {
        const hR = bars[i - R].high;
        if (pivs.length > 0) {
          const get = pivs[0];
          if (get.d > 0 && gt(ph, get.p)) {
            get.b = i - R;
            get.p = hR;
          }
          if (get.d < 0 && gt(ph, get.p)) unshiftPiv(pivs, { b: i - R, p: hR, d: 1 });
        } else {
          unshiftPiv(pivs, { b: i - R, p: hR, d: 1 });
        }
        if (pivs.length > 1 && !v.active && Fc) {
          const get1 = pivs[1];
          const diff = hR - get1.p;
          const ys = [hR + diff * 0.382, hR, hR - diff * 0.236, hR - diff * 0.382, hR - diff * 0.5, hR - diff * 0.618,
            hR - diff * 0.764, get1.p, get1.p - diff * 0.382];
          levels.forEach((l, k) => { setXy1(l, i - R, ys[k]); setXy2(l, i + 8, ys[k]); });
          v.lab1.x = i + 8; v.lab1.y = hR - diff * a1;
          v.lab2.x = i + 8; v.lab2.y = hR - diff * a2;
          setXy1(v.diagon, get1.b, get1.p);
          setXy2(v.diagon, i - R, hR);
          v.active = true;
        }
      }

      if (isPl) {
        const lR = bars[i - R].low;
        if (pivs.length > 0) {
          const get = pivs[0];
          if (get.d < 0 && lt(pl, get.p)) {
            get.b = i - R;
            get.p = lR;
          }
          if (get.d > 0 && lt(pl, get.p)) unshiftPiv(pivs, { b: i - R, p: lR, d: -1 });
        } else {
          unshiftPiv(pivs, { b: i - R, p: lR, d: -1 });
        }
        if (pivs.length > 1 && !v.active && Fc) {
          const get1 = pivs[1];
          const diff = get1.p - lR;
          const ys = [lR - diff * 0.382, lR, lR + diff * 0.236, lR + diff * 0.382, lR + diff * 0.5, lR + diff * 0.618,
            lR + diff * 0.764, get1.p, get1.p + diff * 0.382];
          levels.forEach((l, k) => { setXy1(l, i - R, ys[k]); setXy2(l, i + 8, ys[k]); });
          v.lab1.x = i + 8; v.lab1.y = lR + diff * a1;
          v.lab2.x = i + 8; v.lab2.y = lR + diff * a2;
          setXy1(v.diagon, get1.b, get1.p);
          setXy2(v.diagon, i - R, lR);
          v.active = true;
        }
      }

      if (pivs.length >= 2) {
        const p0 = pivs[0];
        const p1 = pivs[1];
        const dif = Math.max(p0.p, p1.p) - Math.min(p0.p, p1.p);
        const d = lt(p0.p, p1.p) ? -dif : dif;
        if ((isPh || isPl) && sF) {
          // x2 = math.max(last_bar_index, p0.b) + 8; on the last bar it is this bar + 8, and every later bar moves
          // x2 to its own index + 8, so the lines alive after the last bar end at last_bar_index + 8 either way
          const x2 = Math.max(i, p0.b) + 8;
          const [l0_1, l0_2, lM01, lM02, lM11, lM12, l1_1, l1_2, ln_0_5] = v.lastLines;
          const set = (l: Ln, y: number) => { setXy1(l, p0.b, y); setXy2(l, x2, y); };
          set(l0_1, p0.p + d * 0.382);
          set(l0_2, p0.p);
          set(lM01, p0.p - d * 0.236);
          set(lM02, p0.p - d * 0.382);
          set(lM11, p0.p - d * 0.618);
          set(lM12, p0.p - d * 0.764);
          set(l1_1, p0.p - d);
          set(l1_2, p1.p - d * 0.382);
          set(ln_0_5, p0.p - d * 0.5);
          setXy1(v.lastDiagon, p0.b, p0.p);
          setXy2(v.lastDiagon, p1.b, p1.p);
          v.lastLab.x = p0.b;
          v.lastLab.y = p0.p;
          v.lastLab.style = gt(p1.p, p0.p) ? 'label_up' : 'label_down';
        } else {
          for (const l of v.lastLines) l.x2 = i + 8;
        }
      }

      if (v.active) {
        const lv1 = levels[lv1k];
        const lv2 = levels[lv2k];
        const max = Math.max(lv1.y2, lv2.y2);
        const min = Math.min(lv1.y2, lv2.y2);
        if (lt(close, max) && gt(close, min)) v.count = 0;
        else if (gt(close, max) || lt(close, min)) v.count += 1;
        if (v.count > c) {
          for (const l of [...levels, v.diagon]) { setXy1(l, NaN, NaN); setXy2(l, NaN, NaN); }
          v.lab1.x = NaN; v.lab1.y = NaN;
          v.lab2.x = NaN; v.lab2.y = NaN;
          v.active = false;
          if (gt(close, max)) brokeU = true;
          else brokeD = true;
        } else {
          for (const l of levels) l.x2 = i + 8;
          v.lab1.x = i + 8;
          v.lab2.x = i + 8;
        }
      }

      // Plots: the level values, na on the bar where the 0.000 level changes
      const ch = levels[1].y2 - v.prev0;
      const hidden = !Number.isNaN(ch) && Math.abs(ch) > EPS;
      const time = bars[i].time as number;
      for (let k = 0; k < 9; k++) s.plots[k][i] = { time, value: hidden ? NaN : levels[k].y2 };
      v.prev0 = levels[1].y2;

      // Gradient fills: fill(p1, p2, top_value, bottom_value, top_color, bottom_color)
      const vN = levels[0].y2, v0 = levels[1].y2, v236 = levels[2].y2, v382 = levels[3].y2, v500 = levels[4].y2;
      const v618 = levels[5].y2, v764 = levels[6].y2, v1 = levels[7].y2, v1382 = levels[8].y2;
      const on = !(hidden || !fl);
      const { tops, bottoms } = s;
      tops[0][i] = on ? v0 : NaN; bottoms[0][i] = avg(vN, v0);
      tops[1][i] = on ? vN : NaN; bottoms[1][i] = avg(vN, v0);
      tops[2][i] = on ? v236 : NaN; bottoms[2][i] = avg(v382, avg(v382, v236));
      tops[3][i] = on ? avg(v236, avg(v382, v236)) : NaN; bottoms[3][i] = v382;
      tops[4][i] = on ? v382 : NaN; bottoms[4][i] = v500;
      tops[5][i] = on ? v500 : NaN; bottoms[5][i] = v618;
      tops[6][i] = on ? v764 : NaN; bottoms[6][i] = avg(v618, avg(v618, v764));
      tops[7][i] = on ? avg(v764, avg(v618, v764)) : NaN; bottoms[7][i] = v618;
      tops[8][i] = on ? v1 : NaN; bottoms[8][i] = avg(v1382, v1);
      tops[9][i] = on ? v1382 : NaN; bottoms[9][i] = avg(v1382, v1);

      // alertcondition(brokeU and f.active[1]) / alertcondition(brokeD and f.active[1])
      const up = brokeU && v.prevActive;
      const down = brokeD && v.prevActive;
      s.flags[0][i] = up;
      s.flags[1][i] = down;
      if (up) s.times[0].push(time);
      if (down) s.times[1].push(time);
      if (cfg.showBreaks && v.prevActive) {
        if (brokeU && !Number.isNaN(high) && high !== 0) {
          s.markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: '#089981', size: 'tiny' });
        }
        if (brokeD && !Number.isNaN(low) && low !== 0) {
          s.markers.push({ time, position: 'belowBar', shape: 'labelUp', color: '#f23645', size: 'tiny' });
        }
      }
      v.prevActive = v.active;
    },
    copyVars: (v) => ({
      ...v,
      levels: v.levels.map(copyLn),
      diagon: copyLn(v.diagon),
      lab1: copyLb(v.lab1),
      lab2: copyLb(v.lab2),
      lastLines: v.lastLines.map(copyLn),
      lastDiagon: copyLn(v.lastDiagon),
      lastLab: copyLb(v.lastLab),
      pivs: v.pivs.map((p) => ({ ...p })),
    }),
    result(s, bars) {
      const n = bars.length;
      const v = s.vars;
      const cols = (css: string) => new Array<string>(n).fill(css);
      const specs: Array<[string, string, string, string]> = [
        ['plot0', 'plot1', F0, clear], ['plot0', 'plot1', F0, clear], ['plot2', 'plot3', F_, clear], ['plot2', 'plot3', clear, F_],
        ['plot3', 'plot4', clear, Fm], ['plot4', 'plot5', Fm, clear], ['plot5', 'plot6', Fp, clear], ['plot5', 'plot6', clear, Fp],
        ['plot7', 'plot8', F1, clear], ['plot7', 'plot8', F1, clear],
      ];
      const fills = specs.map(([plot1, plot2, top, bottom], k) => ({
        plot1, plot2,
        gradient: { topValue: s.tops[k].slice(), bottomValue: s.bottoms[k].slice(), topColor: cols(top), bottomColor: cols(bottom) },
      }));

      // Drawings alive after the last bar; an object with an na coordinate is not drawn
      const interval = barInterval(bars);
      const T = (index: number) => barTime(bars, index, interval);
      const drawn = (l: Ln) => ![l.x1, l.y1, l.x2, l.y2].some((x) => Number.isNaN(x));
      const toLine = (l: Ln): LineDrawingData => ({
        time1: T(l.x1), price1: l.y1, time2: T(l.x2), price2: l.y2, color: l.color, ...(l.dashed ? { style: 'dashed' as const } : {}),
      });
      const toLabel = (l: Lb): LabelData => ({
        time: T(l.x), price: l.y, text: '', color: GRAY, textColor: LABEL_TEXT, style: l.style, size: l.size,
      });
      const lines: LineDrawingData[] = [];
      const labels: LabelData[] = [];
      const linefills: LinefillData[] = [];
      if (n > 0) {
        for (const l of v.levels) if (drawn(l)) lines.push(toLine(l));
        if (drawn(v.diagon)) lines.push(toLine(v.diagon));
        for (const l of [v.lab1, v.lab2]) if (!Number.isNaN(l.x) && !Number.isNaN(l.y)) labels.push(toLabel(l));
        const [l0_1, l0_2, lM01, lM02, lM11, lM12, l1_1, l1_2, ln_0_5] = v.lastLines;
        const pairs: Array<[Ln, Ln, string]> = [[l0_1, l0_2, F0], [lM01, lM02, F_], [lM11, lM12, Fp], [l1_1, l1_2, F1]];
        for (const [a, b, css] of pairs) {
          if (drawn(a)) lines.push(toLine(a));
          if (drawn(b)) lines.push(toLine(b));
          if (drawn(a) && drawn(b)) linefills.push({ line1: toLine(a), line2: toLine(b), color: String(color.new(css, 75)) });
        }
        if (drawn(ln_0_5)) lines.push(toLine(ln_0_5));
        if (drawn(v.lastDiagon)) lines.push(toLine(v.lastDiagon));
        if (!Number.isNaN(v.lastLab.x) && !Number.isNaN(v.lastLab.y)) labels.push(toLabel(v.lastLab));
      }

      const plots: Record<string, Array<{ time: number; value: number }>> = {};
      for (let k = 0; k < 9; k++) plots[`plot${k}`] = s.plots[k].slice();

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills,
        markers: s.markers.slice(),
        lines,
        labels,
        linefills,
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FibonacciRangesInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<FibonacciRangesInputs> = {},
  chart?: ChartContext,
): Omit<IndicatorResult, 'markers' | 'lines' | 'labels' | 'linefills'> & {
  markers: MarkerData[]; lines: LineDrawingData[]; labels: LabelData[]; linefills: LinefillData[];
} & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs, chart).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'break Up', message: 'break Up' },
  { id: 'alert1', title: 'break Down', message: 'break Donw' },
];

export const FibonacciRanges = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
