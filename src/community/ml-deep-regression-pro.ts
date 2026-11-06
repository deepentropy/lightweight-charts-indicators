/**
 * ML Deep Regression Pro
 *
 * Least-squares line over the last `length` closes, fitted with x = bars ago (0 = current bar), evaluated at
 * x = length - 1 (the oldest bar of the window) with explicit sums; the linear regression line (ta.linreg) of the
 * close at the current bar; optional bands at the first line +- multiplier * stdev(first line, length); an EMA of
 * the close. The "Polynomial Degree" input is not used by the computation.
 *
 * Reference: "ML Deep Regression Pro (TechnoBlooms)" by TechnoBlooms
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: This indicator is created under TechnoBlooms - Innovating Trading Indicators and Strategies.
 * All rights reserved. Unauthorized copying or distribution is prohibited. © TechnoBlooms
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MlDeepRegressionProInputs {
  /** Lookback period of the regressions and of the band standard deviation */
  length: number;
  /** Polynomial degree (not used by the computation, as in the original script) */
  polyDegree: number;
  /** Standard deviation multiplier of the bands */
  stdDevMultiplier: number;
  /** EMA length */
  emaLength: number;
  /** Display the upper and lower bands */
  showBands: boolean;
}

export const defaultInputs: MlDeepRegressionProInputs = {
  length: 20,
  polyDegree: 1,
  stdDevMultiplier: 2.0,
  emaLength: 14,
  showBands: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Lookback Period', defval: 20 },
  { id: 'polyDegree', type: 'int', title: 'Polynomial Degree', defval: 1, min: 1, max: 5 },
  { id: 'stdDevMultiplier', type: 'float', title: 'Standard Deviation Multiplier', defval: 2.0 },
  { id: 'emaLength', type: 'int', title: 'EMA Length', defval: 14 },
  { id: 'showBands', type: 'bool', title: 'Display Upper and Lower Bands', defval: false },
];

const POLY_COLOR = String(color.rgb(213, 255, 27));
const LINREG_COLOR = String(color.rgb(40, 255, 126));
const BAND_COLOR = String(color.rgb(231, 3, 201));
const EMA_COLOR = String(color.rgb(23, 255, 243));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Polynomial Regression Line', color: POLY_COLOR, lineWidth: 2 },
  { id: 'plot1', title: 'Linear Regression Line', color: LINREG_COLOR, lineWidth: 2 },
  { id: 'plot2', title: 'Upper Band', color: BAND_COLOR, lineWidth: 1 },
  { id: 'plot3', title: 'Lower Band', color: BAND_COLOR, lineWidth: 1 },
  { id: 'plot4', title: 'EMA', color: EMA_COLOR, lineWidth: 1 },
];

export const metadata = {
  title: 'ML Deep Regression Pro (TechnoBlooms)',
  shortTitle: 'ML Deep Regression Pro (TechnoBlooms)',
  overlay: true,
};

type Point = { time: number; value: number; color: string };

interface MldrRun extends BarRunState<Record<string, never>> {
  sd: WindowStdev;
  linreg: ReturnType<typeof taStep.linreg>;
  ema: ReturnType<typeof taStep.ema>;
  close: number[];
  plots: Point[][];
}

function study(inputs: Partial<MlDeepRegressionProInputs>): BarStudy<MldrRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const { length: len, stdDevMultiplier, emaLength, showBands } = cfg;
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      // fun_STDevBands(polyRegression, length, multiplier)
      const sd = new WindowStdev(len);
      const linreg = taStep.linreg(len, 0);
      const ema = taStep.ema(emaLength);
      const s: MldrRun = {
        sd, linreg, ema, close: [], plots: [[], [], [], [], []],
        steps: [sd, linreg, ema], vars: {}, lists: [], series: [],
      };
      s.series = [s.close, ...s.plots];
      return s;
    },
    bar(s, b, bars) {
      const { time, close: c } = bars[b];
      const close = s.close;
      close[b] = c;
      const at = (i: number) => (i >= 0 ? close[i] : NaN);

      // fun_PRegression(close, length): sums over i = 0 .. len - 1 of i, src[i], i * src[i], i * i (na before bar 0)
      let sumX = 0;
      let sumY = 0;
      let sumXY = 0;
      let sumX2 = 0;
      const step = len - 1 >= 0 ? 1 : -1; // `for i = 0 to len - 1` counts down when len - 1 < 0
      for (let i = 0; step > 0 ? i <= len - 1 : i >= len - 1; i += step) {
        sumX = sumX + i;
        sumY = sumY + at(b - i);
        sumXY = sumXY + i * at(b - i);
        sumX2 = sumX2 + i * i;
      }
      // Plain divisions: x / 0 is +-infinity, 0 / 0 na, as in Pine
      const denom = len * sumX2 - sumX * sumX;
      const slope = (len * sumXY - sumX * sumY) / denom;
      const intercept = (sumY - slope * sumX) / len;
      const poly = slope * (len - 1) + intercept;

      const sd = s.sd.step(poly) ?? NaN;
      const linreg = s.linreg.step(c) ?? NaN;
      const ema = s.ema.step(c) ?? NaN;
      const p = s.plots;
      p[0][b] = { time, value: fin(poly), color: POLY_COLOR };
      p[1][b] = { time, value: fin(linreg), color: LINREG_COLOR };
      p[2][b] = { time, value: showBands ? fin(poly + sd * stdDevMultiplier) : NaN, color: BAND_COLOR };
      p[3][b] = { time, value: showBands ? fin(poly - sd * stdDevMultiplier) : NaN, color: BAND_COLOR };
      p[4][b] = { time, value: fin(ema), color: EMA_COLOR };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plots[0].slice(),
          plot1: s.plots[1].slice(),
          plot2: s.plots[2].slice(),
          plot3: s.plots[3].slice(),
          plot4: s.plots[4].slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MlDeepRegressionProInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MlDeepRegressionProInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const MlDeepRegressionPro = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
