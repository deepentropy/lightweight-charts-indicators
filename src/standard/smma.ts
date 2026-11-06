/**
 * Smoothed Moving Average (SMMA)
 *
 * Also known as RMA or Wilder's Smoothing.
 * SMMA = (prev_smma * (length - 1) + src) / length
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SMMAInputs {
  /** Period length */
  length: number;
  /** Source */
  src: SourceType;
}

export const defaultInputs: SMMAInputs = {
  length: 7,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 7, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SMMA', color: '#673AB7', lineWidth: 1 },
];

export const metadata = {
  title: 'Smoothed Moving Average',
  shortTitle: 'SMMA',
  overlay: true,
};

type Point = { time: number; value: number };

interface SmmaRun extends BarRunState<Record<string, never>> {
  rma: ReturnType<typeof taStep.rma>;
  smmaData: Point[];
}

function study(inputs: Partial<SMMAInputs>): BarStudy<SmmaRun, IndicatorResult> {
  const { length, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      // SMMA is the same as RMA (Wilder's smoothing)
      const rma = taStep.rma(length);
      const s: SmmaRun = { rma, smmaData: [], steps: [rma], vars: {}, lists: [], series: [] };
      s.series = [s.smmaData];
      return s;
    },
    bar(s, i, bars) {
      s.smmaData[i] = { time: bars[i].time, value: s.rma.step(value(bars[i])) };
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.smmaData.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SMMAInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SMMAInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const SMMA = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
