/**
 * Volume Bars Color
 *
 * Volume columns coloured by an SMA / standard deviation band of the volume over `meanPeriod` bars: red when the
 * volume is at or above mean + stdev * devK, yellow when at or below mean - stdev * devK, light grey otherwise.
 * The mean volume line and a filled band at mean +- 1 stdev. Optionally the price candles of the high volume bars
 * are coloured.
 * Alerts (alertcondition, `alerts` of the result): 'High Volume Alert' / 'Low Volume Alert' on the bars whose volume is
 * at or above the high threshold / at or below the low threshold.
 *
 * Reference: "Volume Bars Color" by Evgenyc111
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { BarColorData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface VolumeBarsColorInputs {
  /** SMA / stdev length of the volume */
  meanPeriod: number;
  /** Standard deviation multiplier of the high / low volume thresholds */
  devK: number;
  /** Colour the candles of the high volume bars */
  candles: boolean;
  /** Candle colour of the high volume bars */
  candlesClr: string;
}

export const defaultInputs: VolumeBarsColorInputs = {
  meanPeriod: 30,
  devK: 1.0,
  candles: true,
  candlesClr: '#1320d3',
};

export const inputConfig: InputConfig[] = [
  { id: 'meanPeriod', type: 'int', title: 'Mean period', defval: 30 },
  { id: 'devK', type: 'float', title: 'Std deviation multiplier for volume bands', defval: 1.0 },
  { id: 'candles', type: 'bool', title: 'Colour extreme volume candles?', defval: true },
  { id: 'candlesClr', type: 'color', title: 'High volume candles color', defval: '#1320d3' },
];

const HIGH_VOLUME = color.rgb(207, 9, 9);
const LOW_VOLUME = color.rgb(250, 202, 46);
const AVERAGE_VOLUME = color.rgb(223, 223, 223);
const BAND = String(color.new('#9ad1ff', 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume Bars', color: HIGH_VOLUME, lineWidth: 3, style: 'columns' },
  { id: 'plot1', title: 'Mean Volume', color: color.blue, lineWidth: 1 },
  { id: 'plot2', title: 'High Band', color: BAND, lineWidth: 1 },
  { id: 'plot3', title: 'Low Band', color: BAND, lineWidth: 1 },
];

export const metadata = {
  title: 'Volume Bars Color',
  shortTitle: 'Volume Bars Color',
  overlay: false,
  precision: 0,
};

/** Pine float comparisons: a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Result = IndicatorResult & { barColors: BarColorData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color: string };

interface VbcRun extends BarRunState<Record<string, never>> {
  mean: WindowSma;
  dev: WindowStdev;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<VolumeBarsColorInputs>): BarStudy<VbcRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const bandFill = String(color.new('#9ad1ff', 90));
  return {
    init() {
      const s: VbcRun = {
        mean: new WindowSma(cfg.meanPeriod), dev: new WindowStdev(cfg.meanPeriod), plot0: [], plot1: [], plot2: [],
        plot3: [], barColors: [], flags: [[], []], times: [[], []], steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.mean, s.dev];
      s.lists = [s.barColors, ...s.times];
      s.series = [s.plot0, s.plot1, s.plot2, s.plot3, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const time = b.time as number;
      const volume = b.volume ?? NaN;
      const meanVolume = s.mean.step(volume);
      const stdDevVolume = s.dev.step(volume);
      const hiBand = meanVolume + stdDevVolume;
      const lowBand = meanVolume - stdDevVolume;
      const highThreshold = meanVolume + stdDevVolume * cfg.devK;
      const lowThreshold = meanVolume - stdDevVolume * cfg.devK;
      const isHigh = ge(volume, highThreshold);
      const isLow = le(volume, lowThreshold);
      // volumeColor = volume >= highVolumeThreshold ? high : volume <= lowVolumeThreshold ? low : average
      const volumeColor = isHigh ? HIGH_VOLUME : isLow ? LOW_VOLUME : AVERAGE_VOLUME;
      // barcolor(volume >= highVolumeThreshold and candles ? candlesClr : na)
      if (isHigh && cfg.candles) s.barColors.push({ time: b.time, color: cfg.candlesClr });
      s.plot0[i] = { time, value: volume, color: volumeColor };
      s.plot1[i] = { time, value: meanVolume, color: color.blue };
      s.plot2[i] = { time, value: hiBand, color: BAND };
      s.plot3[i] = { time, value: lowBand, color: BAND };
      // alertcondition(volume >= highVolumeThreshold) / alertcondition(volume <= lowVolumeThreshold)
      s.flags[0]![i] = isHigh;
      s.flags[1]![i] = isLow;
      if (isHigh) s.times[0]!.push(time);
      if (isLow) s.times[1]!.push(time);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: metadata.precision },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice() },
        // fill(High Band, Low Band, color.new(#9ad1ff, 90), title = 'Band Fill')
        fills: [{ plot1: 'plot2', plot2: 'plot3', options: { title: 'Band Fill', color: bandFill }, colors: new Array<string>(n).fill(bandFill) }],
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeBarsColorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolumeBarsColorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'High Volume Alert', message: 'Anomalous High Volume detected!' },
  { id: 'alert1', title: 'Low Volume Alert', message: 'Anomalous Low Volume detected!' },
];

export const VolumeBarsColor = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
