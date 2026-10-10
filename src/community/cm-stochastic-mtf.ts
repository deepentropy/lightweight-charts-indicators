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
 * Reference: "CM Stochastic Multi-TimeFrame" by ChrisMoody
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, timeframe, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import { periodStarts, chartTimeframe } from '../anchor-period';

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
function timeframeBars(bars: Bar[], tf: string): { htf: Bar[]; toChart: (values: number[]) => number[] } {
  const chart = chartTimeframe(bars);
  if (tf.trim() === '' || chart === '' || timeframe.in_seconds(tf) === timeframe.in_seconds(chart)) {
    return { htf: bars, toChart: (values) => values };
  }
  if (timeframe.in_seconds(tf) < timeframe.in_seconds(chart)) {
    throw new Error(`The timeframe "${tf}" is lower than the chart timeframe "${chart}": the bars do not carry that data.`);
  }
  const starts = periodStarts(bars, tf);
  const htf: Bar[] = [];
  const group: number[] = [];
  bars.forEach((b, i) => {
    if (i === 0 || starts[i] !== starts[i - 1]) {
      htf.push({ time: starts[i], open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume ?? NaN });
    } else {
      const last = htf[htf.length - 1];
      last.high = Math.max(last.high, b.high);
      last.low = Math.min(last.low, b.low);
      last.close = b.close;
      last.volume = (last.volume ?? NaN) + (b.volume ?? NaN);
    }
    group.push(htf.length - 1);
  });
  return { htf, toChart: (values) => group.map((g) => values[g]) };
}

/** k = sma(stoch(close, high, low, len), smoothK), d = sma(k, smoothD) on timeframe `tf`, on the chart bars */
function stochastic(bars: Bar[], tf: string, len: number, smoothK: number, smoothD: number): { k: number[]; d: number[] } {
  const { htf, toChart } = timeframeBars(bars, tf);
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (f: (b: Bar) => number) => Series.fromArray(htf, htf.map(f));
  const k = ta.sma(ta.stoch(S((b) => b.close), S((b) => b.high), S((b) => b.low), len), smoothK);
  const d = ta.sma(k, smoothD);
  return { k: toChart(A(k)), d: toChart(A(d)) };
}

export function calculate(bars: Bar[], inputs: Partial<CmStochasticMtfInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const { upLine, lowLine } = cfg;

  // res = useCurrentRes ? period : resCustom; res2 = useCurrentRes2 ? period : resCustom2
  const { k: outK, d: outD } = stochastic(bars, cfg.useCurrentRes ? '' : cfg.resCustom, cfg.len, cfg.smoothK, cfg.smoothD);
  // The second stochastic is only drawn when ssStoch is on: it is not computed otherwise
  const second = cfg.ssStoch
    ? stochastic(bars, cfg.useCurrentRes2 ? '' : cfg.resCustom2, cfg.len2, cfg.smoothK2, cfg.smoothD2)
    : null;

  const red70 = String(color.new(RED_HEX, 70));
  const lime70 = String(color.new(LIME_HEX, 70));
  const red40 = String(color.new(RED_HEX, 40));
  const lime40 = String(color.new(LIME_HEX, 40));

  const point = (i: number, value: number) => ({ time: bars[i].time, value });
  const plots: Record<string, Array<{ time: number; value: number }>> = {
    plot0: [], plot1: [], plot2: [], plot3: [], plot4: [], plot5: [], plot6: [],
  };
  const bgColors: BgColorData[] = [];
  const markers: MarkerData[] = [];
  for (let i = 0; i < n; i++) {
    const time = bars[i].time;
    const k1 = i > 0 ? outK[i - 1] : NaN;
    const d1 = i > 0 ? outD[i - 1] : NaN;
    const aboveLine = gt(outK[i], upLine);
    const belowLine = lt(outK[i], lowLine);
    const crossUp = lt(k1, d1) && lt(k1, lowLine) && gt(outK[i], outD[i]);
    const crossDn = gt(k1, d1) && gt(k1, upLine) && lt(outK[i], outD[i]);
    const crossUpAll = lt(k1, d1) && gt(outK[i], outD[i]);
    const crossDownAll = gt(k1, d1) && lt(outK[i], outD[i]);

    // Six bgcolor calls, in the order of the original (a later call is drawn over an earlier one)
    if (cfg.sbh && aboveLine) bgColors.push({ time, color: red70 });
    if (cfg.sbh && belowLine) bgColors.push({ time, color: lime70 });
    if (cfg.sch && crossUp) bgColors.push({ time, color: lime40 });
    if (cfg.sch && crossDn) bgColors.push({ time, color: red40 });
    if (cfg.sac && crossUpAll) bgColors.push({ time, color: lime40 });
    if (cfg.sac && crossDownAll) bgColors.push({ time, color: red40 });

    plots.plot0.push(point(i, outK[i]));
    plots.plot1.push(point(i, outD[i]));
    // plot(ssStoch and outK2 ? outK2 : na): a value of 0 or na is not drawn
    plots.plot2.push(point(i, second && truthy(second.k[i]) ? second.k[i] : NaN));
    plots.plot3.push(point(i, second && truthy(second.d[i]) ? second.d[i] : NaN));
    plots.plot4.push(point(i, upLine));
    plots.plot5.push(point(i, lowLine));
    plots.plot6.push(point(i, cfg.sml ? 50 : NaN));

    // plotchar 'B' at the bottom / 'S' at the top (transp = 0)
    const letter = (on: boolean, text: string, position: 'bottom' | 'top', textColor: string) => {
      if (on) markers.push({ time, position, shape: 'circle', color: 'transparent', text, textColor });
    };
    letter(cfg.sl && crossUp, 'B', 'bottom', LIME_HEX);
    letter(cfg.sl && crossDn, 'S', 'top', RED_HEX);
    letter(cfg.sacl && crossUpAll, 'B', 'bottom', LIME_HEX);
    letter(cfg.sacl && crossDownAll, 'S', 'top', RED_HEX);
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    // fill(p1, p2, color = silver, transp = 70)
    fills: [{ plot1: 'plot4', plot2: 'plot5', options: { color: String(color.new('#C0C0C0', 70)) } }],
    bgColors,
    markers,
  };
}

export const CmStochasticMtf = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
