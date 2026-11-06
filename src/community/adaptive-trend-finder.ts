/**
 * Adaptive Trend Finder (log)
 *
 * On the last bar, a linear regression of the logarithm of the source is computed over 19 periods (20 to 200 bars,
 * or 300 to 1200 bars in the long-term mode). The period with the highest Pearson correlation is kept: its regression
 * line is drawn as the midline of a channel whose two outer lines are at the deviation multiplier times the
 * standard deviation of the residuals (in log scale). A table shows the selected period, the strength of the trend
 * (or Pearson's R) and, on daily and weekly bars, the annualized return of the trend.
 *
 * The annualized return uses 52 bars a year on weekly bars. On daily bars it uses 365 for a symbol of the type
 * "crypto" and 252 for the others: the port reads the symbol type from the chart context (third argument) and uses
 * 252 without it.
 *
 * Chart timeframe: `timeframe` of the chart context (optional third argument of calculate) when given; without it
 * the chart timeframe is read from the bar spacing (the most frequent gap between two bars).
 *
 * Reference: "Adaptive Trend Finder (log)" by Julien_Eche
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Copyright (c) 2023-present, Julien Eche
 */

import {
  color, str, barInterval, barTime,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { LineDrawingData, LinefillData, TableData, TableCellData, TablePosition } from '../types';
import { chartTimeframe } from '../anchor-period';
import { symbolTypeOf, type ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

type LineStyleName = 'Solid' | 'Dotted' | 'Dashed';
type ExtendName = 'Extend Right' | 'Extend Both' | 'Extend None' | 'Extend Left';
type TablePositionName =
  | 'Bottom Right' | 'Bottom Left' | 'Middle Right' | 'Middle Left' | 'Top Right' | 'Top Left' | 'Top Center' | 'Bottom Center';

export interface AdaptiveTrendFinderInputs {
  source: SourceType;
  /** Use Long-Term Channel: periods 300 to 1200 in place of 20 to 200 */
  periodMode: boolean;
  devMultiplier: number;
  channelColor: string;
  channelLineStyle: LineStyleName;
  extendStyle: ExtendName;
  fillTransparency: number;
  channelTransparency: number;
  midlineColor: string;
  midlineTransparency: number;
  midlineWidth: number;
  midlineStyle: LineStyleName;
  showAutoSelectedPeriod: boolean;
  showTrendStrength: boolean;
  showPearson: boolean;
  showTrendAnnualizedReturn: boolean;
  tablePosition: TablePositionName;
  textSize: 'Normal' | 'Large' | 'Small';
}

export const defaultInputs: AdaptiveTrendFinderInputs = {
  source: 'close',
  periodMode: false,
  devMultiplier: 2.0,
  channelColor: '#787B86',
  channelLineStyle: 'Solid',
  extendStyle: 'Extend Right',
  fillTransparency: 93,
  channelTransparency: 40,
  midlineColor: '#2962FF',
  midlineTransparency: 100,
  midlineWidth: 1,
  midlineStyle: 'Dashed',
  showAutoSelectedPeriod: true,
  showTrendStrength: true,
  showPearson: false,
  showTrendAnnualizedReturn: true,
  tablePosition: 'Bottom Right',
  textSize: 'Normal',
};

const CHANNEL = 'CHANNEL SETTINGS';
const MIDLINE = 'MIDLINE SETTINGS';
const TABLE = 'TABLE SETTINGS';

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  {
    id: 'periodMode', type: 'bool', title: 'Use Long-Term Channel', defval: false, group: CHANNEL,
    tooltip: 'In Long-Term Channel mode, if the channel is not visible, scroll back on the chart for additional historical data. To view both Short-Term and Long-Term channels simultaneously, load this indicator twice on your chart.',
  },
  { id: 'devMultiplier', type: 'float', title: 'Deviation Multiplier:', defval: 2.0, step: 0.1, group: CHANNEL },
  { id: 'channelColor', type: 'color', title: '', defval: '#787B86', group: CHANNEL, inline: CHANNEL },
  { id: 'channelLineStyle', type: 'string', title: '', defval: 'Solid', options: ['Solid', 'Dotted', 'Dashed'], group: CHANNEL, inline: CHANNEL },
  {
    id: 'extendStyle', type: 'string', title: '', defval: 'Extend Right',
    options: ['Extend Right', 'Extend Both', 'Extend None', 'Extend Left'], group: CHANNEL, inline: CHANNEL,
  },
  { id: 'fillTransparency', type: 'int', title: 'Fill Transp:', defval: 93, min: 0, max: 100, step: 1, group: CHANNEL, inline: 'mid' },
  { id: 'channelTransparency', type: 'int', title: 'Line Transp:', defval: 40, min: 0, max: 100, step: 1, group: CHANNEL, inline: 'mid' },
  { id: 'midlineColor', type: 'color', title: '', defval: '#2962FF', group: MIDLINE, inline: MIDLINE },
  { id: 'midlineTransparency', type: 'int', title: 'Transp:', defval: 100, min: 0, max: 100, step: 10, group: MIDLINE, inline: MIDLINE },
  { id: 'midlineWidth', type: 'int', title: 'Line Width:', defval: 1, group: MIDLINE, inline: MIDLINE },
  { id: 'midlineStyle', type: 'string', title: '', defval: 'Dashed', options: ['Dotted', 'Solid', 'Dashed'], group: MIDLINE, inline: MIDLINE },
  {
    id: 'showAutoSelectedPeriod', type: 'bool', title: 'Show Auto-Selected Period', defval: true, group: TABLE,
    tooltip: 'Displays the length of the period automatically selected by the indicator that shows the strongest trend. This period is determined by identifying the highest correlation between price movements and trend direction.',
  },
  { id: 'showTrendStrength', type: 'bool', title: 'Show Trend Strength', defval: true, group: TABLE, inline: 'secondLine' },
  {
    id: 'showPearson', type: 'bool', title: "Show Pearson's R", defval: false, group: TABLE, inline: 'secondLine',
    tooltip: "Pearson's R is a statistical measure that evaluates the linear relationship between price movements and trend projection. A value closer to 1 indicates a strong positive correlation, increasing confidence in the trend direction based on historical data.",
  },
  {
    id: 'showTrendAnnualizedReturn', type: 'bool', title: 'Show Trend Annualized Return', defval: true, group: TABLE,
    tooltip: 'Displays the annualized return (CAGR) of the trend over the auto-selected period. This feature is available only for daily (D) and weekly (W) timeframes, providing insight into the expected yearly growth rate if the trend continues.',
  },
  {
    id: 'tablePosition', type: 'string', title: 'Table Position', defval: 'Bottom Right',
    options: ['Bottom Right', 'Bottom Left', 'Middle Right', 'Middle Left', 'Top Right', 'Top Left', 'Top Center', 'Bottom Center'],
    group: TABLE, inline: 'fourthLine',
  },
  { id: 'textSize', type: 'string', title: 'Text Size', defval: 'Normal', options: ['Normal', 'Large', 'Small'], group: TABLE, inline: 'fourthLine' },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Adaptive Trend Finder (log)',
  shortTitle: 'Adaptive Trend Finder',
  overlay: true,
};

/** Pine float comparisons: a < b only when b - a > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;
const gt = (a: number, b: number) => a - b > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
/** Pine nz(): na and the infinities give 0 */
const nz = (x: number) => (Number.isFinite(x) ? x : 0);

const SHORT_PERIODS = [20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200];
const LONG_PERIODS = [300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 950, 1000, 1050, 1100, 1150, 1200];

const LINE_STYLE = { Solid: 'solid', Dotted: 'dotted', Dashed: 'dashed' } as const;
const EXTEND = { 'Extend Right': 'right', 'Extend Both': 'both', 'Extend None': 'none', 'Extend Left': 'left' } as const;
const POSITION: Record<string, TablePosition> = {
  'Bottom Right': 'bottom_right', 'Bottom Center': 'bottom_center', 'Bottom Left': 'bottom_left', 'Top Right': 'top_right',
  'Top Left': 'top_left', 'Top Center': 'top_center', 'Middle Right': 'middle_right',
};

function confidence(pearsonR: number): string {
  if (lt(pearsonR, 0.2)) return 'Extremely Weak';
  if (lt(pearsonR, 0.3)) return 'Very Weak';
  if (lt(pearsonR, 0.4)) return 'Weak';
  if (lt(pearsonR, 0.5)) return 'Mostly Weak';
  if (lt(pearsonR, 0.6)) return 'Somewhat Weak';
  if (lt(pearsonR, 0.7)) return 'Moderately Weak';
  if (lt(pearsonR, 0.8)) return 'Moderate';
  if (lt(pearsonR, 0.9)) return 'Moderately Strong';
  if (lt(pearsonR, 0.92)) return 'Mostly Strong';
  if (lt(pearsonR, 0.94)) return 'Strong';
  if (lt(pearsonR, 0.96)) return 'Very Strong';
  if (lt(pearsonR, 0.98)) return 'Exceptionally Strong';
  return 'Ultra Strong';
}

interface Deviation {
  stdDev: number;
  pearsonR: number;
  slope: number;
  intercept: number;
}

/** Regression of the log source over the last `length` bars (x = 1 on the last bar, growing into the past) */
function calcDev(logSource: number[], last: number, length: number): Deviation {
  const at = (k: number) => (last - k >= 0 ? logSource[last - k] : NaN);
  const period1 = length - 1;
  let sumX = 0.0;
  let sumXX = 0.0;
  let sumYX = 0.0;
  let sumY = 0.0;
  for (let i = 1; i <= length; i++) {
    const lSrc = at(i - 1);
    sumX += i;
    sumXX += i * i;
    sumYX += i * lSrc;
    sumY += lSrc;
  }
  const slope = nz((length * sumYX - sumX * sumY) / (length * sumXX - sumX * sumX));
  const average = sumY / length;
  const intercept = average - (slope * sumX) / length + slope;
  let sumDev = 0.0;
  let sumDxx = 0.0;
  let sumDyy = 0.0;
  let sumDyx = 0.0;
  const regres = intercept + slope * period1 * 0.5;
  let sumSlp = intercept;
  for (let i = 0; i <= period1; i++) {
    let lSrc = at(i);
    const dxt = lSrc - average;
    const dyt = sumSlp - regres;
    lSrc -= sumSlp;
    sumSlp += slope;
    sumDxx += dxt * dxt;
    sumDyy += dyt * dyt;
    sumDyx += dxt * dyt;
    sumDev += lSrc * lSrc;
  }
  const stdDev = Math.sqrt(sumDev / period1); // unbiased
  const divisor = sumDxx * sumDyy;
  const pearsonR = nz(sumDyx / Math.sqrt(divisor));
  return { stdDev, pearsonR, slope, intercept };
}

type Result = Omit<IndicatorResult, 'lines' | 'linefills' | 'tables'> & {
  lines: LineDrawingData[]; linefills: LinefillData[]; tables: TableData[];
};

interface TrendFinderRun extends BarRunState<Record<string, never>> {
  /** Logarithm of the source of each bar */
  logSource: number[];
}

function study(inputs: Partial<AdaptiveTrendFinderInputs>): BarStudy<TrendFinderRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const source = barSource(cfg.source);
  return {
    fullRunReason: () => (isBarSource(cfg.source) ? null : 'source of another study'),
    init() {
      const s: TrendFinderRun = { logSource: [], steps: [], vars: {}, lists: [], series: [] };
      s.series = [s.logSource];
      return s;
    },
    bar(s, i, bars) {
      s.logSource[i] = Math.log(source(bars[i]) ?? NaN);
    },
    // everything is drawn on the last bar from the source of the bars before it
    result(s, bars, chart) {
      const n = bars.length;
      const result = {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
      };
      if (n === 0) return { ...result, lines: [], linefills: [], tables: [] };

      const last = n - 1;
      const logSource = s.logSource;
      const periods = cfg.periodMode ? LONG_PERIODS : SHORT_PERIODS;
      const devs = periods.map((length) => calcDev(logSource, last, length));

      // The highest Pearson's R; the first period that has it is selected, the last one when none compares equal
      let highestPearsonR = devs[0].pearsonR;
      for (const d of devs) {
        if (gt(d.pearsonR, highestPearsonR)) highestPearsonR = d.pearsonR;
      }
      let selected = devs.findIndex((d) => eq(d.pearsonR, highestPearsonR));
      if (selected < 0) selected = devs.length - 1;
      const detectedPeriod = periods[selected];
      const { slope: detectedSlope, intercept: detectedIntercept, stdDev: detectedStdDev } = devs[selected];

      // Channel: start and end price from the slope and the intercept
      const startPrice = Math.exp(detectedIntercept + detectedSlope * (detectedPeriod - 1));
      const endPrice = Math.exp(detectedIntercept);
      const interval = barInterval(bars);
      const startTime = barTime(bars, last - detectedPeriod + 1, interval);
      const endTime = bars[last].time;
      const extend = EXTEND[cfg.extendStyle] ?? 'left';
      const styleOf = (name: LineStyleName) => LINE_STYLE[name] ?? 'solid';
      const channelColor = String(color.new(cfg.channelColor, cfg.channelTransparency));
      const band = Math.exp(cfg.devMultiplier * detectedStdDev);

      const baseLine: LineDrawingData = {
        time1: startTime, price1: startPrice, time2: endTime, price2: endPrice, width: cfg.midlineWidth, extend,
        color: String(color.new(cfg.midlineColor, cfg.midlineTransparency)), style: styleOf(cfg.midlineStyle),
      };
      const upperLine: LineDrawingData = {
        time1: startTime, price1: startPrice * band, time2: endTime, price2: endPrice * band, width: 1, extend,
        color: channelColor, style: styleOf(cfg.channelLineStyle),
      };
      const lowerLine: LineDrawingData = {
        time1: startTime, price1: startPrice / band, time2: endTime, price2: endPrice / band, width: 1, extend,
        color: channelColor, style: styleOf(cfg.channelLineStyle),
      };
      const fillColor = String(color.new(cfg.channelColor, cfg.fillTransparency));
      const linefills: LinefillData[] = [
        { line1: upperLine, line2: baseLine, color: fillColor },
        { line1: baseLine, line2: lowerLine, color: fillColor },
      ];

      // Table
      const textSize = cfg.textSize === 'Large' ? 'large' : cfg.textSize === 'Small' ? 'small' : 'normal';
      const cells: TableCellData[] = [];
      if (cfg.showAutoSelectedPeriod) {
        const text = (cfg.periodMode ? 'Auto-Selected Period (Long Term): ' : 'Auto-Selected Period: ') + str.tostring(detectedPeriod);
        cells.push({ column: 0, row: 0, text, textColor: String(color.new(cfg.channelColor, 0)), textSize });
      }
      if (cfg.showTrendStrength) {
        const text = cfg.showPearson
          ? "Pearson's R: " + str.tostring(gt(detectedSlope, 0.0) ? -highestPearsonR : highestPearsonR, '#.###')
          : 'Trend Strength: ' + confidence(highestPearsonR);
        cells.push({ column: 0, row: 1, text, textColor: cfg.channelColor, textSize });
      }
      // Annualized return of the trend, on daily and weekly bars only
      const tf = chartTimeframe(bars, chart);
      const isDaily = tf.endsWith('D');
      const isWeekly = tf.endsWith('W');
      if (cfg.showTrendAnnualizedReturn && (isDaily || isWeekly)) {
        let cagr = NaN;
        if (last >= detectedPeriod) {
          // get_tf_multiplier(): 365 daily bars a year when syminfo.type is "crypto", else 252; 52 weekly bars
          const multiplier = isDaily ? (symbolTypeOf(chart) === 'crypto' ? 365 : 252) : 52;
          const startClosePrice = bars[last - (detectedPeriod - 1)].close;
          cagr = Math.pow(bars[last].close / startClosePrice, multiplier / detectedPeriod) - 1;
        }
        const text = 'Trend Annualized Return: ' + (!Number.isNaN(cagr) ? str.tostring(cagr * 100, '#.#') + '%' : 'N/A');
        cells.push({ column: 0, row: 2, text, textColor: cfg.channelColor, textSize });
      }
      const table: TableData = {
        position: cfg.periodMode ? 'bottom_center' : POSITION[cfg.tablePosition] ?? 'middle_left',
        columns: 2,
        rows: 3,
        cells,
      };

      return { ...result, lines: [baseLine, upperLine, lowerLine], linefills, tables: [table] };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AdaptiveTrendFinderInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<AdaptiveTrendFinderInputs> = {},
  chart?: ChartContext,
): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const AdaptiveTrendFinder = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
