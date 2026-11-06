/**
 * Price Oscillator (Percentage Price Oscillator, PPO)
 *
 * Difference between a fast and a slow moving average of the source, as a percentage of the slow one:
 * ppo = 100 * (fastMA - slowMA) / slowMA. A signal line (MA of the PPO) and a histogram (ppo - signal) complete it.
 * The histogram is teal above 0 and red below 0, bright when it rises versus the previous bar and pale otherwise.
 * The moving averages are EMA or SMA (oscillator and signal types chosen separately).
 *
 * Based on the standard "Percentage Price Oscillator" indicator.
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type PriceOscillatorMaType = 'EMA' | 'SMA';

export interface PriceOscillatorInputs {
  /** Price source */
  src: SourceType;
  /** Fast MA length */
  shortLength: number;
  /** Slow MA length */
  longLength: number;
  /** Signal MA length */
  signalLength: number;
  /** MA type of the fast and slow averages */
  oscMaType: PriceOscillatorMaType;
  /** MA type of the signal line */
  signalMaType: PriceOscillatorMaType;
}

export const defaultInputs: PriceOscillatorInputs = {
  src: 'close',
  shortLength: 12,
  longLength: 26,
  signalLength: 9,
  oscMaType: 'EMA',
  signalMaType: 'EMA',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'shortLength', type: 'int', title: 'Fast length', defval: 12, min: 1 },
  { id: 'longLength', type: 'int', title: 'Slow length', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal length', defval: 9, min: 1 },
  { id: 'oscMaType', type: 'string', title: 'Oscillator MA type', defval: 'EMA', options: ['EMA', 'SMA'], display: 'none' },
  { id: 'signalMaType', type: 'string', title: 'Signal MA type', defval: 'EMA', options: ['EMA', 'SMA'], display: 'none' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Histogram', color: '#2962FF', lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'PPO', color: '#2962FF', lineWidth: 1 },
  { id: 'plot2', title: 'Signal line', color: '#FF6D00', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, color: '#787B8680', linestyle: 'dashed', title: 'Zero' },
];

export const metadata = {
  title: 'Percentage Price Oscillator',
  shortTitle: 'PPO',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Ma = { step(v: number): number; commit(): void };

/** One moving average (SMA or EMA) stepped bar by bar */
const maStep = (length: number, maType: PriceOscillatorMaType): Ma =>
  maType === 'SMA' ? new WindowSma(length) : taStep.ema(length);

type Point = { time: number; value: number; color?: string };

interface PpoRun extends BarRunState<Record<string, never>> {
  fast: Ma;
  slow: Ma;
  sig: Ma;
  hist: number[];
  histData: Point[];
  ppoData: Point[];
  signalData: Point[];
}

function study(inputs: Partial<PriceOscillatorInputs>): BarStudy<PpoRun, IndicatorResult> {
  const { src, shortLength, longLength, signalLength, oscMaType, signalMaType } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const val = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const fast = maStep(shortLength, oscMaType);
      const slow = maStep(longLength, oscMaType);
      const sig = maStep(signalLength, signalMaType);
      const s: PpoRun = {
        fast, slow, sig, hist: [], histData: [], ppoData: [], signalData: [],
        steps: [fast, slow, sig], vars: {}, lists: [], series: [],
      };
      s.series = [s.hist, s.histData, s.ppoData, s.signalData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = value(b);
      const f = s.fast.step(v);
      const sl = s.slow.step(v);
      // A plain division: x / 0 is +-infinity (0 / 0 NaN); the plots show na for infinity
      const ppo = (100.0 * (f - sl)) / sl;
      const signal = s.sig.step(ppo);
      const h = ppo - signal;
      s.hist[i] = h;
      const prev = i > 0 ? s.hist[i - 1] : NaN;
      const color = ge(h, 0) ? (gt(h, prev) ? '#26A69A' : '#B2DFDB') : gt(h, prev) ? '#FFCDD2' : '#FF5252';
      s.histData[i] = { time: b.time, value: val(h), color };
      s.ppoData[i] = { time: b.time, value: val(ppo) };
      s.signalData[i] = { time: b.time, value: val(signal) };
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.histData.slice(),
          'plot1': s.ppoData.slice(),
          'plot2': s.signalData.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PriceOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PriceOscillatorInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const PriceOscillator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
