/**
 * Adaptive RSI | Lyro RS
 *
 * ARSI: the RSI distance from 50 scaled to -100..100 (new calculation) or the fast EMA minus the slow EMA of the RSI
 * (old calculation), drawn as columns with an EMA signal line. Bands: the stdev of the ARSI times the upper / lower
 * multipliers (new bands) or the SMA of the ARSI plus these (old bands), eased with the previous raw band. The column
 * and bar colour follow the signal type (trend following, strong trend following, reversion, volatility spectrum),
 * or the ARSI sign with the old calculation.
 *
 * Reference: "Adaptive RSI | Lyro RS" by LyroRS
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AdaptiveRsiLyroRsInputs {
  signalType: 'Trend Following' | 'Strong Trend Following' | 'Reversion' | 'Volatility Spectrum';
  calcStyle: 'New Calculation' | 'Old Calculation';
  bandsStyle: 'New Bands' | 'Old Bands';
  src: SourceType;
  rsiLength: number;
  /** EMA length of the signal line */
  signalLength: number;
  /** Fast EMA of the RSI (old calculation) */
  emaShort: number;
  /** Slow EMA of the RSI (old calculation) */
  emaLong: number;
  /** SMA / stdev length of the bands */
  bbLength: number;
  upperbandMult: number;
  lowerbandMult: number;
  /** Weight of the current raw band (0-2) */
  bandEasing: number;
  /** Colour palette ('Major Themes' has no colours in the script: na) */
  colMode: 'Classic' | 'Mystic' | 'Major Themes' | 'Accented' | 'Royal';
  useCustomPalette: boolean;
  customUp: string;
  customDown: string;
}

export const defaultInputs: AdaptiveRsiLyroRsInputs = {
  signalType: 'Trend Following',
  calcStyle: 'New Calculation',
  bandsStyle: 'New Bands',
  src: 'close',
  rsiLength: 20,
  signalLength: 15,
  emaShort: 14,
  emaLong: 22,
  bbLength: 22,
  upperbandMult: 0.6,
  lowerbandMult: -0.9,
  bandEasing: 0.6,
  colMode: 'Mystic',
  useCustomPalette: false,
  customUp: '#00ff00',
  customDown: '#ff0000',
};

export const inputConfig: InputConfig[] = [
  { id: 'signalType', type: 'string', title: 'Signal Type', defval: 'Trend Following',
    options: ['Trend Following', 'Strong Trend Following', 'Reversion', 'Volatility Spectrum'] },
  { id: 'calcStyle', type: 'string', title: 'Calculation Style', defval: 'New Calculation', options: ['New Calculation', 'Old Calculation'] },
  { id: 'bandsStyle', type: 'string', title: 'Bands Style', defval: 'New Bands', options: ['New Bands', 'Old Bands'] },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 20 },
  { id: 'signalLength', type: 'int', title: 'Signal Smoothing', defval: 15 },
  { id: 'emaShort', type: 'int', title: 'Fast EMA Smoothing', defval: 14 },
  { id: 'emaLong', type: 'int', title: 'Slow EMA Smoothing', defval: 22 },
  { id: 'bbLength', type: 'int', title: 'Band Length', defval: 22 },
  { id: 'upperbandMult', type: 'float', title: 'Upperband Multiplier', defval: 0.6, min: 0 },
  { id: 'lowerbandMult', type: 'float', title: 'Loweband Multiplier', defval: -0.9, max: 0 },
  { id: 'bandEasing', type: 'float', title: 'Band Smoothing (0-2)', defval: 0.6, min: 0, max: 2 },
  { id: 'colMode', type: 'string', title: 'Custom Color Palette', defval: 'Mystic',
    options: ['Classic', 'Mystic', 'Major Themes', 'Accented', 'Royal'] },
  { id: 'useCustomPalette', type: 'bool', title: 'Use Custom Palette', defval: false },
  { id: 'customUp', type: 'color', title: 'Custom Up', defval: '#00ff00' },
  { id: 'customDown', type: 'color', title: 'Custom Down', defval: '#ff0000' },
];

const BAND_FILL = String(color.new(color.teal, 85));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ARSI', color: '#30FDCF', lineWidth: 2, style: 'columns' },
  { id: 'plot1', title: 'Signal Line', color: color.white, lineWidth: 1 },
  // plot(upperBand, "Upper Band") / plot(lowerBand, "Lower Band"): Pine default colour
  { id: 'plot2', title: 'Upper Band', color: color.blue, lineWidth: 1 },
  { id: 'plot3', title: 'Lower Band', color: color.blue, lineWidth: 1 },
];

export const metadata = {
  title: 'Adaptive RSI | Lyro RS',
  shortTitle: 'ARSI | 𝓛𝔂𝓻𝓸 𝓡𝓢',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const nz = (x: number) => (Number.isNaN(x) ? 0 : x);

const PALETTES: Record<string, [string, string] | undefined> = {
  Classic: ['#00E676', '#880E4F'],
  Mystic: ['#30FDCF', '#E117B7'],
  Accented: ['#9618F7', '#FF0078'],
  Royal: ['#FFC107', '#673AB7'],
};

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { barColors: BarColorData[] };

interface ArsiVars {
  /** var color pc = na (null) */
  pc: string | null;
  /** raw_ub[1], raw_lb[1] */
  prevUb: number;
  prevLb: number;
}

interface ArsiRun extends BarRunState<ArsiVars> {
  rsi: ReturnType<typeof taStep.rsi>;
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  basis: WindowSma;
  std: WindowStdev;
  signal: ReturnType<typeof taStep.ema>;
  plots: Point[][];
  barColors: BarColorData[];
}

function study(inputs: Partial<AdaptiveRsiLyroRsInputs>): BarStudy<ArsiRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);

  // Colours: no switch case for "Major Themes" (UpC / DnC stay na); null = na
  let upC: string | null = PALETTES[cfg.colMode]?.[0] ?? null;
  let dnC: string | null = PALETTES[cfg.colMode]?.[1] ?? null;
  if (cfg.useCustomPalette) {
    upC = cfg.customUp;
    dnC = cfg.customDown;
  }
  const newCalc = cfg.calcStyle === 'New Calculation';
  const rawBand = (b: number, std: number, mult: number) => (cfg.bandsStyle === 'New Bands' ? std * mult
    : cfg.bandsStyle === 'Old Bands' ? b + std * mult : NaN);

  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const rsi = taStep.rsi(cfg.rsiLength);
      const fast = taStep.ema(cfg.emaShort);
      const slow = taStep.ema(cfg.emaLong);
      const basis = new WindowSma(cfg.bbLength);
      const std = new WindowStdev(cfg.bbLength);
      const signal = taStep.ema(cfg.signalLength);
      const s: ArsiRun = {
        rsi, fast, slow, basis, std, signal, plots: [[], [], [], []], barColors: [],
        steps: [rsi, fast, slow, basis, std, signal], vars: { pc: null, prevUb: NaN, prevLb: NaN }, lists: [], series: [],
      };
      s.lists = [s.barColors];
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const t = bars[i].time;
      const r = s.rsi.step(value(bars[i]));
      const rsiEmaFast = s.fast.step(r);
      const rsiEmaSlow = s.slow.step(r);
      const a = newCalc ? ((r - 50) / 50) * 100 : rsiEmaFast - rsiEmaSlow;

      const basis = s.basis.step(a);
      const std = s.std.step(a);
      const sig = s.signal.step(a);
      const rawUb = rawBand(basis, std, cfg.upperbandMult);
      const rawLb = rawBand(basis, std, cfg.lowerbandMult);
      // upperBand := raw_ub * bandEasing + nz(raw_ub[1]) * (1 - bandEasing)
      const ub = rawUb * cfg.bandEasing + nz(v.prevUb) * (1 - cfg.bandEasing);
      const lb = rawLb * cfg.bandEasing + nz(v.prevLb) * (1 - cfg.bandEasing);
      v.prevUb = rawUb;
      v.prevLb = rawLb;

      if (newCalc) {
        if (cfg.signalType === 'Trend Following') {
          if (gt(a, ub)) v.pc = upC;
          else if (lt(a, lb)) v.pc = dnC;
        } else if (cfg.signalType === 'Strong Trend Following') {
          if (gt(sig, ub)) v.pc = upC;
          else if (lt(sig, lb)) v.pc = dnC;
          else if (lt(a, ub) && gt(a, lb)) v.pc = color.gray;
        } else if (cfg.signalType === 'Reversion') {
          if (gt(a, ub) && gt(sig, a)) v.pc = dnC;
          else if (lt(a, lb) && lt(sig, a)) v.pc = upC;
          else v.pc = color.gray;
        } else if (cfg.signalType === 'Volatility Spectrum') {
          if (gt(a, sig) && gt(a, ub)) v.pc = upC;
          else if (lt(a, sig) && lt(a, lb)) v.pc = dnC;
          else v.pc = color.gray;
        }
      } else if (cfg.calcStyle === 'Old Calculation') {
        if (gt(a, 0)) v.pc = upC;
        else if (lt(a, 0)) v.pc = dnC;
      }
      const pc = v.pc;
      if (pc !== null) s.barColors.push({ time: t, color: pc });

      // plot(arsi, "ARSI", color = pc, linewidth = 2, style = plot.style_columns): na colour draws no column
      s.plots[0][i] = { time: t, value: a, color: pc ?? 'transparent' };
      s.plots[1][i] = { time: t, value: sig, color: color.white };
      s.plots[2][i] = { time: t, value: ub, color: color.blue };
      s.plots[3][i] = { time: t, value: lb, color: color.blue };
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice() },
        hlines: [{ value: 0, options: { title: 'Zero Line', color: color.gray, linestyle: 'dashed', linewidth: 1 } }],
        fills: [{ plot1: 'plot2', plot2: 'plot3', options: { title: 'Band Fill', color: BAND_FILL } }],
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AdaptiveRsiLyroRsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AdaptiveRsiLyroRsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const AdaptiveRsiLyroRs = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
