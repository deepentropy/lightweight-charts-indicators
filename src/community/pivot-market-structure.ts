/**
 * Pivot Market Structure
 *
 * Pivot lines: the high / low of the last pivot high / low (`Pivot Length` bars on each side, of the high / low or
 * of the source) is kept as a circle line from the confirmation bar on (optionally only while the close is below /
 * above it, and optionally drawn back to the pivot bar). High / low trail: a close above the highest high of the
 * last `Step Size` bars (before this bar) or below the lowest low starts a new leg; the upper tail is the highest
 * high (`Length` bars) as it was on the last close below the lowest low, drawn while the close is below it, and the
 * lower tail is the lowest low as it was on the last close above the highest high, drawn while the close is above
 * it. Gradient fills between the close and the tails (transparent unless Filling is on).
 *
 * Reference: "Pivot Market Structure" by Daniel_Ge
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Daniel_Ge
 */

import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, PivotStep, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { barTime } from '../bar-time';

export interface PivotMarketStructureInputs {
  /** Calculation source (not used when useHlValues is on) */
  src: SourceType;
  /** Use the high / low instead of the source */
  useHlValues: boolean;
  /** Length of the highest / lowest the close is compared with */
  stepLength: number;
  /** Length of the highest high / lowest low of the tails */
  hlLength: number;
  /** Gradient filling between the close and the tails */
  useFilling: boolean;
  /** Pivot length (left and right bars) */
  pivotLength: number;
  showPivotPoint: boolean;
  /** Draw the pivot lines back to the pivot bar */
  extendLeft: boolean;
  /** Pivot lines only while the close is below the pivot high / above the pivot low */
  lineBreak: boolean;
}

export const defaultInputs: PivotMarketStructureInputs = {
  src: 'close',
  useHlValues: true,
  stepLength: 1,
  hlLength: 10,
  useFilling: false,
  pivotLength: 5,
  showPivotPoint: false,
  extendLeft: false,
  lineBreak: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close', group: 'Source',
    tooltip: "Used calculation source. No effect if 'Use High/Low values instead of source' is used." },
  { id: 'useHlValues', type: 'bool', title: 'Use High/Low values instead of source', defval: true, group: 'Source',
    tooltip: "Use High/Low values for calculation. If unchecked 'Source' will be used." },
  { id: 'stepLength', type: 'int', title: 'Step Size', defval: 1, min: 1, group: 'High Low Trail',
    tooltip: 'Length used to compare the current price against the last highest high/lowest low.' },
  { id: 'hlLength', type: 'int', title: 'Length', defval: 10, min: 1, group: 'High Low Trail',
    tooltip: 'Length used to determine the last highest high/lowest low.' },
  { id: 'useFilling', type: 'bool', title: 'Filling', defval: false, group: 'High Low Trail', tooltip: 'Use Gradient Filling' },
  { id: 'pivotLength', type: 'int', title: 'Pivot Length', defval: 5, group: 'Pivot' },
  { id: 'showPivotPoint', type: 'bool', title: 'Show Pivot Points', defval: false, group: 'Pivot' },
  { id: 'extendLeft', type: 'bool', title: 'Extend Left', defval: false, group: 'Pivot',
    tooltip: 'Extend pivot line to the left until it reaches the pivot point' },
  { id: 'lineBreak', type: 'bool', title: 'Line Break', defval: false, group: 'Pivot', tooltip: 'Breaks the line at close' },
];

const PH_COL = String(color.new('#ff0099', 50));
const PL_COL = String(color.new('#00c3ff', 50));
const LEFT_COL = String(color.new('#b2b5be', 50));
const PPH_COL = String(color.new('#ff0099', 70));
const PPL_COL = String(color.new('#00c3ff', 70));
const UPPER_COL = String(color.new('#ff0099', 60));
const LOWER_COL = String(color.new('#00c3ff', 60));
const MID_COL = '#d1d4dc';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Pivot High (Right)', color: PH_COL, lineWidth: 1, style: 'circles' },
  { id: 'plot1', title: 'Pivot Low (Right)', color: PL_COL, lineWidth: 1, style: 'circles' },
  { id: 'plot2', title: 'Pivot High (Left)', color: LEFT_COL, lineWidth: 1, style: 'circles' },
  { id: 'plot3', title: 'Pivot Low (Left)', color: LEFT_COL, lineWidth: 1, style: 'circles' },
  { id: 'plot4', title: 'Tail Upper Line', color: UPPER_COL, lineWidth: 1, style: 'linebr' },
  { id: 'plot5', title: 'Tail Mid Line', color: MID_COL, lineWidth: 1, display: 'none' },
  { id: 'plot6', title: 'Tail Lower Line', color: LOWER_COL, lineWidth: 1, style: 'linebr' },
  { id: 'plot7', title: 'Close', color: color.blue, lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Pivot Market Structure',
  shortTitle: 'Pivot Market Structure',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;


type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface PmsVars {
  /** The last bar of each ta.barssince condition (-1: never true) */
  phLast: number;
  plLast: number;
  lowestLast: number;
  highestLast: number;
}

interface PmsRun extends BarRunState<PmsVars> {
  ph: PivotStep;
  pl: PivotStep;
  hiStep: WindowExtreme;
  loStep: WindowExtreme;
  hiLen: WindowExtreme;
  loLen: WindowExtreme;
  hiSrc: number[];
  loSrc: number[];
  hiStepArr: number[];
  loStepArr: number[];
  hiLenArr: number[];
  loLenArr: number[];
  close: number[];
  upperLine: number[];
  lowerLine: number[];
  /** plot0, plot1, plot4, plot5, plot6, plot7 */
  lines: Point[][];
  plot2: Point[];
  plot3: Point[];
  markers: MarkerData[];
}

function study(inputs: Partial<PivotMarketStructureInputs>): BarStudy<PmsRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const L = cfg.pivotLength;
  const value = barSource(cfg.src);
  /**
   * x[k]: na before the first bar. An na offset reads the current bar (x[na] = x[0] in Pine: before the first pivot,
   * high[pivot_length + na] is the high of the bar)
   */
  const hist = (x: number[], i: number, k: number) => {
    const off = isNaN(k) ? 0 : k;
    return i - off < 0 ? NaN : x[i - off];
  };
  /** ta.barssince(cond) from the last bar where it was true */
  const since = (last: number, i: number) => (last < 0 ? NaN : i - last);
  return {
    fullRunReason: () => (cfg.useHlValues || isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: PmsRun = {
        // Pivot points (ta.pivothigh(pivot_length, pivot_length) uses the high, ta.pivotlow the low)
        ph: new PivotStep(L, L, true), pl: new PivotStep(L, L, false),
        hiStep: new WindowExtreme(false, cfg.stepLength), loStep: new WindowExtreme(true, cfg.stepLength),
        hiLen: new WindowExtreme(false, cfg.hlLength), loLen: new WindowExtreme(true, cfg.hlLength),
        hiSrc: [], loSrc: [], hiStepArr: [], loStepArr: [], hiLenArr: [], loLenArr: [], close: [], upperLine: [],
        lowerLine: [], lines: Array.from({ length: 6 }, () => []), plot2: [], plot3: [], markers: [],
        steps: [], vars: { phLast: -1, plLast: -1, lowestLast: -1, highestLast: -1 }, lists: [], series: [],
      };
      s.steps = [s.ph, s.pl, s.hiStep, s.loStep, s.hiLen, s.loLen];
      // plot2 / plot3 have one point per bar from bar pivot_length on (drawn pivot_length bars back)
      s.lists = [s.plot2, s.plot3, s.markers];
      s.series = [
        s.hiSrc, s.loSrc, s.hiStepArr, s.loStepArr, s.hiLenArr, s.loLenArr, s.close, s.upperLine, s.lowerLine, ...s.lines,
      ];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time as number;
      const v = s.vars;
      const close = b.close;
      s.close[i] = close;
      const src = value(b);
      const hi = cfg.useHlValues ? b.high : src;
      const lo = cfg.useHlValues ? b.low : src;
      s.hiSrc[i] = hi;
      s.loSrc[i] = lo;

      const ph = s.ph.step(i, hi);
      const pl = s.pl.step(i, lo);
      // ta.barssince(bool(ph)): bool(na) and bool(0) are false
      if (!isNaN(ph) && ph !== 0) v.phLast = i;
      if (!isNaN(pl) && pl !== 0) v.plLast = i;
      const phBarssince = since(v.phLast, i);
      const plBarssince = since(v.plLast, i);
      const phHigh = hist(s.hiSrc, i, L + phBarssince);
      const plLow = hist(s.loSrc, i, L + plBarssince);

      // High / low trail
      s.hiStepArr[i] = s.hiStep.step(hi);
      s.loStepArr[i] = s.loStep.step(lo);
      const isHighest = gt(close, hist(s.hiStepArr, i, 1));
      const isLowest = lt(close, hist(s.loStepArr, i, 1));
      if (isLowest) v.lowestLast = i;
      if (isHighest) v.highestLast = i;
      const highestBarssince = since(v.lowestLast, i);
      const lowestBarssince = since(v.highestLast, i);
      s.hiLenArr[i] = s.hiLen.step(hi);
      s.loLenArr[i] = s.loLen.step(lo);
      const highestSinceX = hist(s.hiLenArr, i, highestBarssince);
      const lowestSinceX = hist(s.loLenArr, i, lowestBarssince);
      const upperLine = lt(close, highestSinceX) ? highestSinceX : NaN;
      const lowerLine = gt(close, lowestSinceX) ? lowestSinceX : NaN;
      const midLine = (highestSinceX + lowestSinceX) / 2;
      s.upperLine[i] = upperLine;
      s.lowerLine[i] = lowerLine;

      const p = s.lines;
      p[0][i] = { time: t, value: cfg.lineBreak ? (lt(close, phHigh) ? phHigh : NaN) : phHigh, color: PH_COL };
      p[1][i] = { time: t, value: cfg.lineBreak ? (gt(close, plLow) ? plLow : NaN) : plLow, color: PL_COL };
      p[2][i] = { time: t, value: upperLine, color: UPPER_COL };
      p[3][i] = { time: t, value: midLine, color: MID_COL };
      p[4][i] = { time: t, value: lowerLine, color: LOWER_COL };
      p[5][i] = { time: t, value: close };

      // plot(..., offset = -pivot_length): the value of bar i is drawn on bar i - pivot_length
      if (i - L >= 0) {
        const tb = barTime(bars, i - L);
        s.plot2.push({ time: tb, value: cfg.extendLeft && gt(L, phBarssince) ? phHigh : NaN, color: LEFT_COL });
        s.plot3.push({ time: tb, value: cfg.extendLeft && gt(L, plBarssince) ? plLow : NaN, color: LEFT_COL });
      }

      // plotshape(show_pivot_point ? ph : na, shape.circle, location.abovebar / belowbar, offset = -pivot_length)
      if (cfg.showPivotPoint && i >= L) {
        if (!isNaN(ph) && ph !== 0) {
          s.markers.push({ time: barTime(bars, i - L), position: 'aboveBar', shape: 'circle', color: PPH_COL, size: 'auto' });
        }
        if (!isNaN(pl) && pl !== 0) {
          s.markers.push({ time: barTime(bars, i - L), position: 'belowBar', shape: 'circle', color: PPL_COL, size: 'auto' });
        }
      }
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.lines;
      const plots = {
        plot0: p[0].slice(),
        plot1: p[1].slice(),
        plot2: s.plot2.slice(),
        plot3: s.plot3.slice(),
        plot4: p[2].slice(),
        plot5: p[3].slice(),
        plot6: p[4].slice(),
        plot7: p[5].slice(),
      };

      // fill(p_close, p_upper / p_lower, close, upper_line / lower_line, na, use_filling ? color.new(c, 97) : color.new(c, 100))
      const upperFill = String(color.new('#ff0099', cfg.useFilling ? 97 : 100));
      const lowerFill = String(color.new('#00c3ff', cfg.useFilling ? 97 : 100));
      const none = new Array<string | null>(n).fill(null);
      const fills = [
        { plot1: 'plot7', plot2: 'plot4', options: { title: 'Upper Gradient Filling' },
          gradient: { topValue: s.close.slice(), bottomValue: s.upperLine.slice(), topColor: none, bottomColor: new Array<string | null>(n).fill(upperFill) } },
        { plot1: 'plot7', plot2: 'plot6', options: { title: 'Lower Gradient Filling' },
          gradient: { topValue: s.close.slice(), bottomValue: s.lowerLine.slice(), topColor: none.slice(), bottomColor: new Array<string | null>(n).fill(lowerFill) } },
      ];

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        markers: s.markers.slice(),
        fills,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PivotMarketStructureInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PivotMarketStructureInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const PivotMarketStructure = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
