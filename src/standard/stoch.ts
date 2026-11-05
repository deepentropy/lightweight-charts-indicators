/**
 * Stochastic Oscillator Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Compares closing price to its price range over a given period.
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface StochasticInputs {
  periodK: number;
  smoothK: number;
  periodD: number;
}

export const defaultInputs: StochasticInputs = {
  periodK: 14,
  smoothK: 1,
  periodD: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'periodK', type: 'int', title: '%K Length', defval: 14, min: 1 },
  { id: 'smoothK', type: 'int', title: '%K Smoothing', defval: 1, min: 1 },
  { id: 'periodD', type: 'int', title: '%D Smoothing', defval: 3, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '%K', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: '%D', color: '#FF6D00', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper', price: 80, color: '#787B86', linestyle: 'solid', title: 'Upper Band' },
  { id: 'hline_mid',   price: 50, color: '#787B8680', linestyle: 'solid', title: 'Middle Band' },
  { id: 'hline_lower', price: 20, color: '#787B86', linestyle: 'solid', title: 'Lower Band' },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill_band', plot1: 'hline_upper', plot2: 'hline_lower', color: '#2962FF1A' },
];

export const metadata = {
  title: 'Stochastic',
  shortTitle: 'Stoch',
  overlay: false,
};

type Point = { time: number; value: number };

interface StochRun extends BarRunState<Record<string, never>> {
  raw: ReturnType<typeof taStep.stoch>;
  k: ReturnType<typeof taStep.sma>;
  d: ReturnType<typeof taStep.sma>;
  kData: Point[];
  dData: Point[];
}

function study(inputs: Partial<StochasticInputs>): BarStudy<StochRun, IndicatorResult> {
  const { periodK, smoothK, periodD } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const raw = taStep.stoch(periodK);
      const k = taStep.sma();
      const d = taStep.sma();
      const s: StochRun = { raw, k, d, kData: [], dData: [], steps: [raw, k, d], vars: {}, lists: [], series: [] };
      s.series = [s.kData, s.dData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // %K = ta.sma(ta.stoch(close, high, low, periodK), smoothK); %D = ta.sma(%K, periodD)
      const k = s.k.step(s.raw.step(b.close, b.high, b.low), smoothK);
      const d = s.d.step(k, periodD);
      s.kData[i] = { time: b.time, value: k };
      s.dData[i] = { time: b.time, value: d };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.kData.slice(), 'plot1': s.dData.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<StochasticInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<StochasticInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const Stochastic = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig, fillConfig };
