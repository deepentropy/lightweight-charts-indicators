/**
 * MACD Leader [LazyBear] / Siligardos
 *
 * Enhanced MACD with a "Leader" line that reacts faster to price changes.
 * Leader = (EMA(fast) + EMA(src - EMA(fast), fast)) - (EMA(slow) + EMA(src - EMA(slow), slow))
 *
 * Reference: "MACD Leader" by LazyBear
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MACDLeaderInputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
  src: SourceType;
}

export const defaultInputs: MACDLeaderInputs = {
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
  { id: 'plot0', title: 'MACD', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot2', title: 'Leader', color: '#26A69A', lineWidth: 2 },
  { id: 'plot3', title: 'Histogram', color: '#26A69A', lineWidth: 4, style: 'histogram' },
];

export const metadata = {
  title: 'MACD Leader',
  shortTitle: 'MACDLeader',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };
type Ema = ReturnType<typeof taStep.ema>;

interface LeaderRun extends BarRunState<Record<string, never>> {
  emaFast: Ema;
  emaSlow: Ema;
  emaSrcMinusFast: Ema;
  emaSrcMinusSlow: Ema;
  emaSignal: Ema;
  macd: number[];
  signal: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
}

function study(inputs: Partial<MACDLeaderInputs>): BarStudy<LeaderRun, IndicatorResult> {
  const { fastLength, slowLength, signalLength, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const warmup = slowLength;
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const emaFast = taStep.ema(fastLength);
      const emaSlow = taStep.ema(slowLength);
      const emaSrcMinusFast = taStep.ema(fastLength);
      const emaSrcMinusSlow = taStep.ema(slowLength);
      const emaSignal = taStep.ema(signalLength);
      const s: LeaderRun = {
        emaFast, emaSlow, emaSrcMinusFast, emaSrcMinusSlow, emaSignal, macd: [], signal: [],
        plot0: [], plot1: [], plot2: [], plot3: [],
        steps: [emaFast, emaSlow, emaSrcMinusFast, emaSrcMinusSlow, emaSignal], vars: {}, lists: [], series: [],
      };
      s.series = [s.macd, s.signal, s.plot0, s.plot1, s.plot2, s.plot3];
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time;
      const v = value(bars[i]) ?? 0;
      const ef = s.emaFast.step(v);
      const es = s.emaSlow.step(v);
      // src - emaFast series, then EMA it
      const emaSrcMinusFast = s.emaSrcMinusFast.step(v - (ef ?? 0));
      const emaSrcMinusSlow = s.emaSrcMinusSlow.step(v - (es ?? 0));
      const macd = ef - es;
      const i1 = ef + (emaSrcMinusFast ?? 0);
      const i2 = es + (emaSrcMinusSlow ?? 0);
      const leader = i1 - i2;
      const sig = s.emaSignal.step(macd);
      s.macd[i] = macd;
      s.signal[i] = sig;

      s.plot0[i] = { time, value: i < warmup ? NaN : macd };
      s.plot1[i] = { time, value: (i < warmup || sig == null) ? NaN : sig };
      s.plot2[i] = { time, value: i < warmup ? NaN : leader };

      if (i < warmup || isNaN(sig)) {
        s.plot3[i] = { time, value: NaN };
      } else {
        const hist = macd - sig;
        const prevMacd = i > 0 ? s.macd[i - 1] : NaN;
        const prevSig = i > 0 ? s.signal[i - 1] : NaN;
        const prevHist = isNaN(prevMacd) || isNaN(prevSig) ? NaN : prevMacd - prevSig;
        let color: string;
        if (hist >= 0) {
          color = (!isNaN(prevHist) && hist >= prevHist) ? '#26A69A' : '#B2DFDB';
        } else {
          color = (!isNaN(prevHist) && hist < prevHist) ? '#EF5350' : '#FFCDD2';
        }
        s.plot3[i] = { time, value: hist, color };
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'plot2': s.plot2.slice(), 'plot3': s.plot3.slice() },
        hlines: [
          { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MACDLeaderInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MACDLeaderInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const MACDLeader = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
