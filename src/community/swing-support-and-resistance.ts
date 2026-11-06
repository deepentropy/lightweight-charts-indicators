/**
 * Swing Support and Resistance
 *
 * The resistance is the last pivot high and the support the last pivot low (`pivotLen` bars on each side). Both
 * levels are drawn as circles, shifted back by `pivotLen` bars (on the bars where the pivots are confirmed minus
 * `pivotLen`). A Buy triangle marks a close crossing above the resistance, a Sell triangle a close crossing below
 * the support.
 * Alerts (alertcondition, `alerts` of the result): 'Buy Alert' and 'Sell Alert', true on the bars of each signal.
 *
 * Reference: "Swing Support and Resistance [Vijay]" by VSB-2024
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { barInterval, barTime } from '../bar-time';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Alert', message: 'Buy: Price broke above resistance' },
  { id: 'alert1', title: 'Sell Alert', message: 'Sell: Price broke below support' },
];

export interface SwingSupportAndResistanceInputs {
  /** Pivot length (bars on each side) */
  pivotLen: number;
  showSupport: boolean;
  showResistance: boolean;
}

export const defaultInputs: SwingSupportAndResistanceInputs = {
  pivotLen: 10,
  showSupport: true,
  showResistance: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'pivotLen', type: 'int', title: 'Pivot Length', defval: 10 },
  { id: 'showSupport', type: 'bool', title: 'Show Support', defval: true },
  { id: 'showResistance', type: 'bool', title: 'Show Resistance', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Resistance', color: color.red, lineWidth: 2, style: 'circles' },
  { id: 'plot1', title: 'Support', color: color.green, lineWidth: 2, style: 'circles' },
];

export const metadata = {
  title: 'Swing Support and Resistance [Vijay]',
  shortTitle: 'Swing Signal [Vijay]',
  overlay: true,
};

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface SwingVars {
  /** var float resistance / support: the last pivot high / low */
  r: number;
  s: number;
}

interface SwingRun extends BarRunState<SwingVars> {
  ph: PivotStep;
  pl: PivotStep;
  over: ReturnType<typeof taStep.crossover>;
  under: ReturnType<typeof taStep.crossunder>;
  resistance: number[];
  support: number[];
  /** The shifted plots (a whole non-negative pivot length): the point of bar i - pivotLen, written by bar i */
  plot0: Point[];
  plot1: Point[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<SwingSupportAndResistanceInputs>): BarStudy<SwingRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.pivotLen;
  /** A shift back by a whole number of bars: each point is written by one bar; else the plots are built at the end */
  const backShift = Number.isInteger(len) && len >= 0;
  return {
    init() {
      const s: SwingRun = {
        ph: new PivotStep(len, len, true), pl: new PivotStep(len, len, false), over: taStep.crossover(),
        under: taStep.crossunder(), resistance: [], support: [], plot0: [], plot1: [], markers: [],
        flags: [[], []], times: [[], []], steps: [], vars: { r: NaN, s: NaN }, lists: [], series: [],
      };
      s.steps = [s.ph, s.pl, s.over, s.under];
      s.lists = [s.markers, ...s.times];
      s.series = [s.resistance, s.support, s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const pivotHigh = s.ph.step(i, b.high);
      const pivotLow = s.pl.step(i, b.low);
      if (!isNaN(pivotHigh)) v.r = pivotHigh;
      if (!isNaN(pivotLow)) v.s = pivotLow;
      s.resistance[i] = v.r;
      s.support[i] = v.s;

      // plot(..., offset = -pivotLen): the value of bar i is drawn on bar i - pivotLen
      if (backShift && i - len >= 0) {
        const t = bars[i - len].time;
        s.plot0[i - len] = { time: t, value: cfg.showResistance ? v.r : NaN, color: color.red };
        s.plot1[i - len] = { time: t, value: cfg.showSupport ? v.s : NaN, color: color.green };
      }

      // ta.crossover(close, resistance) / ta.crossunder(close, support)
      const buySignal = !!s.over.step(b.close, v.r);
      const sellSignal = !!s.under.step(b.close, v.s);
      const time = b.time;
      if (buySignal) {
        s.markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: color.green, text: 'Buy',
          textColor: color.green, size: 'small' });
      }
      if (sellSignal) {
        s.markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: color.red, text: 'Sell',
          textColor: color.red, size: 'small' });
      }
      s.flags[0][i] = buySignal;
      s.flags[1][i] = sellSignal;
      if (buySignal) s.times[0].push(time as number);
      if (sellSignal) s.times[1].push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      let plot0: Point[];
      let plot1: Point[];
      if (backShift) {
        plot0 = s.plot0.slice(0, Math.max(0, n - len));
        plot1 = s.plot1.slice(0, Math.max(0, n - len));
      } else {
        // a shift forward (times after the last bar) or a fractional one (no point)
        const interval = barInterval(bars);
        const shifted = (vals: number[], show: boolean, col: string) => {
          const out: Point[] = [];
          for (let i = 0; i < n; i++) {
            const t = barTime(bars, i - len, interval);
            if (isNaN(t)) continue;
            out.push({ time: t, value: show ? vals[i] : NaN, color: col });
          }
          return out;
        };
        plot0 = shifted(s.resistance, cfg.showResistance, color.red);
        plot1 = shifted(s.support, cfg.showSupport, color.green);
      }
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0, plot1 },
        markers: s.markers.slice(),
        // alertcondition(buySignal, 'Buy Alert') / alertcondition(sellSignal, 'Sell Alert')
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SwingSupportAndResistanceInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SwingSupportAndResistanceInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const SwingSupportAndResistance = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
