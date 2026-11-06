/**
 * Range Channel
 *
 * A moving average of the source (linear regression by default, or one of ten other types) and the distance of the
 * source from it in percent, diff = (src / ma - 1) * 100, drawn as a histogram. Since the first bar, the positive
 * diffs and the negative diffs are averaged separately (cumulative means of diff / 100). The channel edges on the
 * price pane are ma * (1 + positive mean) and ma * (1 + negative mean); the oscillator pane also shows both means
 * in percent.
 *
 * Reference: "Range Channel by Atilla Yurtseven" by AtillaYurtseven
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © AtillaYurtseven
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import {
  barSource, createBarRun, fullResult, isBarSource, WindowSma, WindowSum, type BarRunState, type BarStudy, type IndicatorRun,
} from '../live-run';

export type RangeChannelMaType =
  | 'SMA (Simple MA)'
  | 'EMA (Exponential MA)'
  | 'WMA (Weighted MA)'
  | 'Linear MA (Linear Regression)'
  | 'SMMA (Smoothed MA)'
  | 'VWMA (Volume Weighted MA)'
  | 'HWMA (Hull WMA)'
  | 'RMA (Running MA)'
  | 'ALMA (Arnaud Legoux MA)'
  | 'DEMA (Double EMA)'
  | 'TEMA (Triple EMA)';

export interface RangeChannelByAtillaYurtsevenInputs {
  src: SourceType;
  /** Moving average length */
  lookBack: number;
  /** Moving average type */
  maType: RangeChannelMaType;
}

export const defaultInputs: RangeChannelByAtillaYurtsevenInputs = {
  src: 'close',
  lookBack: 200,
  maType: 'Linear MA (Linear Regression)',
};

const MA_TYPES: RangeChannelMaType[] = [
  'SMA (Simple MA)', 'EMA (Exponential MA)', 'WMA (Weighted MA)', 'Linear MA (Linear Regression)',
  'SMMA (Smoothed MA)', 'VWMA (Volume Weighted MA)', 'HWMA (Hull WMA)', 'RMA (Running MA)',
  'ALMA (Arnaud Legoux MA)', 'DEMA (Double EMA)', 'TEMA (Triple EMA)',
];

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'lookBack', type: 'int', title: 'Lookback', defval: 200, min: 1 },
  { id: 'maType', type: 'string', title: 'Moving Average Type', defval: 'Linear MA (Linear Regression)', options: MA_TYPES },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Moving Average', color: '#2962FF', lineWidth: 1, forceOverlay: true },
  { id: 'plot1', title: 'Upper Edge', color: color.gray, lineWidth: 1, style: 'circles', forceOverlay: true },
  { id: 'plot2', title: 'Lower Edge', color: color.gray, lineWidth: 1, style: 'circles', forceOverlay: true },
  { id: 'plot3', title: 'Untrended', color: color.green, lineWidth: 1, style: 'histogram' },
  { id: 'plot4', title: 'Positive Mean', color: color.gray, lineWidth: 1, style: 'circles' },
  { id: 'plot5', title: 'Negative Mean', color: color.gray, lineWidth: 1, style: 'circles' },
];

export const metadata = {
  title: 'Range Channel by Atilla Yurtseven',
  shortTitle: 'Range Channel',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };

type Ma = { step(v: number, volume: number, i: number, src: number[]): number; commit(): void };

/** calculate_ma(source, ma_type, look_back) stepped bar by bar (the doubles of the oakscriptjs Series functions) */
function movingAverage(maType: RangeChannelMaType, len: number): Ma {
  const L = Math.floor(len);
  switch (maType) {
    case 'EMA (Exponential MA)':
      return taStep.ema(len);
    case 'WMA (Weighted MA)': {
      const m = taStep.wma();
      return { step: (v) => m.step(v, len), commit: () => m.commit() };
    }
    case 'Linear MA (Linear Regression)':
      // ta.linreg(source, look_back, 0): the loops of the oakscriptjs array function over the source values
      return {
        step: (_v, _vol, i, src) => {
          if (i < L - 1) return NaN;
          for (let j = 0; j < L; j++) if (isNaN(src[i - j])) return NaN;
          let sumX = 0;
          let sumY = 0;
          let sumXY = 0;
          let sumX2 = 0;
          for (let j = 0; j < L; j++) {
            const x = j + 1;
            const y = src[i - (L - 1 - j)];
            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumX2 += x * x;
          }
          const slope = (L * sumXY - sumX * sumY) / (L * sumX2 - sumX * sumX);
          const intercept = sumY / L - (slope * sumX) / L + slope;
          return intercept + slope * (L - 1 - 0);
        },
        commit: () => {},
      };
    case 'VWMA (Volume Weighted MA)': {
      // ta.sma(source * volume, look_back) / ta.sma(volume, look_back), na when the volume average is 0 or na
      const num = new WindowSum(len);
      const den = new WindowSum(len);
      return {
        step: (v, volume) => {
          const nu = num.step(v * volume) / L;
          const d = den.step(volume) / L;
          return d === 0 || isNaN(d) ? NaN : nu / d;
        },
        commit: () => { num.commit(); den.commit(); },
      };
    }
    case 'HWMA (Hull WMA)': {
      // ta.wma(2 * ta.wma(source, look_back / 2) - ta.wma(source, look_back), math.round(math.sqrt(look_back)))
      const half = taStep.wma();
      const full = taStep.wma();
      const outer = taStep.wma();
      const outerLen = Math.round(Math.sqrt(len));
      return {
        step: (v) => outer.step(half.step(v, len / 2) * 2 - full.step(v, len), outerLen),
        commit: () => { half.commit(); full.commit(); outer.commit(); },
      };
    }
    case 'RMA (Running MA)':
      return taStep.rma(len);
    case 'ALMA (Arnaud Legoux MA)': {
      // ta.alma(source, look_back, 0.85, 6.0): the weights of the oakscriptjs array function
      const m = 0.85 * (len - 1);
      const sd = len / 6.0;
      const weights: number[] = [];
      let weightSum = 0;
      for (let i = 0; i < len; i++) {
        const weight = Math.exp(-1 * Math.pow(i - m, 2) / (2 * Math.pow(sd, 2)));
        weights.push(weight);
        weightSum += weight;
      }
      for (let i = 0; i < len; i++) weights[i] /= weightSum;
      return {
        step: (_v, _vol, i, src) => {
          if (i < len - 1) return NaN;
          let almaValue = 0;
          for (let j = 0; j < len; j++) almaValue += src[i - len + 1 + j] * weights[j];
          return almaValue;
        },
        commit: () => {},
      };
    }
    case 'TEMA (Triple EMA)': {
      const ema1 = taStep.ema(len);
      const ema2 = taStep.ema(len);
      const ema3 = taStep.ema(len);
      return {
        step: (v) => {
          const e1 = ema1.step(v);
          const e2 = ema2.step(e1);
          const e3 = ema3.step(e2);
          return e1 * 3 - e2 * 3 + e3;
        },
        commit: () => { ema1.commit(); ema2.commit(); ema3.commit(); },
      };
    }
    case 'DEMA (Double EMA)': {
      const ema1 = taStep.ema(len);
      const ema2 = taStep.ema(len);
      return {
        step: (v) => {
          const e1 = ema1.step(v);
          return e1 * 2 - ema2.step(e1);
        },
        commit: () => { ema1.commit(); ema2.commit(); },
      };
    }
    default: {
      // SMA, and SMMA (the Pine script uses ta.sma here)
      const sma = new WindowSma(len);
      return { step: (v) => sma.step(v), commit: () => sma.commit() };
    }
  }
}

interface RangeVars {
  /** calculate_diff_averages(diff): var sums and counts of the positive / negative diff / 100 since the first bar */
  posSum: number;
  posCount: number;
  negSum: number;
  negCount: number;
}

interface RangeRun extends BarRunState<RangeVars> {
  ma: Ma;
  src: number[];
  plots: Point[][];
}

function study(inputs: Partial<RangeChannelByAtillaYurtsevenInputs>): BarStudy<RangeRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const fin = (x: number) => (Number.isFinite(x) ? x : NaN);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: RangeRun = {
        ma: movingAverage(cfg.maType, cfg.lookBack), src: [], plots: Array.from({ length: 6 }, () => []),
        steps: [], vars: { posSum: 0.0, posCount: 0, negSum: 0.0, negCount: 0 }, lists: [], series: [],
      };
      s.steps = [s.ma];
      s.series = [s.src, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const t = b.time;
      const src = value(b);
      s.src[i] = src;
      const ma = s.ma.step(src, b.volume ?? NaN, i, s.src);
      // a plain division: ma = 0 gives +-infinity (0 / 0 na), as in Pine
      const diff = (src / ma - 1) * 100;
      const d = diff / 100;
      if (gt(d, 0)) {
        v.posSum += d;
        v.posCount += 1;
      } else if (lt(d, 0)) {
        v.negSum += d;
        v.negCount += 1;
      }
      const positiveDiff = v.posCount > 0 ? v.posSum / v.posCount : 0;
      const negativeDiff = v.negCount > 0 ? v.negSum / v.negCount : 0;

      const p = s.plots;
      p[0][i] = { time: t, value: fin(ma) };
      p[1][i] = { time: t, value: fin(ma * (1 + positiveDiff)), color: color.gray };
      p[2][i] = { time: t, value: fin(ma * (1 + negativeDiff)), color: color.gray };
      p[3][i] = { time: t, value: fin(diff), color: gt(diff, 0) ? color.green : color.red };
      p[4][i] = { time: t, value: fin(positiveDiff * 100), color: color.gray };
      p[5][i] = { time: t, value: fin(negativeDiff * 100), color: color.gray };
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice(),
          plot5: p[5].slice(),
        },
        // hline(0): Pine defaults (colour #787B86, dashed)
        hlines: [{ value: 0, options: { title: 'Zero Line', color: '#787B86', linestyle: 'dashed' } }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RangeChannelByAtillaYurtsevenInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RangeChannelByAtillaYurtsevenInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const RangeChannelByAtillaYurtseven = {
  calculate,
  createRun,
  metadata,

  defaultInputs,
  inputConfig,
  plotConfig,
};
