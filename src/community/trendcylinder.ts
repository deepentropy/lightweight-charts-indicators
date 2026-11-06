/**
 * Trend Cylinder
 *
 * A trend line that moves to the midpoint of the close and itself when the close is farther than
 * ATR x factor x step from it (ATR: RMA(10) of ATR(200)); otherwise it stays in place (plus a step of
 * ATR / 2^100 in the last direction, too small to change it). The direction is the sign of the last change of the
 * trend line. Bands: trend +/- (ATR x factor - ATR - EMA(200) of the 100-bar standard deviation of the close).
 * The line and the bands are drawn only when the direction is the same as on the previous bar; the line is bullish
 * after a rise, bearish after a fall. Gradient fills go from the trend line (transparent) to each band.
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Trend Shift' (the trend line rises after a fall on the bar
 * before) and 'Bearish Trend Shift' (falls after a rise).
 *
 * Reference: "Trend Cylinder (Zeiierman)" by Zeiierman
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Zeiierman
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TrendCylinderInputs {
  /** Volatility period (standard deviation length) */
  volatilityPeriod: number;
  /** Trend factor */
  trendFactor: number;
  /** Trend step */
  trendStep: number;
  bullishTrendColor: string;
  bearishTrendColor: string;
  /** Colour of the fill under the upper band (fill between the lower band and the trend) */
  colorForUpperBand: string;
  /** Colour of the fill above the trend line (fill between the upper band and the trend) */
  colorForLowerBand: string;
}

export const defaultInputs: TrendCylinderInputs = {
  volatilityPeriod: 100,
  trendFactor: 9,
  trendStep: 0.7,
  bullishTrendColor: '#493893',
  bearishTrendColor: '#862458',
  colorForUpperBand: String(color.new('#862458', 10)),
  colorForLowerBand: String(color.new('#493893', 10)),
};

export const inputConfig: InputConfig[] = [
  { id: 'volatilityPeriod', type: 'int', title: 'Period', defval: 100, min: 2, max: 1000, step: 10 },
  { id: 'trendFactor', type: 'float', title: 'Factor', defval: 9, min: 0.1, step: 0.1 },
  { id: 'trendStep', type: 'float', title: 'Step', defval: 0.7, min: 0.5, max: 5.0, step: 0.1 },
  { id: 'bullishTrendColor', type: 'color', title: 'Bullish Trend', defval: '#493893' },
  { id: 'bearishTrendColor', type: 'color', title: 'Bearish Trend', defval: '#862458' },
  { id: 'colorForUpperBand', type: 'color', title: 'Upper Band', defval: String(color.new('#862458', 10)) },
  { id: 'colorForLowerBand', type: 'color', title: 'Lower Band', defval: String(color.new('#493893', 10)) },
];

const BAND_COL = String(color.new(color.black, 100));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trend Line', color: '#493893', lineWidth: 2 },
  { id: 'plot1', title: 'Upper Band', color: BAND_COL, lineWidth: 1 },
  { id: 'plot2', title: 'Lower Band', color: BAND_COL, lineWidth: 1 },
];

export const metadata = {
  title: 'Trend Cylinder (Zeiierman)',
  shortTitle: 'Trend Cylinder (Zeiierman)',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { alerts: AlertConditionState[] };

interface TrendVars {
  /** var float currentTrend = 0.0 */
  currentTrend: number;
  /** determineTrendDirection(direction): direction[1] is the argument of the previous call */
  prevArg: number;
  colorForPlot: string;
  prevBullish: boolean;
  prevBearish: boolean;
}

interface TrendRun extends BarRunState<TrendVars> {
  atr: ReturnType<typeof taStep.atr>;
  atrRma: ReturnType<typeof taStep.rma>;
  stdev: WindowStdev;
  stdevEma: ReturnType<typeof taStep.ema>;
  trend: number[];
  direction: number[];
  upperBand: number[];
  lowerBand: number[];
  plots: Point[][];
  topColor: Array<string | null>;
  bottomColor: Array<string | null>;
  lowerBottomColor: Array<string | null>;
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<TrendCylinderInputs>): BarStudy<TrendRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const noColor = String(color.new(color.black, 100)); // color.new(na, 100)
  return {
    init() {
      const s: TrendRun = {
        atr: taStep.atr(200), atrRma: taStep.rma(10), stdev: new WindowStdev(cfg.volatilityPeriod), stdevEma: taStep.ema(200),
        trend: [], direction: [], upperBand: [], lowerBand: [], plots: [[], [], []],
        topColor: [], bottomColor: [], lowerBottomColor: [], flags: [[], []], times: [[], []], steps: [],
        // var color colorForPlot = bullishTrendColor, then colorForPlot := ... : colorForPlot[1] on every bar: on the
        // first bar colorForPlot[1] is na, so the colour stays na until the first rise or fall of the trend line
        vars: { currentTrend: 0.0, prevArg: NaN, colorForPlot: 'transparent', prevBullish: false, prevBearish: false },
        lists: [], series: [],
      };
      s.steps = [s.atr, s.atrRma, s.stdev, s.stdevEma];
      s.lists = s.times;
      s.series = [
        s.trend, s.direction, s.upperBand, s.lowerBand, ...s.plots, s.topColor, s.bottomColor, s.lowerBottomColor,
        ...s.flags,
      ];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const t = b.time;
      const close = b.close;
      const averageTrueRange = s.atrRma.step(s.atr.step(b.high, b.low, b.close));
      const stdevEma = s.stdevEma.step(s.stdev.step(close));

      const scaledStandardDev = (isNaN(averageTrueRange) ? 0 : averageTrueRange) * cfg.trendFactor;
      // trendDirection := determineTrendDirection(currentTrend), with currentTrend of the previous bar
      const d = v.currentTrend - v.prevArg;
      const direction = gt(d, 0) ? 1 : lt(d, 0) ? -1 : 0;
      s.direction[i] = direction;
      v.prevArg = v.currentTrend;
      const priceTrendDiff = Math.abs(close - v.currentTrend);
      const reciprocalFactor = (scaledStandardDev * (1 / cfg.trendFactor) * 1) / Math.pow(2, 100);
      v.currentTrend = gt(priceTrendDiff, scaledStandardDev * cfg.trendStep)
        ? (close + v.currentTrend) / 2
        : direction * reciprocalFactor + v.currentTrend;
      const trend = v.currentTrend;
      s.trend[i] = trend;
      const upperBand = trend + scaledStandardDev - averageTrueRange - stdevEma;
      const lowerBand = trend - scaledStandardDev + averageTrueRange + stdevEma;
      s.upperBand[i] = upperBand;
      s.lowerBand[i] = lowerBand;

      // isTrendConsistent = trendDirection == trendDirection[1] (false on the first bar)
      const consistent = i > 0 && direction === s.direction[i - 1];
      const isBullishTrend = i > 0 && gt(trend, s.trend[i - 1]);
      const isBearishTrend = i > 0 && lt(trend, s.trend[i - 1]);
      // bullishShift = isBullishTrend and isBearishTrend[1] / bearishShift = isBearishTrend and isBullishTrend[1]
      const bull = isBullishTrend && v.prevBearish;
      const bear = isBearishTrend && v.prevBullish;
      v.prevBullish = isBullishTrend;
      v.prevBearish = isBearishTrend;
      v.colorForPlot = isBullishTrend ? cfg.bullishTrendColor : isBearishTrend ? cfg.bearishTrendColor : v.colorForPlot;
      s.plots[0][i] = { time: t, value: consistent ? trend : NaN, color: v.colorForPlot };
      s.plots[1][i] = { time: t, value: consistent ? upperBand : NaN, color: BAND_COL };
      s.plots[2][i] = { time: t, value: consistent ? lowerBand : NaN, color: BAND_COL };
      s.topColor[i] = cfg.colorForLowerBand;
      s.bottomColor[i] = noColor;
      s.lowerBottomColor[i] = cfg.colorForUpperBand;
      s.flags[0][i] = bull;
      s.flags[1][i] = bear;
      if (bull) s.times[0].push(t as number);
      if (bear) s.times[1].push(t as number);
    },
    result(s, bars) {
      const n = bars.length;
      // fill(plotUpper, plotTrend, top_value = upperBand, bottom_value = currentTrend, top_color = colorForLowerBand,
      //      bottom_color = color.new(na, 100))
      // fill(plotTrend, plotLower, top_value = currentTrend, bottom_value = lowerBand, top_color = color.new(na, 100),
      //      bottom_color = colorForUpperBand)
      const fills = [
        {
          plot1: 'plot1', plot2: 'plot0', options: { title: 'Background Upper' },
          gradient: { topValue: s.upperBand.slice(), bottomValue: s.trend.slice(), topColor: s.topColor.slice(), bottomColor: s.bottomColor.slice() },
        },
        {
          plot1: 'plot0', plot2: 'plot2', options: { title: 'Background Lower' },
          gradient: {
            topValue: s.trend.slice(), bottomValue: s.lowerBand.slice(),
            topColor: s.bottomColor.slice(), bottomColor: s.lowerBottomColor.slice(),
          },
        },
      ];
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice() },
        fills,
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TrendCylinderInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TrendCylinderInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Trend Shift', message: 'Trend Cylinder: Bullish trend shift detected' },
  { id: 'alert1', title: 'Bearish Trend Shift', message: 'Trend Cylinder: Bearish trend shift detected' },
];

export const TrendCylinder = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
