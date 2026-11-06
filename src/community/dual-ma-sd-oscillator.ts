/**
 * Dual MA SD Oscillator
 *
 * The spread between a fast and a slow EMA of the source, smoothed by an EMA, drawn as columns. Bands at plus and
 * minus the standard deviation of the spread. The trend state turns bullish when the spread closes above the upper
 * band and bearish when it closes below the lower band; it colours the columns and the price bars, and BULL / BEAR
 * triangles on the price pane mark the first bar of a new state.
 * Alerts (alertcondition, `alerts` of the result): 'Bull Signal' / 'Bear Signal', true on the first bar of a new
 * state (also with the signals hidden).
 *
 * Reference: "Dual MA SD Oscillator" by SchizoQuant
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © SchizoQuant
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DualMaSdOscillatorInputs {
  /** Price source of the fast and slow EMAs */
  src: SourceType;
  /** Fast EMA length */
  maFast: number;
  /** Slow EMA length */
  maSlow: number;
  /** EMA length of the spread smoothing */
  maSmooth: number;
  /** Standard deviation length of the upper band */
  upperSDLen: number;
  /** Standard deviation length of the lower band */
  lowerSDLen: number;
  showSignals: boolean;
  colorBars: boolean;
  longColor: string;
  shortColor: string;
}

export const defaultInputs: DualMaSdOscillatorInputs = {
  src: 'close',
  maFast: 1,
  maSlow: 30,
  maSmooth: 1,
  upperSDLen: 25,
  lowerSDLen: 25,
  showSignals: true,
  colorBars: true,
  longColor: 'rgb(57, 255, 20)',
  shortColor: 'rgb(138, 43, 226)',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close', group: 'MA Settings' },
  { id: 'maFast', type: 'int', title: 'Fast Length', defval: 1, min: 1, group: 'MA Settings' },
  { id: 'maSlow', type: 'int', title: 'Slow Length', defval: 30, min: 1, group: 'MA Settings' },
  { id: 'maSmooth', type: 'int', title: 'Smooth Length', defval: 1, min: 1, group: 'Smoothing' },
  { id: 'upperSDLen', type: 'int', title: 'Upper SD Length', defval: 25, min: 1, group: 'Standard Deviation' },
  { id: 'lowerSDLen', type: 'int', title: 'Lower SD Length', defval: 25, min: 1, group: 'Standard Deviation' },
  { id: 'showSignals', type: 'bool', title: 'Show Signals', defval: true, group: 'Visualization' },
  { id: 'colorBars', type: 'bool', title: 'Color Bars', defval: true, group: 'Visualization' },
  { id: 'longColor', type: 'color', title: 'Bullish Color', defval: 'rgb(57, 255, 20)', group: 'Color Settings', inline: '1' },
  { id: 'shortColor', type: 'color', title: 'Bearish Color', defval: 'rgb(138, 43, 226)', group: 'Color Settings', inline: '1' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper SD Band', color: String(color.new('rgb(57, 255, 20)', 45)), lineWidth: 1 },
  { id: 'plot1', title: 'Lower SD Band', color: String(color.new('rgb(138, 43, 226)', 45)), lineWidth: 1 },
  { id: 'plot2', title: 'Histogram', color: String(color.new('rgb(57, 255, 20)', 70)), lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'Dual MA SD Oscillator',
  shortTitle: 'Dual MA SD Oscillator',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface DualVars {
  /** var int SQ = 0; SQ[1] (na on the first bar) */
  sq: number;
  prevSq: number;
}

interface DualRun extends BarRunState<DualVars> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  smooth: ReturnType<typeof taStep.ema>;
  upper: WindowStdev;
  lower: WindowStdev;
  plots: Point[][];
  markers: MarkerData[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<DualMaSdOscillatorInputs>): BarStudy<DualRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const longCol = cfg.longColor;
  const shortCol = cfg.shortColor;
  const upperCol = String(color.new(longCol, 45));
  const lowerCol = String(color.new(shortCol, 45));
  const histLong = String(color.new(longCol, 70));
  const histShort = String(color.new(shortCol, 70));
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: DualRun = {
        fast: taStep.ema(cfg.maFast), slow: taStep.ema(cfg.maSlow), smooth: taStep.ema(cfg.maSmooth),
        upper: new WindowStdev(cfg.upperSDLen), lower: new WindowStdev(cfg.lowerSDLen), plots: [[], [], []],
        markers: [], barColors: [], flags: [[], []], times: [[], []],
        vars: { sq: 0, prevSq: NaN }, steps: [], lists: [], series: [],
      };
      s.steps = [s.fast, s.slow, s.smooth, s.upper, s.lower];
      s.lists = [s.markers, s.barColors, ...s.times];
      s.series = [...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const t = b.time;
      const x = value(b);
      const spread = (s.fast.step(x) ?? NaN) - (s.slow.step(x) ?? NaN);
      const smoothedMA = s.smooth.step(spread) ?? NaN;
      const upperBand = s.upper.step(smoothedMA);
      const lowerBand = -s.lower.step(smoothedMA);

      if (gt(smoothedMA, upperBand)) v.sq = 1; // long
      if (lt(smoothedMA, lowerBand)) v.sq = -1; // short
      const sq = v.sq;
      const prevSq = v.prevSq;
      // SQ[1] != 1 is false when SQ[1] is na (first bar)
      const longSignal = sq === 1 && !isNaN(prevSq) && prevSq !== 1;
      const shortSignal = sq === -1 && !isNaN(prevSq) && prevSq !== -1;
      const col = sq === 1 ? longCol : shortCol;
      s.flags[0][i] = longSignal;
      s.flags[1][i] = shortSignal;
      if (longSignal) s.times[0].push(t as number);
      if (shortSignal) s.times[1].push(t as number);

      s.plots[0][i] = { time: t, value: upperBand, color: upperCol };
      s.plots[1][i] = { time: t, value: lowerBand, color: lowerCol };
      s.plots[2][i] = { time: t, value: smoothedMA, color: sq === 1 ? histLong : histShort };
      // plotshape(showSignals and longSignal, 'Bull Signal', shape.triangleup, location.belowbar, size.small,
      //   force_overlay = true, text = 'BULL', textcolor = color.white)
      if (cfg.showSignals && longSignal) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: longCol, size: 'small', text: 'BULL',
          textColor: color.white, forceOverlay: true });
      }
      if (cfg.showSignals && shortSignal) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: shortCol, size: 'small', text: 'BEAR',
          textColor: color.white, forceOverlay: true });
      }
      // barcolor(colorBars ? col : na)
      if (cfg.colorBars) s.barColors.push({ time: t, color: col });
      v.prevSq = sq;
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice() },
        hlines: [{ value: 0, options: { title: 'Zero Line', color: color.gray, linestyle: 'dashed' } }],
        // fill(upperPlot, lowerPlot, title = 'SD Band Fill', color = color.new(color.gray, 93))
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { title: 'SD Band Fill' },
          colors: new Array<string>(n).fill(String(color.new(color.gray, 93))) }],
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        // alertcondition(longSignal, "Bull Signal") / alertcondition(shortSignal, "Bear Signal")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DualMaSdOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DualMaSdOscillatorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bull Signal', message: 'Dual MA SD Oscillator Bull Signal on {{ticker}}' },
  { id: 'alert1', title: 'Bear Signal', message: 'Dual MA SD Oscillator Bear Signal on {{ticker}}' },
];

export const DualMaSdOscillator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
