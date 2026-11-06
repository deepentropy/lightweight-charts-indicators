/**
 * MACDAS (MACD Average Signal)
 *
 * Computes MACD-AS = MACD - Signal, then its own EMA (signalAS).
 * This is a "second derivative" of MACD, showing momentum of the MACD histogram.
 * Plots macdAS (blue) and signalAS (red) plus zero line.
 *
 * Reference: "MACDAS"
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MACDASInputs {
  fastperiod: number;
  slowperiod: number;
  signalperiod: number;
  src: SourceType;
}

export const defaultInputs: MACDASInputs = {
  fastperiod: 12,
  slowperiod: 26,
  signalperiod: 9,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastperiod', type: 'int', title: 'Fast Period', defval: 12, min: 1, max: 500 },
  { id: 'slowperiod', type: 'int', title: 'Slow Period', defval: 26, min: 1, max: 500 },
  { id: 'signalperiod', type: 'int', title: 'Signal Period', defval: 9, min: 1, max: 500 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MACD-AS', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Signal-AS', color: '#EF5350', lineWidth: 2 },
];

export const metadata = {
  title: 'MACDAS',
  shortTitle: 'MACDAS',
  overlay: false,
};

type Point = { time: number; value: number };

interface MacdasRun extends BarRunState<Record<string, never>> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  sig: ReturnType<typeof taStep.ema>;
  sigAS: ReturnType<typeof taStep.ema>;
  plot0: Point[];
  plot1: Point[];
}

function study(inputs: Partial<MACDASInputs>): BarStudy<MacdasRun, IndicatorResult> {
  const { fastperiod, slowperiod, signalperiod, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const warmup = slowperiod + signalperiod;
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const fast = taStep.ema(fastperiod);
      const slow = taStep.ema(slowperiod);
      const sig = taStep.ema(signalperiod);
      const sigAS = taStep.ema(signalperiod);
      const s: MacdasRun = {
        fast, slow, sig, sigAS, plot0: [], plot1: [], steps: [fast, slow, sig, sigAS], vars: {}, lists: [], series: [],
      };
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const v = value(bars[i]);
      // Pine: macd = ema(close, fast) - ema(close, slow)
      const macd = s.fast.step(v) - s.slow.step(v);
      // Pine: signal = ema(macd, signalperiod)
      const signal = s.sig.step(macd);
      // Pine: macdAS = macd - signal
      const macdAS = macd - signal;
      // Pine: signalAS = ema(macdAS, signalperiod)
      const signalAS = s.sigAS.step(macdAS);
      const time = bars[i].time;
      s.plot0[i] = { time, value: (i < warmup || macdAS == null) ? NaN : macdAS };
      s.plot1[i] = { time, value: (i < warmup || signalAS == null) ? NaN : signalAS };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice() },
        hlines: [{ value: 0, options: { color: '#000000', linestyle: 'solid', title: 'Zero' } }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MACDASInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MACDASInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const MACDAS = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
