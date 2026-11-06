/**
 * Accumulation/Distribution
 *
 * Running total of the close location value times the volume:
 *
 *   ad = cum( close == high and close == low or high == low ? 0 : ((2 * close - low - high) / (high - low)) * volume )
 *
 * When the sum of the volume of all bars is 0 on the last bar, the original stops with the runtime error "No volume
 * is provided by the data vendor."; the port throws the same message.
 *
 * Based on the standard Accumulation/Distribution indicator.
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AccumulationDistributionInputs {}

export const defaultInputs: AccumulationDistributionInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Accumulation/Distribution', color: '#999915', lineWidth: 1 },
];

export const metadata = {
  title: 'Accumulation/Distribution',
  shortTitle: 'Accum/Dist',
  overlay: false,
};

/** Pine float equality: within 1e-10 (na compares false) */
const eq = (a: number, b: number) => Math.abs(a - b) <= 1e-10;

interface AdVars {
  /** var cumVol = 0.; cumVol += nz(volume) */
  cumVol: number;
}

interface AdRun extends BarRunState<AdVars> {
  cum: ReturnType<typeof taStep.cum>;
  plot0: { time: number; value: number }[];
}

function study(): BarStudy<AdRun, IndicatorResult> {
  return {
    init() {
      const cum = taStep.cum();
      const s: AdRun = { cum, plot0: [], steps: [cum], vars: { cumVol: 0 }, lists: [], series: [] };
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const { high, low, close } = bars[i];
      const volume = bars[i].volume ?? NaN;
      s.vars.cumVol += Number.isFinite(volume) ? volume : 0;
      const mfv = (eq(close, high) && eq(close, low)) || eq(high, low)
        ? 0
        : ((2 * close - low - high) / (high - low)) * volume;
      const v = s.cum.step(mfv);
      s.plot0[i] = { time: bars[i].time, value: Number.isFinite(v) ? v : NaN };
    },
    result(s, bars) {
      // runtime error on the last bar when cumVol is 0
      if (bars.length > 0 && eq(s.vars.cumVol, 0)) {
        throw new Error('No volume is provided by the data vendor.');
      }
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plot0.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<AccumulationDistributionInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(), chart);
}

export function calculate(bars: Bar[], _inputs: Partial<AccumulationDistributionInputs> = {}): IndicatorResult {
  return fullResult(createRun(_inputs).update(bars));
}

export const AccumulationDistribution = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
