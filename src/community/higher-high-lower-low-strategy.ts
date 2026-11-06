/**
 * Higher High Lower Low Strategy
 *
 * Pivot highs and lows ("Left Bars" / "Right Bars") are filtered into a zigzag-like sequence: of two pivots of the
 * same kind in a row the less extreme one is dropped, and a pivot that does not pass the previous opposite pivot is
 * dropped too. Each kept pivot is compared with the four pivots before it (alternating kinds) and gets a label:
 * HH (higher high), LL (lower low), HL (higher low) or LH (lower high), drawn on the pivot bar.
 *
 * Resistance is the last lower high and support the last higher low. The trend is up when the close is above the
 * resistance, down when it is below the support. In an up trend a higher high moves the resistance and a higher low
 * the support; in a down trend a lower high and a lower low do. Each new level is a line from the pivot bar,
 * extended to the right until the level changes again (at most 500 lines are kept). The bars are coloured by the
 * trend.
 *
 * Reference: "Higher High Lower Low Strategy" by LonesomeTheBlue
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LonesomeThecolor.blue
 */

import type { IndicatorResult, InputConfig, PlotConfig, Bar } from 'oakscriptjs';
import type { BarColorData, LineDrawingData, MarkerData } from '../types';
import { barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface HigherHighLowerLowStrategyInputs {
  /** Bars on the left of a pivot */
  lb: number;
  /** Bars on the right of a pivot */
  rb: number;
  showSupRes: boolean;
  supCol: string;
  resCol: string;
  srLineStyle: 'sol' | 'dsh' | 'dot';
  srLineWidth: number;
  changeBarCol: boolean;
  bColUp: string;
  bColDn: string;
}

// Colour constants of Pine version 4
const LIME = '#00E676';
const RED = '#FF5252';
const BLUE = '#2196F3';
const BLACK = '#363A45';
const WHITE = '#FFFFFF';

export const defaultInputs: HigherHighLowerLowStrategyInputs = {
  lb: 5,
  rb: 5,
  showSupRes: true,
  supCol: LIME,
  resCol: RED,
  srLineStyle: 'dot',
  srLineWidth: 3,
  changeBarCol: true,
  bColUp: BLUE,
  bColDn: BLACK,
};

export const inputConfig: InputConfig[] = [
  { id: 'lb', type: 'int', title: 'Left Bars', defval: 5, min: 1 },
  { id: 'rb', type: 'int', title: 'Right Bars', defval: 5, min: 1 },
  { id: 'showSupRes', type: 'bool', title: 'Support/Resistance', defval: true, inline: 'srcol' },
  { id: 'supCol', type: 'color', title: '', defval: LIME, inline: 'srcol' },
  { id: 'resCol', type: 'color', title: '', defval: RED, inline: 'srcol' },
  { id: 'srLineStyle', type: 'string', title: 'Line Style/Width', defval: 'dot', options: ['sol', 'dsh', 'dot'], inline: 'style' },
  { id: 'srLineWidth', type: 'int', title: '', defval: 3, min: 1, max: 5, inline: 'style' },
  { id: 'changeBarCol', type: 'bool', title: 'Change Bar Color', defval: true, inline: 'bcol' },
  { id: 'bColUp', type: 'color', title: '', defval: BLUE, inline: 'bcol' },
  { id: 'bColDn', type: 'color', title: '', defval: BLACK, inline: 'bcol' },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Higher High Lower Low Strategy',
  shortTitle: 'Higher High Lower Low Strategy',
  overlay: true,
};

/** study(max_lines_count = 500) */
const MAX_LINES = 500;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const ge = (a: number, b: number) => gt(a, b) || eq(a, b);
const le = (a: number, b: number) => lt(a, b) || eq(a, b);
const ne = (a: number, b: number) => gt(a, b) || lt(a, b);
/** A number used as a condition: na and 0 are false */
const truthy = (v: number) => !isNaN(v) && v !== 0;

interface Ln {
  x1: number;
  x2: number;
  y: number;
  color: string;
  extendRight: boolean;
  deleted: boolean;
}

type Result = Omit<IndicatorResult, 'markers' | 'barColors' | 'lines'> & { markers: MarkerData[]; barColors: BarColorData[]; lines: LineDrawingData[] };

interface HhllVars {
  /**
   * valuewhen(x, x, 1) of each call of the script (rawDirection, rawPivot, pivotAfterLows, pivotAfterHighs,
   * directionAfterLows): the two latest values of each, older first (changed in place)
   */
  hist: number[];
  /** Live lines in creation order (changed in place) and the two held by the `var` variables */
  lines: Ln[];
  resLine: Ln | null;
  supLine: Ln | null;
  res: number;
  sup: number;
  trend: number;
}

interface HhllRun extends BarRunState<HhllVars> {
  ph: PivotStep;
  pl: PivotStep;
  /** direction of the kept pivot: 1 high, -1 low */
  hlArr: number[];
  /** price of the kept pivot */
  zzArr: number[];
  markers: MarkerData[];
  barColors: BarColorData[];
}

function study(inputs: Partial<HigherHighLowerLowStrategyInputs>): BarStudy<HhllRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const lb = Math.trunc(cfg.lb);
  const rb = Math.trunc(cfg.rb);

  // valuewhen(x, x, 1) of call k: the value before the latest one (the latest can be the current bar). Each call has
  // its own history, taken where the script calls it.
  const history = (h: number[], k: number, v: number): number => {
    if (truthy(v)) {
      h[k * 2] = h[k * 2 + 1];
      h[k * 2 + 1] = v;
    }
    return h[k * 2];
  };

  /** x[k] of a variable; na before the first bar */
  const past = (arr: number[], i: number, k: number) => (i - k >= 0 && k >= 0 ? arr[i - k] : NaN);

  // findprevious(): the four pivots before the current one, of alternating kinds (0 when there is none)
  const findPrevious = (s: HhllRun, i: number): [number, number, number, number] => {
    const { hlArr, zzArr } = s;
    const hl = hlArr[i];
    const locs: [number, number, number, number] = [0, 0, 0, 0];
    let xx = 0;
    const scan = (from: number, kind: number, slot: number, keep: boolean) => {
      // `for x = from to 1000` counts down when from is above 1000
      const step = from <= 1000 ? 1 : -1;
      for (let x = from; step > 0 ? x <= 1000 : x >= 1000; x += step) {
        const z = past(zzArr, i, x);
        if (past(hlArr, i, x) === kind && !isNaN(z)) {
          locs[slot] = z;
          if (keep) xx = x + 1;
          break;
        }
      }
    };
    const other = hl === 1 ? -1 : 1;
    scan(1, other, 0, true);
    scan(xx, hl, 1, true);
    scan(xx, other, 2, true);
    scan(xx, hl, 3, false);
    return locs;
  };

  // Live lines in creation order: when a creation brings the count above max + 5, the oldest are deleted until max
  // remain. The two lines held by the `var` variables of the script are never deleted by this limit, but they count.
  const newLine = (v: HhllVars, x1: number, x2: number, y: number, css: string): Ln => {
    const { lines } = v;
    const o: Ln = { x1, x2, y, color: css, extendRight: true, deleted: false };
    lines.push(o);
    if (lines.length > MAX_LINES + 5) {
      for (let k = 0; k < lines.length && lines.length > MAX_LINES; ) {
        if (lines[k] === v.resLine || lines[k] === v.supLine) k++;
        else lines.splice(k, 1)[0].deleted = true;
      }
    }
    return o;
  };

  return {
    init() {
      const ph = new PivotStep(lb, rb, true);
      const pl = new PivotStep(lb, rb, false);
      const s: HhllRun = {
        ph, pl, hlArr: [], zzArr: [], markers: [], barColors: [],
        steps: [ph, pl],
        vars: { hist: new Array(10).fill(NaN), lines: [], resLine: null, supLine: null, res: NaN, sup: NaN, trend: NaN },
        lists: [], series: [],
      };
      s.lists = [s.markers, s.barColors];
      s.series = [s.hlArr, s.zzArr];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const h = v.hist;
      const ph = s.ph.step(i, bars[i].high);
      const pl = s.pl.step(i, bars[i].low);
      let hl = truthy(ph) ? 1 : truthy(pl) ? -1 : NaN;
      let zz = truthy(ph) ? ph : truthy(pl) ? pl : NaN;

      const prevDirection = history(h, 0, hl);
      // A low after a low: the higher one is dropped. A high after a high: the lower one is dropped.
      const prevRaw = history(h, 1, zz);
      if (truthy(pl) && hl === -1 && prevDirection === -1 && gt(pl, prevRaw)) zz = NaN;
      const beforeHighs = history(h, 2, zz);
      if (truthy(ph) && hl === 1 && prevDirection === 1 && lt(ph, beforeHighs)) zz = NaN;

      const prevPivot = history(h, 3, zz);
      if (hl === -1 && prevDirection === 1 && gt(zz, prevPivot)) hl = NaN;
      const prevKept = history(h, 4, hl);
      if (hl === 1 && prevKept === -1 && lt(zz, prevPivot)) hl = NaN;
      if (isNaN(hl)) zz = NaN;
      s.hlArr[i] = hl;
      s.zzArr[i] = zz;

      let a = NaN, b = NaN, c = NaN, d = NaN, e = NaN;
      if (!isNaN(hl)) {
        [b, c, d, e] = findPrevious(s, i);
        a = zz;
      }
      const on = truthy(zz);
      const isHH = on && gt(a, b) && gt(a, c) && gt(c, b) && gt(c, d);
      const isLL = on && lt(a, b) && lt(a, c) && lt(c, b) && lt(c, d);
      const isHL = on && ((ge(a, c) && gt(b, c) && gt(b, d) && gt(d, c) && gt(d, e)) || (lt(a, b) && gt(a, c) && lt(b, d)));
      const isLH = on && ((le(a, c) && lt(b, c) && lt(b, d) && lt(d, c) && lt(d, e)) || (gt(a, b) && lt(a, c) && gt(b, d)));

      // plotshape(..., offset = -rb): drawn on the pivot bar
      if (i - rb >= 0) {
        const time = barTime(bars, i - rb);
        if (isHL) s.markers.push({ time, position: 'belowBar', shape: 'labelUp', color: LIME, text: 'HL', textColor: BLACK });
        if (isHH) s.markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: LIME, text: 'HH', textColor: BLACK });
        if (isLL) s.markers.push({ time, position: 'belowBar', shape: 'labelUp', color: RED, text: 'LL', textColor: WHITE });
        if (isLH) s.markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: RED, text: 'LH', textColor: WHITE });
      }

      const prevRes = v.res;
      const prevSup = v.sup;
      if (isLH) v.res = zz;
      if (isHL) v.sup = zz;
      const close = bars[i].close;
      v.trend = gt(close, v.res) ? 1 : lt(close, v.sup) ? -1 : (isNaN(v.trend) ? 0 : v.trend);
      if ((v.trend === 1 && isHH) || (v.trend === -1 && isLH)) v.res = zz;
      if ((v.trend === 1 && isHL) || (v.trend === -1 && isLL)) v.sup = zz;

      if (cfg.showSupRes) {
        if (ne(v.res, prevRes)) {
          if (v.resLine && !v.resLine.deleted) {
            v.resLine.x2 = i;
            v.resLine.extendRight = false;
          }
          v.resLine = newLine(v, i - rb, i, v.res, cfg.resCol);
        }
        if (ne(v.sup, prevSup)) {
          if (v.supLine && !v.supLine.deleted) {
            v.supLine.x2 = i;
            v.supLine.extendRight = false;
          }
          v.supLine = newLine(v, i - rb, i, v.sup, cfg.supCol);
        }
      }

      if (cfg.changeBarCol) s.barColors.push({ time: bars[i].time, color: v.trend === 1 ? cfg.bColUp : cfg.bColDn });
    },
    copyVars(v) {
      // the lines are changed in place: copies, the held ones pointing at their copies
      const lines = v.lines.map((l) => ({ ...l }));
      const held = (l: Ln | null) => (l ? lines[v.lines.indexOf(l)] ?? { ...l } : null);
      return { ...v, hist: v.hist.slice(), lines, resLine: held(v.resLine), supLine: held(v.supLine) };
    },
    result(s, bars) {
      const style = cfg.srLineStyle === 'sol' ? 'solid' : cfg.srLineStyle === 'dsh' ? 'dashed' : 'dotted';
      const T = (x: number) => barTime(bars, x);
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        lines: s.vars.lines.map((l) => ({
          time1: T(l.x1), price1: l.y, time2: T(l.x2), price2: l.y, color: l.color, style, width: cfg.srLineWidth,
          extend: l.extendRight ? 'right' as const : 'none' as const,
        })),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<HigherHighLowerLowStrategyInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<HigherHighLowerLowStrategyInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const HigherHighLowerLowStrategy = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
