/**
 * Aggregated Scores Oscillator
 *
 * The score is the sum of an SMA of the Omega ratio and an SMA of the Sortino ratio of the bar returns
 * r = close / close[1] - 1 over `period` bars. Omega = sum of the returns above the target return / sum of the
 * shortfalls below it. Sortino = mean return / downside deviation * sqrt(365). The bands average an expanding band
 * (mean +/- multiplier * standard deviation of all scores so far) and a rolling band (SMA +/- multiplier * stdev over
 * `rollingWindow` bars); the upper band is scaled by the upper band sensitivity. The score is red above the upper
 * threshold (overbought), green below the lower threshold (oversold) and white otherwise; the price pane background
 * shows the same zones.
 *
 * Reference: "Aggregated Scores Oscillator [Alpha Extract]" by AlphaExtract
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AggregatedScoresOscillatorInputs {
  /** Calculation period of the Omega and Sortino ratios */
  period: number;
  /** Target return */
  targetReturn: number;
  /** Window of the rolling statistics */
  rollingWindow: number;
  /** Upper band multiplier (expanding) */
  upperMultiplier: number;
  /** Lower band multiplier (expanding) */
  lowerMultiplier: number;
  /** Rolling band multiplier */
  rollingMultiplier: number;
  /** Upper band sensitivity */
  upperBandAdjust: number;
  /** Omega SMA length */
  omegaSma: number;
  /** Sortino SMA length */
  sortinoSma: number;
}

export const defaultInputs: AggregatedScoresOscillatorInputs = {
  period: 150,
  targetReturn: 0,
  rollingWindow: 200,
  upperMultiplier: 1.75,
  lowerMultiplier: 1.5,
  rollingMultiplier: 1.8,
  upperBandAdjust: 0.9,
  omegaSma: 5,
  sortinoSma: 7,
};

export const inputConfig: InputConfig[] = [
  { id: 'period', type: 'int', title: 'Calculation Period', defval: 150, min: 10, max: 500 },
  { id: 'targetReturn', type: 'float', title: 'Target Return', defval: 0, step: 0.001 },
  { id: 'rollingWindow', type: 'int', title: 'Rolling Window', defval: 200, min: 50, max: 300 },
  { id: 'upperMultiplier', type: 'float', title: 'Upper Band Multiplier (Expanding)', defval: 1.75, min: 0.5, max: 3, step: 0.1 },
  { id: 'lowerMultiplier', type: 'float', title: 'Lower Band Multiplier (Expanding)', defval: 1.5, min: 0.5, max: 3, step: 0.1 },
  { id: 'rollingMultiplier', type: 'float', title: 'Rolling Band Multiplier', defval: 1.8, min: 0.5, max: 3, step: 0.1 },
  { id: 'upperBandAdjust', type: 'float', title: 'Upper Band Sensitivity', defval: 0.9, min: 0.5, max: 1, step: 0.01 },
  { id: 'omegaSma', type: 'int', title: 'Omega SMA Length', defval: 5, min: 1, max: 20 },
  { id: 'sortinoSma', type: 'int', title: 'Sortino SMA Length', defval: 7, min: 1, max: 20 },
];

const BULLISH = String(color.new('#00ff88', 0));
const BEARISH = String(color.new('#ff3366', 0));
const NEUTRAL = String(color.new('#ffffff', 20));
const UPPER_BAND = String(color.new('#ff0066', 30));
const LOWER_BAND = String(color.new('#00cc88', 30));
const OS_COL = String(color.new('#00ff88', 80));
const OB_COL = String(color.new('#ff3366', 80));
const CHANNEL_FILL = String(color.new(color.purple, 96));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Aggregated Score', color: NEUTRAL, lineWidth: 3 },
  { id: 'plot1', title: 'Upper Threshold', color: UPPER_BAND, lineWidth: 2 },
  { id: 'plot2', title: 'Lower Threshold', color: LOWER_BAND, lineWidth: 2 },
];

export const metadata = {
  title: 'Aggregated Scores Oscillator [Alpha Extract]',
  shortTitle: 'Aggregated Scores Oscillator [Alpha Extract]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
/** Pine x != 0: false when x is na or within 1e-10 of 0 */
const nonZero = (x: number) => !isNaN(x) && Math.abs(x) > EPS;

type Result = IndicatorResult & { bgColors: BgColorData[] };
type Point = { time: number; value: number; color: string };

interface AggVars {
  /** Expanding statistics (var float cumulativeSum = 0, cumulativeSquareSum = 0, var int count = 0) */
  cumSum: number;
  cumSq: number;
  count: number;
}

interface AggRun extends BarRunState<AggVars> {
  meanReturn: WindowSma;
  omegaSma: WindowSma;
  sortinoSma: WindowSma;
  rollingMean: WindowSma;
  rollingStd: WindowStdev;
  up: number[];
  down: number[];
  downSq: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<AggregatedScoresOscillatorInputs>): BarStudy<AggRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { period, targetReturn } = cfg;
  return {
    init() {
      const meanReturn = new WindowSma(period);
      const omegaSma = new WindowSma(cfg.omegaSma);
      const sortinoSma = new WindowSma(cfg.sortinoSma);
      // Rolling statistics
      const rollingMean = new WindowSma(cfg.rollingWindow);
      const rollingStd = new WindowStdev(cfg.rollingWindow);
      const s: AggRun = {
        meanReturn, omegaSma, sortinoSma, rollingMean, rollingStd, up: [], down: [], downSq: [], plot0: [], plot1: [],
        plot2: [], bgColors: [],
        steps: [meanReturn, omegaSma, sortinoSma, rollingMean, rollingStd],
        vars: { cumSum: 0, cumSq: 0, count: 0 }, lists: [], series: [],
      };
      s.lists = [s.bgColors];
      s.series = [s.up, s.down, s.downSq, s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const { up, down, downSq } = s;
      // dailyReturn = close / close[1] - 1
      const r = i > 0 ? b.close / bars[i - 1].close - 1 : NaN;
      // excess / deficit terms: an na return compares false, so the term is 0
      up[i] = gt(r, targetReturn) ? r - targetReturn : 0;
      down[i] = lt(r, targetReturn) ? targetReturn - r : 0;
      const d = lt(r, targetReturn) ? r - targetReturn : 0;
      downSq[i] = d * d;

      const meanReturn = s.meanReturn.step(r);
      // math.sum(x, period): na until period bars
      let excess = NaN;
      let deficit = NaN;
      if (i >= period - 1) {
        excess = 0;
        deficit = 0;
        for (let j = i - period + 1; j <= i; j++) {
          excess += up[j];
          deficit += down[j];
        }
      }
      const omega = nonZero(deficit) ? excess / deficit : NaN;
      // for i = 0 to period - 1: dailyReturn[i] before the first bar is na (term 0)
      let dd = 0;
      for (let j = 0; j < period; j++) {
        if (i - j >= 0) dd += downSq[i - j];
      }
      dd = Math.sqrt(dd / period);
      const sortino = nonZero(dd) ? (meanReturn / dd) * Math.sqrt(365) : NaN;
      const score = s.omegaSma.step(omega) + s.sortinoSma.step(sortino);

      const rollingMean = s.rollingMean.step(score);
      const rollingStd = s.rollingStd.step(score);
      const v = s.vars;
      if (!isNaN(score)) {
        v.cumSum += score;
        v.cumSq += score * score;
        v.count += 1;
      }
      const expandingMean = v.count === 0 ? NaN : v.cumSum / v.count;
      const variance = (v.count === 0 ? NaN : v.cumSq / v.count) - expandingMean * expandingMean;
      const expandingStd = Math.sqrt(variance);
      const expUpper = expandingMean + expandingStd * cfg.upperMultiplier;
      const expLower = expandingMean - expandingStd * cfg.lowerMultiplier;
      const rollUpper = rollingMean + rollingStd * cfg.rollingMultiplier;
      const rollLower = rollingMean - rollingStd * cfg.rollingMultiplier;
      const upper = ((expUpper + rollUpper) / 2) * cfg.upperBandAdjust;
      const lower = (expLower + rollLower) / 2;
      const ob = gt(score, upper);
      const os = lt(score, lower);

      // bgcolor(OB ? OBCol : OS ? OSCol : na, force_overlay = true)
      if (ob) s.bgColors.push({ time: b.time, color: OB_COL, forceOverlay: true });
      else if (os) s.bgColors.push({ time: b.time, color: OS_COL, forceOverlay: true });

      s.plot0[i] = { time: b.time, value: score, color: ob ? BEARISH : os ? BULLISH : NEUTRAL };
      s.plot1[i] = { time: b.time, value: upper, color: UPPER_BAND };
      s.plot2[i] = { time: b.time, value: lower, color: LOWER_BAND };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        hlines: [
          { value: 0, options: { title: '━━━ Zero Line ━━━', color: String(color.new(color.gray, 50)), linestyle: 'dashed', linewidth: 1 } },
        ],
        fills: [
          { plot1: 'plot1', plot2: 'plot2', options: { title: 'Channel Fill', color: CHANNEL_FILL } },
        ],
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AggregatedScoresOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AggregatedScoresOscillatorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const AggregatedScoresOscillator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
