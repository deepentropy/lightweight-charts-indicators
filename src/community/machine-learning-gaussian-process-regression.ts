/**
 * Machine Learning: Gaussian Process Regression [LuxAlgo]
 *
 * Fits a Gaussian process with a radial basis function kernel (length scale "Smooth", noise "sigma") to the last
 * "Training Window" closes minus their simple moving average, and extends it "Forecasting Length" bars into the
 * future. The kernel matrices only depend on the bar positions: they are built once (the pseudo-inverse of the
 * training kernel plus the noise term, times the kernel between the training and the test positions). The model is
 * set once: on the last confirmed bar ("Lock Forecast", the bar before an open last bar) or on the last bar (the two
 * other update mechanisms; both act the same on a calculation over the loaded bars). It draws the fit as a blue
 * polyline over the training window and the forecast as a red polyline after it.
 *
 * Reference: "Machine Learning: Gaussian Process Regression [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import {
  ta, math, matrix, polyline, chartPoint, Series, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type ChartPoint, type IndicatorResult, type InputConfig, type PlotConfig,
} from 'oakscriptjs';
import { lastBarConfirmedOf, type ChartContext } from '../chart-context';
import type { StudyDrawingKind } from '../style-outputs';

type UpdateMechanism = 'Lock Forecast' | 'Update Once Reached' | 'Continuously Update';

export interface MachineLearningGaussianProcessRegressionInputs {
  /** Training Window (bars) */
  window: number;
  /** Fit line colour */
  fitCss: string;
  /** Forecasting Length (bars) */
  forecast: number;
  /** Forecast line colour */
  fcastCss: string;
  /** Smooth (kernel length scale) */
  length: number;
  /** Noise of the training values */
  sigma: number;
  /** Update Mechanism */
  update: UpdateMechanism;
}

export const defaultInputs: MachineLearningGaussianProcessRegressionInputs = {
  window: 100,
  fitCss: '#2962ff',
  forecast: 20,
  fcastCss: '#f23645',
  length: 20,
  sigma: 0.01,
  update: 'Lock Forecast',
};

export const inputConfig: InputConfig[] = [
  { id: 'window', type: 'int', title: 'Training Window    ', defval: 100, min: 0, inline: 'window' },
  { id: 'fitCss', type: 'color', title: '', defval: '#2962ff', inline: 'window' },
  { id: 'forecast', type: 'int', title: 'Forecasting Length', defval: 20, min: 0, max: 500, inline: 'forecast' },
  { id: 'fcastCss', type: 'color', title: '', defval: '#f23645', inline: 'forecast' },
  { id: 'length', type: 'float', title: 'Smooth', defval: 20, min: 1 },
  { id: 'sigma', type: 'float', title: 'sigma', defval: 0.01, min: 0, step: 0.1 },
  { id: 'update', type: 'string', title: 'Update Mechanism', defval: 'Lock Forecast', options: ['Lock Forecast', 'Update Once Reached', 'Continuously Update'] },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['polyline'];

export const metadata = {
  title: 'Machine Learning: Gaussian Process Regression [LuxAlgo]',
  shortTitle: 'LuxAlgo - Machine Learning: Gaussian Process Regression',
  overlay: true,
};

type Matrix = ReturnType<typeof matrix.new_matrix<number>>;

/** rbf(x1, x2, l) = exp(-(x1 - x2)^2 / (2 l^2)) */
const rbf = (x1: number, x2: number, l: number) => math.exp(-math.pow(x1 - x2, 2) / (2.0 * math.pow(l, 2)));

/** kernel_matrix(X1, X2, l) */
function kernelMatrix(x1s: number[], x2s: number[], l: number): Matrix {
  const km = matrix.new_matrix<number>(x1s.length, x2s.length, NaN);
  x1s.forEach((x1, i) => x2s.forEach((x2, j) => matrix.set(km, i, j, rbf(x1, x2, l))));
  return km;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MachineLearningGaussianProcessRegressionInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const window = Math.trunc(cfg.window);
  const forecast = Math.trunc(cfg.forecast);

  resetDrawings({ polyline: 50 });
  if (n === 0) {
    return { metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay }, plots: {} };
  }

  // Kernel matrices (barstate.isfirst)
  const xtrain = Array.from({ length: window }, (_, i) => i);
  const xtest = Array.from({ length: window + forecast }, (_, i) => i);
  const identity = matrix.new_matrix<number>(window, window, 0);
  for (let i = 0; i < window; i++) {
    for (let j = 0; j < window; j++) matrix.set(identity, i, j, i === j ? 1 : 0);
  }
  const s = matrix.mult(identity, cfg.sigma * cfg.sigma) as Matrix;
  const kTrain = matrix.sum(kernelMatrix(xtrain, xtrain, cfg.length), s);
  const kInv = matrix.pinv(kTrain);
  const kStar = kernelMatrix(xtrain, xtest, cfg.length);
  const kSource = matrix.mult(matrix.transpose(kStar), kInv) as Matrix;

  const mean = ta.sma(new Series(bars, (b) => b.close), window).toArray();

  // set_model: barstate.islastconfirmedhistory (the last bar, or the bar before it while the last bar is open), or
  // barstate.islast (with step == 0 on the first last-bar run for "Update Once Reached")
  const setBar = cfg.update === 'Lock Forecast' ? (lastBarConfirmedOf(chart) ? n - 1 : n - 2) : n - 1;
  if (setBar >= 0) {
    setDrawingBar(setBar, setBar === n - 1);
    const i = setBar;
    const m = mean[i];
    // ytrain.unshift(close[i] - mean) for i = 0 .. window - 1: the oldest close first
    const ytrain: number[] = [];
    for (let k = 0; k < window; k++) ytrain.unshift((i - k >= 0 ? bars[i - k].close : NaN) - m);
    const mu = matrix.mult(kSource, ytrain) as number[];

    let k = -window + 2;
    const points: ChartPoint[] = [];
    const fcast: ChartPoint[] = [];
    for (const element of mu) {
      const p = chartPoint.from_index(i + k, element + m);
      if (k === 1) {
        fcast.push(p);
        points.push(chartPoint.from_index(i + k, element + m));
      } else if (k > 1) {
        fcast.push(p);
      } else {
        points.push(p);
      }
      k += 1;
    }
    polyline.new(points, false, false, 'bar_index', cfg.fitCss, null, 'solid', 2);
    polyline.new(fcast, false, false, 'bar_index', cfg.fcastCss, null, 'solid', 2);
    setDrawingBar(null);
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    ...drawingOutputs(bars),
  };
}

export const MachineLearningGaussianProcessRegression = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  drawingKinds,
};
