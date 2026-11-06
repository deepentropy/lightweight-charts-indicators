/**
 * Dual Bayesian For Loop
 *
 * Loop score: the mean of +1 / -1 over i = loopStart..lookback, +1 when the source is above source[i].
 * A Bayesian update with a 0.5 prior and an evidence of 0.7 (value > 0) or 0.3 (otherwise) gives the short-term
 * probability of the loop score and the long-term probability of the SMA of the loop score over `length` bars.
 * The signal is the EMA(2) of the mean of both probabilities (in %): +1 above 50, -1 otherwise. It is drawn as
 * circles with a fill to zero, the price bars take its colour, and L / S markers show the crosses of zero.
 * Alerts (alertcondition, `alerts` of the result): 'Dual Bayesian Bullish Cross' / 'Dual Bayesian Bearish Cross', true
 * on the crosses of zero of the signal.
 *
 * Reference: "Dual Bayesian For Loop [QuantAlgo]" by QuantAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © QuantAlgo
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData, MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DualBayesianForLoopInputs {
  /** Price source */
  source: SourceType;
  /** Length of the long-term probability (SMA of the loop score) */
  length: number;
  /** First offset of the loop */
  loopstart: number;
  /** Last offset of the loop */
  lookback: number;
  bullCol: string;
  bearCol: string;
  /** Colour the price bars with the signal */
  showBars: boolean;
}

export const defaultInputs: DualBayesianForLoopInputs = {
  source: 'hlc3',
  length: 14,
  loopstart: 1,
  lookback: 70,
  bullCol: '#00ffaa',
  bearCol: '#ff0000',
  showBars: true,
};

const CORE = '════════ Core Settings ════════';
const VISUAL = '════════ Visualization Settings ════════';

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'hlc3', group: CORE },
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1, group: CORE },
  { id: 'loopstart', type: 'int', title: 'Loop Start', defval: 1, min: 1, group: CORE },
  { id: 'lookback', type: 'int', title: 'Loop Lookback', defval: 70, min: 1, group: CORE },
  { id: 'bullCol', type: 'color', title: 'Bullish Color', defval: '#00ffaa', group: VISUAL },
  { id: 'bearCol', type: 'color', title: 'Bearish Color', defval: '#ff0000', group: VISUAL },
  { id: 'showBars', type: 'bool', title: 'Color Bars', defval: true, group: VISUAL },
];

const MID_COL = String(color.new(color.white, 50));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bullish Level', color: '#00ffaa', lineWidth: 1, display: 'none' },
  { id: 'plot1', title: 'Bearish Level', color: '#ff0000', lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'Signal', color: '#00ffaa', lineWidth: 5, style: 'circles' },
  { id: 'plot3', title: 'Zero Line for Fill', color: MID_COL, lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Dual Bayesian For Loop [QuantAlgo]',
  shortTitle: 'Dual Bayesian For Loop [QuantAlgo]',
  overlay: false,
};

/** Pine a > b: a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;

/** bayesian_calc: prior 0.5, evidence 0.7 when the value is > 0 (na: 0.3) */
function bayesian(v: number): number {
  const evidence = gt(v, 0) ? 0.7 : 0.3;
  const prior = 0.5;
  return (prior * evidence) / (prior * evidence + (1 - prior) * (1 - evidence));
}

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface DbflRun extends BarRunState<Record<string, never>> {
  sma: WindowSma;
  ema: ReturnType<typeof taStep.ema>;
  src: number[];
  binary: number[];
  plots: Point[][];
  topValue: number[];
  bottomValue: number[];
  topColor: (string | null)[];
  bottomColor: (string | null)[];
  markers: MarkerData[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<DualBayesianForLoopInputs>): BarStudy<DbflRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.source);
  // forloop_analysis: for i = loopstart to lookback (a Pine for loop counts down when loopstart > lookback);
  // source[i] is na before the first bar, so the comparison is false (-1)
  const step = cfg.lookback >= cfg.loopstart ? 1 : -1;
  const count = cfg.lookback - cfg.loopstart + 1;
  const bullFill = String(color.new(cfg.bullCol, 10));
  const bearFill = String(color.new(cfg.bearCol, 10));
  return {
    fullRunReason: () => (isBarSource(cfg.source) ? null : 'source of another study'),
    init() {
      taStep.sma().step(0, cfg.length); // the length check of ta.sma
      const s: DbflRun = {
        sma: new WindowSma(cfg.length), ema: taStep.ema(2), src: [], binary: [], plots: [[], [], [], []],
        topValue: [], bottomValue: [], topColor: [], bottomColor: [], markers: [], barColors: [],
        flags: [[], []], times: [[], []], steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.sma, s.ema];
      s.lists = [s.markers, s.barColors, ...s.times];
      s.series = [s.src, s.binary, ...s.plots, s.topValue, s.bottomValue, s.topColor, s.bottomColor, ...s.flags];
      return s;
    },
    bar(s, t, bars) {
      const b = bars[t];
      const time = b.time;
      const src = s.src;
      const v = value(b);
      src[t] = v;
      let sum = 0;
      for (let i = cfg.loopstart; step > 0 ? i <= cfg.lookback : i >= cfg.lookback; i += step) {
        sum += t - i >= 0 && gt(v, src[t - i]) ? 1 : -1;
      }
      // loop start = lookback + 1: sum / 0 is +-infinity (the > 0 test uses it) or na for 0 / 0
      const loopScore = sum / count;

      // ta.sma treats +-infinity as na
      const loopSma = s.sma.step(Number.isFinite(loopScore) ? loopScore : NaN);
      const final = (bayesian(loopScore) * 100 + bayesian(loopSma) * 100) / 2;
      const signal = s.ema.step(final);
      const binary = gt(signal, 50) ? 1 : -1;
      s.binary[t] = binary;
      const sigColor = binary > 0 ? cfg.bullCol : cfg.bearCol;

      // ta.crossover(binary_signal, 0) / ta.crossunder(binary_signal, 0)
      const prev = t > 0 ? s.binary[t - 1] : NaN;
      const bull = t > 0 && binary > 0 && prev <= 0;
      const bear = t > 0 && binary < 0 && prev >= 0;
      s.flags[0][t] = bull;
      s.flags[1][t] = bear;
      if (bull) s.times[0].push(time as number);
      if (bear) s.times[1].push(time as number);
      if (bull) {
        s.markers.push({ time, position: 'belowBar', shape: 'circle', color: cfg.bullCol, text: '𝑳',
          textColor: cfg.bullCol, size: 'tiny', forceOverlay: true });
      }
      if (bear) {
        s.markers.push({ time, position: 'aboveBar', shape: 'circle', color: cfg.bearCol, text: '𝑺',
          textColor: cfg.bearCol, size: 'tiny', forceOverlay: true });
      }
      // barcolor(show_bars ? binary_signal > 0 ? bull_col : bear_col : na)
      if (cfg.showBars) s.barColors.push({ time, color: sigColor });

      s.plots[0][t] = { time, value: 1, color: cfg.bullCol };
      s.plots[1][t] = { time, value: -1, color: cfg.bearCol };
      s.plots[2][t] = { time, value: binary, color: sigColor };
      s.plots[3][t] = { time, value: 0, color: MID_COL };
      // fill(z, mid, binary > 0 ? binary : 0, binary > 0 ? 0 : binary,
      //      binary > 0 ? color.new(bull_col, 10) : na, binary > 0 ? na : color.new(bear_col, 10))
      s.topValue[t] = binary > 0 ? binary : 0;
      s.bottomValue[t] = binary > 0 ? 0 : binary;
      s.topColor[t] = binary > 0 ? bullFill : null;
      s.bottomColor[t] = binary > 0 ? null : bearFill;
    },
    result(s, bars) {
      const n = bars.length;
      const [plot0, plot1, plot2, plot3] = s.plots.map((p) => p.slice());
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0, plot1, plot2, plot3 },
        hlines: [{ value: 0, options: { title: 'Zero Line', color: MID_COL, linestyle: 'dashed', linewidth: 1 } }],
        fills: [{
          plot1: 'plot2',
          plot2: 'plot3',
          options: { title: 'Plots Background' },
          gradient: {
            topValue: s.topValue.slice(),
            bottomValue: s.bottomValue.slice(),
            topColor: s.topColor.slice(),
            bottomColor: s.bottomColor.slice(),
          },
        }],
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        // alertcondition(ta.crossover(binary_signal, 0)) / alertcondition(ta.crossunder(binary_signal, 0))
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DualBayesianForLoopInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<DualBayesianForLoopInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Dual Bayesian Bullish Cross', message: 'Dual Bayesian Bullish Cross {{exchange}}:{{ticker}}' },
  { id: 'alert1', title: 'Dual Bayesian Bearish Cross', message: 'Dual Bayesian Bearish Cross {{exchange}}:{{ticker}}' },
];

export const DualBayesianForLoop = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
