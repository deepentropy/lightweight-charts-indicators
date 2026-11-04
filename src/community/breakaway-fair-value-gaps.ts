/**
 * Breakaway Fair Value Gaps (BFVG)
 *
 * A bullish fair value gap (low above the high of 2 bars back, with the close of the bar before above that high) is a
 * breakaway gap when the low is also above the highest high of the last "Trend Length" bars as it was 2 bars back;
 * a bearish breakaway gap is the mirror (high below the lowest low of the trend window 2 bars back). Each breakaway
 * gap draws a box over its 3 bars.
 *
 * With "Show Mitigation Levels" each gap also gets a mitigation line at its far edge (high of 2 bars back for a
 * bullish gap) and a label with the number of bars since the gap. While the gap is open, its line and label follow
 * the current bar. A close beyond the level mitigates the gap: the line stays where it ends, the label is deleted,
 * and the bars it took are counted. A gap still open "Maximum Duration" bars after its start is deleted (line and
 * label).
 *
 * Dashboard: per side, the share of mitigated gaps, the average (or median) number of bars to the mitigation and the
 * number of breakaway gaps.
 *
 * The two "FVG" colour inputs are declared by the original but not used (its regular gap boxes are commented out).
 * At most 500 boxes and 500 lines are kept.
 *
 * Reference: "Breakaway Fair Value Gaps [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import {
  ta, str, array, line, label, box, table, resetDrawings, setDrawingBar, drawingOutputs, Series,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type Line, type Label,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';

export interface BreakawayFairValueGapsInputs {
  /** Window of the highest high / lowest low */
  length: number;
  showMitigation: boolean;
  /** Bars after which an open gap is deleted */
  maxDuration: number;
  bullBCss: string;
  /** Declared by the original, not used */
  bullCss: string;
  bearBCss: string;
  /** Declared by the original, not used */
  bearCss: string;
  showDash: boolean;
  use_med: boolean;
  dashLoc: string;
  /** Text size of the dashboard */
  textSize: number;
}

export const defaultInputs: BreakawayFairValueGapsInputs = {
  length: 20,
  showMitigation: true,
  maxDuration: 60,
  bullBCss: 'rgba(8, 153, 129, 0.6)',
  bullCss: 'rgba(149, 152, 161, 0.6)',
  bearBCss: 'rgba(242, 54, 69, 0.6)',
  bearCss: 'rgba(67, 70, 81, 0.6)',
  showDash: true,
  use_med: false,
  dashLoc: 'Bottom Right',
  textSize: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Trend Length', defval: 20, min: 1 },
  { id: 'showMitigation', type: 'bool', title: 'Show Mitigation Levels', defval: true, group: 'Mitigation Levels' },
  { id: 'maxDuration', type: 'int', title: 'Maximum Duration', defval: 60, group: 'Mitigation Levels' },
  { id: 'bullBCss', type: 'color', title: 'Bullish BFVG', defval: 'rgba(8, 153, 129, 0.6)', inline: 'bull', group: 'Style' },
  { id: 'bullCss', type: 'color', title: 'FVG', defval: 'rgba(149, 152, 161, 0.6)', inline: 'bull', group: 'Style' },
  { id: 'bearBCss', type: 'color', title: 'Bearish BFVG', defval: 'rgba(242, 54, 69, 0.6)', inline: 'bear', group: 'Style' },
  { id: 'bearCss', type: 'color', title: 'FVG', defval: 'rgba(67, 70, 81, 0.6)', inline: 'bear', group: 'Style' },
  { id: 'showDash', type: 'bool', title: 'Show Dashboard', defval: true, group: 'Dashboard' },
  { id: 'use_med', type: 'bool', title: 'Use Median Duration', defval: false, group: 'Dashboard', active: { input: 'showDash' } },
  {
    id: 'dashLoc', type: 'string', title: 'Location', defval: 'Bottom Right', group: 'Dashboard',
    options: ['Top Right', 'Bottom Right', 'Bottom Left'], active: { input: 'showDash' },
  },
  { id: 'textSize', type: 'int', title: 'Size', defval: 14, group: 'Dashboard', active: { input: 'showDash' } },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['box', 'line', 'label', 'table'];

export const metadata = {
  title: 'Breakaway Fair Value Gaps [LuxAlgo]',
  shortTitle: 'LuxAlgo - Breakaway FVG',
  overlay: true,
};

/** indicator(max_boxes_count = 500, max_lines_count = 500) */
const MAX_OBJECTS = 500;
const WHITE = '#FFFFFF';
/** color.rgb(0, 0, 0, 100) */
const LABEL_BG = 'rgba(0, 0, 0, 0)';

// Pine float comparisons (1e-10); na compares false
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

interface Side {
  lines: Line[];
  labels: Label[];
  /** Number of breakaway gaps */
  count: number;
  /** Number of mitigated gaps */
  mitigated: number;
  /** Bars to the mitigation */
  bars: number[];
}

export function calculate(bars: Bar[], inputs: Partial<BreakawayFairValueGapsInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const upper = A(ta.highest(new Series(bars, (b) => b.high), cfg.length));
  const lower = A(ta.lowest(new Series(bars, (b) => b.low), cfg.length));

  resetDrawings({ box: MAX_OBJECTS, line: MAX_OBJECTS, label: 50 });
  const bull: Side = { lines: [], labels: [], count: 0, mitigated: 0, bars: [] };
  const bear: Side = { lines: [], labels: [], count: 0, mitigated: 0, bars: [] };

  const position = cfg.dashLoc === 'Bottom Left' ? 'bottom_left' : cfg.dashLoc === 'Top Right' ? 'top_right' : 'bottom_right';
  const tb = table.new(position, 4, 3, '#1e222d', '#373a46', 1, '#373a46', 1);
  const size = cfg.textSize;
  const cell = (c: number, r: number, text: string, bold = false) =>
    table.cell(tb, c, r, text, 0, 0, WHITE, undefined, undefined, size, undefined, undefined, undefined, bold ? 1 : undefined);

  /** Mitigation test of one side (the loop counts down from the newest gap) */
  const mitigation = (s: Side, i: number, close: number, isBull: boolean) => {
    for (let k = s.lines.length - 1; k >= 0; k--) {
      const fvg = s.lines[k];
      const x1 = line.get_x1(fvg);
      line.set_x2(fvg, i);
      label.set_x(s.labels[k], i);
      label.set_text(s.labels[k], str.tostring(i - x1));
      const y1 = line.get_y1(fvg);
      if (isBull ? lt(close, y1) : gt(close, y1)) {
        // the line stays, the label is deleted
        s.lines.splice(k, 1);
        label.delete(s.labels.splice(k, 1)[0]);
        s.mitigated += 1;
        s.bars.push(i - x1);
      } else if (i - x1 === cfg.maxDuration) {
        line.delete(s.lines.splice(k, 1)[0]);
        label.delete(s.labels.splice(k, 1)[0]);
      }
    }
  };

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const b1 = i >= 1 ? bars[i - 1] : undefined;
    const b2 = i >= 2 ? bars[i - 2] : undefined;
    const bullFvg = b1 !== undefined && b2 !== undefined && gt(b.low, b2.high) && gt(b1.close, b2.high);
    const bearFvg = b1 !== undefined && b2 !== undefined && lt(b.high, b2.low) && lt(b1.close, b2.low);

    // Bullish BFVG
    if (b2 && gt(b.low, upper[i - 2]) && bullFvg) {
      box.new(i - 2, b2.high, i, b.low, NaN, undefined, undefined, undefined, undefined, cfg.bullBCss);
      bull.count += 1;
      if (cfg.showMitigation) {
        bull.lines.unshift(line.new(i - 2, b2.high, i, b2.high, 'bar_index', 'none', cfg.bullBCss));
        bull.labels.unshift(label.new(i, b2.high, '2', 'bar_index', 'price', LABEL_BG, 'label_left', cfg.bullBCss));
      }
    }
    // Bearish BFVG
    if (b2 && lt(b.high, lower[i - 2]) && bearFvg) {
      box.new(i - 2, b2.low, i, b.high, NaN, undefined, undefined, undefined, undefined, cfg.bearBCss);
      bear.count += 1;
      if (cfg.showMitigation) {
        bear.lines.unshift(line.new(i - 2, b2.low, i, b2.low, 'bar_index', 'none', cfg.bearBCss));
        bear.labels.unshift(label.new(i, b2.low, '2', 'bar_index', 'price', LABEL_BG, 'label_left', cfg.bearBCss));
      }
    }
    // (the trend levels bull_lvl / bear_lvl of the original, from the middle of the trend window, only feed plots
    // that are commented out: not ported)

    if (bull.lines.length > 0) mitigation(bull, i, b.close, true);
    if (bear.lines.length > 0) mitigation(bear, i, b.close, false);

    // Dashboard
    if (i === 0 && cfg.showDash) {
      cell(0, 0, 'Max ' + str.tostring(cfg.maxDuration) + ' \nBars', true);
      cell(1, 0, 'Mitigation %');
      cell(2, 0, (cfg.use_med ? 'Med.' : 'Avg.') + ' Bars');
      cell(3, 0, 'Total');
      cell(0, 1, 'Bullish');
      cell(0, 2, 'Bearish');
    }
    if (i === n - 1 && cfg.showDash) {
      const avg = (s: Side) => Math.trunc(cfg.use_med ? array.median(s.bars) : array.avg(s.bars));
      cell(1, 1, str.tostring(bull.mitigated / bull.count * 100, 'percent'));
      cell(2, 1, str.tostring(avg(bull)));
      cell(3, 1, str.tostring(bull.count));
      cell(1, 2, str.tostring(bear.mitigated / bear.count * 100, 'percent'));
      cell(2, 2, str.tostring(avg(bear)));
      cell(3, 2, str.tostring(bear.count));
    }
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    ...drawingOutputs(bars),
  };
}

export const BreakawayFairValueGaps = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  drawingKinds,
};
