/**
 * MACD VXI
 *
 * MACD with Volatility Index. VXI = stdev of histogram over signal period.
 *
 * Reference: "MACD VXI" community indicator
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MACDVXIInputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
  src: SourceType;
}

export const defaultInputs: MACDVXIInputs = {
  fastLength: 13,
  slowLength: 21,
  signalLength: 8,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 13, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 21, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 8, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Histogram', color: '#000000', lineWidth: 1, style: 'histogram' },
  { id: 'plot1', title: 'MACD', color: '#FF0000', lineWidth: 1 },
  { id: 'plot2', title: 'Signal', color: '#0000FF', lineWidth: 2 },
  { id: 'plot3', title: 'Cross', color: '#000000', lineWidth: 4, style: 'circles' },
];

export const metadata = {
  title: 'MACD VXI',
  shortTitle: 'MACDVXI',
  overlay: false,
};

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { bgColors: BgColorData[] };

interface VxiRun extends BarRunState<Record<string, never>> {
  fastEMA: ReturnType<typeof taStep.ema>;
  slowEMA: ReturnType<typeof taStep.ema>;
  signalSma: WindowSma;
  macd: number[];
  sig: number[];
  histPlot: Point[];
  macdPlot: Point[];
  signalPlot: Point[];
  crossPlot: Point[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<MACDVXIInputs>): BarStudy<VxiRun, Result> {
  const { fastLength, slowLength, signalLength, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const warmup = slowLength;
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const fastEMA = taStep.ema(fastLength);
      const slowEMA = taStep.ema(slowLength);
      const signalSma = new WindowSma(signalLength); // Pine uses sma for signal
      const s: VxiRun = {
        fastEMA, slowEMA, signalSma, macd: [], sig: [], histPlot: [], macdPlot: [], signalPlot: [], crossPlot: [], bgColors: [],
        steps: [fastEMA, slowEMA, signalSma], vars: {}, lists: [], series: [],
      };
      s.lists = [s.bgColors];
      s.series = [s.macd, s.sig, s.histPlot, s.macdPlot, s.signalPlot, s.crossPlot];
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time;
      const v = value(bars[i]);
      const macd = s.fastEMA.step(v) - s.slowEMA.step(v);
      const sig = s.signalSma.step(macd);
      const hist = macd - sig;
      s.macd[i] = macd;
      s.sig[i] = sig;

      // plot0: histogram (black, style=histogram per Pine)
      s.histPlot[i] = { time, value: i < warmup ? NaN : hist };
      // plot1: MACD line (red per Pine)
      s.macdPlot[i] = { time, value: i < warmup ? NaN : macd };
      // plot2: Signal line (blue per Pine)
      s.signalPlot[i] = { time, value: i < warmup ? NaN : sig };

      // plot3: Cross detection circles - plot signal value when cross(signal, macd)
      if (i < warmup + 1) {
        s.crossPlot[i] = { time, value: NaN };
      } else {
        const sPrev = s.sig[i - 1];
        const mPrev = s.macd[i - 1];
        // cross(signal, macd): signal crosses above or below macd
        const crossUp = sPrev <= mPrev && sig > macd;
        const crossDn = sPrev >= mPrev && sig < macd;
        s.crossPlot[i] = { time, value: (crossUp || crossDn) ? sig : NaN };
      }

      // Background color: Pine bgcolor(OutputSignal>0?#000000:#128E89, transp=80)
      if (i >= warmup && !isNaN(macd) && !isNaN(sig)) {
        const color = sig >= macd
          ? 'rgba(0,0,0,0.1)'        // bearish: black at low alpha
          : 'rgba(18,142,137,0.1)';  // bullish: teal
        s.bgColors.push({ time, color });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.histPlot.slice(), 'plot1': s.macdPlot.slice(), 'plot2': s.signalPlot.slice(), 'plot3': s.crossPlot.slice() },
        hlines: [{ value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } }],
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MACDVXIInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MACDVXIInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const MACDVXI = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
