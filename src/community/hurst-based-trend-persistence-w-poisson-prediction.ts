/**
 * Hurst-Based Trend Persistence w/Poisson Prediction
 *
 * Rolling Hurst oscillator: the rescaled range R / S of the last `lookback` closes (R = range of the cumulative
 * deviations from the mean, S = population standard deviation), H = log(R / S) / log(lookback), drawn as H - 0.5.
 * It is green when the close is at or above the close `lookback - 1` bars ago, else red. A colour that stays the
 * same for `minInterval` bars (3 to 10, from the volatility of the close changes) records the bars since the last
 * recorded change; the decay-weighted mean of these intervals gives a Poisson rate lambda, and the area plot shows
 * the probability 1 - exp(-lambda * t) of a change after t bars, more opaque when it is high.
 *
 * Reference: "Hurst-Based Trend Persistence w/Poisson Prediction" by garysebastianbrowniii
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface HurstBasedTrendPersistenceWPoissonPredictionInputs {
  /** Hurst lookback period */
  lookback: number;
  /** Poisson lookback period (longest interval kept) */
  lambdaLookback: number;
  /** Poisson decay factor (0-1) */
  decayFactor: number;
  /** Volatility lookback (window of the dynamic minimum interval) */
  volatilityLookback: number;
}

export const defaultInputs: HurstBasedTrendPersistenceWPoissonPredictionInputs = {
  lookback: 20,
  lambdaLookback: 180,
  decayFactor: 0.618,
  volatilityLookback: 49,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'Hurst Lookback Period', defval: 20, min: 2 },
  { id: 'lambdaLookback', type: 'int', title: 'Poisson Lookback Period', defval: 180, min: 10 },
  { id: 'decayFactor', type: 'float', title: 'Poisson Decay Factor (0-1)', defval: 0.618, min: 0.5, max: 1 },
  { id: 'volatilityLookback', type: 'int', title: 'Volatility Lookback', defval: 49, min: 5 },
];

const PROJ = '#ff8400';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Poisson Projection', color: PROJ, lineWidth: 8, style: 'area' },
  { id: 'plot1', title: 'Rolling Hurst Oscillator', color: color.green, lineWidth: 2 },
];

export const metadata = {
  title: 'Hurst-Based Trend Persistence w/Poisson Prediction',
  shortTitle: 'Trending',
  overlay: false,
};

/** Pine float comparisons within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => ge(b, a);
const ne = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && Math.abs(a - b) > EPS;

type Point = { time: number; value: number; color: string };

interface HurstVars {
  lastColorChangeBar: number;
  lastOscColor: string | null;
  weightedSumIntervals: number;
  weightSum: number;
  intervalsCount: number;
  stableColorBarCount: number;
}

interface HurstRun extends BarRunState<HurstVars> {
  plot0: Point[];
  plot1: Point[];
}

function study(inputs: Partial<HurstBasedTrendPersistenceWPoissonPredictionInputs>): BarStudy<HurstRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const { lookback, lambdaLookback, decayFactor, volatilityLookback } = cfg;
  return {
    init() {
      const s: HurstRun = {
        plot0: [], plot1: [], steps: [],
        vars: {
          lastColorChangeBar: NaN, lastOscColor: null, weightedSumIntervals: 0, weightSum: 0, intervalsCount: 0,
          stableColorBarCount: 0,
        },
        lists: [], series: [],
      };
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const close = (k: number) => (k >= 0 ? bars[k].close : NaN);
      // Price volatility for the dynamic minimum interval (na until close[volatilityLookback] exists)
      let sumSqVol = 0;
      for (let j = 0; j <= volatilityLookback - 1; j++) {
        const delta = close(i - j) - close(i - j - 1);
        sumSqVol += delta * delta;
      }
      const stdevVol = Math.sqrt(sumSqVol / volatilityLookback);
      // math.round(math.max(3, math.min(10, stdevVol * 5))): na when stdevVol is na
      const minInterval = Number.isNaN(stdevVol) ? NaN : Math.round(Math.max(3, Math.min(10, stdevVol * 5)));

      // Rolling Hurst oscillator
      let hurstOsc = NaN;
      if (i + 1 >= lookback) {
        let sumClose = 0;
        for (let j = 0; j <= lookback - 1; j++) sumClose += close(i - (lookback - 1 - j));
        const mean = sumClose / lookback;
        let sumSq = 0;
        for (let j = 0; j <= lookback - 1; j++) {
          const dev = close(i - (lookback - 1 - j)) - mean;
          sumSq += dev * dev;
        }
        const stdev = Math.sqrt(sumSq / lookback);
        let cSum = 0;
        let localMax = -1e10;
        let localMin = 1e10;
        for (let j = 0; j <= lookback - 1; j++) {
          cSum += close(i - (lookback - 1 - j)) - mean;
          localMax = Math.max(localMax, cSum);
          localMin = Math.min(localMin, cSum);
        }
        const R = localMax - localMin;
        const RS = ne(stdev, 0) ? R / stdev : NaN;
        const H = gt(RS, 0) ? Math.log(RS) / Math.log(lookback) : NaN;
        hurstOsc = Number.isNaN(H) ? NaN : H - 0.5;
      }

      // Price slope and oscillator colour (an na slope gives red)
      const priceSlope = close(i) - close(i - (lookback - 1));
      const oscillatorColor = ge(priceSlope, 0) ? color.green : color.red;

      // Colour change events
      if (v.lastOscColor === null) {
        v.lastOscColor = oscillatorColor;
        v.lastColorChangeBar = i;
        v.stableColorBarCount = 0;
      } else {
        if (oscillatorColor === v.lastOscColor) v.stableColorBarCount += 1;
        else v.stableColorBarCount = 0;
        if (ge(v.stableColorBarCount, minInterval)) {
          const currentInterval = i - v.lastColorChangeBar;
          if (le(i - v.lastColorChangeBar, lambdaLookback)) {
            const weight = Math.pow(decayFactor, v.intervalsCount);
            v.weightedSumIntervals += currentInterval * weight;
            v.weightSum += weight;
            v.intervalsCount += 1;
          }
          v.lastColorChangeBar = i;
          v.lastOscColor = oscillatorColor;
          v.stableColorBarCount = 0;
        }
      }

      // Poisson lambda and projection
      const avgInterval = gt(v.weightSum, 0) ? v.weightedSumIntervals / v.weightSum : NaN;
      const lambda = !Number.isNaN(avgInterval) && gt(avgInterval, 0) ? 1.0 / avgInterval : 0;
      const t = !Number.isNaN(v.lastColorChangeBar) ? i - v.lastColorChangeBar : 0;
      const p = gt(lambda, 0) ? 1.0 - Math.exp(-lambda * t) : 0;
      const projTransp = 255 - Math.round(p * 255);

      const time = bars[i].time;
      s.plot0[i] = { time, value: p, color: String(color.new(PROJ, projTransp)) };
      s.plot1[i] = { time, value: hurstOsc, color: oscillatorColor };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        hlines: [{ value: 0, options: { title: 'Baseline (H = 0.5)', color: '#999eb0', linestyle: 'dashed' } }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(
  inputs: Partial<HurstBasedTrendPersistenceWPoissonPredictionInputs> = {},
  chart: ChartContext = {},
): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<HurstBasedTrendPersistenceWPoissonPredictionInputs> = {},
): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const HurstBasedTrendPersistenceWPoissonPrediction = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
