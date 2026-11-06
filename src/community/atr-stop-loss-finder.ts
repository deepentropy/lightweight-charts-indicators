/**
 * ATR Stop Loss Finder
 *
 * Two stop levels from the average true range: a short stop at source 1 (the high) plus the smoothed true range
 * times the multiplier, a long stop at source 2 (the low) minus it. The smoothing is RMA, SMA, EMA or WMA. A table at
 * the bottom centre of the chart shows the ATR distance and both stops of the last bar.
 *
 * The original draws a price line on each plot (`trackprice`, "Show Price Lines"); the plot output has no such
 * option, so the input has no effect here.
 *
 * Reference: "Average True Range Stop Loss Finder" by veryfid
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  taStep, str, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { TableData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AtrStopLossFinderInputs {
  /** Length */
  length: number;
  /** Smoothing */
  smoothing: 'RMA' | 'SMA' | 'EMA' | 'WMA';
  /** Multiplier */
  m: number;
  /** Source of the short stop */
  src1: SourceType;
  /** Source of the long stop */
  src2: SourceType;
  /** Show Price Lines */
  pline: boolean;
  /** ATR Text Color */
  col1: string;
  /** Low Text Color */
  col2: string;
  /** High Text Color */
  col3: string;
  /** Low Line Color */
  collong: string;
  /** High Line Color */
  colshort: string;
}

// Colours of the original Pine version
const BLUE = '#2196F3';
const TEAL = '#00897B';
const RED = '#FF5252';

export const defaultInputs: AtrStopLossFinderInputs = {
  length: 14,
  smoothing: 'RMA',
  m: 1.5,
  src1: 'high',
  src2: 'low',
  pline: true,
  col1: BLUE,
  col2: TEAL,
  col3: RED,
  collong: TEAL,
  colshort: RED,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
  { id: 'smoothing', type: 'string', title: 'Smoothing', defval: 'RMA', options: ['RMA', 'SMA', 'EMA', 'WMA'] },
  { id: 'm', type: 'float', title: 'Multiplier', defval: 1.5 },
  { id: 'src1', type: 'source', title: 'src1', defval: 'high' },
  { id: 'src2', type: 'source', title: 'src2', defval: 'low' },
  { id: 'pline', type: 'bool', title: 'Show Price Lines', defval: true },
  { id: 'col1', type: 'color', title: 'ATR Text Color', defval: BLUE },
  { id: 'col2', type: 'color', title: 'Low Text Color', defval: TEAL, inline: '1' },
  { id: 'col3', type: 'color', title: 'High Text Color', defval: RED, inline: '2' },
  { id: 'collong', type: 'color', title: 'Low Line Color', defval: TEAL, inline: '1' },
  { id: 'colshort', type: 'color', title: 'High Line Color', defval: RED, inline: '2' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ATR Short Stop Loss', color: String(color.new(RED, 20)), lineWidth: 1 },
  { id: 'plot1', title: 'ATR Long Stop Loss', color: String(color.new(TEAL, 20)), lineWidth: 1 },
];

export const metadata = {
  title: 'Average True Range Stop Loss Finder',
  shortTitle: 'ATR',
  overlay: true,
};

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { tables: TableData[] };

interface AtrRun extends BarRunState<Record<string, never>> {
  tr: ReturnType<typeof taStep.tr>;
  ma: { step(v: number): number; commit(): void };
  a: number[];
  x: number[];
  x2: number[];
  shortData: Point[];
  longData: Point[];
}

function study(inputs: Partial<AtrStopLossFinderInputs>): BarStudy<AtrRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value1 = barSource(cfg.src1);
  const value2 = barSource(cfg.src2);
  // plot(..., color = colshort / collong, transp = 20)
  const shortColor = String(color.new(cfg.colshort, 20));
  const longColor = String(color.new(cfg.collong, 20));
  const maStep = (): AtrRun['ma'] => {
    switch (cfg.smoothing) {
      case 'RMA': return taStep.rma(cfg.length);
      case 'SMA': return new WindowSma(cfg.length);
      case 'EMA': return taStep.ema(cfg.length);
      default: { const m = taStep.wma(); return { step: (v) => m.step(v, cfg.length), commit: () => m.commit() }; }
    }
  };
  return {
    fullRunReason: () => (isBarSource(cfg.src1) && isBarSource(cfg.src2) ? null : 'source of another study'),
    init() {
      const tr = taStep.tr(true);
      const ma = maStep();
      const s: AtrRun = {
        tr, ma, a: [], x: [], x2: [], shortData: [], longData: [], steps: [tr, ma], vars: {}, lists: [], series: [],
      };
      s.series = [s.a, s.x, s.x2, s.shortData, s.longData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // ma_function(tr(true), length)
      const ma = s.ma.step(s.tr.step(b.high, b.low, b.close));
      const a = ma * cfg.m;
      const x = a + value1(b);
      const x2 = value2(b) - a;
      s.a[i] = a;
      s.x[i] = x;
      s.x2[i] = x2;
      s.shortData[i] = { time: b.time, value: x, color: shortColor };
      s.longData[i] = { time: b.time, value: x2, color: longColor };
    },
    result(s, bars) {
      const n = bars.length;
      // Table of the last bar (barstate.islast): 'ATR: ', 'H: ' and 'L: ' with the value formatted with "#.#"
      const tables: TableData[] = [];
      if (n > 0) {
        const cell = (column: number, value: number, label: string, textColor: string) => (
          { column, row: 0, text: label + str.tostring(value, '#.#'), textColor }
        );
        tables.push({
          position: 'bottom_center',
          columns: 3,
          rows: 1,
          borderWidth: 3,
          cells: [
            cell(0, s.a[n - 1], 'ATR: ', cfg.col1),
            // table.cell_set_text_color(Table, 1, 0, color.new(col3, 0)) and (Table, 2, 0, color.new(col2, 0))
            cell(1, s.x[n - 1], 'H: ', String(color.new(cfg.col3, 0))),
            cell(2, s.x2[n - 1], 'L: ', String(color.new(cfg.col2, 0))),
          ],
        });
      }
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.shortData.slice(), plot1: s.longData.slice() },
        tables,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AtrStopLossFinderInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<AtrStopLossFinderInputs> = {},
): IndicatorResult & { tables: TableData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const AtrStopLossFinder = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
