/**
 * Signal Moving Average
 *
 * SMA with signal line (EMA of SMA). SMA colored green when above signal, red when below.
 *
 * Reference: "Signal Moving Average" by LuxAlgo
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SignalMAInputs {
  length: number;
  signalLength: number;
  src: SourceType;
}

export const defaultInputs: SignalMAInputs = {
  length: 20,
  signalLength: 9,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 9, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SMA', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'Signal Moving Average',
  shortTitle: 'SigMA',
  overlay: true,
};

type Point = { time: any; value: number; color?: string };

interface SignalMARun extends BarRunState<Record<string, never>> {
  sma: WindowSma;
  ema: ReturnType<typeof taStep.ema>;
  plot0: Point[];
  plot1: Point[];
  fillColors: string[];
}

function study(inputs: Partial<SignalMAInputs>): BarStudy<SignalMARun, IndicatorResult> {
  const { length, signalLength, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const warmup = length + signalLength;
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const sma = new WindowSma(length);
      // Signal: EMA of the SMA
      const ema = taStep.ema(signalLength);
      const s: SignalMARun = { sma, ema, plot0: [], plot1: [], fillColors: [], steps: [sma, ema], vars: {}, lists: [], series: [] };
      s.series = [s.plot0, s.plot1, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time;
      const v = s.sma.step(value(bars[i]));
      const sig = s.ema.step(v ?? 0);
      if (i < warmup) {
        s.plot0[i] = { time, value: NaN };
        s.plot1[i] = { time, value: NaN };
        s.fillColors[i] = 'rgba(0,0,0,0)';
        return;
      }
      const smaVal = v ?? 0;
      const sigVal = sig ?? 0;
      s.plot0[i] = { time, value: smaVal, color: smaVal > sigVal ? '#26A69A' : '#EF5350' };
      s.plot1[i] = { time, value: sig ?? NaN };
      // Dynamic fill color: green when SMA > Signal, red when SMA < Signal
      s.fillColors[i] = smaVal > sigVal ? 'rgba(12,181,26,0.15)' : 'rgba(255,17,0,0.15)';
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice() },
        fills: [
          { plot1: 'plot0', plot2: 'plot1', colors: s.fillColors.slice() },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SignalMAInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SignalMAInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const SignalMA = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
