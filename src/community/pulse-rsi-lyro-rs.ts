/**
 * Pulse RSI | Lyro RS
 *
 * An RSI of a volume-weighted price trend: help = sqrt(close * high * low * |volume|), smoothed by an SMA of `len`
 * bars and a linear regression of `len` bars. The rises and falls of that regression line are averaged with two
 * EMAs of `len` bars, and res = 100 - 100 / (1 + ema(up) / ema(down)). The line, its glow and the price candles take
 * the up / down colour (Type 1: res against res[1] / res[2]; Type 2: res against 50). Labels mark the crosses of
 * res with res[1] (Type 1) and with 50 (Type 2), triangles the crosses of 30 / 70 (Type 3) and arrows the crosses of
 * the custom thresholds (Type 4), which are also drawn as lines.
 * Alerts (alertcondition, `alerts` of the result): the original's eight conditions, true on every bar where res is
 * above / below res[1] (Type 1), 50 (Type 2), 30 / 70 (Type 3) or the long / short thresholds (Type 4).
 *
 * Reference: "Pulse RSI | Lyro RS" by LyroRS
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LyroRS
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PulseRsiLyroRsInputs {
  /** Length of the SMA, the linear regression and the EMAs */
  len: number;
  /** Type 4 long threshold (also drawn as a line) */
  thresholdLong: number;
  /** Type 4 short threshold (also drawn as a line) */
  thresholdShort: number;
  /** Type 1 (trend: res against res[1]) colours and labels */
  sigType1Enable: boolean;
  /** Type 2 (trend: res against 50) colours and labels */
  sigType2Enable: boolean;
  /** Type 3 (crosses of 30 / 70) triangles */
  sigType3Enable: boolean;
  /** Type 4 (crosses of the custom thresholds) arrows */
  sigType4Enable: boolean;
  /** Palette used when the custom palette is off */
  colMode: 'Classic' | 'Mystic' | 'Accented' | 'Royal';
  /** Use the custom up / down colours */
  cpyn: boolean;
  cpUpC: string;
  cpDnC: string;
}

export const defaultInputs: PulseRsiLyroRsInputs = {
  len: 55,
  thresholdLong: 10,
  thresholdShort: 15,
  sigType1Enable: false,
  sigType2Enable: true,
  sigType3Enable: true,
  sigType4Enable: false,
  colMode: 'Mystic',
  cpyn: false,
  cpUpC: '#00ff00',
  cpDnC: '#ff0000',
};

const INDI = 'Indicator Settings';
const COLORS = 'Color Settings';
const SIGNAL = 'Signal Settings';

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Length', defval: 55, group: INDI, tooltip: 'Adjust the Length of the Indicator' },
  { id: 'thresholdLong', type: 'int', title: 'Threshold Long', defval: 10, step: 1, group: INDI,
    tooltip: 'Adjust Threshold for Long signals to Fire, NOTE: Enable Type 4' },
  { id: 'thresholdShort', type: 'int', title: 'Threshold Short', defval: 15, step: 1, group: INDI,
    tooltip: 'Adjust Threshold for Short signals to Fire, NOTE: Enable Type 4' },
  { id: 'sigType1Enable', type: 'bool', title: 'Trend - Type 1', defval: false, group: SIGNAL,
    tooltip: 'Enable Type 1 Conditions (res > res[1]), Trend' },
  { id: 'sigType2Enable', type: 'bool', title: 'Trend - Type 2', defval: true, group: SIGNAL,
    tooltip: 'Enable Type 2 Conditions (res > 50), Trend' },
  { id: 'sigType3Enable', type: 'bool', title: 'Oversold / Overbought', defval: true, group: SIGNAL,
    tooltip: 'Enable Type 3 Conditions (res > 30 / 70), Oversold and Overbought' },
  { id: 'sigType4Enable', type: 'bool', title: 'Custom Threshold L/S', defval: false, group: SIGNAL,
    tooltip: 'Enable Type 4 Conditions (res > Threshold Long / Short), Custom Signals' },
  { id: 'colMode', type: 'string', title: 'Custom Color Palette', defval: 'Mystic', options: ['Classic', 'Mystic', 'Accented', 'Royal'],
    group: COLORS, inline: 'drop', display: 'none', tooltip: 'Choose a predefined color scheme for indicator visualization.' },
  { id: 'cpyn', type: 'bool', title: 'Use Custom Palette', defval: false, group: COLORS, display: 'none',
    tooltip: 'Enable manual selection of custom colors for trend signals.' },
  { id: 'cpUpC', type: 'color', title: 'Custom Up', defval: '#00ff00', group: COLORS, inline: 'Custom Palette', display: 'none',
    tooltip: 'Set a custom color for bullish signals.' },
  { id: 'cpDnC', type: 'color', title: 'Custom Down', defval: '#ff0000', group: COLORS, inline: 'Custom Palette', display: 'none',
    tooltip: 'Set a custom color for bearish signals.' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Main Plot Line', color: '#30FDCF', lineWidth: 2 },
  { id: 'plot1', title: 'Glow Effect', color: String(color.new('#30FDCF', 75)), lineWidth: 10, display: 'pane' },
  { id: 'plot2', title: 'Threshold Long', color: String(color.new('#30FDCF', 30)), lineWidth: 1 },
  { id: 'plot3', title: 'Threshold Short', color: String(color.new('#E117B7', 30)), lineWidth: 1 },
];

export const metadata = {
  title: 'Pulse RSI | Lyro RS',
  shortTitle: 'Pulse RSI | Lyro RS',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

const PALETTES: Record<PulseRsiLyroRsInputs['colMode'], [string, string]> = {
  Classic: ['#00E676', '#880E4F'],
  Mystic: ['#30FDCF', '#E117B7'],
  Accented: ['#9618F7', '#FF0078'],
  Royal: ['#FFC107', '#673AB7'],
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> }
  & { alerts: AlertConditionState[] };

interface PulseVars {
  /** var colType1 / colType2 */
  c1: string | null;
  c2: string | null;
  /** Per cross (res with res[1], 50, 30, 70, long, short): res and the level on the last bar where both were not na */
  pa: number[];
  pb: number[];
}

interface PulseRun extends BarRunState<PulseVars> {
  sma: ReturnType<typeof taStep.sma>;
  linreg: ReturnType<typeof taStep.linreg>;
  emaU: ReturnType<typeof taStep.ema>;
  emaD: ReturnType<typeof taStep.ema>;
  help2: number[];
  res: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  candles: PlotCandleData[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<PulseRsiLyroRsInputs>): BarStudy<PulseRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.len;
  // switch ColMode (an unknown mode leaves UpC / DnC na); if cpyn: the custom colours
  const pal = PALETTES[cfg.colMode] as [string, string] | undefined;
  const upC: string | null = cfg.cpyn ? cfg.cpUpC : pal ? pal[0] : null;
  const dnC: string | null = cfg.cpyn ? cfg.cpDnC : pal ? pal[1] : null;
  const NA = 'transparent';
  const val = (v: number) => (Number.isFinite(v) ? v : NaN);
  const lineCol = (c: string | null, tr: number) => (c === null ? String(color.new('#000000', tr)) : String(color.new(c, tr)));
  const upLine = lineCol(upC, 30);
  const dnLine = lineCol(dnC, 30);
  // color.new(pc, 75) of the few line colours
  const glows = new Map<string | null, string>();
  const glowOf = (c: string | null): string => {
    let g = glows.get(c);
    if (g === undefined) { g = String(color.new(c ?? '#000000', 75)); glows.set(c, g); }
    return g;
  };
  // per-bar scratch values (written again on every bar)
  const over = [false, false, false, false, false, false];
  const under = [false, false, false, false, false, false];
  const levels = [NaN, 50, 30, 70, cfg.thresholdLong, cfg.thresholdShort];
  const flags = [false, false, false, false, false, false, false, false];
  const add = (s: PulseRun, t: number, m: Omit<MarkerData, 'time' | 'size' | 'forceOverlay' | 'color'> & { id: string }, c: string | null) => {
    s.markers.push({ time: t, ...m, color: c ?? NA, size: 'tiny', forceOverlay: true });
  };
  return {
    init() {
      const sma = taStep.sma();
      const linreg = taStep.linreg(len, 0);
      const emaU = taStep.ema(len);
      const emaD = taStep.ema(len);
      const s: PulseRun = {
        sma, linreg, emaU, emaD,
        help2: [], res: [], plot0: [], plot1: [], plot2: [], plot3: [], candles: [], markers: [],
        flags: Array.from({ length: 8 }, () => []),
        times: Array.from({ length: 8 }, () => []),
        steps: [sma, linreg, emaU, emaD],
        vars: { c1: color.white, c2: color.white, pa: new Array(6).fill(NaN), pb: new Array(6).fill(NaN) },
        lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.help2, s.res, s.plot0, s.plot1, s.plot2, s.plot3, s.candles, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const v = s.vars;
      // vol = (close * high * low) * math.abs(volume); help = math.sqrt(vol)
      const help = Math.sqrt(b.close * b.high * b.low * Math.abs(b.volume ?? NaN));
      const helpp = s.sma.step(help, len);
      const help2 = s.linreg.step(helpp);
      s.help2[i] = help2;
      // u = math.max(help2 - help2[1], 0); d = math.max(help2[1] - help2, 0) (na when a value is na)
      const u = i > 0 ? Math.max(help2 - s.help2[i - 1], 0) : NaN;
      const d = i > 0 ? Math.max(s.help2[i - 1] - help2, 0) : NaN;
      const eu = s.emaU.step(u);
      const ed = s.emaD.step(d);
      // rs = ema(u) / ema(d) (x / 0 is +infinity: res = 100; 0 / 0 is na); res = 100 - 100 / (1 + rs)
      const r = 100 - 100 / (1 + eu / ed);
      s.res[i] = r;
      const r1 = i > 0 ? s.res[i - 1] : NaN;
      const r2 = i > 1 ? s.res[i - 2] : NaN;
      // var colType1 / colType2 = color.white, updated by the Type 1 / Type 2 conditions
      if (gt(r, r1)) v.c1 = upC;
      if (lt(r, r1)) v.c1 = dnC;
      if (gt(r, 50)) v.c2 = upC;
      if (lt(r, 50)) v.c2 = dnC;
      // pc_dd / pc_flType1: Type 1 (res > res[1] up, res < res[2] down), else Type 2 (res against 50), else na
      const pc: string | null =
        cfg.sigType1Enable && gt(r, r1) ? upC
          : cfg.sigType1Enable && lt(r, r2) ? dnC
            : cfg.sigType2Enable && gt(r, 50) ? upC
              : cfg.sigType2Enable && lt(r, 50) ? dnC
                : null;
      // ta.crossover / ta.crossunder: compared with the last bar where both values were not na (exact comparisons:
      // no 1e-10 tolerance, unlike the operators)
      levels[0] = r1;
      for (let k = 0; k < 6; k++) {
        over[k] = false;
        under[k] = false;
        const bv = levels[k];
        if (isNaN(r) || isNaN(bv)) continue;
        if (!isNaN(v.pa[k])) {
          over[k] = r > bv && !(v.pa[k] > v.pb[k]);
          under[k] = r < bv && !(v.pa[k] < v.pb[k]);
        }
        v.pa[k] = r;
        v.pb[k] = bv;
      }
      // Type 1: shape.labelup / labeldown, colour colType1, text 𝓛𝓸𝓷𝓰 / 𝓢𝓱𝓸𝓻𝓽 in black
      if (cfg.sigType1Enable && over[0]) add(s, t, { id: 'shape0', position: 'belowBar', shape: 'labelUp', text: '𝓛𝓸𝓷𝓰', textColor: '#000000' }, v.c1);
      if (cfg.sigType1Enable && under[0]) add(s, t, { id: 'shape1', position: 'aboveBar', shape: 'labelDown', text: '𝓢𝓱𝓸𝓻𝓽', textColor: '#000000' }, v.c1);
      // Type 2: colour colType2
      if (cfg.sigType2Enable && over[1]) add(s, t, { id: 'shape2', position: 'belowBar', shape: 'labelUp', text: '𝓛𝓸𝓷𝓰', textColor: '#000000' }, v.c2);
      if (cfg.sigType2Enable && under[1]) add(s, t, { id: 'shape3', position: 'aboveBar', shape: 'labelDown', text: '𝓢𝓱𝓸𝓻𝓽', textColor: '#000000' }, v.c2);
      // Type 3: triangles crossover(res, 30) / crossunder(res, 70)
      if (cfg.sigType3Enable && over[2]) add(s, t, { id: 'shape4', position: 'belowBar', shape: 'triangleUp' }, upC);
      if (cfg.sigType3Enable && under[3]) add(s, t, { id: 'shape5', position: 'aboveBar', shape: 'triangleDown' }, dnC);
      // Type 4: labels with ⬆ / ⬇ in white
      if (cfg.sigType4Enable && over[4]) add(s, t, { id: 'shape6', position: 'belowBar', shape: 'labelUp', text: '⬆', textColor: color.white }, upC);
      if (cfg.sigType4Enable && under[5]) add(s, t, { id: 'shape7', position: 'aboveBar', shape: 'labelDown', text: '⬇', textColor: color.white }, dnC);
      // plotcandle(open, high, low, close, "Candle Color", pc_flType1, pc_flType1, bordercolor = pc_flType1,
      //   force_overlay = true, display = display.pane)
      const c = pc ?? NA;
      s.candles[i] = { time: t, open: b.open, high: b.high, low: b.low, close: b.close, color: c, wickColor: c,
        borderColor: c, forceOverlay: true };
      s.plot0[i] = { time: t, value: val(r), color: c };
      // color.new(na, 75) is black with transparency 75
      s.plot1[i] = { time: t, value: val(r), color: glowOf(pc) };
      // plot(Threshold_L_Fl, color = color.new(UpC, 30), editable = false)
      s.plot2[i] = { time: t, value: cfg.thresholdLong, color: upLine };
      s.plot3[i] = { time: t, value: cfg.thresholdShort, color: dnLine };
      // alertcondition(res > res[1] / res < res[1] / res > 50 / res < 50 / res > 30 / res < 70 / res > Threshold_L_Fl /
      // res < Threshold_S_Fl)
      flags[0] = gt(r, r1); flags[1] = lt(r, r1); flags[2] = gt(r, 50); flags[3] = lt(r, 50);
      flags[4] = gt(r, 30); flags[5] = lt(r, 70); flags[6] = gt(r, cfg.thresholdLong); flags[7] = lt(r, cfg.thresholdShort);
      for (let k = 0; k < 8; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(t as number);
      }
    },
    copyVars: (v) => ({ ...v, pa: v.pa.slice(), pb: v.pb.slice() }),
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice() },
        // hline(50, title = "MidLine"): default colour and style
        hlines: [{ value: 50, options: { title: 'MidLine', color: '#787B86', linestyle: 'dashed' } }],
        markers: s.markers.slice(),
        plotCandles: { candleColor: s.candles.slice() },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PulseRsiLyroRsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<PulseRsiLyroRsInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> }
  & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Pulse RSI Long / Type 1-Trend', message: 'Pulse RSI Trend is Long {{exchange}}:{{ticker}}' },
  { id: 'alert1', title: 'Pulse RSI Short / Type 1-Trend', message: 'Pulse RSI Trend is Short {{exchange}}:{{ticker}}' },
  { id: 'alert2', title: 'Pulse RSI Long / Type 2-Trend', message: 'Pulse RSI Trend is Long {{exchange}}:{{ticker}}' },
  { id: 'alert3', title: 'Pulse RSI Short / Type 2-Trend', message: 'Pulse RSI Trend is Short {{exchange}}:{{ticker}}' },
  { id: 'alert4', title: 'Pulse RSI Long / Type 3-Oversold/Overbought', message: 'Pulse RSI Oversold is Long {{exchange}}:{{ticker}}' },
  { id: 'alert5', title: 'Pulse RSI Short / Type 3-Oversold/Overbought', message: 'Pulse RSI Overbought is Short {{exchange}}:{{ticker}}' },
  { id: 'alert6', title: 'Pulse RSI Long / Type 4-Custom Threshold L/S', message: 'Pulse RSI Threshold HIT Long {{exchange}}:{{ticker}}' },
  { id: 'alert7', title: 'Pulse RSI Short / Type 4-Custom Threshold L/S', message: 'Pulse RSI Threshold HIT Short {{exchange}}:{{ticker}}' },
];

export const PulseRsiLyroRs = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
