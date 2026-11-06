/**
 * Positive Volume Index (PVI)
 *
 * Cumulative index that changes only on bars where volume INCREASES versus the
 * prior bar: it moves by the bar's percentage close change (index * (close - close[1]) / close[1]).
 * Tracks the "crowd" that is presumed to trade on active days. The plot is ta.pvi * 1000
 * (starts at 1000), with an EMA (255) of it as signal line.
 *
 * Based on the standard "Positive Volume Index" indicator.
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PVIInputs {
  /** Signal EMA length */
  signalLength: number;
}

export const defaultInputs: PVIInputs = {
  signalLength: 255,
};

export const inputConfig: InputConfig[] = [
  { id: 'signalLength', type: 'int', title: 'EMA length', defval: 255, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'PVI', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'PVI-based EMA', color: '#FF9800', lineWidth: 1 },
];

export const metadata = {
  title: 'Positive Volume Index',
  shortTitle: 'PVI',
  overlay: false,
};

type Point = { time: number; value: number };

interface PviVars {
  /** ta.pvi of the bar before (index[1]), its close and its volume */
  index: number;
  close: number;
  volume: number;
}

interface PviRun extends BarRunState<PviVars> {
  ema: ReturnType<typeof taStep.ema>;
  pviData: Point[];
  emaData: Point[];
}

function study(inputs: Partial<PVIInputs>): BarStudy<PviRun, IndicatorResult> {
  const { signalLength } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const ema = taStep.ema(signalLength);
      const s: PviRun = {
        ema, pviData: [], emaData: [], steps: [ema], vars: { index: NaN, close: NaN, volume: NaN }, lists: [], series: [],
      };
      s.series = [s.pviData, s.emaData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      // ta.pvi: nz(index[1], 0) == 0 ? 1 : index[1], moved by the close change on a bar whose volume rises
      const prev = !v.index ? 1 : v.index;
      const c = b.close;
      const prevC = i === 0 ? NaN : v.close;
      const vol = b.volume ?? NaN;
      let index = prev;
      if (c && prevC) {
        const prevV = i === 0 || Number.isNaN(v.volume) ? 0 : v.volume;
        if (vol > prevV) index = prev + ((c - prevC) / prevC) * prev;
      }
      v.index = index;
      v.close = c;
      v.volume = vol;
      // pvi = ta.pvi * 1000.0; ema = ta.ema(pvi, maLengthInput)
      const pvi = index * 1000;
      s.pviData[i] = { time: b.time, value: pvi };
      s.emaData[i] = { time: b.time, value: s.ema.step(pvi) };
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.pviData.slice(),
          'plot1': s.emaData.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PVIInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PVIInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const PositiveVolumeIndex = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
