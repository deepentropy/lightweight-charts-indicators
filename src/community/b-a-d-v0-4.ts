/**
 * B + A + D v1
 *
 * Four tools in one pane:
 * - B-Xtrender: short term = RSI(EMA(close, L1) - EMA(close, L2), L3) - 50 as columns, with a T3 (b = 0.7, length 5)
 *   line; long term = RSI(EMA(close, L1), L2) - 50 as a histogram and lines.
 * - ADX & DI: Wilder-smoothed true range and directional movements (running sums), DI+ / DI-, ADX = SMA(DX), and a
 *   threshold line.
 * - Trend Step: a trend direction from close against SMA +- ATR on the first 300 bars, then from the bar range
 *   against a step band +- ATR * width; drawn as a white (up) / black (down) line at 0.
 * - EMA Core: a line at -10 coloured by the hue of the normalized EMA acceleration (tanh of the EMA of the EMA change
 *   over 1 % of ATR 14).
 * Signals: a DI cross sets a pending bull / bear signal; it fires (a circle on the T3 line) when the long-term
 * Xtrender is on the same side of 0 and the previous signal was of the other type. Pending signals colour the
 * background.
 * Alert (alertcondition, `alerts` of the result): 'Signal Confirmed', true on the bars of a bull or a bear signal.
 *
 * Reference: "B + A + D v1" by wepritz84
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface BadV04Inputs {
  shortL1: number;
  shortL2: number;
  shortL3: number;
  longL1: number;
  longL2: number;
  /** ADX length */
  adxLength: number;
  /** ADX threshold (horizontal line) */
  adxThreshold: number;
  /** Trend Step: SMA length */
  maLength: number;
  /** Trend Step: ATR period */
  volatility: number;
  /** Trend Step: channel width (ATR multiplier) */
  trendWidth: number;
  emaLength: number;
  emaSource: SourceType;
  /** EMA length of the EMA change (acceleration) */
  colorSmooth: number;
  showEmaLine: boolean;
}

export const defaultInputs: BadV04Inputs = {
  shortL1: 5,
  shortL2: 20,
  shortL3: 15,
  longL1: 20,
  longL2: 15,
  adxLength: 14,
  adxThreshold: 20,
  maLength: 25,
  volatility: 200,
  trendWidth: 2,
  emaLength: 50,
  emaSource: 'close',
  colorSmooth: 3,
  showEmaLine: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'shortL1', type: 'int', title: 'Short - L1', defval: 5 },
  { id: 'shortL2', type: 'int', title: 'Short - L2', defval: 20 },
  { id: 'shortL3', type: 'int', title: 'Short - L3', defval: 15 },
  { id: 'longL1', type: 'int', title: 'Long - L1', defval: 20 },
  { id: 'longL2', type: 'int', title: 'Long - L2', defval: 15 },
  { id: 'adxLength', type: 'int', title: 'ADX Length', defval: 14 },
  { id: 'adxThreshold', type: 'float', title: 'ADX Threshold', defval: 20 },
  { id: 'maLength', type: 'int', title: 'MA Length', defval: 25 },
  { id: 'volatility', type: 'int', title: 'Volatility (ATR Period)', defval: 200 },
  { id: 'trendWidth', type: 'float', title: 'Channel Width', defval: 2, step: 0.1 },
  { id: 'emaLength', type: 'int', title: 'EMA Length', defval: 50, min: 1 },
  { id: 'emaSource', type: 'source', title: 'EMA Source', defval: 'close' },
  { id: 'colorSmooth', type: 'int', title: 'Color Smoothing', defval: 3, min: 1 },
  { id: 'showEmaLine', type: 'bool', title: 'Show EMA Line', defval: true },
];

// Colours of the script (most have transparency 100)
const UP_T = String(color.rgb(0, 230, 119, 100));
const DN_T = String(color.rgb(255, 82, 82, 100));
const LONG_UP_RISE = String(color.rgb(255, 255, 255, 73));
const LONG_DN_RISE = String(color.rgb(151, 151, 151, 73));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'B-Xtrender Osc.', color: '#228b2200', lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'B-X Shadow', color: '#00000000', lineWidth: 5 },
  { id: 'plot2', title: 'B-X Color', color: UP_T, lineWidth: 3 },
  { id: 'plot3', title: 'DI+', color: color.green, lineWidth: 1 },
  { id: 'plot4', title: 'DI-', color: color.red, lineWidth: 1 },
  { id: 'plot5', title: 'ADX', color: color.navy, lineWidth: 1 },
  { id: 'plot6', title: 'Trend Line', color: color.white, lineWidth: 3 },
  { id: 'plot7', title: 'EMA Core', color: 'rgb(255, 255, 0)', lineWidth: 3 },
  { id: 'plot8', title: 'B-X Trend Hist', color: LONG_UP_RISE, lineWidth: 2, style: 'histogram' },
  { id: 'plot9', title: 'B-X Trend Line', color: '#00000000', lineWidth: 5 },
  { id: 'plot10', title: 'B-X Trend Color', color: UP_T, lineWidth: 3 },
];

export const metadata = {
  title: 'B + A + D v1',
  shortTitle: 'B + A + D v1',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
/** Pine nz: na and +-infinity give the replacement */
const nz = (v: number, r = 0) => (Number.isFinite(v) ? v : r);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color: string };
type Ema = ReturnType<typeof taStep.ema>;

interface BadVars {
  str: number;
  sdmp: number;
  sdmm: number;
  /** var trendDirection = bool(na): false in Pine v6 */
  direction: boolean;
  /** var trendBand = float(na) */
  trendBand: number;
  pendingBull: boolean;
  pendingBear: boolean;
  lastSignalType: number;
}

interface BadRun extends BarRunState<BadVars> {
  emaS1: Ema;
  emaS2: Ema;
  rsiS: ReturnType<typeof taStep.rsi>;
  emaL1: Ema;
  rsiL: ReturnType<typeof taStep.rsi>;
  t3: Ema[];
  adxMa: ReturnType<typeof taStep.sma>;
  atr: ReturnType<typeof taStep.atr>;
  maClose: ReturnType<typeof taStep.sma>;
  ema: Ema;
  emaAccel: Ema;
  atr14: ReturnType<typeof taStep.atr>;
  shortX: number[];
  maShortX: number[];
  longX: number[];
  diPlus: number[];
  diMinus: number[];
  emaArr: number[];
  hueRaw: number[];
  plots: Point[][];
  markers: MarkerData[];
  bgColors: BgColorData[];
  stateFlags: boolean[];
  times: number[];
}

function study(inputs: Partial<BadV04Inputs>): BarStudy<BadRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const emaSource = barSource(cfg.emaSource);
  const len = cfg.adxLength;
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const pendingBullCol = String(color.new(color.green, 95));
  const pendingBearCol = String(color.new(color.red, 95));
  const bullColor = String(color.rgb(255, 255, 255));
  const bearColor = String(color.rgb(5, 0, 0));
  // t3(src, 5): six chained EMAs, b = 0.7
  const tb = 0.7;
  const c1 = -tb * tb * tb;
  const c2 = 3 * tb * tb + 3 * tb * tb * tb;
  const c3 = -6 * tb * tb - 3 * tb - 3 * tb * tb * tb;
  const c4 = 1 + 3 * tb + tb * tb * tb + 3 * tb * tb;
  return {
    fullRunReason: () => (isBarSource(cfg.emaSource) ? null : 'source of another study'),
    init() {
      const emaS1 = taStep.ema(cfg.shortL1);
      const emaS2 = taStep.ema(cfg.shortL2);
      const rsiS = taStep.rsi(cfg.shortL3);
      const emaL1 = taStep.ema(cfg.longL1);
      const rsiL = taStep.rsi(cfg.longL2);
      const t3 = Array.from({ length: 6 }, () => taStep.ema(5));
      const adxMa = taStep.sma();
      const atr = taStep.atr(cfg.volatility);
      const maClose = taStep.sma();
      const ema = taStep.ema(cfg.emaLength);
      const emaAccel = taStep.ema(cfg.colorSmooth);
      const atr14 = taStep.atr(14);
      const s: BadRun = {
        emaS1, emaS2, rsiS, emaL1, rsiL, t3, adxMa, atr, maClose, ema, emaAccel, atr14,
        shortX: [], maShortX: [], longX: [], diPlus: [], diMinus: [], emaArr: [], hueRaw: [],
        plots: Array.from({ length: 11 }, () => []), markers: [], bgColors: [], stateFlags: [], times: [],
        steps: [emaS1, emaS2, rsiS, emaL1, rsiL, ...t3, adxMa, atr, maClose, ema, emaAccel, atr14],
        vars: {
          str: 0.0, sdmp: 0.0, sdmm: 0.0, direction: false, trendBand: NaN, pendingBull: false, pendingBear: false,
          lastSignalType: 0,
        },
        lists: [], series: [],
      };
      s.lists = [s.markers, s.bgColors, s.times];
      s.series = [s.shortX, s.maShortX, s.longX, s.diPlus, s.diMinus, s.emaArr, s.hueRaw, ...s.plots, s.stateFlags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const t = b.time;
      const close = b.close;
      const prev = (a: number[]) => (i > 0 ? a[i - 1] : NaN);

      // 1. B-Xtrender
      const emaS1 = s.emaS1.step(close);
      const emaS2 = s.emaS2.step(close);
      const shortX = s.rsiS.step(emaS1 - emaS2) - 50;
      const longX = s.rsiL.step(s.emaL1.step(close)) - 50;
      s.shortX[i] = shortX;
      s.longX[i] = longX;
      const xe1 = s.t3[0].step(shortX);
      const xe2 = s.t3[1].step(xe1);
      const xe3 = s.t3[2].step(xe2);
      const xe4 = s.t3[3].step(xe3);
      const xe5 = s.t3[4].step(xe4);
      const xe6 = s.t3[5].step(xe5);
      const maShortX = c1 * xe6 + c2 * xe5 + c3 * xe4 + c4 * xe3;
      s.maShortX[i] = maShortX;

      // 2. ADX + DI (nz(x[1]) is 0 on bar 0)
      const pc = nz(i > 0 ? bars[i - 1].close : NaN);
      const ph = i > 0 ? bars[i - 1].high : 0;
      const pl = i > 0 ? bars[i - 1].low : 0;
      const tr = Math.max(Math.max(b.high - b.low, Math.abs(b.high - pc)), Math.abs(b.low - pc));
      const dmp = gt(b.high - ph, pl - b.low) ? Math.max(b.high - ph, 0) : 0;
      const dmm = gt(pl - b.low, b.high - ph) ? Math.max(pl - b.low, 0) : 0;
      v.str = nz(v.str) - nz(v.str) / len + tr;
      v.sdmp = nz(v.sdmp) - nz(v.sdmp) / len + dmp;
      v.sdmm = nz(v.sdmm) - nz(v.sdmm) / len + dmm;
      const diPlus = (v.sdmp / v.str) * 100;
      const diMinus = (v.sdmm / v.str) * 100;
      s.diPlus[i] = diPlus;
      s.diMinus[i] = diMinus;
      const dx = (Math.abs(diPlus - diMinus) / (diPlus + diMinus)) * 100;
      const adx = s.adxMa.step(dx, len);

      // 3. Trend Step
      const atr = s.atr.step(b.high, b.low, close);
      const maClose = s.maClose.step(close, cfg.maLength);
      const maUp = maClose + atr;
      const maDn = maClose - atr;
      const upperBand = v.trendBand + atr * cfg.trendWidth;
      const lowerBand = v.trendBand - atr * cfg.trendWidth;
      // bar_index < 300: bar_index counts from the first bar given
      if (i < 300) {
        if (ge(close, maUp)) v.direction = true;
        if (le(close, maDn)) v.direction = false;
      } else {
        if (ge(b.low, upperBand)) v.direction = true;
        if (le(b.high, lowerBand)) v.direction = false;
      }
      const hl2 = (b.high + b.low) / 2;
      v.trendBand = v.direction ? Math.max(nz(v.trendBand), hl2) : Math.min(nz(v.trendBand), hl2);
      const trendDir = v.direction;

      // 4. EMA Core
      const ema = s.ema.step(emaSource(b));
      s.emaArr[i] = ema;
      const emaChange = ema - prev(s.emaArr);
      const emaAccel = s.emaAccel.step(emaChange);
      const atr14 = s.atr14.step(b.high, b.low, close);
      // tanh(x) = (exp(2x) - 1) / (exp(2x) + 1)
      const ex = Math.exp(2 * (emaAccel / (atr14 * 0.01)));
      const hue = 60 + ((ex - 1) / (ex + 1)) * 60;
      s.hueRaw[i] = hue;
      const hp = prev(s.hueRaw);
      const emaColor = hsvToRgb(isNaN(hp) ? hue : (hue + hp) / 2, 1.0, 1.0);

      // 6. DI crossover with delayed histogram confirmation; ta.crossover / ta.crossunder compare exactly
      const crossUp = i > 0 && diPlus > diMinus && s.diPlus[i - 1] <= s.diMinus[i - 1];
      const crossDown = i > 0 && diPlus < diMinus && s.diPlus[i - 1] >= s.diMinus[i - 1];
      if (crossUp) {
        v.pendingBull = true;
        v.pendingBear = false;
      }
      if (crossDown) {
        v.pendingBear = true;
        v.pendingBull = false;
      }
      const bullRev = v.pendingBull && gt(longX, 0) && v.lastSignalType !== 1;
      const bearRev = v.pendingBear && lt(longX, 0) && v.lastSignalType !== -1;
      if (bullRev) {
        v.lastSignalType = 1;
        v.pendingBull = false;
      }
      if (bearRev) {
        v.lastSignalType = -1;
        v.pendingBear = false;
      }
      const price = maShortX;
      if (bullRev && !isNaN(price)) {
        s.markers.push({ id: 'shape0', time: t, position: 'atPriceMiddle', price, shape: 'circle', color: bullColor, size: 'tiny' });
      }
      if (bearRev && !isNaN(price)) {
        s.markers.push({ id: 'shape1', time: t, position: 'atPriceMiddle', price, shape: 'circle', color: bearColor, size: 'tiny' });
      }
      if (v.pendingBull && !bullRev) s.bgColors.push({ id: 'bgcolor0', time: t, color: pendingBullCol });
      if (v.pendingBear && !bearRev) s.bgColors.push({ id: 'bgcolor1', time: t, color: pendingBearCol });
      // stateChange = bullReversalCondition or bearReversalCondition
      const state = bullRev || bearRev;
      s.stateFlags[i] = state;
      if (state) s.times.push(t as number);

      const risingShort = gt(shortX, prev(s.shortX));
      const risingT3 = gt(maShortX, prev(s.maShortX));
      const risingLong = gt(longX, prev(s.longX));
      const p = s.plots;
      p[0][i] = { time: t, value: fin(shortX), color: gt(shortX, 0) ? (risingShort ? UP_T : '#228b2200') : (risingShort ? DN_T : '#8b000000') };
      p[1][i] = { time: t, value: fin(maShortX), color: '#00000000' };
      p[2][i] = { time: t, value: fin(maShortX), color: risingT3 ? UP_T : DN_T };
      p[3][i] = { time: t, value: fin(diPlus), color: color.green };
      p[4][i] = { time: t, value: fin(diMinus), color: color.red };
      p[5][i] = { time: t, value: fin(adx), color: color.navy };
      p[6][i] = { time: t, value: 0, color: trendDir ? color.white : color.black };
      p[7][i] = { time: t, value: cfg.showEmaLine ? -10 : NaN, color: emaColor };
      p[8][i] = { time: t, value: fin(longX), color: gt(longX, 0) ? (risingLong ? LONG_UP_RISE : '#77777749') : (risingLong ? LONG_DN_RISE : '#0000003f') };
      p[9][i] = { time: t, value: fin(longX), color: '#00000000' };
      p[10][i] = { time: t, value: fin(longX), color: risingLong ? UP_T : DN_T };
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((pl, k) => { plots[`plot${k}`] = pl.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        // hline(th, color = color.gray): Pine default style dashed, width 1
        hlines: [{ value: cfg.adxThreshold, options: { title: 'ADX Threshold', color: color.gray, linestyle: 'dashed', linewidth: 1 } }],
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
        // alertcondition(stateChange, "Signal Confirmed")
        alerts: liveAlertStates(alertConditions, [s.times], [n > 0 && s.stateFlags[n - 1]]),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BadV04Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<BadV04Inputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertcondition */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Signal Confirmed', message: 'HISTOGRAM CONFIRMED: {{ticker}} - {{interval}}' },
];

/**
 * hsv_to_rgb(h, s, v) of the script: comparisons with na are false (the last branch), color.rgb takes int() of the
 * channels (na channel = 0).
 */
function hsvToRgb(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r: number;
  let g: number;
  let b: number;
  if (lt(h, 60)) [r, g, b] = [c, x, 0];
  else if (lt(h, 120)) [r, g, b] = [x, c, 0];
  else if (lt(h, 180)) [r, g, b] = [0, c, x];
  else if (lt(h, 240)) [r, g, b] = [0, x, c];
  else if (lt(h, 300)) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return String(color.rgb(Math.trunc((r + m) * 255), Math.trunc((g + m) * 255), Math.trunc((b + m) * 255)));
}

export const BadV04 = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
  createRun,
};
