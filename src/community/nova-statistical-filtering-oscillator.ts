/**
 * Nova Statistical Filtering Oscillator
 *
 * Z-score of the close over `length` bars ((close - SMA) / stdev, 0 on a zero stdev), smoothed by a TEMA
 * (3 * (ema1 - ema2) + ema3). Dynamic bands at +-mult * stdev of the smoothed z-score over `length` bars. The line
 * and histogram take a bear-to-bull gradient colour from the lower to the upper band; a gradient fill to zero.
 * Circles mark crosses of the oscillator above the lower band (buy) and below the upper band (sell).
 *
 * Alerts (alertcondition, `alerts` of the result): "Buy Signal" and "Sell Signal" (the crosses of the circles).
 *
 * Reference: "Nova Statistical Filtering Oscillator [Pineify]" by Pineify
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Pineify
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertcondition() calls, in declaration order */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Signal', message: 'Bullish momentum is returning from an oversold statistical extreme.' },
  { id: 'alert1', title: 'Sell Signal', message: 'Bearish momentum is returning from an overbought statistical extreme.' },
];

export interface NovaStatisticalFilteringOscillatorInputs {
  /** Statistical window (mean and stdev of the z-score, stdev of the bands) */
  lengthInput: number;
  /** TEMA smoothing length */
  smoothInput: number;
  /** Bands multiplier */
  multInput: number;
  bullColor: string;
  bearColor: string;
}

export const defaultInputs: NovaStatisticalFilteringOscillatorInputs = {
  lengthInput: 20,
  smoothInput: 10,
  multInput: 2.0,
  bullColor: '#089981',
  bearColor: '#F23645',
};

export const inputConfig: InputConfig[] = [
  { id: 'lengthInput', type: 'int', title: 'Statistical Window', defval: 20, min: 2 },
  { id: 'smoothInput', type: 'int', title: 'Smoothing Length', defval: 10, min: 1 },
  { id: 'multInput', type: 'float', title: 'Bands Multiplier', defval: 2.0, min: 0.5, step: 0.5 },
  { id: 'bullColor', type: 'color', title: 'Bullish Color', defval: '#089981' },
  { id: 'bearColor', type: 'color', title: 'Bearish Color', defval: '#F23645' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Band', color: String(color.new('#F23645', 50)), lineWidth: 1 },
  { id: 'plot1', title: 'Lower Band', color: String(color.new('#089981', 50)), lineWidth: 1 },
  { id: 'plot2', title: 'Baseline', color: String(color.new(color.gray, 50)), lineWidth: 1 },
  { id: 'plot3', title: 'Nova Oscillator', color: '#089981', lineWidth: 2 },
  { id: 'plot4', title: 'Histogram', color: String(color.new('#089981', 70)), lineWidth: 1, style: 'histogram' },
];

export const metadata = {
  title: 'Nova Statistical Filtering Oscillator [Pineify]',
  shortTitle: 'Pineify - NSFO',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false); a == b within 1e-10 */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface NovaRun extends BarRunState<Record<string, never>> {
  /** ta.sma(close, length) and ta.stdev(close, length) share the window sum of the closes (the same doubles) */
  sum: ReturnType<typeof taStep.sum>;
  squares: ReturnType<typeof taStep.sum>;
  ema1: ReturnType<typeof taStep.ema>;
  ema2: ReturnType<typeof taStep.ema>;
  ema3: ReturnType<typeof taStep.ema>;
  bandSd: ReturnType<typeof taStep.stdev>;
  bull: ReturnType<typeof taStep.crossover>;
  bear: ReturnType<typeof taStep.crossunder>;
  plots: Point[][];
  topValue: number[];
  bottomValue: number[];
  topColor: string[];
  bottomColor: string[];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
}

function study(inputs: Partial<NovaStatisticalFilteringOscillatorInputs>): BarStudy<NovaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const upCol = String(color.new(cfg.bearColor, 50));
  const loCol = String(color.new(cfg.bullColor, 50));
  const baseCol = String(color.new(color.gray, 50));
  const bull50 = String(color.new(cfg.bullColor, 50));
  const bull100 = String(color.new(cfg.bullColor, 100));
  const bear50 = String(color.new(cfg.bearColor, 50));
  const bear100 = String(color.new(cfg.bearColor, 100));
  return {
    init() {
      const s: NovaRun = {
        sum: taStep.sum(), squares: taStep.sum(),
        ema1: taStep.ema(cfg.smoothInput), ema2: taStep.ema(cfg.smoothInput), ema3: taStep.ema(cfg.smoothInput),
        bandSd: taStep.stdev(), bull: taStep.crossover(), bear: taStep.crossunder(),
        plots: [[], [], [], [], []], topValue: [], bottomValue: [], topColor: [], bottomColor: [],
        flags: [[], []], times: [[], []], markers: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.sum, s.squares, s.ema1, s.ema2, s.ema3, s.bandSd, s.bull, s.bear];
      s.lists = [s.markers, ...s.times];
      s.series = [...s.plots, s.topValue, s.bottomValue, s.topColor, s.bottomColor, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const { time, close: c } = bars[i];
      // zScore = stdevPrice == 0 ? 0 : (close - meanPrice) / stdevPrice
      // ta.sma: sum / length; ta.stdev: sqrt(sumSq / length - mean * mean), 0 when not positive
      const len = Math.floor(cfg.lengthInput);
      const mean = s.sum.step(c, len) / len;
      const variance = s.squares.step(isNaN(c) ? NaN : c * c, len) / len - mean * mean;
      const sd = Number.isNaN(variance) ? NaN : variance > 0 ? Math.sqrt(variance) : 0;
      const z = eq(sd, 0) ? 0 : (c - mean) / sd;

      // tema(src, len) => 3 * (ema1 - ema2) + ema3
      const ema1 = s.ema1.step(z);
      const ema2 = s.ema2.step(ema1);
      const ema3 = s.ema3.step(ema2);
      const sm = 3 * (ema1 - ema2) + ema3;

      const bandSd = s.bandSd.step(sm, cfg.lengthInput);
      const upper = bandSd * cfg.multInput;
      const lower = -bandSd * cfg.multInput;

      const oscColor = String(color.from_gradient(sm, lower, upper, cfg.bearColor, cfg.bullColor));
      s.plots[0][i] = { time, value: upper, color: upCol };
      s.plots[1][i] = { time, value: lower, color: loCol };
      s.plots[2][i] = { time, value: 0, color: baseCol };
      s.plots[3][i] = { time, value: sm, color: oscColor };
      s.plots[4][i] = { time, value: sm, color: String(color.new(oscColor, 70)) };

      // fill(oscPlot, baseline, math.max(s, 0), math.min(s, 0), s > 0 ? color.new(bullColor, 50) : color.new(bearColor, 100),
      //      s > 0 ? color.new(bullColor, 100) : color.new(bearColor, 50))
      s.topValue[i] = isNaN(sm) ? NaN : Math.max(sm, 0);
      s.bottomValue[i] = isNaN(sm) ? NaN : Math.min(sm, 0);
      s.topColor[i] = gt(sm, 0) ? bull50 : bear100;
      s.bottomColor[i] = gt(sm, 0) ? bull100 : bear50;

      // bullSignal = ta.crossover(smoothedStat, lowerBand); bearSignal = ta.crossunder(smoothedStat, upperBand)
      const bull = s.bull.step(sm, lower);
      const bear = s.bear.step(sm, upper);
      // plotshape(bullSignal ? smoothedStat : na, "Buy Signal", shape.circle, location.absolute, bullColor, size = size.tiny)
      if (bull && !isNaN(sm)) {
        s.markers.push({ time, position: 'atPriceMiddle', price: sm, shape: 'circle', color: cfg.bullColor, size: 'tiny', id: 'shape0' });
      }
      if (bear && !isNaN(sm)) {
        s.markers.push({ time, position: 'atPriceMiddle', price: sm, shape: 'circle', color: cfg.bearColor, size: 'tiny', id: 'shape1' });
      }
      s.flags[0][i] = bull;
      s.flags[1][i] = bear;
      if (bull) s.times[0].push(time as number);
      if (bear) s.times[1].push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice(), plot3: s.plots[3].slice(),
          plot4: s.plots[4].slice(),
        },
        fills: [{
          plot1: 'plot3', plot2: 'plot2',
          gradient: {
            topValue: s.topValue.slice(), bottomValue: s.bottomValue.slice(), topColor: s.topColor.slice(),
            bottomColor: s.bottomColor.slice(),
          },
        }],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<NovaStatisticalFilteringOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<NovaStatisticalFilteringOscillatorInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const NovaStatisticalFilteringOscillator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
