/**
 * MACD Crossover
 *
 * Standard MACD with cross detection between MACD and signal lines.
 *
 * Reference: "MACD Crossover" community indicator
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MACDCrossoverInputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
  src: SourceType;
}

export const defaultInputs: MACDCrossoverInputs = {
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
  title: 'MACD Crossover',
  shortTitle: 'MACDCross',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] };

interface MacdCrossVars {
  /** pos: 1 when MACD > signal, -1 when MACD < signal (kept otherwise) */
  pos: number;
}

interface MacdCrossRun extends BarRunState<MacdCrossVars> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  sig: WindowSma;
  macdData: Point[];
  sigData: Point[];
  histData: Point[];
  barColors: BarColorData[];
}

function study(inputs: Partial<MACDCrossoverInputs>): BarStudy<MacdCrossRun, Result> {
  const { fastLength, slowLength, signalLength, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const warmup = slowLength;
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const fast = taStep.ema(fastLength);
      const slow = taStep.ema(slowLength);
      const sig = new WindowSma(signalLength);
      const s: MacdCrossRun = {
        fast, slow, sig, macdData: [], sigData: [], histData: [], barColors: [],
        steps: [fast, slow, sig], vars: { pos: 0 }, lists: [], series: [],
      };
      s.lists = [s.barColors];
      s.series = [s.macdData, s.sigData, s.histData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = value(b);
      const macd = s.fast.step(v) - s.slow.step(v);
      const sig = s.sig.step(macd);
      const hist = macd - sig;
      const time = b.time;
      s.macdData[i] = { time, value: i < warmup ? NaN : macd };
      s.sigData[i] = { time, value: i < warmup ? NaN : sig };
      s.histData[i] = i < warmup ? { time, value: NaN } : { time, value: hist, color: hist >= 0 ? '#26A69A' : '#EF5350' };

      // barcolor: green when MACD > signal (pos=1), red when MACD < signal (pos=-1), blue otherwise
      if (i < warmup || isNaN(sig) || isNaN(macd)) return;
      const vars = s.vars;
      if (sig < macd) vars.pos = 1;
      else if (sig > macd) vars.pos = -1;
      if (vars.pos === 1) s.barColors.push({ time, color: '#26A69A' });
      else if (vars.pos === -1) s.barColors.push({ time, color: '#EF5350' });
      else s.barColors.push({ time, color: '#2196F3' });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.macdData.slice(), 'plot1': s.sigData.slice(), 'plot2': s.histData.slice() },
        hlines: [{ value: 0, options: { color: '#787B86', linestyle: 'dashed', title: 'Zero' } }],
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MACDCrossoverInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MACDCrossoverInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const MACDCrossover = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
