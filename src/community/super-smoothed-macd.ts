/**
 * Super Smoothed MACD for Crypto
 *
 * MACD with extra smoothing via additional EMA pass.
 *
 * Reference: "Super Smoothed MACD for Crypto" community indicator
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SuperSmoothedMACDInputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
  smoothLength: number;
  src: SourceType;
}

export const defaultInputs: SuperSmoothedMACDInputs = {
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  smoothLength: 5,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 9, min: 1 },
  { id: 'smoothLength', type: 'int', title: 'Smooth Length', defval: 5, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Smoothed MACD', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 2 },
  { id: 'plot2', title: 'Histogram', color: '#26A69A', lineWidth: 4, style: 'histogram' },
];

export const metadata = {
  title: 'Super Smoothed MACD',
  shortTitle: 'SSMACD',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };
type Ema = ReturnType<typeof taStep.ema>;

interface SsmRun extends BarRunState<Record<string, never>> {
  fast: Ema;
  slow: Ema;
  smooth: Ema;
  signal: Ema;
  hist: number[];
  macdData: Point[];
  sigData: Point[];
  histData: Point[];
}

function study(inputs: Partial<SuperSmoothedMACDInputs>): BarStudy<SsmRun, IndicatorResult> {
  const { fastLength, slowLength, signalLength, smoothLength, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const warmup = slowLength + smoothLength;
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const fast = taStep.ema(fastLength);
      const slow = taStep.ema(slowLength);
      // Extra smoothing pass
      const smooth = taStep.ema(smoothLength);
      const signal = taStep.ema(signalLength);
      const s: SsmRun = {
        fast, slow, smooth, signal, hist: [], macdData: [], sigData: [], histData: [],
        steps: [fast, slow, smooth, signal], vars: {}, lists: [], series: [],
      };
      s.series = [s.hist, s.macdData, s.sigData, s.histData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const time = b.time as number;
      const v0 = value(b);
      const rawMacd = s.fast.step(v0) - s.slow.step(v0);
      const smoothedMacd = s.smooth.step(rawMacd);
      const signalLine = s.signal.step(smoothedMacd);
      const v = smoothedMacd - signalLine;
      s.hist[i] = v;
      s.macdData[i] = { time, value: i < warmup ? NaN : smoothedMacd };
      s.sigData[i] = { time, value: i < warmup ? NaN : signalLine };
      if (i < warmup) {
        s.histData[i] = { time, value: NaN };
        return;
      }
      const prev = i > 0 ? s.hist[i - 1]! : NaN;
      let color: string;
      if (v >= 0) {
        color = v > prev ? '#00E676' : '#26A69A';
      } else {
        color = v < prev ? '#FF5252' : '#EF5350';
      }
      s.histData[i] = { time, value: v, color };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.macdData.slice(), 'plot1': s.sigData.slice(), 'plot2': s.histData.slice() },
        hlines: [{ value: 0, options: { color: '#787B86', linestyle: 'dashed', title: 'Zero' } }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SuperSmoothedMACDInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SuperSmoothedMACDInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const SuperSmoothedMACD = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
