/**
 * FVG Instantaneous Mitigation Signals [LuxAlgo]
 *
 * A fair value gap that is mitigated by the very next bar gives a signal. Bullish: the low of 3 bars back is above
 * the high of the previous bar (a bearish gap), the close of 2 bars back is below that low and the current close is
 * back above it. Bearish: the mirrored case. The gap size can be filtered with a multiple of the ATR (200).
 *
 * Each signal draws the gap as a box (3 bars back to the signal bar), a label ("▲" below the low, "▼" above the
 * high) and, with "Average", a dashed line at the middle of the gap that is extended until a close crosses it.
 * Optional take-profit and stop-loss areas (ATR multiples from the middle of the gap) are extended until the price
 * reaches one of them or the opposite signal comes. A trailing stop (ATR multiple from the close) starts on every
 * signal, or only on an inverse signal, and is plotted until a close crosses it. Bars are coloured by the last
 * signal while its trailing stop and its areas are not reached. At most 500 boxes, 500 lines and 500 labels are
 * kept.
 *
 * Reference: "FVG Instantaneous Mitigation Signals [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData, BoxData, LabelData, LineDrawingData } from '../types';
import { barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface FvgInstantaneousMitigationSignalsInputs {
  /** Smallest gap size, as a multiple of the ATR (200) */
  filterWidth: number;
  showTp: boolean;
  tpMult: number;
  tpCss: string;
  showSl: boolean;
  slMult: number;
  slCss: string;
  /** When the trailing stop starts again */
  tsReset: 'Every Signals' | 'Inverse Signals';
  tsMult: number;
  showBull: boolean;
  bullCss: string;
  bullAvg: boolean;
  showBear: boolean;
  bearCss: string;
  bearAvg: boolean;
}

export const defaultInputs: FvgInstantaneousMitigationSignalsInputs = {
  filterWidth: 0,
  showTp: false,
  tpMult: 4,
  tpCss: 'rgba(91, 156, 246, 0.2)',
  showSl: false,
  slMult: 2,
  slCss: 'rgba(120, 123, 134, 0.2)',
  tsReset: 'Every Signals',
  tsMult: 3,
  showBull: true,
  bullCss: '#00897B',
  bullAvg: true,
  showBear: true,
  bearCss: '#F23645',
  bearAvg: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'filterWidth', type: 'float', title: 'FVG Width Filter', defval: 0, min: 0, step: 0.1 },
  { id: 'showTp', type: 'bool', title: 'TP Area', defval: false, inline: 'tp', group: 'TP/SL' },
  { id: 'tpMult', type: 'float', title: 'Multiplier', defval: 4, min: 0, inline: 'tp', group: 'TP/SL' },
  { id: 'tpCss', type: 'color', title: '', defval: 'rgba(91, 156, 246, 0.2)', inline: 'tp', group: 'TP/SL' },
  { id: 'showSl', type: 'bool', title: 'SL Area', defval: false, inline: 'sl', group: 'TP/SL' },
  { id: 'slMult', type: 'float', title: 'Multiplier', defval: 2, min: 0, inline: 'sl', group: 'TP/SL' },
  { id: 'slCss', type: 'color', title: '', defval: 'rgba(120, 123, 134, 0.2)', inline: 'sl', group: 'TP/SL' },
  { id: 'tsReset', type: 'string', title: 'Reset Trailing Stop', defval: 'Every Signals', options: ['Every Signals', 'Inverse Signals'], group: 'Trailing Stop' },
  { id: 'tsMult', type: 'float', title: 'Multiplier', defval: 3, group: 'Trailing Stop' },
  { id: 'showBull', type: 'bool', title: 'Bullish IMFVG', defval: true, inline: 'bull', group: 'Style' },
  { id: 'bullCss', type: 'color', title: '', defval: '#00897B', inline: 'bull', group: 'Style' },
  { id: 'bullAvg', type: 'bool', title: 'Average', defval: true, inline: 'bull', group: 'Style' },
  { id: 'showBear', type: 'bool', title: 'Bearish IMFVG', defval: true, inline: 'bear', group: 'Style' },
  { id: 'bearCss', type: 'color', title: '', defval: '#F23645', inline: 'bear', group: 'Style' },
  { id: 'bearAvg', type: 'bool', title: 'Average', defval: true, inline: 'bear', group: 'Style' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trailing Stop', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'FVG Instantaneous Mitigation Signals [LuxAlgo]',
  shortTitle: 'LuxAlgo - FVG Instantaneous Mitigation Signals',
  overlay: true,
};

/** indicator(max_boxes_count = 500, max_lines_count = 500, max_labels_count = 500) */
const MAX_OBJECTS = 500;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

interface Bx {
  left: number;
  top: number;
  right: number;
  bottom: number;
  bg: string;
}
interface Ln {
  x1: number;
  x2: number;
  y: number;
  color: string;
}
interface Lb {
  x: number;
  y: number;
  text: string;
  textColor: string;
  style: 'label_up' | 'label_down';
}

/** The state of one tpsl() call site: its `var` areas and `reached` */
interface TpslSite {
  tpArea: Bx | null;
  slArea: Bx | null;
  reached: boolean;
}

interface FvgVars {
  /** Live drawings in creation order (objects changed in place: cloned by copyVars) */
  boxes: Bx[];
  lines: Ln[];
  labels: Lb[];
  bullLine: Ln | null;
  bullLvlReached: boolean | null; // var bool = na
  bearLine: Ln | null;
  bearLvlReached: boolean | null;
  os: number;
  // trailing_stop()
  ts: number;
  tsReached: boolean;
  bullSite: TpslSite;
  bearSite: TpslSite;
}

type Result = Omit<IndicatorResult, 'boxes' | 'lines' | 'labels' | 'barColors'> & {
  boxes: BoxData[];
  lines: LineDrawingData[];
  labels: LabelData[];
  barColors: BarColorData[];
};

interface FvgRun extends BarRunState<FvgVars> {
  atr: ReturnType<typeof taStep.atr>;
  plot0: Array<{ time: number; value: number; color: string }>;
  barColors: BarColorData[];
}

/** A copy of the drawing state: new box and line objects, the variables pointed at the copies */
function copyFvgVars(v: FvgVars): FvgVars {
  const boxMap = new Map<Bx, Bx>();
  const lineMap = new Map<Ln, Ln>();
  const boxes = v.boxes.map((b) => { const c = { ...b }; boxMap.set(b, c); return c; });
  const lines = v.lines.map((l) => { const c = { ...l }; lineMap.set(l, c); return c; });
  const box = (b: Bx | null) => (b ? boxMap.get(b) ?? { ...b } : null);
  const line = (l: Ln | null) => (l ? lineMap.get(l) ?? { ...l } : null);
  const site = (s: TpslSite): TpslSite => ({ tpArea: box(s.tpArea), slArea: box(s.slArea), reached: s.reached });
  return {
    ...v, boxes, lines, labels: v.labels.slice(), bullLine: line(v.bullLine), bearLine: line(v.bearLine),
    bullSite: site(v.bullSite), bearSite: site(v.bearSite),
  };
}

function study(inputs: Partial<FvgInstantaneousMitigationSignalsInputs>): BarStudy<FvgRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { bullCss, bearCss } = cfg;
  return {
    init() {
      // atr = nz(ta.atr(200))
      const atr = taStep.atr(200);
      const s: FvgRun = {
        atr, plot0: [], barColors: [],
        steps: [atr],
        vars: {
          boxes: [], lines: [], labels: [], bullLine: null, bullLvlReached: null, bearLine: null, bearLvlReached: null,
          os: 0, ts: NaN, tsReached: false,
          bullSite: { tpArea: null, slArea: null, reached: false },
          bearSite: { tpArea: null, slArea: null, reached: false },
        },
        lists: [], series: [],
      };
      s.lists = [s.barColors];
      s.series = [s.plot0];
      return s;
    },
    copyVars: copyFvgVars,
    bar(s, i, bars) {
      const v = s.vars;
      const { boxes, lines, labels } = v;
      // Live drawings in creation order: when a creation brings the count above max + 5, the oldest are deleted until
      // max remain. An object held by a `var` variable of the script (the average lines, the TP / SL areas) is never
      // deleted by this limit, but it counts.
      const held = (o: object) =>
        o === v.bullLine || o === v.bearLine || o === v.bullSite.tpArea || o === v.bullSite.slArea ||
        o === v.bearSite.tpArea || o === v.bearSite.slArea;
      const limit = <T extends object>(list: T[]) => {
        if (list.length <= MAX_OBJECTS + 5) return;
        for (let k = 0; k < list.length && list.length > MAX_OBJECTS; ) {
          if (held(list[k]!)) k++;
          else list.splice(k, 1);
        }
      };
      const newBox = (b: Bx): Bx => {
        boxes.push(b);
        limit(boxes);
        return b;
      };
      const newLine = (l: Ln): Ln => {
        lines.push(l);
        limit(lines);
        return l;
      };
      const newLabel = (l: Lb) => {
        labels.push(l);
        limit(labels);
      };

      /** tpsl(): one call site (its own `var` areas and state) */
      const tpsl = (site: TpslSite, islong: boolean, condition: boolean, opposite: boolean, level: number, atr: number): boolean => {
        if (condition) {
          if (islong) {
            if (cfg.showTp) site.tpArea = newBox({ left: i, top: level + atr * cfg.tpMult, right: i, bottom: level, bg: cfg.tpCss });
            if (cfg.showSl) site.slArea = newBox({ left: i, top: level, right: i, bottom: level - atr * cfg.slMult, bg: cfg.slCss });
          } else {
            if (cfg.showTp) site.tpArea = newBox({ left: i, top: level, right: i, bottom: level - atr * cfg.tpMult, bg: cfg.tpCss });
            if (cfg.showSl) site.slArea = newBox({ left: i, top: level + atr * cfg.slMult, right: i, bottom: level, bg: cfg.slCss });
          }
          site.reached = false;
        } else if (opposite) {
          site.reached = true;
        }
        if (!site.reached) {
          const { tpArea, slArea } = site;
          if (tpArea) tpArea.right = i;
          if (slArea) slArea.right = i;
          const { high, low } = bars[i]!;
          if (islong) {
            if (gt(high, tpArea ? tpArea.top : NaN) || lt(low, slArea ? slArea.bottom : NaN)) site.reached = true;
          } else if (lt(low, tpArea ? tpArea.bottom : NaN) || gt(high, slArea ? slArea.top : NaN)) {
            site.reached = true;
          }
        }
        return site.reached;
      };

      const { high, low, close, time } = bars[i]!;
      const atrV = s.atr.step(high, low, close);
      const atr = atrV === null || atrV === undefined || Number.isNaN(atrV) ? 0 : atrV;
      const low3 = i >= 3 ? bars[i - 3]!.low : NaN;
      const high3 = i >= 3 ? bars[i - 3]!.high : NaN;
      const high1 = i >= 1 ? bars[i - 1]!.high : NaN;
      const low1 = i >= 1 ? bars[i - 1]!.low : NaN;
      const close2 = i >= 2 ? bars[i - 2]!.close : NaN;
      const osPrev = i > 0 ? v.os : NaN;

      // Bullish signal
      const bull = gt(low3, high1) && lt(close2, low3) && gt(close, low3) && gt(low3 - high1, atr * cfg.filterWidth) && cfg.showBull;
      if (bull) {
        newBox({ left: i - 3, top: low3, right: i, bottom: high1, bg: String(color.new(bullCss, 50)) });
        const avg = (low3 + high1) / 2;
        if (cfg.bullAvg) v.bullLine = newLine({ x1: i, x2: i, y: avg, color: bullCss });
        newLabel({ x: i, y: low, text: '▲', textColor: bullCss, style: 'label_up' });
        v.os = 1;
        v.bullLvlReached = false;
      }

      // Bearish signal
      const bear = gt(low1, high3) && gt(close2, high3) && lt(close, high3) && gt(low1 - high3, atr * cfg.filterWidth) && cfg.showBear;
      if (bear) {
        newBox({ left: i - 3, top: low1, right: i, bottom: high3, bg: String(color.new(bearCss, 50)) });
        const avg = (low1 + high3) / 2;
        if (cfg.bearAvg) v.bearLine = newLine({ x1: i, x2: i, y: avg, color: bearCss });
        newLabel({ x: i, y: high, text: '▼', textColor: bearCss, style: 'label_down' });
        v.os = 0;
        v.bearLvlReached = false;
      }

      // Extend the average lines (an na bool is false: `not na` is true)
      if (!v.bullLvlReached && v.bullLine) v.bullLine.x2 = i;
      if (!v.bearLvlReached && v.bearLine) v.bearLine.x2 = i;

      // Test if reached
      if (v.bullLine && lt(close, v.bullLine.y)) v.bullLvlReached = true;
      if (v.bearLine && gt(close, v.bearLine.y)) v.bearLvlReached = true;

      const bullReached = tpsl(v.bullSite, true, bull, bear, (low3 + high1) / 2, atr);
      const bearReached = tpsl(v.bearSite, false, bear, bull, (low1 + high3) / 2, atr);

      // Trailing stop (os != os[1] is false on the first bar: os[1] is na)
      const os = v.os;
      const tsResetNow = cfg.tsReset === 'Every Signals' ? bull || bear : !Number.isNaN(osPrev) && os !== osPrev;
      const dist = atr * cfg.tsMult;
      if (tsResetNow) {
        v.ts = os === 1 ? close - dist : close + dist;
        v.tsReached = false;
      } else {
        if (os === 1) v.ts = gt(close - v.ts, dist) ? close - dist : v.ts;
        else v.ts = gt(v.ts - close, dist) ? close + dist : v.ts;
        if (lt(close, v.ts) && os === 1) v.tsReached = true;
        else if (gt(close, v.ts) && os === 0) v.tsReached = true;
      }

      // barcolor(ts_reached ? na : os == 1 and not bull_reached ? bullCss : os == 0 and not bear_reached ? bearCss : na)
      if (!v.tsReached) {
        if (os === 1 && !bullReached) s.barColors.push({ time, color: bullCss });
        else if (os === 0 && !bearReached) s.barColors.push({ time, color: bearCss });
      }
      // plot(ts, 'Trailing Stop', ts_reached or bull or bear ? na : os ? bullCss : bearCss)
      s.plot0[i] = { time: time as number, value: v.ts, color: v.tsReached || bull || bear ? 'transparent' : os ? bullCss : bearCss };
    },
    result(s, bars) {
      const T = (index: number) => barTime(bars, index);
      const { boxes, lines, labels } = s.vars;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        barColors: s.barColors.slice(),
        boxes: boxes.map((b) => ({
          time1: T(b.left), price1: b.top, time2: T(b.right), price2: b.bottom, bgColor: b.bg, borderColor: 'transparent',
        })),
        lines: lines.map((l) => ({ time1: T(l.x1), price1: l.y, time2: T(l.x2), price2: l.y, color: l.color, style: 'dashed' as const })),
        labels: labels.map((l) => ({
          time: T(l.x), price: l.y, text: l.text, color: 'transparent', textColor: l.textColor, style: l.style, size: 'small' as const,
        })),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FvgInstantaneousMitigationSignalsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<FvgInstantaneousMitigationSignalsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const FvgInstantaneousMitigationSignals = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
