/**
 * Fastlane
 *
 * Marks the bars with a large move (|1-bar rate of change of the close| >= a percentage) and / or a large volume
 * (volume >= a threshold). Combined mode (default): a yellow circle below the bars where both are true. Separate
 * mode: a blue circle below the bars with a large move and a blue cross above the bars with a large volume.
 * Alert (alertcondition, `alerts` of the result): 'Fastlane', true on the bars of the yellow circles (combined mode).
 *
 * Reference: "Fastlane" by HB5
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © HB5
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface FastlaneInputs {
  /** Combine the conditions (move and volume) */
  use: boolean;
  /** Volume threshold */
  vol: number;
  /** Minimum |rate of change| of the close, in % */
  per: number;
}

export const defaultInputs: FastlaneInputs = {
  use: true,
  vol: 500000,
  per: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'use', type: 'bool', title: 'Combine the conditions?', defval: true },
  { id: 'vol', type: 'int', title: 'Volume Above', defval: 500000 },
  { id: 'per', type: 'int', title: '% check', defval: 5 },
];

// No plot(): the outputs are plotshape markers
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Fastlane',
  shortTitle: 'Fastlane',
  overlay: true,
};

/** Pine default colour of a plotshape without a colour */
const PINE_BLUE = '#2962FF';

/** Pine float comparison: a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface FastlaneRun extends BarRunState<Record<string, never>> {
  roc1: ReturnType<typeof taStep.roc>;
  markers: MarkerData[];
  fastlane: boolean[];
  times: number[][];
}

function study(inputs: Partial<FastlaneInputs>): BarStudy<FastlaneRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const yellow = String(color.new(color.yellow, 0));
  return {
    init() {
      const roc1 = taStep.roc(1);
      const s: FastlaneRun = { roc1, markers: [], fastlane: [], times: [[]], steps: [roc1], vars: {}, lists: [], series: [] };
      s.lists = [s.markers, ...s.times];
      s.series = [s.fastlane];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const roc = ge(Math.abs(s.roc1.step(b.close)), cfg.per);
      const check = ge(b.volume ?? NaN, cfg.vol);
      // alertcondition(use ? roc and check : false)
      const f = cfg.use && roc && check;
      s.fastlane[i] = f;
      if (f) s.times[0].push(b.time as number);
      if (!cfg.use) {
        // plotshape(not use ? roc : false, style = shape.circle, location = location.belowbar)
        if (roc) s.markers.push({ time: b.time, position: 'belowBar', shape: 'circle', color: PINE_BLUE, id: 'shape0' });
        // plotshape(not use ? check : false): Pine defaults, shape.xcross above the bar
        if (check) s.markers.push({ time: b.time, position: 'aboveBar', shape: 'xcross', color: PINE_BLUE, id: 'shape1' });
      } else if (roc && check) {
        // plotshape(use ? roc and check : false, style = shape.circle, color = color.new(color.yellow, 0),
        //           location = location.belowbar)
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'circle', color: yellow, id: 'shape2' });
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, [n > 0 && s.fastlane[n - 1]]),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FastlaneInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<FastlaneInputs> = {},
): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertcondition */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Fastlane', message: 'Fastlane' },
];

export const Fastlane = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
