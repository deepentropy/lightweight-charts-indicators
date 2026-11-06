/**
 * Sharpe Ratio Indicator (180)
 *
 * Sharpe ratio of the bar returns over `lookback` bars: r = (close - close[1]) / close[1];
 * sharpe = (sma(r, lookback) * 365 - riskFreeRate) / (stdev(r, lookback) * sqrt(lookback)). The line is red above
 * the overvalued level, green between the undervalued and the critically undervalued levels, blue below the
 * critically undervalued level and yellow otherwise. Horizontal lines at the three levels and at 0.
 *
 * Reference: "Sharpe Ratio Indicator (180)" by tim_amblard
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SharpeRatioIndicatorInputs {
  /** Risk-free rate (annualized, in decimal) */
  riskFreeRate: number;
  /** Lookback period in bars */
  lookback: number;
  overValued: number;
  underValued: number;
  criticallyUnderValued: number;
}

export const defaultInputs: SharpeRatioIndicatorInputs = {
  riskFreeRate: 0.04,
  lookback: 180,
  overValued: 5.0,
  underValued: -1.0,
  criticallyUnderValued: -3.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'riskFreeRate', type: 'float', title: 'Risk-Free Rate (annualized, in decimal)', defval: 0.04, min: 0.0 },
  { id: 'lookback', type: 'int', title: 'Lookback Period (180 Days)', defval: 180, min: 1 },
  { id: 'overValued', type: 'float', title: 'OverValued', defval: 5.0 },
  { id: 'underValued', type: 'float', title: 'UnderValued', defval: -1.0 },
  { id: 'criticallyUnderValued', type: 'float', title: 'CriticallyUnderValued', defval: -3.0 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Sharpe Ratio (180)', color: color.yellow, lineWidth: 2 },
];

export const metadata = {
  title: 'Sharpe Ratio Indicator (180)',
  shortTitle: 'Sharpe Ratio (180)',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number; color: string };

interface SharpeRun extends BarRunState<Record<string, never>> {
  mean: WindowSma;
  sd: WindowStdev;
  plot0: Point[];
}

function study(inputs: Partial<SharpeRatioIndicatorInputs>): BarStudy<SharpeRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const { riskFreeRate, lookback, overValued, underValued, criticallyUnderValued } = cfg;
  return {
    init() {
      const mean = new WindowSma(lookback);
      const sd = new WindowStdev(lookback);
      const s: SharpeRun = { mean, sd, plot0: [], steps: [mean, sd], vars: {}, lists: [], series: [] };
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // dailyReturn = (close - close[1]) / close[1]
      const ret = i > 0 ? (b.close - bars[i - 1].close) / bars[i - 1].close : NaN;
      const mean = s.mean.step(ret);
      const stdDev = s.sd.step(ret) * Math.sqrt(lookback);
      // A plain division: x / 0 is +-infinity (0 / 0 NaN); the comparisons use the infinite value, the plot shows na
      const sharpe = (mean * 365 - riskFreeRate) / stdDev;
      const isOver = gt(sharpe, overValued);
      const isUnder = gt(underValued, sharpe) && gt(sharpe, criticallyUnderValued);
      const isCritical = gt(criticallyUnderValued, sharpe);
      const c = isOver ? color.red : isUnder ? color.green : isCritical ? color.blue : color.yellow;
      s.plot0[i] = { time: b.time as number, value: Number.isFinite(sharpe) ? sharpe : NaN, color: c };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        hlines: [
          { value: overValued, options: { title: 'Overvalued Zone', color: color.red, linestyle: 'dashed' } },
          { value: underValued, options: { title: 'Undervalued Zone', color: color.green, linestyle: 'dashed' } },
          { value: criticallyUnderValued, options: { title: 'Critically Undervalued Zone', color: color.blue, linestyle: 'dashed' } },
          { value: 0, options: { title: 'Neutral Zone', color: color.gray, linestyle: 'dotted' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SharpeRatioIndicatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SharpeRatioIndicatorInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const SharpeRatioIndicator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
