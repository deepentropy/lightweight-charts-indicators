/**
 * CM Ultimate RSI Multi Time Frame
 *
 * RSI of the close (Wilder averages of the up and down moves) computed on the chart timeframe or on another
 * timeframe of the same symbol, with an upper, a lower and a mid line. The background shows the RSI above the upper
 * line (red) or below the lower line (green); a stronger background and the letters B / S mark the bars where the
 * RSI comes back above the lower line (B) or back below the upper line (S). An optional second RSI has its own
 * timeframe and length.
 *
 * Other timeframe: the bars of that timeframe are built from the chart bars (periods from the UTC calendar and the
 * bars, see src/anchor-period.ts), so its averages start at the first chart bar. As in the original (a version 1
 * script), every chart bar of a period shows the value of that period at its end (on past bars the value of a
 * period is known from its first bar; the last period is still open). A timeframe below the chart timeframe needs
 * data that the bars do not carry: the port throws an Error (for the second RSI only when it is shown).
 * The original shows its values without decimals (precision = 0).
 *
 * Reference: "CM_Ultimate RSI Multi Time Frame" by ChrisMoody
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, timeframe, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import { periodStarts, chartTimeframe } from '../anchor-period';

export interface CmUltimateRsiMtfInputs {
  len: number;
  upLine: number;
  lowLine: number;
  /** Show the mid line (50) */
  sml: boolean;
  /** Background when the RSI is above the upper / below the lower line */
  sbh: boolean;
  /** Background when the RSI crosses back over a line */
  sch: boolean;
  /** Letters B / S when the RSI crosses back over a line */
  sl: boolean;
  /** Use the chart timeframe (the timeframe input is ignored) */
  useCurrentRes: boolean;
  /** Timeframe used when `useCurrentRes` is false ("60", "240", "D", "W", "M", ...) */
  resCustom: string;
  /** Show the second RSI */
  ssRSI: boolean;
  /** Timeframe of the second RSI, used when `useCurrentRes2` is false */
  resCustom2: string;
  /** Second RSI on the chart timeframe */
  useCurrentRes2: boolean;
  len2: number;
}

export const defaultInputs: CmUltimateRsiMtfInputs = {
  len: 14,
  upLine: 70,
  lowLine: 30,
  sml: true,
  sbh: true,
  sch: true,
  sl: true,
  useCurrentRes: true,
  resCustom: '60',
  ssRSI: false,
  resCustom2: 'D',
  useCurrentRes2: false,
  len2: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Length', defval: 14, min: 1 },
  { id: 'upLine', type: 'int', title: 'Upper Line Value?', defval: 70, min: 50, max: 90 },
  { id: 'lowLine', type: 'int', title: 'Lower Line Value?', defval: 30, min: 10, max: 50 },
  { id: 'sml', type: 'bool', title: 'Show Mid Line?', defval: true },
  { id: 'sbh', type: 'bool', title: 'Show Back Ground Highlights When RSI is Above/Below High/Low Lines?', defval: true },
  { id: 'sch', type: 'bool', title: 'Show Back Ground Highlights When RSI Cross?', defval: true },
  { id: 'sl', type: 'bool', title: "Show 'B' and 'S' Letters When RSI Crosses High/Low Line?", defval: true },
  { id: 'useCurrentRes', type: 'bool', title: 'Use Current Chart Resolution?', defval: true },
  { id: 'resCustom', type: 'timeframe', title: 'Use Different Timeframe? Uncheck Box Above', defval: '60' },
  { id: 'ssRSI', type: 'bool', title: 'Show 2nd RSI?', defval: false },
  { id: 'resCustom2', type: 'timeframe', title: 'Use 2nd RSI? Check Box Above', defval: 'D' },
  { id: 'useCurrentRes2', type: 'bool', title: 'Use 2nd RSI Plot On Samet Timeframe?', defval: false },
  { id: 'len2', type: 'int', title: '2nd RSI Length', defval: 14, min: 1 },
];

// Colour constants of Pine version 1, with the default plot transparency of that version (35)
const LIME_HEX = '#00FF00';
const RED_HEX = '#FF0000';
const GREEN_HEX = '#008000';
const V1 = (hex: string) => String(color.new(hex, 35));
const LIME = V1(LIME_HEX);
const RED = V1(RED_HEX);

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: V1('#00FFFF'), lineWidth: 3 },
  { id: 'plot1', title: '2nd RSI - Different Time Frame?', color: V1('#FF7F00'), lineWidth: 4, style: 'linebr' },
  { id: 'plot2', title: 'Upper Line', color: RED, lineWidth: 3 },
  { id: 'plot3', title: 'Lower Line', color: LIME, lineWidth: 3 },
  { id: 'plot4', title: 'Mid Line', color: V1('#808080'), lineWidth: 2, style: 'linebr' },
];

export const metadata = {
  title: 'CM_Ultimate RSI MTF',
  shortTitle: 'CM_Ult_RSI_MTF',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
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

/**
 * up = rma(max(change(close), 0), len), down = rma(-min(change(close), 0), len),
 * rsi = down == 0 ? 100 : up == 0 ? 0 : 100 - 100 / (1 + up / down), on timeframe `tf`, on the chart bars
 */
function rsiOf(bars: Bar[], tf: string, len: number): number[] {
  const { htf, toChart } = timeframeBars(bars, tf);
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const change = htf.map((b, i) => (i > 0 ? b.close - htf[i - 1].close : NaN));
  const up = A(ta.rma(Series.fromArray(htf, change.map((c) => (isNaN(c) ? NaN : Math.max(c, 0)))), len));
  const down = A(ta.rma(Series.fromArray(htf, change.map((c) => (isNaN(c) ? NaN : -Math.min(c, 0)))), len));
  return toChart(up.map((u, i) => (eq(down[i], 0) ? 100 : eq(u, 0) ? 0 : 100 - 100 / (1 + u / down[i]))));
}

export function calculate(bars: Bar[], inputs: Partial<CmUltimateRsiMtfInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const { upLine, lowLine } = cfg;

  // res = useCurrentRes ? period : resCustom; res2 = useCurrentRes2 ? period : resCustom2
  const outRSI = rsiOf(bars, cfg.useCurrentRes ? '' : cfg.resCustom, cfg.len);
  // The second RSI is only drawn when ssRSI is on: it is not computed otherwise
  const outRSI2 = cfg.ssRSI ? rsiOf(bars, cfg.useCurrentRes2 ? '' : cfg.resCustom2, cfg.len2) : null;

  const red70 = String(color.new(RED_HEX, 70));
  const green70 = String(color.new(GREEN_HEX, 70));
  const red40 = String(color.new(RED_HEX, 40));
  const lime40 = String(color.new(LIME_HEX, 40));

  const plots: Record<string, Array<{ time: number; value: number }>> = { plot0: [], plot1: [], plot2: [], plot3: [], plot4: [] };
  const bgColors: BgColorData[] = [];
  const markers: MarkerData[] = [];
  for (let i = 0; i < n; i++) {
    const time = bars[i].time;
    const rsi = outRSI[i];
    const rsi1 = i > 0 ? outRSI[i - 1] : NaN;
    const aboveLine = gt(rsi, upLine);
    const belowLine = lt(rsi, lowLine);
    const crossUp = lt(rsi1, lowLine) && gt(rsi, lowLine);
    const crossDn = gt(rsi1, upLine) && lt(rsi, upLine);

    // Four bgcolor calls, in the order of the original (a later call is drawn over an earlier one)
    if (cfg.sbh && aboveLine) bgColors.push({ time, color: red70 });
    if (cfg.sbh && belowLine) bgColors.push({ time, color: green70 });
    if (cfg.sch && crossUp) bgColors.push({ time, color: lime40 });
    if (cfg.sch && crossDn) bgColors.push({ time, color: red40 });

    plots.plot0.push({ time, value: rsi });
    // plot(ssRSI and outRSI2 ? outRSI2 : na): a value of 0 or na is not drawn
    plots.plot1.push({ time, value: outRSI2 && truthy(outRSI2[i]) ? outRSI2[i] : NaN });
    plots.plot2.push({ time, value: upLine });
    plots.plot3.push({ time, value: lowLine });
    plots.plot4.push({ time, value: cfg.sml ? 50 : NaN });

    // plotchar 'B' at the bottom / 'S' at the top (transp = 0)
    if (cfg.sl && crossUp) markers.push({ time, position: 'bottom', shape: 'circle', color: 'transparent', text: 'B', textColor: LIME_HEX });
    if (cfg.sl && crossDn) markers.push({ time, position: 'top', shape: 'circle', color: 'transparent', text: 'S', textColor: RED_HEX });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    // fill(p1, p2, color = silver, transp = 70)
    fills: [{ plot1: 'plot2', plot2: 'plot3', options: { color: String(color.new('#C0C0C0', 70)) } }],
    bgColors,
    markers,
  };
}

export const CmUltimateRsiMtf = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
