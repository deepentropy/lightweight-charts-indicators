/**
 * Perforance integral
 *
 * For each of the last `length` bars (i = 0 = current bar) a performance: (open - close) / open for i = 0, else
 * (close - close[i]) / close[i] / (i + 1), and a volatility: |true range[i]| / close[i]. The indicator is the EMA of
 * the weighted sum of performance / volatility, with a weight that goes linearly from `weight newest` (i = 0) to
 * `weight on middle` (i = position of middle), then from `weight on middle` with the slope towards `weight oldest`
 * (the original formula uses (i - weight on middle) after the middle). The line is green after a cross above the
 * upper threshold and red after a cross under the lower threshold. A second plot is the sum of the volatilities.
 *
 * Reference: "Perforance integral" by Majimbi
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Majimbi
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PerforanceIntegralInputs {
  /** Number of bars of the calculation */
  length: number;
  /** Weight of the oldest bar */
  weightStart: number;
  /** Weight at the middle position */
  weightMiddle: number;
  /** Middle position (bars back) */
  positionMiddle: number;
  /** Weight of the newest bar */
  weightEnd: number;
  upperThreshold: number;
  lowerThreshold: number;
  /** EMA length of the weighted sum */
  emaLength: number;
}

export const defaultInputs: PerforanceIntegralInputs = {
  length: 50,
  weightStart: 1.0,
  weightMiddle: 1.0,
  positionMiddle: 25,
  weightEnd: 1.0,
  upperThreshold: 1.5,
  lowerThreshold: -1.5,
  emaLength: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length of calculation', defval: 50 },
  { id: 'weightStart', type: 'float', title: 'weight oldest', defval: 1.0, step: 0.05 },
  { id: 'weightMiddle', type: 'float', title: 'weight on middle', defval: 1.0, step: 0.05 },
  { id: 'positionMiddle', type: 'int', title: 'position of midle', defval: 25 },
  { id: 'weightEnd', type: 'float', title: 'weight newest', defval: 1.0, step: 0.05 },
  { id: 'upperThreshold', type: 'float', title: 'upper threshold', defval: 1.5, step: 0.1 },
  { id: 'lowerThreshold', type: 'float', title: 'lower threshold', defval: -1.5, step: 0.1 },
  { id: 'emaLength', type: 'int', title: 'ema length', defval: 2, step: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'indicator', color: color.red, lineWidth: 1 },
  { id: 'plot1', title: 'vol', color: color.blue, lineWidth: 1 },
];

export const metadata = {
  title: 'Perforance integral',
  shortTitle: 'Iperf',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };

interface PerfVars {
  /** var trend_1 */
  trend: number;
}

interface PerfRun extends BarRunState<PerfVars> {
  trStep: ReturnType<typeof taStep.tr>;
  ema: ReturnType<typeof taStep.ema>;
  up: ReturnType<typeof taStep.crossover>;
  down: ReturnType<typeof taStep.crossunder>;
  tr: number[];
  close: number[];
  plot0: Point[];
  plot1: Point[];
}

function study(inputs: Partial<PerforanceIntegralInputs>): BarStudy<PerfRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, weightStart, weightMiddle, positionMiddle, weightEnd } = cfg;
  const performance: number[] = new Array(length);
  const volatility: number[] = new Array(length);
  const fin = (x: number) => (Number.isFinite(x) ? x : NaN);
  return {
    init() {
      const trStep = taStep.tr(true);
      const ema = taStep.ema(cfg.emaLength);
      const up = taStep.crossover();
      const down = taStep.crossunder();
      const s: PerfRun = {
        trStep, ema, up, down, tr: [], close: [], plot0: [], plot1: [],
        steps: [trStep, ema, up, down], vars: { trend: 0 }, lists: [], series: [],
      };
      s.series = [s.tr, s.close, s.plot0, s.plot1];
      return s;
    },
    bar(s, bar, bars) {
      // `for i = 0 to length_h - 1` counts down when length_h < 1: open[-1] is a Pine runtime error on the first bar
      if (length < 1) {
        throw new Error('The script attempts to reference historical data that is too far from the current bar (-1 bars '
          + 'back). The history-referencing length for the expression must be a value between 0 and 10000.');
      }
      const b = bars[bar];
      // ta.tr(true) is called in a loop; it has the same value on every call of a bar, so tr[i] is the true range of
      // bar - i (high - low on the first bar)
      const tr = s.tr;
      const close = s.close;
      tr[bar] = s.trStep.step(b.high, b.low, b.close);
      close[bar] = b.close;
      const at = (a: number[], j: number) => (j >= 0 ? a[j] : NaN);
      for (let i = 0; i < length; i++) {
        // Plain divisions: x / 0 is +-infinity, 0 / 0 is na
        performance[i] = i === 0
          ? (b.open - b.close) / b.open
          : (close[bar] - at(close, bar - i)) / at(close, bar - i) / (i + 1);
        volatility[i] = Math.abs(at(tr, bar - i)) / at(close, bar - i);
      }
      let v = 0.0;
      for (let i = 0; i < length; i++) v = v + volatility[i];
      let sum = 0.0;
      for (let i = 0; i < length; i++) {
        if (i <= positionMiddle) {
          sum = sum + (performance[i] * (((weightMiddle - weightEnd) / positionMiddle) * i + weightEnd)) / volatility[i];
        } else {
          sum = sum + (performance[i] * (((weightStart - weightMiddle) / positionMiddle) * (i - weightMiddle) + weightMiddle))
            / volatility[i];
        }
      }

      // sum_ratio := ta.ema(sum_ratio, ema_v): ta.ema skips the na / infinite values as Pine
      const sumRatio = s.ema.step(sum);
      const up = s.up.step(sumRatio, cfg.upperThreshold);
      const down = s.down.step(sumRatio, cfg.lowerThreshold);
      if (up) s.vars.trend = 1;
      if (down) s.vars.trend = -1;
      s.plot0[bar] = { time: b.time, value: fin(sumRatio), color: s.vars.trend > 0 ? color.green : color.red };
      s.plot1[bar] = { time: b.time, value: fin(v) };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        hlines: [
          { value: cfg.upperThreshold, options: { title: 'lower threshold', color: String(color.rgb(30, 148, 245, 50)), linestyle: 'solid' } },
          { value: cfg.lowerThreshold, options: { title: 'upper threshold', color: String(color.rgb(252, 153, 4, 50)), linestyle: 'solid' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PerforanceIntegralInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PerforanceIntegralInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const PerforanceIntegral = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
