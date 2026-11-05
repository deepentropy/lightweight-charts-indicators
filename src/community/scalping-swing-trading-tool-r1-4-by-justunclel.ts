/**
 * Scalping Swing Trading Tool R1-6 by JustUncleL
 *
 * A set of EMA tools for pullback scalping:
 * - the Price Action Channel (PAC): EMAs of the high, the low and the close (shown when the EMA 5-12 channel is off,
 *   or the EMA 12-36 ribbon when the PAC length is above 30), and bar colours from the close position against the
 *   channel (blue at or above the top, red at or below the bottom, gray inside);
 * - the EMA 5-12 channel (EMA 5 and EMA 11 with a fill);
 * - three long EMAs: 89 / 200 / 633, or 75 / 180 / 540 on a 1-minute chart;
 * - the EMA 12-36 ribbon (EMAs 12 to 36 by steps of 3), coloured by the slope of each EMA and the side of EMA 12
 *   against EMA 36;
 * - five-bar fractals drawn three bars back (regular shape when the pivots are shown, else the wider shape), the
 *   last fractal levels, HH / LH / HL / LL labels, and pivot labels with the count of the bars of the pattern;
 * - swing alerts: the first bar that closes outside the channel in its own direction (optionally only on the side
 *   of the medium EMA), drawn one bar later as BUY / SELL arrows or as big arrows (the original's plotarrow,
 *   `arrows` of the result, value +1 / -1; the arrow height is not ported).
 *
 * Alerts (alertcondition, `alerts` of the result): "SCAPSWING alert Up" / "SCAPSWING alert Down" on the bar of the
 * swing alert itself (the bar before the arrow).
 *
 * The chart timeframe (1 minute or not) is read from the chart context; without it, from the spacing of the bars.
 *
 * Reference: "Scalping Swing Trading Tool R1-6 by JustUncleL" by JustUncleL
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, timeframe, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type ArrowData } from 'oakscriptjs';
import type { BarColorData, MarkerData } from '../types';
import { chartTimeframe } from '../anchor-period';
import type { ChartContext } from '../chart-context';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ScalpingSwingTradingToolInputs {
  showPac: boolean;
  /** Colour the bars from the close position against the PAC */
  scolor: boolean;
  hiLoLen: number;
  showPacExit: boolean;
  useBigArrows: boolean;
  filterEma200: boolean;
  showEma12Channel: boolean;
  showEma36Ribbon: boolean;
  showPivots: boolean;
  showPivotLabels: boolean;
  showHHLL: boolean;
  showFractals: boolean;
  showFractalLevels: boolean;
  filterBw: boolean;
}

export const defaultInputs: ScalpingSwingTradingToolInputs = {
  showPac: true,
  scolor: true,
  hiLoLen: 10,
  showPacExit: false,
  useBigArrows: false,
  filterEma200: true,
  showEma12Channel: true,
  showEma36Ribbon: true,
  showPivots: true,
  showPivotLabels: true,
  showHHLL: false,
  showFractals: true,
  showFractalLevels: false,
  filterBw: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'showPac', type: 'bool', title: 'Show Price Action Channel (PAC)', defval: true },
  { id: 'scolor', type: 'bool', title: 'Show coloured Bars close relative on PAC', defval: true },
  { id: 'hiLoLen', type: 'int', title: 'High Low PAC Length', defval: 10, min: 2 },
  { id: 'showPacExit', type: 'bool', title: 'Show PAC Swing Alerts', defval: false },
  { id: 'useBigArrows', type: 'bool', title: 'Use Big Arrows for Swing Alerts', defval: false },
  { id: 'filterEma200', type: 'bool', title: 'Filter PAC Alerts with 200ema', defval: true },
  { id: 'showEma12Channel', type: 'bool', title: 'ShowEMA12_Channel', defval: true },
  { id: 'showEma36Ribbon', type: 'bool', title: 'ShowEMA36_Ribbon', defval: true },
  { id: 'showPivots', type: 'bool', title: 'ShowPivots', defval: true },
  { id: 'showPivotLabels', type: 'bool', title: 'ShowPivotLabels', defval: true },
  { id: 'showHHLL', type: 'bool', title: 'ShowHHLL_', defval: false },
  { id: 'showFractals', type: 'bool', title: 'ShowFractals_', defval: true },
  { id: 'showFractalLevels', type: 'bool', title: 'ShowFractalLevels', defval: false },
  { id: 'filterBw', type: 'bool', title: 'Filter for Pristine (Ideal) Fractals', defval: false },
];

// Colour constants of Pine version 3
const GRAY = '#808080';
const LIME = '#00FF00';
const BLUE = '#0000FF';
const RED = '#FF0000';
const GREEN = '#008000';
const BLACK = '#000000';
const MAROON = '#800000';
const AQUA = '#00FFFF';
const FUCHSIA = '#FF00FF';
const DODGER_BLUE = '#1E90FF';
const T = (hex: string, transp: number) => String(color.new(hex, transp));

const RIBBON = [12, 15, 18, 21, 24, 27, 30, 33, 36];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'High PAC EMA', color: T(GRAY, 50), lineWidth: 1 },
  { id: 'plot1', title: 'Low PAC EMA', color: T(GRAY, 50), lineWidth: 1 },
  { id: 'plot2', title: 'Close PAC EMA', color: LIME, lineWidth: 1 },
  { id: 'plot3', title: 'EMA05', color: T(BLUE, 92), lineWidth: 1 },
  { id: 'plot4', title: 'EMA11', color: T(BLUE, 92), lineWidth: 1 },
  { id: 'plot5', title: 'EMA fast', color: T(GREEN, 20), lineWidth: 3 },
  { id: 'plot6', title: 'EMA medium', color: T(BLUE, 20), lineWidth: 3 },
  { id: 'plot7', title: 'EMA slow', color: T(BLACK, 20), lineWidth: 3 },
  ...RIBBON.map((len, k) => ({
    id: `plot${8 + k}`, title: `MA${len}`, color: T(DODGER_BLUE, 20), lineWidth: len === 12 || len === 36 ? 2 : 1,
  })),
  { id: 'plot17', title: 'Top Fractal Level', color: GREEN, lineWidth: 2 },
  { id: 'plot18', title: 'Bottom Fractal Level', color: RED, lineWidth: 2 },
];

export const metadata = {
  title: 'Scalping Swing Trading Tool R1-6 by JustUncleL',
  shortTitle: 'SCALPSWING R1-6',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const ge = (a: number, b: number) => gt(a, b) || eq(a, b);
const le = (a: number, b: number) => lt(a, b) || eq(a, b);

type Point = { time: number; value: number; color?: string };

type Result = Omit<IndicatorResult, 'markers' | 'barColors'> & {
  markers: MarkerData[]; arrows: ArrowData[]; barColors: BarColorData[]; alerts: AlertConditionState[];
};
type Ema = ReturnType<typeof taStep.ema>;

interface ScalpVars {
  /** valuewhen histories of the fractals: the last three values (latest last) */
  tops: readonly number[];
  bots: readonly number[];
  topFractals: number;
  botFractals: number;
  /** up_alert[1] / dn_alert[1] (na on the first bar) */
  upAlert: number;
  dnAlert: number;
}

interface ScalpRun extends BarRunState<ScalpVars> {
  pacCEma: Ema;
  pacLEma: Ema;
  pacUEma: Ema;
  ema05: Ema;
  ema11: Ema;
  ribbonEmas: Ema[];
  emaFast: Ema;
  emaMedium: Ema;
  emaSlow: Ema;
  pacL: number[];
  pacU: number[];
  /** EMA 12 to 36 per bar */
  ribbon: number[][];
  plots: Point[][];
  barColors: BarColorData[];
  markers: MarkerData[];
  arrows: ArrowData[];
  flags: boolean[][];
  times: number[][];
}

/** The last three values of a valuewhen history with `v` added */
const pushed3 = (h: readonly number[], v: number): readonly number[] => (h.length < 3 ? [...h, v] : [h[1]!, h[2]!, v]);

/** On a 1-minute chart the long EMAs are 75 / 180 / 540 */
function isOneMinute(bars: Bar[], chart: ChartContext): boolean {
  const tf = chart.timeframe ?? chartTimeframe(bars);
  const info = tf === '' ? null : timeframe.info(tf);
  return info !== null && info.isintraday && info.multiplier === 1;
}

function study(inputs: Partial<ScalpingSwingTradingToolInputs>): BarStudy<ScalpRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };

  // ShowPAC = HiLoLen > 30 ? (ShowEMA36_Ribbon ? false : ShowPAC_) : (ShowEMA12_Channel ? false : ShowPAC_)
  const showPac = cfg.hiLoLen > 30 ? (cfg.showEma36Ribbon ? false : cfg.showPac) : (cfg.showEma12Channel ? false : cfg.showPac);
  // Pivots switch the fractal markers and the HH / LL squares off, and need the regular fractal shape
  const showHHLL = cfg.showPivots ? false : cfg.showHHLL;
  const showFractals = cfg.showPivots ? false : cfg.showFractals;
  const filterBw = cfg.showPivots ? true : cfg.filterBw;

  // MA colour of the ribbon
  const maColor = (base: number, ma: number[], ref: number, i: number): string => {
    const ch = i > 0 ? ma[i] - ma[i - 1] : NaN;
    return ge(ch, 0) && gt(base, ref) ? DODGER_BLUE
      : lt(ch, 0) && gt(base, ref) ? MAROON
        : le(ch, 0) && lt(base, ref) ? RED
          : ge(ch, 0) && lt(base, ref) ? BLUE
            : GRAY;
  };
  const back = (list: readonly number[], k: number) => (list.length > k ? list[list.length - 1 - k] : NaN);
  const changed = (now: number, before: number) => !isNaN(now) && !isNaN(before) && !eq(now, before);

  return {
    key: (bars, chart) => String(isOneMinute(bars, chart)),
    init(bars, chart) {
      const oneMinute = isOneMinute(bars, chart);
      const s: ScalpRun = {
        pacCEma: taStep.ema(cfg.hiLoLen), pacLEma: taStep.ema(cfg.hiLoLen), pacUEma: taStep.ema(cfg.hiLoLen),
        ema05: taStep.ema(5), ema11: taStep.ema(11), ribbonEmas: RIBBON.map((len) => taStep.ema(len)),
        emaFast: taStep.ema(oneMinute ? 75 : 89), emaMedium: taStep.ema(oneMinute ? 180 : 200),
        emaSlow: taStep.ema(oneMinute ? 540 : 633),
        pacL: [], pacU: [], ribbon: RIBBON.map(() => []), plots: Array.from({ length: 19 }, () => []),
        barColors: [], markers: [], arrows: [], flags: [[], []], times: [[], []],
        steps: [], lists: [], series: [],
        vars: { tops: [], bots: [], topFractals: NaN, botFractals: NaN, upAlert: NaN, dnAlert: NaN },
      };
      s.steps = [s.pacCEma, s.pacLEma, s.pacUEma, s.ema05, s.ema11, ...s.ribbonEmas, s.emaFast, s.emaMedium, s.emaSlow];
      s.lists = [s.barColors, s.markers, s.arrows, ...s.times];
      s.series = [s.pacL, s.pacU, ...s.ribbon, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const v = s.vars;
      const plots = s.plots;
      const markers = s.markers;
      const pacC = s.pacCEma.step(b.close);
      const pacL = s.pacLEma.step(b.low);
      const pacU = s.pacUEma.step(b.high);
      s.pacL[i] = pacL;
      s.pacU[i] = pacU;
      const ema05 = s.ema05.step(b.close);
      const ema11 = s.ema11.step(b.close);
      for (let k = 0; k < RIBBON.length; k++) s.ribbon[k][i] = s.ribbonEmas[k].step(b.close);
      const ema12 = s.ribbon[0][i];
      const ema36 = s.ribbon[RIBBON.length - 1][i];
      const emaFast = s.emaFast.step(b.close);
      const emaMedium = s.emaMedium.step(b.close);
      const emaSlow = s.emaSlow.step(b.close);

      const H = (j: number) => (j >= 0 ? bars[j].high : NaN);
      const L = (j: number) => (j >= 0 ? bars[j].low : NaN);
      const add = (on: boolean, index: number, m: Omit<MarkerData, 'time'>) => {
        if (on && index >= 0) markers.push({ time: bars[index].time, ...m });
      };

      plots[0][i] = { time: t, value: showPac ? pacL : NaN };
      plots[1][i] = { time: t, value: showPac ? pacU : NaN };
      plots[2][i] = { time: t, value: showPac ? pacC : NaN };
      if (cfg.scolor) s.barColors.push({ time: t, color: ge(b.close, pacU) ? BLUE : le(b.close, pacL) ? RED : GRAY });
      plots[3][i] = { time: t, value: cfg.showEma12Channel ? ema05 : NaN };
      plots[4][i] = { time: t, value: cfg.showEma12Channel ? ema11 : NaN };
      plots[5][i] = { time: t, value: emaFast };
      plots[6][i] = { time: t, value: emaMedium };
      plots[7][i] = { time: t, value: emaSlow };
      RIBBON.forEach((len, k) => {
        const last = len === 36;
        plots[8 + k][i] = {
          time: t,
          value: last || cfg.showEma36Ribbon ? s.ribbon[k][i] : NaN,
          color: T(last && !cfg.showEma36Ribbon ? RED : maColor(ema12, s.ribbon[k], ema36, i), 20),
        };
      });

      // Fractals on the five bars before the current bar (centre three bars back)
      const h1 = H(i - 1), h2 = H(i - 2), h3 = H(i - 3), h4 = H(i - 4), h5 = H(i - 5);
      const l1 = L(i - 1), l2 = L(i - 2), l3 = L(i - 3), l4 = L(i - 4), l5 = L(i - 5);
      const top = filterBw
        ? lt(h5, h4) && lt(h4, h3) && gt(h3, h2) && gt(h2, h1)
        : lt(h5, h3) && lt(h4, h3) && gt(h3, h2) && gt(h3, h1);
      const bot = filterBw
        ? gt(l5, l4) && gt(l4, l3) && lt(l3, l2) && lt(l2, l1)
        : gt(l5, l3) && gt(l4, l3) && lt(l3, l2) && lt(l3, l1);
      add(showFractals && top, i - 3, { position: 'aboveBar', shape: 'triangleDown', color: RED, id: 'shape0' });
      add(showFractals && bot, i - 3, { position: 'belowBar', shape: 'triangleUp', color: LIME, id: 'shape1' });

      // Last fractal levels: no colour on the bar where the level changes
      const prevTop = v.topFractals;
      const prevBot = v.botFractals;
      if (top) v.topFractals = h3;
      if (bot) v.botFractals = l3;
      plots[17][i] = {
        time: t, value: cfg.showFractalLevels ? v.topFractals : NaN, color: changed(v.topFractals, prevTop) ? 'transparent' : GREEN,
      };
      plots[18][i] = {
        time: t, value: cfg.showFractalLevels ? v.botFractals : NaN, color: changed(v.botFractals, prevBot) ? 'transparent' : RED,
      };

      // Higher highs, lower highs, higher lows, lower lows
      if (top) v.tops = pushed3(v.tops, h3);
      if (bot) v.bots = pushed3(v.bots, l3);
      const t0 = back(v.tops, 0), t1 = back(v.tops, 1), t2 = back(v.tops, 2);
      const b0 = back(v.bots, 0), b1 = back(v.bots, 1), b2 = back(v.bots, 2);
      const higherHigh = top && lt(t1, t0) && (cfg.showPivots || lt(t2, t0));
      const lowerHigh = top && gt(t1, t0) && (cfg.showPivots || gt(t2, t0));
      const higherLow = bot && lt(b1, b0) && (cfg.showPivots || lt(b2, b0));
      const lowerLow = bot && gt(b1, b0) && (cfg.showPivots || gt(b2, b0));

      add(showHHLL && higherHigh, i - 3, { position: 'aboveBar', shape: 'square', color: MAROON, text: '[HH]', id: 'shape2' });
      add(showHHLL && lowerHigh, i - 3, { position: 'aboveBar', shape: 'square', color: MAROON, text: '[LH]', id: 'shape3' });
      add(showHHLL && higherLow, i - 3, { position: 'belowBar', shape: 'square', color: GREEN, text: '[HL]', id: 'shape4' });
      add(showHHLL && lowerLow, i - 3, { position: 'belowBar', shape: 'square', color: GREEN, text: '[LL]', id: 'shape5' });

      // Pivot points: a cross with a label (outputs shape6 / 8 / 10 / 12), or the cross alone (shape7 / 9 / 11 / 13)
      const pivot = (on: boolean, above: boolean, text: string, k: number) => {
        const base = { position: above ? 'aboveBar' as const : 'belowBar' as const, shape: 'cross' as const, color: above ? MAROON : GREEN };
        add(cfg.showPivots && on, i - 3, cfg.showPivotLabels ? { ...base, text, id: `shape${k}` } : { ...base, id: `shape${k + 1}` });
      };
      pivot(higherHigh, true, '[HH]\n[PVT]', 6);
      pivot(lowerHigh, true, '[LH]\n[PVT]', 8);
      pivot(higherLow, false, '[PVT]\n[HL]', 10);
      pivot(lowerLow, false, '[PVT]\n[LL]', 12);

      // Numbers on the bars of a pivot pattern (plotchar: the character only)
      const digit = (on: boolean, offset: number, above: boolean, char: string, id: string) => add(cfg.showPivots && on, i + offset, {
        position: above ? 'aboveBar' : 'belowBar', shape: 'circle', color: 'transparent', text: char, textColor: above ? MAROON : GREEN, id,
      });
      digit(top, -5, true, '1', 'char14');
      digit(top, -4, true, '2', 'char15');
      digit(top, -2, true, '2', 'char16');
      digit(top, -1, true, '1', 'char17');
      digit(bot, -5, false, '1', 'char18');
      digit(bot, -4, false, '2', 'char19');
      digit(bot, -2, false, '2', 'char20');
      digit(bot, -1, false, '1', 'char21');

      // Swing alerts: the first bar that leaves the PAC, drawn on the next bar
      const prevClose = i > 0 ? bars[i - 1].close : NaN;
      const isUp = gt(b.close, b.open) && gt(b.close, pacU) && lt(prevClose, i > 0 ? s.pacU[i - 1] : NaN)
        && (!cfg.filterEma200 || gt(pacC, emaMedium));
      const isDown = lt(b.close, b.open) && lt(b.close, pacL) && gt(prevClose, i > 0 ? s.pacL[i - 1] : NaN)
        && (!cfg.filterEma200 || lt(pacC, emaMedium));
      const prevUp = v.upAlert;
      const prevDn = v.dnAlert;
      v.upAlert = isUp ? (isNaN(prevUp) ? 1 : prevUp + 1) : 0;
      v.dnAlert = isDown ? (isNaN(prevDn) ? 1 : prevDn + 1) : 0;
      // alertcondition(up_alert == 1) / (dn_alert == 1)
      const up = v.upAlert === 1;
      const dn = v.dnAlert === 1;
      s.flags[0][i] = up;
      s.flags[1][i] = dn;
      if (up) s.times[0].push(t as number);
      if (dn) s.times[1].push(t as number);
      if (cfg.showPacExit && cfg.useBigArrows) {
        // plotarrow(up_alert[1] == 1 ? 1 : dn_alert[1] == 1 ? -1 : na, colorup = aqua, colordown = fuchsia, transp = 20)
        if (prevUp === 1) s.arrows.push({ time: t, id: 'arrow0', value: 1, color: T(AQUA, 20) });
        else if (prevDn === 1) s.arrows.push({ time: t, id: 'arrow0', value: -1, color: T(FUCHSIA, 20) });
      }
      if (cfg.showPacExit && !cfg.useBigArrows) {
        if (prevUp === 1) markers.push({ time: t, position: 'belowBar', shape: 'arrowUp', color: GREEN, text: 'BUY', textColor: GREEN, id: 'shape22' });
        if (prevDn === 1) markers.push({ time: t, position: 'aboveBar', shape: 'arrowDown', color: RED, text: 'SELL', textColor: RED, id: 'shape23' });
      }
    },
    copyVars: (v) => ({ ...v }),
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      for (let k = 0; k < 19; k++) plots[`plot${k}`] = s.plots[k].slice();
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills: [
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Fill HiLo PAC', color: T(GRAY, 92) } },
          { plot1: 'plot3', plot2: 'plot4', options: { title: 'Fill EMA5-12', color: T(BLUE, 92) } },
        ],
        // the markers of earlier bars are pushed later: in time order (a stable sort of the bar order)
        markers: s.markers.slice().sort((p, q) => p.time - q.time),
        arrows: s.arrows.slice(),
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ScalpingSwingTradingToolInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ScalpingSwingTradingToolInputs> = {}, chart?: ChartContext): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'SCAPSWING alert Up', message: 'SWING_UP' },
  { id: 'alert1', title: 'SCAPSWING alert Down', message: 'SWING_DN' },
];

export const ScalpingSwingTradingTool = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
