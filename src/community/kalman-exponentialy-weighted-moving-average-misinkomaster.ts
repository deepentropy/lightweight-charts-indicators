/**
 * Kalman Exponentialy Weighted Moving Average | MisinkoMaster
 *
 * A one-state Kalman filter (process noise Q, measurement noise R, start state = first source value, start
 * covariance 1) smooths the source. A Hull-like line is 2 * WMA(filtered, round(n / 2)) - WMA(filtered, n); a
 * second line blends it three times with its previous value (weight 2 / (n + 1)). A crossover of the first line
 * above the second gives the cyan colour, a crossunder the magenta colour; both lines and the fill between them keep
 * the colour until the next cross (transparent before the first cross).
 *
 * Reference: "Kalman Exponentialy Weighted Moving Average | MisinkoMaster" by MisinkoMaster
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © MisinkoMaster
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface KalmanExponentialyWeightedMovingAverageMisinkomasterInputs {
  /** Length */
  n: number;
  src: SourceType;
  /** Process noise (Q) */
  processNoise: number;
  /** Measurement noise (R) */
  measureNoise: number;
}

export const defaultInputs: KalmanExponentialyWeightedMovingAverageMisinkomasterInputs = {
  n: 45,
  src: 'close',
  processNoise: 0.0005,
  measureNoise: 0.097,
};

export const inputConfig: InputConfig[] = [
  { id: 'n', type: 'int', title: 'Length', defval: 45, min: 2, step: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'processNoise', type: 'float', title: 'Process Noise (Q)', defval: 0.0005, min: 0, step: 0.00001 },
  { id: 'measureNoise', type: 'float', title: 'Measurement Noise (R)', defval: 0.097, min: 0, step: 0.001 },
];

const NONE = String(color.rgb(0, 0, 0, 100));
const LONG = String(color.rgb(40, 215, 255, 10));
const LONG_FILL = String(color.rgb(25, 230, 255, 50));
const SHORT = String(color.rgb(225, 30, 255, 10));
const SHORT_FILL = String(color.rgb(215, 40, 255, 60));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Weighted Moving Average', color: LONG, lineWidth: 3 },
  { id: 'plot1', title: 'Exponentialy Weighted Moving Average', color: LONG, lineWidth: 3 },
];

export const metadata = {
  title: 'Kalman Exponentialy Weighted Moving Average | MisinkoMaster',
  shortTitle: 'KEWMA | MisinkoMaster',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };

interface KalmanVars {
  /** var float xhat = src (first bar), var float P = 1.0 */
  xhat: number;
  P: number;
  /** Line and fill colours (var) */
  c: string;
  cT: string;
}

interface KalmanRun extends BarRunState<KalmanVars> {
  w1: ReturnType<typeof taStep.wma>;
  w2: ReturnType<typeof taStep.wma>;
  up: ReturnType<typeof taStep.crossover>;
  dn: ReturnType<typeof taStep.crossunder>;
  wma: number[];
  plot0: Point[];
  plot1: Point[];
  colT: string[];
}

function study(inputs: Partial<KalmanExponentialyWeightedMovingAverageMisinkomasterInputs>): BarStudy<KalmanRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.n;
  const value = barSource(cfg.src);

  // a = 2 / (n + 1); n1 = math.abs(math.round(n / 2)) (n / 2 is a float in Pine v6, math.round rounds half up)
  const a = 2 / (len + 1);
  const n1 = Math.abs(Math.round(len / 2));
  const Q = cfg.processNoise;
  const R = cfg.measureNoise;
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const w1 = taStep.wma();
      const w2 = taStep.wma();
      const up = taStep.crossover();
      const dn = taStep.crossunder();
      const s: KalmanRun = {
        w1, w2, up, dn, wma: [], plot0: [], plot1: [], colT: [],
        steps: [w1, w2, up, dn], vars: { xhat: NaN, P: 1.0, c: NONE, cT: NONE }, lists: [], series: [],
      };
      s.series = [s.wma, s.plot0, s.plot1, s.colT];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const src = value(b);
      if (i === 0) v.xhat = src;
      const xhatPrior = v.xhat;
      const pPrior = v.P + Q;
      const K = pPrior / (pPrior + R);
      v.xhat = xhatPrior + K * (src - xhatPrior);
      v.P = (1 - K) * pPrior;
      const xhat = v.xhat;

      // wma = ta.wma(xhat, n1) * 2 - ta.wma(xhat, n)
      const wma = s.w1.step(xhat, n1) * 2 - s.w2.step(xhat, len);
      s.wma[i] = wma;
      // ewma = wma * a + wma[1] * (1 - a), then ewma := ewma * a + wma[1] * (1 - a) twice
      const prev = i > 0 ? s.wma[i - 1]! : NaN;
      let e = wma * a + prev * (1 - a);
      e = e * a + prev * (1 - a);
      e = e * a + prev * (1 - a);

      // L = ta.crossover(wma, ewma); S = ta.crossunder(wma, ewma) (exact comparisons with the last bar where both
      // values were not na)
      const long = s.up.step(wma, e);
      const short = s.dn.step(wma, e);
      if (long && !short) {
        v.c = LONG;
        v.cT = LONG_FILL;
      }
      if (short) {
        v.c = SHORT;
        v.cT = SHORT_FILL;
      }
      s.plot0[i] = { time: b.time, value: wma, color: v.c };
      s.plot1[i] = { time: b.time, value: e, color: v.c };
      s.colT[i] = v.cT;
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        // fill(w, ew, colT)
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { title: 'Plots Background' }, colors: s.colT.slice() }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(
  inputs: Partial<KalmanExponentialyWeightedMovingAverageMisinkomasterInputs> = {},
  chart: ChartContext = {},
): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<KalmanExponentialyWeightedMovingAverageMisinkomasterInputs> = {},
): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const KalmanExponentialyWeightedMovingAverageMisinkomaster = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
