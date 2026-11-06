/**
 * Gold Trend Signal
 *
 * A fast and a slow EMA of the close. A LONG label is drawn when the fast EMA crosses over the slow EMA, a SHORT label
 * when it crosses under. The background is green while the fast EMA is above the slow EMA, red otherwise.
 * Alerts (alertcondition, `alerts` of the result): 'Gold Long Signal' and 'Gold Short Signal', on the bars of the
 * crosses.
 *
 * Reference: "Gold Trend Signal" by CsmillrSirrry
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData, MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface GoldTrendSignalIndicatorInputs {
  /** Fast EMA period */
  emaFast: number;
  /** Slow EMA period */
  emaSlow: number;
}

export const defaultInputs: GoldTrendSignalIndicatorInputs = {
  emaFast: 20,
  emaSlow: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaFast', type: 'int', title: 'Fast EMA Period', defval: 20 },
  { id: 'emaSlow', type: 'int', title: 'Slow EMA Period', defval: 50 },
];

const FAST_COL = String(color.new(color.blue, 0));
const SLOW_COL = String(color.new(color.orange, 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast EMA (20)', color: FAST_COL, lineWidth: 2 },
  { id: 'plot1', title: 'Slow EMA (50)', color: SLOW_COL, lineWidth: 3 },
];

export const metadata = {
  title: 'Gold Trend Signal',
  shortTitle: 'GOLD-SIG',
  overlay: true,
};

/** Pine float comparison: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color: string };

interface GoldRun extends BarRunState<Record<string, never>> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  over: ReturnType<typeof taStep.crossover>;
  under: ReturnType<typeof taStep.crossunder>;
  plot0: Point[];
  plot1: Point[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
}

function study(inputs: Partial<GoldTrendSignalIndicatorInputs>): BarStudy<GoldRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const upBg = String(color.new(color.green, 90));
  const downBg = String(color.new(color.red, 90));
  return {
    init() {
      const fast = taStep.ema(cfg.emaFast);
      const slow = taStep.ema(cfg.emaSlow);
      // ta.crossover / ta.crossunder compare exactly
      const over = taStep.crossover();
      const under = taStep.crossunder();
      const s: GoldRun = {
        fast, slow, over, under, plot0: [], plot1: [], bgColors: [], flags: [[], []], times: [[], []], markers: [],
        steps: [fast, slow, over, under], vars: {}, lists: [], series: [],
      };
      s.lists = [...s.times, s.markers];
      s.series = [s.plot0, s.plot1, s.bgColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const t = bars[i].time;
      const close = bars[i].close;
      const ema20 = s.fast.step(close) ?? NaN;
      const ema50 = s.slow.step(close) ?? NaN;
      const longSignal = !!s.over.step(ema20, ema50);
      const shortSignal = !!s.under.step(ema20, ema50);
      if (longSignal) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'LONG',
          textColor: color.white, size: 'large' });
      }
      if (shortSignal) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SHORT',
          textColor: color.white, size: 'large' });
      }
      // bgcolor(uptrend ? color.new(color.green, 90) : color.new(color.red, 90))
      s.bgColors[i] = { time: t, color: gt(ema20, ema50) ? upBg : downBg };
      s.plot0[i] = { time: t, value: ema20, color: FAST_COL };
      s.plot1[i] = { time: t, value: ema50, color: SLOW_COL };
      s.flags[0][i] = longSignal;
      s.flags[1][i] = shortSignal;
      if (longSignal) s.times[0].push(t as number);
      if (shortSignal) s.times[1].push(t as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
        // alertcondition(long_signal, "Gold Long Signal") / alertcondition(short_signal, "Gold Short Signal")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<GoldTrendSignalIndicatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<GoldTrendSignalIndicatorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Gold Long Signal', message: 'Gold Long Entry Triggered!' },
  { id: 'alert1', title: 'Gold Short Signal', message: 'Gold Short Entry Triggered!' },
];

export const GoldTrendSignalIndicator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
