/**
 * SPX500 Quick Drop & Rise Alerts
 *
 * The percent change of the close over a number of bars, 100 * (close - close[lookback]) / close[lookback]. A change
 * at or below -threshold draws a red circle at the top of the chart (quick drop), a change at or above +threshold a
 * green circle at the bottom (quick rise).
 * Alerts (alertcondition, `alerts` of the result): 'Quick Price Drop' and 'Quick Price Rise', true on the bars of the
 * circles.
 *
 * Reference: "SPX500 Quick Drop & Rise Alerts" by PaperChains
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface Spx500QuickDropRiseAlertsInputs {
  /** Drop Threshold (%) */
  dropThreshold: number;
  /** Lookback Bars */
  lookbackBars: number;
}

export const defaultInputs: Spx500QuickDropRiseAlertsInputs = {
  dropThreshold: 0.05,
  lookbackBars: 1,
};

export const inputConfig: InputConfig[] = [
  { id: 'dropThreshold', type: 'float', title: 'Drop Threshold (%)', defval: 0.05, min: 0.001, step: 0.001 },
  { id: 'lookbackBars', type: 'int', title: 'Lookback Bars', defval: 1, min: 1 },
];

// No plot(): the outputs are plotshape circles
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'SPX500 Quick Drop & Rise Alerts',
  shortTitle: 'SPX500 Quick Drop & Rise Alerts',
  overlay: true,
};

/** Pine float comparisons: a == b within 1e-10; na compares false */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface Spx500Run extends BarRunState<Record<string, never>> {
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<Spx500QuickDropRiseAlertsInputs>): BarStudy<Spx500Run, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: Spx500Run = { markers: [], flags: [[], []], times: [[], []], steps: [], vars: {}, lists: [], series: [] };
      s.lists = [s.markers, ...s.times];
      s.series = [...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const pastPrice = i - cfg.lookbackBars >= 0 ? bars[i - cfg.lookbackBars].close : NaN;
      // a non-zero x / 0 is +-infinity in Pine, compared as it is by >= / <=
      const changePct = (100 * (b.close - pastPrice)) / pastPrice;

      const dropCondition = le(changePct, -cfg.dropThreshold);
      const riseCondition = ge(changePct, cfg.dropThreshold);

      // plotshape(dropCondition, "Quick Drop", location.top, color.red, shape.circle, size.tiny)
      if (dropCondition) {
        s.markers.push({ time: b.time, position: 'top', shape: 'circle', color: color.red, size: 'tiny' });
      }
      // plotshape(riseCondition, "Quick Rise", location.bottom, color.green, shape.circle, size.tiny)
      if (riseCondition) {
        s.markers.push({ time: b.time, position: 'bottom', shape: 'circle', color: color.green, size: 'tiny' });
      }
      [dropCondition, riseCondition].forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(b.time as number);
      });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        // alertcondition(dropCondition, "Quick Price Drop") / alertcondition(riseCondition, "Quick Price Rise")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<Spx500QuickDropRiseAlertsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<Spx500QuickDropRiseAlertsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions (the {{...}} placeholders are kept as the original writes them) */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Quick Price Drop', message: 'SPX500 dropped more than {{dropThreshold}}% in {{lookbackBars}} bars!' },
  { id: 'alert1', title: 'Quick Price Rise', message: 'SPX500 rose more than {{dropThreshold}}% in {{lookbackBars}} bars!' },
];

export const Spx500QuickDropRiseAlerts = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
