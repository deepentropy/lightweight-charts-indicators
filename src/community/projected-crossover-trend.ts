/**
 * Projected Crossover Trend
 *
 * Fast EMA and slow SMA of the source. The projected cross is fastLen * (fast - slow); the Market Direction Indicator
 * (MDI) is the EMA of 100 * its bar-to-bar change / close. The trend state turns long when the MDI is above 0 and the
 * close is above the close slowLen bars ago, short when the MDI is below 0 and the close is below it; otherwise it
 * keeps its value. Bars take the trend colour; LONG / SHORT triangles mark the state changes.
 * Alerts (alertcondition, `alerts` of the result): 'Long Signal' and 'Short Signal', true on the state changes.
 *
 * Reference: "Projected Crossover Trend" by SchizoQuant
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © SchizoQuant
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import {
  barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma,
  type BarRunState, type BarStudy, type IndicatorRun,
} from '../live-run';

export interface ProjectedCrossoverTrendInputs {
  src: SourceType;
  /** Fast EMA length */
  fastLen: number;
  /** Slow SMA length (also the close lookback of the trend state) */
  slowLen: number;
  /** EMA length of the MDI */
  smoothLen: number;
  colorBars: boolean;
  showSignals: boolean;
  longColor: string;
  shortColor: string;
}

export const defaultInputs: ProjectedCrossoverTrendInputs = {
  src: 'close',
  fastLen: 10,
  slowLen: 30,
  smoothLen: 5,
  colorBars: true,
  showSignals: true,
  longColor: 'rgb(57, 255, 20)',
  shortColor: 'rgb(138, 43, 226)',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'fastLen', type: 'int', title: 'Fast MA Length', defval: 10, min: 2 },
  { id: 'slowLen', type: 'int', title: 'Slow MA Length', defval: 30, min: 3 },
  { id: 'smoothLen', type: 'int', title: 'MDI Smooth Length', defval: 5, min: 1 },
  { id: 'colorBars', type: 'bool', title: 'Color Bars', defval: true },
  { id: 'showSignals', type: 'bool', title: 'Show Signals', defval: true },
  { id: 'longColor', type: 'color', title: 'Bullish Color', defval: 'rgb(57, 255, 20)' },
  { id: 'shortColor', type: 'color', title: 'Bearish Color', defval: 'rgb(138, 43, 226)' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast MA', color: 'rgb(57, 255, 20)', lineWidth: 2 },
  { id: 'plot1', title: 'Slow MA', color: 'rgb(138, 43, 226)', lineWidth: 2 },
];

export const metadata = {
  title: 'Projected Crossover Trend',
  shortTitle: 'Projected Crossover Trend',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface ProjectedVars {
  /** var int SQ = 0 */
  sq: number;
  /** projectedCross of the bar before */
  prevCross: number;
}

interface ProjectedRun extends BarRunState<ProjectedVars> {
  fast: ReturnType<typeof taStep.ema>;
  slow: WindowSma;
  mdi: ReturnType<typeof taStep.ema>;
  plot0: Point[];
  plot1: Point[];
  markers: MarkerData[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<ProjectedCrossoverTrendInputs>): BarStudy<ProjectedRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: ProjectedRun = {
        fast: taStep.ema(cfg.fastLen),
        slow: new WindowSma(cfg.slowLen),
        mdi: taStep.ema(cfg.smoothLen),
        plot0: [], plot1: [], markers: [], barColors: [], flags: [[], []], times: [[], []],
        steps: [], vars: { sq: 0, prevCross: NaN }, lists: [], series: [],
      };
      s.steps = [s.fast, s.slow, s.mdi];
      s.lists = [s.markers, s.barColors, ...s.times];
      s.series = [s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const src = value(b);
      const fastMA = s.fast.step(src);
      const slowMA = s.slow.step(src);
      const projectedCross = cfg.fastLen * (fastMA - slowMA);
      // mdiRaw = 100 * (projectedCross - projectedCross[1]) / close (x / 0 = na)
      const c = b.close;
      const mdiRaw = i > 0 && c !== 0 ? (100 * (projectedCross - v.prevCross)) / c : NaN;
      v.prevCross = projectedCross;
      const mdi = s.mdi.step(mdiRaw);

      const time = b.time;
      const prevSq = v.sq;
      const closeBack = i - cfg.slowLen >= 0 ? bars[i - cfg.slowLen].close : NaN;
      if (gt(mdi, 0) && gt(b.close, closeBack)) v.sq = 1;
      if (lt(mdi, 0) && lt(b.close, closeBack)) v.sq = -1;
      const sq = v.sq;
      // SQ[1] is na on the first bar: na != 1 is false
      const longSignal = i > 0 && sq === 1 && prevSq !== 1;
      const shortSignal = i > 0 && sq === -1 && prevSq !== -1;

      // barcolor(colorBars ? (SQ == 1 ? longColor : shortColor) : na)
      if (cfg.colorBars) s.barColors.push({ time, color: sq === 1 ? cfg.longColor : cfg.shortColor });
      if (cfg.showSignals && longSignal) {
        s.markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: cfg.longColor, size: 'small',
          text: 'LONG', textColor: color.white });
      }
      if (cfg.showSignals && shortSignal) {
        s.markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: cfg.shortColor, size: 'small',
          text: 'SHORT', textColor: color.white });
      }
      s.plot0[i] = { time, value: fastMA, color: cfg.longColor };
      s.plot1[i] = { time, value: slowMA, color: cfg.shortColor };
      // alertcondition(longSignal, "Long Signal") / alertcondition(shortSignal, "Short Signal")
      s.flags[0][i] = longSignal;
      s.flags[1][i] = shortSignal;
      if (longSignal) s.times[0].push(time as number);
      if (shortSignal) s.times[1].push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ProjectedCrossoverTrendInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<ProjectedCrossoverTrendInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Long Signal', message: 'Projected Crossover Trend LONG Signal on {{ticker}}' },
  { id: 'alert1', title: 'Short Signal', message: 'Projected Crossover Trend SHORT Signal on {{ticker}}' },
];

export const ProjectedCrossoverTrend = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
