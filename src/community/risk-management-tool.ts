/**
 * Risk Management Tool [LuxAlgo]
 *
 * A position planner. The entry is a fixed price, or the open of the bar after the last cross of the close and a
 * source ("Entry From Cross"). The take profit and the stop loss are set from the entry by an ATR multiple, a
 * percentage, a fixed price or the high - low range of the last bars. On the last bar the tool draws a profit box
 * (entry to take profit) and a loss box (entry to stop loss) over the next 100 bars, labels with the open profit /
 * loss and the two levels, and a table with the risk / reward ratio and the position size for the account size and
 * the risk. The area between the close and the entry is filled with the profit colour while the open position is in
 * profit, else with the loss colour; a hidden character gives the open profit / loss of each bar.
 *
 * Reference: "Risk Management Tool [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import {
  ta, str, Series, getSourceSeries,
  type Bar, type FillConfig, type FillData, type IndicatorResult, type InputConfig, type PlotConfig, type ShapeConfig,
  type SourceType,
} from 'oakscriptjs';
import type { BoxData, LabelData, MarkerData, TableData } from '../types';
import { barTime } from '../bar-time';
import { basecurrencyOf, currencyOf, type ChartContext } from '../chart-context';
import type { StudyDrawingKind } from '../style-outputs';

type LevelType = 'ATR' | '%' | 'Price' | 'Range';

export interface RiskManagementToolInputs {
  /** Position Type */
  posType: 'Long' | 'Short';
  /** Account Size */
  accSize: number;
  /** Risk */
  risk: number;
  /** Risk unit */
  riskType: '%' | 'USD';
  /** Entry Price */
  entryPrice: number;
  /** Entry From Cross */
  entryCross: boolean;
  /** Source crossed by the close (Entry From Cross) */
  crossSrc: SourceType;
  /** Take Profit */
  tp: number;
  tpType: LevelType;
  /** Stop Loss */
  sl: number;
  slType: LevelType;
  /** Profit Color */
  profitCol: string;
  /** Loss Color */
  lossCol: string;
}

export const defaultInputs: RiskManagementToolInputs = {
  posType: 'Long',
  accSize: 1000,
  risk: 2,
  riskType: '%',
  entryPrice: 40000,
  entryCross: false,
  crossSrc: 'open',
  tp: 5,
  tpType: '%',
  sl: 5,
  slType: '%',
  profitCol: 'rgba(0, 150, 136, 0.2)',
  lossCol: 'rgba(244, 67, 54, 0.2)',
};

const LEVEL_TYPES: LevelType[] = ['ATR', '%', 'Price', 'Range'];

export const inputConfig: InputConfig[] = [
  { id: 'posType', type: 'string', title: 'Position Type', defval: 'Long', options: ['Long', 'Short'] },
  { id: 'accSize', type: 'float', title: 'Account Size', defval: 1000, min: 0 },
  { id: 'risk', type: 'float', title: 'Risk               ', defval: 2, min: 0, inline: 'risk' },
  { id: 'riskType', type: 'string', title: '', defval: '%', options: ['%', 'USD'], inline: 'risk' },
  { id: 'entryPrice', type: 'float', title: 'Entry Price', defval: 40000, confirm: true },
  { id: 'entryCross', type: 'bool', title: 'Entry From Cross', defval: false, inline: 'entry' },
  { id: 'crossSrc', type: 'source', title: '', defval: 'open', inline: 'entry' },
  { id: 'tp', type: 'float', title: 'Take Profit', defval: 5, min: 0, group: 'Take Profit/Stop Loss', inline: 'tp', confirm: true },
  { id: 'tpType', type: 'string', title: '', defval: '%', options: LEVEL_TYPES, group: 'Take Profit/Stop Loss', inline: 'tp', confirm: true },
  { id: 'sl', type: 'float', title: 'Stop Loss  ', defval: 5, min: 0, group: 'Take Profit/Stop Loss', inline: 'sl', confirm: true },
  { id: 'slType', type: 'string', title: '', defval: '%', options: LEVEL_TYPES, group: 'Take Profit/Stop Loss', inline: 'sl', confirm: true },
  { id: 'profitCol', type: 'color', title: 'Profit Color', defval: 'rgba(0, 150, 136, 0.2)', group: 'Style', inline: 'col' },
  { id: 'lossCol', type: 'color', title: 'Loss Color', defval: 'rgba(244, 67, 54, 0.2)', group: 'Style', inline: 'col' },
];

/** Pine v4 colours */
const GRAY = '#787B86';
const BLUE = '#2196F3';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Plot', color: BLUE, lineWidth: 1, display: 'none', editable: false },
  { id: 'plot1', title: 'Plot', color: BLUE, lineWidth: 1, display: 'none', editable: false },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot0', plot2: 'plot1', title: 'Plots Background' },
];

export const shapeConfig: ShapeConfig[] = [
  { id: 'char0', kind: 'char', title: 'Rolling Open PL%', char: '', location: 'abovebar', color: BLUE },
];

export const drawingKinds: StudyDrawingKind[] = ['box', 'label', 'table'];

export const metadata = {
  title: 'Risk Management Tool [LuxAlgo]',
  shortTitle: 'Risk Management Tool [LuxAlgo]',
  overlay: true,
};

/** Pine float comparison: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;

export function calculate(
  bars: Bar[],
  inputs: Partial<RiskManagementToolInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { markers: MarkerData[]; boxes: BoxData[]; labels: LabelData[]; tables: TableData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const pos = cfg.posType === 'Long' ? 1 : -1;
  const close = new Series(bars, (b) => b.close);

  // entry := valuewhen(cross(close, cross_src)[1], open, 0) or the entry price
  let entry: number[];
  if (cfg.entryCross) {
    const crossed = ta.cross(close, getSourceSeries(bars, cfg.crossSrc)).offset(1);
    entry = ta.valuewhen(crossed, new Series(bars, (b) => b.open), 0).toArray();
  } else {
    entry = bars.map(() => cfg.entryPrice);
  }

  // highest / lowest / atr with max(round(x), 1) bars (every bar, as v4 runs them outside the branches)
  const len = (x: number) => Math.max(Math.round(x), 1);
  const high = new Series(bars, (b) => b.high);
  const low = new Series(bars, (b) => b.low);
  const range = (l: number) => {
    const hi = ta.highest(high, l).toArray();
    const lo = ta.lowest(low, l).toArray();
    return hi.map((h, i) => h - lo[i]);
  };
  const tpRange = range(len(cfg.tp));
  const slRange = range(len(cfg.sl));
  const tpAtr = ta.atr(bars, len(cfg.tp)).toArray();
  const slAtr = ta.atr(bars, len(cfg.sl)).toArray();

  const levelOf = (type: LevelType, value: number, atr: number, rng: number, e: number, dir: number) => {
    if (type === 'ATR') return e + atr * dir;
    if (type === '%') return e + (value / 100) * e * dir;
    if (type === 'Price') return value;
    return e + rng * dir;
  };

  const plot0: { time: number; value: number }[] = [];
  const plot1: { time: number; value: number }[] = [];
  const fillColors: string[] = [];
  const markers: MarkerData[] = [];
  const boxes: BoxData[] = [];
  const labels: LabelData[] = [];
  const tables: TableData[] = [];
  // var tbl = table.new(position.bottom_right, 2, 3): made on the first bar, filled on the last bar
  const tableCells: TableData['cells'] = [];

  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const e = entry[i] ?? NaN;
    const tpVal = levelOf(cfg.tpType, cfg.tp, tpAtr[i], tpRange[i], e, pos);
    const slVal = levelOf(cfg.slType, cfg.sl, slAtr[i], slRange[i], e, -pos);
    const openPl = (b.close - e) * pos;
    const plColor = gt(openPl, 0) ? cfg.profitCol : cfg.lossCol;

    plot0.push({ time: b.time, value: b.close });
    plot1.push({ time: b.time, value: e });
    fillColors.push(plColor);
    // plotchar(open_pl, ...): na and 0 draw no character
    if (!Number.isNaN(openPl) && openPl !== 0) {
      markers.push({
        id: 'char0', time: b.time, position: 'aboveBar', shape: 'circle', color: 'transparent', text: '',
        textColor: plColor,
      });
    }

    if (i === n - 1) {
      const rr = Math.abs((tpVal - e) / (slVal - e));
      const positionSize = cfg.riskType === '%'
        ? ((cfg.risk / 100) * cfg.accSize) / ((e - slVal) * pos)
        : cfg.risk / ((e - slVal) * pos);
      const t0 = b.time;
      const t1 = barTime(bars, i + 100);
      boxes.push(
        { time1: t0, price1: tpVal, time2: t1, price2: e, bgColor: cfg.profitCol, borderColor: BLUE, borderWidth: 0 },
        { time1: t0, price1: e, time2: t1, price2: slVal, bgColor: cfg.lossCol, borderColor: BLUE, borderWidth: 0 },
      );
      const labelOf = (price: number, text: string, col: string): LabelData => ({
        time: t1, price, text, color: col, style: 'label_left', textColor: GRAY, textAlign: 'left', size: 'normal',
      });
      labels.push(labelOf(e, str.format('P&L : {0} {1} ({2,number,percent})', openPl, currencyOf(chart), openPl / e),
        plColor));
      // `if tp` / `if sl`: a float condition is false for 0 and na
      if (cfg.tp !== 0 && !Number.isNaN(cfg.tp)) {
        labels.push(labelOf(tpVal, str.format('TP : {0} ({1,number,percent})', tpVal, (tpVal - e) / e), cfg.profitCol));
      }
      if (cfg.sl !== 0 && !Number.isNaN(cfg.sl)) {
        labels.push(labelOf(slVal, str.format('TSL : {0} ({1,number,percent})', slVal, (e - slVal) / e), cfg.lossCol));
      }
      const cell = (column: number, row: number, text: string) => tableCells.push({
        column, row, text, textColor: GRAY, textHAlign: 'center', textSize: 'auto',
      });
      cell(0, 0, 'Risk/Reward');
      cell(1, 0, str.tostring(rr, '#.####'));
      cell(0, 1, 'Position Size');
      cell(1, 1, str.tostring(positionSize, '#.####') + ' ' + basecurrencyOf(chart));
    }
  }
  if (n > 0) tables.push({ position: 'bottom_right', columns: 2, rows: 3, cells: tableCells });

  const fills: FillData[] = [
    { id: 'fill0', plot1: 'plot0', plot2: 'plot1', options: { title: 'Plots Background' }, colors: fillColors },
  ];

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1 },
    fills,
    markers,
    boxes,
    labels,
    tables,
  };
}

export const RiskManagementTool = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  fillConfig,
  shapeConfig,
  drawingKinds,
};
