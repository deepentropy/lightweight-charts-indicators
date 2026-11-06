/**
 * Volume Alert
 *
 * Marks a bar whose volume is much larger than the volume of the previous bar. The volume is either the standard
 * volume or an estimated aggression volume: |direction * volume * body / range|, with direction 1 for an up bar,
 * -1 for a down bar and 0 when close equals open (a range of 0 is replaced by 0.0001). Multiplier mode: signal when
 * the volume is at least factor times the previous volume. Percentage mode: signal when the volume grew by at least
 * factor percent. The previous volume must be above 0. The signal is an orange "VOL" label above the bar.
 *
 * Alert condition (`alerts` of the result): "Volume Spike Alert" on each signal bar.
 *
 * Reference: "Volume Alert" by oDouglasAlex
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolumeAlertInputs {
  /** Volume Type */
  volumeType: 'Standard' | 'Aggression';
  /** Comparison Mode */
  comparisonMode: 'Multiplier' | 'Percentage';
  /** Factor (x times or %) */
  factor: number;
}

export const defaultInputs: VolumeAlertInputs = {
  volumeType: 'Aggression',
  comparisonMode: 'Multiplier',
  factor: 3.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'volumeType', type: 'string', title: 'Volume Type', defval: 'Aggression', options: ['Standard', 'Aggression'] },
  { id: 'comparisonMode', type: 'string', title: 'Comparison Mode', defval: 'Multiplier', options: ['Multiplier', 'Percentage'] },
  { id: 'factor', type: 'float', title: 'Factor (x times or %)', defval: 3.0, min: 0.1, step: 0.1 },
];

// No plot(): the only output is the plotshape marker
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Volume Alert',
  shortTitle: 'Volume Alert',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; alerts: AlertConditionState[] };

interface VolumeAlertRun extends BarRunState<Record<string, never>> {
  selectedVolume: number[];
  markers: MarkerData[];
  flags: boolean[];
  times: number[];
}

function study(inputs: Partial<VolumeAlertInputs>): BarStudy<VolumeAlertRun, Result> {
  const { volumeType, comparisonMode, factor } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: VolumeAlertRun = { selectedVolume: [], markers: [], flags: [], times: [], steps: [], vars: {}, lists: [], series: [] };
      s.lists = [s.markers, s.times];
      s.series = [s.selectedVolume, s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const volume = b.volume ?? NaN;
      const standardVolume = volume;
      const body = Math.abs(b.close - b.open);
      let candleRange = b.high - b.low;
      candleRange = eq(candleRange, 0) ? 0.0001 : candleRange;
      const ratio = body / candleRange;
      const direction = gt(b.close, b.open) ? 1 : lt(b.close, b.open) ? -1 : 0;
      const aggressionVolume = direction * volume * ratio;
      const currentVolume = volumeType === 'Standard' ? standardVolume : Math.abs(aggressionVolume);
      s.selectedVolume[i] = currentVolume;

      const previousVolume = i > 0 ? s.selectedVolume[i - 1] : NaN;
      const isMultiplier = gt(previousVolume, 0) && ge(currentVolume, previousVolume * factor);
      const isPercentage = gt(previousVolume, 0) && ge((currentVolume / previousVolume - 1.0) * 100.0, factor);
      const triggerCondition = (comparisonMode === 'Multiplier' && isMultiplier)
        || (comparisonMode === 'Percentage' && isPercentage);
      // alertcondition(triggerCondition, "Volume Spike Alert", ...)
      s.flags[i] = triggerCondition;
      // plotshape(triggerCondition, "Volume Signal", location.abovebar, color.orange, shape.labelup, text = "VOL")
      if (triggerCondition) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'labelUp', color: color.orange, text: 'VOL',
          textColor: color.blue });
        s.times.push(b.time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, [s.times], [n > 0 && s.flags[n - 1]]),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeAlertInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolumeAlertInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertcondition */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Volume Spike Alert', message: 'Volume has exceeded the configured factor!' },
];

export const VolumeAlert = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
