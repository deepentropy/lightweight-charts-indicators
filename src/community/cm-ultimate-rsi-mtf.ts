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
 * Periods and the chart context (optional third argument of calculate): with the exchange time zone and the session
 * of the symbol (`timezone`, `session`) the periods are those of the exchange calendar (its trading days, holidays
 * and session hours), and a bar of a higher timeframe is complete on the chart bar whose close reaches the end of
 * its period, see src/anchor-period.ts.
 * Without them the port uses the UTC calendar and the bars, as described in this header. `timeframe`, when given,
 * is the chart timeframe; without it the chart timeframe is read from the bar spacing.
 *
 * Reference: "CM_Ultimate RSI Multi Time Frame" by ChrisMoody
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, taStep, Series, color, timeframe, resample, mapToChart,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import { periodStarts, chartTimeframe, securityBars } from '../anchor-period';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

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

/**
 * up = rma(max(change(close), 0), len), down = rma(-min(change(close), 0), len),
 * rsi = down == 0 ? 100 : up == 0 ? 0 : 100 - 100 / (1 + up / down), on timeframe `tf`, on the chart bars
 */
function rsiOf(bars: Bar[], tf: string, len: number, context?: ChartContext): number[] {
  const { htf, toChart } = timeframeBars(bars, tf, context);
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const change = htf.map((b, i) => (i > 0 ? b.close - htf[i - 1].close : NaN));
  const up = A(ta.rma(Series.fromArray(htf, change.map((c) => (isNaN(c) ? NaN : Math.max(c, 0)))), len));
  const down = A(ta.rma(Series.fromArray(htf, change.map((c) => (isNaN(c) ? NaN : -Math.min(c, 0)))), len));
  return toChart(up.map((u, i) => (eq(down[i], 0) ? 100 : eq(u, 0) ? 0 : 100 - 100 / (1 + u / down[i]))));
}

/** The RSI of the chart timeframe one bar at a time (rsiOf with the chart timeframe: the same doubles) */
class ChartRsi {
  private readonly up: ReturnType<typeof taStep.rma>;
  private readonly down: ReturnType<typeof taStep.rma>;
  private prev = NaN;
  private pending = NaN;

  constructor(len: number) {
    this.up = taStep.rma(len);
    this.down = taStep.rma(len);
  }

  step(i: number, close: number): number {
    this.pending = close;
    const c = i > 0 ? close - this.prev : NaN;
    const u = this.up.step(isNaN(c) ? NaN : Math.max(c, 0)) ?? NaN;
    const d = this.down.step(isNaN(c) ? NaN : -Math.min(c, 0)) ?? NaN;
    return eq(d, 0) ? 100 : eq(u, 0) ? 0 : 100 - 100 / (1 + u / d);
  }

  commit(): void {
    this.prev = this.pending;
    this.up.commit();
    this.down.commit();
  }
}

type Point = { time: number; value: number };

interface CmRsiRun extends BarRunState<Record<string, never>> {
  /** RSI machines on the chart timeframe, else the values of the other timeframe (computed on the whole bars) */
  rsi: ChartRsi | number[];
  rsi2: ChartRsi | number[] | null;
  outRSI: number[];
  plots: Point[][];
  bgColors: BgColorData[];
  markers: MarkerData[];
}

function study(inputs: Partial<CmUltimateRsiMtfInputs>): BarStudy<CmRsiRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const { upLine, lowLine } = cfg;
  const red70 = String(color.new(RED_HEX, 70));
  const green70 = String(color.new(GREEN_HEX, 70));
  const red40 = String(color.new(RED_HEX, 40));
  const lime40 = String(color.new(LIME_HEX, 40));
  // res = useCurrentRes ? period : resCustom; res2 = useCurrentRes2 ? period : resCustom2
  const res = cfg.useCurrentRes ? '' : cfg.resCustom;
  const res2 = cfg.useCurrentRes2 ? '' : cfg.resCustom2;
  const otherTf = res.trim() !== '' || (cfg.ssRSI && res2.trim() !== '');
  return {
    // every chart bar of a period shows the value of the period at its end: a later bar changes the earlier ones
    fullRunReason: () => (otherTf ? 'other timeframe (the bars of a period show its value at its end)' : null),
    init(bars, chart) {
      const ctx = Object.keys(chart).length > 0 ? chart : undefined;
      const rsi = res.trim() === '' ? new ChartRsi(cfg.len) : rsiOf(bars, res, cfg.len, ctx);
      // The second RSI is only drawn when ssRSI is on: it is not computed otherwise
      const rsi2 = !cfg.ssRSI ? null : res2.trim() === '' ? new ChartRsi(cfg.len2) : rsiOf(bars, res2, cfg.len2, ctx);
      const s: CmRsiRun = {
        rsi, rsi2, outRSI: [], plots: [[], [], [], [], []], bgColors: [], markers: [],
        steps: [rsi, rsi2].filter((m): m is ChartRsi => m instanceof ChartRsi), vars: {}, lists: [], series: [],
      };
      s.lists = [s.bgColors, s.markers];
      s.series = [s.outRSI, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const { time, close } = bars[i];
      const rsi = s.rsi instanceof ChartRsi ? s.rsi.step(i, close) : s.rsi[i];
      const rsi2 = s.rsi2 === null ? NaN : s.rsi2 instanceof ChartRsi ? s.rsi2.step(i, close) : s.rsi2[i];
      s.outRSI[i] = rsi;
      const rsi1 = i > 0 ? s.outRSI[i - 1] : NaN;
      const aboveLine = gt(rsi, upLine);
      const belowLine = lt(rsi, lowLine);
      const crossUp = lt(rsi1, lowLine) && gt(rsi, lowLine);
      const crossDn = gt(rsi1, upLine) && lt(rsi, upLine);

      // Four bgcolor calls, in the order of the original (a later call is drawn over an earlier one)
      const bgColors = s.bgColors;
      if (cfg.sbh && aboveLine) bgColors.push({ time, color: red70 });
      if (cfg.sbh && belowLine) bgColors.push({ time, color: green70 });
      if (cfg.sch && crossUp) bgColors.push({ time, color: lime40 });
      if (cfg.sch && crossDn) bgColors.push({ time, color: red40 });

      const p = s.plots;
      p[0][i] = { time, value: rsi };
      // plot(ssRSI and outRSI2 ? outRSI2 : na): a value of 0 or na is not drawn
      p[1][i] = { time, value: s.rsi2 !== null && truthy(rsi2) ? rsi2 : NaN };
      p[2][i] = { time, value: upLine };
      p[3][i] = { time, value: lowLine };
      p[4][i] = { time, value: cfg.sml ? 50 : NaN };

      // plotchar 'B' at the bottom / 'S' at the top (transp = 0)
      if (cfg.sl && crossUp) s.markers.push({ time, position: 'bottom', shape: 'circle', color: 'transparent', text: 'B', textColor: LIME_HEX });
      if (cfg.sl && crossDn) s.markers.push({ time, position: 'top', shape: 'circle', color: 'transparent', text: 'S', textColor: RED_HEX });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice(), plot3: s.plots[3].slice(), plot4: s.plots[4].slice() },
        // fill(p1, p2, color = silver, transp = 70)
        fills: [{ plot1: 'plot2', plot2: 'plot3', options: { color: String(color.new('#C0C0C0', 70)) } }],
        bgColors: s.bgColors.slice(),
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CmUltimateRsiMtfInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CmUltimateRsiMtfInputs> = {}, chart?: ChartContext): IndicatorResult {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const CmUltimateRsiMtf = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
