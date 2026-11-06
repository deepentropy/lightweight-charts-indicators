/**
 * Volume with Alert
 *
 * Volume columns: yellow when the volume is at or above the threshold, else teal on bars with close >= open and red
 * on the other bars. A blue SMA of the volume and a dashed horizontal line at the threshold.
 * Alerts (alertcondition, `alerts` of the result): 'Volume exceeds threshold' on the bars with a yellow column.
 *
 * Reference: "Volume with Alert" by BullBearSR
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolumeWithAlertInputs {
  /** Volume level of the yellow columns and of the alert */
  threshold: number;
  /** SMA length of the volume */
  maLength: number;
}

export const defaultInputs: VolumeWithAlertInputs = {
  threshold: 1000,
  maLength: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'threshold', type: 'float', title: 'Alert when volume is ≥ to', defval: 1000, min: 0 },
  { id: 'maLength', type: 'int', title: 'Volume moving average length (visual only)', defval: 20, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume', color: color.teal, lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Volume Moving Average', color: color.blue, lineWidth: 1 },
];

/** hline(threshold) with the default threshold (the result `hlines` carry the input value) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_threshold', price: 1000, title: 'Threshold Line', color: String(color.new(color.orange, 40)), linestyle: 'dashed', linewidth: 1 },
];

export const metadata = {
  title: 'Volume with Alert',
  shortTitle: 'Vol Alert',
  overlay: false,
  format: 'volume',
};

/** Pine float comparisons: a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Result = IndicatorResult & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color?: string };

interface VolumeAlertRun extends BarRunState<Record<string, never>> {
  ma: WindowSma;
  plot0: Point[];
  plot1: Point[];
  flags: boolean[];
  times: number[];
}

function study(inputs: Partial<VolumeWithAlertInputs>): BarStudy<VolumeAlertRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const ma = new WindowSma(cfg.maLength);
      const s: VolumeAlertRun = { ma, plot0: [], plot1: [], flags: [], times: [], steps: [ma], vars: {}, lists: [], series: [] };
      s.lists = [s.times];
      s.series = [s.plot0, s.plot1, s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const vol = b.volume ?? NaN;
      const maVol = s.ma.step(vol) ?? NaN;
      const isBullish = ge(b.close, b.open);
      const baseColor = isBullish ? color.teal : color.red;
      // triggered = vol >= threshold (alertcondition "Volume exceeds threshold")
      const triggered = ge(vol, cfg.threshold);
      s.flags[i] = triggered;
      if (triggered) s.times.push(b.time as number);
      s.plot0[i] = { time: b.time, value: vol, color: triggered ? color.yellow : baseColor };
      s.plot1[i] = { time: b.time, value: maVol };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        hlines: [
          { value: cfg.threshold, options: { title: 'Threshold Line', color: String(color.new(color.orange, 40)), linestyle: 'dashed', linewidth: 1 } },
        ],
        alerts: liveAlertStates(alertConditions, [s.times], [n > 0 && s.flags[n - 1]]),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeWithAlertInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolumeWithAlertInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertcondition */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Volume exceeds threshold', message: 'High volume on {{ticker}} ({{interval}}): exceeds the configured threshold.' },
];

export const VolumeWithAlert = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
