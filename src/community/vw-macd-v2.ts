/**
 * Volume Weighted MACD V2
 *
 * MACD using VWMA instead of EMA for fast and slow lines.
 *
 * Reference: "Volume Weighted MACD V2" community indicator
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowVwma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VWMACDV2Inputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
  src: SourceType;
}

export const defaultInputs: VWMACDV2Inputs = {
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 9, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VWMACD', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 2 },
  { id: 'plot2', title: 'Histogram', color: '#26A69A', lineWidth: 4, style: 'histogram' },
];

export const metadata = {
  title: 'Volume Weighted MACD V2',
  shortTitle: 'VWMACDV2',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };

interface VwMacdRun extends BarRunState<Record<string, never>> {
  fast: WindowVwma;
  slow: WindowVwma;
  sig: ReturnType<typeof taStep.ema>;
  hist: number[];
  macdData: Point[];
  sigData: Point[];
  histData: Point[];
}

function study(inputs: Partial<VWMACDV2Inputs>): BarStudy<VwMacdRun, IndicatorResult> {
  const { fastLength, slowLength, signalLength, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const warmup = slowLength;
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const fast = new WindowVwma(fastLength);
      const slow = new WindowVwma(slowLength);
      const sig = taStep.ema(signalLength);
      const s: VwMacdRun = {
        fast, slow, sig, hist: [], macdData: [], sigData: [], histData: [],
        steps: [fast, slow, sig], vars: {}, lists: [], series: [],
      };
      s.series = [s.hist, s.macdData, s.sigData, s.histData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const v = value(b);
      const vol = b.volume ?? 0;
      const macd = s.fast.step(v, vol) - s.slow.step(v, vol);
      const signal = s.sig.step(macd);
      const h = macd - signal;
      s.hist[i] = h;
      s.macdData[i] = { time, value: i < warmup || macd == null ? NaN : macd };
      s.sigData[i] = { time, value: i < warmup || signal == null ? NaN : signal };
      if (i < warmup || h == null) {
        s.histData[i] = { time, value: NaN };
      } else {
        const prev = i > 0 ? (s.hist[i - 1] ?? NaN) : NaN;
        let color: string;
        if (h >= 0) {
          color = h > prev ? '#00E676' : '#26A69A';
        } else {
          color = h < prev ? '#FF5252' : '#EF5350';
        }
        s.histData[i] = { time, value: h, color };
      }
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
export function createRun(inputs: Partial<VWMACDV2Inputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VWMACDV2Inputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const VWMACDV2 = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
