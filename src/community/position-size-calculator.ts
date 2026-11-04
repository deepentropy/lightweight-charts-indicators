/**
 * Position Size Calculator
 *
 * From an account balance, a risk percentage and the entry, stop loss and target prices: the stop distance
 * (entry - stop) and target distance (target - entry) in price and in percent of the entry, the reward / risk ratio
 * (target % / stop %) and the position size (balance * risk % / stop %). The entry, target and stop levels are drawn
 * as invisible plots shifted 20 bars to the right and shown on their last 20 points only (offset = 20,
 * show_last = 20), with a green fill between entry and target and a red fill between entry and stop on the last
 * point (show_last = 1). On the last bar, labels at bar_time x: a summary label (Position Size Label x-axis bars
 * after the last bar, at the ohlc4 of the bar before), and "Target", "Stop" and "R/R" labels (R/R Label x-axis bars
 * after it) at the three prices; the R/R label has the summary as tooltip. With the default 0 prices, the
 * percentages, size and ratio are 0 / 0 = na ("NaN" in the texts), as in the original.
 *
 * Chart values (optional third argument of calculate): the symbol tick size (syminfo.mintick), whose digits give the
 * number format of the position size ("0.01" -> "0.00", "1" -> "0").
 *
 * Reference: "Position Size Calculator" by zzzcrypto123
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © zzzcrypto123
 */

import {
  str, label, resetDrawings, drawingOutputs,
  type Bar, type FillConfig, type FillData, type IndicatorResult, type InputConfig, type PlotConfig,
} from 'oakscriptjs';
import { barInterval, barTime } from '../bar-time';
import { mintickOf, type ChartContext } from '../chart-context';
import type { StudyDrawingKind } from '../style-outputs';

export interface PositionSizeCalculatorInputs {
  /** Account Balance */
  accbalance: number;
  /** Risk Percentage */
  riskper: number;
  /** Entry price */
  entry: number;
  /** Stop Loss price */
  sl: number;
  /** Target Price */
  tp: number;
  /** Show Position Size Label */
  showscr: boolean;
  /** Position Size Label x-axis (bars after the last bar) */
  posscrX: number;
  /** Text Color of the summary label */
  col: string;
  /** Show R/R box labels */
  showLabel: boolean;
  /** R/R Label x-axis (bars after the last bar) */
  poslblX: number;
}

export const defaultInputs: PositionSizeCalculatorInputs = {
  accbalance: 1000,
  riskper: 2,
  entry: 0,
  sl: 0,
  tp: 0,
  showscr: true,
  posscrX: 30,
  col: '#FFFFFF',
  showLabel: true,
  poslblX: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'accbalance', type: 'float', title: 'Account Balance', defval: 1000 },
  { id: 'riskper', type: 'float', title: 'Risk Percentage', defval: 2 },
  { id: 'entry', type: 'float', title: 'Entry', defval: 0 },
  { id: 'sl', type: 'float', title: 'Stop Loss', defval: 0 },
  { id: 'tp', type: 'float', title: 'Target Price', defval: 0 },
  { id: 'showscr', type: 'bool', title: 'Show Position Size Label', defval: true },
  { id: 'posscrX', type: 'int', title: 'Position Size Label x-axis', defval: 30 },
  { id: 'col', type: 'color', title: 'Text Color', defval: '#FFFFFF' },
  { id: 'showLabel', type: 'bool', title: 'Show R/R box labels', defval: true },
  { id: 'poslblX', type: 'int', title: 'R/R Label x-axis', defval: 10 },
];

const ENTRY_COLOR = '#787b8600';
const TP_COLOR = '#4caf5000';
const SL_COLOR = '#ff525200';
// fill(..., color = color.green / color.red, transp = 50)
const TP_FILL = '#4CAF5080';
const SL_FILL = '#FF525280';
const OFFSET = 20;
const SHOW_LAST = 20;

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Entry', color: ENTRY_COLOR, lineWidth: 1 },
  { id: 'plot1', title: 'TP', color: TP_COLOR, lineWidth: 1 },
  { id: 'plot2', title: 'SL', color: SL_COLOR, lineWidth: 1 },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot0', plot2: 'plot1', title: 'Plots Background', palette: [TP_FILL] },
  { id: 'fill1', plot1: 'plot0', plot2: 'plot2', title: 'Plots Background', palette: [SL_FILL] },
];

export const drawingKinds: StudyDrawingKind[] = ['label'];

export const metadata = {
  title: 'Position Size Calculator',
  shortTitle: 'Calc',
  overlay: true,
};

export function calculate(
  bars: Bar[],
  inputs: Partial<PositionSizeCalculatorInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const { accbalance, riskper, entry, sl, tp, showscr, posscrX, col, showLabel, poslblX } = cfg;
  const n = bars.length;

  const sldist = entry - sl;
  const tgdist = tp - entry;
  const slper = sldist / entry * 100;
  const tgper = tgdist / entry * 100;
  const rr = tgper / slper;
  const size = accbalance * riskper / slper;
  const num = (v: number) => (Number.isFinite(v) ? v : NaN);

  // plot(x, show_last = 20, offset = 20): the value of bar i on bar i + 20, only the last 20 points are shown
  const interval = barInterval(bars);
  const total = n > 0 ? n + OFFSET : 0;
  const shifted = (value: number) => {
    const pts: { time: number; value: number }[] = [];
    for (let j = 0; j < total; j++) {
      const shown = j >= OFFSET && j >= total - SHOW_LAST;
      pts.push({ time: barTime(bars, j, interval) as number, value: shown ? num(value) : NaN });
    }
    return pts;
  };
  // fill(..., show_last = 1): the last point only (colour per plot point)
  const fillColours = (c: string) => Array.from({ length: total }, (_, j) => (j === total - 1 ? c : 'transparent'));
  const fills: FillData[] = [
    { id: 'fill0', plot1: 'plot0', plot2: 'plot1', options: { title: 'Plots Background' }, colors: fillColours(TP_FILL) },
    { id: 'fill1', plot1: 'plot0', plot2: 'plot2', options: { title: 'Plots Background' }, colors: fillColours(SL_FILL) },
  ];

  // f_tickFormat(): the digits of syminfo.mintick with 25 / 5 / 1 replaced by zeros
  let fmt = str.tostring(mintickOf(chart));
  fmt = str.replace_all(fmt, '25', '00');
  fmt = str.replace_all(fmt, '5', '0');
  fmt = str.replace_all(fmt, '1', '0');
  const ts = (v: number, format?: string) => str.tostring(num(v), format);

  // Each label is deleted and created again on every bar: the labels of the last bar remain
  resetDrawings();
  if (n >= 2) {
    const last = bars[n - 1];
    const ms = last.time < 1e12 ? 1000 : 1;
    const t = last.time * ms;
    const dt = t - bars[n - 2].time * ms;
    const prev = bars[n - 2];
    const ohlc4Prev = (prev.open + prev.high + prev.low + prev.close) / 4;
    const sizeText = ts(Math.abs(size), fmt);

    label.new(t + dt * posscrX, ohlc4Prev,
      '\n Account Balance : ' + ts(accbalance)
      + '\n Risk % : ' + ts(riskper)
      + '\n\n Entry: ' + ts(entry)
      + '\n Target : ' + ts(tp)
      + '\n Stop Loss : ' + ts(sl)
      + '\n\n Position Size : ' + sizeText
      + '\n R/R : ' + ts(rr, '#.##') + ' R',
      'bar_time', 'price', showscr ? '#00000000' : 'transparent', 'label_center', showscr ? col : 'transparent', 'normal');

    const xr = t + dt * poslblX;
    label.new(xr, tp, 'Target: ' + ts(tgdist) + ' (' + ts(tgper, '#.##') + '%)',
      'bar_time', 'price', showLabel ? '#4caf50' : 'transparent', 'label_center', showLabel ? '#FFFFFF' : 'transparent', 'normal');
    label.new(xr, sl, 'Stop: ' + ts(sldist) + ' (' + ts(slper, '#.##') + '%)',
      'bar_time', 'price', showLabel ? '#ff5252' : 'transparent', 'label_center', showLabel ? '#FFFFFF' : 'transparent', 'normal');
    const rrlbl = '\n Account Balance : ' + ts(accbalance) + '\n Risk % : ' + ts(riskper) + '\n\n Position Size : ' + sizeText;
    label.new(xr, entry, 'R/R: ' + ts(rr, '#.##'),
      'bar_time', 'price', showLabel ? '#787b86' : 'transparent', 'label_center', showLabel ? '#FFFFFF' : 'transparent', 'normal',
      'center', rrlbl);
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: shifted(entry), plot1: shifted(tp), plot2: shifted(sl) },
    fills,
    ...drawingOutputs(bars),
  };
}

export const PositionSizeCalculator = { calculate, metadata, defaultInputs, inputConfig, plotConfig, fillConfig, drawingKinds };
