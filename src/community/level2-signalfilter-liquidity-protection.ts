/**
 * [Mad] Level2 Signalfilter Liquidity Protection
 *
 * Filters a routed signal (the sign of source * input multiplier: 1 long, -1 short, 0 none). With the protection on,
 * the first long (short) signal passes and arms a lock with release levels at a percentage of the close; repeated
 * signals of the same side are suppressed until the close leaves the band (above the upper or below the lower level),
 * which releases the lock. A 0 signal clears the output while a lock is armed. With the protection off, the signals
 * pass 1:1. Plots: the input signal (crosses), the filtered output (columns), the release levels (hidden), the lock
 * state (+1 long lock, -1 short lock) and the close (hidden), with levels at +1, 0 and -1 times the output multiplier.
 *
 * Reference: "[Mad] Level2 Signalfilter Liquidity Protection" by djmad
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';


export interface Level2SignalfilterLiquidityProtectionInputs {
  /** Routed signal source */
  signalSource: SourceType;
  /** Input multiplier (a negative value reverses the signal) */
  inputMult: number;
  /** Plot / output multiplier */
  outputMult: number;
  /** Liquidity protection on */
  useLiqProt: boolean;
  /** Upper release level of a long lock, in % of the arming close */
  growLongPct: number;
  /** Lower release level of a long lock, in % of the arming close */
  shrinkLongPct: number;
  /** Upper release level of a short lock, in % of the arming close */
  growShortPct: number;
  /** Lower release level of a short lock, in % of the arming close */
  shrinkShortPct: number;
}

export const defaultInputs: Level2SignalfilterLiquidityProtectionInputs = {
  signalSource: 'close',
  inputMult: 1.0,
  outputMult: 1.0,
  useLiqProt: true,
  growLongPct: 101.0,
  shrinkLongPct: 99.0,
  growShortPct: 101.0,
  shrinkShortPct: 99.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'signalSource', type: 'source', title: 'Select L2 Indicator Signal', defval: 'close' },
  { id: 'inputMult', type: 'float', title: 'Input multiplier / reverse (-value)', defval: 1.0 },
  { id: 'outputMult', type: 'float', title: 'Plot/Output multiplier', defval: 1.0 },
  { id: 'useLiqProt', type: 'bool', title: 'Liquidity Safer active', defval: true },
  { id: 'growLongPct', type: 'float', title: 'Grow for next long', defval: 101.0 },
  { id: 'shrinkLongPct', type: 'float', title: 'Shrink for next long', defval: 99.0 },
  { id: 'growShortPct', type: 'float', title: 'Grow for next short', defval: 101.0 },
  { id: 'shrinkShortPct', type: 'float', title: 'Shrink for next short', defval: 99.0 },
];

const COL_LONG = '#4C9900';
const COL_SHORT = '#CC0000';
const COL_TRANSPARENT = String(color.new(color.black, 100));
const DEFAULT_PLOT = '#2962FF';
const LVL_OFF_LOW = 0.0; // upper release level disarmed
const LVL_OFF_HIGH = 10000000.0; // lower release level disarmed

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Signalinput', color: COL_LONG, lineWidth: 1, style: 'cross' },
  { id: 'plot1', title: 'Signaloutput', color: COL_LONG, lineWidth: 1, style: 'columns' },
  { id: 'plot2', title: 'Long release upper', color: DEFAULT_PLOT, lineWidth: 1, style: 'cross', display: 'none' },
  { id: 'plot3', title: 'Short release upper', color: DEFAULT_PLOT, lineWidth: 1, style: 'cross', display: 'none' },
  { id: 'plot4', title: 'Long release lower', color: DEFAULT_PLOT, lineWidth: 1, style: 'cross', display: 'none' },
  { id: 'plot5', title: 'Short release lower', color: DEFAULT_PLOT, lineWidth: 1, style: 'cross', display: 'none' },
  { id: 'plot6', title: 'Lock state', color: color.yellow, lineWidth: 1, style: 'cross' },
  { id: 'plot7', title: 'Close (hidden)', color: DEFAULT_PLOT, lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: '[Mad] Level2 Signalfilter Liquidity Protection',
  shortTitle: '[Mad] L2 Filter LiqProt',
  overlay: false,
  precision: 2,
  format: 'price',
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color?: string };

interface L2Vars {
  longUpper: number;
  longLower: number;
  shortUpper: number;
  shortLower: number;
  longActive: boolean;
  shortActive: boolean;
  filterBuy: number;
  filterSell: number;
}

interface L2Run extends BarRunState<L2Vars> {
  plots: Point[][];
}

function study(inputs: Partial<Level2SignalfilterLiquidityProtectionInputs>): BarStudy<L2Run, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.signalSource);
  const out = cfg.outputMult;
  const fin = (x: number) => (Number.isFinite(x) ? x : NaN);
  return {
    fullRunReason: () => (isBarSource(cfg.signalSource) ? null : 'source of another study'),
    init() {
      const plots: Point[][] = Array.from({ length: 8 }, () => []);
      return {
        plots, steps: [], lists: [], series: plots,
        vars: {
          longUpper: LVL_OFF_LOW, longLower: LVL_OFF_HIGH, shortUpper: LVL_OFF_LOW, shortLower: LVL_OFF_HIGH,
          longActive: false, shortActive: false, filterBuy: 0, filterSell: 0,
        },
      };
    },
    bar(s, i, bars) {
      const v = s.vars;
      const close = bars[i].close;
      const weightedSignal = value(bars[i]) * cfg.inputMult;
      const signal = gt(weightedSignal, 0) ? 1 : lt(weightedSignal, 0) ? -1 : 0;

      if (cfg.useLiqProt) {
        if (signal === 1 && !v.longActive) {
          v.longActive = true;
          v.longUpper = close * (cfg.growLongPct / 100);
          v.longLower = close * (cfg.shrinkLongPct / 100);
          v.filterBuy = 1;
        } else if (signal === 1 && v.longActive) {
          v.filterBuy = 0;
        } else if (signal === -1 && !v.shortActive) {
          v.shortActive = true;
          v.shortUpper = close * (cfg.growShortPct / 100);
          v.shortLower = close * (cfg.shrinkShortPct / 100);
          v.filterSell = -1;
        } else if (signal === -1 && v.shortActive) {
          v.filterSell = 0;
        } else if (signal === 0 && (v.shortActive || v.longActive)) {
          v.filterBuy = 0;
          v.filterSell = 0;
        }
      } else if (signal === 1) {
        v.filterBuy = 1;
      } else if (signal === -1) {
        v.filterSell = -1;
      } else {
        v.filterBuy = 0;
        v.filterSell = 0;
      }

      // Release the locks once the close leaves the protection band
      if (v.shortActive && (gt(close, v.shortUpper) || lt(close, v.shortLower))) {
        v.shortUpper = LVL_OFF_LOW;
        v.shortLower = LVL_OFF_HIGH;
        v.shortActive = false;
      }
      if (v.longActive && (gt(close, v.longUpper) || lt(close, v.longLower))) {
        v.longUpper = LVL_OFF_LOW;
        v.longLower = LVL_OFF_HIGH;
        v.longActive = false;
      }

      const filterOut = v.filterBuy > 0 ? 1 : v.filterSell < 0 ? -1 : 0;
      const signalColor = signal > 0 ? COL_LONG : signal < 0 ? COL_SHORT : color.yellow;
      const filterColor = filterOut > 0 ? COL_LONG : filterOut < 0 ? COL_SHORT : COL_TRANSPARENT;

      const t = bars[i].time;
      const p = s.plots;
      p[0][i] = { time: t, value: signal !== 0 ? fin(signal * out) : NaN, color: signalColor };
      p[1][i] = { time: t, value: filterOut !== 0 ? fin(filterOut * out) : 0, color: filterColor };
      p[2][i] = { time: t, value: eq(v.longUpper, LVL_OFF_LOW) ? NaN : fin(v.longUpper) };
      p[3][i] = { time: t, value: eq(v.shortUpper, LVL_OFF_LOW) ? NaN : fin(v.shortUpper) };
      p[4][i] = { time: t, value: eq(v.longLower, LVL_OFF_HIGH) ? NaN : fin(v.longLower) };
      p[5][i] = { time: t, value: eq(v.shortLower, LVL_OFF_HIGH) ? NaN : fin(v.shortLower) };
      p[6][i] = { time: t, value: v.longActive ? 1 : v.shortActive ? -1 : NaN };
      p[7][i] = { time: t, value: fin(close) };
    },
    result(s) {
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      const level = { color: '#787B86', linestyle: 'dashed' as const, linewidth: 1 };
      return {
        metadata: {
          title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay,
          precision: metadata.precision, format: metadata.format,
        },
        plots,
        hlines: [
          { value: 1 * out, options: { title: 'Level +1', ...level } },
          { value: 0, options: { title: 'Level 0', ...level } },
          { value: -1 * out, options: { title: 'Level -1', ...level } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<Level2SignalfilterLiquidityProtectionInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<Level2SignalfilterLiquidityProtectionInputs> = {},
): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const Level2SignalfilterLiquidityProtection = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
