/**
 * TA Adaptive Trend Lite
 *
 * A fast and a slow EMA of the close. The zone between them is filled mint green when the fast EMA is above the slow
 * EMA, orange when it is below, gray otherwise. Triangles mark the crosses of the fast EMA over / under the slow EMA.
 * Alerts (alertcondition, `alerts` of the result): 'Bullish EMA cross' and 'Bearish EMA cross', on the bars of the
 * crosses (whatever the marker input).
 *
 * Reference: "TA (Miles) Adaptive Trend" by TradingApologist
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  {
    id: 'alert0', title: 'Bullish EMA cross',
    message: 'TA Adaptive Trend: fast EMA crossed above slow EMA on {{ticker}} ({{interval}})',
  },
  {
    id: 'alert1', title: 'Bearish EMA cross',
    message: 'TA Adaptive Trend: fast EMA crossed below slow EMA on {{ticker}} ({{interval}})',
  },
];

export interface TaAdaptiveTrendInputs {
  /** Fast EMA length */
  fastLen: number;
  /** Slow EMA length */
  slowLen: number;
  /** Show the crossover markers */
  showFlips: boolean;
}

export const defaultInputs: TaAdaptiveTrendInputs = {
  fastLen: 21,
  slowLen: 55,
  showFlips: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLen', type: 'int', title: 'Fast EMA', defval: 21, min: 2 },
  { id: 'slowLen', type: 'int', title: 'Slow EMA', defval: 55, min: 2 },
  { id: 'showFlips', type: 'bool', title: 'Show crossover markers', defval: true },
];

const FAST_COLOR = String(color.new(color.teal, 0));
const SLOW_COLOR = String(color.new(color.orange, 0));
const ZONE_UP = String(color.new('#98FF98', 80));
const ZONE_DOWN = String(color.new(color.orange, 85));
const ZONE_FLAT = String(color.new(color.gray, 90));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast EMA', color: FAST_COLOR, lineWidth: 1 },
  { id: 'plot1', title: 'Slow EMA', color: SLOW_COLOR, lineWidth: 1 },
];

export const metadata = {
  title: 'TA Adaptive Trend Lite',
  shortTitle: 'TA Adaptive Trend Lite',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface TatRun extends BarRunState<Record<string, never>> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  over: ReturnType<typeof taStep.crossover>;
  under: ReturnType<typeof taStep.crossunder>;
  plot0: Point[];
  plot1: Point[];
  zoneColors: string[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<TaAdaptiveTrendInputs>): BarStudy<TatRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const fast = taStep.ema(cfg.fastLen);
      const slow = taStep.ema(cfg.slowLen);
      const over = taStep.crossover();
      const under = taStep.crossunder();
      const s: TatRun = {
        fast, slow, over, under, plot0: [], plot1: [], zoneColors: [], markers: [], flags: [[], []], times: [[], []],
        steps: [fast, slow, over, under], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.plot0, s.plot1, s.zoneColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time;
      const c = bars[i].close;
      const fastMA = s.fast.step(c);
      const slowMA = s.slow.step(c);
      // ta.crossover / ta.crossunder: exact comparisons
      const bull = s.over.step(fastMA, slowMA);
      const bear = s.under.step(fastMA, slowMA);
      s.plot0[i] = { time, value: fastMA, color: FAST_COLOR };
      s.plot1[i] = { time, value: slowMA, color: SLOW_COLOR };
      s.zoneColors[i] = gt(fastMA, slowMA) ? ZONE_UP : lt(fastMA, slowMA) ? ZONE_DOWN : ZONE_FLAT;
      if (cfg.showFlips && bull) {
        s.markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: color.teal, size: 'tiny' });
      }
      if (cfg.showFlips && bear) {
        s.markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'tiny' });
      }
      // alertcondition(bull, 'Bullish EMA cross') / alertcondition(bear, 'Bearish EMA cross')
      [bull, bear].forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(time as number);
      });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        // fill(pFast, pSlow, color = zoneColor, title = "Trend Zone")
        fills: [{ plot1: 'plot0', plot2: 'plot1', colors: s.zoneColors.slice(), options: { title: 'Trend Zone' } }],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TaAdaptiveTrendInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TaAdaptiveTrendInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const TaAdaptiveTrend = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
