/**
 * Weighted Regression Bands
 *
 * A weighted high / low midline over `len` bars, by one of three methods on the bar medians (high + low) / 2:
 * Simple (highest and lowest median), Advanced (median of the bar with the highest / lowest median * range * decay,
 * smoothed by kf(x, 0.1)) or Smooth (range * decay^2 weighted mean of the medians). The midline is smoothed by
 * kf(x, filterStrength), with kf(x, a) = previous + a * (x - previous) (started at x). The fair value is the
 * "Linear Regression" of the midline (the script regresses the current midline value on every x of the window, so
 * it gives back the midline) or its ALMA(len, 0.85, 6). Bands at the fair value -/+ 1, 2 and 3 times
 * mult * stdev(close, len) are filled; the line and the fills are green while the fair value rises and red while
 * it falls (they keep the last colour on a flat bar).
 * Alerts (alertcondition, `alerts` of the result): 'Trend - Long' / 'Trend - Short' on the bars where the slope of the
 * fair value turns positive / negative (slope > 0 and slope[1] <= 0, and the mirror).
 *
 * Reference: "Weighted Regression Bands (Zeiierman)" by Zeiierman
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Zeiierman
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface WeightedRegressionBandsInputs {
  /** Length of the weighting window, the regression / ALMA and the stdev */
  len: number;
  /** Deviation multiplier */
  mult: number;
  /** Fair value method */
  MA: 'Linear Regression' | 'ALMA';
  /** Weighted high / low method */
  weightingMethod: 'Simple' | 'Advanced' | 'Smooth';
  /** Smoothing of the midline (1 = none) */
  filterStrength: number;
  upperCol: string;
  lowerCol: string;
  /** Bands (off: the deviation multiplier is 0) */
  noband: boolean;
}

export const defaultInputs: WeightedRegressionBandsInputs = {
  len: 50,
  mult: 1.0,
  MA: 'Linear Regression',
  weightingMethod: 'Simple',
  filterStrength: 0.08,
  upperCol: '#00e676',
  lowerCol: '#e91e63',
  noband: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Length', defval: 50, min: 1 },
  { id: 'mult', type: 'float', title: 'Deviation Multiplier', defval: 1.0, min: 0.01, step: 0.1 },
  { id: 'MA', type: 'string', title: 'Method', defval: 'Linear Regression', options: ['Linear Regression', 'ALMA'] },
  { id: 'weightingMethod', type: 'string', title: 'Weighted HL Method', defval: 'Simple', options: ['Simple', 'Advanced', 'Smooth'] },
  { id: 'filterStrength', type: 'float', title: 'Smoothing [1 = None Smoothing]', defval: 0.08, min: 0.01, max: 1, step: 0.01, group: 'Trend Factor' },
  { id: 'upperCol', type: 'color', title: '', defval: '#00e676', inline: 'c' },
  { id: 'lowerCol', type: 'color', title: '', defval: '#e91e63', inline: 'c' },
  { id: 'noband', type: 'bool', title: 'Bands', defval: true, inline: 'c' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Weighted Regression Line', color: '#00e676', lineWidth: 2 },
  { id: 'plot1', title: 'Upper Band 1', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'Upper Band 2', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Upper Band 3', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'Lower Band 1', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Lower Band 2', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot6', title: 'Lower Band 3', color: 'transparent', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Weighted Regression Bands (Zeiierman)',
  shortTitle: 'Weighted Regression Bands (Zeiierman)',
  overlay: true,
};

/** Pine a > b: a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > 1e-10);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > 1e-10);
/** Pine x / y: na when y is 0 */
const div = (x: number, y: number) => (y === 0 ? NaN : x / y);

/** Pine `for i = from to to`: counts down when from > to */
function pineFor(from: number, to: number, f: (i: number) => void): void {
  if (from <= to) for (let i = from; i <= to; i++) f(i);
  else for (let i = from; i >= to; i--) f(i);
}

/** kf(src, s_len): one state per call site; na(state) ? src : state + s_len * (src - state) */
const kf = (state: number, x: number, sLen: number): number => (isNaN(state) ? x : state + sLen * (x - state));

/** (high[i] + low[i]) / 2 and high[i] - low[i] of bar t (na before the first bar) */
const med = (bars: Bar[], t: number, i: number) => (t - i >= 0 ? (bars[t - i].high + bars[t - i].low) / 2 : NaN);
const rng = (bars: Bar[], t: number, i: number) => (t - i >= 0 ? bars[t - i].high - bars[t - i].low : NaN);

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { alerts: AlertConditionState[] };

interface WrbVars {
  /** the kf states of the Advanced high / low and of the midline */
  kfAdvHi: number;
  kfAdvLo: number;
  kfMid: number;
  /** bandColor of the previous bar (null: na) */
  bandColor: string | null;
}

interface WrbRun extends BarRunState<WrbVars> {
  sd: WindowStdev;
  whlMid: number[];
  fair: number[];
  slopes: number[];
  plots: Point[][];
  fillCols: string[][];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<WeightedRegressionBandsInputs>): BarStudy<WrbRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.len;
  const mult = cfg.noband ? cfg.mult : 0;
  const lenW = Math.max(1, len);
  const alma = cfg.MA === 'ALMA';

  // ta.alma(whlMid, len, 0.85, 6): the weights of the oakscriptjs function (normalised gaussian), na before bar len - 1
  const weights: number[] = [];
  if (alma) {
    const length = len;
    const m = 0.85 * (length - 1);
    const sg = length / 6;
    let weightSum = 0;
    for (let i = 0; i < length; i++) {
      const weight = Math.exp(-1 * Math.pow(i - m, 2) / (2 * Math.pow(sg, 2)));
      weights.push(weight);
      weightSum += weight;
    }
    for (let i = 0; i < length; i++) weights[i] /= weightSum;
  }

  // color.new(na, t) is black with transparency t: the fill colours of each band colour
  const fillColors = new Map<string | null, string[]>();
  const fillsOf = (c: string | null): string[] => {
    let f = fillColors.get(c);
    if (!f) {
      f = [85, 92, 96].map((t) => String(color.new(c ?? '#000000', t)));
      fillColors.set(c, f);
    }
    return f;
  };

  return {
    init() {
      const s: WrbRun = {
        sd: new WindowStdev(len), whlMid: [], fair: [], slopes: [], plots: [[], [], [], [], [], [], []], fillCols: [[], [], []],
        flags: [[], []], times: [[], []],
        steps: [], vars: { kfAdvHi: NaN, kfAdvLo: NaN, kfMid: NaN, bandColor: null }, lists: [], series: [],
      };
      s.steps = [s.sd];
      s.lists = [...s.times];
      s.series = [s.whlMid, s.fair, s.slopes, ...s.plots, ...s.fillCols, ...s.flags];
      return s;
    },
    bar(s, t, bars) {
      const v = s.vars;
      let hi = NaN;
      let lo = NaN;
      if (cfg.weightingMethod === 'Simple') {
        // WeightedHighest / WeightedLowest: for i = 1 to math.min(_len - 1, bar_index)
        hi = med(bars, t, 0);
        lo = med(bars, t, 0);
        pineFor(1, Math.min(lenW - 1, t), (i) => {
          const m = med(bars, t, i);
          if (gt(m, hi)) hi = m;
          if (lt(m, lo)) lo = m;
        });
      } else if (cfg.weightingMethod === 'Advanced') {
        // highest / lowest score = median * range * (1 - i / _len); the median of that bar, then kf(x, 0.1)
        let wHi = NaN;
        let maxScore = NaN;
        let wLo = NaN;
        let minScore = NaN;
        pineFor(0, Math.min(lenW - 1, t), (i) => {
          const m = med(bars, t, i);
          const score = m * rng(bars, t, i) * (1.0 - i / lenW);
          if (isNaN(maxScore) || gt(score, maxScore)) {
            maxScore = score;
            wHi = m;
          }
          if (isNaN(minScore) || lt(score, minScore)) {
            minScore = score;
            wLo = m;
          }
        });
        v.kfAdvHi = kf(v.kfAdvHi, wHi, 0.1);
        v.kfAdvLo = kf(v.kfAdvLo, wLo, 0.1);
        hi = v.kfAdvHi;
        lo = v.kfAdvLo;
      } else if (cfg.weightingMethod === 'Smooth') {
        // sum(median * range * (1 - i / len)^2) / sum(range * (1 - i / len)^2), i = 0 to len - 1
        let num = 0.0;
        let denom = 0.0;
        pineFor(0, len - 1, (i) => {
          const w = rng(bars, t, i) * Math.pow(1 - i / len, 2);
          num += med(bars, t, i) * w;
          denom += w;
        });
        hi = div(num, denom);
        lo = hi; // SmoothWeightedLowest is the same computation
      }
      v.kfMid = kf(v.kfMid, (hi + lo) / 2, cfg.filterStrength);
      const y = v.kfMid;
      s.whlMid[t] = y;

      // Fair value
      let fair: number;
      if (alma) {
        if (t < len - 1) {
          fair = NaN;
        } else {
          let almaValue = 0;
          for (let j = 0; j < len; j++) almaValue += s.whlMid[t - len + 1 + j] * weights[j];
          fair = almaValue;
        }
      } else {
        // LinReg_WHL: y = whlMid (the current value) for every x = 0 .. len - 1
        let sumX = 0.0;
        let sumY = 0.0;
        let sumXY = 0.0;
        let sumXX = 0.0;
        pineFor(0, len - 1, (x) => {
          sumX += x;
          sumY += y;
          sumXY += x * y;
          sumXX += x * x;
        });
        const slope = div(len * sumXY - sumX * sumY, len * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / len;
        fair = slope * (len - 1) + intercept;
      }
      s.fair[t] = fair;

      const dev = mult * s.sd.step(bars[t].close);

      // bandColor := slope > 0 ? upper_col : slope < 0 ? lower_col : bandColor[1] (na on the first bar)
      const slope = t > 0 ? fair - s.fair[t - 1] : NaN;
      s.slopes[t] = slope;
      const bandColor = gt(slope, 0) ? cfg.upperCol : lt(slope, 0) ? cfg.lowerCol : t > 0 ? v.bandColor : null;
      v.bandColor = bandColor;
      // bullishFlip = slope > 0 and slope[1] <= 0; bearishFlip = slope < 0 and slope[1] >= 0
      const prevSlope = t > 0 ? s.slopes[t - 1] : NaN;
      const bull = gt(slope, 0) && le(prevSlope, 0);
      const bear = lt(slope, 0) && ge(prevSlope, 0);
      const time = bars[t].time;
      s.flags[0][t] = bull;
      s.flags[1][t] = bear;
      if (bull) s.times[0].push(time as number);
      if (bear) s.times[1].push(time as number);

      const p = s.plots;
      p[0][t] = { time, value: fair, color: bandColor ?? 'transparent' };
      p[1][t] = { time, value: fair + dev * 1 };
      p[2][t] = { time, value: fair + dev * 2 };
      p[3][t] = { time, value: fair + dev * 3 };
      p[4][t] = { time, value: fair + dev * -1 };
      p[5][t] = { time, value: fair + dev * -2 };
      p[6][t] = { time, value: fair + dev * -3 };
      const f = fillsOf(bandColor);
      s.fillCols[0][t] = f[0];
      s.fillCols[1][t] = f[1];
      s.fillCols[2][t] = f[2];
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(),
          plot1: p[1].slice(),
          plot2: p[2].slice(),
          plot3: p[3].slice(),
          plot4: p[4].slice(),
          plot5: p[5].slice(),
          plot6: p[6].slice(),
        },
        fills: [
          { plot1: 'plot1', plot2: 'plot4', colors: s.fillCols[0].slice() },
          { plot1: 'plot2', plot2: 'plot5', colors: s.fillCols[1].slice() },
          { plot1: 'plot3', plot2: 'plot6', colors: s.fillCols[2].slice() },
        ],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<WeightedRegressionBandsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<WeightedRegressionBandsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Trend - Long', message: 'Trend turned bullish for {{ticker}}' },
  { id: 'alert1', title: 'Trend - Short', message: 'Trend turned bearish for {{ticker}}' },
];

export const WeightedRegressionBands = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
