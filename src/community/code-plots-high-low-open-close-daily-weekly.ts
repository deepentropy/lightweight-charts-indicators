/**
 * CM High Low Open Close (daily, weekly and monthly)
 *
 * Open, close, high and low of the current and of the previous bar of three timeframes of the same symbol (daily,
 * weekly and monthly), each switched on by its own input. Current values are drawn as circles, previous values as
 * crosses. A value of 0 is not drawn (`show and value ? value : na`).
 *
 * The bars of each timeframe are built from the chart bars (periods from the UTC calendar and the bars, see
 * src/anchor-period.ts). As in the original (a version 1 script), every chart bar of a period shows the values of
 * that period (the last period is still open). A timeframe equal to the chart timeframe is the chart series itself.
 * A timeframe below the chart timeframe needs data that the bars do not carry: the port throws an Error when such a
 * group is switched on.
 *
 * Periods and the chart context (optional third argument of calculate): with the exchange time zone and the session
 * of the symbol (`timezone`, `session`) the periods are those of the exchange calendar (its trading days, holidays
 * and session hours), and a bar of a higher timeframe is complete on the chart bar whose close reaches the end of
 * its period, see src/anchor-period.ts.
 * Without them the port uses the UTC calendar and the bars, as described in this header. `timeframe`, when given,
 * is the chart timeframe; without it the chart timeframe is read from the bar spacing.
 *
 * Reference: "Code Plots - High, Low, Open, Close—Daily, Weekly, & Monthly!!!" by ChrisMoody
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  color, timeframe, resample, mapToChart,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import { periodStarts, chartTimeframe, securityBars } from '../anchor-period';
import type { ChartContext } from '../chart-context';

export interface CodePlotsHighLowOpenCloseDailyWeeklyInputs {
  /** Show Todays OHLC? */
  st: boolean;
  /** Show Yesterdays OHLC? */
  sy: boolean;
  /** Show This Weeks OHLC? */
  swt: boolean;
  /** Show Previous Weeks OHLC? */
  swy: boolean;
  /** Show Monthly OHLC? */
  smh: boolean;
  /** Show Previous Months OHLC? */
  spmh: boolean;
}

export const defaultInputs: CodePlotsHighLowOpenCloseDailyWeeklyInputs = {
  st: true,
  sy: false,
  swt: false,
  swy: false,
  smh: false,
  spmh: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'st', type: 'bool', title: 'Show Todays OHLC?', defval: true },
  { id: 'sy', type: 'bool', title: 'Show Yesterdays OHLC?', defval: false },
  { id: 'swt', type: 'bool', title: 'Show This Weeks OHLC?', defval: false },
  { id: 'swy', type: 'bool', title: 'Show Previous Weeks OHLC?', defval: false },
  { id: 'smh', type: 'bool', title: 'Show Monthly OHLC?', defval: false },
  { id: 'spmh', type: 'bool', title: 'Show Previous Months OHLC?', defval: false },
];

// Colour constants of Pine version 1, with the default plot transparency of that version (35)
const V1 = (hex: string) => String(color.new(hex, 35));
const SILVER = V1('#C0C0C0');
const FUCHSIA = V1('#FF00FF');
const GREEN = V1('#008000');
const LIME = V1('#00FF00');
const RED = V1('#FF0000');

type Key = keyof CodePlotsHighLowOpenCloseDailyWeeklyInputs;

/** The three groups: timeframe, inputs, plot titles of the group, line width and high colour */
const GROUPS: Array<{ tf: string; current: Key; previous: Key; titles: string[]; width: number; highColor: string }> = [
  {
    tf: 'D', current: 'st', previous: 'sy', width: 2, highColor: LIME,
    titles: ['Daily Open', 'Previous Days Open', 'Daily Close', 'Previous Days Close', 'Daily High',
      'Previous Daily High', 'Daily Low', 'Previous Daily Low'],
  },
  {
    tf: 'W', current: 'swt', previous: 'swy', width: 3, highColor: GREEN,
    titles: ['Weekly Open', 'Previous Weeks Open', 'Weekly Close', 'Previous Weeks Close', 'Weekly High',
      'Previous Weeks High', 'Weekly Low', 'Previous Weeks Low'],
  },
  {
    tf: 'M', current: 'smh', previous: 'spmh', width: 4, highColor: GREEN,
    titles: ['Monthly Open', 'Previous Months Open', 'Monthly Close', 'Previous Months Close', 'Monthly High',
      'Previous Monthly High', 'Monthly Low', 'Previous Months Low'],
  },
];

/** Colour of the k-th plot of a group (open, close, high, low; each current then previous) */
const colorOf = (k: number, highColor: string) => [SILVER, FUCHSIA, highColor, RED][Math.floor(k / 2)];

export const plotConfig: PlotConfig[] = GROUPS.flatMap((grp, g) => grp.titles.map((title, k) => ({
  id: `plot${g * 8 + k}`,
  title,
  color: colorOf(k, grp.highColor),
  lineWidth: grp.width,
  style: (k % 2 === 0 ? 'circles' : 'cross') as PlotConfig['style'],
})));

export const metadata = {
  title: '_CM_High_Low_Open_Close',
  shortTitle: '_CM_H_L_O_C',
  overlay: true,
};

/**
 * security(tickerid, tf, ...) on the chart symbol: the bars of timeframe `tf` built from the chart bars, and the
 * function that brings one value per bar of that timeframe back to the chart bars. Version 1 rule: every chart bar
 * of a period shows the value of the period (no gaps).
 */
function timeframeBars(bars: Bar[], tf: string, context?: ChartContext): { htf: Bar[]; toChart: (values: number[]) => number[] } {
  const chart = chartTimeframe(bars, context);
  if (chart === '' || timeframe.in_seconds(tf) === timeframe.in_seconds(chart)) {
    return { htf: bars, toChart: (values) => values };
  }
  if (timeframe.in_seconds(tf) < timeframe.in_seconds(chart)) {
    throw new Error(`The timeframe "${tf}" is lower than the chart timeframe "${chart}": the bars do not carry that data.`);
  }
  // With the exchange calendar of the chart context (time zone and session): the periods come from the library rule
  // (see anchor-period.ts); without it, the periods of the UTC calendar and the bars, grouped by the library
  const exchange = securityBars(bars, tf, context);
  const { bars: htf, group } = exchange ? { bars: exchange.htf, group: exchange.group } : resample(bars, periodStarts(bars, tf));
  return { htf, toChart: (values) => mapToChart(values, group, [], true, false) };
}

export function calculate(
  bars: Bar[],
  inputs: Partial<CodePlotsHighLowOpenCloseDailyWeeklyInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const plots: Record<string, Array<{ time: number; value: number }>> = {};

  GROUPS.forEach((grp, g) => {
    const showCurrent = cfg[grp.current];
    const showPrevious = cfg[grp.previous];
    let series: number[][] = [];
    if (showCurrent || showPrevious) {
      const { htf, toChart } = timeframeBars(bars, grp.tf, chart);
      // open, open[1], close, close[1], high, high[1], low, low[1] of the bars of the timeframe
      const fields = ['open', 'close', 'high', 'low'] as const;
      series = fields.flatMap((f) => {
        const v = htf.map((b) => b[f]);
        return [toChart(v), toChart(v.map((_x, i) => (i > 0 ? v[i - 1] : NaN)))];
      });
    }
    grp.titles.forEach((_title, k) => {
      const show = k % 2 === 0 ? showCurrent : showPrevious;
      const values = series[k];
      const points: Array<{ time: number; value: number }> = [];
      for (let i = 0; i < n; i++) {
        const v = show ? values[i] : NaN;
        // `show and v ? v : na`: na and 0 are not drawn
        points.push({ time: bars[i].time, value: !Number.isNaN(v) && v !== 0 ? v : NaN });
      }
      plots[`plot${g * 8 + k}`] = points;
    });
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
  };
}

export const CodePlotsHighLowOpenCloseDailyWeekly = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
