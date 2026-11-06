/**
 * Kijun-Sen with Buy / Sell Labels
 *
 * The Kijun-Sen line (middle of the highest high and the lowest low over the base periods), green when the close is
 * above it, red when the close is below it, gray otherwise. A "B" label is drawn below the bar when the close crosses
 * over the line or a new uptrend starts; an "S" label above the bar when the close crosses under the line or a new
 * downtrend starts.
 * Alerts (alertcondition, `alerts` of the result): trend change (a new uptrend or downtrend), close crossing over /
 * under the line.
 *
 * Reference: "Kijun-Sen with Buy / Sell Labels & Alerts - Ichimoku simplified" by TaureaYinYang
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Created by TaureaYinYang
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface KijunSenWithAlertsInputs {
  /** Base periods of the Kijun-Sen */
  basePeriods: number;
}

export const defaultInputs: KijunSenWithAlertsInputs = {
  basePeriods: 26,
};

export const inputConfig: InputConfig[] = [
  { id: 'basePeriods', type: 'int', title: 'Base Periods', defval: 26 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Kijun-Sen', color: color.gray, lineWidth: 2 },
];

export const metadata = {
  title: 'Kijun-Sen with Alerts',
  shortTitle: 'Kijun-Sen with Alerts',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface KijunRun extends BarRunState<Record<string, never>> {
  hh: WindowExtreme;
  ll: WindowExtreme;
  over: ReturnType<typeof taStep.crossover>;
  under: ReturnType<typeof taStep.crossunder>;
  uptrend: boolean[];
  downtrend: boolean[];
  plot0: Point[];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
}

function study(inputs: Partial<KijunSenWithAlertsInputs>): BarStudy<KijunRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const hh = new WindowExtreme(false, cfg.basePeriods);
      const ll = new WindowExtreme(true, cfg.basePeriods);
      const over = taStep.crossover();
      const under = taStep.crossunder();
      const s: KijunRun = {
        hh, ll, over, under, uptrend: [], downtrend: [], plot0: [], flags: [[], [], []], times: [[], [], []],
        markers: [], steps: [hh, ll, over, under], vars: {}, lists: [], series: [],
      };
      s.lists = [...s.times, s.markers];
      s.series = [s.uptrend, s.downtrend, s.plot0, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const kijun = (s.hh.step(b.high) + s.ll.step(b.low)) / 2;
      const uptrend = gt(b.close, kijun);
      const downtrend = lt(b.close, kijun);
      s.uptrend[i] = uptrend;
      s.downtrend[i] = downtrend;
      // ta.crossover / ta.crossunder compare exactly
      const crossUp = s.over.step(b.close, kijun);
      const crossDown = s.under.step(b.close, kijun);
      // uptrend[1] / downtrend[1] are false on the first bar (bool history)
      const prevUp = i > 0 && s.uptrend[i - 1];
      const prevDown = i > 0 && s.downtrend[i - 1];
      // trend_change = uptrend and not uptrend[1] or downtrend and not downtrend[1]
      const trendChange = (uptrend && !prevUp) || (downtrend && !prevDown);
      // buy_signal = price_cross_up or uptrend and not uptrend[1]
      if (crossUp || (uptrend && !prevUp)) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'B',
          textColor: color.white, size: 'small' });
      }
      // sell_signal = price_cross_down or downtrend and not downtrend[1]
      if (crossDown || (downtrend && !prevDown)) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'S',
          textColor: color.white, size: 'small' });
      }
      // kijun_color = uptrend ? color.green : downtrend ? color.red : color.gray
      s.plot0[i] = { time: t, value: kijun, color: uptrend ? color.green : downtrend ? color.red : color.gray };
      const flags = [trendChange, crossUp, crossDown];
      for (let k = 0; k < 3; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(t as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<KijunSenWithAlertsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<KijunSenWithAlertsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Color Change Alert', message: 'Kijun-Sen Color Change: Trend Changed!' },
  { id: 'alert1', title: 'Price Crosses Kijun Up', message: 'Price crossed Kijun-Sen upwards!' },
  { id: 'alert2', title: 'Price Crosses Kijun Down', message: 'Price crossed Kijun-Sen downwards!' },
];

export const KijunSenWithAlerts = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
