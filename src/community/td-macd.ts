/**
 * TDMacd
 *
 * Standard MACD (EMA fast - EMA slow) with SMA signal.
 * Histogram is the MACD line itself, colored by direction (2-color).
 * MACD line plotted in black.
 * Signal line colored by direction (2-color: red/green).
 *
 * Pine source:
 *   fastMA = ema(source, fastLength)
 *   slowMA = ema(source, slowLength)
 *   macd = fastMA - slowMA
 *   signal = sma(macd, signalLength)
 *   plot(macd, color = change(macd) <= 0 ? red : lime, style=histogram)
 *   plot(macd, color=black, style=line)
 *   plot(signal, color=change(signal) <= 0 ? red : green, style=line)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TDMacdInputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
}

export const defaultInputs: TDMacdInputs = {
  fastLength: 5,
  slowLength: 20,
  signalLength: 30,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 5, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 20, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 30, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MACD Histogram', color: '#00E676', lineWidth: 4, style: 'histogram' },
  { id: 'plot1', title: 'MACD', color: '#000000', lineWidth: 2 },
  { id: 'plot2', title: 'Signal', color: '#4CAF50', lineWidth: 2 },
];

export const metadata = {
  title: 'TDMacd',
  shortTitle: 'MACD',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };

interface TdMacdRun extends BarRunState<Record<string, never>> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  sig: WindowSma;
  macdArr: number[];
  sigArr: number[];
  histPlot: Point[];
  macdLinePlot: Point[];
  signalPlot: Point[];
}

function study(inputs: Partial<TDMacdInputs>): BarStudy<TdMacdRun, IndicatorResult> {
  const { fastLength, slowLength, signalLength } = { ...defaultInputs, ...inputs };
  const warmup = Math.max(fastLength, slowLength);
  const sigWarmup = warmup + signalLength - 1;
  return {
    init() {
      const fast = taStep.ema(fastLength);
      const slow = taStep.ema(slowLength);
      const sig = new WindowSma(signalLength);
      const s: TdMacdRun = {
        fast, slow, sig, macdArr: [], sigArr: [], histPlot: [], macdLinePlot: [], signalPlot: [],
        steps: [fast, slow, sig], vars: {}, lists: [], series: [],
      };
      s.series = [s.macdArr, s.sigArr, s.histPlot, s.macdLinePlot, s.signalPlot];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const close = b.close;
      const v = s.fast.step(close) - s.slow.step(close);
      const sv = s.sig.step(v);
      s.macdArr[i] = v;
      s.sigArr[i] = sv;

      // Plot 0: MACD as histogram, 2-color based on change(macd)
      // lime (#00E676) when rising, red (#FF1744) when falling or flat
      if (i < warmup || v == null) {
        s.histPlot[i] = { time, value: NaN };
      } else {
        const prev = (i > 0 && i - 1 >= warmup && s.macdArr[i - 1] != null) ? s.macdArr[i - 1] : v;
        const change = v - prev;
        s.histPlot[i] = { time, value: v, color: change <= 0 ? '#FF1744' : '#00E676' };
      }

      // Plot 1: MACD as line, black
      s.macdLinePlot[i] = { time, value: (i < warmup || v == null) ? NaN : v };

      // Plot 2: Signal as line, 2-color based on change(signal)
      // green (#4CAF50) when rising, red (#FF1744) when falling or flat
      if (i < sigWarmup || sv == null) {
        s.signalPlot[i] = { time, value: NaN };
      } else {
        const prev = (i > 0 && i - 1 >= sigWarmup && s.sigArr[i - 1] != null) ? s.sigArr[i - 1] : sv;
        const change = sv - prev;
        s.signalPlot[i] = { time, value: sv, color: change <= 0 ? '#FF1744' : '#4CAF50' };
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.histPlot.slice(), 'plot1': s.macdLinePlot.slice(), 'plot2': s.signalPlot.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TDMacdInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TDMacdInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const TDMacd = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
