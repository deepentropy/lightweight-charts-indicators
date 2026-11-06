/**
 * EMA + RSI Autotrade Webhook
 *
 * A fast and a slow EMA of the close and the RSI of the close. A long entry (green triangle below the bar) is a
 * crossover of the fast EMA above the slow EMA with the RSI above the long threshold; a short entry (red triangle
 * above the bar) is a crossunder with the RSI below the short threshold.
 * Alerts (alertcondition, `alerts` of the result): 'LONG Entry' and 'SHORT Entry', true on the entry bars.
 *
 * Reference: "EMA + RSI Autotrade Webhook - Varun" by varuns_back
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface EmaRsiAutotradeWebhookVarunInputs {
  /** Fast EMA length */
  emaFast: number;
  /** Slow EMA length */
  emaSlow: number;
  /** RSI length */
  rsiLength: number;
  /** RSI level a long entry must be above */
  rsiLong: number;
  /** RSI level a short entry must be below */
  rsiShort: number;
}

export const defaultInputs: EmaRsiAutotradeWebhookVarunInputs = {
  emaFast: 9,
  emaSlow: 21,
  rsiLength: 14,
  rsiLong: 52,
  rsiShort: 48,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaFast', type: 'int', title: 'Fast EMA', defval: 9, min: 1 },
  { id: 'emaSlow', type: 'int', title: 'Slow EMA', defval: 21, min: 1 },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'rsiLong', type: 'int', title: 'RSI Long Threshold', defval: 52, min: 1, max: 100 },
  { id: 'rsiShort', type: 'int', title: 'RSI Short Threshold', defval: 48, min: 1, max: 100 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA 9', color: color.blue, lineWidth: 2 },
  { id: 'plot1', title: 'EMA 21', color: color.red, lineWidth: 2 },
];

export const metadata = {
  title: 'EMA + RSI Autotrade Webhook',
  shortTitle: 'EMA + RSI Autotrade Webhook',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number };

interface ErVars {
  /** The values of the last bar where both EMAs were not na */
  prevA: number;
  prevB: number;
}

interface ErRun extends BarRunState<ErVars> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  rsi: ReturnType<typeof taStep.rsi>;
  plot0: Point[];
  plot1: Point[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<EmaRsiAutotradeWebhookVarunInputs>): BarStudy<ErRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const fast = taStep.ema(cfg.emaFast);
      const slow = taStep.ema(cfg.emaSlow);
      const rsi = taStep.rsi(cfg.rsiLength);
      const s: ErRun = {
        fast, slow, rsi, plot0: [], plot1: [], markers: [], flags: [[], []], times: [[], []],
        steps: [fast, slow, rsi], vars: { prevA: NaN, prevB: NaN }, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i]!;
      const v = s.vars;
      const c = bar.close;
      const a = s.fast.step(c);
      const b = s.slow.step(c);
      const rsi = s.rsi.step(c);
      // ta.crossover / ta.crossunder compare exactly, with the last bar where both values were not na
      const valid = !isNaN(a) && !isNaN(b);
      const bullCross = valid && !isNaN(v.prevA) && a > b && v.prevA <= v.prevB;
      const bearCross = valid && !isNaN(v.prevA) && a < b && v.prevA >= v.prevB;
      if (valid) {
        v.prevA = a;
        v.prevB = b;
      }
      // longEntry = bullCross and rsi > rsi_long; shortEntry = bearCross and rsi < rsi_short
      const longEntry = bullCross && gt(rsi, cfg.rsiLong);
      const shortEntry = bearCross && gt(cfg.rsiShort, rsi);
      s.flags[0]![i] = longEntry;
      s.flags[1]![i] = shortEntry;
      if (longEntry) {
        s.times[0]!.push(bar.time as number);
        s.markers.push({ time: bar.time, position: 'belowBar', shape: 'triangleUp', color: color.green, size: 'small' });
      }
      if (shortEntry) {
        s.times[1]!.push(bar.time as number);
        s.markers.push({ time: bar.time, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'small' });
      }
      s.plot0[i] = { time: bar.time as number, value: a };
      s.plot1[i] = { time: bar.time as number, value: b };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        markers: s.markers.slice(),
        // alertcondition(longEntry, "LONG Entry") / alertcondition(shortEntry, "SHORT Entry")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EmaRsiAutotradeWebhookVarunInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<EmaRsiAutotradeWebhookVarunInputs> = {},
): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'LONG Entry', message: 'Entry LONG {{ticker}} @ {{close}}' },
  { id: 'alert1', title: 'SHORT Entry', message: 'Entry SHORT {{ticker}} @ {{close}}' },
];

export const EmaRsiAutotradeWebhookVarun = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
