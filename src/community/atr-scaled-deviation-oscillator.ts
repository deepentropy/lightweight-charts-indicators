/**
 * ATR-Scaled Deviation Oscillator
 *
 * The momentum close - close[len] is divided by its root mean square over the last `devLen` bars, scaled by the ATR
 * ratio: dev = sqrt(sum(mom^2) / devLen), atrRatio = atr / sma(atr, atrLen) * atrMult (1 when the ATR average is 0),
 * osc = mom / (dev / atrRatio). The oscillator is the EMA(2) of osc. A cross above the upper threshold sets the trend
 * to long, a cross below the lower threshold to short. The area between zero and the oscillator is blue (trend >= 0)
 * or red, and the price candles are drawn in the trend colour on the price pane.
 * Alerts (alertcondition, `alerts` of the result): 'ATR-DevOsc Long' on a cross above the upper threshold,
 * 'ATR-DevOsc Short' on a cross below the lower threshold.
 *
 * Reference: "ATR-Scaled Deviation Oscillator" by C_H_I_P_A
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { PlotCandleData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface AtrScaledDeviationOscillatorInputs {
  /** Momentum length: close - close[len] */
  len: number;
  /** Number of momentum values in the deviation */
  devLen: number;
  /** Upper threshold (a cross above it starts a long trend) */
  upper: number;
  /** Lower threshold (a cross below it starts a short trend) */
  lower: number;
  /** ATR length (also the length of the ATR average) */
  atrLen: number;
  /** ATR reaction multiplier */
  atrMult: number;
}

export const defaultInputs: AtrScaledDeviationOscillatorInputs = {
  len: 20,
  devLen: 20,
  upper: 1.0,
  lower: -1.0,
  atrLen: 14,
  atrMult: 1.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Momentum Length', defval: 20, min: 1 },
  { id: 'devLen', type: 'int', title: 'Deviation Length', defval: 20, min: 1 },
  { id: 'upper', type: 'float', title: 'Upper Threshold', defval: 1.0, step: 0.2 },
  { id: 'lower', type: 'float', title: 'Lower Threshold', defval: -1.0, step: 0.2 },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 14, min: 1 },
  { id: 'atrMult', type: 'float', title: 'ATR Reaction Multiplier', defval: 1.5, step: 0.1 },
];

const ZERO_COL = String(color.new(color.gray, 50));
const OSC_COL = '#2962FF';
const LONG_COL = String(color.new(color.rgb(0, 180, 255), 40));
const SHORT_COL = String(color.new(color.rgb(255, 80, 60), 40));
const FILL_LONG = String(color.new(color.rgb(0, 180, 255), 70));
const FILL_SHORT = String(color.new(color.rgb(255, 80, 60), 70));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Zero Line', color: ZERO_COL, lineWidth: 1 },
  { id: 'plot1', title: 'Oscillator', color: OSC_COL, lineWidth: 2 },
];

export const metadata = {
  title: 'ATR-Scaled Deviation Oscillator',
  shortTitle: 'ATR-DevOsc',
  overlay: false,
};

/** Pine `==`: equal within 1e-10 (false with na) */
const eq = (a: number, b: number) => Math.abs(a - b) <= 1e-10;

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> } & { alerts: AlertConditionState[] };

interface DevOscRun extends BarRunState<{ trend: number }> {
  atr: ReturnType<typeof taStep.atr>;
  atrAvg: WindowSma;
  ema: ReturnType<typeof taStep.ema>;
  longX: ReturnType<typeof taStep.crossover>;
  shortX: ReturnType<typeof taStep.crossunder>;
  plot0: Point[];
  plot1: Point[];
  fillColors: string[];
  candles: PlotCandleData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<AtrScaledDeviationOscillatorInputs>): BarStudy<DevOscRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { len, devLen, upper, lower, atrLen, atrMult } = cfg;
  return {
    init() {
      const atr = taStep.atr(atrLen);
      const atrAvg = new WindowSma(atrLen);
      const ema = taStep.ema(2);
      const longX = taStep.crossover();
      const shortX = taStep.crossunder();
      const s: DevOscRun = {
        atr, atrAvg, ema, longX, shortX, plot0: [], plot1: [], fillColors: [], candles: [], flags: [[], []], times: [[], []],
        // var int Trend = 0
        steps: [atr, atrAvg, ema, longX, shortX], vars: { trend: 0 }, lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [s.plot0, s.plot1, s.fillColors, s.candles, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const at = (j: number) => (j >= 0 ? bars[j].close : NaN);
      const atrVal = s.atr.step(b.high, b.low, b.close);
      const atrAvg = s.atrAvg.step(atrVal);
      const currMom = at(i) - at(i - len);
      // sumSq := 0.0; for k = 0 to devLen - 1: sumSq += (src[k] - src[k + len])^2 (na once a value is na)
      let sumSq = 0.0;
      for (let k = 0; k <= devLen - 1; k++) {
        const delta = at(i - k) - at(i - k - len);
        sumSq += delta * delta;
      }
      const dev = Math.sqrt(sumSq / devLen);
      const atrRatio = eq(atrAvg, 0) ? 1 : (atrVal / atrAvg) * atrMult;
      // Plain divisions: x / 0 is +-infinity (0 / 0 NaN), as in Pine
      const devAdj = dev / atrRatio;
      const osc = currMom / (eq(devAdj, 0) ? 1 : devAdj);
      const smoothOsc = s.ema.step(osc);
      const longSignal = s.longX.step(smoothOsc, upper);
      const shortSignal = s.shortX.step(smoothOsc, lower);

      if (longSignal) s.vars.trend = 1;
      else if (shortSignal) s.vars.trend = -1;
      const trend = s.vars.trend;
      const coloring = trend === 1 ? LONG_COL : trend === -1 ? SHORT_COL : 'transparent';
      s.plot0[i] = { time: b.time, value: 0, color: ZERO_COL };
      s.plot1[i] = { time: b.time, value: Number.isFinite(smoothOsc) ? smoothOsc : NaN, color: OSC_COL };
      // fill(zeroPlot, oscPlot, color = Trend >= 0 ? color.new(rgb(0, 180, 255), 70) : color.new(rgb(255, 80, 60), 70))
      s.fillColors[i] = trend >= 0 ? FILL_LONG : FILL_SHORT;
      // plotcandle(open, high, low, close, color / bordercolor / wickcolor = coloring, force_overlay = true)
      s.candles[i] = { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, color: coloring,
        borderColor: coloring, wickColor: coloring, forceOverlay: true };
      // alertcondition(longSignal, ...) / alertcondition(shortSignal, ...)
      s.flags[0][i] = !!longSignal;
      s.flags[1][i] = !!shortSignal;
      if (longSignal) s.times[0].push(b.time as number);
      if (shortSignal) s.times[1].push(b.time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        // hline(upper) / hline(lower): default colour and style
        hlines: [
          { value: upper, options: { title: 'Upper Threshold', color: '#787B86', linestyle: 'dashed' } },
          { value: lower, options: { title: 'Lower Threshold', color: '#787B86', linestyle: 'dashed' } },
        ],
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { title: 'Plots Background' }, colors: s.fillColors.slice() }],
        plotCandles: { trendCandles: s.candles.slice() },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AtrScaledDeviationOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AtrScaledDeviationOscillatorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'ATR-DevOsc Long', message: 'ATR-DevOsc: Long signal on {{ticker}} at {{close}}' },
  { id: 'alert1', title: 'ATR-DevOsc Short', message: 'ATR-DevOsc: Short signal on {{ticker}} at {{close}}' },
];

export const AtrScaledDeviationOscillator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
