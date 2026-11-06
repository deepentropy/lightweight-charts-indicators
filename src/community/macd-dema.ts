/**
 * MACD DEMA
 *
 * MACD using Double Exponential Moving Average instead of EMA.
 * DEMA(n) = 2*EMA(n) - EMA(EMA(n), n).
 *
 * Reference: "MACD DEMA" community indicator
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MACDDEMAInputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
  src: SourceType;
}

export const defaultInputs: MACDDEMAInputs = {
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
  { id: 'plot0', title: 'MACD', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 2 },
  { id: 'plot2', title: 'Histogram', color: '#26A69A', lineWidth: 4, style: 'histogram' },
];

export const metadata = {
  title: 'MACD DEMA',
  shortTitle: 'MACDDEMA',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult;

interface MacdDemaRun extends BarRunState<Record<string, never>> {
  emas: ReturnType<typeof taStep.ema>[];
  hist: number[];
  macdData: Point[];
  sigData: Point[];
  histData: Point[];
}

function study(inputs: Partial<MACDDEMAInputs>): BarStudy<MacdDemaRun, Result> {
  const { fastLength, slowLength, signalLength, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const warmup = slowLength * 2;
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const emas = [fastLength, fastLength, slowLength, slowLength, signalLength, signalLength].map((l) => taStep.ema(l));
      const s: MacdDemaRun = { emas, hist: [], macdData: [], sigData: [], histData: [], steps: emas, vars: {}, lists: [], series: [] };
      s.series = [s.hist, s.macdData, s.sigData, s.histData];
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time;
      const [e1, e2, e3, e4, e5, e6] = s.emas;
      const v = value(bars[i]);
      // DEMA(n) = 2*EMA(src, n) - EMA(EMA(src, n), n)
      const emaFast = e1.step(v);
      const demaFast = emaFast * 2 - e2.step(emaFast);
      const emaSlow = e3.step(v);
      const demaSlow = emaSlow * 2 - e4.step(emaSlow);
      const macd = demaFast - demaSlow;
      // Signal is also DEMA: 2*EMA(macd, len) - EMA(EMA(macd, len), len)
      const sigEma1 = e5.step(macd);
      const signal = sigEma1 * 2 - e6.step(sigEma1);
      const h = macd - signal;
      s.hist[i] = h;
      const out = i < warmup;
      s.macdData[i] = { time, value: out ? NaN : macd };
      s.sigData[i] = { time, value: out ? NaN : signal };
      if (out) {
        s.histData[i] = { time, value: NaN };
      } else {
        const prev = i > 0 ? s.hist[i - 1] : NaN;
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
        fills: [
          { plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(33,150,243,0.15)' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MACDDEMAInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MACDDEMAInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const MACDDEMA = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
