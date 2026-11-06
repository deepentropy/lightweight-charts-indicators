/**
 * CM Stochastic Multi-TimeFrame
 *
 * Stochastic %K = sma(stoch(close, high, low, length), smoothK) and %D = sma(%K, smoothD), computed on the chart
 * timeframe or on another timeframe of the same symbol, with an upper, a lower and a mid line. Background colours
 * and the letters B / S mark the crosses of %K and %D (strict: %K was beyond the lower / upper line on the bar
 * before; or any cross), and the background can show %K above / below the lines. An optional second stochastic has
 * its own timeframe and lengths.
 *
 * Other timeframe: the bars of that timeframe are built from the chart bars (periods from the UTC calendar and the
 * bars, see src/anchor-period.ts), so its values start at the first chart bar. As in the original (a version 1
 * script), every chart bar of a period shows the value of that period at its end (on past bars the value of a
 * period is known from its first bar; the last period is still open). A timeframe below the chart timeframe needs
 * data that the bars do not carry: the port throws an Error (for the second stochastic only when it is shown).
 *
 * Periods and the chart context (optional third argument of calculate): with the exchange time zone and the session
 * of the symbol (`timezone`, `session`) the periods are those of the exchange calendar (its trading days, holidays
 * and session hours), and a bar of a higher timeframe is complete on the chart bar whose close reaches the end of
 * its period, see src/anchor-period.ts.
 * Without them the port uses the UTC calendar and the bars, as described in this header. `timeframe`, when given,
 * is the chart timeframe; without it the chart timeframe is read from the bar spacing.
 *
 * Reference: "CM Stochastic Multi-TimeFrame" by ChrisMoody
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, taStep, Series, color, timeframe, resample, mapToChart,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import { periodStarts, chartTimeframe, securityBars } from '../anchor-period';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CmStochasticMtfInputs {
  len: number;
  smoothK: number;
  smoothD: number;
  upLine: number;
  lowLine: number;
  /** Show the mid line (50) */
  sml: boolean;
  /** Background when %K is above the upper / below the lower line */
  sbh: boolean;
  /** Background on a strict cross */
  sch: boolean;
  /** Letters B / S on a strict cross */
  sl: boolean;
  /** Background on any cross */
  sac: boolean;
  /** Letters B / S on any cross */
  sacl: boolean;
  /** Use the chart timeframe (the timeframe input is ignored) */
  useCurrentRes: boolean;
  /** Timeframe used when `useCurrentRes` is false ("60", "240", "D", "W", "M", ...) */
  resCustom: string;
  /** Show the second stochastic */
  ssStoch: boolean;
  /** Timeframe of the second stochastic, used when `useCurrentRes2` is false */
  resCustom2: string;
  /** Second stochastic on the chart timeframe */
  useCurrentRes2: boolean;
  len2: number;
  smoothK2: number;
  smoothD2: number;
}

export const defaultInputs: CmStochasticMtfInputs = {
  len: 14,
  smoothK: 3,
  smoothD: 3,
  upLine: 80,
  lowLine: 20,
  sml: true,
  sbh: false,
  sch: true,
  sl: true,
  sac: false,
  sacl: false,
  useCurrentRes: true,
  resCustom: '60',
  ssStoch: false,
  resCustom2: 'D',
  useCurrentRes2: false,
  len2: 14,
  smoothK2: 3,
  smoothD2: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Length for Main Stochastic', defval: 14, min: 1 },
  { id: 'smoothK', type: 'int', title: 'SmoothK for Main Stochastic', defval: 3, min: 1 },
  { id: 'smoothD', type: 'int', title: 'SmoothD for Main Stochastic', defval: 3, min: 1 },
  { id: 'upLine', type: 'int', title: 'Upper Line Value?', defval: 80, min: 50, max: 90 },
  { id: 'lowLine', type: 'int', title: 'Lower Line Value?', defval: 20, min: 10, max: 50 },
  { id: 'sml', type: 'bool', title: 'Show Mid Line?', defval: true },
  { id: 'sbh', type: 'bool', title: 'Show Back Ground Highlights When Stoch is Above/Below High/Low Lines?', defval: false },
  { id: 'sch', type: 'bool', title: 'Show Back Ground Highlights When Stoch Cross - Strict Criteria - K Greater/LesThan High/Low Line - Crosses D ?', defval: true },
  { id: 'sl', type: 'bool', title: "Show 'B' and 'S' Letters When Stoch Crosses High/Low Line & D?", defval: true },
  { id: 'sac', type: 'bool', title: 'Show Back Ground Highlights When Stoch Cross - Any Cross?', defval: false },
  { id: 'sacl', type: 'bool', title: "Show 'B' and 'S' Letters When Stoch Crosses - Any Cross?", defval: false },
  { id: 'useCurrentRes', type: 'bool', title: 'Use Current Chart Resolution?', defval: true },
  { id: 'resCustom', type: 'timeframe', title: 'Use Different Timeframe? Uncheck Box Above', defval: '60' },
  { id: 'ssStoch', type: 'bool', title: 'Show 2nd Stoch?', defval: false },
  { id: 'resCustom2', type: 'timeframe', title: 'Use 2nd Stoch? Check Box Above', defval: 'D' },
  { id: 'useCurrentRes2', type: 'bool', title: 'Use 2nd Stoch Plot On Samet Timeframe?', defval: false },
  { id: 'len2', type: 'int', title: '2nd Stoch Length', defval: 14, min: 1 },
  { id: 'smoothK2', type: 'int', title: 'SmoothK for 2nd Stoch', defval: 3, min: 1 },
  { id: 'smoothD2', type: 'int', title: 'SmoothD for 2nd Stoch', defval: 3, min: 1 },
];

// Colour constants of Pine version 1, with the default plot transparency of that version (35)
const LIME_HEX = '#00FF00';
const RED_HEX = '#FF0000';
const V1 = (hex: string) => String(color.new(hex, 35));
const LIME = V1(LIME_HEX);
const RED = V1(RED_HEX);

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Stoch K', color: LIME, lineWidth: 3 },
  { id: 'plot1', title: 'Stoch D', color: RED, lineWidth: 3 },
  { id: 'plot2', title: '2nd Stoch K - Different TimeFrame', color: V1('#FF7F00'), lineWidth: 3 },
  { id: 'plot3', title: '2nd Stoch D - Different TimeFrame', color: V1('#FFFF00'), lineWidth: 3 },
  { id: 'plot4', title: 'Upper Line', color: RED, lineWidth: 3 },
  { id: 'plot5', title: 'Lower Line', color: LIME, lineWidth: 3 },
  { id: 'plot6', title: 'Mid Line', color: V1('#808080'), lineWidth: 2, style: 'linebr' },
];

export const metadata = {
  title: 'CM_Stochastic_MTF',
  shortTitle: 'CM_Stoch_MTF',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
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

/** k = sma(stoch(close, high, low, len), smoothK), d = sma(k, smoothD) on timeframe `tf`, on the chart bars */
function stochastic(bars: Bar[], tf: string, len: number, smoothK: number, smoothD: number, context?: ChartContext): { k: number[]; d: number[] } {
  const { htf, toChart } = timeframeBars(bars, tf, context);
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (f: (b: Bar) => number) => Series.fromArray(htf, htf.map(f));
  const k = ta.sma(ta.stoch(S((b) => b.close), S((b) => b.high), S((b) => b.low), len), smoothK);
  const d = ta.sma(k, smoothD);
  return { k: toChart(A(k)), d: toChart(A(d)) };
}

/** k = sma(stoch(close, high, low, len), smoothK), d = sma(k, smoothD) on the chart timeframe, bar by bar */
class StochSteps {
  private readonly stoch: ReturnType<typeof taStep.stoch>;
  private readonly smaK: WindowSma;
  private readonly smaD: WindowSma;
  k = NaN;
  d = NaN;

  constructor(len: number, smoothK: number, smoothD: number) {
    this.stoch = taStep.stoch(len);
    this.smaK = new WindowSma(smoothK);
    this.smaD = new WindowSma(smoothD);
  }

  step(b: Bar): void {
    this.k = this.smaK.step(this.stoch.step(b.close, b.high, b.low));
    this.d = this.smaD.step(this.k);
  }

  commit(): void {
    this.stoch.commit();
    this.smaK.commit();
    this.smaD.commit();
  }
}

type Point = { time: number; value: number };

interface StochRun extends BarRunState<Record<string, never>> {
  /** The chart timeframe stochastics (null: on another timeframe, from `pre`) */
  main: StochSteps | null;
  sec: StochSteps | null;
  pre: { k: number[]; d: number[] } | null;
  pre2: { k: number[]; d: number[] } | null;
  outK: number[];
  outD: number[];
  plots: Point[][];
  bgColors: BgColorData[];
  markers: MarkerData[];
}

function study(inputs: Partial<CmStochasticMtfInputs>): BarStudy<StochRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const { upLine, lowLine } = cfg;
  const secondOn = cfg.ssStoch;
  const red70 = String(color.new(RED_HEX, 70));
  const lime70 = String(color.new(LIME_HEX, 70));
  const red40 = String(color.new(RED_HEX, 40));
  const lime40 = String(color.new(LIME_HEX, 40));
  return {
    // another timeframe: every chart bar of a period shows the value at its end (earlier bars change)
    fullRunReason: () => (!cfg.useCurrentRes || (secondOn && !cfg.useCurrentRes2) ? 'other timeframe' : null),
    init(bars, chart) {
      // res = useCurrentRes ? period : resCustom; res2 = useCurrentRes2 ? period : resCustom2
      const pre = cfg.useCurrentRes ? null : stochastic(bars, cfg.resCustom, cfg.len, cfg.smoothK, cfg.smoothD, chart);
      // The second stochastic is only drawn when ssStoch is on: it is not computed otherwise
      const pre2 = secondOn && !cfg.useCurrentRes2
        ? stochastic(bars, cfg.resCustom2, cfg.len2, cfg.smoothK2, cfg.smoothD2, chart)
        : null;
      const main = pre ? null : new StochSteps(cfg.len, cfg.smoothK, cfg.smoothD);
      const sec = secondOn && !pre2 ? new StochSteps(cfg.len2, cfg.smoothK2, cfg.smoothD2) : null;
      const s: StochRun = {
        main, sec, pre, pre2, outK: [], outD: [], plots: [[], [], [], [], [], [], []], bgColors: [], markers: [],
        steps: [...(main ? [main] : []), ...(sec ? [sec] : [])], vars: {}, lists: [], series: [],
      };
      s.lists = [s.bgColors, s.markers];
      s.series = [s.outK, s.outD, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time;
      let k: number;
      let d: number;
      if (s.main) {
        s.main.step(bars[i]);
        k = s.main.k;
        d = s.main.d;
      } else {
        k = s.pre!.k[i];
        d = s.pre!.d[i];
      }
      s.outK[i] = k;
      s.outD[i] = d;
      let k2 = NaN;
      let d2 = NaN;
      if (s.sec) {
        s.sec.step(bars[i]);
        k2 = s.sec.k;
        d2 = s.sec.d;
      } else if (s.pre2) {
        k2 = s.pre2.k[i];
        d2 = s.pre2.d[i];
      }
      const k1 = i > 0 ? s.outK[i - 1] : NaN;
      const d1 = i > 0 ? s.outD[i - 1] : NaN;
      const aboveLine = gt(k, upLine);
      const belowLine = lt(k, lowLine);
      const crossUp = lt(k1, d1) && lt(k1, lowLine) && gt(k, d);
      const crossDn = gt(k1, d1) && gt(k1, upLine) && lt(k, d);
      const crossUpAll = lt(k1, d1) && gt(k, d);
      const crossDownAll = gt(k1, d1) && lt(k, d);

      // Six bgcolor calls, in the order of the original (a later call is drawn over an earlier one)
      const bg = s.bgColors;
      if (cfg.sbh && aboveLine) bg.push({ id: 'bgcolor0', time, color: red70 });
      if (cfg.sbh && belowLine) bg.push({ id: 'bgcolor1', time, color: lime70 });
      if (cfg.sch && crossUp) bg.push({ id: 'bgcolor2', time, color: lime40 });
      if (cfg.sch && crossDn) bg.push({ id: 'bgcolor3', time, color: red40 });
      if (cfg.sac && crossUpAll) bg.push({ id: 'bgcolor4', time, color: lime40 });
      if (cfg.sac && crossDownAll) bg.push({ id: 'bgcolor5', time, color: red40 });

      const p = s.plots;
      p[0][i] = { time, value: k };
      p[1][i] = { time, value: d };
      // plot(ssStoch and outK2 ? outK2 : na): a value of 0 or na is not drawn
      p[2][i] = { time, value: secondOn && truthy(k2) ? k2 : NaN };
      p[3][i] = { time, value: secondOn && truthy(d2) ? d2 : NaN };
      p[4][i] = { time, value: upLine };
      p[5][i] = { time, value: lowLine };
      p[6][i] = { time, value: cfg.sml ? 50 : NaN };

      // plotchar 'B' at the bottom / 'S' at the top (transp = 0)
      const m = s.markers;
      if (cfg.sl && crossUp) m.push({ id: 'char0', time, position: 'bottom', shape: 'circle', color: 'transparent', text: 'B', textColor: LIME_HEX });
      if (cfg.sl && crossDn) m.push({ id: 'char1', time, position: 'top', shape: 'circle', color: 'transparent', text: 'S', textColor: RED_HEX });
      if (cfg.sacl && crossUpAll) m.push({ id: 'char2', time, position: 'bottom', shape: 'circle', color: 'transparent', text: 'B', textColor: LIME_HEX });
      if (cfg.sacl && crossDownAll) m.push({ id: 'char3', time, position: 'top', shape: 'circle', color: 'transparent', text: 'S', textColor: RED_HEX });
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice(),
          plot5: p[5].slice(), plot6: p[6].slice(),
        },
        // fill(p1, p2, color = silver, transp = 70)
        fills: [{ plot1: 'plot4', plot2: 'plot5', options: { color: String(color.new('#C0C0C0', 70)) } }],
        bgColors: s.bgColors.slice(),
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CmStochasticMtfInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CmStochasticMtfInputs> = {}, chart?: ChartContext): IndicatorResult {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const CmStochasticMtf = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
