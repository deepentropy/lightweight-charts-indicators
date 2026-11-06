/**
 * Market Structure - By Leviathan
 *
 * Swing points are pivots with "Swing Length" bars on each side. A swing high at or above the swing high before is
 * "HH", else "LH"; a swing low at or above the swing low before is "HL", else "LL" (text labels on the pivot bar).
 * The first close (or wick, "BOS Confirmation") above the latest swing high, or below the latest swing low, is a
 * break of structure: a line from the swing bar to the break bar and a "BOS" text at its middle. With "Show CHoCH"
 * the first break against the direction of the break before is named "CHoCH".
 * "Show 0.5 Retracement Level" adds a line at the middle of an HL to HH move (or of an LH to LL move), from the bar
 * of the first swing to the bar of the second.
 *
 * At most 500 lines and 500 labels are kept (the oldest are removed first).
 * The swing texts use the chart foreground colour, read from the optional third argument (see
 * src/chart-context.ts); without it the port uses #DBDBDB (dark chart).
 *
 * Reference: "Market Structure - By Leviathan" by LeviathanCapital
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Leviathan. Swing point generation inspired by @BacktestRookies
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LabelData, LineDrawingData } from '../types';
import { barTime } from '../bar-time';
import { foregroundColorOf, type ChartContext } from '../chart-context';
import { createBarRun, fullResult, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

type LineStyleOption = 'Solid' | 'Dashed' | 'Dotted';

export interface MarketStructureByLeviathanInputs {
  /** Bars on each side of a swing point */
  swingSize: number;
  bosConfType: 'Candle Close' | 'Wicks';
  /** Name the first break against the direction before "CHoCH" */
  choch: boolean;
  showSwing: boolean;
  showHalf: boolean;
  halfColor: string;
  halfStyle: LineStyleOption;
  halfWidth: number;
  bosColor: string;
  bosStyle: LineStyleOption;
  bosWidth: number;
}

export const defaultInputs: MarketStructureByLeviathanInputs = {
  swingSize: 20,
  bosConfType: 'Candle Close',
  choch: false,
  showSwing: true,
  showHalf: false,
  halfColor: '#2927B0',
  halfStyle: 'Solid',
  halfWidth: 1,
  bosColor: '#707277',
  bosStyle: 'Dashed',
  bosWidth: 1,
};

const STYLES = ['Solid', 'Dashed', 'Dotted'];

export const inputConfig: InputConfig[] = [
  { id: 'swingSize', type: 'int', title: 'Swing Length', defval: 20 },
  { id: 'bosConfType', type: 'string', title: 'BOS Confirmation', defval: 'Candle Close', options: ['Candle Close', 'Wicks'] },
  { id: 'choch', type: 'bool', title: 'Show CHoCH', defval: false },
  { id: 'showSwing', type: 'bool', title: 'Show Swing Points', defval: true },
  { id: 'showHalf', type: 'bool', title: 'Show 0.5 Retracement Level', defval: false, group: '0.5 Retracement Level' },
  { id: 'halfColor', type: 'color', title: 'Color', defval: '#2927B0', group: '0.5 Retracement Level' },
  { id: 'halfStyle', type: 'string', title: 'Line Style', defval: 'Solid', options: STYLES, group: '0.5 Retracement Level' },
  { id: 'halfWidth', type: 'int', title: 'Width', defval: 1, min: 1, group: '0.5 Retracement Level' },
  { id: 'bosColor', type: 'color', title: 'Color', defval: '#707277', group: 'BOS Settings' },
  { id: 'bosStyle', type: 'string', title: 'Line Style', defval: 'Dashed', options: STYLES, group: 'BOS Settings' },
  { id: 'bosWidth', type: 'int', title: 'Width', defval: 1, min: 1, group: 'BOS Settings' },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Market Structure - By Leviathan',
  shortTitle: 'Market Structure - By Leviathan',
  overlay: true,
};

/** indicator(max_labels_count = 500, max_lines_count = 500) */
const MAX_OBJECTS = 500;
/** color.rgb(0, 0, 0, 100) */
const CLEAR = '#00000000';

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => a - b >= -EPS;

const lineStyle = (x: LineStyleOption): 'solid' | 'dashed' | 'dotted' =>
  x === 'Dashed' ? 'dashed' : x === 'Dotted' ? 'dotted' : 'solid';

/**
 * Pine drawing limit: when a creation brings the count above max + 5, the oldest are deleted until max remain. The
 * run keeps every drawing; the result shows the ones the limit leaves after `count` creations (the newest).
 */
function kept<T>(list: T[]): T[] {
  const count = list.length;
  const keep = count <= MAX_OBJECTS + 5 ? count : MAX_OBJECTS + ((count - MAX_OBJECTS - 6) % 6);
  return list.slice(count - keep);
}

type Result = Omit<IndicatorResult, 'labels' | 'lines'> & { labels: LabelData[]; lines: LineDrawingData[] };

interface LeviathanVars {
  prevHigh: number;
  prevLow: number;
  prevHighIndex: number;
  prevLowIndex: number;
  highActive: boolean;
  lowActive: boolean;
  /** HH = 2, LH = 1, HL = -1, LL = -2 */
  prevSwing: number;
  prevBreakoutDir: number;
}

interface LeviathanRun extends BarRunState<LeviathanVars> {
  pivHi: PivotStep;
  pivLo: PivotStep;
  lines: LineDrawingData[];
  labels: LabelData[];
}

function study(inputs: Partial<MarketStructureByLeviathanInputs>): BarStudy<LeviathanRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const swingSize = Math.trunc(cfg.swingSize);
  const byClose = cfg.bosConfType === 'Candle Close';
  let CHART_FG = '';
  return {
    init(_bars, chart) {
      // chart.fg_color
      CHART_FG = foregroundColorOf(chart);
      const pivHi = new PivotStep(swingSize, swingSize, true);
      const pivLo = new PivotStep(swingSize, swingSize, false);
      const s: LeviathanRun = {
        pivHi, pivLo, lines: [], labels: [],
        steps: [pivHi, pivLo],
        vars: {
          prevHigh: NaN, prevLow: NaN, prevHighIndex: NaN, prevLowIndex: NaN, highActive: false, lowActive: false,
          prevSwing: 0, prevBreakoutDir: 0,
        },
        lists: [], series: [],
      };
      s.lists = [s.lines, s.labels];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const bar = bars[i];
      // the drawings are on this bar or on earlier ones (a swing bar): their times are bar times
      const T = (index: number) => barTime(bars, index);
      const newLine = (x1: number, x2: number, y: number, col: string, style: LineStyleOption, width: number) => {
        s.lines.push({ time1: T(x1), price1: y, time2: T(x2), price2: y, color: col, style: lineStyle(style), width });
      };
      const pivHi = s.pivHi.step(i, bar.high);
      const pivLo = s.pivLo.step(i, bar.low);
      const prevSwing1 = v.prevSwing; // prevSwing[1]
      let hh = false;
      let lh = false;
      let hl = false;
      let ll = false;

      if (!isNaN(pivHi)) {
        if (ge(pivHi, v.prevHigh)) {
          hh = true;
          v.prevSwing = 2;
        } else {
          lh = true;
          v.prevSwing = 1;
        }
        v.prevHigh = pivHi;
        v.highActive = true;
        v.prevHighIndex = i - swingSize;
      }
      if (!isNaN(pivLo)) {
        if (ge(pivLo, v.prevLow)) {
          hl = true;
          v.prevSwing = -1;
        } else {
          ll = true;
          v.prevSwing = -2;
        }
        v.prevLow = pivLo;
        v.lowActive = true;
        v.prevLowIndex = i - swingSize;
      }

      let highBroken = false;
      let lowBroken = false;
      if (gt(byClose ? bar.close : bar.high, v.prevHigh) && v.highActive) {
        highBroken = true;
        v.highActive = false;
      }
      if (lt(byClose ? bar.close : bar.low, v.prevLow) && v.lowActive) {
        lowBroken = true;
        v.lowActive = false;
      }

      // Swing labels
      const swingLabel = (price: number, text: string, style: 'label_down' | 'label_up') => {
        s.labels.push({ time: T(i - swingSize), price, text, color: CLEAR, textColor: CHART_FG, style });
      };
      if (hh && cfg.showSwing) {
        swingLabel(pivHi, 'HH', 'label_down');
        if (prevSwing1 === -1 && cfg.showHalf) {
          newLine(v.prevLowIndex, i - swingSize, (v.prevLow + pivHi) / 2, cfg.halfColor, cfg.halfStyle, cfg.halfWidth);
        }
      }
      if (lh && cfg.showSwing) swingLabel(pivHi, 'LH', 'label_down');
      if (hl && cfg.showSwing) swingLabel(pivLo, 'HL', 'label_up');
      if (ll && cfg.showSwing) {
        swingLabel(pivLo, 'LL', 'label_up');
        if (prevSwing1 === 1 && cfg.showHalf) {
          newLine(v.prevHighIndex, i - swingSize, (v.prevHigh + pivLo) / 2, cfg.halfColor, cfg.halfStyle, cfg.halfWidth);
        }
      }

      // Break of structure lines
      if (highBroken) {
        newLine(v.prevHighIndex, i, v.prevHigh, cfg.bosColor, cfg.bosStyle, cfg.bosWidth);
        s.labels.push({
          time: T(Math.floor(i - (i - v.prevHighIndex) / 2)), price: v.prevHigh,
          text: v.prevBreakoutDir === -1 && cfg.choch ? 'CHoCH' : 'BOS',
          color: CLEAR, textColor: cfg.bosColor, style: 'label_down', size: 'tiny',
        });
        v.prevBreakoutDir = 1;
      }
      if (lowBroken) {
        newLine(v.prevLowIndex, i, v.prevLow, cfg.bosColor, cfg.bosStyle, cfg.bosWidth);
        s.labels.push({
          time: T(Math.floor(i - (i - v.prevLowIndex) / 2)), price: v.prevLow,
          text: v.prevBreakoutDir === 1 && cfg.choch ? 'CHoCH' : 'BOS',
          color: CLEAR, textColor: cfg.bosColor, style: 'label_up', size: 'tiny',
        });
        v.prevBreakoutDir = -1;
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        lines: kept(s.lines),
        labels: kept(s.labels),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MarketStructureByLeviathanInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MarketStructureByLeviathanInputs> = {},
  chart?: ChartContext,
): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const MarketStructureByLeviathan = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
