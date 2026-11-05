/**
 * Percentile Rank Oscillator (Price + VWMA)
 *
 * Percentile rank (0..100) of the candle midpoint (high + low) / 2 among its last `Lookback` values (fewer at the
 * start of the history; na counts as 0): (count below + 0.5 * count equal) / count * 100, with a linear interpolation
 * between the two neighbours when the value is not in the window. The second line is the percentile rank of the
 * deviation of the midpoint from its VWMA. Both can be smoothed with an RMA and are shown on a -1..+1 or 0..100
 * scale. The background takes the top / bottom colour when a percentile reaches the upper / lower threshold
 * (priority: both lines, then price, then VWMA), with a band fill between the threshold lines.
 * Alerts (alertcondition, `alerts` of the result): price / VWMA / confluence TOP and BOTTOM, true on the bars where
 * the percentile is at or beyond the threshold (and the alert switch of that kind is on).
 *
 * Reference: "Percentile Rank Oscillator (Price + VWMA)" by exploretranspose
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, math, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { BgColorData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export type PercentileRankOutputScale = '-1..+1' | '0..100';

export interface PercentileRankOscillatorInputs {
  /** Lookback (bars for percentile), clamped to 3..500 */
  lookback: number;
  /** Output scale */
  outputScale: PercentileRankOutputScale;
  /** Enable the VWMA-based percentile */
  enableVwmaPct: boolean;
  /** Use VWMA length = main lookback */
  vwmaLenSame: boolean;
  /** VWMA length when not the main lookback */
  vwmaLenCustom: number;
  /** RMA smoothing length (1 = none) */
  smooth: number;
  /** Upper percentile threshold (%) */
  highThresh: number;
  /** Lower percentile threshold (%) */
  lowThresh: number;
  /** Fill the background when an extreme is hit */
  fillExtremes: boolean;
  /** Price percentile background (and alerts) */
  alertsPrice: boolean;
  /** VWMA percentile background (and alerts) */
  alertsVwma: boolean;
  /** Confluence background (and alerts) */
  alertsConfl: boolean;
  topColor: string;
  botColor: string;
  bandFillColor: string;
}

export const defaultInputs: PercentileRankOscillatorInputs = {
  lookback: 100,
  outputScale: '-1..+1',
  enableVwmaPct: true,
  vwmaLenSame: true,
  vwmaLenCustom: 100,
  smooth: 1,
  highThresh: 95.0,
  lowThresh: 5.0,
  fillExtremes: true,
  alertsPrice: true,
  alertsVwma: true,
  alertsConfl: true,
  // input.color(color.new(#A53860, 80)) / (#4D8B31, 80) / (#423E3B, 95): alpha 0.2 / 0.2 / 0.05
  topColor: 'rgba(165, 56, 96, 0.2)',
  botColor: 'rgba(77, 139, 49, 0.2)',
  bandFillColor: 'rgba(66, 62, 59, 0.05)',
};

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'Lookback (bars for percentile)', defval: 100, min: 3, max: 500, group: 'Core' },
  { id: 'outputScale', type: 'string', title: 'Output scale', defval: '-1..+1', options: ['-1..+1', '0..100'], group: 'Core' },
  { id: 'enableVwmaPct', type: 'bool', title: 'Enable VWMA-based percentile', defval: true, group: 'VWMA Percentile' },
  { id: 'vwmaLenSame', type: 'bool', title: 'Use VWMA length = main lookback', defval: true, group: 'VWMA Percentile' },
  { id: 'vwmaLenCustom', type: 'int', title: 'VWMA length (if custom)', defval: 100, min: 1, group: 'VWMA Percentile' },
  { id: 'smooth', type: 'int', title: 'Smoothing (RMA) length (1 = none)', defval: 1, min: 1, group: 'Display' },
  { id: 'highThresh', type: 'float', title: 'Upper percentile threshold (%)', defval: 95.0, min: 50.0, max: 100.0, step: 0.1, group: 'Display' },
  { id: 'lowThresh', type: 'float', title: 'Lower percentile threshold (%)', defval: 5.0, min: 0.0, max: 50.0, step: 0.1, group: 'Display' },
  { id: 'fillExtremes', type: 'bool', title: 'Fill background when extremes hit', defval: true, group: 'Display' },
  { id: 'alertsPrice', type: 'bool', title: 'Enable price percentile alerts', defval: true, group: 'Alerts & Colors' },
  { id: 'alertsVwma', type: 'bool', title: 'Enable VWMA percentile alerts', defval: true, group: 'Alerts & Colors' },
  { id: 'alertsConfl', type: 'bool', title: 'Enable confluence alerts (price + VWMA)', defval: true, group: 'Alerts & Colors' },
  { id: 'topColor', type: 'color', title: 'Top (overbought) BG color', defval: 'rgba(165, 56, 96, 0.2)', group: 'Colors (bg fills)' },
  { id: 'botColor', type: 'color', title: 'Bottom (oversold) BG color', defval: 'rgba(77, 139, 49, 0.2)', group: 'Colors (bg fills)' },
  { id: 'bandFillColor', type: 'color', title: 'Working band fill (between thresholds)', defval: 'rgba(66, 62, 59, 0.05)', group: 'Colors (bg fills)' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Price Percentile', color: '#5448C8', lineWidth: 1 },
  { id: 'plot1', title: 'VWMA Percentile', color: '#548687', lineWidth: 1 },
];

/** hline(top_line / bot_line / mid) with the default inputs (-1..+1 scale, thresholds 95 / 5) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_top', price: 0.9, title: 'Top', color: '#A53860', linestyle: 'dashed' },
  { id: 'hline_bot', price: -0.9, title: 'Bot', color: '#4D8B31', linestyle: 'dashed' },
  { id: 'hline_mid', price: 0, title: 'Mid', color: '#423E3B', linestyle: 'dashed' },
];

/** fill(h_top, h_bot, band_fill_color) with the default colour */
export const fillConfig: FillConfig[] = [
  { id: 'fill_band', plot1: 'hline_top', plot2: 'hline_bot', color: 'rgba(66, 62, 59, 0.05)' },
];

export const metadata = {
  title: 'Percentile Rank Oscillator (Price + VWMA)',
  shortTitle: 'PRO',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const nz = (v: number) => (isNaN(v) ? 0 : v);

/**
 * rolling_percentile_interp(src, n) at bar i: percentile rank (0..100) of nz(src) among nz(src[0..avail - 1]),
 * avail = min(n, bar_index + 1)
 */
function rollingPercentile(src: number[], n: number, i: number): number {
  const avail = Math.min(n, i + 1);
  const arr: number[] = [];
  for (let k = 0; k <= avail - 1; k++) arr.push(nz(src[i - k]));
  arr.sort((x, y) => x - y);
  const current = nz(src[i]);
  let less = 0;
  let equal = 0;
  for (const v of arr) {
    less += lt(v, current) ? 1 : 0;
    equal += eq(v, current) ? 1 : 0;
  }
  let pct = 0.0;
  if (equal > 0) {
    pct = ((less + 0.5 * equal) / Math.max(avail, 1)) * 100.0;
  } else if (less === 0) {
    pct = 0.0;
  } else if (less >= avail) {
    pct = 100.0;
  } else {
    const vLow = arr[less - 1];
    const vHigh = arr[less];
    const denom = vHigh - vLow;
    const frac = eq(denom, 0.0) ? 0.5 : Math.max(0.0, Math.min(1.0, (current - vLow) / denom));
    pct = ((less + frac) / Math.max(avail, 1)) * 100.0;
  }
  return pct;
}

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

interface ProRun extends BarRunState<Record<string, never>> {
  priceRma: ReturnType<typeof taStep.rma> | null;
  vwRma: ReturnType<typeof taStep.rma> | null;
  vwma: ReturnType<typeof taStep.vwma> | null;
  mid: number[];
  disp: number[];
  plot0: Point[];
  plot1: Point[];
  bandColors: string[];
  flags: boolean[][];
  times: number[][];
  bgColors: BgColorData[];
}

function study(inputs: Partial<PercentileRankOscillatorInputs>): BarStudy<ProRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = Math.max(3, Math.min(cfg.lookback, 500));
  const minusOneToOne = cfg.outputScale === '-1..+1';
  const mapToOut = (x: number) => (minusOneToOne ? x / 50.0 - 1.0 : x);
  const vwlen = cfg.vwmaLenSame ? len : Math.max(1, cfg.vwmaLenCustom);
  return {
    init() {
      const priceRma = cfg.smooth > 1 ? taStep.rma(cfg.smooth) : null;
      const vwRma = cfg.enableVwmaPct && cfg.smooth > 1 ? taStep.rma(cfg.smooth) : null;
      const vwma = cfg.enableVwmaPct ? taStep.vwma(vwlen) : null;
      const s: ProRun = {
        priceRma, vwRma, vwma, mid: [], disp: [], plot0: [], plot1: [], bandColors: [],
        flags: [[], [], [], [], [], []], times: [[], [], [], [], [], []], bgColors: [],
        steps: [priceRma, vwRma, vwma].filter((m) => m !== null),
        vars: {}, lists: [], series: [],
      };
      s.lists = [...s.times, s.bgColors];
      s.series = [s.mid, s.disp, s.plot0, s.plot1, s.bandColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      s.mid[i] = (b.high + b.low) / 2.0;

      // Price percentile
      const pricePct = rollingPercentile(s.mid, len, i);
      const priceOut = mapToOut(s.priceRma ? s.priceRma.step(pricePct) : pricePct);

      // VWMA percentile: percentile of the deviation mid - vwma(mid)
      let vwmaPct = 0.0;
      let vwOut = 0.0;
      if (s.vwma) {
        const vwmaMid = s.vwma.step(s.mid[i], b.volume ?? NaN);
        s.disp[i] = s.mid[i] - vwmaMid;
        vwmaPct = rollingPercentile(s.disp, len, i);
        vwOut = mapToOut(s.vwRma ? s.vwRma.step(vwmaPct) : vwmaPct);
      }

      // Background: confluence > price > VWMA
      const isPriceTop = ge(pricePct, cfg.highThresh);
      const isPriceBot = le(pricePct, cfg.lowThresh);
      const isVwTop = cfg.enableVwmaPct ? ge(vwmaPct, cfg.highThresh) : false;
      const isVwBot = cfg.enableVwmaPct ? le(vwmaPct, cfg.lowThresh) : false;
      const conflTop = cfg.enableVwmaPct && isPriceTop && isVwTop;
      const conflBot = cfg.enableVwmaPct && isPriceBot && isVwBot;
      const bgPrice = (isPriceTop || isPriceBot) && cfg.fillExtremes && cfg.alertsPrice ? (isPriceTop ? cfg.topColor : cfg.botColor) : null;
      const bgVw = (isVwTop || isVwBot) && cfg.fillExtremes && cfg.alertsVwma ? (isVwTop ? cfg.topColor : cfg.botColor) : null;
      const bgConfl = (conflTop || conflBot) && cfg.fillExtremes && cfg.alertsConfl ? (conflTop ? cfg.topColor : cfg.botColor) : null;
      const finalBg = bgConfl ?? bgPrice ?? bgVw;
      const flags = [
        cfg.alertsPrice && isPriceTop,
        cfg.alertsPrice && isPriceBot,
        cfg.enableVwmaPct && cfg.alertsVwma && isVwTop,
        cfg.enableVwmaPct && cfg.alertsVwma && isVwBot,
        cfg.enableVwmaPct && cfg.alertsConfl && conflTop,
        cfg.enableVwmaPct && cfg.alertsConfl && conflBot,
      ];
      flags.forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(b.time as number);
      });
      if (finalBg !== null) s.bgColors.push({ time: b.time, color: finalBg });

      s.plot0[i] = { time: b.time, value: priceOut, color: '#5448C8' };
      s.plot1[i] = { time: b.time, value: cfg.enableVwmaPct ? vwOut : NaN, color: '#548687' };
      s.bandColors[i] = cfg.bandFillColor;
    },
    result(s, bars) {
      const n = bars.length;
      // Working band lines, rounded to 6 decimals
      const topLine = math.round((minusOneToOne ? cfg.highThresh / 50.0 - 1.0 : cfg.highThresh) * 1e6) / 1e6;
      const botLine = math.round((minusOneToOne ? cfg.lowThresh / 50.0 - 1.0 : cfg.lowThresh) * 1e6) / 1e6;
      const midLine = minusOneToOne ? 0.0 : 50.0;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        hlines: [
          { value: topLine, options: { title: 'Top', color: '#A53860', linestyle: 'dashed' } },
          { value: botLine, options: { title: 'Bot', color: '#4D8B31', linestyle: 'dashed' } },
          { value: midLine, options: { title: 'Mid', color: '#423E3B', linestyle: 'dashed' } },
        ],
        fills: [
          // fill(h_top, h_bot, band_fill_color)
          { plot1: 'hline_top', plot2: 'hline_bot', options: { color: cfg.bandFillColor },
            colors: s.bandColors.slice() },
        ],
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PercentileRankOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<PercentileRankOscillatorInputs> = {},
): IndicatorResult & { bgColors: BgColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Price Percentile TOP', message: 'Price percentile reached TOP threshold' },
  { id: 'alert1', title: 'Price Percentile BOTTOM', message: 'Price percentile reached BOTTOM threshold' },
  { id: 'alert2', title: 'VWMA Percentile TOP', message: 'VWMA percentile reached TOP threshold' },
  { id: 'alert3', title: 'VWMA Percentile BOTTOM', message: 'VWMA percentile reached BOTTOM threshold' },
  { id: 'alert4', title: 'Confluence TOP', message: 'Price & VWMA percentiles both at TOP extreme' },
  { id: 'alert5', title: 'Confluence BOTTOM', message: 'Price & VWMA percentiles both at BOTTOM extreme' },
];

export const PercentileRankOscillator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
  alertConditions,
};
