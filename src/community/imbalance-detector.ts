/**
 * Imbalance Detector [LuxAlgo]
 *
 * Three kinds of price imbalance are drawn as boxes:
 * - Fair value gap (FVG): the low is above the high of two bars back and the previous close is above that high
 *   (bearish: the mirror), when no opening gap was found on this bar or the bar before. A filled box from two bars
 *   back, with a line at its middle.
 * - Opening gap (OG): the low is above the previous high (bearish: the high is below the previous low). A filled box
 *   with the text "OG" between the bodies of the two candles.
 * - Volume imbalance (VI): the bodies of two candles do not overlap but their wicks do. A box with a dotted border
 *   between the two bodies.
 * Each kind has an optional minimum width (in points, in % or in ATR(200)) and a number of bars by which the box is
 * extended to the right. The optional dashboard shows, for each kind, the number of bullish and bearish imbalances
 * and the share of them that were filled (price came back through the start of the gap).
 *
 * Drawings are kept up to 500 boxes and 500 lines (the oldest are removed).
 *
 * Chart values read: the chart foreground colour (the "OG" text). Without a chart context it is the dark theme
 * colour #DBDBDB.
 *
 * Alerts (alertcondition, `alerts` of the result): 'Bullish FVG', 'Bearish FVG', 'Bullish OG', 'Bearish OG',
 * 'Bullish VI', 'Bearish VI', each true on the bars where that imbalance is found (with its kind shown and its
 * minimum width met, as the boxes).
 *
 * Reference: "Imbalance Detector [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import { taStep, color, str, barTime, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BoxData, LineDrawingData, PineSize, TableCellData, TableData } from '../types';
import { foregroundColorOf, type ChartContext } from '../chart-context';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

type WidthMethod = 'Points' | '%' | 'ATR';

export interface ImbalanceDetectorInputs {
  /** Fair Value Gaps (FVG) */
  showFvg: boolean;
  bullFvgCss: string;
  bearFvgCss: string;
  /** Min Width (FVG) */
  fvgUseWidth: boolean;
  fvgGapWidth: number;
  fvgMethod: WidthMethod;
  /** Extend FVG */
  fvgExtend: number;
  /** Show Opening Gaps (OG) */
  showOg: boolean;
  bullOgCss: string;
  bearOgCss: string;
  /** Min Width (OG) */
  ogUseWidth: boolean;
  ogGapWidth: number;
  ogMethod: WidthMethod;
  /** Extend OG */
  ogExtend: number;
  /** Show Volume Imbalances (VI) */
  showVi: boolean;
  bullViCss: string;
  bearViCss: string;
  /** Min Width (VI) */
  viUseWidth: boolean;
  viGapWidth: number;
  viMethod: WidthMethod;
  /** Extend VI */
  viExtend: number;
  /** Show Dashboard */
  showDash: boolean;
  /** Dashboard Location */
  dashLoc: 'Top Right' | 'Bottom Right' | 'Bottom Left';
  /** Dashboard Size */
  textSize: 'Tiny' | 'Small' | 'Normal';
}

export const defaultInputs: ImbalanceDetectorInputs = {
  showFvg: true,
  bullFvgCss: '#2157f3',
  bearFvgCss: '#ff1100',
  fvgUseWidth: false,
  fvgGapWidth: 0,
  fvgMethod: 'Points',
  fvgExtend: 0,
  showOg: true,
  bullOgCss: '#2157f3',
  bearOgCss: '#ff1100',
  ogUseWidth: false,
  ogGapWidth: 0,
  ogMethod: 'Points',
  ogExtend: 0,
  showVi: true,
  bullViCss: '#2157f3',
  bearViCss: '#ff1100',
  viUseWidth: false,
  viGapWidth: 0,
  viMethod: 'Points',
  viExtend: 5,
  showDash: false,
  dashLoc: 'Bottom Right',
  textSize: 'Tiny',
};

const METHODS = ['Points', '%', 'ATR'];
const GF = 'Fair Value Gaps';
const GO = 'Opening Gaps';
const GV = 'Volume Imbalance';
const GD = 'Dashboard';

export const inputConfig: InputConfig[] = [
  { id: 'showFvg', type: 'bool', title: 'Fair Value Gaps (FVG)', defval: true, inline: 'fvg_css', group: GF },
  { id: 'bullFvgCss', type: 'color', title: '', defval: '#2157f3', inline: 'fvg_css', group: GF },
  { id: 'bearFvgCss', type: 'color', title: '', defval: '#ff1100', inline: 'fvg_css', group: GF },
  { id: 'fvgUseWidth', type: 'bool', title: 'Min Width', defval: false, inline: 'fvg_width', group: GF },
  { id: 'fvgGapWidth', type: 'float', title: '', defval: 0, inline: 'fvg_width', group: GF },
  { id: 'fvgMethod', type: 'string', title: '', defval: 'Points', options: METHODS, inline: 'fvg_width', group: GF },
  { id: 'fvgExtend', type: 'int', title: 'Extend FVG', defval: 0, min: 0, group: GF },
  { id: 'showOg', type: 'bool', title: 'Show Opening Gaps (OG)', defval: true, inline: 'og_css', group: GO },
  { id: 'bullOgCss', type: 'color', title: '', defval: '#2157f3', inline: 'og_css', group: GO },
  { id: 'bearOgCss', type: 'color', title: '', defval: '#ff1100', inline: 'og_css', group: GO },
  { id: 'ogUseWidth', type: 'bool', title: 'Min Width', defval: false, inline: 'og_width', group: GO },
  { id: 'ogGapWidth', type: 'float', title: '', defval: 0, inline: 'og_width', group: GO },
  { id: 'ogMethod', type: 'string', title: '', defval: 'Points', options: METHODS, inline: 'og_width', group: GO },
  { id: 'ogExtend', type: 'int', title: 'Extend OG', defval: 0, min: 0, group: GO },
  { id: 'showVi', type: 'bool', title: 'Show Volume Imbalances (VI)', defval: true, inline: 'vi_css', group: GV },
  { id: 'bullViCss', type: 'color', title: '', defval: '#2157f3', inline: 'vi_css', group: GV },
  { id: 'bearViCss', type: 'color', title: '', defval: '#ff1100', inline: 'vi_css', group: GV },
  { id: 'viUseWidth', type: 'bool', title: 'Min Width', defval: false, inline: 'vi_width', group: GV },
  { id: 'viGapWidth', type: 'float', title: '', defval: 0, inline: 'vi_width', group: GV },
  { id: 'viMethod', type: 'string', title: '', defval: 'Points', options: METHODS, inline: 'vi_width', group: GV },
  { id: 'viExtend', type: 'int', title: 'Extend VI', defval: 5, min: 0, group: GV },
  { id: 'showDash', type: 'bool', title: 'Show Dashboard', defval: false, group: GD },
  { id: 'dashLoc', type: 'string', title: 'Dashboard Location', defval: 'Bottom Right', options: ['Top Right', 'Bottom Right', 'Bottom Left'], group: GD },
  { id: 'textSize', type: 'string', title: 'Dashboard Size', defval: 'Tiny', options: ['Tiny', 'Small', 'Normal'], group: GD },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Imbalance Detector [LuxAlgo]',
  shortTitle: 'Imbalance Detector [LuxAlgo]',
  overlay: true,
};

/** indicator(max_boxes_count = 500, max_lines_count = 500) */
const MAX_OBJECTS = 500;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;

/** The drawing count limit of Pine: above max + 5 objects of one kind the oldest are deleted until max remain */
function register<T>(list: T[], obj: T): void {
  list.push(obj);
  if (list.length > MAX_OBJECTS + 5) list.splice(0, list.length - MAX_OBJECTS);
}

/** A box or line drawn by a bar, its right end `t2` bars from bar 0 (the time of a bar after the last one follows the
 *  bar count: set in result) */
interface Drawing<T> {
  data: T;
  t2: number;
}

/** Detectors and fill counters, in the order bullVi, bearVi, bullOg, bearOg, bullFvg, bearFvg */
interface ImbalanceVars {
  /** imbalance_detection(): isWidth and count of each call */
  isWidth: boolean[];
  count: number[];
  /** bull_filled() / bear_filled(): the levels not crossed yet and the count of the filled ones */
  levels: number[][];
  filled: number[];
  boxes: Drawing<BoxData>[];
  lines: Drawing<LineDrawingData>[];
  /** Values of the bar before */
  prevBullVi: boolean;
  prevBearVi: boolean;
  prevBullOg: boolean;
  prevBearOg: boolean;
  prevBullGapBtm: number;
  prevBearGapTop: number;
}

interface ImbalanceRun extends BarRunState<ImbalanceVars> {
  atr: ReturnType<typeof taStep.atr>;
  /** bull_fvg, bear_fvg, bull_og, bear_og, bull_vi, bear_vi per bar */
  flags: boolean[][];
  times: number[][];
}

type Result = IndicatorResult & { alerts: AlertConditionState[] };

const BULL_VI = 0, BEAR_VI = 1, BULL_OG = 2, BEAR_OG = 3, BULL_FVG = 4, BEAR_FVG = 5;

function study(inputs: Partial<ImbalanceDetectorInputs>): BarStudy<ImbalanceRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const settings = [
    { show: cfg.showVi, useWidth: cfg.viUseWidth, method: cfg.viMethod, width: cfg.viGapWidth },
    { show: cfg.showVi, useWidth: cfg.viUseWidth, method: cfg.viMethod, width: cfg.viGapWidth },
    { show: cfg.showOg, useWidth: cfg.ogUseWidth, method: cfg.ogMethod, width: cfg.ogGapWidth },
    { show: cfg.showOg, useWidth: cfg.ogUseWidth, method: cfg.ogMethod, width: cfg.ogGapWidth },
    { show: cfg.showFvg, useWidth: cfg.fvgUseWidth, method: cfg.fvgMethod, width: cfg.fvgGapWidth },
    { show: cfg.showFvg, useWidth: cfg.fvgUseWidth, method: cfg.fvgMethod, width: cfg.fvgGapWidth },
  ];
  const bullOgBg = String(color.new(cfg.bullOgCss, 50));
  const bearOgBg = String(color.new(cfg.bearOgCss, 50));
  const bullFvgBg = String(color.new(cfg.bullFvgCss, 80));
  const bearFvgBg = String(color.new(cfg.bearFvgCss, 80));
  let chartFg = foregroundColorOf(undefined);

  /** imbalance_detection(): one state per call */
  const test = (v: ImbalanceVars, k: number, top: number, btm: number, condition: boolean, atr: number): boolean => {
    const { show, useWidth, method, width } = settings[k];
    if (useWidth) {
      const dist = top - btm;
      v.isWidth[k] = method === 'Points' ? gt(dist, width) : method === '%' ? gt((dist / btm) * 100, width) : gt(dist, atr * width);
    }
    const isTrue = show && condition && v.isWidth[k];
    v.count[k] += isTrue ? 1 : 0;
    return isTrue;
  };
  /** bull_filled() / bear_filled(): the count of imbalances whose start was crossed again */
  const fill = (v: ImbalanceVars, k: number, bull: boolean, condition: boolean, level: number, bar: Bar): void => {
    const levels = v.levels[k];
    if (condition) levels.unshift(level);
    for (let i = levels.length - 1; i >= 0; i--) {
      if (bull ? gt(levels[i], bar.low) : gt(bar.high, levels[i])) {
        levels.splice(i, 1);
        v.filled[k] += 1;
      }
    }
  };

  return {
    init(_bars, chart) {
      // chart.fg_color
      chartFg = foregroundColorOf(chart);
      const s: ImbalanceRun = {
        atr: taStep.atr(200),
        flags: [[], [], [], [], [], []], times: [[], [], [], [], [], []],
        steps: [],
        vars: {
          isWidth: [true, true, true, true, true, true], count: [0, 0, 0, 0, 0, 0],
          levels: [[], [], [], [], [], []], filled: [0, 0, 0, 0, 0, 0], boxes: [], lines: [],
          prevBullVi: false, prevBearVi: false, prevBullOg: false, prevBearOg: false,
          prevBullGapBtm: NaN, prevBearGapTop: NaN,
        },
        lists: [], series: [],
      };
      s.steps = [s.atr];
      s.lists = s.times;
      s.series = s.flags;
      return s;
    },
    copyVars: (v) => ({
      ...v,
      isWidth: v.isWidth.slice(), count: v.count.slice(), levels: v.levels.map((l) => l.slice()), filled: v.filled.slice(),
      boxes: v.boxes.slice(), lines: v.lines.slice(),
    }),
    bar(s, i, bars) {
      const v = s.vars;
      const bar = bars[i];
      const { open, high, low, close } = bar;
      const atr = s.atr.step(high, low, close);
      const time = (index: number) => barTime(bars, index);
      const p1 = i >= 1 ? bars[i - 1] : undefined;
      const p2 = i >= 2 ? bars[i - 2] : undefined;
      const open1 = p1 ? p1.open : NaN;
      const high1 = p1 ? p1.high : NaN;
      const low1 = p1 ? p1.low : NaN;
      const close1 = p1 ? p1.close : NaN;
      const high2 = p2 ? p2.high : NaN;
      const low2 = p2 ? p2.low : NaN;
      const boxes = v.boxes;
      const lines = v.lines;

      // Volume imbalances
      const bullGapTop = Math.min(close, open);
      const bullGapBtm = p1 ? Math.max(close1, open1) : NaN;
      const isBullVi = test(v, BULL_VI, bullGapTop, bullGapBtm,
        gt(open, close1) && gt(high1, low) && gt(close, close1) && gt(open, open1) && gt(bullGapTop, high1), atr);
      fill(v, BULL_VI, true, v.prevBullVi, v.prevBullGapBtm, bar);

      const bearGapTop = p1 ? Math.min(close1, open1) : NaN;
      const bearGapBtm = Math.max(close, open);
      const isBearVi = test(v, BEAR_VI, bearGapTop, bearGapBtm,
        gt(close1, open) && gt(high, low1) && gt(close1, close) && gt(open1, open) && gt(low1, bearGapBtm), atr);
      fill(v, BEAR_VI, false, v.prevBearVi, v.prevBearGapTop, bar);

      if (isBullVi) {
        register(boxes, { t2: i + cfg.viExtend, data: {
          time1: time(i - 1), price1: bullGapTop, time2: NaN, price2: bullGapBtm, borderColor: cfg.bullViCss,
          bgColor: 'transparent', borderStyle: 'dotted',
        } });
      }
      if (isBearVi) {
        register(boxes, { t2: i + cfg.viExtend, data: {
          time1: time(i - 1), price1: bearGapTop, time2: NaN, price2: bearGapBtm, borderColor: cfg.bearViCss,
          bgColor: 'transparent', borderStyle: 'dotted',
        } });
      }

      // Opening gaps
      const isBullOg = test(v, BULL_OG, bullGapTop, bullGapBtm, gt(low, high1), atr);
      fill(v, BULL_OG, true, isBullOg, bullGapBtm, bar);
      const isBearOg = test(v, BEAR_OG, bearGapTop, bearGapBtm, gt(low1, high), atr);
      fill(v, BEAR_OG, false, isBearOg, bearGapTop, bar);

      if (isBullOg) {
        register(boxes, { t2: i + cfg.ogExtend, data: {
          time1: time(i - 1), price1: bullGapTop, time2: NaN, price2: bullGapBtm, borderColor: 'transparent',
          bgColor: bullOgBg, text: 'OG', textColor: chartFg,
        } });
      }
      if (isBearOg) {
        register(boxes, { t2: i + cfg.ogExtend, data: {
          time1: time(i - 1), price1: bearGapTop, time2: NaN, price2: bearGapBtm, borderColor: 'transparent',
          bgColor: bearOgBg, text: 'OG', textColor: chartFg,
        } });
      }

      // Fair value gaps
      const isBullFvg = test(v, BULL_FVG, low, high2, gt(low, high2) && gt(close1, high2) && !(isBullOg || v.prevBullOg), atr);
      fill(v, BULL_FVG, true, isBullFvg, high2, bar);
      const isBearFvg = test(v, BEAR_FVG, low2, high, gt(low2, high) && gt(low2, close1) && !(isBearOg || v.prevBearOg), atr);
      fill(v, BEAR_FVG, false, isBearFvg, low2, bar);

      if (isBullFvg) {
        const avg = (low + high2) / 2;
        register(boxes, { t2: i + cfg.fvgExtend, data: { time1: time(i - 2), price1: low, time2: NaN, price2: high2, borderColor: 'transparent', bgColor: bullFvgBg } });
        register(lines, { t2: i + cfg.fvgExtend, data: { time1: time(i - 2), price1: avg, time2: NaN, price2: avg, color: cfg.bullFvgCss } });
      }
      if (isBearFvg) {
        const avg = (low2 + high) / 2;
        register(boxes, { t2: i + cfg.fvgExtend, data: { time1: time(i - 2), price1: low2, time2: NaN, price2: high, borderColor: 'transparent', bgColor: bearFvgBg } });
        register(lines, { t2: i + cfg.fvgExtend, data: { time1: time(i - 2), price1: avg, time2: NaN, price2: avg, color: cfg.bearFvgCss } });
      }

      [isBullFvg, isBearFvg, isBullOg, isBearOg, isBullVi, isBearVi].forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(bar.time as number);
      });
      v.prevBullVi = isBullVi;
      v.prevBearVi = isBearVi;
      v.prevBullOg = isBullOg;
      v.prevBearOg = isBearOg;
      v.prevBullGapBtm = bullGapBtm;
      v.prevBearGapTop = bearGapTop;
    },
    result(s, bars) {
      const n = bars.length;
      const v = s.vars;
      const end = <T extends { time2: number }>(d: Drawing<T>): T => Object.assign({}, d.data, { time2: barTime(bars, d.t2) });

      // Dashboard
      const tables: TableData[] = [];
      if (cfg.showDash && n > 0) {
        const position = cfg.dashLoc === 'Bottom Left' ? 'bottom_left' : cfg.dashLoc === 'Top Right' ? 'top_right' : 'bottom_right';
        const size: PineSize = cfg.textSize === 'Tiny' ? 'tiny' : cfg.textSize === 'Small' ? 'small' : 'normal';
        const cells = new Map<string, TableCellData>();
        const cell = (column: number, row: number, text: string, textColor: string, left = false) => {
          cells.set(`${column},${row}`, { column, row, text, textColor, textSize: size, ...(left ? { textHAlign: 'left' as const } : {}) });
        };
        if (cfg.showFvg) cell(2, 0, '〓 FVG', '#FFFFFF');
        if (cfg.showOg) cell(3, 0, '◼ OG', '#FFFFFF');
        if (cfg.showVi) cell(4, 0, '⬚ VI', '#FFFFFF');
        // table.merge_cells() makes the cells of its range that do not exist yet: empty cells
        const empty = (column: number, row: number) => {
          cells.set(`${column},${row}`, { column, row, text: '', textColor: 'transparent', textSize: 'auto' });
        };
        empty(0, 0);
        empty(1, 0);
        cell(0, 1, 'Bullish', '#089981');
        cell(1, 1, 'Frequency', '#089981', true);
        cell(1, 2, 'Filled', '#089981', true);
        empty(0, 2);
        cell(0, 3, 'Bearish', '#f23645');
        cell(1, 3, 'Frequency', '#f23645', true);
        cell(1, 4, 'Filled', '#f23645', true);
        empty(0, 4);
        // set_cells() on the last bar
        const setCells = (column: number, bull: number, bear: number, bullCss: string, bearCss: string) => {
          cell(column, 1, str.tostring(v.count[bull]), bullCss, true);
          cell(column, 2, str.format('{0,number,percent}', v.filled[bull] / v.count[bull]), bullCss, true);
          cell(column, 3, str.tostring(v.count[bear]), bearCss, true);
          cell(column, 4, str.format('{0,number,percent}', v.filled[bear] / v.count[bear]), bearCss, true);
        };
        if (cfg.showFvg) setCells(2, BULL_FVG, BEAR_FVG, cfg.bullFvgCss, cfg.bearFvgCss);
        if (cfg.showOg) setCells(3, BULL_OG, BEAR_OG, cfg.bullOgCss, cfg.bearOgCss);
        if (cfg.showVi) setCells(4, BULL_VI, BEAR_VI, cfg.bullViCss, cfg.bearViCss);
        tables.push({
          position, columns: 5, rows: 7, bgColor: '#1e222d', borderColor: '#373a46', borderWidth: 1, frameColor: '#373a46', frameWidth: 1,
          cells: [...cells.values()],
          merges: [
            { startColumn: 0, startRow: 0, endColumn: 1, endRow: 0 },
            { startColumn: 0, startRow: 1, endColumn: 0, endRow: 2 },
            { startColumn: 0, startRow: 3, endColumn: 0, endRow: 4 },
          ],
        });
      }

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        boxes: v.boxes.map(end),
        lines: v.lines.map(end),
        tables,
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ImbalanceDetectorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<ImbalanceDetectorInputs> = {},
  chart?: ChartContext,
): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish FVG', message: 'Bullish FVG detected' },
  { id: 'alert1', title: 'Bearish FVG', message: 'Bearish FVG detected' },
  { id: 'alert2', title: 'Bullish OG', message: 'Bullish OG detected' },
  { id: 'alert3', title: 'Bearish OG', message: 'Bearish OG detected' },
  { id: 'alert4', title: 'Bullish VI', message: 'Bullish VI detected' },
  { id: 'alert5', title: 'Bearish VI', message: 'Bearish VI detected' },
];

export const ImbalanceDetector = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
