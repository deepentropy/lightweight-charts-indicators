/**
 * Multi-Oscillator Adaptive Kernel
 *
 * The mean of the selected oscillators, each scaled to about -100..100: (RSI - 50) x 2, (SMA(3) of the stochastic
 * - 50) x 2, (MFI of hlc3 - 50) x 2 and CCI / 4. A kernel smoother (weights exp(-5 i / L), 1 - i / L or
 * exp(-0.5 (3 i / L)^2) for the last L values) gives the signal line; the same kernel over 2 L smooths the signal.
 * The smoothed signal is drawn as ten layers (100 % to 10 % of its value) with fills of growing transparency down to
 * zero, cyan above zero, magenta below. The bars take the colour of the smoothed signal side.
 *
 * Reference: "Multi-Oscillator Adaptive Kernel | Opus" by AlphaNatt
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MultiOscillatorAdaptiveKernelInputs {
  src: SourceType;
  useRsi: boolean;
  useStoch: boolean;
  useMfi: boolean;
  useCci: boolean;
  lenRsi: number;
  lenStoch: number;
  lenMfi: number;
  lenCci: number;
  kernelType: 'Exponential' | 'Linear' | 'Gaussian';
  kernelLen: number;
  /** Not used in the calculation (as in the Pine script) */
  sensitivity: number;
  barColoring: boolean;
}

export const defaultInputs: MultiOscillatorAdaptiveKernelInputs = {
  src: 'close',
  useRsi: true,
  useStoch: true,
  useMfi: true,
  useCci: false,
  lenRsi: 14,
  lenStoch: 14,
  lenMfi: 14,
  lenCci: 20,
  kernelType: 'Exponential',
  kernelLen: 25,
  sensitivity: 1.5,
  barColoring: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'useRsi', type: 'bool', title: 'RSI', defval: true },
  { id: 'useStoch', type: 'bool', title: 'Stochastic', defval: true },
  { id: 'useMfi', type: 'bool', title: 'MFI', defval: true },
  { id: 'useCci', type: 'bool', title: 'CCI', defval: false },
  { id: 'lenRsi', type: 'int', title: 'RSI Length', defval: 14 },
  { id: 'lenStoch', type: 'int', title: 'Stochastic Length', defval: 14 },
  { id: 'lenMfi', type: 'int', title: 'MFI Length', defval: 14 },
  { id: 'lenCci', type: 'int', title: 'CCI Length', defval: 20 },
  { id: 'kernelType', type: 'string', title: 'Kernel Type', defval: 'Exponential', options: ['Exponential', 'Linear', 'Gaussian'] },
  { id: 'kernelLen', type: 'int', title: 'Kernel Length', defval: 25 },
  { id: 'sensitivity', type: 'float', title: 'Sensitivity', defval: 1.5, min: 0.1, max: 5.0, step: 0.1 },
  { id: 'barColoring', type: 'bool', title: 'Color Bars', defval: true },
];

const BULL = '#00F1FF';
const BEAR = '#FF019A';
/** Transparency of layer k (1..10): 0, 10, ..., 90 */
const layerColor = (base: string, k: number) => (k === 1 ? base : String(color.new(base, (k - 1) * 10)));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Zero Line', color: String(color.new(color.gray, 50)), lineWidth: 1 },
  { id: 'plot1', title: 'Signal Line', color: String(color.new(BULL, 70)), lineWidth: 1 },
  ...Array.from({ length: 10 }, (_v, j) => ({
    id: `plot${2 + j}`, title: `P${j + 1}`, color: layerColor(BULL, j + 1), lineWidth: j === 0 ? 2 : 1,
  })),
  ...Array.from({ length: 10 }, (_v, j) => ({
    id: `plot${12 + j}`, title: `N${j + 1}`, color: layerColor(BEAR, j + 1), lineWidth: j === 0 ? 2 : 1,
  })),
];

export const metadata = {
  title: 'Multi-Oscillator Adaptive Kernel | Opus',
  shortTitle: 'Multi-Oscillator Adaptive Kernel | Opus',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** kernel_weight(i, len, type) */
function kernelWeight(i: number, len: number, type: string): number {
  if (type === 'Exponential') return Math.exp((-5.0 * i) / len);
  if (type === 'Linear') return 1.0 - i / len;
  if (type === 'Gaussian') return Math.exp(-0.5 * Math.pow((3.0 * i) / len, 2));
  return 0.0;
}

type Result = IndicatorResult & { barColors: BarColorData[] };
type Point = { time: number; value: number; color?: string };

/** The weights of kernel_weight(i, len, type) for i = 0 .. len - 1 and their running sums (the order of the loop) */
function kernel(len: number, type: string): { w: number[]; sums: number[] } {
  const w: number[] = [];
  const sums: number[] = [];
  let weightSum = 0.0;
  for (let i = 0; i <= len - 1; i++) {
    w.push(kernelWeight(i, len, type));
    weightSum += w[i];
    sums.push(weightSum);
  }
  return { w, sums };
}

/** smooth_value(src, len, type) on bar b: kernel-weighted mean of src[0 .. min(len - 1, bar_index)] (na with an na value) */
function smoothAt(src: number[], b: number, k: { w: number[]; sums: number[] }): number {
  const last = Math.min(k.w.length - 1, b);
  let sum = 0.0;
  for (let i = 0; i <= last; i++) sum += src[b - i] * k.w[i];
  const weightSum = last >= 0 ? k.sums[last] : 0.0;
  // The weight of i = 0 is 1: weightSum >= 1, the 0 test is never true
  return weightSum === 0 ? NaN : sum / weightSum;
}

interface MoakRun extends BarRunState<Record<string, never>> {
  rsi: ReturnType<typeof taStep.rsi> | null;
  stoch: ReturnType<typeof taStep.stoch> | null;
  stochSma: ReturnType<typeof taStep.sma> | null;
  mfi: ReturnType<typeof taStep.mfi> | null;
  cci: ReturnType<typeof taStep.cci> | null;
  rawValue: number[];
  signal: number[];
  signal2: number[];
  /** plot0 .. plot21 */
  plots: Point[][];
  barColors: BarColorData[];
}

function study(inputs: Partial<MultiOscillatorAdaptiveKernelInputs>): BarStudy<MoakRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const activeCount = [cfg.useRsi, cfg.useStoch, cfg.useMfi, cfg.useCci].filter(Boolean).length;
  // kernelWeight(i, kernelLen) / kernelWeight(i, kernelLen * 2) are the same on every bar: computed once
  const k1 = kernel(cfg.kernelLen, cfg.kernelType);
  const k2 = kernel(cfg.kernelLen * 2, cfg.kernelType);
  const zeroCol = String(color.new(color.gray, 50));
  const sigUp = String(color.new(BULL, 70));
  const sigDown = String(color.new(BEAR, 70));
  const pcs = Array.from({ length: 10 }, (_, j) => layerColor(BULL, j + 1));
  const ncs = Array.from({ length: 10 }, (_, j) => layerColor(BEAR, j + 1));
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: MoakRun = {
        rsi: cfg.useRsi ? taStep.rsi(cfg.lenRsi) : null,
        stoch: cfg.useStoch ? taStep.stoch(cfg.lenStoch) : null,
        stochSma: cfg.useStoch ? taStep.sma() : null,
        mfi: cfg.useMfi ? taStep.mfi(cfg.lenMfi) : null,
        cci: cfg.useCci ? taStep.cci(cfg.lenCci) : null,
        rawValue: [], signal: [], signal2: [], plots: Array.from({ length: 22 }, () => []), barColors: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.rsi, s.stoch, s.stochSma, s.mfi, s.cci].filter((m): m is NonNullable<typeof m> => m !== null);
      s.series = [s.rawValue, s.signal, s.signal2, ...s.plots, s.barColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const src = value(b);
      // var rsi_val / stoch_val / mfi_val / cci_val = 0.0: an oscillator that is off stays 0
      const rsiVal = s.rsi ? (s.rsi.step(src) - 50) * 2 : 0;
      const stochVal = s.stoch ? (s.stochSma!.step(s.stoch.step(src, b.high, b.low), 3) - 50) * 2 : 0;
      const mfiVal = s.mfi ? (s.mfi.step((b.high + b.low + b.close) / 3, b.volume ?? NaN) - 50) * 2 : 0;
      const cciVal = s.cci ? s.cci.step(src) / 4 : 0;
      s.rawValue[i] = (rsiVal + stochVal + mfiVal + cciVal) / Math.max(activeCount, 1);

      const signal = smoothAt(s.rawValue, i, k1);
      s.signal[i] = signal;
      const signal2 = smoothAt(s.signal, i, k2);
      s.signal2[i] = signal2;

      const p = s.plots;
      p[0][i] = { time: t, value: 0, color: zeroCol };
      p[1][i] = { time: t, value: signal, color: gt(signal, 0) ? sigUp : sigDown };
      const pos = gt(signal2, 0);
      const neg = lt(signal2, 0);
      for (let j = 0; j < 10; j++) {
        const k = (10 - j) / 10; // 1, 0.9, ..., 0.1
        // plot(signal2 > 0 ? signal2 * k : 0) / plot(signal2 < 0 ? signal2 * k : 0)
        p[2 + j][i] = { time: t, value: pos ? (j === 0 ? signal2 : signal2 * k) : 0, color: pcs[j] };
        p[12 + j][i] = { time: t, value: neg ? (j === 0 ? signal2 : signal2 * k) : 0, color: ncs[j] };
      }
      // barcolor(bar_coloring ? (signal2 > 0 ? bull_color : bear_color) : na)
      if (cfg.barColoring) s.barColors[i] = { time: t, color: pos ? BULL : BEAR };
    },
    result(s) {
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      // fill(layer k, layer k + 1 (layer 10: zero line), signal2 > 0 ? color.new(bull_color, 5 + 10 (k - 1)) : na)
      const fills: { plot1: string; plot2: string; colors: string[] }[] = [];
      for (const [first, base, on] of [[2, BULL, gt], [12, BEAR, lt]] as const) {
        for (let j = 0; j < 10; j++) {
          const c = String(color.new(base, 5 + 10 * j));
          fills.push({
            plot1: `plot${first + j}`, plot2: j === 9 ? 'plot0' : `plot${first + j + 1}`,
            colors: s.signal2.map((v) => (on(v, 0) ? c : 'transparent')),
          });
        }
      }
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills,
        barColors: cfg.barColoring ? s.barColors.slice() : [],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MultiOscillatorAdaptiveKernelInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MultiOscillatorAdaptiveKernelInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const MultiOscillatorAdaptiveKernel = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
