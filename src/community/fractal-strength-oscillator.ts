/**
 * Fractal Strength Oscillator
 *
 * An RSI of the source (optionally smoothed by a moving average of a chosen type) and a "fractal dimension" line.
 * The fractal dimension line is FDI = 1 + (log(MA Length) + log(2)) / log(2 * Length): it only depends on two
 * inputs, so it is a constant line. The RSI trend is 1 above 55 and -1 below 45 (kept in between); the FDI trend
 * is -1 above the trend threshold and 1 below it. The overall trend follows the RSI trend once both trends are set.
 * The FDI line and the bars take the trend colour (bull / bear / gray), the RSI line the RSI trend colour. A
 * horizontal line at 50.
 *
 * Reference: "Fractal Strength Oscillator" by SurgeQuant
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © SurgeQuant
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { AlmaStep, barSource, createBarRun, fullResult, isBarSource, WindowSma, WindowVwma, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface FractalStrengthOscillatorInputs {
  /** Source */
  src: SourceType;
  /** FDI length (N) */
  length: number;
  /** FDI trend threshold */
  fdiThreshold: number;
  /** RSI length */
  rsiLength: number;
  /** Smooth the RSI with the moving average */
  useSmoothing: boolean;
  /** Moving average type of the smoothing */
  maType: 'SMA' | 'EMA' | 'DEMA' | 'TEMA' | 'WMA' | 'VWMA' | 'SMMA' | 'HMA' | 'LSMA' | 'ALMA';
  /** Moving average length (also used by the FDI formula) */
  maLength: number;
  /** ALMA sigma */
  sigma: number;
  bullColor: string;
  bearColor: string;
}

export const defaultInputs: FractalStrengthOscillatorInputs = {
  src: 'close',
  length: 20,
  fdiThreshold: 1.45,
  rsiLength: 14,
  useSmoothing: false,
  maType: 'EMA',
  maLength: 14,
  sigma: 5,
  bullColor: '#00ffee',
  bearColor: '#ff0055',
};

const GROUP_FDI = 'FDI Parameters 📊 ';
const GROUP_RSI = 'RSI Parameters 📏';
const GROUP_COLOR = 'Visual Parameters 🎨';

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'length', type: 'int', title: 'Length', defval: 20, group: GROUP_FDI },
  { id: 'fdiThreshold', type: 'float', title: 'Trend Threshold', defval: 1.45, group: GROUP_FDI },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, group: GROUP_RSI },
  { id: 'useSmoothing', type: 'bool', title: 'Use Smoothing', defval: false, group: GROUP_RSI },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'EMA', group: GROUP_RSI,
    options: ['SMA', 'EMA', 'DEMA', 'TEMA', 'WMA', 'VWMA', 'SMMA', 'HMA', 'LSMA', 'ALMA'] },
  { id: 'maLength', type: 'int', title: 'MA Length', defval: 14, group: GROUP_RSI },
  { id: 'sigma', type: 'int', title: 'Sigma', defval: 5, group: GROUP_RSI, tooltip: 'Sigma Period for ALMA' },
  { id: 'bullColor', type: 'color', title: 'Bull Color', defval: '#00ffee', group: GROUP_COLOR },
  { id: 'bearColor', type: 'color', title: 'Bear Color', defval: '#ff0055', group: GROUP_COLOR },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'FDI', color: color.gray, lineWidth: 1 },
  { id: 'plot1', title: 'RSI', color: '#ff0055', lineWidth: 1 },
];

export const metadata = {
  title: 'Fractal Strength Oscillator',
  shortTitle: 'Fractal Strength Oscillator',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = IndicatorResult & { barColors: BarColorData[] };
type Point = { time: number; value: number; color: string };
/** The moving average of calcMovingAverage on one bar (`i`: the bar, for the WMA loop over the RSI history) */
type Ma = Committable & { step(v: number, volume: number, i: number): number };

interface FsoVars {
  /** var int RSItrend = 0 */
  rsiTrend: number;
  /** var int FDItrend = 0 */
  fdiTrend: number;
  /** var int Trend = 0 */
  trend: number;
  /** var col = color.gray */
  col: string;
}

interface FsoRun extends BarRunState<FsoVars> {
  rsi: ReturnType<typeof taStep.rsi>;
  ma: Ma;
  baseRsi: number[];
  fdiPlot: Point[];
  rsiPlot: Point[];
  barColors: BarColorData[];
}

const NO_COMMIT = (): void => {};

function study(inputs: Partial<FractalStrengthOscillatorInputs>): BarStudy<FsoRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const N = cfg.length;
  const length = cfg.maLength;
  const value = barSource(cfg.src);

  // The hh / ll / diffs array / fdi_length code of the Pine source is not used by any output: Pine removes it (no
  // runtime error even with Length 0 or 1, where array.get would be out of bounds), so it is not ported.

  // FDI = 1 + (math.log(length) + math.log(2)) / math.log(2 * N): `length` is the MA Length input
  const FDI = 1 + (Math.log(length) + Math.log(2)) / Math.log(2 * N);

  // The moving average of calcMovingAverage(ma_type, base_rsi, length, sigma) (called on every bar)
  const maStep = (baseRsi: number[]): Ma => {
    switch (cfg.maType) {
      case 'SMA': {
        const m = new WindowSma(length);
        return { step: (v) => m.step(v), commit: () => m.commit() };
      }
      case 'EMA': {
        const m = taStep.ema(length);
        return { step: (v) => m.step(v), commit: () => m.commit() };
      }
      case 'DEMA': {
        const m1 = taStep.ema(length);
        const m2 = taStep.ema(length);
        return {
          step: (v) => { const e1 = m1.step(v); const e2 = m2.step(e1); return 2 * e1 - e2; },
          commit: () => { m1.commit(); m2.commit(); },
        };
      }
      case 'TEMA': {
        const m1 = taStep.ema(length);
        const m2 = taStep.ema(length);
        const m3 = taStep.ema(length);
        return {
          step: (v) => { const e1 = m1.step(v); const e2 = m2.step(e1); const e3 = m3.step(e2); return 3 * (e1 - e2) + e3; },
          commit: () => { m1.commit(); m2.commit(); m3.commit(); },
        };
      }
      case 'WMA':
        // for i = 0 to length - 1: weight = length - i; norm += weight; sum += S[i] * weight; result = sum / norm
        return {
          step: (_v, _vol, bi) => {
            let norm = 0.0;
            let sum = 0.0;
            for (let i = 0; i <= length - 1; i++) {
              const weight = length - i;
              norm = norm + weight;
              sum = sum + (bi - i >= 0 ? baseRsi[bi - i]! : NaN) * weight;
            }
            return sum / norm;
          },
          commit: NO_COMMIT,
        };
      case 'VWMA': {
        const m = new WindowVwma(length);
        return { step: (v, vol) => m.step(v, vol), commit: () => m.commit() };
      }
      case 'SMMA': {
        const m = taStep.rma(length);
        return { step: (v) => m.step(v), commit: () => m.commit() };
      }
      case 'HMA': {
        const m = taStep.hma(length);
        return {
          step: (v) => {
            if (length === 1) throw new Error("Invalid value of the 'length' argument (0.0) in the 'wma' function. It must be > 0.");
            return m.step(v);
          },
          commit: () => m.commit(),
        };
      }
      case 'LSMA': {
        const m = taStep.linreg(length, 0);
        return { step: (v) => m.step(v), commit: () => m.commit() };
      }
      case 'ALMA': {
        const m = new AlmaStep(length, 0.85, cfg.sigma);
        return { step: (v) => m.step(v), commit: () => m.commit() };
      }
      default:
        return { step: () => NaN, commit: NO_COMMIT };
    }
  };

  const gray = color.gray;
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const rsi = taStep.rsi(cfg.rsiLength);
      const baseRsi: number[] = [];
      const ma = maStep(baseRsi);
      const s: FsoRun = {
        rsi, ma, baseRsi, fdiPlot: [], rsiPlot: [], barColors: [],
        steps: [rsi, ma], vars: { rsiTrend: 0, fdiTrend: 0, trend: 0, col: gray }, lists: [], series: [],
      };
      s.series = [s.baseRsi, s.fdiPlot, s.rsiPlot, s.barColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const v = s.vars;
      // RSI and the moving average (called on every bar)
      const base = s.rsi.step(value(b));
      s.baseRsi[i] = base;
      const smoothed = s.ma.step(base, b.volume ?? NaN, i);
      const r = cfg.useSmoothing ? smoothed : base;
      if (lt(r, 45)) v.rsiTrend = -1;
      if (gt(r, 55)) v.rsiTrend = 1;
      if (gt(FDI, cfg.fdiThreshold)) v.fdiTrend = -1;
      if (lt(FDI, cfg.fdiThreshold)) v.fdiTrend = 1;
      const rsiTrend = v.rsiTrend;
      const fdiTrend = v.fdiTrend;
      if (rsiTrend === 1 && fdiTrend === 1) v.trend = 1;
      if (rsiTrend === 1 && fdiTrend === -1) v.trend = 1;
      if (rsiTrend === -1 && fdiTrend === -1) v.trend = -1;
      if (rsiTrend === -1 && fdiTrend === 1) v.trend = -1;
      const trend = v.trend;
      if (trend === 1) v.col = cfg.bullColor;
      if (trend === -1) v.col = cfg.bearColor;
      if (trend === 0) v.col = gray;
      const col = v.col;

      const t = b.time as number;
      s.fdiPlot[i] = { time: t, value: Number.isFinite(FDI) ? FDI : NaN, color: col };
      s.rsiPlot[i] = { time: t, value: r, color: rsiTrend === 1 ? cfg.bullColor : cfg.bearColor };
      s.barColors[i] = { time: t, color: col };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.fdiPlot.slice(), plot1: s.rsiPlot.slice() },
        // hline(50, color = color.gray): default dashed, width 1
        hlines: [{ value: 50, options: { title: 'Level', color: gray, linestyle: 'dashed', linewidth: 1 } }],
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FractalStrengthOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<FractalStrengthOscillatorInputs> = {},
): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const FractalStrengthOscillator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
