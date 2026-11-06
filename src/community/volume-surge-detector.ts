/**
 * Volume Surge Detector
 *
 * Volume columns with an SMA of the volume. The ratio volume / SMA sets the column colour: the second ratio colour
 * above surge level 2, the first ratio colour above surge level 1, else the up / down volume colour (close > open).
 * Alerts (alertcondition, `alerts` of the result): 'Volume Surge Trigger1' when the ratio is above surge level 1 and
 * 'Volume Surge Trigger2' when it is above surge level 2.
 *
 * Reference: "Volume Surge Detector[SpeculationLab]" by SpeculationLab
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © SpeculationLab
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolumeSurgeDetectorInputs {
  /** SMA length of the volume */
  maLength: number;
  maColor: string;
  /** Column colour of an up bar (close > open) */
  volColor1: string;
  /** Column colour of the other bars */
  volColor2: string;
  /** Volume / SMA ratio of surge level 1 */
  trigger1: number;
  /** Volume / SMA ratio of surge level 2 */
  trigger2: number;
  /** Column colour above surge level 1 */
  color1: string;
  /** Column colour above surge level 2 */
  color2: string;
}

// Input colour defaults as Pine stores them (alpha with 2 decimals): color.rgb(255, 255, 255, 54) -> 0.46,
// color.rgb(38, 166, 153, 43) -> 0.57, #ef535087 -> 0.53, #00bbd4de -> 0.87, #ffeb3bda -> 0.85
const DEF_MA = 'rgba(255, 255, 255, 0.46)';
const DEF_VOL1 = 'rgba(38, 166, 153, 0.57)';
const DEF_VOL2 = 'rgba(239, 83, 80, 0.53)';
const DEF_RATIO1 = 'rgba(0, 187, 212, 0.87)';
const DEF_RATIO2 = 'rgba(255, 235, 59, 0.85)';

export const defaultInputs: VolumeSurgeDetectorInputs = {
  maLength: 14,
  maColor: DEF_MA,
  volColor1: DEF_VOL1,
  volColor2: DEF_VOL2,
  trigger1: 5,
  trigger2: 10,
  color1: DEF_RATIO1,
  color2: DEF_RATIO2,
};

export const inputConfig: InputConfig[] = [
  { id: 'maLength', type: 'int', title: 'MA Length', defval: 14, group: 'VOLUME SETTINGS' },
  { id: 'maColor', type: 'color', title: 'MA Color', defval: DEF_MA, group: 'VOLUME SETTINGS' },
  { id: 'volColor1', type: 'color', title: 'Volume Color1', defval: DEF_VOL1, group: 'VOLUME SETTINGS' },
  { id: 'volColor2', type: 'color', title: 'Volume Color2', defval: DEF_VOL2, group: 'VOLUME SETTINGS' },
  { id: 'trigger1', type: 'float', title: 'Surge Level1', defval: 5, min: 1, group: 'SURGE SETTINGS' },
  { id: 'trigger2', type: 'float', title: 'Surge Level2', defval: 10, min: 1, group: 'SURGE SETTINGS' },
  { id: 'color1', type: 'color', title: 'Ratio Color1', defval: DEF_RATIO1, group: 'SURGE SETTINGS' },
  { id: 'color2', type: 'color', title: 'Ratio Color2', defval: DEF_RATIO2, group: 'SURGE SETTINGS' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume', color: DEF_VOL1, lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'MA', color: DEF_MA, lineWidth: 1 },
];

export const metadata = {
  title: 'Volume Surge Detector[SpeculationLab]',
  shortTitle: 'Volume Surge Detector[SpeculationLab]',
  overlay: false,
  format: 'volume',
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Result = IndicatorResult & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color: string };

interface SurgeRun extends BarRunState<Record<string, never>> {
  sma: WindowSma;
  plot0: Point[];
  plot1: Point[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<VolumeSurgeDetectorInputs>): BarStudy<SurgeRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const sma = new WindowSma(cfg.maLength);
      const s: SurgeRun = { sma, plot0: [], plot1: [], flags: [[], []], times: [[], []], steps: [sma], vars: {}, lists: [], series: [] };
      s.lists = [...s.times];
      s.series = [s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const volume = b.volume ?? NaN;
      const ma = s.sma.step(volume);
      // A plain division: x / 0 is +-infinity (0 / 0 NaN); the comparisons use the infinite value
      const ratio = volume / ma;
      const alert1 = gt(ratio, cfg.trigger1);
      const alert2 = gt(ratio, cfg.trigger2);
      s.flags[0][i] = alert1;
      s.flags[1][i] = alert2;
      if (alert1) s.times[0].push(b.time as number);
      if (alert2) s.times[1].push(b.time as number);
      const c = alert2 ? cfg.color2 : alert1 ? cfg.color1 : gt(b.close, b.open) ? cfg.volColor1 : cfg.volColor2;
      s.plot0[i] = { time: b.time, value: volume, color: c };
      s.plot1[i] = { time: b.time, value: ma, color: cfg.maColor };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, format: metadata.format },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        // alertcondition(alert1, "Volume Surge Trigger1") / alertcondition(alert2, "Volume Surge Trigger2")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeSurgeDetectorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<VolumeSurgeDetectorInputs> = {},
): IndicatorResult & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Volume Surge Trigger1', message: 'Volume Surge Level 1 Detected 📊（成交量放量 Level 1 )' },
  { id: 'alert1', title: 'Volume Surge Trigger2', message: 'Volume Surge Level 2 Detected 🚀(成交量放量 Level 2) ' },
];

export const VolumeSurgeDetector = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
