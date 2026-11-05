/**
 * Supertrend Indicator
 *
 * A trend-following overlay indicator that uses ATR to calculate
 * dynamic support/resistance levels.
 *
 * PineScript display:
 *   upTrend =   plot(direction < 0 ? supertrend : na, "Up Trend",   style = plot.style_linebr)
 *   downTrend = plot(direction < 0 ? na : supertrend, "Down Trend", style = plot.style_linebr)
 *   bodyMiddle = plot((open + close) / 2, display = display.none)
 *   fill(bodyMiddle, upTrend,   color = color.new(color.green, 90), fillgaps = false)
 *   fill(bodyMiddle, downTrend, color = color.new(color.red,   90), fillgaps = false)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type FillData, type Bar } from 'oakscriptjs';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/**
 * Supertrend indicator input parameters
 */
export interface SupertrendInputs {
  /** ATR period length */
  atrPeriod: number;
  /** ATR multiplier factor */
  factor: number;
}

/**
 * Default input values matching the standard indicator defaults
 */
export const defaultInputs: SupertrendInputs = {
  atrPeriod: 10,
  factor: 3.0,
};

/**
 * Input configuration for UI
 */
export const inputConfig: InputConfig[] = [
  { id: 'atrPeriod', type: 'int', title: 'ATR Length', defval: 10, min: 1 },
  { id: 'factor', type: 'float', title: 'Factor', defval: 3.0, min: 0.01, step: 0.01 },
];

/**
 * Plot configuration
 * plot2 (bodyMiddle) is invisible — used only as a fill anchor
 */
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Up Trend', color: '#089981', lineWidth: 1, style: 'linebr' },
  { id: 'plot1', title: 'Down Trend', color: '#F23645', lineWidth: 1, style: 'linebr' },
  { id: 'plot2', title: 'Body Middle', color: '#00000000', lineWidth: 0, display: 'none' },
];

/**
 * Indicator metadata
 */
export const metadata = {
  title: 'Supertrend',
  shortTitle: 'ST',
  overlay: true,
};

/**
 * Calculate Supertrend indicator
 */
/** Reference alertconditions on the direction (-1 up, 1 down) */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Downtrend to Uptrend', message: 'The Supertrend value switched from Downtrend to Uptrend ' },
  { id: 'alert1', title: 'Uptrend to Downtrend', message: 'The Supertrend value switched from Uptrend to Downtrend' },
  { id: 'alert2', title: 'Trend Change', message: 'The Supertrend value switched from Uptrend to Downtrend or vice versa' },
];

type Point = { time: number; value: number };
type Result = IndicatorResult & { alerts: AlertConditionState[] };

interface SupertrendRun extends BarRunState<Record<string, never>> {
  st: ReturnType<typeof taStep.supertrend>;
  dir: number[];
  up: Point[];
  down: Point[];
  middle: Point[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<SupertrendInputs>): BarStudy<SupertrendRun, Result> {
  const { atrPeriod, factor } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const st = taStep.supertrend(factor, atrPeriod);
      const s: SupertrendRun = {
        st, dir: [], up: [], down: [], middle: [], flags: [[], [], []], times: [[], [], []],
        steps: [st], vars: {}, lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [s.dir, s.up, s.down, s.middle, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const [stValue, direction] = s.st.step(b.high, b.low, b.close);
      // supertrend := barstate.isfirst ? na : supertrend
      const value = i === 0 ? NaN : stValue;
      const dir = direction ?? NaN;
      s.dir[i] = dir;
      const d = Number.isNaN(dir) ? 1 : dir;
      s.up[i] = { time: b.time, value: d < 0 ? value : NaN };
      s.down[i] = { time: b.time, value: d >= 0 ? value : NaN };
      s.middle[i] = { time: b.time, value: i === 0 ? NaN : (b.open + b.close) / 2 };
      // direction[1] > direction, direction[1] < direction, direction[1] != direction (na compares false)
      const p = i > 0 ? s.dir[i - 1] : NaN;
      const flags = [i > 0 && p > dir, i > 0 && p < dir, i > 0 && Number.isFinite(p) && Number.isFinite(dir) && p !== dir];
      flags.forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(b.time as number);
      });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.up.slice(), 'plot1': s.down.slice(), 'plot2': s.middle.slice() },
        fills: [
          { plot1: 'plot2', plot2: 'plot0', options: { color: '#089981', transp: 90, title: 'Uptrend background', fillgaps: false } },
          { plot1: 'plot2', plot2: 'plot1', options: { color: '#F23645', transp: 90, title: 'Downtrend background', fillgaps: false } },
        ] as FillData[],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SupertrendInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SupertrendInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/**
 * Supertrend indicator module
 */
export const Supertrend = {
  calculate,
  createRun,
  alertConditions,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
