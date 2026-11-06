/**
 * Climax Volume Reversal Radar
 *
 * Volume columns coloured by climax conditions. A bullish climax (green) is a down bar (close < open) that closes
 * below the close of `takingClose` bars ago on a volume above sma(volume, 10) * riskFactor; a bearish climax (red)
 * is an up bar that closes above that close on the same volume condition; other bars are gray. An optional SMA of
 * the volume is drawn as a line.
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Climax Watch' and 'Bearish Climax Watch', true on the
 * green and red columns.
 *
 * Reference: "Climax Volume Reversal Radar" by Ty_yanse
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ClimaxVolumeReversalRadarInputs {
  /** Show the volume MA */
  showMA: boolean;
  /** Volume MA length (the climax average always uses 10 bars) */
  lengthMA: number;
  /** Reference close bars back */
  takingClose: number;
  /** Volume multiple of the 10-bar average volume */
  riskFactor: number;
}

export const defaultInputs: ClimaxVolumeReversalRadarInputs = {
  showMA: true,
  lengthMA: 10,
  takingClose: 5,
  riskFactor: 1.618,
};

export const inputConfig: InputConfig[] = [
  { id: 'showMA', type: 'bool', title: 'Show Volume MA', defval: true },
  { id: 'lengthMA', type: 'int', title: 'Volume MA Length', defval: 10, min: 1 },
  { id: 'takingClose', type: 'int', title: 'Reference Close Bars Back', defval: 5, min: 1 },
  { id: 'riskFactor', type: 'float', title: 'Risk Factor', defval: 1.618, min: 0.1, step: 0.001 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume', color: color.gray, lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Volume MA', color: color.black, lineWidth: 2 },
];

export const metadata = {
  title: 'Climax Volume Reversal Radar',
  shortTitle: 'Climax Vol Radar',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = IndicatorResult & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color: string };

interface ClimaxRun extends BarRunState<Record<string, never>> {
  avgVolume: WindowSma;
  volumeMa: WindowSma;
  plot0: Point[];
  plot1: Point[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<ClimaxVolumeReversalRadarInputs>): BarStudy<ClimaxRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const avgVolume = new WindowSma(10);
      const volumeMa = new WindowSma(cfg.lengthMA);
      const s: ClimaxRun = {
        avgVolume, volumeMa, plot0: [], plot1: [], flags: [[], []], times: [[], []],
        steps: [avgVolume, volumeMa], vars: {}, lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const vol = b.volume ?? NaN;
      const avgVolume = s.avgVolume.step(vol);
      const volumeMa = s.volumeMa.step(vol);
      const ref = i >= cfg.takingClose ? bars[i - cfg.takingClose].close : NaN;
      const highVolume = gt(vol, avgVolume * cfg.riskFactor);
      const bullishClimax = lt(b.close, ref) && lt(b.close, b.open) && highVolume;
      const bearishClimax = gt(b.close, ref) && gt(b.close, b.open) && highVolume;
      const c = bullishClimax ? color.green : bearishClimax ? color.red : color.gray;
      s.plot0[i] = { time: b.time, value: vol, color: c };
      s.plot1[i] = { time: b.time, value: cfg.showMA ? volumeMa : NaN, color: color.black };
      s.flags[0]![i] = bullishClimax;
      s.flags[1]![i] = bearishClimax;
      if (bullishClimax) s.times[0]!.push(b.time as number);
      if (bearishClimax) s.times[1]!.push(b.time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        // alertcondition(bullishClimax, "Bullish Climax Watch") / alertcondition(bearishClimax, "Bearish Climax Watch")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ClimaxVolumeReversalRadarInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ClimaxVolumeReversalRadarInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Climax Watch', message: 'Bullish climax volume detected: possible capitulation or reversal watch zone.' },
  { id: 'alert1', title: 'Bearish Climax Watch', message: 'Bearish climax volume detected: possible buying exhaustion or reversal watch zone.' },
];

export const ClimaxVolumeReversalRadar = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
