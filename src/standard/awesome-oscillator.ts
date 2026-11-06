/**
 * Awesome Oscillator (AO) Indicator
 *
 * Measures market momentum using the difference between
 * 5-period and 34-period simple moving averages of the median price.
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type AwesomeOscillatorInputs = Record<string, never>;

export const defaultInputs: AwesomeOscillatorInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'AO', color: '#009688', lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'Awesome Oscillator',
  shortTitle: 'AO',
  overlay: false,
};

/** Reference alertconditions: changeToGreen = ta.crossover(diff, 0), changeToRed = ta.crossunder(diff, 0) */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'AO color changed to green', message: "Awesome Oscillator's color has changed to green" },
  { id: 'alert1', title: 'AO color changed to red', message: "Awesome Oscillator's color has changed to red" },
];

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { alerts: AlertConditionState[] };

interface AoRun extends BarRunState<Record<string, never>> {
  fast: WindowSma;
  slow: WindowSma;
  ao: number[];
  diff: number[];
  aoData: Point[];
  flags: boolean[][];
  times: number[][];
}

function study(): BarStudy<AoRun, Result> {
  return {
    init() {
      // AO = SMA(hl2, 5) - SMA(hl2, 34)
      const fast = new WindowSma(5);
      const slow = new WindowSma(34);
      const s: AoRun = {
        fast, slow, ao: [], diff: [], aoData: [], flags: [[], []], times: [[], []],
        steps: [fast, slow], vars: {}, lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [s.ao, s.diff, s.aoData, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // hl2 = (high + low) / 2
      const hl2 = (b.high + b.low) / 2;
      const v = s.fast.step(hl2) - s.slow.step(hl2);
      s.ao[i] = v;
      const prev = i > 0 ? s.ao[i - 1] : NaN;
      const d = v - prev;
      const color = d <= 0 ? '#F44336' : '#009688';
      s.aoData[i] = { time: b.time, value: v, color };
      // diff = ao - ao[1]; changeToGreen = ta.crossover(diff, 0), changeToRed = ta.crossunder(diff, 0)
      const diff = i > 0 ? d : NaN;
      s.diff[i] = diff;
      const pd = i > 0 ? s.diff[i - 1] : NaN;
      const flags = [diff > 0 && pd <= 0, diff < 0 && pd >= 0];
      flags.forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(b.time as number);
      });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.aoData.slice() },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<AwesomeOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(), chart);
}

export function calculate(bars: Bar[], _inputs: Partial<AwesomeOscillatorInputs> = {}): Result {
  return fullResult(createRun(_inputs).update(bars));
}

export const AwesomeOscillator = {
  calculate,
  createRun,
  alertConditions,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
