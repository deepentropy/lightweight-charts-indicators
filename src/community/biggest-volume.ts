/**
 * Biggest Volume
 *
 * Volume histogram. A bar whose volume equals the highest volume of the last `accuracy` bars is cyan, the other
 * bars are grey.
 * Alert (alertcondition, `alerts` of the result): 'Big Volume', true on those bars when "Enable Alert" is on.
 *
 * Reference: "Biggest Volume" by mikhail_marka
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © mikhail_marka
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface BiggestVolumeInputs {
  /** Lookback length of the highest volume */
  accuracy: number;
  /** Enable the "Big Volume" alert (alerts only, no drawn output) */
  alertSwitch: boolean;
}

export const defaultInputs: BiggestVolumeInputs = {
  accuracy: 14,
  alertSwitch: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'accuracy', type: 'int', title: 'Accuracy', defval: 14 },
  { id: 'alertSwitch', type: 'bool', title: 'Enable Alert', defval: true },
];

const BL = '#00bcd4';
const WT = '#b2b5be';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume', color: WT, lineWidth: 3, style: 'histogram' },
];

export const metadata = {
  title: 'Volume',
  shortTitle: 'Volume',
  overlay: false,
};

/** Pine float comparisons: a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Big Volume', message: 'Big Volume' },
];

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { alerts: AlertConditionState[] };

interface BiggestVolumeRun extends BarRunState<Record<string, never>> {
  hi: WindowExtreme;
  plot0: Point[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<BiggestVolumeInputs>): BarStudy<BiggestVolumeRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const hi = new WindowExtreme(false, cfg.accuracy);
      const s: BiggestVolumeRun = { hi, plot0: [], flags: [[]], times: [[]], steps: [hi], vars: {}, lists: [], series: [] };
      s.lists = s.times;
      s.series = [s.plot0, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const volume = b.volume ?? NaN;
      const hi = s.hi.step(volume);
      const big = eq(volume, hi);
      // plot(volume, color = volume == Hi ? Bl : Wt, linewidth = 3, style = plot.style_histogram)
      s.plot0[i] = { time: b.time as number, value: volume, color: big ? BL : WT };
      // alertcondition(AlrtSwitch and isVolBig, "Big Volume")
      const f = cfg.alertSwitch && big;
      s.flags[0][i] = f;
      if (f) s.times[0].push(b.time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BiggestVolumeInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<BiggestVolumeInputs> = {},
): IndicatorResult & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const BiggestVolume = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
