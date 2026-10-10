/**
 * Breakout Probability (Expo)
 *
 * Counts, over the whole history, how often a bar reaches a level above the previous high or below the previous
 * low. The levels are the previous high / low plus / minus 0 to 4 steps (step = close * Percentage Step / 100).
 * The counts are kept apart for bars that follow a green bar (close > open) and bars that follow a red bar. Each
 * count gives a probability: hits / number of green (or red) previous bars, in percent with 2 decimals.
 *
 * On the last bar the script draws, for each level that is shown, a line from the previous bar to the current bar
 * (upper levels in the first colour, lower levels in the second colour), a label one bar to the right with the
 * probability of that level, and the fills between neighbouring levels. A level whose two probabilities (up and
 * down) are not both above 0 is hidden when "Disable 0.00%" is on. A table shows the backtest: the script bets each
 * bar on the side with the higher first-level probability and counts a win when the bar reaches the previous high
 * (or low).
 *
 * The script reads the chart background and foreground colours for the table. A port has no chart theme: it uses
 * the colours of the reference run (background #0F0F0F, foreground #DBDBDB). The alert() call of the script has no
 * output; its four inputs are kept.
 *
 * Reference: "Breakout Probability (Expo)" by Zeiierman
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Zeiierman
 */

import { color, compare, math, str, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LabelData, LineDrawingData, LinefillData, TableData } from '../types';
import { barTime } from '../bar-time';

export interface BreakoutProbabilityInputs {
  /** Space between two levels, in percent of the close */
  perc: number;
  /** Number of levels on each side (1 to 5) */
  nbr: number;
  upCol: string;
  dnCol: string;
  /** Fill between the levels */
  fill: boolean;
  /** Hide the levels with a 0 % probability */
  disableZero: boolean;
  /** Show the backtest table */
  showStats: boolean;
  alertTicker: boolean;
  alertPrice: boolean;
  alertBias: boolean;
  alertPercentage: boolean;
}

export const defaultInputs: BreakoutProbabilityInputs = {
  perc: 1.0,
  nbr: 5,
  upCol: '#4CAF50',
  dnCol: '#FF5252',
  fill: true,
  disableZero: true,
  showStats: true,
  alertTicker: true,
  alertPrice: true,
  alertBias: true,
  alertPercentage: true,
};

const T1 = 'The space between the levels can be adjusted with a percentage step. 1% means that each level is located 1% above/under the previous one.';
const T2 = 'Set the number of levels you want to display.';
const T3 = 'If a level got 0 % likelihood of being hit, the level is not displayed as default. Enable the option if you want to see all levels regardless of their values.';
const T4 = 'Enable this option if you want to display the backtest statistics for that a new high or low is made.';
const TABLE_TIPS = [
  'Number of times price has reached the first highest percentage level',
  'Number of times price failed to reach the first highest percentage level',
  'Win/Loss ratio',
];
const ALERT_GROUP = 'Any alert() function call';

export const inputConfig: InputConfig[] = [
  { id: 'perc', type: 'float', title: 'Percentage Step', defval: 1.0, min: 0, step: 0.1, group: 'Settings', tooltip: T1 },
  { id: 'nbr', type: 'int', title: 'Number of Lines', defval: 5, min: 1, max: 5, group: 'Settings', tooltip: T2 },
  { id: 'upCol', type: 'color', title: '', defval: '#4CAF50', inline: 'col' },
  { id: 'dnCol', type: 'color', title: '', defval: '#FF5252', inline: 'col' },
  { id: 'fill', type: 'bool', title: 'BG Color', defval: true, inline: 'col' },
  { id: 'disableZero', type: 'bool', title: 'Disable 0.00%', defval: true, group: 'Settings', tooltip: T3 },
  { id: 'showStats', type: 'bool', title: 'Show Statistic Panel', defval: true, group: 'Settings', tooltip: T4 },
  { id: 'alertTicker', type: 'bool', title: 'Ticker ID', defval: true, group: ALERT_GROUP },
  { id: 'alertPrice', type: 'bool', title: 'High/Low Price', defval: true, group: ALERT_GROUP },
  { id: 'alertBias', type: 'bool', title: 'Bullish/Bearish Bias', defval: true, group: ALERT_GROUP },
  { id: 'alertPercentage', type: 'bool', title: 'Bullish/Bearish Percentage', defval: true, group: ALERT_GROUP },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Breakout Probability (Expo)',
  shortTitle: 'Breakout Probability (Expo)',
  overlay: true,
};

/** Chart colours of the reference run (chart.bg_color / chart.fg_color) */
const CHART_BG = '#0F0F0F';
const CHART_FG = '#DBDBDB';
/** Pine v5 colour constants */
const GREEN = '#4CAF50';
const RED = '#FF5252';
const GRAY = '#787B86';
const BLACK = '#363A45';

export function calculate(
  bars: Bar[],
  inputs: Partial<BreakoutProbabilityInputs> = {},
): IndicatorResult & { lines: LineDrawingData[]; labels: LabelData[]; linefills: LinefillData[]; tables: TableData[] } {
  const { perc, nbr, upCol, dnCol, fill, disableZero, showStats } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // var total = matrix.new<int>(7, 4, 0); var vals = matrix.new<float>(5, 4, 0.0)
  const total: number[][] = Array.from({ length: 7 }, () => [0, 0, 0, 0]);
  const vals: number[][] = Array.from({ length: 5 }, () => [0, 0, 0, 0]);
  // var lines / labels = matrix.new(1, 10, na): the object of each slot (null = na or deleted)
  let lineSlots: Array<LineDrawingData | null> = new Array(10).fill(null);
  let labelSlots: Array<LabelData | null> = new Array(10).fill(null);
  let linefills: LinefillData[] = [];

  for (let b = 0; b < n; b++) {
    const bar = bars[b];
    const prev = b > 0 ? bars[b - 1] : undefined;
    const h1 = prev ? prev.high : NaN;
    const l1 = prev ? prev.low : NaN;
    const step = bar.close * (perc / 100);

    // green = c[1] > o[1]; red = c[1] < o[1]
    const green = prev !== undefined && compare.gt(prev.close, prev.open);
    const red = prev !== undefined && compare.lt(prev.close, prev.open);
    if (green) total[5][0] += 1;
    if (red) total[5][1] += 1;

    // Score(x, i)
    for (let i = 0; i < 5; i++) {
      const x = step * i;
      const [ghh, gll, rhh, rll] = total[i];
      const gtotal = total[5][0];
      const rtotal = total[5][1];
      const hh = compare.ge(bar.high, h1 + x);
      const ll = compare.le(bar.low, l1 - x);
      if (green && hh) {
        total[i][0] = ghh + 1;
        vals[i][0] = math.round(((ghh + 1) / gtotal) * 100, 2);
      }
      if (green && ll) {
        total[i][1] = gll + 1;
        vals[i][1] = math.round(((gll + 1) / gtotal) * 100, 2);
      }
      if (red && hh) {
        total[i][2] = rhh + 1;
        vals[i][2] = math.round(((rhh + 1) / rtotal) * 100, 2);
      }
      if (red && ll) {
        total[i][3] = rll + 1;
        vals[i][3] = math.round(((rll + 1) / rtotal) * 100, 2);
      }
    }

    const a1 = vals[0][0];
    const b1 = vals[0][1];
    const a2 = vals[0][2];
    const b2 = vals[0][3];

    // Lines and labels. Every slot in use is deleted on each bar, and made again when its level is shown: the
    // objects of the last bar are the only ones alive at the end. A deleted line also deletes its linefills.
    if (b === n - 1) {
      const time1 = prev ? prev.time : NaN;
      for (let i = 0; i <= nbr - 1; i++) {
        const shown = !disableZero ||
          (green ? compare.gt(Math.min(vals[i][0], vals[i][1]), 0) : compare.gt(Math.min(vals[i][2], vals[i][3]), 0));
        if (shown) {
          const hi = h1 + step * i;
          const lo = l1 - step * i;
          const mkLine = (p: number, c: string): LineDrawingData =>
            ({ time1, price1: p, time2: bar.time, price2: p, color: c, width: 2 });
          const mkLabel = (p: number, c: string, r: number, v: number): LabelData => ({
            time: barTime(bars, b + 1), price: p, text: str.tostring(vals[r][v], 'percent'),
            style: 'label_left', color: String(color.new_color(BLACK, 100)), textColor: c,
          });
          lineSlots[i] = mkLine(hi, upCol);
          lineSlots[5 + i] = mkLine(lo, dnCol);
          labelSlots[i] = mkLabel(hi, upCol, i, green ? 0 : 2);
          labelSlots[5 + i] = mkLabel(lo, dnCol, i, green ? 1 : 3);
        } else {
          lineSlots[i] = lineSlots[5 + i] = null;
          labelSlots[i] = labelSlots[5 + i] = null;
        }
      }
      for (let i = nbr; i < 5; i++) {
        // slots that the loop never fills stay na
        lineSlots[i] = lineSlots[5 + i] = null;
        labelSlots[i] = labelSlots[5 + i] = null;
      }
      // A line with an na point (no previous bar) is not drawn
      if (!prev) {
        lineSlots = lineSlots.map(() => null);
        labelSlots = labelSlots.map(() => null);
      }
      if (fill) {
        linefills = [];
        for (let i = 0; i <= 8; i++) {
          const get = lineSlots[i];
          const get1 = lineSlots[i + 1];
          const col = i > 4 ? color.new_color(dnCol, 80) : i === 4 ? color.new_color(GRAY, 100) : color.new_color(upCol, 80);
          // linefill.new with an na line makes no fill
          if (get && get1) linefills.push({ line1: get, line2: get1, color: String(col) });
        }
      }
    }

    // Backtest(v): the bet is the previous high when the first-level "up" probability is the larger one
    const v = green ? (compare.eq(Math.max(a1, b1), a1) ? h1 : l1) : (compare.eq(Math.max(a2, b2), a2) ? h1 : l1);
    if (compare.eq(v, h1)) {
      if (compare.ge(bar.high, v)) total[6][0] += 1;
      else total[6][1] += 1;
    } else if (compare.le(bar.low, v)) total[6][0] += 1;
    else total[6][1] += 1;
  }

  // var tbl = table.new(position.top_right, 2, 3, frame_color = color.new(color.gray, 50), frame_width = 3,
  //   border_color = chart.bg_color, border_width = -2); the cells are written on the last bar
  const table: TableData = {
    position: 'top_right', columns: 2, rows: 3, cells: [],
    frameColor: String(color.new_color(GRAY, 50)), frameWidth: 3, borderColor: CHART_BG, borderWidth: -2,
  };
  if (n > 0 && showStats) {
    const W = total[6][0];
    const L = total[6][1];
    const WR = math.round((W / (W + L)) * 100, 2);
    const texts = [`WIN: ${str.tostring(W)}`, `LOSS: ${str.tostring(L)}`, `Profitability: ${str.tostring(WR, 'percent')}`];
    const cols = [GREEN, RED, CHART_FG];
    for (let i = 0; i <= 2; i++) {
      table.cells.push({
        column: 0, row: i, text: texts[i], textHAlign: 'center', bgColor: CHART_BG, textColor: cols[i],
        textSize: 'auto', tooltip: TABLE_TIPS[i],
      });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    lines: lineSlots.filter((l): l is LineDrawingData => l !== null),
    labels: labelSlots.filter((l): l is LabelData => l !== null),
    linefills,
    tables: n > 0 ? [table] : [],
  };
}

export const BreakoutProbability = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
