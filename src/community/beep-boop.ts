/**
 * Beep Boop (Original)
 *
 * A MACD histogram (fast MA - slow MA minus its signal MA; EMA or SMA) reduced to its sign: 0.1 when positive, 0.09
 * when negative, 0 otherwise, drawn as columns. A positive column is teal when close, open and low are all above
 * the EMA trend line of close, white otherwise; a negative column is red when close, open and high are all below
 * it, white otherwise.
 *
 * Reference: "Beep Boop (Original)" by OBSIDE
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  taStep, color,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface BeepBoopInputs {
  /** Fast MA length */
  fastLength: number;
  /** Slow MA length */
  slowLength: number;
  /** EMA length of the trend line */
  emaTrend: number;
  /** Source of the MACD */
  src: SourceType;
  /** Signal MA length */
  signalLength: number;
  /** SMA (true) or EMA (false) for the fast and slow MAs */
  smaSource: boolean;
  /** SMA (true) or EMA (false) for the signal line */
  smaSignal: boolean;
}

export const defaultInputs: BeepBoopInputs = {
  fastLength: 12,
  slowLength: 26,
  emaTrend: 50,
  src: 'close',
  signalLength: 9,
  smaSource: false,
  smaSignal: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26 },
  { id: 'emaTrend', type: 'int', title: 'EMA Trend', defval: 50 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'signalLength', type: 'int', title: 'Signal Smoothing', defval: 9, min: 1, max: 50 },
  { id: 'smaSource', type: 'bool', title: 'Simple MA (Oscillator)', defval: false },
  { id: 'smaSignal', type: 'bool', title: 'Simple MA (Signal Line)', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Histogram', color: '#26A69A', lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'Beep Boop (Original)',
  shortTitle: 'Beep Boop (Original)',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color?: string };
type Ma = { step(v: number): number; commit(): void };

interface BeepBoopRun extends BarRunState<Record<string, never>> {
  fast: Ma;
  slow: Ma;
  sig: Ma;
  trend: Ma;
  plot0: Point[];
}

function study(inputs: Partial<BeepBoopInputs>): BarStudy<BeepBoopRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const colGrowAbove = String(color.new('#26A69A', 0));
  const colGrowBelow = String(color.new('#FF0000', 0));
  const colFallAbove = String(color.new('#FFFFFF', 0));
  const colFallBelow = String(color.new('#FFFFFF', 0));
  const ma = (sma: boolean, length: number): Ma => (sma ? new WindowSma(length) : taStep.ema(length));
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      // The ternaries select a constant input: only the selected MA runs, on every bar
      const fast = ma(cfg.smaSource, cfg.fastLength);
      const slow = ma(cfg.smaSource, cfg.slowLength);
      const sig = ma(cfg.smaSignal, cfg.signalLength);
      const trend = taStep.ema(cfg.emaTrend);
      const s: BeepBoopRun = { fast, slow, sig, trend, plot0: [], steps: [fast, slow, sig, trend], vars: {}, lists: [], series: [] };
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = value(b);
      const macd = (s.fast.step(v) ?? NaN) - (s.slow.step(v) ?? NaN);
      const signal = s.sig.step(macd) ?? NaN;
      const t = s.trend.step(b.close) ?? NaN;
      const raw = macd - signal;
      // hist := hist > 0 ? 0.1 : hist < 0 ? 0.09 : 0 (na gives 0)
      const hist = gt(raw, 0) ? 0.1 : lt(raw, 0) ? 0.09 : 0;
      const c = eq(hist, 0.1)
        ? (gt(b.close, t) && gt(b.open, t) && gt(b.low, t) ? colGrowAbove : colFallAbove)
        : eq(hist, 0.09)
          ? (lt(b.close, t) && lt(b.open, t) && lt(b.high, t) ? colGrowBelow : colFallBelow)
          : undefined;
      s.plot0[i] = c !== undefined ? { time: b.time, value: hist, color: c } : { time: b.time, value: hist };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BeepBoopInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BeepBoopInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const BeepBoop = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
