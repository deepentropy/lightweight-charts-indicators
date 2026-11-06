/**
 * Negative Volume Index (NVI)
 *
 * Cumulative index that changes only on bars where volume DECREASES versus the
 * prior bar: it moves by the bar's percentage close change (index * (close - close[1]) / close[1]).
 * Tracks "smart money" that is presumed to trade on quiet days. The plot is ta.nvi * 1000
 * (starts at 1000), with an EMA (255) of it as signal line.
 *
 * Based on the standard "Negative Volume Index" indicator.
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface NVIInputs {
  /** Signal EMA length */
  signalLength: number;
}

export const defaultInputs: NVIInputs = {
  signalLength: 255,
};

export const inputConfig: InputConfig[] = [
  { id: 'signalLength', type: 'int', title: 'EMA length', defval: 255, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'NVI', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'NVI-based EMA', color: '#FF9800', lineWidth: 1 },
];

export const metadata = {
  title: 'Negative Volume Index',
  shortTitle: 'NVI',
  overlay: false,
};

type Point = { time: number; value: number };

interface NviRun extends BarRunState<{ index: number }> {
  ema: ReturnType<typeof taStep.ema>;
  nviData: Point[];
  emaData: Point[];
}

function study(inputs: Partial<NVIInputs>): BarStudy<NviRun, IndicatorResult> {
  const { signalLength } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const ema = taStep.ema(signalLength);
      const s: NviRun = { ema, nviData: [], emaData: [], steps: [ema], vars: { index: NaN }, lists: [], series: [] };
      s.series = [s.nviData, s.emaData];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      // ta.nvi: index := index[1] + (close - close[1]) / close[1] * index[1] when the volume falls (nz(index[1]) == 0: 1)
      const prev = !v.index ? 1 : v.index;
      const c = b.close;
      const prevC = i === 0 ? NaN : bars[i - 1].close;
      let index = prev;
      if (c && prevC) {
        const pv = i === 0 ? NaN : bars[i - 1].volume ?? NaN;
        const prevV = i === 0 || Number.isNaN(pv) ? 0 : pv;
        if ((b.volume ?? NaN) < prevV) index = prev + ((c - prevC) / prevC) * prev;
      }
      v.index = index;
      // nvi = ta.nvi * 1000.0; ema = ta.ema(nvi, maLengthInput)
      const nvi = index * 1000;
      s.nviData[i] = { time: b.time, value: nvi };
      s.emaData[i] = { time: b.time, value: s.ema.step(nvi) };
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.nviData.slice(),
          'plot1': s.emaData.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<NVIInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<NVIInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const NegativeVolumeIndex = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
