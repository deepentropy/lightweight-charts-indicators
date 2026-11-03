/**
 * Swing High/Low (ZigZag)
 *
 * The trend turns up on a bar whose high is the highest high of `len` bars and down on a bar whose low is the lowest
 * low of `len` bars. The bar of the last swing high (or low) is the bar before the first bar that stays below the
 * highest high (above the lowest low). On each turn the script draws the level of the swing that ends (a solid line
 * of width 2 and an optional wide "shadow" line, extended to the current bar) and a dashed zigzag line between the
 * two last swings; older levels are deleted unless "History Levels" is on. "Broken Levels" makes a level dashed when
 * the price crosses it. On the last bar a dashed line joins the last swing to the current extreme, two labels give
 * the swing high / low prices and a table shows the swing direction. With "Levels" off a label marks each swing
 * on every bar instead of the level lines.
 *
 * Chart values (optional third argument of calculate): the label and table texts use the chart foreground colour
 * (`foregroundColor`, dark theme #DBDBDB without a context), and on the last bar "Broken Levels" only dashes a
 * broken swing low when that bar is closed (`lastBarConfirmed`).
 *
 * Reference: "Swing High/Low (ZigZag) [ChartPrime]" by ChartPrime
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, str, color, callsite, Series, line, label, table, resetDrawings, setDrawingBar, varDrawing, drawingOutputs,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type Line, type Label,
} from 'oakscriptjs';
import { foregroundColorOf, lastBarConfirmedOf, type ChartContext } from '../chart-context';
import type { StudyDrawingKind } from '../style-outputs';

export interface SwingHighLowInputs {
  /** Swing Length */
  len: number;
  /** Levels */
  hideHL: boolean;
  /** Broken Levels */
  brokenLevels: boolean;
  /** History Levels */
  historyLevels: boolean;
  /** Shadow */
  shadow: boolean;
  /** Width of the shadow line */
  shadowWidth: number;
  /** Colour of the swing highs */
  upperCol: string;
  /** Colour of the swing lows */
  lowerCol: string;
}

export const defaultInputs: SwingHighLowInputs = {
  len: 100,
  hideHL: true,
  brokenLevels: false,
  historyLevels: false,
  shadow: true,
  shadowWidth: 8,
  upperCol: '#C424E0',
  lowerCol: '#24E075',
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Swing Length', defval: 100 },
  { id: 'hideHL', type: 'bool', title: 'Levels', defval: true, inline: 'lvl', group: 'Levels' },
  { id: 'brokenLevels', type: 'bool', title: 'Broken Levels', defval: false, inline: 'lvl', group: 'Levels' },
  { id: 'historyLevels', type: 'bool', title: 'History Levels', defval: false, inline: 'lvl', group: 'Levels' },
  { id: 'shadow', type: 'bool', title: 'Shadow', defval: true, inline: 's', group: 'Levels' },
  { id: 'shadowWidth', type: 'int', title: '', defval: 8, inline: 's', group: 'Levels' },
  { id: 'upperCol', type: 'color', title: '▽', defval: '#C424E0', inline: 'cc' },
  { id: 'lowerCol', type: 'color', title: '△', defval: '#24E075', inline: 'cc' },
];

/** plot(na, editable = false): an empty plot */
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Plot', color: '#2962FF', lineWidth: 1 },
];

/** Drawings of the script */
export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'table'];

export const metadata = {
  title: 'Swing High/Low (ZigZag) [ChartPrime]',
  shortTitle: 'Swing High/Low (ZigZag) [ChartPrime]',
  overlay: true,
};

/** Pine float comparisons: a == b within 1e-10, a < b only when b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;
const lt = (a: number, b: number) => b - a > EPS;
const NA_COLOR = 'transparent';

export function calculate(bars: Bar[], inputs: Partial<SwingHighLowInputs> = {}, chart?: ChartContext): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const len = Math.trunc(cfg.len);
  const upperCol = cfg.upperCol;
  const lowerCol = cfg.lowerCol;
  const fg = foregroundColorOf(chart);
  const lastConfirmed = lastBarConfirmedOf(chart);

  const upper = ta.highest(new Series(bars, (b) => b.high), len).toArray().map((v) => v ?? NaN);
  const lower = ta.lowest(new Series(bars, (b) => b.low), len).toArray().map((v) => v ?? NaN);

  resetDrawings({ line: 50, label: 500, box: 50 });
  const lineH = varDrawing<Line>();
  const lineH1 = varDrawing<Line>();
  const lineL = varDrawing<Line>();
  const lineL1 = varDrawing<Line>();
  const lineZ = varDrawing<Line>();
  const lineUp = varDrawing<Line>();
  const lineDn = varDrawing<Line>();
  const lblH = varDrawing<Label>();
  const lblL = varDrawing<Label>();
  let indexH = 0;
  let indexL = 0;
  // var trend = bool(na): false in Pine v6 (a bool is never na)
  let trend = false;
  const crossOver = callsite.crossover();
  const crossUnder = callsite.crossunder();
  const y1 = (l: Line | undefined) => (l ? line.get_y1(l) : NaN);
  const x1 = (l: Line | undefined) => (l ? line.get_x1(l) : NaN);
  const y2 = (l: Line | undefined) => (l ? line.get_y2(l) : NaN);
  const del = (l: Line | undefined) => {
    if (l) line.delete(l);
  };

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const time = b.time * 1000;
    const prevTrend: boolean = trend;
    // line_h[1], line_h1[1], line_l[1], line_l1[1]: the variables as they were on the bar before
    const prevH = lineH.value;
    const prevH1 = lineH1.value;
    const prevL = lineL.value;
    const prevL1 = lineL1.value;

    const upperTrigger = i > 0 && eq(bars[i - 1].high, upper[i - 1]) && lt(b.high, upper[i]);
    const lowerTrigger = i > 0 && eq(bars[i - 1].low, lower[i - 1]) && lt(lower[i], b.low);
    if (upperTrigger) indexH = bars[i - 1].time * 1000;
    if (lowerTrigger) indexL = bars[i - 1].time * 1000;
    if (eq(b.high, upper[i])) trend = true;
    if (eq(b.low, lower[i])) trend = false;

    if (!trend && prevTrend) {
      lineH.value = line.new(indexH, upper[i], time, upper[i], 'bar_time', undefined, cfg.hideHL ? upperCol : NA_COLOR,
        undefined, 2);
      if (cfg.shadow) {
        lineH1.value = line.new(indexH, upper[i], line.get_x2(lineH.value), upper[i], 'bar_time', undefined,
          cfg.hideHL ? String(color.new(upperCol, 70)) : NA_COLOR, undefined, cfg.shadowWidth);
      }
      lineZ.value = line.new(indexL, y1(lineL.value), line.get_x1(lineH.value), upper[i], 'bar_time', undefined, lowerCol);
      if (!cfg.historyLevels) {
        del(prevH);
        del(prevH1);
      }
    }

    if (trend && !prevTrend) {
      lineL.value = line.new(indexL, lower[i], time, lower[i], 'bar_time', undefined, cfg.hideHL ? lowerCol : NA_COLOR,
        undefined, 2);
      if (cfg.shadow) {
        lineL1.value = line.new(indexL, lower[i], time, lower[i], 'bar_time', undefined,
          cfg.hideHL ? String(color.new(lowerCol, 70)) : NA_COLOR, undefined, cfg.shadowWidth);
      }
      lineZ.value = line.new(indexH, y1(lineH.value), line.get_x1(lineL.value), lower[i], 'bar_time', undefined, upperCol);
      if (!cfg.historyLevels) {
        del(prevL);
        del(prevL1);
      }
    }

    if (lineZ.value) line.set_style(lineZ.value, 'dashed');
    for (const l of [lineL.value, lineL1.value, lineH.value, lineH1.value]) if (l) line.set_x2(l, time);

    const crossOverNow = crossOver(b.low, y1(lineH.value));
    const crossUnderNow = crossUnder(b.high, y1(lineL.value));
    const confirmed = i < n - 1 || lastConfirmed;
    if (trend === prevTrend && cfg.brokenLevels) {
      if (crossOverNow && lineH.value) {
        line.set_style(lineH.value, 'dashed');
        line.set_width(lineH.value, 1);
      }
      if (crossUnderNow && confirmed && lineL.value) {
        line.set_style(lineL.value, 'dashed');
        line.set_width(lineL.value, 1);
      }
    }

    if (i === n - 1) {
      // `not trend != trend[1]` is `(not trend) != trend[1]`: the trend did not change on this bar. The objects of
      // the bar before (line_up[1], lbl_h[1] ...) are na on the last bar of the history.
      if (trend === prevTrend) {
        if (trend) {
          lineUp.value = line.new(indexL, y1(lineL.value), indexH, upper[i], 'bar_time', undefined, lowerCol, 'dashed');
        } else {
          lineDn.value = line.new(indexH, y1(lineH.value), indexL, lower[i], 'bar_time', undefined, upperCol, 'dashed');
        }
      }
      if (cfg.hideHL) {
        const h = y1(lineH.value);
        const l = y1(lineL.value);
        lblH.value = label.new(i, h, str.tostring(h, 'Swing H  (#,###.####)'), undefined, undefined,
          String(color.new(upperCol, 50)), 'label_left', fg);
        lblL.value = label.new(i, l, str.tostring(l, 'Swing L  (#,###.####)'), undefined, undefined,
          String(color.new(lowerCol, 50)), 'label_left', fg);
      }
      const tbl = table.new('top_right', 10, 10);
      table.cell(tbl, 0, 0, 'Swing Direction: ', undefined, undefined, fg);
      table.cell(tbl, 1, 0, trend ? '⬈' : '⬊', undefined, undefined, trend ? lowerCol : upperCol, undefined, undefined,
        'huge');
    }

    if (!cfg.hideHL) {
      label.new(x1(lineH.value), y2(lineH.value), '', 'bar_time', undefined, upperCol);
      label.new(x1(lineL.value), y2(lineL.value), '', 'bar_time', undefined, lowerCol, 'label_up');
    }
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: bars.map((b) => ({ time: b.time, value: NaN })) },
    ...drawingOutputs(bars),
  };
}

export const SwingHighLow = { calculate, metadata, defaultInputs, inputConfig, plotConfig, drawingKinds };
