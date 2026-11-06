/**
 * Auto Fib Extension
 *
 * Fibonacci extension levels projected from the last three swing points.
 * - Pivots: a high (low) that no bar within `Depth / 2` bars on each side exceeds (goes below). A new pivot of the
 *   same kind as the last pivot only replaces it when it goes further; the other kind is added.
 * - On the last bar the pivots are read backwards to find the last swing A-B-C (high-low-high or low-high-low) whose
 *   retracement B-C is between 0.236 and 1 of the move A-B. The two legs are drawn as dashed lines (A-B red, B-C
 *   green).
 * - Levels: C + ratio x (B - A) for each ratio switched on ("Reverse" flips the sign), drawn as horizontal lines over
 *   the leg B-C with a text (ratio and / or price) and a fill between each level and the one before.
 *
 * Based on the standard Auto Fib Extension indicator.
 *
 * The prices of the texts are rounded to the symbol tick (format.mintick): the port reads it from the chart context
 * (third argument of calculate); without it the tick is 0.01. Without a valid swing on the last bar the port throws
 * the error message of the original.
 *
 * Alerts (alert() calls, `alertCalls` of the result): the levels exist on the last bar only (the swing is found
 * there, as in the original), so the calls are on the last bar: each level switched on that the close crossed since
 * the previous close (the level strictly between the two closes) makes the call
 * "Autofib: <ticker> crossing level <ratio>", once per bar.
 */

import { color, str, type Bar, type IndicatorResult, type InputConfig, type PlotConfig } from 'oakscriptjs';
import type { AlertCall, LabelData, LineDrawingData, LinefillData } from '../types';
import { mintickOf, tickerOf, type ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** Keys of the 22 levels, in the order of their inputs */
const LEVEL_KEYS = [
  '0', '0_236', '0_382', '0_5', '0_618', '0_65', '0_786', '1', '1_272', '1_414', '1_618', '1_65', '2_618', '2_65',
  '3_618', '3_65', '4_236', '4_618', 'neg_0_236', 'neg_0_382', 'neg_0_618', 'neg_0_65',
] as const;
type LevelKey = (typeof LEVEL_KEYS)[number];

/** Default [show, value, colour] of each level */
const LEVEL_DEFAULTS: Record<LevelKey, [boolean, number, string]> = {
  '0': [true, 0, '#787b86'],
  '0_236': [true, 0.236, '#f44336'],
  '0_382': [true, 0.382, '#81c784'],
  '0_5': [true, 0.5, '#4caf50'],
  '0_618': [true, 0.618, '#009688'],
  '0_65': [false, 0.65, '#009688'],
  '0_786': [true, 0.786, '#64b5f6'],
  '1': [true, 1, '#787b86'],
  '1_272': [false, 1.272, '#81c784'],
  '1_414': [false, 1.414, '#f44336'],
  '1_618': [true, 1.618, '#2962ff'],
  '1_65': [false, 1.65, '#2962ff'],
  '2_618': [true, 2.618, '#f44336'],
  '2_65': [false, 2.65, '#f44336'],
  '3_618': [true, 3.618, '#9c27b0'],
  '3_65': [false, 3.65, '#9c27b0'],
  '4_236': [true, 4.236, '#e91e63'],
  '4_618': [false, 4.618, '#81c784'],
  neg_0_236: [false, -0.236, '#f44336'],
  neg_0_382: [false, -0.382, '#81c784'],
  neg_0_618: [false, -0.618, '#009688'],
  neg_0_65: [false, -0.65, '#009688'],
};

/** Inline group of each pair of levels */
const LEVEL_INLINE: Record<LevelKey, string> = {
  '0': 'Level0', '0_236': 'Level0', '0_382': 'Level1', '0_5': 'Level1', '0_618': 'Level2', '0_65': 'Level2',
  '0_786': 'Level3', '1': 'Level3', '1_272': 'Level4', '1_414': 'Level4', '1_618': 'Level5', '1_65': 'Level5',
  '2_618': 'Level6', '2_65': 'Level6', '3_618': 'Level7', '3_65': 'Level7', '4_236': 'Level8', '4_618': 'Level8',
  neg_0_236: 'Level9', neg_0_382: 'Level9', neg_0_618: 'Level10', neg_0_65: 'Level10',
};

/** Order in which the levels are drawn (each fill joins a level to the one drawn before) */
const PROCESS_ORDER: LevelKey[] = [
  'neg_0_65', 'neg_0_618', 'neg_0_382', 'neg_0_236', '0', '0_236', '0_382', '0_5', '0_618', '0_65', '0_786', '1',
  '1_272', '1_414', '1_618', '1_65', '2_618', '2_65', '3_618', '3_65', '4_236', '4_618',
];

type LevelInputs = {
  [K in LevelKey as `show_${K}`]: boolean;
} & {
  [K in LevelKey as `value_${K}`]: number;
} & {
  [K in LevelKey as `color_${K}`]: string;
};

export interface AutoFibExtensionInputs extends LevelInputs {
  /** Pivot depth in bars (half on each side) */
  depth: number;
  /** Project the levels in the other direction */
  reverse: boolean;
  extendLeft: boolean;
  extendRight: boolean;
  /** Show the price in the level texts */
  prices: boolean;
  /** Show the ratio in the level texts */
  levels: boolean;
  levelsFormat: 'Values' | 'Percent';
  labelsPosition: 'Left' | 'Right';
  /** Transparency (0-100) of the fills between levels */
  backgroundTransparency: number;
}

const levelDefaults = Object.fromEntries(
  LEVEL_KEYS.flatMap((k) => {
    const [show, value, css] = LEVEL_DEFAULTS[k];
    return [[`show_${k}`, show], [`value_${k}`, value], [`color_${k}`, css]];
  }),
) as LevelInputs;

export const defaultInputs: AutoFibExtensionInputs = {
  depth: 10,
  reverse: false,
  extendLeft: false,
  extendRight: true,
  prices: true,
  levels: true,
  levelsFormat: 'Values',
  labelsPosition: 'Left',
  backgroundTransparency: 85,
  ...levelDefaults,
};

const DEPTH_TOOLTIP = 'The minimum number of bars that will be taken into account when calculating the indicator.';

export const inputConfig: InputConfig[] = [
  { id: 'depth', type: 'int', title: 'Depth', defval: 10, min: 2, inline: 'Pivots', tooltip: DEPTH_TOOLTIP },
  { id: 'reverse', type: 'bool', title: 'Reverse', defval: false, display: 'data_window' },
  {
    id: 'extendLeft', type: 'bool', title: 'Extend Left    |    Extend Right', defval: false,
    inline: 'Extend Lines', display: 'data_window',
  },
  { id: 'extendRight', type: 'bool', title: '', defval: true, inline: 'Extend Lines', display: 'data_window' },
  { id: 'prices', type: 'bool', title: 'Show Prices', defval: true, display: 'data_window' },
  { id: 'levels', type: 'bool', title: 'Show Levels', defval: true, inline: 'Levels', display: 'data_window' },
  {
    id: 'levelsFormat', type: 'string', title: '', defval: 'Values', options: ['Values', 'Percent'], inline: 'Levels',
    display: 'data_window', active: 'levels',
  },
  { id: 'labelsPosition', type: 'string', title: 'Labels Position', defval: 'Left', options: ['Left', 'Right'], display: 'data_window' },
  { id: 'backgroundTransparency', type: 'int', title: 'Background Transparency', defval: 85, min: 0, max: 100, display: 'data_window' },
  ...LEVEL_KEYS.flatMap((k): InputConfig[] => {
    const [show, value, css] = LEVEL_DEFAULTS[k];
    const inline = LEVEL_INLINE[k];
    return [
      { id: `show_${k}`, type: 'bool', title: '', defval: show, inline, display: 'data_window' },
      // input(0) and input(1) are int inputs, the other values float inputs
      { id: `value_${k}`, type: Number.isInteger(value) ? 'int' : 'float', title: '', defval: value, inline, display: 'data_window', active: `show_${k}` },
      { id: `color_${k}`, type: 'color', title: '', defval: css, inline, display: 'data_window', active: `show_${k}` },
    ];
  }),
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Auto Fib Extension',
  shortTitle: 'Auto Fib Extension',
  overlay: true,
};

export interface AutoFibExtensionResult extends IndicatorResult {
  lines: LineDrawingData[];
  labels: LabelData[];
  linefills: LinefillData[];
  /** The alert() calls: a level crossed by the close on the last bar */
  alertCalls: AlertCall[];
}

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** Text that pads the level labels (a line break, right-to-left marks and spaces, a line break) */
const LABEL_PAD = '\n ' + '‏  '.repeat(34) + '‏ \n';

const NOT_ENOUGH_DATA =
  "Not enough data to calculate Auto Fib Extension on the current symbol. Change the chart's timeframe to a lower one or select a smaller calculation depth using the indicator's `Depth` settings.";

const RED = '#F23645';
const GREEN = '#4CAF50';

interface Point {
  time: number;
  price: number;
}

interface FibVars {
  pivotsH: Point[];
  pivotsL: Point[];
}

type FibRun = BarRunState<FibVars>;

function study(inputs: Partial<AutoFibExtensionInputs>): BarStudy<FibRun, AutoFibExtensionResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const extending = cfg.extendLeft && cfg.extendRight ? 'both' : cfg.extendLeft ? 'left' : cfg.extendRight ? 'right' : 'none';

  // pivots(src, depth / 2, isHigh): the division keeps its fraction (5.5 for a depth of 11); the history index is
  // truncated, the bar_index test and the loop bound keep it
  const half = cfg.depth / 2;
  const back = Math.trunc(half);
  const span = half * 2;
  const pivotAt = (bars: Bar[], i: number, isHigh: boolean): Point | null => {
    if (!(i >= half)) return null;
    const raw = isHigh ? bars[i - back].high : bars[i - back].low;
    const price = Number.isNaN(raw) ? 0 : raw;
    for (let k = 0; k <= span; k++) {
      if (k > i) continue; // src[k] is na
      if (isHigh ? gt(bars[i - k].high, price) : lt(bars[i - k].low, price)) return null;
    }
    return { time: bars[i - back].time, price };
  };
  const leg = (a: Point, b: Point, css: string): LineDrawingData => ({
    time1: a.time, price1: a.price, time2: b.time, price2: b.price, color: css, width: 1, style: 'dashed',
  });

  return {
    init() {
      return { steps: [], lists: [], series: [], vars: { pivotsH: [], pivotsL: [] } };
    },
    bar(s, i, bars) {
      const pivotsH = s.vars.pivotsH;
      const pivotsL = s.vars.pivotsL;
      let H = pivotAt(bars, i, true);
      let L = pivotAt(bars, i, false);
      if (pivotsH.length > 0 && pivotsL.length > 0) {
        const lastH = pivotsH[pivotsH.length - 1];
        const lastL = pivotsL[pivotsL.length - 1];
        const isHighLast = lastH.time > lastL.time;
        if (isHighLast) {
          if (H) {
            if (gt(H.price, lastH.price)) pivotsH[pivotsH.length - 1] = H;
            H = null;
          }
        } else if (L) {
          if (lt(L.price, lastL.price)) pivotsL[pivotsL.length - 1] = L;
          L = null;
        }
      }
      if (H) pivotsH.push(H);
      if (L) pivotsL.push(L);
    },
    copyVars: (v) => ({ pivotsH: v.pivotsH.slice(), pivotsL: v.pivotsL.slice() }),
    result(s, bars, chart) {
      const n = bars.length;
      const tick = mintickOf(chart);
      const empty: AutoFibExtensionResult = {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        lines: [],
        labels: [],
        linefills: [],
        alertCalls: [],
      };
      if (n === 0) return empty;
      const { pivotsH, pivotsL } = s.vars;
      let isHighLast = false;
      let startPrice = NaN;
      let endPrice = NaN;
      let lineLastHL: LineDrawingData | null = null;
      let lineLastLH: LineDrawingData | null = null;
      let lineLast: LineDrawingData | null = null;

      // Last bar: the last swing whose retracement is between the two thresholds
      const upperThreshold = 0.236;
      const lowerThreshold = 1.0;
      if (pivotsH.length > 0 && pivotsL.length > 0) {
        const hCopy = pivotsH.slice();
        const lCopy = pivotsL.slice();
        while (hCopy.length > 0 && lCopy.length > 0) {
          let lastH = hCopy.pop()!;
          const lastL = lCopy.pop()!;
          isHighLast = lastH.time > lastL.time;
          let pivots = isHighLast ? hCopy : lCopy;
          // for i = size - 1 to 0: each pass removes the last element (pop or remove(i) with i the last index)
          for (let k = pivots.length - 1; k >= 0; k--) {
            const p = pivots[k];
            if (p.time < lastL.time) break;
            if (gt(p.price, lastH.price)) lastH = pivots.pop()!;
            else pivots.splice(k, 1);
          }
          if (hCopy.length === 0 || lCopy.length === 0) break;

          isHighLast = lastH.time > lastL.time;
          pivots = isHighLast ? hCopy : lCopy;
          const prevPivot = pivots[pivots.length - 1];
          startPrice = prevPivot.price;
          if (isHighLast) {
            endPrice = lastL.price;
            const diff = Math.abs(startPrice - endPrice);
            if (gt(lastH.price, endPrice + diff * lowerThreshold) || lt(lastH.price, endPrice + diff * upperThreshold)) {
              lCopy.push(lastL);
              continue;
            }
            lineLastHL = leg(prevPivot, lastL, RED);
            lineLastLH = leg(lastL, lastH, GREEN);
            lineLast = lineLastLH;
          } else {
            endPrice = lastH.price;
            const diff = Math.abs(startPrice - endPrice);
            if (lt(lastL.price, endPrice - diff * lowerThreshold) || gt(lastL.price, endPrice - diff * upperThreshold)) {
              hCopy.push(lastH);
              continue;
            }
            lineLastLH = leg(prevPivot, lastH, RED);
            lineLastHL = leg(lastH, lastL, GREEN);
            lineLast = lineLastHL;
          }
          break;
        }
      }
      if (!lineLast || !lineLastHL || !lineLastLH) throw new Error(NOT_ENOUGH_DATA);

      const diff = (isHighLast ? -1 : 1) * Math.abs(startPrice - endPrice);
      let offset = isHighLast ? lineLastLH.price1 - lineLastLH.price2 : lineLastHL.price1 - lineLastHL.price2;
      offset = (isHighLast ? -1 : 1) * Math.abs(offset);
      const base = endPrice - offset;

      const lines: LineDrawingData[] = [lineLastHL, lineLastLH];
      const labels: LabelData[] = [];
      const linefills: LinefillData[] = [];
      const left = cfg.labelsPosition === 'Left';
      const lastTime = bars[n - 1].time;
      const labelTime = left ? lineLast.time1 : !cfg.extendRight ? lineLast.time2 : lastTime;
      const fmt = (v: number) => str.tostring(v, 'mintick', tick);
      const alertCalls: AlertCall[] = [];
      const ticker = tickerOf(chart);
      const c0 = bars[n - 1].close;
      const c1 = n > 1 ? bars[n - 2].close : NaN;

      let other: LineDrawingData | null = null;
      for (const k of PROCESS_ORDER) {
        if (!cfg[`show_${k}`]) continue;
        const m = cfg[`value_${k}`];
        const css = cfg[`color_${k}`];
        const r = base + (cfg.reverse ? -1 : 1) * diff * m;
        // _crossing_level(close, r): the level between the last close and the one before
        if ((gt(r, c0) && gt(c1, r)) || (gt(c0, r) && gt(r, c1))) {
          alertCalls.push({ time: bars[n - 1].time, message: 'Autofib: ' + ticker + ' crossing level ' + str.tostring(m), freq: 'once_per_bar' });
        }
        // _draw_line: the line spans the last leg at the level price
        const id: LineDrawingData = {
          time1: lineLast.time1, price1: r, time2: lineLast.time2, price2: r, color: css, width: 1, extend: extending,
        };
        lines.push(id);
        if (!Number.isNaN(r)) {
          const l = cfg.levelsFormat === 'Values' ? str.tostring(m) : str.tostring(m * 100) + '%';
          const txt = (cfg.levels ? l : '') + (cfg.prices ? '(' + fmt(r) + ')' : '');
          labels.push({
            time: labelTime,
            price: r,
            text: (left ? txt : '       ' + txt) + LABEL_PAD,
            color: '#00000000',
            textColor: css,
            style: left ? 'label_right' : 'label_left',
            textAlign: left ? 'right' : 'left',
          });
        }
        if (other) linefills.push({ line1: id, line2: other, color: color.new(css, cfg.backgroundTransparency) });
        other = id;
      }

      return { ...empty, lines, labels, linefills, alertCalls };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AutoFibExtensionInputs> = {}, chart: ChartContext = {}): IndicatorRun<AutoFibExtensionResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<AutoFibExtensionInputs> = {},
  chart?: ChartContext,
): AutoFibExtensionResult {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const AutoFibExtension = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, hasAlertFunction: true };
