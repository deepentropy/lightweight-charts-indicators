/**
 * COV Bands ~ C H I P A
 *
 * Bands from the coefficient of variation of the close: mean = sma(close, length),
 * cov = stdev(close, stddev) / mean; upper = mean + mean * cov * upperMulti, lower = mean - mean * cov * lowerMulti.
 * A close above the upper band sets the trend to long (blue candles), a close below the lower band sets it to short
 * (red candles); the trend stays until the other band is crossed. Candles are drawn in the indicator pane on the
 * last 10,000 bars.
 *
 * Reference: "COV Bands ~ C H I P A" by C_H_I_P_A
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © C_H_I_P_A
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { PlotCandleData } from '../types';

export interface CovBandsInputs {
  /** SMA length of the mean */
  length: number;
  upperBandMulti: number;
  lowerBandMulti: number;
  /** Standard deviation length */
  stddev: number;
}

export const defaultInputs: CovBandsInputs = {
  length: 46,
  upperBandMulti: 1.2,
  lowerBandMulti: 0.3,
  stddev: 31,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Period Length', defval: 46, group: 'Indicator Inputs' },
  { id: 'upperBandMulti', type: 'float', title: 'Upper Band Multiplier', defval: 1.2, step: 0.02, group: 'Indicator Inputs' },
  { id: 'lowerBandMulti', type: 'float', title: 'Lower Band Multiplier', defval: 0.3, step: 0.02, group: 'Indicator Inputs' },
  { id: 'stddev', type: 'int', title: 'Standard Deviation', defval: 31, group: 'Indicator Inputs' },
];

const GRAY = String(color.rgb(150, 150, 160));
const GRAY_FADE = String(color.new(color.rgb(150, 150, 160), 70));
const LONG_COL = String(color.rgb(0, 180, 255));
const SHORT_COL = String(color.rgb(255, 80, 60));
/** plotcandle show_last */
const SHOW_LAST = 10000;

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Band', color: GRAY, lineWidth: 1 },
  { id: 'plot1', title: 'Lower Band', color: GRAY, lineWidth: 1 },
];

export const metadata = {
  title: 'COV Bands ~ C H I P A',
  shortTitle: 'COV Bands ~ C H I P A',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;

type Result = IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> };
type Point = { time: number; value: number; color: string };

interface CovVars {
  /** var cb = 0 */
  cb: number;
  /** var color coloring = na */
  coloring: string;
}

interface CovRun extends BarRunState<CovVars> {
  mean: WindowSma;
  dev: WindowStdev;
  plot0: Point[];
  plot1: Point[];
  /** The candle of every bar (plotcandle show_last: the last ones are shown) */
  candles: PlotCandleData[];
}

const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

function study(inputs: Partial<CovBandsInputs>): BarStudy<CovRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const mean = new WindowSma(cfg.length);
      const dev = new WindowStdev(cfg.stddev);
      const s: CovRun = {
        mean, dev, plot0: [], plot1: [], candles: [],
        steps: [mean, dev], vars: { cb: 0, coloring: 'transparent' }, lists: [], series: [],
      };
      s.series = [s.plot0, s.plot1, s.candles];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const v = s.vars;
      const c = b.close;
      const mean = s.mean.step(c);
      const stdDev = s.dev.step(c);
      // A plain division: x / 0 is +-infinity (0 / 0 NaN), as in Pine
      const cov = stdDev / mean;
      const upper = mean + mean * cov * cfg.upperBandMulti;
      const lower = mean - mean * cov * cfg.lowerBandMulti;
      if (gt(c, upper)) v.cb = 1;
      if (gt(lower, c)) v.cb = -1;
      if (v.cb === 1) v.coloring = LONG_COL;
      else if (v.cb === -1) v.coloring = SHORT_COL;
      const coloring = v.coloring;
      // plotcandle(open, high, low, close, 'Candle Coloring', coloring, coloring, true, show_last = 10000, coloring)
      s.candles[i] = {
        time: b.time, open: b.open, high: b.high, low: b.low, close: b.close,
        color: coloring, wickColor: coloring, borderColor: coloring,
      };
      s.plot0[i] = { time: b.time as number, value: fin(upper), color: GRAY };
      s.plot1[i] = { time: b.time as number, value: fin(lower), color: GRAY };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plot0.slice(),
          plot1: s.plot1.slice(),
        },
        // fill(upper_plot, lower_plot, grayfade)
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: GRAY_FADE } }],
        plotCandles: { candleColoring: s.candles.slice(Math.max(0, n - SHOW_LAST)) },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CovBandsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<CovBandsInputs> = {},
): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const CovBands = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
