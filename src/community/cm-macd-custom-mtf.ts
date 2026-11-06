/**
 * MacD Custom Indicator - Multiple Time Frame
 *
 * MACD = ema(close, fast) - ema(close, slow), signal = sma(MACD, signal length), histogram = MACD - signal, computed
 * on the chart timeframe or on another timeframe of the same symbol. The MACD line is lime above the signal and red
 * below, the histogram has four colours (rising / falling, above / below zero) and a circle marks each cross of
 * MACD and signal.
 *
 * Other timeframe: the bars of that timeframe are built from the chart bars (periods from the UTC calendar and the
 * bars, see src/anchor-period.ts), so its averages start at the first chart bar. As in the original (a version 1
 * script), every chart bar of a period shows the value of that period at its end (on past bars the value of a
 * period is known from its first bar; the last period is still open). A timeframe below the chart timeframe needs
 * data that the bars do not carry: the port throws an Error.
 *
 * Periods and the chart context (optional third argument of calculate): with the exchange time zone and the session
 * of the symbol (`timezone`, `session`) the periods are those of the exchange calendar (its trading days, holidays
 * and session hours), and a bar of a higher timeframe is complete on the chart bar whose close reaches the end of
 * its period, see src/anchor-period.ts.
 * Without them the port uses the UTC calendar and the bars, as described in this header. `timeframe`, when given,
 * is the chart timeframe; without it the chart timeframe is read from the bar spacing.
 *
 * Reference: "MacD Custom Indicator-Multiple Time Frame+All Available Options!" by ChrisMoody
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, taStep, Series, color, timeframe, resample, mapToChart,
  type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar,
} from 'oakscriptjs';
import { periodStarts, chartTimeframe, securityBars } from '../anchor-period';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CmMacdCustomMtfInputs {
  /** Use the chart timeframe (the timeframe input is ignored) */
  useCurrentRes: boolean;
  /** Timeframe used when `useCurrentRes` is false ("60", "240", "D", "W", "M", ...) */
  resCustom: string;
  showMacd: boolean;
  showDots: boolean;
  showHistogram: boolean;
  macdColorChange: boolean;
  histColorChange: boolean;
  fastLength: number;
  slowLength: number;
  signalLength: number;
}

export const defaultInputs: CmMacdCustomMtfInputs = {
  useCurrentRes: true,
  resCustom: '60',
  showMacd: true,
  showDots: true,
  showHistogram: true,
  macdColorChange: true,
  histColorChange: true,
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'useCurrentRes', type: 'bool', title: 'Use Current Chart Resolution?', defval: true },
  { id: 'resCustom', type: 'timeframe', title: 'Use Different Timeframe? Uncheck Box Above', defval: '60' },
  { id: 'showMacd', type: 'bool', title: 'Show MacD & Signal Line? Also Turn Off Dots Below', defval: true },
  { id: 'showDots', type: 'bool', title: 'Show Dots When MacD Crosses Signal Line?', defval: true },
  { id: 'showHistogram', type: 'bool', title: 'Show Histogram?', defval: true },
  { id: 'macdColorChange', type: 'bool', title: 'Change MacD Line Color-Signal Line Cross?', defval: true },
  { id: 'histColorChange', type: 'bool', title: 'MacD Histogram 4 Colors?', defval: true },
  { id: 'fastLength', type: 'int', title: 'fastLength', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'slowLength', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'signalLength', defval: 9, min: 1 },
];

// Colour constants of Pine version 1, with the default plot transparency of that version (35)
const V1 = (hex: string) => String(color.new(hex, 35));
const LIME = V1('#00FF00');
const RED = V1('#FF0000');
const YELLOW = V1('#FFFF00');
const AQUA = V1('#00FFFF');
const BLUE = V1('#0000FF');
const MAROON = V1('#800000');
const GRAY = V1('#808080');

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MACD', color: LIME, lineWidth: 4 },
  { id: 'plot1', title: 'Signal Line', color: YELLOW, lineWidth: 2 },
  { id: 'plot2', title: 'Histogram', color: AQUA, lineWidth: 4, style: 'histogram' },
  { id: 'plot3', title: 'Cross', color: LIME, lineWidth: 4, style: 'circles' },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_0', price: 0, color: '#FFFFFF', linestyle: 'solid', linewidth: 2, title: '0 Line' },
];

export const metadata = {
  title: 'CM_MacD_Ult_MTF',
  shortTitle: 'CM_Ult_MacD_MTF',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
/** A number used as a condition: na and 0 are false */
const truthy = (v: number) => !isNaN(v) && v !== 0;

/**
 * security(tickerid, tf, ...) on the chart symbol: the bars of timeframe `tf` built from the chart bars, and the
 * function that brings one value per bar of that timeframe back to the chart bars. Version 1 rule: every chart bar
 * of a period shows the value of the period (no gaps).
 */
function timeframeBars(bars: Bar[], tf: string, context?: ChartContext): { htf: Bar[]; toChart: (values: number[]) => number[] } {
  const chart = chartTimeframe(bars, context);
  if (tf.trim() === '' || chart === '' || timeframe.in_seconds(tf) === timeframe.in_seconds(chart)) {
    return { htf: bars, toChart: (values) => values };
  }
  if (timeframe.in_seconds(tf) < timeframe.in_seconds(chart)) {
    throw new Error(`The timeframe "${tf}" is lower than the chart timeframe "${chart}": the bars do not carry that data.`);
  }
  // With the exchange calendar of the chart context (time zone and session): the periods come from the library rule
  // (see anchor-period.ts); without it, the periods of the UTC calendar and the bars, grouped by the library
  const exchange = securityBars(bars, tf, context);
  const { bars: htf, group } = exchange ? { bars: exchange.htf, group: exchange.group } : resample(bars, periodStarts(bars, tf));
  // lookahead: every chart bar of a period shows the value of the period
  return { htf, toChart: (values) => mapToChart(values, group, [], true, false) };
}

type Point = { time: number; value: number; color: string };

interface CmRun extends BarRunState<Record<string, never>> {
  /** Chart timeframe: the MACD machines; another timeframe: the values on the chart bars, calculated by init */
  fast: ReturnType<typeof taStep.ema> | null;
  slow: ReturnType<typeof taStep.ema> | null;
  sig: WindowSma | null;
  pre: { macd: number[]; signal: number[]; hist: number[] } | null;
  cross: ReturnType<typeof taStep.cross>;
  hist: number[];
  plots: Point[][];
}

function study(inputs: Partial<CmMacdCustomMtfInputs>): BarStudy<CmRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    // another timeframe: every chart bar of a period shows the value of the period at its end (from the later bars)
    fullRunReason: () => (cfg.useCurrentRes ? null : 'another timeframe, calculated on the whole bar set'),
    init(bars, chart) {
      let pre: CmRun['pre'] = null;
      if (!cfg.useCurrentRes) {
        // res = useCurrentRes ? period : resCustom
        const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
        const { htf, toChart } = timeframeBars(bars, cfg.resCustom, chart);
        const source = Series.fromArray(htf, htf.map((b) => b.close));
        const fastMA = A(ta.ema(source, cfg.fastLength));
        const slowMA = A(ta.ema(source, cfg.slowLength));
        const macd = fastMA.map((v, i) => v - slowMA[i]);
        const signal = A(ta.sma(Series.fromArray(htf, macd), cfg.signalLength));
        const hist = macd.map((v, i) => v - signal[i]);
        pre = { macd: toChart(macd), signal: toChart(signal), hist: toChart(hist) };
      }
      const fast = pre ? null : taStep.ema(cfg.fastLength);
      const slow = pre ? null : taStep.ema(cfg.slowLength);
      const sig = pre ? null : new WindowSma(cfg.signalLength);
      const s: CmRun = {
        fast, slow, sig, pre,
        cross: taStep.cross(),
        hist: [],
        plots: [[], [], [], []],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [...(fast ? [fast, slow!, sig!] : []), s.cross];
      s.series = [s.hist, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const t = bars[i].time;
      let outMacD: number;
      let outSignal: number;
      let h: number;
      if (s.pre) {
        outMacD = s.pre.macd[i]!;
        outSignal = s.pre.signal[i]!;
        h = s.pre.hist[i]!;
      } else {
        const c = bars[i].close;
        outMacD = s.fast!.step(c) - s.slow!.step(c);
        outSignal = s.sig!.step(outMacD);
        h = outMacD - outSignal;
      }
      s.hist[i] = h;
      // cross(outMacD, outSignal) on the chart bars
      const crossed = s.cross.step(outMacD, outSignal);

      const h1 = i > 0 ? s.hist[i - 1]! : NaN;
      const histAIsUp = gt(h, h1) && gt(h, 0);
      const histAIsDown = lt(h, h1) && gt(h, 0);
      const histBIsDown = lt(h, h1) && le(h, 0);
      const histBIsUp = gt(h, h1) && le(h, 0);
      const macdIsAbove = ge(outMacD, outSignal);

      const plotColor = cfg.histColorChange
        ? histAIsUp ? AQUA : histAIsDown ? BLUE : histBIsDown ? RED : histBIsUp ? MAROON : YELLOW
        : GRAY;
      const macdColor = cfg.macdColorChange ? (macdIsAbove ? LIME : RED) : RED;
      const signalColor = cfg.macdColorChange ? YELLOW : LIME;

      // plot(smd and outMacD ? outMacD : na): a value of 0 or na is not drawn
      const p = s.plots;
      p[0]![i] = { time: t, value: cfg.showMacd && truthy(outMacD) ? outMacD : NaN, color: macdColor };
      p[1]![i] = { time: t, value: cfg.showMacd && truthy(outSignal) ? outSignal : NaN, color: signalColor };
      p[2]![i] = { time: t, value: cfg.showHistogram && truthy(h) ? h : NaN, color: plotColor };
      p[3]![i] = { time: t, value: cfg.showDots && crossed ? outSignal : NaN, color: macdColor };
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0]!.slice(), plot1: p[1]!.slice(), plot2: p[2]!.slice(), plot3: p[3]!.slice() },
        hlines: [{ value: 0, options: { title: '0 Line', color: '#FFFFFF', linestyle: 'solid', linewidth: 2 } }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CmMacdCustomMtfInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CmMacdCustomMtfInputs> = {}, chart?: ChartContext): IndicatorResult {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const CmMacdCustomMtf = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig };
