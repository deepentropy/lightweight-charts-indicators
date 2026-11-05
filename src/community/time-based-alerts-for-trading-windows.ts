/**
 * Time-based Alerts for Trading Windows
 *
 * Twelve clock times (hour and minute, each with an on / off switch) read in New York time (America/New_York) or,
 * with "Use Central Time", in Chicago time (America/Chicago). A bar whose opening time has the hour and minute of an
 * odd alert (1, 3, 5, 7, 9, 11) gets a green triangle below it; a bar at the time of an even alert (2, 4, 6, 8, 10,
 * 12) gets a red triangle above it. The time zone is a fixed script value, not the exchange time zone.
 * Alerts (alertcondition, `alerts` of the result): 'Odd Time-based Alert (Green)' and 'Even Time-based Alert (Red)'
 * on the bars of the green / red triangles, and 'Alert 1' to 'Alert 12' on the bars at the time of each enabled alert.
 *
 * Reference: "Time-based Alerts for Trading Windows" by xhmxdir
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { time, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TimeBasedAlertsInputs {
  enableAlert1: boolean;
  enableAlert2: boolean;
  enableAlert3: boolean;
  enableAlert4: boolean;
  enableAlert5: boolean;
  enableAlert6: boolean;
  enableAlert7: boolean;
  enableAlert8: boolean;
  enableAlert9: boolean;
  enableAlert10: boolean;
  enableAlert11: boolean;
  enableAlert12: boolean;
  hour1: number;
  minute1: number;
  hour2: number;
  minute2: number;
  hour3: number;
  minute3: number;
  hour4: number;
  minute4: number;
  hour5: number;
  minute5: number;
  hour6: number;
  minute6: number;
  hour7: number;
  minute7: number;
  hour8: number;
  minute8: number;
  hour9: number;
  minute9: number;
  hour10: number;
  minute10: number;
  hour11: number;
  minute11: number;
  hour12: number;
  minute12: number;
  /** Read the alert times in America/Chicago instead of America/New_York */
  useCentralTime: boolean;
}

export const defaultInputs: TimeBasedAlertsInputs = {
  enableAlert1: true,
  enableAlert2: true,
  enableAlert3: true,
  enableAlert4: true,
  enableAlert5: true,
  enableAlert6: true,
  enableAlert7: true,
  enableAlert8: true,
  enableAlert9: true,
  enableAlert10: true,
  enableAlert11: true,
  enableAlert12: true,
  hour1: 15,
  minute1: 30,
  hour2: 16,
  minute2: 0,
  hour3: 17,
  minute3: 30,
  hour4: 18,
  minute4: 0,
  hour5: 19,
  minute5: 30,
  hour6: 20,
  minute6: 0,
  hour7: 21,
  minute7: 30,
  hour8: 22,
  minute8: 0,
  hour9: 23,
  minute9: 30,
  hour10: 0,
  minute10: 0,
  hour11: 1,
  minute11: 30,
  hour12: 2,
  minute12: 0,
  useCentralTime: false,
};

const ALERTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export const inputConfig: InputConfig[] = [
  ...ALERTS.map((k): InputConfig => ({ id: `enableAlert${k}`, type: 'bool', title: `Enable Alert ${k}`, defval: true })),
  ...ALERTS.flatMap((k): InputConfig[] => [
    { id: `hour${k}`, type: 'int', title: `Alert Hour ${k} (Eastern Time)`,
      defval: defaultInputs[`hour${k}` as keyof TimeBasedAlertsInputs] as number, min: 0, max: 23 },
    { id: `minute${k}`, type: 'int', title: `Alert Minute ${k}`,
      defval: defaultInputs[`minute${k}` as keyof TimeBasedAlertsInputs] as number, min: 0, max: 59 },
  ]),
  { id: 'useCentralTime', type: 'bool', title: 'Use Central Time (Exchange)', defval: false },
];

// No plot(): the outputs are two plotshape markers
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Time-based Alerts for Trading Windows',
  shortTitle: 'Time-based Alerts for Trading Windows',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface TimeAlertsRun extends BarRunState<Record<string, never>> {
  markers: MarkerData[];
  /** flags of the odd / even conditions, then of Alert 1 to Alert 12 */
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<TimeBasedAlertsInputs>): BarStudy<TimeAlertsRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const timezone = cfg.useCentralTime ? 'America/Chicago' : 'America/New_York';
  const green = String(color.green);
  const red = String(color.red);
  // enable_alertK and current_hour == i_hourK and current_minute == i_minuteK
  const at = (k: number, h: number, m: number) =>
    (cfg[`enableAlert${k}` as keyof TimeBasedAlertsInputs] as boolean)
    && h === cfg[`hour${k}` as keyof TimeBasedAlertsInputs]
    && m === cfg[`minute${k}` as keyof TimeBasedAlertsInputs];
  return {
    init() {
      const s: TimeAlertsRun = {
        markers: [], flags: Array.from({ length: 14 }, () => []), times: Array.from({ length: 14 }, () => []),
        steps: [], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = s.flags;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // current_hour = hour(time, timezone), current_minute = minute(time, timezone): bar opening time
      const ms = b.time * 1000;
      const h = time.hour(ms, timezone);
      const m = time.minute(ms, timezone);
      const isAlertOdd = at(1, h, m) || at(3, h, m) || at(5, h, m) || at(7, h, m) || at(9, h, m) || at(11, h, m);
      const isAlertEven = at(2, h, m) || at(4, h, m) || at(6, h, m) || at(8, h, m) || at(10, h, m) || at(12, h, m);
      const flag = (k: number, f: boolean) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(b.time as number);
      };
      flag(0, isAlertOdd);
      flag(1, isAlertEven);
      for (const k of ALERTS) flag(k + 1, at(k, h, m));
      if (isAlertOdd) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: green, size: 'small' });
      }
      if (isAlertEven) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: red, size: 'small' });
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TimeBasedAlertsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TimeBasedAlertsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Odd Time-based Alert (Green)', message: 'Odd time-based alert triggered! (Green)' },
  { id: 'alert1', title: 'Even Time-based Alert (Red)', message: 'Even time-based alert triggered! (Red)' },
  ...ALERTS.map((k): AlertConditionDecl => ({ id: `alert${k + 1}`, title: `Alert ${k}`, message: `Alert ${k} triggered!` })),
];

export const TimeBasedAlertsForTradingWindows = {
  calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions,
};
