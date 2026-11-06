/**
 * Sweep Engulf CHoCH
 *
 * Three-candle entry pattern. Bullish: candle 1 is bearish, candle 2 takes out its low and closes above its close,
 * candle 3 closes above the open of candle 1. Bearish: candle 1 is bullish, candle 2 takes out its high and closes
 * above its open, candle 3 closes below the open of candle 1. Each entry draws a small triangle (below the bar for
 * bullish, above the bar for bearish).
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Entry' and 'Bearish Entry' (each with its Show input).
 * alert() calls (`alertCalls`, once per bar close) on every entry when "Enable Alerts" is on.
 *
 * Reference: "Sweep Engulf CHoCH" by gastrophollic
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertCall, MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Entry', message: 'Bullish Entry Signal Detected!' },
  { id: 'alert1', title: 'Bearish Entry', message: 'Bearish Entry Signal Detected!' },
];

/** The original makes alert() calls */
export const hasAlertFunction = true;

export interface SweepEngulfChochInputs {
  /** Show Bullish Entry */
  showBullish: boolean;
  /** Show Bearish Entry */
  showBearish: boolean;
  /** Enable Alerts: the alert() calls are made (`alertCalls`); no effect on the other outputs */
  enableAlert: boolean;
}

export const defaultInputs: SweepEngulfChochInputs = {
  showBullish: true,
  showBearish: true,
  enableAlert: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'showBullish', type: 'bool', title: 'Show Bullish Entry', defval: true },
  { id: 'showBearish', type: 'bool', title: 'Show Bearish Entry', defval: true },
  { id: 'enableAlert', type: 'bool', title: 'Enable Alerts', defval: true },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Sweep Engulf CHoCH',
  shortTitle: 'Sweep Engulf CHoCH',
  overlay: true,
};

// Pine comparison operators: a > b only when a - b > 1e-10; a comparison with na is false
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; alertCalls: AlertCall[] } & { alerts: AlertConditionState[] };

interface SweepRun extends BarRunState<Record<string, never>> {
  markers: MarkerData[];
  alertCalls: AlertCall[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<SweepEngulfChochInputs>): BarStudy<SweepRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: SweepRun = { markers: [], alertCalls: [], flags: [[], []], times: [[], []], steps: [], vars: {}, lists: [], series: [] };
      s.lists = [s.markers, s.alertCalls, ...s.times];
      s.series = [...s.flags];
      return s;
    },
    bar(s, i, bars) {
      // bars 0 and 1: close[2] / open[2] are na, every comparison is false
      if (i < 2) {
        s.flags[0][i] = false;
        s.flags[1][i] = false;
        return;
      }
      const b = bars[i];
      const b1 = bars[i - 1];
      const b2 = bars[i - 2];
      const bullishEntry = lt(b2.close, b2.open) && lt(b1.low, b2.low) && gt(b1.close, b2.close) && gt(b.close, b2.open);
      const bearishEntry = gt(b2.close, b2.open) && gt(b1.high, b2.high) && gt(b1.close, b2.open) && lt(b.close, b2.open);
      // alertcondition(showBullish and bullishEntry) / alertcondition(showBearish and bearishEntry)
      const bull = cfg.showBullish && bullishEntry;
      const bear = cfg.showBearish && bearishEntry;
      s.flags[0][i] = bull;
      s.flags[1][i] = bear;
      if (bull) s.times[0].push(b.time as number);
      if (bear) s.times[1].push(b.time as number);
      // if enableAlert: alert(..., alert.freq_once_per_bar_close) on each entry
      if (cfg.enableAlert) {
        const t = b.time as number;
        if (bullishEntry) s.alertCalls.push({ time: t, message: 'Bullish Entry Signal Detected!', freq: 'once_per_bar_close' });
        if (bearishEntry) s.alertCalls.push({ time: t, message: 'Bearish Entry Signal Detected!', freq: 'once_per_bar_close' });
      }
      // plotshape(showBullish and bullishEntry, 'Bullish Entry', location.belowbar, color.green, shape.triangleup, size.tiny)
      if (cfg.showBullish && bullishEntry) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: color.green, size: 'tiny' });
      }
      // plotshape(showBearish and bearishEntry, 'Bearish Entry', location.abovebar, color.red, shape.triangledown, size.tiny)
      if (cfg.showBearish && bearishEntry) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'tiny' });
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
        alertCalls: s.alertCalls.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SweepEngulfChochInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SweepEngulfChochInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const SweepEngulfChoch = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions, hasAlertFunction };
