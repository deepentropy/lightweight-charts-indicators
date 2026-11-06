/**
 * ATR Bands
 *
 * Bands at close +- ATR(period) * scale factor. With the take-profit option, two more bands at the opposite side:
 * close + (close - lower band) * take-profit factor and close - (upper band - close) * take-profit factor. An optional
 * table shows the stop levels and their distances to the close (and the take-profit levels), from the bar before
 * the last bar, or from the last bar with "Allow Table Repainting".
 *
 * Reference: "ATR Bands" by TheTrdFloor
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © TheTrdFloor
 */

import { taStep, str, math, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { TableCellData, TableData, TablePosition } from '../types';
import { mintickOf, type ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AtrBandsInputs {
  /** ATR period */
  atrPeriod: number;
  /** ATR band scale factor */
  atrMultiplier: number;
  /** Show the take-profit bands */
  showTPBands: boolean;
  /** Take-profit scale factor */
  tpScaleFactor: number;
  /** Show the table of stops and targets */
  showTable: boolean;
  /** Table values of the last bar (else of the bar before) */
  allowTableRepainting: boolean;
  /** Take-profit rows / columns in the table */
  showTPinTable: boolean;
  alignTableVertically: boolean;
  tablePosition: 'Top Right' | 'Top Left' | 'Top Center' | 'Middle Right' | 'Middle Left' | 'Middle Center'
    | 'Bottom Right' | 'Bottom Left' | 'Bottom Center';
  tableColor: string;
  tableTextHeaderColor: string;
  tableTextColor: string;
  tableLongBGColor: string;
  tableShortBGColor: string;
}

export const defaultInputs: AtrBandsInputs = {
  atrPeriod: 3,
  atrMultiplier: 2.5,
  showTPBands: false,
  tpScaleFactor: 1.5,
  showTable: false,
  allowTableRepainting: false,
  showTPinTable: false,
  alignTableVertically: true,
  tablePosition: 'Bottom Right',
  tableColor: 'rgba(0, 175, 200, 0.8)',
  tableTextHeaderColor: 'rgb(255, 255, 0)',
  tableTextColor: 'rgb(255, 255, 255)',
  tableLongBGColor: 'rgba(0, 255, 0, 0.1)',
  tableShortBGColor: 'rgba(255, 0, 0, 0.2)',
};

const STANDARD = 'ATR Bands Standard Settings';
const TP = 'Take-Profit Settings';
const TABLE = 'Table Settings';

export const inputConfig: InputConfig[] = [
  { id: 'atrPeriod', type: 'int', title: 'ATR Period', defval: 3, min: 1, group: STANDARD },
  { id: 'atrMultiplier', type: 'float', title: 'ATR Band Scale Factor', defval: 2.5, step: 0.1, min: 0.01, group: STANDARD },
  { id: 'showTPBands', type: 'bool', title: 'Show opposite bands for take-profit zones', defval: false, group: TP },
  { id: 'tpScaleFactor', type: 'float', title: 'Take-Profit Scale Factor', defval: 1.5, min: 1, step: 0.1 },
  { id: 'showTable', type: 'bool', title: 'Show Table for Stops and Targets', defval: false, group: TABLE },
  { id: 'allowTableRepainting', type: 'bool', title: 'Allow Table Repainting', defval: false, group: TABLE },
  { id: 'showTPinTable', type: 'bool', title: 'Include additional rows/columns to display take-profit values.', defval: false, group: TABLE },
  { id: 'alignTableVertically', type: 'bool', title: 'Align Table Vertically', defval: true, group: TABLE },
  {
    id: 'tablePosition', type: 'string', title: 'Table Location', defval: 'Bottom Right', group: TABLE,
    options: ['Top Right', 'Top Left', 'Top Center', 'Middle Right', 'Middle Left', 'Middle Center', 'Bottom Right', 'Bottom Left', 'Bottom Center'],
  },
  { id: 'tableColor', type: 'color', title: 'Table Color: ', defval: 'rgba(0, 175, 200, 0.8)', group: TABLE, inline: 'A' },
  { id: 'tableTextHeaderColor', type: 'color', title: 'Table Header Color: ', defval: 'rgb(255, 255, 0)', group: TABLE, inline: 'A' },
  { id: 'tableTextColor', type: 'color', title: 'Table Text Color: ', defval: 'rgb(255, 255, 255)', group: TABLE, inline: 'B' },
  { id: 'tableLongBGColor', type: 'color', title: 'Table Background Color - Long: ', defval: 'rgba(0, 255, 0, 0.1)', group: TABLE, inline: 'C' },
  { id: 'tableShortBGColor', type: 'color', title: 'Short: ', defval: 'rgba(255, 0, 0, 0.2)', group: TABLE, inline: 'C' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper ATR Band', color: 'rgba(0, 255, 0, 0.5)', lineWidth: 2 },
  { id: 'plot1', title: 'Lower ATR Band', color: 'rgba(255, 0, 0, 0.5)', lineWidth: 2 },
  { id: 'plot2', title: 'Upper Take-Profit Band', color: 'rgba(255, 255, 255, 0.2)', lineWidth: 1 },
  { id: 'plot3', title: 'Lower Take-Profit Band', color: 'rgba(255, 255, 0, 0.2)', lineWidth: 1 },
];

export const metadata = {
  title: 'ATR Bands',
  shortTitle: 'ATR Bands',
  overlay: true,
};

/** getTablePosition() */
const POSITIONS: Record<string, TablePosition> = {
  'Top Right': 'top_right',
  'Top Left': 'top_left',
  'Top Center': 'top_center',
  'Middle Right': 'middle_right',
  'Middle Left': 'middle_left',
  'Middle Center': 'middle_center',
  'Bottom Right': 'bottom_right',
  'Bottom Left': 'bottom_left',
  'Bottom Center': 'bottom_center',
};

/** Pine `!=` (1e-10) */
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > 1e-10;

type Result = IndicatorResult & { tables: TableData[] };
type Point = { time: number; value: number; color: string };

interface AtrBandsRun extends BarRunState<Record<string, never>> {
  atr: ReturnType<typeof taStep.atr>;
  scaledATR: number[];
  upper: number[];
  lower: number[];
  tpLong: number[];
  tpShort: number[];
  plots: Point[][];
}

function study(inputs: Partial<AtrBandsInputs>): BarStudy<AtrBandsRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      // atr = ta.atr(atrPeriod); the band offset source is always the close
      const atr = taStep.atr(cfg.atrPeriod);
      const plots: Point[][] = [[], [], [], []];
      const s: AtrBandsRun = {
        atr, scaledATR: [], upper: [], lower: [], tpLong: [], tpShort: [], plots,
        steps: [atr], vars: {}, lists: [], series: [],
      };
      s.series = [s.scaledATR, s.upper, s.lower, s.tpLong, s.tpShort, ...plots];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const scaledATR = s.atr.step(b.high, b.low, b.close) * cfg.atrMultiplier;
      const upper = b.close + scaledATR;
      const lower = b.close - scaledATR;
      const tpLong = b.close + (b.close - lower) * cfg.tpScaleFactor;
      const tpShort = b.close - (upper - b.close) * cfg.tpScaleFactor;
      s.scaledATR[i] = scaledATR;
      s.upper[i] = upper;
      s.lower[i] = lower;
      s.tpLong[i] = tpLong;
      s.tpShort[i] = tpShort;
      s.plots[0]![i] = { time: b.time, value: upper, color: 'rgba(0, 255, 0, 0.5)' };
      s.plots[1]![i] = { time: b.time, value: lower, color: 'rgba(255, 0, 0, 0.5)' };
      s.plots[2]![i] = { time: b.time, value: cfg.showTPBands ? tpLong : NaN, color: 'rgba(255, 255, 255, 0.2)' };
      s.plots[3]![i] = { time: b.time, value: cfg.showTPBands ? tpShort : NaN, color: 'rgba(255, 255, 0, 0.2)' };
    },
    result(s, bars, chart) {
      const n = bars.length;
      const mintick = mintickOf(chart);
      const { scaledATR, upper, lower, tpLong, tpShort } = s;
      const tables: TableData[] = [];
      if (cfg.showTable && n > 0) {
        // The table of the last bar: values of the last bar, or of the bar before (na on a single bar)
        const k = cfg.allowTableRepainting ? n - 1 : n - 2;
        const at = (values: number[]) => (k >= 0 ? values[k] : NaN);
        const closeK = k >= 0 ? bars[k].close : NaN;
        const price = (v: number) => str.tostring(v, 'mintick', mintick);
        const rounded = (v: number) => str.tostring(math.round_to_mintick(v, mintick) as number);
        const cells: TableCellData[] = [];
        // (a, b): column a and row b of the vertical table; the horizontal table swaps them
        const cell = (a: number, b: number, text: string, textColor: string, bgColor: string, tooltip?: string) => {
          const [column, row] = cfg.alignTableVertically ? [a, b] : [b, a];
          cells.push({ column, row, text, textColor, bgColor, ...(tooltip !== undefined ? { tooltip } : {}) });
        };
        const head = cfg.tableTextHeaderColor;
        const txt = cfg.tableTextColor;
        const longBg = cfg.tableLongBGColor;
        const shortBg = cfg.tableShortBGColor;
        const tpDist = ne(cfg.tpScaleFactor, 1);
        // Header cells
        cell(0, 0, 'Long ATR Stop', head, longBg, 'Test');
        cell(0, 1, 'Long ATR Stop Dist', head, longBg);
        if (cfg.showTPinTable) {
          cell(0, 2, 'Long ATR TP', head, longBg);
          if (tpDist) cell(0, 3, 'Long ATR TP Dist', head, longBg);
        }
        cell(0, 4, 'Short ATR Stop', head, shortBg);
        cell(0, 5, 'Short ATR Stop Dist', head, shortBg);
        if (cfg.showTPinTable) {
          cell(0, 6, 'Short ATR TP', head, shortBg);
          if (tpDist) cell(0, 7, 'Short ATR TP Dist', head, shortBg);
        }
        // Long position values
        cell(1, 0, price(at(lower)), txt, longBg, 'Test');
        cell(1, 1, rounded(closeK - at(lower)), txt, longBg);
        if (cfg.showTPinTable) {
          cell(1, 2, price(at(tpLong)), txt, longBg);
          if (tpDist) cell(1, 3, rounded(at(scaledATR) * cfg.tpScaleFactor), txt, longBg);
        }
        // Short position values
        cell(1, 4, price(at(upper)), txt, shortBg, 'Test 2');
        cell(1, 5, rounded(at(upper) - closeK), txt, shortBg);
        if (cfg.showTPinTable) {
          cell(1, 6, price(at(tpShort)), txt, shortBg);
          if (tpDist) cell(1, 7, rounded(at(scaledATR) * cfg.tpScaleFactor), txt, shortBg);
        }
        tables.push({
          position: POSITIONS[cfg.tablePosition] ?? 'bottom_right',
          columns: 8,
          rows: 8,
          cells,
          borderWidth: 1,
          frameWidth: 1,
          borderColor: cfg.tableColor,
          frameColor: cfg.tableColor,
        });
      }

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0]!.slice(), plot1: s.plots[1]!.slice(), plot2: s.plots[2]!.slice(), plot3: s.plots[3]!.slice() },
        tables,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AtrBandsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AtrBandsInputs> = {}, chart?: ChartContext): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const AtrBands = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
