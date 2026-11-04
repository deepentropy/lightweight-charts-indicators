/**
 * Pivots High/Low Analysis & Forecast [LuxAlgo]
 *
 * Finds the pivot highs and lows (the same number of bars on each side) and compares each pivot with the previous
 * pivot of the same kind: a dotted line at the previous pivot level, a two-headed arrow from the previous level to the
 * new pivot (blue when the new pivot is higher, red when lower) and a label with the change in percent and the number
 * of bars between the two pivots. The averages of these two numbers over the history give the expected distance to
 * the next pivot: a dashed vertical line marks the forecast bar of the next pivot high and low, and a dotted line
 * extends the last pivot level to the right (only the latest forecast of each kind is kept; the pivot high forecast
 * follows "Show Forecasted Pivots", the pivot low forecast is always drawn, as in the original). A dashboard gives the
 * averages. Pivot highs and lows are also plotted as circles on their bars.
 *
 * Reference: "Pivots High/Low Analysis & Forecast [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import {
  ta, str, Series, line, label, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type IndicatorResult, type InputConfig, type Line, type PlotConfig, type PineSize, type TablePosition,
} from 'oakscriptjs';
import type { TableData } from '../types';
import type { StudyDrawingKind } from '../style-outputs';

export interface PivotHighLowAnalysisForecastInputs {
  /** Bars on each side of a pivot */
  length: number;
  /** Show Forecasted Pivots (pivot highs) */
  showFcast: boolean;
  /** Dashboard Location */
  dashLoc: 'Top Right' | 'Bottom Right' | 'Top Left' | 'Bottom Left';
  /** Dashboard Size */
  textSize: 'Tiny' | 'Small' | 'Normal' | 'Large';
  /** Text/Frame Color */
  txtCol: string;
}

export const defaultInputs: PivotHighLowAnalysisForecastInputs = {
  length: 50,
  showFcast: true,
  dashLoc: 'Bottom Right',
  textSize: 'Normal',
  txtCol: '#787B86',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 50 },
  { id: 'showFcast', type: 'bool', title: 'Show Forecasted Pivots', defval: true },
  { id: 'dashLoc', type: 'string', title: 'Dashboard Location', defval: 'Bottom Right', options: ['Top Right', 'Bottom Right', 'Top Left', 'Bottom Left'], group: 'Dashboard' },
  { id: 'textSize', type: 'string', title: 'Dashboard Size', defval: 'Normal', options: ['Tiny', 'Small', 'Normal', 'Large'], group: 'Dashboard' },
  { id: 'txtCol', type: 'color', title: 'Text/Frame Color', defval: '#787B86', group: 'Dashboard' },
];

const RED = '#ff1100';
const GREEN = '#0cb51a';
const BLUE = '#2157f3';
/** Pine v4 color.gray */
const GRAY = '#787B86';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Pivot High', color: RED, lineWidth: 2, style: 'circles' },
  { id: 'plot1', title: 'Pivot Low', color: GREEN, lineWidth: 2, style: 'circles' },
];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'table'];

export const metadata = {
  title: 'Pivots High/Low Analysis & Forecast [LuxAlgo]',
  shortTitle: 'Pivots High/Low Analysis & Forecast [LuxAlgo]',
  overlay: true,
};

/** study(max_lines_count = 500, max_labels_count = 500) */
const MAX_OBJECTS = 500;

/** Pine float comparison: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;

export function calculate(bars: Bar[], inputs: Partial<PivotHighLowAnalysisForecastInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const length = Math.trunc(cfg.length);

  const ph = ta.pivothigh(new Series(bars, (b) => b.high), length, length).toArray();
  const pl = ta.pivotlow(new Series(bars, (b) => b.low), length, length).toArray();
  // a float condition is false for na and 0
  const isTrue = (v: number) => !Number.isNaN(v) && v !== 0;
  const phCond = Series.fromArray(bars, ph.map((v) => (isTrue(v) ? 1 : 0)));
  const plCond = Series.fromArray(bars, pl.map((v) => (isTrue(v) ? 1 : 0)));
  const xSeries = Series.fromArray(bars, bars.map((_, i) => i - length));
  const phX2 = ta.valuewhen(phCond, xSeries, 1).toArray();
  const plX2 = ta.valuewhen(plCond, xSeries, 1).toArray();
  const phY2 = ta.valuewhen(phCond, Series.fromArray(bars, ph), 1).toArray();
  const plY2 = ta.valuewhen(plCond, Series.fromArray(bars, pl), 1).toArray();

  resetDrawings({ line: MAX_OBJECTS, label: MAX_OBJECTS });

  // cum() of the bar counts / changes and of their signs (cum skips na)
  let sumBarsPh = 0;
  let sumBarsPl = 0;
  let cntBarsPh = 0;
  let cntBarsPl = 0;
  let sumChgPh = 0;
  let sumChgPl = 0;
  let cntChgPh = 0;
  let cntChgPl = 0;
  const addNz = (v: number) => (Number.isNaN(v) ? 0 : v);
  // line.delete(line.new(...)[1]): the line of the previous run of the same block
  let phFcast: [Line | null, Line | null] = [null, null];
  let plFcast: [Line | null, Line | null] = [null, null];
  let avgBarsPh = NaN;
  let avgBarsPl = NaN;
  let avgChgPh = NaN;
  let avgChgPl = NaN;

  const pivot = (i: number, p: number, x2: number, y2: number, isHigh: boolean) => {
    const x = i - length;
    const barsSince = x - x2;
    const rchange = ((p - y2) / y2) * 100;
    const txt = str.format('Δ% : {0,number,#.##}\nΔt : {1}', rchange, barsSince);
    const css = gt(p, y2) ? BLUE : RED;
    line.new(x, y2, x2, y2, 'bar_index', 'none', isHigh ? RED : GREEN, 'dotted');
    line.new(x, p, x, y2, 'bar_index', 'none', css, 'arrow_both');
    label.new(x, isHigh ? Math.max(p, y2) : Math.min(p, y2), txt, 'bar_index', 'price', '#00000000',
      isHigh ? 'label_down' : 'label_up', GRAY, 'small', 'left');
    return [barsSince, rchange];
  };

  const forecast = (i: number, p: number, avgBars: number, prev: [Line | null, Line | null], col: string) => {
    const b = bars[i];
    // x12 = n + min(int(avg_barssince - length), 500)
    const x12 = i + Math.min(Math.trunc(avgBars - length), 500);
    const v = line.new(x12, b.high, x12, b.low, 'bar_index', 'both', col, 'dashed');
    if (prev[0]) line.delete(prev[0]);
    const h = line.new(i - length, p, i, p, 'bar_index', 'right', col, 'dotted');
    if (prev[1]) line.delete(prev[1]);
    return [v, h] as [Line, Line];
  };

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    let barsSincePh = 0;
    let barsSincePl = 0;
    let rchangePh = 0;
    let rchangePl = 0;
    const p = ph[i] ?? NaN;
    const q = pl[i] ?? NaN;
    if (isTrue(p)) [barsSincePh, rchangePh] = pivot(i, p, phX2[i], phY2[i], true);
    if (isTrue(q)) [barsSincePl, rchangePl] = pivot(i, q, plX2[i], plY2[i], false);

    sumBarsPh += addNz(barsSincePh);
    sumBarsPl += addNz(barsSincePl);
    cntBarsPh += addNz(Math.sign(barsSincePh));
    cntBarsPl += addNz(Math.sign(barsSincePl));
    sumChgPh += addNz(rchangePh);
    sumChgPl += addNz(rchangePl);
    cntChgPh += addNz(Math.abs(Math.sign(rchangePh)));
    cntChgPl += addNz(Math.abs(Math.sign(rchangePl)));
    avgBarsPh = sumBarsPh / cntBarsPh;
    avgBarsPl = sumBarsPl / cntBarsPl;
    avgChgPh = sumChgPh / cntChgPh;
    avgChgPl = sumChgPl / cntChgPl;

    if (cfg.showFcast && isTrue(p)) phFcast = forecast(i, p, avgBarsPh, phFcast, RED);
    if (isTrue(q)) plFcast = forecast(i, q, avgBarsPl, plFcast, GREEN);
  }
  setDrawingBar(null);

  // the dashboard (a new table on every bar: the one of the last bar is shown)
  const position: TablePosition = cfg.dashLoc === 'Top Left' ? 'top_left'
    : cfg.dashLoc === 'Bottom Left' ? 'bottom_left'
      : cfg.dashLoc === 'Top Right' ? 'top_right' : 'bottom_right';
  const textSize: PineSize = cfg.textSize === 'Tiny' ? 'tiny'
    : cfg.textSize === 'Small' ? 'small'
      : cfg.textSize === 'Normal' ? 'normal' : 'large';
  const tables: TableData[] = [];
  if (n > 0) {
    const cell = (column: number, row: number, text: string) => ({ column, row, text, textColor: cfg.txtCol, textSize });
    tables.push({
      position, columns: 3, rows: 3, borderColor: cfg.txtCol, borderWidth: 1, frameColor: cfg.txtCol, frameWidth: 1,
      cells: [
        cell(0, 1, 'Pivot High'),
        cell(0, 2, 'Pivot Low'),
        cell(1, 0, 'E[Δt]'),
        cell(2, 0, 'E[Δ%]'),
        cell(1, 1, str.tostring(avgBarsPh, '#.##')),
        cell(1, 2, str.tostring(avgBarsPl, '#.##')),
        cell(2, 1, str.tostring(avgChgPh, '#.##')),
        cell(2, 2, str.tostring(avgChgPl, '#.##')),
      ],
    });
  }

  // plot(ph, offset = -length): the pivot value on the pivot bar
  const shifted = (values: number[]) => bars.map((b, j) => {
    const v = j + length < n ? values[j + length] : NaN;
    return { time: b.time, value: v ?? NaN };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: shifted(ph), plot1: shifted(pl) },
    ...drawingOutputs(bars),
    tables,
  };
}

export const PivotHighLowAnalysisForecast = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  drawingKinds,
};
