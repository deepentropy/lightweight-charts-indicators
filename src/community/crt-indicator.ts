/**
 * CRT indicator (Candle Range Trading)
 *
 * Two-candle patterns. Bearish CRT: a bullish candle, then a bearish candle with a higher high and a higher low
 * that closes inside the first candle body (between its open and its high). Bullish CRT: a bearish candle, then a
 * bullish candle with a lower low that closes between the first candle low and its open. Triangles mark the
 * patterns; on a pattern bar the CRT High / CRT Low plots show the high / low of the two candles.
 * Alerts (alertcondition, `alerts` of the result): 'Bullish CRT Alert' and 'Bearish CRT Alert', true on the bars of
 * each pattern.
 *
 * Reference: "CRT indicator" by INTELA
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CrtIndicatorInputs {
  /** Show the CRT High / CRT Low plots */
  showBox: boolean;
}

export const defaultInputs: CrtIndicatorInputs = {
  showBox: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'showBox', type: 'bool', title: 'Show CRT High/Low', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'CRT High', color: color.gray, lineWidth: 1, style: 'linebr' },
  { id: 'plot1', title: 'CRT Low', color: color.gray, lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'CRT indicator',
  shortTitle: 'CRT indicator',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface CrtRun extends BarRunState<Record<string, never>> {
  markers: MarkerData[];
  plot0: { time: Bar['time']; value: number }[];
  plot1: { time: Bar['time']; value: number }[];
  bullFlags: boolean[];
  bearFlags: boolean[];
}

function study(inputs: Partial<CrtIndicatorInputs>): BarStudy<CrtRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: CrtRun = { markers: [], plot0: [], plot1: [], bullFlags: [], bearFlags: [], steps: [], vars: {}, lists: [], series: [] };
      s.lists = [s.markers];
      s.series = [s.plot0, s.plot1, s.bullFlags, s.bearFlags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // open[1] ... low[1] are na on the first bar: every comparison with them is false
      const p = i > 0 ? bars[i - 1] : { open: NaN, high: NaN, low: NaN, close: NaN };
      const bearishCRT = gt(p.close, p.open) && lt(b.close, b.open) && gt(b.high, p.high) && lt(b.close, p.high)
        && gt(b.close, p.open) && gt(b.low, p.low);
      const bullishCRT = lt(p.close, p.open) && gt(b.close, b.open) && lt(b.low, p.low) && ge(b.close, p.low)
        && lt(b.close, p.open);
      s.bullFlags[i] = bullishCRT;
      s.bearFlags[i] = bearishCRT;
      if (bullishCRT) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: color.green, size: 'small' });
      }
      if (bearishCRT) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'small' });
      }
      let boxHigh = NaN;
      let boxLow = NaN;
      if (cfg.showBox && (bullishCRT || bearishCRT)) {
        boxHigh = Math.max(b.high, p.high);
        boxLow = Math.min(b.low, p.low);
      }
      s.plot0[i] = { time: b.time, value: boxHigh };
      s.plot1[i] = { time: b.time, value: boxLow };
    },
    result(s, bars) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        markers: s.markers.slice(),
        // alertcondition(bullishCRT, 'Bullish CRT Alert') / alertcondition(bearishCRT, 'Bearish CRT Alert')
        alerts: alertStates(alertConditions, bars, [s.bullFlags, s.bearFlags]),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CrtIndicatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<CrtIndicatorInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish CRT Alert', message: 'Bullish CRT Pattern Detected' },
  { id: 'alert1', title: 'Bearish CRT Alert', message: 'Bearish CRT Pattern Detected' },
];

export const CrtIndicator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
