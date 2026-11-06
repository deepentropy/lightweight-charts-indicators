/**
 * Envelope Indicator
 *
 * Price envelope with a moving average basis and upper/lower bands
 * at a fixed percentage distance from the basis.
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type FillData, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface EnvelopeInputs {
  /** Period length */
  length: number;
  /** Percent distance for bands */
  percent: number;
  /** Price source */
  src: SourceType;
  /** Use exponential MA */
  exponential: boolean;
}

export const defaultInputs: EnvelopeInputs = {
  length: 20,
  percent: 10,
  src: 'close',
  exponential: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
  { id: 'percent', type: 'float', title: 'Percent', defval: 10 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'exponential', type: 'bool', title: 'Exponential', defval: false, display: 'none' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Basis', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot1', title: 'Upper', color: '#2962FF', lineWidth: 1 },
  { id: 'plot2', title: 'Lower', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Envelope',
  shortTitle: 'Env',
  overlay: true,
};

type Point = { time: number; value: number };

interface EnvelopeRun extends BarRunState<Record<string, never>> {
  basis: { step(v: number): number; commit(): void };
  basisData: Point[];
  upperData: Point[];
  lowerData: Point[];
}

function study(inputs: Partial<EnvelopeInputs>): BarStudy<EnvelopeRun, IndicatorResult> {
  const { length, percent, src, exponential } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const k = percent / 100;
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const basis = exponential ? taStep.ema(length) : new WindowSma(length);
      const s: EnvelopeRun = { basis, basisData: [], upperData: [], lowerData: [], steps: [basis], vars: {}, lists: [], series: [] };
      s.series = [s.basisData, s.upperData, s.lowerData];
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time;
      const basis = s.basis.step(value(bars[i]));
      s.basisData[i] = { time, value: basis };
      s.upperData[i] = { time, value: basis * (1 + k) };
      s.lowerData[i] = { time, value: basis * (1 - k) };
    },
    result(s) {
      const fills: FillData[] = [
        { plot1: 'plot1', plot2: 'plot2', options: { color: '#2196F3', transp: 95, title: 'Background' } },
      ];

      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.basisData.slice(),
          'plot1': s.upperData.slice(),
          'plot2': s.lowerData.slice(),
        },
        fills,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EnvelopeInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<EnvelopeInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const Envelope = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
