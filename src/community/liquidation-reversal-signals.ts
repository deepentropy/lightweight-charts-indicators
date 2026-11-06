/**
 * Liquidation Reversal Signals [AlgoAlpha]
 *
 * The up volume and the down volume of each bar are turned into z-scores over 'Z Score Length' bars. A bar is a
 * short liquidation when the Supertrend (factor 2, ATR 10) is in an uptrend and the z-score of the up volume is
 * above 'Z-Score Threshold'; it is a long liquidation when the Supertrend is in a downtrend and the z-score of the
 * down volume is above the threshold. Each one is marked with a dot one ATR(14) above the high / below the low,
 * more opaque for a larger z-score. When the Supertrend then turns against the last liquidation within
 * 'Liquidation Timeout Bars' bars, the Supertrend line is shown until its next turn, with a start label, a fill to
 * the middle of the candle body and tinted candles. A table shows "No Volume" when the last bar has no volume.
 *
 * Limit, lower-timeframe volume: the original reads the up volume and the down volume of each bar from the bars of
 * 'Lower Timeframe' (default 15 minutes) with `requestUpAndDownVolume()` of the ta library of the platform. The bars
 * passed to a port are the chart bars only, so the port ESTIMATES both values from the chart bars
 * (src/lower-tf-volume.ts): all the volume of a bar is up volume or down volume by the library rule (up when
 * close > open, down when close < open, else by the close against the previous close, else as the previous bar).
 * Every visible output depends on these values (the dots, and through them the trend lines, labels, fills and
 * candle colours), so on a chart above the lower timeframe the output is NOT the output of the original. Also, the
 * original has the values only on the bars where data of the lower timeframe exists, while the port has the
 * estimate on every bar.
 * The timeframe input is kept. In the port it only does this: equal to the chart timeframe, the chart bars are the
 * bars of the request and the output is the original one; below the chart timeframe, the estimate is used whatever
 * its value; above the chart timeframe, the error of the library is thrown.
 *
 * Chart values read (optional third argument of calculate): the chart timeframe (without it, read from the bar
 * spacing), the chart background colour (candle tint, table; without it #0F0F0F) and the chart foreground colour
 * (label texts, table; without it #DBDBDB).
 * The candles are drawn in front of the chart candles (behind_chart = false).
 * Alerts (alertcondition, `alerts` of the result): 'Bullish ST Start' and 'Bearish ST Start' on the start labels,
 * 'Short Liquidation Spike' and 'Long Liquidation Spike' on the liquidation bars.
 *
 * Reference: "Liquidation Reversal Signals [AlgoAlpha]" by AlgoAlpha
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © AlgoAlpha
 */

import { taStep, color, math, timeframe, type IndicatorResult, type InputConfig, type PlotConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, PlotCandleData, TableData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import { chartTimeframe } from '../anchor-period';
import { backgroundColorOf, foregroundColorOf, type ChartContext } from '../chart-context';
import {
  createBarRun, fullResult, liveAlertStates, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun,
} from '../live-run';

export interface LiquidationReversalSignalsInputs {
  /** Lower Timeframe (see the file header for what it does in the port) */
  lowerTF: string;
  /** Z Score Length */
  length: number;
  /** Z-Score Threshold */
  zThresh: number;
  /** Liquidation Timeout Bars (0 = none) */
  timeoutBars: number;
  green: string;
  red: string;
}

export const defaultInputs: LiquidationReversalSignalsInputs = {
  lowerTF: '15',
  length: 200,
  zThresh: 3.0,
  timeoutBars: 50,
  green: '#00ffbb',
  red: '#ff1100',
};

export const inputConfig: InputConfig[] = [
  {
    id: 'lowerTF', type: 'timeframe', title: 'Lower Timeframe', defval: '15', group: 'Data',
    tooltip: 'Lower timeframe used by the up/down volume request.',
  },
  {
    id: 'length', type: 'int', title: 'Z Score Length', defval: 200, min: 1, group: 'Z-Score',
    tooltip: 'Lookback length for mean and standard deviation when computing z-scores of up/down volume.',
  },
  {
    id: 'zThresh', type: 'float', title: 'Z-Score Threshold', defval: 3.0, min: 0.0, step: 0.1, group: 'Z-Score',
    tooltip: 'Minimum z-score required to register a liquidation spike.',
  },
  {
    id: 'timeoutBars', type: 'int', title: 'Liquidation Timeout Bars (0 = none)', defval: 50, min: 0, group: 'Detection',
    tooltip: 'Maximum bars between a qualifying liquidation and the Supertrend flip. Set 0 to disable the timeout.',
  },
  {
    id: 'green', type: 'color', title: 'Bullish Colour', defval: '#00ffbb', group: 'Appearance',
    tooltip: 'Color used for bullish visuals and positive sentiment texts.',
  },
  {
    id: 'red', type: 'color', title: 'Bearish Colour', defval: '#ff1100', group: 'Appearance',
    tooltip: 'Color used for bearish visuals and negative sentiment texts.',
  },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Mid Body', color: '#2962FF', display: 'none' },
  { id: 'plot1', title: 'Bullish Trend', color: '#ff1100', style: 'linebr' },
  { id: 'plot2', title: 'Bearish Trend', color: '#00ffbb', style: 'linebr' },
];

/** The two fills with the default colours (the result `fills` carry the input colours) */
export const fillConfig: FillConfig[] = [
  { id: 'fill_bull', plot1: 'plot0', plot2: 'plot1', color: String(color.new('#ff1100', 90)), title: 'Bullish Fill' },
  { id: 'fill_bear', plot1: 'plot0', plot2: 'plot2', color: String(color.new('#00ffbb', 90)), title: 'Bearish Fill' },
];

export const metadata = {
  title: 'Liquidation Reversal Signals [AlgoAlpha]',
  shortTitle: 'AlgoAlpha - Liquidation Reversal',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a != b when they differ by more than 1e-10 (na: false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ne = (a: number, b: number) => Math.abs(a - b) > EPS;

type Result = Omit<IndicatorResult, 'markers'> & {
  markers: MarkerData[];
  plotCandles: Record<string, PlotCandleData[]>;
  tables: TableData[];
} & { alerts: AlertConditionState[] };

interface LiqVars {
  /** isBuyVolume of the up / down volume rule (the previous bar's when the bar is flat) */
  isBuyVolume: boolean;
  lastliqdir: number;
  lastliqindex: number;
  valid: number;
  plottrnd: number;
  prevPlottrnd: number;
}

interface LiqRun extends BarRunState<LiqVars> {
  meanU: WindowSma;
  stdevU: WindowStdev;
  meanD: WindowSma;
  stdevD: WindowStdev;
  st: ReturnType<typeof taStep.supertrend>;
  cross: ReturnType<typeof taStep.cross>;
  under: ReturnType<typeof taStep.crossunder>;
  over: ReturnType<typeof taStep.crossover>;
  atr: ReturnType<typeof taStep.atr>;
  u: number[];
  d: number[];
  midPlot: Array<{ time: number; value: number }>;
  bullPlot: Array<{ time: number; value: number; color: string }>;
  bearPlot: Array<{ time: number; value: number; color: string }>;
  markers: MarkerData[];
  candles: PlotCandleData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<LiquidationReversalSignalsInputs>): BarStudy<LiqRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, zThresh, timeoutBars, green, red } = cfg;
  const transpMax = 70;
  const transpMin = 30;
  const noCandle = String(color.new(green, 100));
  const bullLabel = String(color.new(red, 30));
  const bearLabel = String(color.new(green, 30));
  let chartFg = '';
  let chartBg = '';
  let bullCandle = '';
  let bearCandle = '';
  return {
    // the chart timeframe (the lower timeframe check) comes from the bar gaps without the context
    key: (bars, chart) => chartTimeframe(bars, chart),
    init(bars, chart) {
      // chart.fg_color, chart.bg_color
      chartFg = foregroundColorOf(chart);
      chartBg = backgroundColorOf(chart);
      bullCandle = String(color.from_gradient(50, 0, 100, red, chartBg));
      bearCandle = String(color.from_gradient(50, 0, 100, green, chartBg));
      // [u, d, _] = ta.requestUpAndDownVolume(lowerTF): checkLTF() of the library first
      const chartTf = chartTimeframe(bars, chart);
      if (chartTf !== '' && cfg.lowerTF.trim() !== '' && timeframe.in_seconds(cfg.lowerTF) > timeframe.in_seconds(chartTf)) {
        throw new Error(`Invalid lower timeframe: '${cfg.lowerTF}'. The timeframe must be lower than or equal to '${chartTf}'`);
      }
      const meanU = new WindowSma(length);
      const stdevU = new WindowStdev(length);
      const meanD = new WindowSma(length);
      const stdevD = new WindowStdev(length);
      const st = taStep.supertrend(2, 10);
      const cross = taStep.cross();
      const under = taStep.crossunder();
      const over = taStep.crossover();
      const atr = taStep.atr(14);
      const s: LiqRun = {
        meanU, stdevU, meanD, stdevD, st, cross, under, over, atr, u: [], d: [], midPlot: [], bullPlot: [],
        bearPlot: [], markers: [], candles: [], flags: [[], [], [], []], times: [[], [], [], []],
        steps: [meanU, stdevU, meanD, stdevD, st, cross, under, over, atr],
        vars: { isBuyVolume: true, lastliqdir: 0, lastliqindex: 0, valid: 0, plottrnd: 0, prevPlottrnd: NaN },
        lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.u, s.d, s.midPlot, s.bullPlot, s.bearPlot, s.candles, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i];
      const v = s.vars;
      // The timeframe is the chart timeframe: the chart bars are the requested bars and the values are the original
      // ones. Below it, the same computation on the chart bars is the estimate of the port (see the file header):
      // all the volume of a bar is up or down by the library rule.
      const prevClose = i > 0 ? bars[i - 1].close : NaN; // na comparisons are false
      if (gt(bar.close, bar.open)) v.isBuyVolume = true;
      else if (gt(bar.open, bar.close)) v.isBuyVolume = false;
      else if (gt(bar.close, prevClose)) v.isBuyVolume = true;
      else if (gt(prevClose, bar.close)) v.isBuyVolume = false;
      const volume = bar.volume ?? 0;
      const u = v.isBuyVolume ? volume : 0;
      // d := -d
      const d = -(v.isBuyVolume ? 0 : -volume);
      s.u[i] = u;
      s.d[i] = d;

      const meanU = s.meanU.step(u);
      const stdevU = s.stdevU.step(u);
      const meanD = s.meanD.step(d);
      const stdevD = s.stdevD.step(d);
      const [supertrend, direction] = s.st.step(bar.high, bar.low, bar.close);
      const dirCross = s.cross.step(direction, 0);
      const dirUnder = s.under.step(direction, 0);
      const dirOver = s.over.step(direction, 0);
      const vola = s.atr.step(bar.high, bar.low, bar.close);

      const zU = ne(stdevU, 0) ? (u - meanU) / stdevU : NaN;
      const zD = ne(stdevD, 0) ? (d - meanD) / stdevD : NaN;
      const shortLiq = gt(0, direction) && gt(zU, zThresh);
      const longLiq = gt(direction, 0) && gt(zD, zThresh);

      if (dirCross) v.plottrnd = 0;
      if (dirUnder && v.lastliqdir === 1 && v.valid === 1) {
        if (i - v.lastliqindex < timeoutBars) v.plottrnd = 1;
        v.valid = 0;
      }
      if (dirOver && v.lastliqdir === -1 && v.valid === 1) {
        if (i - v.lastliqindex < timeoutBars) v.plottrnd = -1;
        v.valid = 0;
      }
      if (shortLiq) {
        v.lastliqdir = -1;
        v.lastliqindex = i;
        v.valid = 1;
      }
      if (longLiq) {
        v.lastliqdir = 1;
        v.lastliqindex = i;
        v.valid = 1;
      }
      const plottrnd = v.plottrnd;

      // plottrnd[1] is na on the first bar: `na != -1` is false
      const prevPlottrnd = v.prevPlottrnd;
      const newBullSt = plottrnd === -1 && !Number.isNaN(prevPlottrnd) && prevPlottrnd !== -1;
      const newBearSt = plottrnd === 1 && !Number.isNaN(prevPlottrnd) && prevPlottrnd !== 1;
      v.prevPlottrnd = plottrnd;
      s.flags[0][i] = newBullSt;
      s.flags[1][i] = newBearSt;
      s.flags[2][i] = shortLiq;
      s.flags[3][i] = longLiq;
      if (newBullSt) s.times[0].push(bar.time as number);
      if (newBearSt) s.times[1].push(bar.time as number);
      if (shortLiq) s.times[2].push(bar.time as number);
      if (longLiq) s.times[3].push(bar.time as number);

      s.midPlot[i] = { time: bar.time, value: (bar.open + bar.close) / 2 };
      s.bullPlot[i] = { time: bar.time, value: plottrnd === -1 ? supertrend : NaN, color: red };
      s.bearPlot[i] = { time: bar.time, value: plottrnd === 1 ? supertrend : NaN, color: green };

      const markers = s.markers;
      if (newBullSt) {
        markers.push({ id: 'shape0', time: bar.time, position: 'aboveBar', shape: 'labelDown', color: bullLabel, text: '▼', textColor: chartFg, size: 'tiny' });
      }
      if (newBearSt) {
        markers.push({ id: 'shape1', time: bar.time, position: 'belowBar', shape: 'labelUp', color: bearLabel, text: '▲', textColor: chartFg, size: 'tiny' });
      }
      // plotchar(shortLiq ? high + vola : na, "Short Liquidation", "●", location.absolute, colShort, size = size.tiny)
      if (shortLiq && Number.isFinite(bar.high + vola)) {
        const norm = math.min(math.max((Math.abs(zU) - zThresh) / 5, 0), 1) as number;
        const transp = math.round(transpMax - norm * (transpMax - transpMin)) as number;
        markers.push({
          id: 'char2', time: bar.time, position: 'atPriceMiddle', price: bar.high + vola, shape: 'circle', color: 'transparent', text: '●',
          textColor: String(color.new(green, transp)), size: 'tiny',
        });
      }
      if (longLiq && Number.isFinite(bar.low - vola)) {
        const norm = math.min(math.max((Math.abs(zD) - zThresh) / 5, 0), 1) as number;
        const transp = math.round(transpMax - norm * (transpMax - transpMin)) as number;
        markers.push({
          id: 'char3', time: bar.time, position: 'atPriceMiddle', price: bar.low - vola, shape: 'circle', color: 'transparent', text: '●',
          textColor: String(color.new(red, transp)), size: 'tiny',
        });
      }

      const candleCol = plottrnd === -1 ? bullCandle : plottrnd === 1 ? bearCandle : noCandle;
      s.candles[i] = {
        time: bar.time, open: bar.open, high: bar.high, low: bar.low, close: bar.close,
        color: candleCol, wickColor: candleCol, borderColor: candleCol,
      };
    },
    result(s, bars) {
      const n = bars.length;
      // var table warnTbl: its cell is written on every bar (the state of the last bar is kept)
      const tables: TableData[] = [{ position: 'middle_right', columns: 1, rows: 1, cells: [] }];
      if (n > 0) {
        const volume = bars[n - 1].volume ?? NaN;
        const noVol = Number.isNaN(volume) || Math.abs(volume) <= EPS || (Number.isNaN(s.u[n - 1]) && Number.isNaN(s.d[n - 1]));
        tables[0].cells.push({
          column: 0, row: 0, text: noVol ? 'No Volume' : '',
          textColor: noVol ? String(color.white) : String(color.new(chartFg, 100)),
          bgColor: noVol ? String(color.new(red, 0)) : String(color.new(chartBg, 100)),
        });
      }
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.midPlot.slice(), plot1: s.bullPlot.slice(), plot2: s.bearPlot.slice() },
        fills: [
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Bullish Fill' }, colors: new Array<string>(n).fill(String(color.new(red, 90))) },
          { plot1: 'plot0', plot2: 'plot2', options: { title: 'Bearish Fill' }, colors: new Array<string>(n).fill(String(color.new(green, 90))) },
        ],
        markers: s.markers.slice(),
        plotCandles: { candles: s.candles.slice() },
        tables,
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<LiquidationReversalSignalsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<LiquidationReversalSignalsInputs> = {},
  chart?: ChartContext,
): Omit<IndicatorResult, 'markers'> & {
    markers: MarkerData[];
    plotCandles: Record<string, PlotCandleData[]>;
    tables: TableData[];
  } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs, chart).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish ST Start', message: 'Bullish supertrend became visible after qualifying liquidation and confirmation.' },
  { id: 'alert1', title: 'Bearish ST Start', message: 'Bearish supertrend became visible after qualifying liquidation and confirmation.' },
  { id: 'alert2', title: 'Short Liquidation Spike', message: 'Short-side liquidation detected (zU > threshold).' },
  { id: 'alert3', title: 'Long Liquidation Spike', message: 'Long-side liquidation detected (zD > threshold).' },
];

export const LiquidationReversalSignals = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, fillConfig, alertConditions };
